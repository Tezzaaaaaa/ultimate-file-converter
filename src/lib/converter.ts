/**
 * Browser-side conversion engine.
 *
 * FFmpeg (WebAssembly) handles media work, while lightweight libraries handle
 * documents and spreadsheets. Converters are fetched from public CDNs, so an
 * internet connection is needed on first use.
 */
import { FFmpeg } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/+esm';
import { fetchFile, toBlobURL } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/+esm';
import JSZip from 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm';

import {
  canConvert,
  defaultOutput,
  escapeHtml as esc,
  fileKind,
  formats,
  groups,
  labelFor,
  mimeFor,
  type FileKind,
} from './formats';

const CDN = 'https://cdn.jsdelivr.net/npm/';
const CORE_BASE = CDN + '@ffmpeg/core@0.12.10/dist/esm/';
const WORKER_URL = CDN + '@ffmpeg/ffmpeg@0.12.15/dist/esm/worker.js';

export type SourceItem = { file: File; output: string };
export type ConversionResult = { name: string; blob: Blob; size: number };
export type ProgressSink = (value: number, label: string) => void;

let ffmpeg: any = null;
let ffmpegLog: string[] = [];
let onFileProgress: (p: number) => void = () => {};
let loaded = false;

export function resetEngine() {
  try {
    ffmpeg?.terminate();
  } catch {
    /* ignore */
  }
  ffmpeg = null;
  loaded = false;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => clearTimeout(timer)) as Promise<T>;
}

async function loadEngine(progress: ProgressSink) {
  if (loaded) return;

  progress(4, 'Downloading conversion engine (v2, ~30 MB)…');

  ffmpeg = new FFmpeg();
  ffmpeg.on('log', ({ message }: { message: string }) => {
    ffmpegLog.push(message);
    if (ffmpegLog.length > 20) ffmpegLog.shift();
  });
  ffmpeg.on('progress', ({ progress: p }: { progress: number }) => onFileProgress(p));

  try {
    // Browsers block cross-origin Workers, so the worker is a same-origin blob
    // that imports the CDN worker.
    const workerURL = URL.createObjectURL(
      new Blob(['import ' + JSON.stringify(WORKER_URL) + ';'], { type: 'text/javascript' }),
    );
    try {
      progress(5, 'Downloading FFmpeg core…');
      const coreURL = await withTimeout(
        toBlobURL(CORE_BASE + 'ffmpeg-core.js', 'text/javascript'),
        60000,
        'Timed out downloading the FFmpeg core. Check your connection and try again.',
      );
      progress(7, 'Downloading FFmpeg WebAssembly…');
      const wasmURL = await withTimeout(
        toBlobURL(CORE_BASE + 'ffmpeg-core.wasm', 'application/wasm'),
        60000,
        'Timed out downloading the FFmpeg WebAssembly engine. Check your connection and try again.',
      );

      progress(8, 'Starting conversion engine…');
      // ffmpeg.load() may hang when its worker fails to start, so it is wrapped
      // in a timeout.
      await withTimeout(
        ffmpeg.load({ classWorkerURL: workerURL, coreURL, wasmURL }),
        60000,
        'Conversion engine failed to start. Check that your browser allows workers and try again.',
      );
    } finally {
      URL.revokeObjectURL(workerURL);
    }
  } catch (error) {
    resetEngine();
    throw error;
  }

  loaded = true;
}

async function run(args: string[], name: string) {
  ffmpegLog = [];
  let code: number;
  try {
    // Large media files can take time, but the UI must not wait indefinitely.
    code = await withTimeout(
      ffmpeg.exec(args),
      15 * 60 * 1000,
      name + ': conversion timed out after 15 minutes. Try a smaller file or a different output format.',
    );
  } catch (error) {
    // A timed-out FFmpeg worker may still be busy. Reset it so Retry starts a
    // fresh engine.
    resetEngine();
    throw error;
  }
  if (code !== 0) {
    const last = ffmpegLog[ffmpegLog.length - 1];
    throw new Error(name + ': conversion failed' + (last ? ' (' + last + ')' : ''));
  }
}

