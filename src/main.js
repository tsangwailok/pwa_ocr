import './style.css';
import { createWorker } from 'tesseract.js';
import jsfeat from 'jsfeat';

const app = document.querySelector('#app');
app.innerHTML = `
  <div class="app-container">
    <header>
      <h1>📄 Document Scanner</h1>
      <p class="subtitle">Scan, detect, and extract text</p>
    </header>
    
    <div class="scanner-area">
      <div class="video-container">
        <video id="video" autoplay playsinline></video>
        <canvas id="canvas"></canvas>
      </div>
      
      <div class="controls">
        <button id="swap" class="btn btn-secondary">🔄 Switch Camera</button>
        <button id="capture" class="btn btn-primary">📸 Capture</button>
      </div>
    </div>
    
    <div class="editor-area" id="editorArea" style="display:none;">
      <div class="canvas-wrapper">
        <canvas id="editCanvas"></canvas>
      </div>
      
      <div class="editor-controls">
        <button id="retake" class="btn btn-secondary">↩️ Retake</button>
        <button id="crop" class="btn btn-primary">✂️ Crop & Correct</button>
      </div>
      
      <div class="filter-controls">
        <label>Filters:</label>
        <button id="filterNone" class="btn-filter active">Original</button>
        <button id="filterGray" class="btn-filter">Grayscale</button>
        <button id="filterBW" class="btn-filter">Black & White</button>
        <button id="filterEnhance" class="btn-filter">Enhanced</button>
      </div>
    </div>
    
    <div class="result-area" id="resultArea" style="display:none;">
        <div id="imagePreviewWrapper" style="width:100%;display:flex;justify-content:center;">
          <img id="imagePreview" style="max-width:100%;max-height:220px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.08);display:none;" alt="Preview" />
        </div>
        <button id="processOCR" class="btn btn-primary btn-large">🔍 Extract Text (OCR)</button>
        <div id="ocrProgress" style="display:none;" class="progress-bar">
          <div class="progress-fill"></div>
          <span class="progress-text">Processing...</span>
        </div>
        <textarea id="result" placeholder="Extracted text will appear here..."></textarea>
        <div class="result-controls">
          <button id="copyText" class="btn btn-secondary">📋 Copy</button>
          <button id="downloadImage" class="btn btn-secondary">💾 Download</button>
          <button id="newScan" class="btn btn-primary">➕ New Scan</button>
        </div>
    </div>
  </div>
`;

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const editCanvas = document.getElementById('editCanvas');
const editCtx = editCanvas.getContext('2d');

const swapBtn = document.getElementById('swap');
const captureBtn = document.getElementById('capture');
const retakeBtn = document.getElementById('retake');
const cropBtn = document.getElementById('crop');
const processOCRBtn = document.getElementById('processOCR');
const copyTextBtn = document.getElementById('copyText');
const downloadImageBtn = document.getElementById('downloadImage');
const newScanBtn = document.getElementById('newScan');

const filterNoneBtn = document.getElementById('filterNone');
const filterGrayBtn = document.getElementById('filterGray');
const filterBWBtn = document.getElementById('filterBW');
const filterEnhanceBtn = document.getElementById('filterEnhance');

const editorArea = document.getElementById('editorArea');
const resultArea = document.getElementById('resultArea');
const ocrProgress = document.getElementById('ocrProgress');
const result = document.getElementById('result');

let currentFacingMode = 'environment';
let corners = [];
let draggingCorner = null;
let capturedImageData = null;
let croppedImageData = null;

// Camera setup
async function startCamera(facingMode) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    };
  } catch (err) {
    console.error('Camera error:', err);
    alert('Could not access camera. Please check permissions.');
  }
}

startCamera(currentFacingMode);

// Swap camera
swapBtn.addEventListener('click', async () => {
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
  }
  currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
  await startCamera(currentFacingMode);
});

