import { FFmpeg } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/+esm';
import { fetchFile, toBlobURL } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/+esm';
import JSZip from 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm';

const input = document.querySelector('#file');
const drop = document.querySelector('#drop');
const queue = document.querySelector('#queue');
const items = document.querySelector('#items');
const clear = document.querySelector('#clear');
const convert = document.querySelector('#convert');
const progress = document.querySelector('#progress');
const progressLabel = document.querySelector('#progressLabel');
const progressValue = document.querySelector('#progressValue');
const progressBar = document.querySelector('#progressBar');
const downloads = document.querySelector('#downloads');
const downloadList = document.querySelector('#downloadList');
const downloadAll = document.querySelector('#downloadAll');
const sourceTitle = document.querySelector('#dropTitle');
const sourceHint = document.querySelector('#dropHint');
const frameOptions = document.querySelector('#frameOptions');
const frameInterval = document.querySelector('#frameInterval');

const CDN = 'https://cdn.jsdelivr.net/npm/';
const CORE_BASE = CDN + '@ffmpeg/core@0.12.10/dist/esm/';
const WORKER_URL = CDN + '@ffmpeg/ffmpeg@0.12.15/dist/esm/worker.js';

let ffmpeg = null;
let ffmpegLog = [];
let onFileProgress = () => {};
let loaded = false;
let converting = false;
let files = [];
let results = [];

const formats = {
  MP3: 'mp3', M4A: 'm4a', AAC: 'aac', WAV: 'wav', FLAC: 'flac', OGG: 'ogg', OPUS: 'opus',
  MP4: 'mp4', MOV: 'mov', WEBM: 'webm', MKV: 'mkv', AVI: 'avi', GIF: 'gif',
  JPG: 'jpg', PNG: 'png', WEBP: 'webp', BMP: 'bmp', TIFF: 'tiff', PDF: 'pdf', FRAMES: 'frames', ZIP: 'zip',
  TXT: 'txt', MD: 'md', HTML: 'html', DOCX: 'docx', ODT: 'odt', RTF: 'rtf', XLSX: 'xlsx', XLS: 'xls', CSV: 'csv', ODS: 'ods', PPTX: 'pptx'
};

const groups = {
  Audio: ['MP3', 'M4A', 'AAC', 'WAV', 'FLAC', 'OGG', 'OPUS'],
  Video: ['MP4', 'MOV', 'WEBM', 'MKV', 'AVI', 'GIF'],
  Image: ['JPG', 'PNG', 'WEBP', 'BMP', 'TIFF', 'PDF'],
  Document: ['TXT', 'MD', 'HTML', 'DOCX', 'ODT', 'RTF', 'PDF'],
  Spreadsheet: ['XLSX', 'XLS', 'CSV', 'ODS', 'PDF'],
  Presentation: ['PPTX', 'PDF'],
  Archive: ['ZIP']
};

const imageExt = /\.(jpg|jpeg|png|webp|bmp|tif|tiff)$/i;
const videoExt = /\.(mp4|mov|m4v|webm|mkv|avi|wmv|flv|mpeg|mpg|3gp)$/i;
const audioExt = /\.(mp3|wav|m4a|aac|flac|ogg|opus|wma|aiff|aif)$/i;
const documentExt = /\.(txt|md|html?|docx|odt|rtf|pdf)$/i;
const spreadsheetExt = /\.(xlsx|xls|csv|ods)$/i;
const presentationExt = /\.(pptx|odp)$/i;

const size = n => n < 1024 * 1024
  ? (n / 1024).toFixed(1) + ' KB'
  : (n / 1024 / 1024).toFixed(1) + ' MB';

const esc = s => String(s).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

function fileKind(file) {
  if (file.type.startsWith('video/') || videoExt.test(file.name) || /\.gif$/i.test(file.name)) return 'Video';
  if (file.type.startsWith('image/') || imageExt.test(file.name) || /\.svg$/i.test(file.name)) return 'Image';
  if (file.type.startsWith('audio/') || audioExt.test(file.name)) return 'Audio';
  if (spreadsheetExt.test(file.name)) return 'Spreadsheet';
  if (presentationExt.test(file.name)) return 'Presentation';
  if (documentExt.test(file.name)) return 'Document';
  return 'File';
}

