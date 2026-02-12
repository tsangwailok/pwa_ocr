import './style.css';
import { createWorker } from 'tesseract.js';
import jsfeat from 'jsfeat';

const app = document.querySelector('#app');
app.innerHTML = `
  <div>
    <h1>PWA OCR Scanner</h1>
    <video id="video" width="320" height="240" autoplay></video>
    <button id="swap">Swap Camera</button>
    <button id="capture">Capture</button>
    <canvas id="canvas" width="320" height="240"></canvas>
    <div style="margin:1em 0;">
      <button id="crop">Crop</button>
      <button id="transform">Transform</button>
      <button id="export">Export Cropped</button>
    </div>
    <button id="process">Process & OCR</button>
    <textarea id="result" rows="10" cols="50"></textarea>
  </div>
`;

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const swapBtn = document.getElementById('swap');
const captureBtn = document.getElementById('capture');
const cropBtn = document.getElementById('crop');
const transformBtn = document.getElementById('transform');
const exportBtn = document.getElementById('export');
const processBtn = document.getElementById('process');
const result = document.getElementById('result');

let captured = false;
let currentFacingMode = 'environment';
let corners = [
  { x: 40, y: 40 },
  { x: 280, y: 40 },
  { x: 280, y: 200 },
  { x: 40, y: 200 }
];
let draggingCorner = null;
let capturedImageData = null;

const isBackCameraLabel = (label) => /back|rear|environment/i.test(label || '');

const getPreferredCameraStream = async (facingMode) => {
  const initialStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: facingMode } }
  });

  let devices = [];
  try {
    devices = await navigator.mediaDevices.enumerateDevices();
  } catch {
    return initialStream;
  }

  const backDevice = devices.find(
    (device) => device.kind === 'videoinput' && isBackCameraLabel(device.label)
  );
  const frontDevice = devices.find(
    (device) => device.kind === 'videoinput' && /front|user/i.test(device.label || '')
  );

  const preferredDevice = facingMode === 'environment' ? backDevice : frontDevice;

  if (!preferredDevice) {
    return initialStream;
  }

  const currentTrack = initialStream.getVideoTracks()[0];
  const currentSettings = currentTrack?.getSettings?.() || {};

  if (currentSettings.deviceId === preferredDevice.deviceId) {
    return initialStream;
  }

  initialStream.getTracks().forEach((track) => track.stop());

  return navigator.mediaDevices.getUserMedia({
    video: { deviceId: { exact: preferredDevice.deviceId } }
  });
};

const stopStream = (stream) => {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
};

const startCamera = async (facingMode) => {
  const stream = await getPreferredCameraStream(facingMode);
  video.srcObject = stream;
};

// Start camera
try {
  await startCamera(currentFacingMode);
} catch (err) {
  console.error('Error accessing back camera:', err);
  try {
    const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = fallbackStream;
  } catch (fallbackErr) {
    console.error('Error accessing camera:', fallbackErr);
  }
}

swapBtn.addEventListener('click', async () => {
  const activeStream = video.srcObject;
  stopStream(activeStream);
  currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
  try {
    await startCamera(currentFacingMode);
  } catch (err) {
    console.error('Error swapping camera:', err);
  }
});

// Capture image
captureBtn.addEventListener('click', () => {
  // Reset canvas to video dimensions
  canvas.width = 320;
  canvas.height = 240;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  capturedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  captured = true;
  console.log('Image captured, canvas:', canvas.width, canvas.height);
  detectDocumentCorners();
  drawCorners();
  console.log('Corners:', corners);
});

function detectDocumentCorners() {
  const margin = 40;
  corners = [
    { x: margin, y: margin },
    { x: canvas.width - margin, y: margin },
    { x: canvas.width - margin, y: canvas.height - margin },
    { x: margin, y: canvas.height - margin }
  ];
}

function drawCorners() {
  if (!capturedImageData) {
    console.log('No captured image data');
    return;
  }
  ctx.putImageData(capturedImageData, 0, 0);
  ctx.strokeStyle = 'lime';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i++) {
    ctx.lineTo(corners[i].x, corners[i].y);
  }
  ctx.closePath();
  ctx.stroke();
  
  // Draw corner handles
  ctx.fillStyle = 'red';
  corners.forEach((c, i) => {
    ctx.fillRect(c.x - 6, c.y - 6, 12, 12);
    ctx.fillStyle = 'blue';
    ctx.font = '12px Arial';
    ctx.fillText(i, c.x - 5, c.y - 8);
    ctx.fillStyle = 'red';
  });
  console.log('Corners drawn at:', corners);
}

let isMouseDown = false;

canvas.addEventListener('mousedown', (e) => {
  if (!captured) return;
  isMouseDown = true;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  // Check if clicking a corner
  for (let i = 0; i < corners.length; i++) {
    if (Math.abs(x - corners[i].x) < 10 && Math.abs(y - corners[i].y) < 10) {
      draggingCorner = i;
      return;
    }
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (!isMouseDown || !captured) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  if (draggingCorner !== null) {
    corners[draggingCorner] = { x: Math.max(0, Math.min(x, canvas.width)), y: Math.max(0, Math.min(y, canvas.height)) };
    drawCorners();
  }
});

canvas.addEventListener('mouseup', () => {
  isMouseDown = false;
  draggingCorner = null;
});

cropBtn.addEventListener('click', () => {
  if (!captured) return;
  // Simple rectangular crop from detected corners
  const minX = Math.min(corners[0].x, corners[1].x, corners[2].x, corners[3].x);
  const minY = Math.min(corners[0].y, corners[1].y, corners[2].y, corners[3].y);
  const maxX = Math.max(corners[0].x, corners[1].x, corners[2].x, corners[3].x);
  const maxY = Math.max(corners[0].y, corners[1].y, corners[2].y, corners[3].y);
  
  const cropWidth = maxX - minX;
  const cropHeight = maxY - minY;
  
  // Extract the region
  const cropped = ctx.getImageData(minX, minY, cropWidth, cropHeight);
  
  // Resize canvas and paste cropped data
  canvas.width = cropWidth;
  canvas.height = cropHeight;
  ctx.putImageData(cropped, 0, 0);
  
  captured = false;
  capturedImageData = null;
});

transformBtn.addEventListener('click', () => {
  if (!captured) return;
  // Example: simple horizontal flip
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(canvas, 0, 0);
  ctx.restore();
});

exportBtn.addEventListener('click', () => {
  if (!captured) return;
  const dataUrl = canvas.toDataURL('image/png');
  // Download cropped image
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = 'cropped.png';
  link.click();
});

// Process and OCR
  if (!captured) {
    alert('Please capture an image first.');
    return;
  }
  // Use cropped/transformed canvas for OCR
  const worker = await createWorker('eng+chi_tra');
  const { data: { text } } = await worker.recognize(canvas);
  await worker.terminate();
  result.value = text;
});
