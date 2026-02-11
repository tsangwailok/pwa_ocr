import './style.css';
import { createWorker } from 'tesseract.js';

const app = document.querySelector('#app');
app.innerHTML = `
  <div>
    <h1>PWA OCR Scanner</h1>
    <video id="video" width="320" height="240" autoplay></video>
    <button id="capture">Capture</button>
    <canvas id="canvas" width="320" height="240"></canvas>
    <button id="process">Process & OCR</button>
    <textarea id="result" rows="10" cols="50"></textarea>
  </div>
`;

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const captureBtn = document.getElementById('capture');
const processBtn = document.getElementById('process');
const result = document.getElementById('result');

let captured = false;

// Start camera
try {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  video.srcObject = stream;
} catch (err) {
  console.error('Error accessing back camera:', err);
  try {
    const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = fallbackStream;
  } catch (fallbackErr) {
    console.error('Error accessing camera:', fallbackErr);
  }
}

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
