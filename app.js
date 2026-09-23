import { FFmpeg } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/+esm';
import { fetchFile, toBlobURL } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/+esm';

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

/*
 * Conversion matrix.
 * Audio <-> audio is supported, video <-> video is supported, image <-> image
 * is supported, video -> audio/image is supported, and image/audio -> video
 * creates a useful media container. Image <-> audio is intentionally excluded
 * because there is no meaningful media representation to produce.
 */
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

function optionsFor(kind, selected, fileName = '') {
  const labels = allowed[kind] || [];
  return labels.filter(label => canConvert(kind, label, fileName)).map(label => {
    const value = formats[label];
    return '<option value="' + esc(value) + '"' +
      (value === selected ? ' selected' : '') + '>' + esc(label) + '</option>';
  }).join('');
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
    const choices = optionsFor(kind, selected, file.name);

    return '<div class="item">' +
      '<div class="file-info">' +
        '<div class="name">' + esc(file.name) + '</div>' +
        '<div class="meta">' + esc(size(file.size)) + ' · ' + esc(kind) + '</div>' +
      '</div>' +
      '<label class="row-format">Convert to' +
        '<select class="select" data-i="' + index + '" aria-label="Output format for ' + esc(file.name) + '">' +
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

  updateFormatSummary();
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

function updateFormatSummary() {
  const kinds = [...new Set(files.map(file => fileKind(file)))];
  const summary = document.querySelector('#formatHint');
  if (!summary) return;

  if (!files.length) {
    summary.textContent = 'Each file can use its own compatible output format.';
    return;
  }

  summary.textContent = kinds.length === 1
    ? kinds[0] + ' files can be converted across their compatible media formats.'
    : 'Each file is checked independently, so mixed batches can use different outputs.';
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

  const base = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';
  await ffmpeg.load({
    coreURL: await toBlobURL(base + '/ffmpeg-core.js', 'text/javascript'),
    wasmURL: await toBlobURL(base + '/ffmpeg-core.wasm', 'application/wasm'),
    classWorkerURL: new URL('./ffmpeg-worker.js', import.meta.url).href
  });

  ffmpeg.on('log', ({ message }) => console.debug('[FFmpeg]', message));

  ffmpeg.on('progress', ({ progress: value }) => {
    setProgress(10 + value * 88, 'Converting ' + Math.round(value * 100) + '%');
  });

  loaded = true;
}

function outputName(name, ext) {
  const clean = name.replace(/\.[^.]+$/, '');
  return clean + '.' + ext;
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
  if (ext === 'webm') {
    return ['-c:v', 'libvpx-vp9', '-crf', '32', '-b:v', '0', '-c:a', 'libopus', '-b:a', '128k'];
  }
  if (ext === 'avi') {
    return ['-c:v', 'mpeg4', '-q:v', '4', '-c:a', 'mp3', '-b:a', '160k'];
  }
  return ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '160k'];
}