const allowed = {
  Audio: [...groups.Audio, 'MP4', 'MOV', 'WEBM', 'MKV', 'AVI', 'ZIP'],
  Video: [...groups.Audio, ...groups.Video, ...groups.Image, 'FRAMES', 'ZIP'],
  Image: [...groups.Image, ...groups.Video, 'ZIP'],
  Document: [...groups.Document, 'ZIP'],
  Spreadsheet: [...groups.Spreadsheet, 'ZIP'],
  Presentation: [...groups.Presentation, 'TXT', 'HTML', 'ZIP'],
  File: ['ZIP']
};

function canConvert(kind, label, fileName = '') {
  if (label === 'FRAMES') return kind === 'Video';
  if (kind === 'Audio' && label === 'GIF') return false;
  if (/\.gif$/i.test(fileName) && kind === 'Video' && groups.Audio.includes(label)) return false;
  if (kind === 'Document' && groups.Document.includes(label)) return true;
  if (kind === 'Spreadsheet' && groups.Spreadsheet.includes(label)) return true;
  if (kind === 'Presentation' && ['PPTX', 'PDF', 'TXT', 'HTML'].includes(label)) return true;
  if (['Document', 'Spreadsheet', 'Presentation'].includes(kind) && label === 'ZIP') return true;
  return allowed[kind]?.includes(label) === true;
}

function defaultOutput(kind) {
  if (kind === 'Audio') return 'mp3';
  if (kind === 'Video') return 'mp4';
  if (kind === 'Image') return 'png';
  if (kind === 'Document') return 'txt';
  if (kind === 'Spreadsheet') return 'xlsx';
  if (kind === 'Presentation') return 'pptx';
  return 'zip';
}

function render() {
  queue.hidden = !files.length;
  convert.disabled = !files.length || converting;
  input.disabled = converting;
  clear.disabled = converting;

  document.querySelector('#queueTitle').textContent =
    files.length === 1 ? '1 file' : files.length + ' files';

  items.innerHTML = files.map((file, index) => {
    const kind = fileKind(file);
    const selected = file.output || defaultOutput(kind);
    const choices = (allowed[kind] || [])
      .filter(label => canConvert(kind, label, file.name))
      .map(label => {
        const value = formats[label];
        return '<option value="' + value + '"' +
          (value === selected ? ' selected' : '') + '>' + label + '</option>';
      }).join('');

    return '<div class="item">' +
      '<div class="file-info">' +
        '<div class="name">' + esc(file.name) + '</div>' +
        '<div class="meta">' + esc(size(file.size)) + ' · ' + esc(kind) + '</div>' +
      '</div>' +
      '<label class="row-format">Convert to' +
        '<select class="select" data-i="' + index + '">' +
          choices +
        '</select>' +
      '</label>' +
      '<button class="link remove" data-i="' + index + '"' + (converting ? ' disabled' : '') + '>Remove</button>' +
    '</div>';
  }).join('');

  frameOptions.hidden = !files.some(file => file.output === 'frames');

  document.querySelectorAll('.select').forEach(select => {
    select.onchange = event => {
      files[Number(event.target.dataset.i)].output = event.target.value;
    };
  });

  document.querySelectorAll('.remove').forEach(button => {
    button.onclick = () => {
      files.splice(Number(button.dataset.i), 1);
      render();
      updateSourceCopy();
    };
  });
}

function updateSourceCopy() {
  sourceTitle.textContent = files.length === 1
    ? files[0].name
    : files.length + ' files selected';
  sourceHint.textContent = files.length
    ? 'Click to add more files'
    : 'Choose files or drag and drop';
  drop.classList.toggle('has-file', files.length > 0);
}

function add(list) {
  const incoming = [...list];
  if (!incoming.length) return;

  incoming.forEach(file => {
    const kind = fileKind(file);
    files.push(Object.assign(file, { output: defaultOutput(kind) }));
  });

  render();
  updateSourceCopy();
  input.value = '';
}

function setProgress(value, label) {
  progress.hidden = false;
  const v = Math.max(0, Math.min(100, Math.round(value)));
  progressValue.textContent = v + '%';
  progressBar.style.width = v + '%';
  progressLabel.textContent = label;
}

