import { FFmpeg } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/+esm';
import { fetchFile, toBlobURL } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/+esm';

const $ = s => document.querySelector(s);
const input = $('#file');
const drop = $('#drop');
const dropTitle = $('#dropTitle');
const dropHint = $('#dropHint');
const formatSel = $('#format');
const convertBtn = $('#convert');
const queue = $('#queue');
const queueTitle = $('#queueTitle');
const items = $('#items');
const clearBtn = $('#clear');
const appearance = $('#appearance');
const progress = $('#progress');
const progressLabel = $('#progressLabel');
const progressValue = $('#progressValue');
const progressBar = $('#progressBar');
const downloads = $('#downloads');
const downloadList = $('#downloadList');
const downloadAllBtn = $('#downloadAll');

const MAX_FILE_BYTES = 500 * 1024 * 1024;
const CORE_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';

const FORMATS = {
  MP3: 'mp3', M4A: 'm4a', AAC: 'aac', WAV: 'wav', FLAC: 'flac', OGG: 'ogg', OPUS: 'opus',
  MP4: 'mp4', MOV: 'mov', WEBM: 'webm', MKV: 'mkv', AVI: 'avi', GIF: 'gif',
  JPG: 'jpg', PNG: 'png', WEBP: 'webp'
};
const LABEL_BY_EXT = Object.fromEntries(Object.entries(FORMATS).map(([k, v]) => [v, k]));

const AUDIO_LABELS = ['MP3','M4A','AAC','WAV','FLAC','OGG','OPUS'];
const VIDEO_LABELS = ['MP4','MOV','WEBM','MKV','AVI','GIF'];
const IMAGE_LABELS = ['JPG','PNG','WEBP'];

const ALLOWED = {
  Audio: [...AUDIO_LABELS, 'MP4', 'MOV', 'WEBM', 'MKV', 'AVI'],
  Video: [...AUDIO_LABELS, ...VIDEO_LABELS, ...IMAGE_LABELS],
  Image: [...IMAGE_LABELS, 'MP4', 'MOV', 'WEBM', 'AVI', 'GIF'],
  File: []
};

const MIME = {
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav',
  flac: 'audio/flac', ogg: 'audio/ogg', opus: 'audio/opus',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  mkv: 'video/x-matroska', avi: 'video/x-msvideo', gif: 'image/gif',
  jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp'
};

const AUDIO_EXT = /\.(mp3|wav|m4a|aac|flac|ogg|opus|wma|aiff|aif)$/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv|avi|wmv|flv|mpeg|mpg|3gp)$/i;
const IMAGE_EXT = /\.(jpg|jpeg|png|webp|bmp|tif|tiff)$/i;

const ffmpeg = new FFmpeg();
let engineLoaded = false;
let busy = false;
let files = [];
let results = [];

const humanSize = n => n < 1024 * 1024
  ? (n / 1024).toFixed(1) + ' KB'
  : (n / 1024 / 1024).toFixed(1) + ' MB';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

function kindOf(file) {
  const t = file.type || '';
  const n = file.name || '';
  if (t.startsWith('video/') || VIDEO_EXT.test(n) || /\.gif$/i.test(n)) return 'Video';
  if (t.startsWith('image/') || IMAGE_EXT.test(n)) return 'Image';
  if (t.startsWith('audio/') || AUDIO_EXT.test(n)) return 'Audio';
  return 'File';
}

function canConvert(kind, label, fileName = '') {
  if (!label) return false;
  if (kind === 'Video' && /\.gif$/i.test(fileName) && AUDIO_LABELS.includes(label)) return false;
  return (ALLOWED[kind] || []).includes(label);
}

function defaultOutput(kind) {
  return kind === 'Audio' ? 'mp3' : kind === 'Video' ? 'mp4' : kind === 'Image' ? 'png' : '';
}