// Capture image
captureBtn.addEventListener('click', () => {
  canvas.width = video.videoWidth;
  const [tl, tr, br, bl] = corners;
  const topWidth = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const bottomWidth = Math.hypot(br.x - bl.x, br.y - bl.y);
  const leftHeight = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  const rightHeight = Math.hypot(br.x - tr.x, br.y - tr.y);
  const outputWidth = Math.round(Math.max(topWidth, bottomWidth));
  const outputHeight = Math.round(Math.max(leftHeight, rightHeight));
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = outputWidth;
  tempCanvas.height = outputHeight;
  const tempCtx = tempCanvas.getContext('2d');
  const sourceImg = editCtx.getImageData(0, 0, editCanvas.width, editCanvas.height);
  const destImg = tempCtx.createImageData(outputWidth, outputHeight);
  // Bilinear perspective mapping
  for (let y = 0; y < outputHeight; y++) {
    for (let x = 0; x < outputWidth; x++) {
      const u = x / outputWidth;
      const v = y / outputHeight;
      const srcX = tl.x * (1 - u) * (1 - v) + tr.x * u * (1 - v) + br.x * u * v + bl.x * (1 - u) * v;
      const srcY = tl.y * (1 - u) * (1 - v) + tr.y * u * (1 - v) + br.y * u * v + bl.y * (1 - u) * v;
      const sx = Math.round(srcX);
      const sy = Math.round(srcY);
      if (sx >= 0 && sx < editCanvas.width && sy >= 0 && sy < editCanvas.height) {
        const srcIdx = (sy * editCanvas.width + sx) * 4;
        const dstIdx = (y * outputWidth + x) * 4;
        destImg.data[dstIdx] = sourceImg.data[srcIdx];
        destImg.data[dstIdx + 1] = sourceImg.data[srcIdx + 1];
        destImg.data[dstIdx + 2] = sourceImg.data[srcIdx + 2];
        destImg.data[dstIdx + 3] = 255;
      }
    }
  }
  tempCtx.putImageData(destImg, 0, 0);
  editCanvas.width = outputWidth;
  editCanvas.height = outputHeight;
  editCtx.drawImage(tempCanvas, 0, 0);
  croppedImageData = editCtx.getImageData(0, 0, outputWidth, outputHeight);
  // Show preview image
  const imagePreview = document.getElementById('imagePreview');
  imagePreview.src = editCanvas.toDataURL();
  imagePreview.style.display = 'block';
  // Show result area
  editorArea.style.display = 'none';
  resultArea.style.display = 'block';
  // Always update preview when result area is shown
  setTimeout(() => {
    imagePreview.src = editCanvas.toDataURL();
    imagePreview.style.display = 'block';
  }, 100);
  
  // Set corners with padding
  const pad = 20;
  corners = [
    { x: Math.max(pad, minX), y: Math.max(pad, minY) },
    { x: Math.min(w - pad, maxX), y: Math.max(pad, minY) },
    { x: Math.min(w - pad, maxX), y: Math.min(h - pad, maxY) },
    { x: Math.max(pad, minX), y: Math.min(h - pad, maxY) }
  ];
}

// Draw edit canvas with corners
function drawEditCanvas() {
  editCtx.putImageData(capturedImageData, 0, 0);
  
  // Draw border
  editCtx.strokeStyle = '#4CAF50';
  editCtx.lineWidth = 3;
  editCtx.beginPath();
  editCtx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < 4; i++) editCtx.lineTo(corners[i].x, corners[i].y);
  editCtx.closePath();
  editCtx.stroke();
  
  // Draw corner handles
  corners.forEach((c, i) => {
    editCtx.fillStyle = '#ff5722';
    editCtx.fillRect(c.x - 8, c.y - 8, 16, 16);
    editCtx.fillStyle = 'white';
    editCtx.font = '12px bold Arial';
    editCtx.textAlign = 'center';
    editCtx.fillText(i + 1, c.x, c.y + 4);
  });
}

// Handle corner dragging
let isDragging = false;
editCanvas.addEventListener('mousedown', (e) => {
  const rect = editCanvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (editCanvas.width / rect.width);
  const y = (e.clientY - rect.top) * (editCanvas.height / rect.height);
  
  for (let i = 0; i < corners.length; i++) {
    if (Math.hypot(x - corners[i].x, y - corners[i].y) < 20) {
      draggingCorner = i;
      isDragging = true;
      break;
    }
  }
});

editCanvas.addEventListener('mousemove', (e) => {
  if (!isDragging || draggingCorner === null) return;
  const rect = editCanvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (editCanvas.width / rect.width);
  const y = (e.clientY - rect.top) * (editCanvas.height / rect.height);
  corners[draggingCorner] = {
    x: Math.max(0, Math.min(x, editCanvas.width)),
    y: Math.max(0, Math.min(y, editCanvas.height))
  };
  drawEditCanvas();
});

editCanvas.addEventListener('mouseup', () => {
  isDragging = false;
  draggingCorner = null;
});