function commandFor(sourceKind, ext, inputName, outputName) {
  const args = ['-y'];

  if (sourceKind === 'Audio' && groups.Video.some(label => formats[label] === ext)) {
    args.push(
      '-f', 'lavfi', '-i', 'color=c=black:s=1280x720:r=30',
      '-i', inputName,
      '-map', '0:v:0', '-map', '1:a:0',
      '-shortest',
      ...videoCodec(ext)
    );
    args.push(outputName);
    return args;
  }

  args.push('-i', inputName);

  if (sourceKind === 'Video' && groups.Audio.some(label => formats[label] === ext)) {
    args.push('-map', '0:a:0', '-vn', ...audioCodec(ext), outputName);
    return args;
  }

  if (sourceKind === 'Video' && groups.Image.some(label => formats[label] === ext)) {
    if (ext === 'jpg') args.push('-frames:v', '1', '-q:v', '3');
    else args.push('-frames:v', '1');
    args.push(outputName);
    return args;
  }

  if (sourceKind === 'Image' && groups.Video.some(label => formats[label] === ext)) {
    args.push('-loop', '1', '-i', inputName);
    if (ext === 'gif') {
      args.push('-t', '3', '-vf', 'fps=12,scale=1280:-1:flags=lanczos');
    } else {
      args.push('-t', '5', '-pix_fmt', 'yuv420p', ...videoCodec(ext));
    }
    args.push(outputName);
    return args;
  }

  if (sourceKind === 'Video' && ext === 'gif') {
    args.push('-vf', 'fps=12,scale=1280:-1:flags=lanczos');
    args.push(outputName);
    return args;
  }

  if (ext === 'gif') {
    args.push('-vf', 'fps=12,scale=1280:-1:flags=lanczos');
    args.push(outputName);
    return args;
  }

  if (groups.Audio.some(label => formats[label] === ext)) {
    args.push(...audioCodec(ext), outputName);
    return args;
  }

  if (groups.Video.some(label => formats[label] === ext)) {
    args.push(...videoCodec(ext), outputName);
    return args;
  }

  if (groups.Image.some(label => formats[label] === ext)) {
    if (ext === 'jpg') args.push('-frames:v', '1', '-q:v', '3');
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

  if (!canConvert(kind, Object.keys(formats).find(label => formats[label] === ext), file.name)) {
    throw new Error(file.name + ': unsupported conversion path to ' + ext.toUpperCase());
  }

  const inputName = 'input-' + index + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const output = index + '-' + outputName(file.name, ext).replace(/[^a-zA-Z0-9._-]/g, '_');

  await ffmpeg.writeFile(inputName, await fetchFile(file));
  setProgress(10 + index / total * 80, 'Preparing ' + file.name);

  if (kind === 'Video' && ext === 'gif') {
    const palette = 'palette-' + index + '.png';

    const paletteExit = await ffmpeg.exec([
      '-y',
      '-i', inputName,
      '-vf', 'fps=12,scale=1280:-1:flags=lanczos,palettegen=stats_mode=full',
      palette
    ]);
    if (paletteExit !== 0) throw new Error(file.name + ': GIF palette generation failed (FFmpeg exit ' + paletteExit + ')');

    const gifExit = await ffmpeg.exec([
      '-y',
      '-i', inputName,
      '-i', palette,
      '-filter_complex',
      '[0:v]fps=12,scale=1280:-1:flags=lanczos[x];[x][1:v]paletteuse[v]',
      '-map', '[v]',
      '-an',
      '-loop', '0',
      output
    ]);
    if (gifExit !== 0) throw new Error(file.name + ': GIF conversion failed (FFmpeg exit ' + gifExit + ')');

    await ffmpeg.deleteFile(palette).catch(() => {});
  } else {
    const exitCode = await ffmpeg.exec(commandFor(kind, ext, inputName, output));
    if (exitCode !== 0) throw new Error(file.name + ': conversion failed (FFmpeg exit ' + exitCode + ')');
  }

  const data = await ffmpeg.readFile(output);
  const blob = new Blob([data], { type: mimeFor(ext) });
  const url = URL.createObjectURL(blob);

  results.push({
    name: output.replace(/^\d+-/, ''),
    url,
    size: blob.size
  });

  await ffmpeg.deleteFile(inputName).catch(() => {});
  await ffmpeg.deleteFile(output).catch(() => {});
}

function renderDownloads() {
  downloads.hidden = !results.length;
  downloads.innerHTML = results.map(result =>
    '<a class="download" href="' + result.url + '" download="' + esc(result.name) + '">' +
      '<span><b>' + esc(result.name) + '</b><small>' + esc(size(result.size)) + '</small></span>' +
      '<strong>Download</strong>' +
    '</a>'
  ).join('');
}

input.onchange = event => add(event.target.files);

['dragenter', 'dragover'].forEach(type => {
  drop.addEventListener(type, event => {
    event.preventDefault();
    drop.classList.add('drag');
  });
});

['dragleave', 'drop'].forEach(type => {
  drop.addEventListener(type, event => {
    event.preventDefault();
    drop.classList.remove('drag');
  });
});

drop.addEventListener('drop', event => add(event.dataTransfer.files));

clear.onclick = () => {
  files = [];
  results.forEach(result => URL.revokeObjectURL(result.url));
  results = [];
  renderDownloads();
  render();
  updateSourceCopy();
  progress.hidden = true;
  input.value = '';
};

format.onchange = () => {
  const label = format.value;
  const target = formats[label];
  files.forEach(file => {
    const kind = fileKind(file);
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
  results.forEach(result => URL.revokeObjectURL(result.url));
  results = [];
  renderDownloads();
  render();
  convert.textContent = 'Converting…';

  try {
    await loadEngine();

    for (let i = 0; i < files.length; i++) {
      await convertOne(files[i], i, files.length);
    }

    setProgress(100, 'Finished ' + results.length + ' ' + (results.length === 1 ? 'file' : 'files'));
    renderDownloads();
    convert.textContent = 'Convert again';
  } catch (error) {
    console.error(error);
    setProgress(0, error?.message || 'Conversion failed — try another format or file');
    renderDownloads();
    convert.textContent = 'Try again';
  } finally {
    converting = false;
    render();
    if (files.length) convert.disabled = false;
  }
};