function render() {
  queue.hidden = files.length === 0;
  convertBtn.disabled = files.length === 0 || busy;
  queueTitle.textContent = files.length === 1 ? '1 file' : files.length + ' files';

  items.innerHTML = files.map((file, i) => {
    const chosen = file.output || defaultOutput(file.kind);
    const options = (ALLOWED[file.kind] || [])
      .filter(label => canConvert(file.kind, label, file.name))
      .map(label => {
        const v = FORMATS[label];
        return `<option value="${v}"${v === chosen ? ' selected' : ''}>${label}</option>`;
      }).join('');
    const failedBadge = file.error ? ' · <span style="color:#c00">failed</span>' : '';
    return `<div class="item">
      <div class="file-info">
        <div class="name">${esc(file.name)}</div>
        <div class="meta">${humanSize(file.size)} · ${file.kind}${failedBadge}</div>
      </div>
      <label class="row-format">Convert to
        <select class="select" data-i="${i}">${options}</select>
      </label>
      <button class="link" data-remove="${i}" type="button">Remove</button>
    </div>`;
  }).join('');

  items.querySelectorAll('.select').forEach(sel => {
    sel.onchange = e => { files[+e.target.dataset.i].output = e.target.value; };
  });
  items.querySelectorAll('[data-remove]').forEach(btn => {
    btn.onclick = () => {
      files.splice(+btn.dataset.remove, 1);
      render();
      updateDrop();
    };
  });
}

function updateDrop() {
  dropTitle.textContent = files.length === 0
    ? 'Add files'
    : files.length === 1 ? files[0].name : files.length + ' files';
  dropHint.textContent = files.length === 0 ? 'Click or drag and drop' : 'Click to add more';
  drop.classList.toggle('has-file', files.length > 0);
}

function setProgress(pct, label) {
  progress.hidden = false;
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  progressBar.style.width = v + '%';
  progressValue.textContent = v + '%';
  progressLabel.textContent = label;
}

function renderResults() {
  downloads.hidden = results.length === 0;
  downloadList.innerHTML = results.map(r =>
    `<a href="${r.url}" download="${esc(r.name)}">
      <span><b>${esc(r.name)}</b><small>${humanSize(r.size)}</small></span>
      <strong>Download</strong>
    </a>`
  ).join('');
}

function addFiles(list) {
  const incoming = [...list];
  if (!incoming.length) return;
  const accepted = [];
  let skipped = 0;
  for (const raw of incoming) {
    if (raw.size > MAX_FILE_BYTES) { skipped++; continue; }
    const kind = kindOf(raw);
    accepted.push({ raw, name: raw.name, size: raw.size, kind, output: defaultOutput(kind), error: false });
  }
  files.push(...accepted);
  if (skipped) setProgress(0, `${skipped} file${skipped > 1 ? 's' : ''} skipped (over 500 MB)`);
  render();
  updateDrop();
}

const isAudioOut = ext => AUDIO_LABELS.some(l => FORMATS[l] === ext);
const isVideoOut = ext => VIDEO_LABELS.some(l => FORMATS[l] === ext) && ext !== 'gif';
const isImageOut = ext => IMAGE_LABELS.some(l => FORMATS[l] === ext);

function audioArgs(ext) {
  return ({
    mp3:  ['-c:a', 'libmp3lame', '-b:a', '192k'],
    m4a:  ['-c:a', 'aac', '-b:a', '192k'],
    aac:  ['-c:a', 'aac', '-b:a', '192k'],
    wav:  ['-c:a', 'pcm_s16le'],
    flac: ['-c:a', 'flac'],
    ogg:  ['-c:a', 'libvorbis', '-q:a', '5'],
    opus: ['-c:a', 'libopus', '-b:a', '128k']
  })[ext] || [];
}

function videoCodecArgs(ext, withAudio) {
  if (ext === 'webm') {
    return withAudio
      ? ['-c:v', 'libvpx-vp9', '-crf', '32', '-b:v', '0', '-c:a', 'libopus', '-b:a', '128k']
      : ['-c:v', 'libvpx-vp9', '-crf', '32', '-b:v', '0'];
  }
  if (ext === 'avi') {
    return withAudio
      ? ['-c:v', 'mpeg4', '-q:v', '4', '-c:a', 'mp3', '-b:a', '160k']
      : ['-c:v', 'mpeg4', '-q:v', '4'];
  }
  return withAudio
    ? ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k']
    : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p'];
}

