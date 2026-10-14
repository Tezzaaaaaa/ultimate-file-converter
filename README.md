# Convert.

A private, browser-based universal media converter with an Apple-inspired interface.

The project started as a macOS audio conversion Shortcut and has been rebuilt as a general-purpose web converter. It now accepts batches of media files and performs conversion locally in the browser using FFmpeg compiled to WebAssembly.

## What it converts

Conversions run in the browser. Media conversion uses FFmpeg WebAssembly; spreadsheet conversion uses SheetJS; document and presentation text extraction uses the browser ZIP/XML APIs.

### Media

- Audio: MP3, M4A, AAC, WAV, FLAC, OGG, OPUS
- Video: MP4, MOV, WEBM, MKV, AVI, GIF
- Images: JPG, PNG, WEBP, BMP, TIFF; SVG may be accepted as an input when the browser can decode it
- Image to PDF: rasterizes a single supported image into a one-page PDF
- Video frame extraction: JPG frames packaged into ZIP

### Documents

- Inputs: TXT, Markdown, HTML, DOCX, ODT, RTF
- Outputs: TXT, Markdown, HTML, DOCX, ODT, RTF, PDF
- Text-based PDF input: extracts selectable text to supported document outputs; scanned/image-only PDFs are not OCR-processed
- Text-based conversion is supported. DOCX/ODT layout, styles, tracked changes, images, tables, and embedded objects are not guaranteed to survive conversion.

### Spreadsheets

- Inputs and outputs: XLSX, XLS, CSV, ODS
- Spreadsheet to PDF: exports sheet names and cell data as a readable text-based PDF; it does not reproduce spreadsheet page layout
- SheetJS handles workbook reading and writing. CSV is a single-sheet format, so exporting a multi-sheet workbook to CSV exports the active/first sheet only; workbook-specific formatting and some advanced features may be lost.

### Presentations

- Inputs: PPTX and ODP
- Outputs: PPTX, TXT, HTML, PDF
- Presentation to PDF: exports extracted slide text to a basic text PDF, not a faithful slide rendering
- PPTX/ODP text can be extracted to TXT or HTML. PPTX output rebuilds a basic text-slide deck from extracted content; original themes, slide layouts, animations, media, and transitions are not preserved.

### Not supported as semantic conversions

Legacy binary DOC/PPT conversion, scanned-PDF OCR, multi-page PDF-to-image export, and high-fidelity Office-to-PDF rendering are not implemented. PDF output is a basic text export for documents, spreadsheets and presentations, or a single-page image PDF. PDF extraction works only when the PDF contains selectable text. Any file can still be packaged into ZIP, which is packaging rather than format conversion.

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

This is now the **Convert. Ultimate Converter** foundation: a universal media workflow rather than an audio-only converter. The architecture supports media conversion, text-oriented Office conversion, basic PDF creation/extraction, and ZIP packaging without replacing the core interface.
