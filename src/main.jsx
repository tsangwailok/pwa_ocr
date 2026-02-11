import React, { useRef, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { createWorker } from 'tesseract.js';

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [captured, setCaptured] = useState(false);
  const [resultText, setResultText] = useState('');

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(err => console.error('Error accessing camera:', err));
  }, []);

  const handleCapture = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    setCaptured(true);
  };

  const handleProcess = async () => {
    if (!captured) {
      alert('Please capture an image first.');
      return;
    }

    // For now, perform OCR on the captured image without perspective correction
    // TODO: Implement proper perspective correction
    const canvas = canvasRef.current;
    const worker = await createWorker('eng+chi_tra');
    const { data: { text } } = await worker.recognize(canvas);
    await worker.terminate();

    setResultText(text);
  };

  return (
    <div>
      <h1>PWA OCR Scanner</h1>
      <video ref={videoRef} width="320" height="240" autoPlay></video>
      <button onClick={handleCapture}>Capture</button>
      <canvas ref={canvasRef} width="320" height="240"></canvas>
      <button onClick={handleProcess}>Process & OCR</button>
      <textarea value={resultText} onChange={(e) => setResultText(e.target.value)} rows="10" cols="50"></textarea>
    </div>
  );
}

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);
