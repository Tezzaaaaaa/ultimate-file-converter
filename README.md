# Convert.

A private, browser-based universal media converter with an Apple-inspired interface.

The project started as a macOS audio conversion Shortcut and has been rebuilt as a general-purpose web converter. It now accepts batches of media files and performs conversion locally in the browser using FFmpeg compiled to WebAssembly.

## What it converts

### Audio

- MP3
- M4A
- AAC
- WAV
- FLAC
- OGG
- OPUS

### Video

- MP4
- MOV
- WEBM
- MKV
- AVI
- GIF

### Images

- JPG
- PNG
- WEBP

Support ultimately depends on the codecs and formats included in the browser FFmpeg build.

## Conversion pathways

The converter accounts for the media relationships explicitly rather than assuming every file can become every other file:

| Source | Supported outputs |
|---|---|
| Audio | MP3, M4A, AAC, WAV, FLAC, OGG, OPUS, MP4, MOV, WEBM, MKV, AVI |
| Video / GIF | MP3, M4A, AAC, WAV, FLAC, OGG, OPUS, MP4, MOV, WEBM, MKV, AVI, GIF, JPG, PNG, WEBP |
| Image | JPG, PNG, WEBP, GIF, MP4, MOV, WEBM, MKV, AVI |
| Other files | Not offered until a real media conversion path exists |

Audio → video creates a simple black video canvas with the source audio. Image → video creates a short five-second video. Video → image extracts the first frame. Image → GIF creates a short animated GIF. Image ↔ audio is not presented as a conversion because it has no meaningful media representation.

Each queued file has its own output selector, so mixed batches do not have to share one conversion path. The top-level output selector can apply a compatible format across the current batch.

## Features

- Real browser-side conversion
- Audio, video and image conversion
- Batch conversion
- Drag and drop
- Progress reporting
- Individual downloads
- No account
- No conversion server
- Files remain in the browser during processing
- Apple-style responsive interface
- Dark mode
- Reduced-motion support

## How it works

The application loads FFmpeg WebAssembly when the first conversion starts. The selected files are written into the browser's local WebAssembly filesystem, converted, read back as Blob data, and exposed as local download links.

FFmpeg WebAssembly is designed for browser-side audio and video conversion and keeps the processing on the client rather than requiring a media-processing server.

## Privacy

Files selected for conversion are processed by the browser. This project does not implement an upload API or require an account.

The current web app loads its conversion JavaScript and WebAssembly runtime from jsDelivr. The media files themselves are not sent to a conversion service by the application.

## Development

This version is intentionally dependency-light: the application is static HTML, CSS and JavaScript and can be hosted on GitHub Pages or another static host.

Open `index.html` through a web server rather than directly from `file://`, because browser module and WebAssembly security rules can block local-file execution.

## Credits

Conversion is powered by [FFmpeg](https://ffmpeg.org/) through [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm).

FFmpeg and ffmpeg.wasm are independent open-source projects. Their respective licenses and third-party codec licenses apply to the components used by the browser build.

## Status

This is now the **Convert. Ultimate Converter** foundation: a universal media workflow rather than an audio-only converter. The architecture can be extended later with document, archive and specialist-format handlers without replacing the core interface.
