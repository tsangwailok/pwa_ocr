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
  detectDocumentCorners();
  drawCorners();
});

function detectDocumentCorners() {
  // Use jsfeat for edge detection and contour finding
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const gray = new jsfeat.matrix_t(canvas.width, canvas.height, jsfeat.U8_t | jsfeat.C1_t);
  jsfeat.imgproc.grayscale(imgData.data, gray);
  const cornersArr = [];
  for (let i = 0; i < 4; i++) cornersArr.push(new jsfeat.point_t(0, 0));
  jsfeat.imgproc.canny(gray, gray, 20, 50);
  // Simple heuristic: use image corners
  corners = [
    { x: 40, y: 40 },
    { x: canvas.width - 40, y: 40 },
    { x: canvas.width - 40, y: canvas.height - 40 },
    { x: 40, y: canvas.height - 40 }
  ];
}

function drawCorners() {
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'lime';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.stroke();
  // Draw corner handles
  ctx.fillStyle = 'red';
  corners.forEach(c => ctx.fillRect(c.x - 5, c.y - 5, 10, 10));
}

canvas.addEventListener('mousedown', (e) => {
  if (!captured) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  for (let i = 0; i < corners.length; i++) {
    if (Math.abs(x - corners[i].x) < 10 && Math.abs(y - corners[i].y) < 10) {
      draggingCorner = i;
      break;
    }
  }
});
canvas.addEventListener('mousemove', (e) => {
  if (draggingCorner === null) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  corners[draggingCorner] = { x, y };
  drawCorners();
});
canvas.addEventListener('mouseup', () => {
  draggingCorner = null;
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
  // Perspective correction
  const [tl, tr, br, bl] = corners;
  const width = Math.max(
    Math.hypot(tr.x - tl.x, tr.y - tl.y),
    Math.hypot(br.x - bl.x, br.y - bl.y)
  );
  const height = Math.max(
    Math.hypot(bl.x - tl.x, bl.y - tl.y),
    Math.hypot(br.x - tr.x, br.y - tr.y)
  );
  const dst = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height }
  ];
  // Compute transform
  const srcMat = [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y];
  const dstMat = [0, 0, width, 0, width, height, 0, height];
  const transform = jsfeat.math.perspective_4point_transform(srcMat, dstMat);
  // Create new canvas for result
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const outImg = tempCtx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = jsfeat.math.perspective_transform(transform, x, y);
      const srcX = Math.round(px[0]);
      const srcY = Math.round(px[1]);
      if (srcX >= 0 && srcX < canvas.width && srcY >= 0 && srcY < canvas.height) {
        const srcIdx = (srcY * canvas.width + srcX) * 4;
        const dstIdx = (y * width + x) * 4;
        outImg.data[dstIdx] = imgData.data[srcIdx];
        outImg.data[dstIdx + 1] = imgData.data[srcIdx + 1];
        outImg.data[dstIdx + 2] = imgData.data[srcIdx + 2];
        outImg.data[dstIdx + 3] = imgData.data[srcIdx + 3];
      }
    }
  }
  tempCtx.putImageData(outImg, 0, 0);
  // Replace main canvas
  canvas.width = width;
  canvas.height = height;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(tempCanvas, 0, 0);
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
