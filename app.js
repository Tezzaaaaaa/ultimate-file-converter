import { FFmpeg } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/+esm';
import { fetchFile } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/+esm';

const input = document.querySelector('#file');
const drop = document.querySelector('#drop');
const queue = document.querySelector('#queue');
const items = document.querySelector('#items');
const clear = document.querySelector('#clear');
const appearance = document.querySelector('#appearance');
const convert = document.querySelector('#convert');
const format = document.querySelector('#format');
const progress = document.querySelector('#progress');
const progressLabel = document.querySelector('#progressLabel');
const progressValue = document.querySelector('#progressValue');
const progressBar = document.querySelector('#progressBar');
const downloads = document.querySelector('#downloads');
const sourceTitle = document.querySelector('#sourceTitle');
const sourceHint = document.querySelector('#sourceHint');

const ffmpeg = new FFmpeg();
let loaded = false;
let converting = false;
let files = [];
let results = [];

const formats = {
  MP3: 'mp3', M4A: 'm4a', AAC: 'aac', WAV: 'wav', FLAC: 'flac', OGG: 'ogg', OPUS: 'opus',
  MP4: 'mp4', MOV: 'mov', WEBM: 'webm', MKV: 'mkv', AVI: 'avi', GIF: 'gif',
  JPG: 'jpg', PNG: 'png', WEBP: 'webp'
};

const groups = {
  Audio: ['MP3', 'M4A', 'AAC', 'WAV', 'FLAC', 'OGG', 'OPUS'],
  Video: ['MP4', 'MOV', 'WEBM', 'MKV', 'AVI', 'GIF'],
  Image: ['JPG', 'PNG', 'WEBP']
};

const imageExt = /\.(jpg|jpeg|png|webp|bmp|tif|tiff)$/i;
const videoExt = /\.(mp4|mov|m4v|webm|mkv|avi|wmv|flv|mpeg|mpg|3gp)$/i;
const audioExt = /\.(mp3|wav|m4a|aac|flac|ogg|opus|wma|aiff|aif)$/i;

const size = n => n < 1024 * 1024
  ? (n / 1024).toFixed(1) + ' KB'
  : (n / 1024 / 1024).toFixed(1) + ' MB';

const esc = s => String(s).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

function fileKind(file) {
  if (file.type.startsWith('video/') || videoExt.test(file.name) || /\.gif$/i.test(file.name)) return 'Video';
  if (file.type.startsWith('image/') || imageExt.test(file.name)) return 'Image';
  if (file.type.startsWith('audio/') || audioExt.test(file.name)) return 'Audio';
  return 'File';
}

const allowed = {
  Audio: [...groups.Audio, 'MP4', 'MOV', 'WEBM', 'MKV', 'AVI'],
  Video: [...groups.Audio, ...groups.Video, ...groups.Image],
  Image: [...groups.Image, ...groups.Video],
  File: []
};

function canConvert(kind, label, fileName = '') {
  if (/\.gif$/i.test(fileName) && kind === 'Video' && groups.Audio.includes(label)) return false;
  return allowed[kind]?.includes(label) === true;
}

function defaultOutput(kind) {
  if (kind === 'Audio') return 'mp3';
  if (kind === 'Video') return 'mp4';
  if (kind === 'Image') return 'png';
  return '';
}

function render() {
  queue.hidden = !files.length;
  convert.disabled = !files.length || converting;

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
      '<button class="link remove" data-i="' + index + '">Remove</button>' +
    '</div>';
  }).join('');

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
}

function setProgress(value, label) {
  progress.hidden = false;
  const v = Math.max(0, Math.min(100, Math.round(value)));
  progressValue.textContent = v + '%';
  progressBar.style.width = v + '%';
  progressLabel.textContent = label;
}

async function loadEngine() {
  if (loaded) return;

  setProgress(4, 'Loading conversion engine…');

  await ffmpeg.load({
    coreURL: new URL('./ffmpeg-core.js', import.meta.url).href,
    wasmURL: new URL('./ffmpeg-core.wasm', import.meta.url).href,
    classWorkerURL: new URL('./ffmpeg-worker.js', import.meta.url).href
  });

  loaded = true;
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
  if (ext === 'webm') return ['-c:v', 'libvpx-vp9', '-crf', '32', '-b:v', '0', '-c:a', 'libopus', '-b:a', '128k'];
  if (ext === 'avi') return ['-c:v', 'mpeg4', '-q:v', '4', '-c:a', 'mp3', '-b:a', '160k'];
  return ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k'];
}