function withTimeout(promise, ms, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); })
  ]).finally(() => clearTimeout(timer));
}

async function loadEngine() {
  if (loaded) return;

  setProgress(4, 'Downloading conversion engine (v2, ~30 MB)…');

  ffmpeg = new FFmpeg();
  ffmpeg.on('log', ({ message }) => {
    ffmpegLog.push(message);
    if (ffmpegLog.length > 20) ffmpegLog.shift();
  });
  ffmpeg.on('progress', ({ progress }) => onFileProgress(progress));

  try {
    // Browsers block cross-origin Workers, so the worker is a same-origin blob that imports the CDN worker.
    const workerURL = URL.createObjectURL(
      new Blob(['import ' + JSON.stringify(WORKER_URL) + ';'], { type: 'text/javascript' })
    );
    const coreURL = await toBlobURL(CORE_BASE + 'ffmpeg-core.js', 'text/javascript');
    const wasmURL = await toBlobURL(CORE_BASE + 'ffmpeg-core.wasm', 'application/wasm');

    setProgress(8, 'Starting conversion engine…');
    // ffmpeg.load() never rejects when the worker fails to start, so it is wrapped in a timeout.
    await withTimeout(
      ffmpeg.load({ classWorkerURL: workerURL, coreURL, wasmURL }),
      60000,
      'Conversion engine failed to start. Open the browser console for details.'
    );
  } catch (error) {
    try { ffmpeg.terminate(); } catch {}
    ffmpeg = null;
    throw error;
  }

  loaded = true;
}

async function run(args, name) {
  ffmpegLog = [];
  // Never leave the UI waiting forever if an FFmpeg wasm job hangs.
  // A conversion is allowed up to 15 minutes before the worker is restarted.
  const code = await withTimeout(
    ffmpeg.exec(args),
    15 * 60 * 1000,
    name + ': conversion timed out. The input or selected format could not be processed.'
  );
  if (code !== 0) {
    const last = ffmpegLog[ffmpegLog.length - 1];
    throw new Error(name + ': conversion failed' + (last ? ' (' + last + ')' : ''));
  }
}

function audioCodec(ext) {
  return {
    mp3: ['-c:a', 'libmp3lame', '-b:a', '192k'],
    m4a: ['-c:a', 'aac', '-b:a', '192k'],
    aac: ['-c:a', 'aac', '-b:a', '192k'],
    wav: ['-c:a', 'pcm_s16le'],
    flac: ['-c:a', 'flac'],
    ogg: ['-c:a', 'libvorbis', '-q:a', '5'],
    opus: ['-c:a', 'libopus', '-b:a', '128k']
  }[ext] || [];
}

function videoCodec(ext) {
  // VP9 can hang in the single-threaded browser FFmpeg build. Use VP8 for reliable WebM conversion.
  if (ext === 'webm') return ['-c:v', 'libvpx', '-crf', '32', '-b:v', '0', '-deadline', 'good', '-cpu-used', '5', '-c:a', 'libopus', '-b:a', '128k'];
  if (ext === 'avi') return ['-c:v', 'mpeg4', '-q:v', '4', '-c:a', 'mp3', '-b:a', '160k'];
  return ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k'];
}

// Formats whose muxers can carry an attached cover image.
const coverFormats = ['mp3', 'm4a', 'flac'];

// Copies tags from input `src` and uses tag-friendly container options.
function tagArgs(ext, src = 0) {
  const args = ['-map_metadata', String(src)];
  if (ext === 'mp3') args.push('-id3v2_version', '3', '-write_id3v1', '1');
  if (['m4a', 'mp4', 'mov'].includes(ext)) args.push('-movflags', '+use_metadata_tags');
  return args;
}

