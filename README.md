# PWA OCR Scanner

A Progressive Web App for scanning documents with camera and OCR support for English, Traditional Chinese, and numbers.

## Features

- Camera access for document scanning
- OCR using Tesseract.js for English, Traditional Chinese, and numbers
- PWA support for offline installation

## Usage

1. Allow camera access.
2. Click "Capture" to take a photo.
3. Click "Process & OCR" to perform OCR on the captured image.
4. View the recognized text in the textarea.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy to GitHub Pages

1. Build the project: `npm run build`
2. Push the `dist` folder to the `gh-pages` branch or use GitHub Actions for automatic deployment.

The app is built with vanilla JavaScript and can be served as static files on GitHub Pages.

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