// Touch support for mobile
editCanvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = editCanvas.getBoundingClientRect();
  const x = (touch.clientX - rect.left) * (editCanvas.width / rect.width);
  const y = (touch.clientY - rect.top) * (editCanvas.height / rect.height);
  
  for (let i = 0; i < corners.length; i++) {
    if (Math.hypot(x - corners[i].x, y - corners[i].y) < 30) {
      draggingCorner = i;
      isDragging = true;
      break;
    }
  }
});

editCanvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!isDragging || draggingCorner === null) return;
  const touch = e.touches[0];
  const imagePreview = document.getElementById('imagePreview');
  imagePreview.src = editCanvas.toDataURL();
  imagePreview.style.display = 'block';
  const rect = editCanvas.getBoundingClientRect();
  const x = (touch.clientX - rect.left) * (editCanvas.width / rect.width);
  const y = (touch.clientY - rect.top) * (editCanvas.height / rect.height);
  corners[draggingCorner] = {
    x: Math.max(0, Math.min(x, editCanvas.width)),
    y: Math.max(0, Math.min(y, editCanvas.height))
  };
  drawEditCanvas();
});

editCanvas.addEventListener('touchend', () => {
  isDragging = false;
  draggingCorner = null;
});

// Crop with perspective correction
cropBtn.addEventListener('click', () => {
  const [tl, tr, br, bl] = corners;
  
  const topWidth = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const bottomWidth = Math.hypot(br.x - bl.x, br.y - bl.y);
  const leftHeight = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  const rightHeight = Math.hypot(br.x - tr.x, br.y - tr.y);
  
  const outputWidth = Math.round(Math.max(topWidth, bottomWidth));
  const outputHeight = Math.round(Math.max(leftHeight, rightHeight));
  
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = outputWidth;
  tempCanvas.height = outputHeight;
  const tempCtx = tempCanvas.getContext('2d');
  
  const sourceImg = editCtx.getImageData(0, 0, editCanvas.width, editCanvas.height);
  const destImg = tempCtx.createImageData(outputWidth, outputHeight);
  
  // Bilinear perspective mapping
  for (let y = 0; y < outputHeight; y++) {
    for (let x = 0; x < outputWidth; x++) {
      const u = x / outputWidth;
      const v = y / outputHeight;
      
      const srcX = tl.x * (1 - u) * (1 - v) + tr.x * u * (1 - v) + 
                   br.x * u * v + bl.x * (1 - u) * v;
      const srcY = tl.y * (1 - u) * (1 - v) + tr.y * u * (1 - v) + 
                   br.y * u * v + bl.y * (1 - u) * v;
      
      const sx = Math.round(srcX);
      const sy = Math.round(srcY);
      
      if (sx >= 0 && sx < editCanvas.width && sy >= 0 && sy < editCanvas.height) {
        const srcIdx = (sy * editCanvas.width + sx) * 4;
        const dstIdx = (y * outputWidth + x) * 4;
        destImg.data[dstIdx] = sourceImg.data[srcIdx];
        destImg.data[dstIdx + 1] = sourceImg.data[srcIdx + 1];
        destImg.data[dstIdx + 2] = sourceImg.data[srcIdx + 2];
        destImg.data[dstIdx + 3] = 255;
      }
    }
  }
  
  tempCtx.putImageData(destImg, 0, 0);
  editCanvas.width = outputWidth;
  editCanvas.height = outputHeight;
  editCtx.drawImage(tempCanvas, 0, 0);
  
  croppedImageData = editCtx.getImageData(0, 0, outputWidth, outputHeight);
  
  // Show result area
  editorArea.style.display = 'none';
  resultArea.style.display = 'block';
  // Show preview image
  const imagePreview = document.getElementById('imagePreview');
  const previewUrl = editCanvas.toDataURL();
  console.log('Preview element:', imagePreview);
  console.log('Preview data URL:', previewUrl);
  if (imagePreview) {
    imagePreview.src = previewUrl;
    imagePreview.style.display = 'block';
    imagePreview.style.visibility = 'visible';
    imagePreview.style.border = '2px solid #2196F3';
    imagePreview.removeAttribute('hidden');
  } else {
    console.warn('imagePreview element not found');
  }
});

