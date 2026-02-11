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
    <button id="process">Process & OCR</button>
    <textarea id="result" rows="10" cols="50"></textarea>
  </div>
`;

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const swapBtn = document.getElementById('swap');
const captureBtn = document.getElementById('capture');
const processBtn = document.getElementById('process');
const result = document.getElementById('result');

let captured = false;
let currentFacingMode = 'environment';

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
});

// Process and OCR
processBtn.addEventListener('click', async () => {
  if (!captured) {
    alert('Please capture an image first.');
    return;
  }

  const worker = await createWorker('eng+chi_tra');
  const { data: { text } } = await worker.recognize(canvas);
  await worker.terminate();

  result.value = text;
});
