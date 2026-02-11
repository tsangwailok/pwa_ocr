# PWA OCR Scanner

A Progressive Web App built with React for scanning documents with camera, edge detection, perspective correction, and OCR support for English, Traditional Chinese, and numbers.

## Features

- Camera access for document scanning
- OCR using Tesseract.js for English, Traditional Chinese, and numbers
- PWA support for offline installation

## Usage

1. Allow camera access.
2. Click "Capture" to take a photo.
3. Click "Process & OCR" to perform OCR on the captured image.
4. View the recognized text in the textarea.

Note: Perspective correction is currently disabled due to library compatibility issues. It can be re-implemented with a more suitable library like OpenCV.js in the future.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```