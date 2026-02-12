import './style.css';
import { createWorker } from 'tesseract.js';

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
let cropRect = { x: 60, y: 60, w: 200, h: 120 };
let cropping = false;

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
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  captured = true;
  // Draw crop rectangle
  ctx.strokeStyle = 'red';
  ctx.lineWidth = 2;
  ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
});

// Cropping tool: allow user to adjust rectangle
canvas.addEventListener('mousedown', (e) => {
  if (!captured) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  // Simple hit test
  if (x > cropRect.x && x < cropRect.x + cropRect.w && y > cropRect.y && y < cropRect.y + cropRect.h) {
    cropping = true;
    canvas.dataset.startX = x;
    canvas.dataset.startY = y;
  }
});
canvas.addEventListener('mousemove', (e) => {
  if (!cropping) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  // Resize crop rectangle
  cropRect.w = x - cropRect.x;
  cropRect.h = y - cropRect.y;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'red';
  ctx.lineWidth = 2;
  ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
});
canvas.addEventListener('mouseup', () => {
  cropping = false;
});

cropBtn.addEventListener('click', () => {
  if (!captured) return;
  // Draw only the cropped area
  const cropped = ctx.getImageData(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
  canvas.width = cropRect.w;
  canvas.height = cropRect.h;
  ctx.putImageData(cropped, 0, 0);
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