function commandFor(sourceKind, ext, inputName, outputName) {
  const args = ['-y'];

  if (sourceKind === 'Audio' && groups.Video.some(l => formats[l] === ext && ext !== 'gif')) {
    args.push('-f', 'lavfi', '-i', 'color=c=black:s=1280x720:r=30', '-i', inputName,
      '-map', '0:v:0', '-map', '1:a:0', '-shortest', ...videoCodec(ext), outputName);
    return args;
  }

  args.push('-i', inputName);

  if (sourceKind === 'Video' && groups.Audio.some(l => formats[l] === ext)) {
    args.push('-vn', ...audioCodec(ext), outputName);
    return args;
  }

  if (sourceKind === 'Video' && groups.Image.some(l => formats[l] === ext)) {
    if (ext === 'jpg') args.push('-frames:v', '1', '-q:v', '3');
    else if (ext === 'webp') args.push('-frames:v', '1', '-c:v', 'libwebp', '-quality', '90');
    else args.push('-frames:v', '1');
    args.push(outputName);
    return args;
  }

  if (sourceKind === 'Image' && groups.Video.some(l => formats[l] === ext && ext !== 'gif')) {
    args.push('-loop', '1', '-t', '5', '-framerate', '30', ...videoCodec(ext), outputName);
    return args;
  }

  if (ext === 'gif') {
    args.push('-vf', 'fps=12,scale=1280:-1:flags=lanczos', outputName);
    return args;
  }

  if (groups.Audio.some(l => formats[l] === ext)) { args.push(...audioCodec(ext), outputName); return args; }
  if (groups.Video.some(l => formats[l] === ext)) { args.push(...videoCodec(ext), outputName); return args; }
  if (groups.Image.some(l => formats[l] === ext)) {
    if (ext === 'jpg') args.push('-frames:v', '1', '-q:v', '3');
    else if (ext === 'webp') args.push('-frames:v', '1', '-c:v', 'libwebp', '-quality', '90');
    else args.push('-frames:v', '1');
    args.push(outputName);
    return args;
  }

  throw new Error('Unsupported conversion path');
}

function mimeFor(ext) {
  return {
    mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav',
    flac: 'audio/flac', ogg: 'audio/ogg', opus: 'audio/opus',
    mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
    mkv: 'video/x-matroska', avi: 'video/x-msvideo', gif: 'image/gif',
    jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp'
  }[ext] || 'application/octet-stream';
}

async function convertOne(file, index, total) {
  const kind = fileKind(file);
  const ext = file.output || defaultOutput(kind);

  const label = Object.keys(formats).find(k => formats[k] === ext);
  if (!canConvert(kind, label, file.name)) {
    throw new Error(file.name + ': cannot convert to ' + ext.toUpperCase());
  }

  const inName = 'input-' + index + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const out = index + '-out.' + ext;

  await ffmpeg.writeFile(inName, await fetchFile(file));
  setProgress(10 + (index / total) * 80, 'Converting ' + file.name);

  if (kind === 'Video' && ext === 'gif') {
    const pal = 'pal-' + index + '.png';
    await ffmpeg.exec(['-y', '-i', inName, '-vf', 'fps=12,scale=1280:-1:flags=lanczos,palettegen=stats_mode=full', pal]);
    await ffmpeg.exec(['-y', '-i', inName, '-i', pal, '-filter_complex',
      '[0:v]fps=12,scale=1280:-1:flags=lanczos[x];[x][1:v]paletteuse[v]',
      '-map', '[v]', '-an', '-loop', '0', out]);
    await ffmpeg.deleteFile(pal).catch(() => {});
  } else {
    await ffmpeg.exec(commandFor(kind, ext, inName, out));
  }

  const data = await ffmpeg.readFile(out);
  const blob = new Blob([data.buffer], { type: mimeFor(ext) });
  const url = URL.createObjectURL(blob);

  results.push({
    name: file.name.replace(/\.[^.]+$/, '') + '.' + ext,
    url,
    size: blob.size
  });

  await ffmpeg.deleteFile(inName).catch(() => {});
  await ffmpeg.deleteFile(out).catch(() => {});
}

function renderDownloads() {
  downloads.hidden = !results.length;
  downloads.innerHTML = results.map(r =>
    '<a class="download" href="' + r.url + '" download="' + esc(r.name) + '">' +
      '<span><b>' + esc(r.name) + '</b><small>' + esc(size(r.size)) + '</small></span>' +
      '<strong>Download</strong>' +
    '</a>'
  ).join('');
}

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

format.onchange = () => {
  const target = format.value;
  files.forEach(file => {
    const kind = fileKind(file);
    const label = Object.keys(formats).find(k => formats[k] === target);
    if (canConvert(kind, label, file.name)) file.output = target;
  });
  render();
};

appearance.onclick = () => {
  document.body.classList.toggle('dark');
  localStorage.setItem('dark', document.body.classList.contains('dark'));
};

if (localStorage.getItem('dark') === 'true') {
  document.body.classList.add('dark');
}

convert.onclick = async () => {
  if (!files.length || converting) return;

  converting = true;
  results.forEach(r => URL.revokeObjectURL(r.url));
  results = [];
  renderDownloads();
  render();
  convert.textContent = 'Converting…';

  try {
    await loadEngine();
    for (let i = 0; i < files.length; i++) await convertOne(files[i], i, files.length);
    setProgress(100, 'Done — ' + results.length + ' file' + (results.length === 1 ? '' : 's'));
    renderDownloads();
    convert.textContent = 'Convert again';
  } catch (error) {
    console.error(error);
    setProgress(0, error?.message || 'Conversion failed');
    convert.textContent = 'Try again';
  } finally {
    converting = false;
    render();
    if (files.length) convert.disabled = false;
  }
};