function imageArgs(ext) {
  if (ext === 'jpg') return ['-frames:v', '1', '-q:v', '3'];
  if (ext === 'webp') return ['-frames:v', '1', '-c:v', 'libwebp', '-quality', '90'];
  return ['-frames:v', '1'];
}

function commandFor(kind, ext, inName, outName) {
  const isAudOut = isAudioOut(ext);
  const isVidOut = isVideoOut(ext);
  const isImgOut = isImageOut(ext);

  // Audio → Video: silent black frame + audio
  if (kind === 'Audio' && isVidOut) {
    return [
      '-y',
      '-f', 'lavfi', '-i', 'color=c=black:s=1280x720:r=30',
      '-i', inName,
      '-map', '0:v:0', '-map', '1:a:0',
      '-shortest',
      ...videoCodecArgs(ext, true),
      outName
    ];
  }

  // Image → Video: loop still into a 5s clip
  if (kind === 'Image' && isVidOut) {
    return [
      '-y', '-loop', '1', '-framerate', '30', '-t', '5', '-i', inName,
      ...videoCodecArgs(ext, false),
      '-an',
      outName
    ];
  }

  // Image → GIF
  if (kind === 'Image' && ext === 'gif') {
    return ['-y', '-loop', '1', '-t', '3', '-i', inName, '-vf', 'fps=12,scale=1280:-1:flags=lanczos', outName];
  }

  const base = ['-y', '-i', inName];

  // Video → Audio
  if (kind === 'Video' && isAudOut) return [...base, '-vn', ...audioArgs(ext), outName];

  // Video → Image
  if (kind === 'Video' && isImgOut) return [...base, ...imageArgs(ext), outName];

  // Video → GIF (basic; palette path handled in convertOne)
  if (kind === 'Video' && ext === 'gif') return [...base, '-vf', 'fps=12,scale=1280:-1:flags=lanczos', outName];

  // Same-family fallbacks
  if (isAudOut) return [...base, ...audioArgs(ext), outName];
  if (isVidOut) return [...base, ...videoCodecArgs(ext, true), outName];
  if (isImgOut) return [...base, ...imageArgs(ext), outName];

  throw new Error('Unsupported path to ' + ext.toUpperCase());
}

async function fetchWithProgress(url, mime, label) {
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) throw new Error(`${label} failed (HTTP ${response.status})`);

  const total = Number(response.headers.get('Content-Length')) || 0;
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total > 0) {
      const pct = (received / total) * 100;
      setProgress(2 + pct * 0.08, `Downloading ${label} — ${humanSize(received)} of ${humanSize(total)}`);
    } else {
      setProgress(2 + Math.min(8, received / 1000000), `Downloading ${label} — ${humanSize(received)}`);
    }
  }

  const blob = new Blob(chunks, { type: mime });
  return URL.createObjectURL(blob);
}

