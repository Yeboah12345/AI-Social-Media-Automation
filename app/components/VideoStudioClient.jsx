'use client';

import React, { useRef, useEffect, useState } from 'react';

const TEMPLATES = [
  {
    id: 'ocean',
    name: 'Ocean Glow',
    colors: ['#0ea5e9', '#7c3aed'],
    textColor: '#f8fafc'
  },
  {
    id: 'sunset',
    name: 'Sunset',
    colors: ['#fb923c', '#ef4444'],
    textColor: '#0f172a'
  },
  {
    id: 'neon',
    name: 'Neon',
    colors: ['#06b6d4', '#f472b6'],
    textColor: '#020617'
  }
];

export default function VideoStudioClient({ width = 1080, height = 1080, fps = 30, onRecordingComplete = () => {} }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [text, setText] = useState('Your headline goes here');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    function drawFrame(timestamp) {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const t = (timestamp - startTimeRef.current) / 1000; // seconds

      // Background gradient
      const template = TEMPLATES.find(tpl => tpl.id === templateId) || TEMPLATES[0];
      const g = ctx.createLinearGradient(0, 0, width, height);
      g.addColorStop(0, template.colors[0]);
      g.addColorStop(1, template.colors[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      // Animated accent (moving circle)
      const cx = width * 0.5 + Math.sin(t * 1.2) * (width * 0.12);
      const cy = height * 0.25 + Math.cos(t * 0.8) * (height * 0.05);
      ctx.beginPath();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = template.colors[1];
      ctx.arc(cx, cy, width * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Draw wrapped text
      ctx.fillStyle = template.textColor;
      const padding = 80;
      const maxWidth = width - padding * 2;
      const fontSize = Math.floor(width / 12);
      ctx.font = `600 ${fontSize}px Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue'`;
      ctx.textAlign = 'center';

      wrapText(ctx, text, width / 2, height * 0.55, maxWidth, fontSize * 1.05);

      // Footer small caption
      ctx.font = `400 ${Math.floor(width / 28)}px Inter, system-ui`;
      ctx.fillStyle = template.textColor;
      ctx.fillText('Automated clip • AI Social Studio', width / 2, height - 60);

      rafRef.current = requestAnimationFrame(drawFrame);
    }

    rafRef.current = requestAnimationFrame(drawFrame);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      startTimeRef.current = null;
    };
  }, [templateId, text, width, height]);

  // Text wrapping helper
  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    const lines = [];
    let line = '';

    for (let n = 0; n < words.length; n++) {
      const testLine = line + (line ? ' ' : '') + words[n];
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && line) {
        lines.push(line);
        line = words[n];
      } else {
        line = testLine;
      }
    }
    lines.push(line);

    // vertical center the block
    const totalHeight = lines.length * lineHeight;
    let startY = y - totalHeight / 2 + lineHeight / 2;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, startY + i * lineHeight);
    }
  }

  async function startRecording() {
    if (isRecording) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const stream = canvas.captureStream(fps);
    recordedChunksRef.current = [];

    try {
      const options = { mimeType: 'video/webm;codecs=vp9' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm;codecs=vp8';
      }
      const mr = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: recordedChunksRef.current[0]?.type || 'video/webm' });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        onRecordingComplete(blob);
      };

      mr.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start MediaRecorder:', err);
      alert('Recording not supported in this browser.');
    }
  }

  function stopRecording() {
    if (!isRecording) return;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }

  function downloadRecording() {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = 'clip.webm';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="w-full max-w-4xl mx-auto bg-slate-900 rounded-xl p-6 shadow-lg">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 flex flex-col items-center">
          <canvas ref={canvasRef} className="w-full max-w-[480px] bg-black rounded-md shadow-inner" style={{ aspectRatio: '1 / 1' }} />

          <div className="mt-4 flex gap-2">
            <button
              className={`px-4 py-2 rounded-md font-semibold ${isRecording ? 'bg-red-600 text-white' : 'bg-emerald-500 text-white'}`}
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? 'Stop' : 'Record'}
            </button>

            {previewUrl && (
              <button className="px-4 py-2 rounded-md bg-slate-700 text-white" onClick={downloadRecording}>Download</button>
            )}
          </div>

          {previewUrl && (
            <video src={previewUrl} controls className="mt-4 w-full max-w-[480px] rounded-md" />
          )}
        </div>

        <aside className="w-full md:w-80 flex-shrink-0">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300">Template</label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {TEMPLATES.map(tpl => (
                  <button
                    key={tpl.id}
                    onClick={() => setTemplateId(tpl.id)}
                    className={`h-20 rounded-md p-2 flex items-end justify-center text-xs font-semibold ${templateId === tpl.id ? 'ring-2 ring-offset-2 ring-indigo-400' : ''}`}
                    style={{
                      background: `linear-gradient(135deg, ${tpl.colors[0]}, ${tpl.colors[1]})`,
                      color: tpl.textColor
                    }}
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300">Headline</label>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="mt-2 w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
                placeholder="Enter headline text"
              />
            </div>

            <div>
              <p className="text-xs text-slate-400">Resolution: {width}×{height} • FPS: {fps}</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