function audioCodec(ext: string) {
  return (
    {
      mp3: ['-c:a', 'libmp3lame', '-b:a', '192k'],
      m4a: ['-c:a', 'aac', '-b:a', '192k'],
      aac: ['-c:a', 'aac', '-b:a', '192k'],
      wav: ['-c:a', 'pcm_s16le'],
      flac: ['-c:a', 'flac'],
      ogg: ['-c:a', 'libvorbis', '-q:a', '5'],
      opus: ['-c:a', 'libopus', '-b:a', '128k'],
    } as Record<string, string[]>
  )[ext] ?? [];
}

function videoCodec(ext: string) {
  // VP9 can hang in the single-threaded browser FFmpeg build. Use VP8 for
  // reliable WebM conversion.
  if (ext === 'webm')
    return ['-c:v', 'libvpx', '-crf', '32', '-b:v', '0', '-deadline', 'good', '-cpu-used', '5', '-c:a', 'libopus', '-b:a', '128k'];
  if (ext === 'avi') return ['-c:v', 'mpeg4', '-q:v', '4', '-c:a', 'mp3', '-b:a', '160k'];
  return ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k'];
}

// Formats whose muxers can carry an attached cover image.
const coverFormats = ['mp3', 'm4a', 'flac'];

// Copies tags from input `src` and uses tag-friendly container options.
function tagArgs(ext: string, src = 0) {
  const args = ['-map_metadata', String(src)];
  if (ext === 'mp3') args.push('-id3v2_version', '3', '-write_id3v1', '1');
  if (['m4a', 'mp4', 'mov'].includes(ext)) args.push('-movflags', '+use_metadata_tags');
  return args;
}

function isAudioExt(ext: string) {
  return groups.Audio.some((l) => formats[l] === ext);
}
function isVideoExt(ext: string) {
  return groups.Video.some((l) => formats[l] === ext);
}
function isImageExt(ext: string) {
  return groups.Image.some((l) => formats[l] === ext);
}

