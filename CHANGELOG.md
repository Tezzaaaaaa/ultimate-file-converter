# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Fixed

- JPG output no longer aborts the FFmpeg engine. The bundled `mjpeg` encoder crashed
  ("memory access out of bounds") whenever a quality scale was requested, so image-to-JPG,
  video-to-JPG and video frame extraction could hang indefinitely. JPEG writes now pin the
  Huffman tables (`-huffman 0`).
- Frame extraction to a ZIP of JPGs works again, including multi-frame runs.
- Document-to-PDF conversion works. PDF was offered for TXT, Markdown, HTML, DOCX, ODT, RTF
  and PDF inputs but every attempt failed with "this output pathway is not supported".
- SVG inputs convert instead of failing. They are rasterised through the browser and then
  converted, instead of being handed to an FFmpeg build with no SVG decoder.
- TIFF-to-PDF conversion rasterises through the FFmpeg engine when the browser's image
  decoder cannot read the source.
- GIF-to-WEBM conversion no longer fails on the source's alpha channel (now pinned to
  `yuv420p`).
- PDF export escapes characters that the standard PDF fonts cannot encode.

### Changed

- The UI fonts (DM Sans and Manrope) are self-hosted from the Fontsource packages and
  included in the offline cache. The Google Fonts import meant the site was not fully
  offline and the typography silently degraded without a connection.
- `npm run test:offline` now verifies media, image, document, spreadsheet and SVG
  conversions with the network disabled, plus offline font loading and cache contents.

## [1.0.0] — 2026-09-07

### Added

- Initial macOS audio conversion Shortcut project.
- Local FFmpeg-based processing.
- Documentation for installation, usage, privacy, compatibility, and troubleshooting.