async function loadEngine() {
  if (engineLoaded) return;
  setProgress(2, 'Loading engine…');

  await ffmpeg.load({
    coreURL: new URL('./ffmpeg-core.js', import.meta.url).href,
    wasmURL: new URL('./ffmpeg-core.wasm', import.meta.url).href,
    classWorkerURL: new URL('./ffmpeg-worker.js', import.meta.url).href
  });

  engineLoaded = true;
  setProgress(12, 'Ready');
}
    try {
      setProgress(2, 'Downloading converter core…');

      const [coreURL, wasmURL] = await Promise.all([
        fetchWithProgress(`${base}/ffmpeg-core.js`, 'text/javascript', 'core'),
        fetchWithProgress(`${base}/ffmpeg-core.wasm`, 'application/wasm', 'wasm')
      ]);

      setProgress(11, 'Starting engine…');
      await ffmpeg.load({ coreURL, wasmURL });
      engineLoaded = true;
      setProgress(12, 'Ready');
      return;
    } catch (err) {
      console.warn('Engine load failed for', base, err);
      lastError = err;
    }
  }

  throw new Error(`Could not load converter (${lastError?.message || 'network error'}). Check your connection and try again.`);
}
async function convertOne(file, index, total) {
  const kind = file.kind;
  const ext = file.output || defaultOutput(kind);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const inName = `in-${index}-${safeName}`;
  const outName = `out-${index}.${ext}`;

  setProgress(8 + (index / total) * 82, `Converting ${file.name}`);
  await ffmpeg.writeFile(inName, await fetchFile(file.raw));

  try {
    if (kind === 'Video' && ext === 'gif') {
      const palette = `pal-${index}.png`;
      await ffmpeg.exec(['-y', '-i', inName, '-vf', 'fps=12,scale=1280:-1:flags=lanczos,palettegen=stats_mode=full', palette]);
      await ffmpeg.exec([
        '-y', '-i', inName, '-i', palette,
        '-filter_complex', '[0:v]fps=12,scale=1280:-1:flags=lanczos[x];[x][1:v]paletteuse[v]',
        '-map', '[v]', '-an', '-loop', '0', outName
      ]);
      await ffmpeg.deleteFile(palette).catch(() => {});
    } else {
      await ffmpeg.exec(commandFor(kind, ext, inName, outName));
    }

    const data = await ffmpeg.readFile(outName);
    const blob = new Blob([data.buffer], { type: MIME[ext] || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    results.push({ name: file.name.replace(/\.[^.]+$/, '') + '.' + ext, url, size: blob.size });
    file.error = false;
  } catch (err) {
    file.error = true;
    console.error('Failed:', file.name, err);
  } finally {
    await ffmpeg.deleteFile(inName).catch(() => {});
    await ffmpeg.deleteFile(outName).catch(() => {});
  }
}

input.onchange = e => { addFiles(e.target.files); input.value = ''; };

['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => {
  e.preventDefault();
  drop.classList.add('drag');
}));
['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => {
  e.preventDefault();
  drop.classList.remove('drag');
}));
drop.addEventListener('drop', e => addFiles(e.dataTransfer.files));

clearBtn.onclick = () => {
  files = [];
  results.forEach(r => URL.revokeObjectURL(r.url));
  results = [];
  renderResults();
  render();
  updateDrop();
  progress.hidden = true;
};

formatSel.onchange = () => {
  const target = formatSel.value;
  const label = LABEL_BY_EXT[target];
  files.forEach(file => {
    if (canConvert(file.kind, label, file.name)) file.output = target;
  });
  render();
};

appearance.onclick = () => {
  const dark = document.body.classList.toggle('dark');
  localStorage.setItem('dark', dark ? 'true' : 'false');
};
if (localStorage.getItem('dark') === 'true') document.body.classList.add('dark');

downloadAllBtn.onclick = () => {
  downloadList.querySelectorAll('a').forEach((a, i) => setTimeout(() => a.click(), i * 250));
};

convertBtn.onclick = async () => {
  if (!files.length || busy) return;

  busy = true;
  results.forEach(r => URL.revokeObjectURL(r.url));
  results = [];
  renderResults();
  files.forEach(f => { f.error = false; });
  render();
  convertBtn.textContent = 'Converting…';

  try {
    await loadEngine();
    for (let i = 0; i < files.length; i++) await convertOne(files[i], i, files.length);

    const failed = files.filter(f => f.error).length;
    if (failed && results.length) setProgress(100, `Done — ${results.length} converted, ${failed} failed`);
    else if (failed) setProgress(0, 'Conversion failed — try a different format');
    else setProgress(100, `Done — ${results.length} file${results.length === 1 ? '' : 's'}`);

    renderResults();
    render();
    convertBtn.textContent = 'Convert again';
  } catch (err) {
    console.error(err);
    setProgress(0, err?.message || 'Conversion failed');
    convertBtn.textContent = 'Try again';
  } finally {
    busy = false;
    render();
    if (files.length) convertBtn.disabled = false;
  }
};