function commandFor(sourceKind: FileKind, ext: string, inputName: string, outputName: string) {
  const args = ['-y'];

  if (sourceKind === 'Audio' && isVideoExt(ext) && ext !== 'gif') {
    args.push(
      '-f', 'lavfi', '-i', 'color=c=black:s=1280x720:r=30', '-i', inputName,
      '-map', '0:v:0', '-map', '1:a:0', ...tagArgs(ext, 1), '-shortest', ...videoCodec(ext), outputName,
    );
    return args;
  }

  // Image inputs: -loop and -framerate are input options, so they must come before -i.
  if (sourceKind === 'Image' && ext === 'gif') {
    return ['-y', '-loop', '1', '-framerate', '12', '-t', '3', '-i', inputName,
      '-vf', 'scale=1280:-1:flags=lanczos', '-loop', '0', outputName];
  }

  if (sourceKind === 'Image' && isVideoExt(ext)) {
    return ['-y', '-loop', '1', '-framerate', '30', '-t', '5', '-i', inputName,
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', ...videoCodec(ext), outputName];
  }

  args.push('-i', inputName);

  if (sourceKind === 'Video' && isAudioExt(ext)) {
    args.push('-vn', ...tagArgs(ext), ...audioCodec(ext), outputName);
    return args;
  }

  if (sourceKind === 'Video' && isImageExt(ext)) {
    if (ext === 'jpg') args.push('-frames:v', '1', '-q:v', '3');
    else if (ext === 'webp') args.push('-frames:v', '1', '-c:v', 'libwebp', '-quality', '90');
    else args.push('-frames:v', '1');
    args.push(outputName);
    return args;
  }

  if (ext === 'gif') {
    args.push('-vf', 'fps=12,scale=1280:-1:flags=lanczos', outputName);
    return args;
  }

  if (isAudioExt(ext)) {
    // Audio files: keep the cover art (an attached picture stream) where the
    // target format supports it.
    if (sourceKind === 'Audio' && coverFormats.includes(ext))
      args.push('-map', '0:a:0', '-map', '0:v:0?', '-c:v', 'copy');
    else args.push('-vn');
    args.push(...tagArgs(ext), ...audioCodec(ext), outputName);
    return args;
  }
  if (isVideoExt(ext)) {
    args.push(...tagArgs(ext), ...videoCodec(ext), outputName);
    return args;
  }
  if (isImageExt(ext)) {
    if (ext === 'jpg') args.push('-frames:v', '1', '-q:v', '3');
    else if (ext === 'webp') args.push('-frames:v', '1', '-c:v', 'libwebp', '-quality', '90');
    else args.push('-frames:v', '1');
    args.push(outputName);
    return args;
  }

  throw new Error('Unsupported conversion path');
}

async function convertOffice(
  file: File,
  kind: FileKind,
  ext: string,
  reportProgress: (fraction: number, stage: string) => void = () => {},
): Promise<ConversionResult> {
  const sourceExt = file.name.split('.').pop()!.toLowerCase();
  let blob: Blob;
  let outputName: string;

  reportProgress(0.03, 'Loading document conversion tools');
  if (kind === 'Spreadsheet') {
    const XLSX: any = await withTimeout(
      import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm'),
      60000,
      'Timed out loading spreadsheet support. Check your connection and try again.',
    );
    reportProgress(0.2, 'Reading spreadsheet');
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    reportProgress(0.55, 'Preparing spreadsheet output');
    if (ext === 'pdf') {
      const sheetText = workbook.SheetNames.map(
        (name: string) => 'Sheet: ' + name + '\n' + XLSX.utils.sheet_to_csv(workbook.Sheets[name]),
      ).join('\n\n');
      reportProgress(0.7, 'Building PDF');
      blob = await textToPdf(sheetText);
    } else {
      const data = XLSX.write(workbook, { bookType: ext, type: ext === 'csv' ? 'string' : 'array' });
      const mime = {
        csv: 'text/csv;charset=utf-8',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        xls: 'application/vnd.ms-excel',
        ods: 'application/vnd.oasis.opendocument.spreadsheet',
      }[ext] as string;
      blob = new Blob([data], { type: mime });
    }
  } else {
    let text = '';
    reportProgress(0.12, 'Reading document content');
    if (['txt', 'md'].includes(sourceExt)) text = await file.text();
    else if (['html', 'htm'].includes(sourceExt)) {
      const doc = new DOMParser().parseFromString(await file.text(), 'text/html');
      doc.querySelectorAll('script,style,head').forEach((n) => n.remove());
      text = ((doc.body as any)?.innerText || doc.body?.textContent || '').trim();
    } else if (sourceExt === 'rtf') {
      text = (await file.text())
        .replace(/\\par[d]?/gi, '\n')
        .replace(/\\'[0-9a-f]{2}/gi, ' ')
        .replace(/\\[a-z]+-?\d* ?/gi, '')
        .replace(/[{}]/g, '')
        .trim();
    } else if (sourceExt === 'pdf') {
      const pdfjs: any = await withTimeout(
        import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs/+esm'),
        60000,
        'Timed out loading PDF support. Check your connection and try again.',
      );
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';
      const pdf: any = await withTimeout(
        pdfjs.getDocument({
          data: new Uint8Array(await file.arrayBuffer()),
          useWorkerFetch: false,
          isEvalSupported: false,
        }).promise,
        5 * 60 * 1000,
        file.name + ': PDF text extraction timed out.',
      );
      const pages: string[] = [];
      for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
        reportProgress(
          0.15 + (0.5 * (pageNo - 1)) / Math.max(1, pdf.numPages),
          'Extracting PDF text (page ' + pageNo + ' of ' + pdf.numPages + ')',
        );
        const page = await pdf.getPage(pageNo);
        const content = await page.getTextContent();
        pages.push(content.items.map((item: any) => item.str || '').join(' '));
      }
      text = pages.join('\n\n').trim();
      if (!text)
        throw new Error(
          file.name +
            ': this PDF has no selectable text. Scanned PDFs require OCR, which is not available in this converter yet.',
        );
    } else {
      reportProgress(0.18, 'Opening Office document');
      const zip: any = await withTimeout(
        JSZip.loadAsync(file),
        60000,
        'Timed out opening this Office document. The file may be damaged or too large.',
      );
      let xml = '';
      if (sourceExt === 'docx') xml = (await zip.file('word/document.xml')?.async('text')) || '';
      else if (sourceExt === 'odt') xml = (await zip.file('content.xml')?.async('text')) || '';
      else if (sourceExt === 'pptx') {
        const paths = Object.keys(zip.files)
          .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
          .sort((x, y) => x.localeCompare(y, undefined, { numeric: true }));
        xml = (await Promise.all(paths.map((n) => zip.file(n)!.async('text')))).join('\n');
      } else if (sourceExt === 'odp') xml = (await zip.file('content.xml')?.async('text')) || '';
      if (!xml) throw new Error(file.name + ': readable document content was not found.');
      reportProgress(0.62, 'Extracting document text');
      const parsed = new DOMParser().parseFromString(xml, 'application/xml');
      if (['odt', 'odp'].includes(sourceExt)) {
        const textNamespace = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
        text = [...parsed.getElementsByTagNameNS(textNamespace, '*')]
          .filter((n) => ['p', 'h'].includes(n.localName))
          .map((n) => n.textContent!.trim())
          .filter(Boolean)
          .join('\n');
      } else {
        text = [...parsed.getElementsByTagName('*')]
          .filter((n) => ['t', 'p', 'h'].includes(n.localName))
          .map((n) => (n.localName === 't' ? n.textContent : '\n'))
          .join('')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      }
    }

    reportProgress(0.78, 'Preparing converted file');
    if (kind === 'Presentation' && ext === 'pptx') {
      const PptxGenJS = (
        await withTimeout(
          import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/+esm'),
          60000,
          'Timed out loading presentation support. Check your connection and try again.',
        )
      ).default;
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_WIDE';
      const chunks = text.split(/\n{2,}/).filter(Boolean);
      for (const chunk of chunks.length ? chunks : [text || ' ']) {
        const slide = pptx.addSlide();
        slide.addText(chunk, {
          x: 0.6, y: 0.6, w: 12.1, h: 6.2, fontFace: 'Arial', fontSize: 22, color: '222222', valign: 'top',
        });
      }
      blob = await pptx.write({ outputType: 'blob' });
    } else if (ext === 'txt' || ext === 'md') {
      blob = new Blob([text], {
        type: ext === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8',
      });
    } else if (ext === 'html') {
      const html =
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Converted file</title></head><body>' +
        text.split(/\r?\n/).map((line) => '<p>' + esc(line) + '</p>').join('') +
        '</body></html>';
      blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    } else if (ext === 'docx') {
      const zip = new JSZip();
      const paragraphs = text
        .split(/\r?\n/)
        .map((line) => '<w:p><w:r><w:t xml:space="preserve">' + esc(line) + '</w:t></w:r></w:p>')
        .join('');
      zip.file(
        '[Content_Types].xml',
        '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      );
      zip.file(
        '_rels/.rels',
        '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      );
      zip.file(
        'word/document.xml',
        '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
          paragraphs +
          '<w:sectPr/></w:body></w:document>',
      );
      blob = await zip.generateAsync({ type: 'blob' });
    } else if (ext === 'rtf') {
      const escaped = text
        .replace(/\\/g, '\\\\')
        .replace(/{/g, '\\{')
        .replace(/}/g, '\\}')
        .replace(/\r?\n/g, '\\par\n');
      blob = new Blob(['{\\rtf1\\ansi\\deff0\n' + escaped + '}'], { type: 'application/rtf' });
    } else if (ext === 'odt') {
      const zip = new JSZip();
      zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
      const paras = text.split(/\r?\n/).map((line) => '<text:p>' + esc(line) + '</text:p>').join('');
      zip.file(
        'content.xml',
        '<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2"><office:body><office:text>' +
          paras +
          '</office:text></office:body></office:document-content>',
      );
      zip.file(
        'META-INF/manifest.xml',
        '<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/></manifest:manifest>',
      );
      blob = await zip.generateAsync({ type: 'blob' });
    } else throw new Error(file.name + ': this output pathway is not supported.');

    if ((ext as string) === 'pdf') {
      reportProgress(0.88, 'Building PDF');
      blob = await textToPdf(text);
    }
  }

  reportProgress(0.96, 'Finishing converted file');
  outputName = file.name.replace(/\.[^.]+$/, '') + '.' + ext;
  return { name: outputName, blob, size: blob.size };
}

async function textToPdf(text: string): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await withTimeout(
    import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm'),
    60000,
    'Timed out loading PDF creation support. Check your connection and try again.',
  );
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const margin = 48;
  const lineHeight = 14;
  const maxChars = 96;
  const lines: string[] = [];
  for (const rawLine of String(text || '').replace(/\t/g, '    ').split(/\r?\n/)) {
    let line = '';
    for (const word of rawLine.split(/\s+/)) {
      if (!word) continue;
      if (line && line.length + 1 + word.length > maxChars) {
        lines.push(line);
        line = '';
      }
      let remaining = word;
      while (remaining.length > maxChars) {
        if (line) {
          lines.push(line);
          line = '';
        }
        lines.push(remaining.slice(0, maxChars));
        remaining = remaining.slice(maxChars);
      }
      line += (line ? ' ' : '') + remaining;
    }
    lines.push(line);
  }
  let page = pdf.addPage([612, 792]);
  let y = page.getHeight() - margin;
  for (const line of lines) {
    if (y < margin) {
      page = pdf.addPage([612, 792]);
      y = page.getHeight() - margin;
    }
    if (line)
      page.drawText(line, {
        x: margin, y, size: 10, font, color: rgb(0.12, 0.12, 0.12), maxWidth: page.getWidth() - margin * 2,
      });
    y -= lineHeight;
  }
  return new Blob([await pdf.save()], { type: 'application/pdf' });
}

async function imageToPdf(file: File): Promise<Blob> {
  const { PDFDocument } = await withTimeout(
    import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm'),
    60000,
    'Timed out loading PDF creation support. Check your connection and try again.',
  );
  const pdf = await PDFDocument.create();
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  bitmap.close();
  const png = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not decode image for PDF conversion.'))),
      'image/png',
    ),
  );
  const image = await pdf.embedPng(await png.arrayBuffer());
  const page = pdf.addPage([image.width, image.height]);
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  return new Blob([await pdf.save()], { type: 'application/pdf' });
}