function commandFor(sourceKind, ext, inputName, outputName) {
  const args = ['-y'];

  if (sourceKind === 'Audio' && groups.Video.some(l => formats[l] === ext && ext !== 'gif')) {
    args.push('-f', 'lavfi', '-i', 'color=c=black:s=1280x720:r=30', '-i', inputName,
      '-map', '0:v:0', '-map', '1:a:0', ...tagArgs(ext, 1), '-shortest', ...videoCodec(ext), outputName);
    return args;
  }

  // Image inputs: -loop and -framerate are input options, so they must come before -i.
  if (sourceKind === 'Image' && ext === 'gif') {
    return ['-y', '-loop', '1', '-framerate', '12', '-t', '3', '-i', inputName,
      '-vf', 'scale=1280:-1:flags=lanczos', '-loop', '0', outputName];
  }

  if (sourceKind === 'Image' && groups.Video.some(l => formats[l] === ext)) {
    return ['-y', '-loop', '1', '-framerate', '30', '-t', '5', '-i', inputName,
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', ...videoCodec(ext), outputName];
  }

  args.push('-i', inputName);

  if (sourceKind === 'Video' && groups.Audio.some(l => formats[l] === ext)) {
    args.push('-vn', ...tagArgs(ext), ...audioCodec(ext), outputName);
    return args;
  }

  if (sourceKind === 'Video' && groups.Image.some(l => formats[l] === ext)) {
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

  if (groups.Audio.some(l => formats[l] === ext)) {
    // Audio files: keep the cover art (an attached picture stream) where the target format supports it.
    if (sourceKind === 'Audio' && coverFormats.includes(ext)) args.push('-map', '0:a:0', '-map', '0:v:0?', '-c:v', 'copy');
    else args.push('-vn');
    args.push(...tagArgs(ext), ...audioCodec(ext), outputName);
    return args;
  }
  if (groups.Video.some(l => formats[l] === ext)) { args.push(...tagArgs(ext), ...videoCodec(ext), outputName); return args; }
  if (groups.Image.some(l => formats[l] === ext)) {
    if (ext === 'jpg') args.push('-frames:v', '1', '-q:v', '3');
    else if (ext === 'webp') args.push('-frames:v', '1', '-c:v', 'libwebp', '-quality', '90');
    else args.push('-frames:v', '1');
    args.push(outputName);
    return args;
  }

  throw new Error('Unsupported conversion path');
}


async function convertOffice(file, kind, ext) {
  const sourceExt = file.name.split('.').pop().toLowerCase();
  let blob, outputName;
  if (kind === 'Spreadsheet') {
    const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
    const workbook = XLSX.read(await file.arrayBuffer(), {type:'array', cellDates:true});
    if (ext === 'pdf') {
      const sheetText = workbook.SheetNames.map(name => 'Sheet: ' + name + '\n' + XLSX.utils.sheet_to_csv(workbook.Sheets[name])).join('\n\n');
      blob = await textToPdf(sheetText);
    } else {
      const data = XLSX.write(workbook, {bookType:ext, type:ext === 'csv' ? 'string' : 'array'});
      const mime = {csv:'text/csv;charset=utf-8', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls:'application/vnd.ms-excel', ods:'application/vnd.oasis.opendocument.spreadsheet'}[ext];
      blob = new Blob([data], {type:mime});
    }
  } else {
    let text = '';
    if (['txt','md'].includes(sourceExt)) text = await file.text();
    else if (['html','htm'].includes(sourceExt)) {
      const doc = new DOMParser().parseFromString(await file.text(),'text/html');
      doc.querySelectorAll('script,style,head').forEach(n=>n.remove());
      text = (doc.body?.innerText || doc.body?.textContent || '').trim();
    } else if (sourceExt === 'rtf') {
      text = (await file.text()).replace(/\\par[d]?/gi,'\n').replace(/\\'[0-9a-f]{2}/gi,' ').replace(/\\[a-z]+-?\d* ?/gi,'').replace(/[{}]/g,'').trim();
    } else if (sourceExt === 'pdf') {
      const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs/+esm');
      const pdf = await pdfjs.getDocument({data: new Uint8Array(await file.arrayBuffer()), useWorkerFetch: false, isEvalSupported: false}).promise;
      const pages = [];
      for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
        const page = await pdf.getPage(pageNo);
        const content = await page.getTextContent();
        pages.push(content.items.map(item => item.str || '').join(' '));
      }
      text = pages.join('\n\n').trim();
      if (!text) throw new Error(file.name + ': this PDF has no selectable text. Scanned PDFs require OCR, which is not available in this converter yet.');
    } else {
      const zip = await JSZip.loadAsync(file);
      let xml = '';
      if (sourceExt === 'docx') xml = await zip.file('word/document.xml')?.async('text') || '';
      else if (sourceExt === 'odt') xml = await zip.file('content.xml')?.async('text') || '';
      else if (sourceExt === 'pptx') {
        const paths = Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((x,y)=>x.localeCompare(y,undefined,{numeric:true}));
        xml = (await Promise.all(paths.map(n=>zip.file(n).async('text')))).join('\n');
      } else if (sourceExt === 'odp') xml = await zip.file('content.xml')?.async('text') || '';
      if (!xml) throw new Error(file.name + ': readable document content was not found.');
      const parsed = new DOMParser().parseFromString(xml,'application/xml');
      text = [...parsed.getElementsByTagName('*')].filter(n=>['t','p','h'].includes(n.localName)).map(n=>n.localName==='t'?n.textContent:'\n').join('').replace(/\n{3,}/g,'\n\n').trim();
    }
    if (kind === 'Presentation' && ext === 'pptx') {
      const PptxGenJS = (await import('https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/+esm')).default;
      const pptx = new PptxGenJS(); pptx.layout = 'LAYOUT_WIDE';
      const chunks = text.split(/\n{2,}/).filter(Boolean);
      for (const chunk of (chunks.length ? chunks : [text || ' '])) {
        const slide=pptx.addSlide();
        slide.addText(chunk,{x:.6,y:.6,w:12.1,h:6.2,fontFace:'Arial',fontSize:22,color:'222222',valign:'top'});
      }
      blob = await pptx.write({outputType:'blob'});
    } else if (ext === 'txt' || ext === 'md') {
      blob = new Blob([text],{type:ext==='md'?'text/markdown;charset=utf-8':'text/plain;charset=utf-8'});
    } else if (ext === 'html') {
      const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Converted file</title></head><body>'+text.split(/\r?\n/).map(line=>'<p>'+esc(line)+'</p>').join('')+'</body></html>';
      blob = new Blob([html],{type:'text/html;charset=utf-8'});
    } else if (ext === 'docx') {
      const zip=new JSZip();
      const paragraphs=text.split(/\r?\n/).map(line=>'<w:p><w:r><w:t xml:space="preserve">'+esc(line)+'</w:t></w:r></w:p>').join('');
      zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
      zip.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
      zip.file('word/document.xml','<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+paragraphs+'<w:sectPr/></w:body></w:document>');
      blob=await zip.generateAsync({type:'blob'});
    } else if (ext === 'rtf') {
      const escaped = text.replace(/\\/g, '\\\\').replace(/{/g, '\\{').replace(/}/g, '\\}').replace(/\r?\n/g, '\\par\n');
      blob = new Blob(['{\\rtf1\\ansi\\deff0\n' + escaped + '}'], {type:'application/rtf'});
    } else if (ext === 'odt') {
      const zip=new JSZip();
      zip.file('mimetype','application/vnd.oasis.opendocument.text',{compression:'STORE'});
      const paras=text.split(/\r?\n/).map(line=>'<text:p>'+esc(line)+'</text:p>').join('');
      zip.file('content.xml','<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2"><office:body><office:text>'+paras+'</office:text></office:body></office:document-content>');
      zip.file('META-INF/manifest.xml','<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/></manifest:manifest>');
      blob=await zip.generateAsync({type:'blob'});
    } else throw new Error(file.name+': this output pathway is not supported.');
  }
  if (ext === 'pdf' && kind !== 'Spreadsheet') blob = await textToPdf(text);
  outputName=file.name.replace(/\.[^.]+$/,'')+'.'+ext;
  results.push({name:outputName,url:URL.createObjectURL(blob),size:blob.size});
}

async function textToPdf(text) {
  const { PDFDocument, StandardFonts, rgb } = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm');
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const margin = 48, lineHeight = 14, maxChars = 96;
  const lines = [];
  for (const rawLine of String(text || '').replace(/\t/g, '    ').split(/\r?\n/)) {
    let line = '';
    for (const word of rawLine.split(/\s+/)) {
      if (!word) continue;
      if (line && line.length + 1 + word.length > maxChars) { lines.push(line); line = ''; }
      let remaining = word;
      while (remaining.length > maxChars) { if (line) { lines.push(line); line = ''; } lines.push(remaining.slice(0, maxChars)); remaining = remaining.slice(maxChars); }
      line += (line ? ' ' : '') + remaining;
    }
    lines.push(line);
  }
  let page = pdf.addPage([612, 792]);
  let y = page.getHeight() - margin;
  for (const line of lines) {
    if (y < margin) { page = pdf.addPage([612, 792]); y = page.getHeight() - margin; }
    if (line) page.drawText(line, {x:margin, y, size:10, font, color:rgb(0.12,0.12,0.12), maxWidth:page.getWidth()-margin*2});
    y -= lineHeight;
  }
  return new Blob([await pdf.save()], {type:'application/pdf'});
}

async function imageToPdf(file) {
  const { PDFDocument } = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm');
  const pdf = await PDFDocument.create();
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width; canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  bitmap.close();
  const png = await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not decode image for PDF conversion.')), 'image/png'));
  const image = await pdf.embedPng(await png.arrayBuffer());
  const page = pdf.addPage([image.width, image.height]);
  page.drawImage(image, {x:0, y:0, width:image.width, height:image.height});
  return new Blob([await pdf.save()], {type:'application/pdf'});
}

function mimeFor(ext) {
  return {
    mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav',
    flac: 'audio/flac', ogg: 'audio/ogg', opus: 'audio/opus',
    mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
    mkv: 'video/x-matroska', avi: 'video/x-msvideo', gif: 'image/gif',
    jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', bmp: 'image/bmp', tiff: 'image/tiff', pdf:'application/pdf', zip: 'application/zip',
    txt:'text/plain', md:'text/markdown', html:'text/html', docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', odt:'application/vnd.oasis.opendocument.text', rtf:'application/rtf', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls:'application/vnd.ms-excel', csv:'text/csv', ods:'application/vnd.oasis.opendocument.spreadsheet', pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  }[ext] || 'application/octet-stream';
}

async function convertOne(file, index, total) {
  const kind = fileKind(file);
  const ext = file.output || defaultOutput(kind);

  const label = Object.keys(formats).find(k => formats[k] === ext);
  if (!canConvert(kind, label, file.name)) {
    throw new Error(file.name + ': cannot convert to ' + ext.toUpperCase());
  }

  if (kind === 'Image' && ext === 'pdf') {
    const blob = await imageToPdf(file);
    results.push({name:file.name.replace(/\.[^.]+$/,'')+'.pdf',url:URL.createObjectURL(blob),size:blob.size});
    return;
  }

  if (['Document','Spreadsheet','Presentation'].includes(kind) && ext !== 'zip') {
    setProgress(10 + (index / total) * 90, 'Converting ' + file.name);
    await convertOffice(file, kind, ext);
    return;
  }

  const inName = 'input-' + index + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const out = index + '-out.' + ext;

  if (ext === 'frames') {
    const interval = Number(frameInterval.value);
    if (!Number.isFinite(interval) || interval < 0.1 || interval > 3600) {
      throw new Error('Frame interval must be between 0.1 and 3600 seconds.');
    }

    const inName = 'input-' + index + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const framePattern = 'frame-' + index + '-%05d.jpg';
    await ffmpeg.writeFile(inName, await fetchFile(file));
    const base = 10 + (index / total) * 90;
    const span = 90 / total;
    const message = 'Extracting frames from ' + file.name;
    setProgress(base, message);
    onFileProgress = p => {
      if (Number.isFinite(p)) setProgress(base + span * Math.max(0, Math.min(1, p)), message);
    };

    try {
      await run(['-y', '-i', inName, '-vf', 'fps=1/' + interval, '-q:v', '3', framePattern], file.name);
      const zip = new JSZip();
      let frameCount = 0;
      for (let frame = 1; ; frame++) {
        const frameName = framePattern.replace('%05d', String(frame).padStart(5, '0'));
        let data;
        try { data = await ffmpeg.readFile(frameName); } catch { break; }
        zip.file(frameName.replace(/^frame-\d+-/, ''), data);
        frameCount++;
        await ffmpeg.deleteFile(frameName).catch(() => {});
      }
      if (!frameCount) throw new Error(file.name + ': no frames could be extracted.');
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 4 } });
      results.push({ name: file.name.replace(/\.[^.]+$/, '') + '-frames.zip', url: URL.createObjectURL(blob), size: blob.size });
    } finally {
      onFileProgress = () => {};
      await ffmpeg.deleteFile(inName).catch(() => {});
    }
    return;
  }

  if (ext === 'zip') {
    const zip = new JSZip();
    zip.file(file.name, file);
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const url = URL.createObjectURL(blob);
    results.push({
      name: file.name.replace(/\.[^.]+$/, '') + '.zip',
      url,
      size: blob.size
    });
    return;
  }

  await ffmpeg.writeFile(inName, await fetchFile(file));

  let pal = '';
  try {
    const base = 10 + (index / total) * 90;
    const span = 90 / total;
    const message = 'Converting ' + file.name;
    setProgress(base, message);
    // Install the progress listener before starting FFmpeg so the first
    // progress event cannot be missed.
    onFileProgress = p => {
      if (Number.isFinite(p)) setProgress(base + span * Math.max(0, Math.min(1, p)), message);
    };

    if (kind === 'Video' && ext === 'gif') {
      pal = 'pal-' + index + '.png';
      await run(['-y', '-i', inName, '-vf', 'fps=12,scale=1280:-1:flags=lanczos,palettegen=stats_mode=full', pal], file.name);
      await run(['-y', '-i', inName, '-i', pal, '-filter_complex',
        '[0:v]fps=12,scale=1280:-1:flags=lanczos[x];[x][1:v]paletteuse[v]',
        '-map', '[v]', '-an', '-loop', '0', out], file.name);
    } else {
      await run(commandFor(kind, ext, inName, out), file.name);
    }

    const data = await ffmpeg.readFile(out);
    const blob = new Blob([data], { type: mimeFor(ext) });
    const url = URL.createObjectURL(blob);

    results.push({
      name: file.name.replace(/\.[^.]+$/, '') + '.' + ext,
      url,
      size: blob.size
    });
  } finally {
    onFileProgress = () => {};
    await ffmpeg.deleteFile(inName).catch(() => {});
    await ffmpeg.deleteFile(out).catch(() => {});
    if (pal) await ffmpeg.deleteFile(pal).catch(() => {});
  }
}

function renderDownloads() {
  downloads.hidden = !results.length;
  downloadList.innerHTML = results.map(r =>
    '<a class="download" href="' + r.url + '" download="' + esc(r.name) + '">' +
      '<span><b>' + esc(r.name) + '</b><small>' + esc(size(r.size)) + '</small></span>' +
      '<strong>Download</strong>' +
    '</a>'
  ).join('');
}

downloadAll.onclick = () => {
  results.forEach((result, index) => {
    setTimeout(() => {
      const link = document.createElement('a');
      link.href = result.url;
      link.download = result.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }, index * 150);
  });
};

input.onchange = e => add(e.target.files);

['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => {
  e.preventDefault();
  drop.classList.add('drag');
}));
['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => {
  e.preventDefault();
  drop.classList.remove('drag');
}));
drop.addEventListener('drop', e => add(e.dataTransfer.files));

clear.onclick = () => {
  files = [];
  results.forEach(r => URL.revokeObjectURL(r.url));
  results = [];
  renderDownloads();
  render();
  updateSourceCopy();
  progress.hidden = true;
};

convert.onclick = async () => {
  if (!files.length || converting) return;

  converting = true;
  results.forEach(r => URL.revokeObjectURL(r.url));
  results = [];
  renderDownloads();
  render();
  convert.textContent = 'Converting…';

  try {
    if (files.some(file => !['zip','txt','md','html','docx','odt','rtf','xlsx','xls','csv','ods','pptx','pdf'].includes(file.output || defaultOutput(fileKind(file))))) await loadEngine();
    for (let i = 0; i < files.length; i++) await convertOne(files[i], i, files.length);
    setProgress(100, 'Done — ' + results.length + ' file' + (results.length === 1 ? '' : 's'));
    renderDownloads();
    convert.textContent = 'Convert again';
  } catch (error) {
    console.error(error);
    setProgress(0, error?.message || 'Conversion failed');
    renderDownloads();
    convert.textContent = 'Try again';
  } finally {
    onFileProgress = () => {};
    converting = false;
    render();
    if (files.length) convert.disabled = false;
  }
};
