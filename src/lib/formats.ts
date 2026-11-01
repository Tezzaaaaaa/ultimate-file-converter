/**
 * Format metadata, capability rules and small formatting helpers.
 * Kept separate from the conversion engine so the UI never has to load FFmpeg.
 */

export const formats = {
  MP3: 'mp3',
  M4A: 'm4a',
  AAC: 'aac',
  WAV: 'wav',
  FLAC: 'flac',
  OGG: 'ogg',
  OPUS: 'opus',
  MP4: 'mp4',
  MOV: 'mov',
  WEBM: 'webm',
  MKV: 'mkv',
  AVI: 'avi',
  GIF: 'gif',
  JPG: 'jpg',
  PNG: 'png',
  WEBP: 'webp',
  BMP: 'bmp',
  TIFF: 'tiff',
  PDF: 'pdf',
  FRAMES: 'frames',
  ZIP: 'zip',
  TXT: 'txt',
  MD: 'md',
  HTML: 'html',
  DOCX: 'docx',
  ODT: 'odt',
  RTF: 'rtf',
  XLSX: 'xlsx',
  XLS: 'xls',
  CSV: 'csv',
  ODS: 'ods',
  PPTX: 'pptx',
} as const;

export type FormatLabel = keyof typeof formats;
export type FileKind =
  | 'Audio'
  | 'Video'
  | 'Image'
  | 'Document'
  | 'Spreadsheet'
  | 'Presentation'
  | 'File';

export const groups: Record<string, FormatLabel[]> = {
  Audio: ['MP3', 'M4A', 'AAC', 'WAV', 'FLAC', 'OGG', 'OPUS'],
  Video: ['MP4', 'MOV', 'WEBM', 'MKV', 'AVI', 'GIF'],
  Image: ['JPG', 'PNG', 'WEBP', 'BMP', 'TIFF'],
  Document: ['TXT', 'MD', 'HTML', 'DOCX', 'ODT', 'RTF', 'PDF'],
  Spreadsheet: ['XLSX', 'XLS', 'CSV', 'ODS', 'PDF'],
  Presentation: ['PPTX', 'PDF'],
  Archive: ['ZIP'],
};

export const groupMeta: {
  name: keyof typeof groups;
  label: string;
  hint: string;
}[] = [
  { name: 'Audio', label: 'Audio', hint: 'MP3 · M4A · AAC · WAV · FLAC · OGG · OPUS' },
  { name: 'Video', label: 'Video', hint: 'MP4 · MOV · WEBM · MKV · AVI · GIF' },
  { name: 'Image', label: 'Images', hint: 'JPG · PNG · WEBP · BMP · TIFF · PDF' },
  { name: 'Document', label: 'Documents', hint: 'TXT · MD · HTML · DOCX · ODT · RTF · PDF' },
  { name: 'Spreadsheet', label: 'Spreadsheets', hint: 'XLSX · XLS · CSV · ODS · PDF' },
  { name: 'Presentation', label: 'Presentations', hint: 'PPTX · PDF · TXT · HTML' },
  { name: 'Archive', label: 'Packaging', hint: 'ZIP' },
];

const imageExt = /\.(jpg|jpeg|png|webp|bmp|tif|tiff)$/i;
const videoExt = /\.(mp4|mov|m4v|webm|mkv|avi|wmv|flv|mpeg|mpg|3gp)$/i;
const audioExt = /\.(mp3|wav|m4a|aac|flac|ogg|opus|wma|aiff|aif)$/i;
const documentExt = /\.(txt|md|html?|docx|odt|rtf|pdf)$/i;
const spreadsheetExt = /\.(xlsx|xls|csv|ods)$/i;
const presentationExt = /\.(pptx|odp)$/i;

export function fileKind(file: File): FileKind {
  if (file.type.startsWith('video/') || videoExt.test(file.name) || /\.gif$/i.test(file.name)) return 'Video';
  if (file.type.startsWith('image/') || imageExt.test(file.name) || /\.svg$/i.test(file.name)) return 'Image';
  if (file.type.startsWith('audio/') || audioExt.test(file.name)) return 'Audio';
  if (spreadsheetExt.test(file.name)) return 'Spreadsheet';
  if (presentationExt.test(file.name)) return 'Presentation';
  if (documentExt.test(file.name)) return 'Document';
  return 'File';
}

export const allowed: Record<FileKind, FormatLabel[]> = {
  Audio: [...groups.Audio, 'MP4', 'MOV', 'WEBM', 'MKV', 'AVI', 'ZIP'],
  Video: [...groups.Audio, ...groups.Video, ...groups.Image, 'FRAMES', 'ZIP'],
  Image: [...groups.Image, 'PDF', ...groups.Video, 'ZIP'],
  Document: [...groups.Document, 'ZIP'],
  Spreadsheet: [...groups.Spreadsheet, 'ZIP'],
  Presentation: [...groups.Presentation, 'TXT', 'HTML', 'ZIP'],
  File: ['ZIP'],
};

export function canConvert(kind: FileKind, label: FormatLabel, fileName = '') {
  if (label === 'FRAMES') return kind === 'Video';
  if (kind === 'Audio' && label === 'GIF') return false;
  if (/\.gif$/i.test(fileName) && kind === 'Video' && groups.Audio.includes(label)) return false;
  if (kind === 'Document' && groups.Document.includes(label)) return true;
  if (kind === 'Spreadsheet' && groups.Spreadsheet.includes(label)) return true;
  if (kind === 'Presentation' && ['PPTX', 'PDF', 'TXT', 'HTML'].includes(label)) return true;
  if (['Document', 'Spreadsheet', 'Presentation'].includes(kind) && label === 'ZIP') return true;
  return allowed[kind]?.includes(label) === true;
}

export function outputOptions(kind: FileKind, fileName: string) {
  return (allowed[kind] ?? [])
    .filter((label) => canConvert(kind, label, fileName))
    .map((label) => ({ value: formats[label], label }));
}

export function defaultOutput(kind: FileKind): string {
  if (kind === 'Audio') return 'mp3';
  if (kind === 'Video') return 'mp4';
  if (kind === 'Image') return 'png';
  if (kind === 'Document') return 'txt';
  if (kind === 'Spreadsheet') return 'xlsx';
  if (kind === 'Presentation') return 'pptx';
  return 'zip';
}

export function labelFor(ext: string): FormatLabel | undefined {
  return (Object.keys(formats) as FormatLabel[]).find((k) => formats[k] === ext);
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  return bytes < 1024 * 1024
    ? (bytes / 1024).toFixed(1) + ' KB'
    : (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

export function mimeFor(ext: string) {
  return (
    {
      mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav',
      flac: 'audio/flac', ogg: 'audio/ogg', opus: 'audio/opus',
      mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
      mkv: 'video/x-matroska', avi: 'video/x-msvideo', gif: 'image/gif',
      jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', bmp: 'image/bmp',
      tiff: 'image/tiff', pdf: 'application/pdf', zip: 'application/zip',
      txt: 'text/plain', md: 'text/markdown', html: 'text/html',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      odt: 'application/vnd.oasis.opendocument.text', rtf: 'application/rtf',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel', csv: 'text/csv',
      ods: 'application/vnd.oasis.opendocument.spreadsheet',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    } as Record<string, string>
  )[ext] ?? 'application/octet-stream';
}

export function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}