const officeFormats = ['zip', 'txt', 'md', 'html', 'docx', 'odt', 'rtf', 'xlsx', 'xls', 'csv', 'ods', 'pptx', 'pdf'];

async function convertOne(
  item: SourceItem,
  index: number,
  total: number,
  progress: ProgressSink,
  frameInterval: number,
): Promise<ConversionResult> {
  const file = item.file;
  const kind = fileKind(file);
  const base = 10 + (index / total) * 90;
  const span = 90 / total;
  const ext = item.output || defaultOutput(kind);

  const label = labelFor(ext);
  if (!label || !canConvert(kind, label, file.name)) {
    throw new Error(file.name + ': cannot convert to ' + ext.toUpperCase());
  }

  if (kind === 'Image' && ext === 'pdf') {
    progress(base, 'Preparing image for PDF: ' + file.name);
    const blob = await withTimeout(
      imageToPdf(file),
      5 * 60 * 1000,
      file.name + ': image-to-PDF conversion timed out. Try a smaller image.',
    );
    progress(base + span, 'Finished converting: ' + file.name);
    return { name: file.name.replace(/\.[^.]+$/, '') + '.pdf', blob, size: blob.size };
  }

  if (['Document', 'Spreadsheet', 'Presentation'].includes(kind) && ext !== 'zip') {
    const reportProgress = (fraction: number, stage: string) => {
      progress(base + span * Math.max(0, Math.min(1, fraction)), stage + ': ' + file.name);
    };
    reportProgress(0, 'Preparing conversion');
    return withTimeout(
      convertOffice(file, kind, ext, reportProgress),
      5 * 60 * 1000,
      file.name + ': conversion timed out after 5 minutes. Try a smaller file or another output format.',
    );
  }

  if (ext === 'zip') {
    progress(base, 'Preparing ZIP archive: ' + file.name);
    const zip = new JSZip();
    zip.file(file.name, file);
    const blob = await withTimeout<Blob>(
      zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
        (metadata: { percent: number }) =>
          progress(base + span * (metadata.percent / 100), 'Creating ZIP archive: ' + file.name),
      ),
      5 * 60 * 1000,
      file.name + ': ZIP creation timed out. Try a smaller file.',
    );
    return { name: file.name.replace(/\.[^.]+$/, '') + '.zip', blob, size: blob.size };
  }

  await loadEngine(progress);

  const inName = 'input-' + index + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const out = index + '-out.' + ext;

  if (ext === 'frames') {
    if (!Number.isFinite(frameInterval) || frameInterval < 0.1 || frameInterval > 3600) {
      throw new Error('Frame interval must be between 0.1 and 3600 seconds.');
    }

    const framePattern = 'frame-' + index + '-%05d.jpg';
    progress(base, 'Preparing file for frame extraction: ' + file.name);
    try {
      await withTimeout(
        ffmpeg.writeFile(inName, await fetchFile(file)),
        5 * 60 * 1000,
        file.name + ': preparing the file for frame extraction timed out.',
      );
    } catch (error) {
      resetEngine();
      throw error;
    }

    const message = 'Extracting frames from ' + file.name;
    progress(base, message);
    onFileProgress = (p) => {
      if (Number.isFinite(p)) progress(base + span * Math.max(0, Math.min(1, p)), message);
    };

    try {
      await run(['-y', '-i', inName, '-vf', 'fps=1/' + frameInterval, '-q:v', '3', framePattern], file.name);
      const zip = new JSZip();
      let frameCount = 0;
      for (let frame = 1; ; frame++) {
        const frameName = framePattern.replace('%05d', String(frame).padStart(5, '0'));
        let data: any;
        try {
          data = await ffmpeg.readFile(frameName);
        } catch {
          break;
        }
        zip.file(frameName.replace(/^frame-\d+-/, ''), data);
        frameCount++;
        await ffmpeg.deleteFile(frameName).catch(() => {});
      }
      if (!frameCount) throw new Error(file.name + ': no frames could be extracted.');
      const blob = await zip.generateAsync({
        type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 4 },
      });
      return { name: file.name.replace(/\.[^.]+$/, '') + '-frames.zip', blob, size: blob.size };
    } finally {
      onFileProgress = () => {};
      if (ffmpeg) await ffmpeg.deleteFile(inName).catch(() => {});
    }
  }

  progress(base, 'Preparing file for conversion: ' + file.name);
  try {
    await withTimeout(
      ffmpeg.writeFile(inName, await fetchFile(file)),
      5 * 60 * 1000,
      file.name + ': preparing the file timed out. Try a smaller file.',
    );
  } catch (error) {
    resetEngine();
    throw error;
  }

  let pal = '';
  try {
    const message = 'Converting ' + file.name;
    progress(base, message);
    // Install the progress listener before starting FFmpeg so the first
    // progress event cannot be missed.
    onFileProgress = (p) => {
      if (Number.isFinite(p)) progress(base + span * Math.max(0, Math.min(1, p)), message);
    };

    if (kind === 'Video' && ext === 'gif') {
      pal = 'pal-' + index + '.png';
      await run(
        ['-y', '-i', inName, '-vf', 'fps=12,scale=1280:-1:flags=lanczos,palettegen=stats_mode=full', pal],
        file.name,
      );
      await run(
        ['-y', '-i', inName, '-i', pal, '-filter_complex',
          '[0:v]fps=12,scale=1280:-1:flags=lanczos[x];[x][1:v]paletteuse[v]',
          '-map', '[v]', '-an', '-loop', '0', out],
        file.name,
      );
    } else {
      await run(commandFor(kind, ext, inName, out), file.name);
    }

    const data = await ffmpeg.readFile(out);
    const blob = new Blob([data], { type: mimeFor(ext) });
    return { name: file.name.replace(/\.[^.]+$/, '') + '.' + ext, blob, size: blob.size };
  } finally {
    onFileProgress = () => {};
    await ffmpeg.deleteFile(inName).catch(() => {});
    await ffmpeg.deleteFile(out).catch(() => {});
    if (pal) await ffmpeg.deleteFile(pal).catch(() => {});
  }
}

export function needsMediaEngine(items: SourceItem[]) {
  return items.some((item) => {
    const ext = item.output || defaultOutput(fileKind(item.file));
    return !officeFormats.includes(ext);
  });
}

/**
 * Warms up FFmpeg ahead of a batch so engine download progress is reported
 * before the first media file starts converting.
 */
export async function prepareEngine(items: SourceItem[], progress: ProgressSink) {
  if (needsMediaEngine(items)) await loadEngine(progress);
}

/** Converts every item in order, reporting a 0-100 overall percentage. */
export async function convertBatch(
  items: SourceItem[],
  options: { frameInterval: number; onProgress: ProgressSink },
): Promise<ConversionResult[]> {
  const results: ConversionResult[] = [];
  for (let i = 0; i < items.length; i++) {
    results.push(await convertOne(items[i], i, items.length, options.onProgress, options.frameInterval));
  }
  return results;
}