// Filters
function applyFilter(filter) {
  if (!croppedImageData) return;
  const imgData = new ImageData(
    new Uint8ClampedArray(croppedImageData.data),
    croppedImageData.width,
    croppedImageData.height
  );
  for (let i = 0; i < imgData.data.length; i += 4) {
    const r = imgData.data[i];
    const g = imgData.data[i + 1];
    const b = imgData.data[i + 2];
    if (filter === 'gray') {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      imgData.data[i] = imgData.data[i + 1] = imgData.data[i + 2] = gray;
    } else if (filter === 'bw') {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const bw = gray > 128 ? 255 : 0;
      imgData.data[i] = imgData.data[i + 1] = imgData.data[i + 2] = bw;
    } else if (filter === 'enhance') {
      // Increase contrast
      const factor = 1.5;
      imgData.data[i] = Math.min(255, (r - 128) * factor + 128);
      imgData.data[i + 1] = Math.min(255, (g - 128) * factor + 128);
      imgData.data[i + 2] = Math.min(255, (b - 128) * factor + 128);
    }
  }
  editCtx.putImageData(imgData, 0, 0);
  croppedImageData = imgData;
  // Update preview after filter
  const imagePreview = document.getElementById('imagePreview');
  const previewUrl = editCanvas.toDataURL();
  console.log('Preview after filter:', previewUrl);
  if (imagePreview) {
    imagePreview.src = previewUrl;
    imagePreview.style.display = 'block';
    imagePreview.style.visibility = 'visible';
    imagePreview.style.border = '2px solid #2196F3';
    imagePreview.removeAttribute('hidden');
  }
}

filterNoneBtn.addEventListener('click', () => {
  document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
  filterNoneBtn.classList.add('active');
  if (croppedImageData) {
    editCtx.putImageData(new ImageData(
      new Uint8ClampedArray(croppedImageData.data),
      croppedImageData.width,
      croppedImageData.height
    ), 0, 0);
  }
});

filterGrayBtn.addEventListener('click', () => {
  document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
  filterGrayBtn.classList.add('active');
  applyFilter('gray');
});

filterBWBtn.addEventListener('click', () => {
  document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
  filterBWBtn.classList.add('active');
  applyFilter('bw');
});

filterEnhanceBtn.addEventListener('click', () => {
  document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
  filterEnhanceBtn.classList.add('active');
  applyFilter('enhance');
});

// Retake
retakeBtn.addEventListener('click', () => {
  editorArea.style.display = 'none';
  document.querySelector('.scanner-area').style.display = 'block';
});

// OCR
processOCRBtn.addEventListener('click', async () => {
  ocrProgress.style.display = 'block';
  processOCRBtn.disabled = true;
  try {
    // Preprocess: grayscale and binarize for better OCR
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = editCanvas.width;
    tempCanvas.height = editCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(editCanvas, 0, 0);
    // Grayscale
    let imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const avg = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
      imageData.data[i] = avg;
      imageData.data[i+1] = avg;
      imageData.data[i+2] = avg;
    }
    tempCtx.putImageData(imageData, 0, 0);
    // Binarize (simple threshold)
    const threshold = 180;
    imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const v = imageData.data[i] > threshold ? 255 : 0;
      imageData.data[i] = v;
      imageData.data[i+1] = v;
      imageData.data[i+2] = v;
    }
    tempCtx.putImageData(imageData, 0, 0);
    // OCR with both English and Traditional Chinese
    const worker = await createWorker('eng+chi_tra', 1, {
      logger: m => console.log(m)
    });
    const { data: { text } } = await worker.recognize(tempCanvas);
    await worker.terminate();
    result.value = text;
    ocrProgress.style.display = 'none';
    processOCRBtn.disabled = false;
  } catch (err) {
    alert('OCR failed: ' + err.message);
    ocrProgress.style.display = 'none';
    processOCRBtn.disabled = false;
  }
});

// Copy text
copyTextBtn.addEventListener('click', () => {
  result.select();
  document.execCommand('copy');
  copyTextBtn.textContent = '✓ Copied!';
  setTimeout(() => copyTextBtn.textContent = '📋 Copy', 2000);
});

// Download image
downloadImageBtn.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = `scan-${Date.now()}.png`;
  link.href = editCanvas.toDataURL();
  link.click();
});

// New scan
newScanBtn.addEventListener('click', () => {
  resultArea.style.display = 'none';
  document.querySelector('.scanner-area').style.display = 'block';
  result.value = '';
  croppedImageData = null;
  capturedImageData = null;
});
