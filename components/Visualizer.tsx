
import React, { useRef, useEffect } from 'react';

interface VisualizerProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
  color?: string;
  size?: number;
}

export const Visualizer: React.FC<VisualizerProps> = ({ analyser, isActive, color = '#818cf8', size = 200 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const bufferLength = analyser ? analyser.frequencyBinCount : 0;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameId = requestAnimationFrame(render);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      let volume = 0;
      if (analyser && isActive) {
        analyser.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((a, b) => a + b, 0);
        volume = sum / bufferLength;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Base Pulse
      const baseRadius = (size / 3) + (isActive ? volume * 0.4 : Math.sin(Date.now() / 1000) * 5);
      
      // Draw Glow Layers
      for (let i = 3; i > 0; i--) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius + (i * 20), 0, Math.PI * 2);
        const opacity = (0.1 / i) * (isActive ? 1.5 : 0.8);
        ctx.fillStyle = `${color}${Math.floor(opacity * 255).toString(16).padStart(2, '0')}`;
        ctx.fill();
      }

      // Main Orb
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
      const gradient = ctx.createRadialGradient(centerX - 10, centerY - 10, 0, centerX, centerY, baseRadius);
      gradient.addColorStop(0, '#ffffff44');
      gradient.addColorStop(0.5, color);
      gradient.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = gradient;
      ctx.fill();

      // Fluid ring
      if (isActive && volume > 5) {
        ctx.beginPath();
        for (let i = 0; i < 360; i += 2) {
          const rad = (i * Math.PI) / 180;
          const offset = (dataArray[i % bufferLength] || 0) * 0.3;
          const r = baseRadius + offset + 5;
          const x = centerX + Math.cos(rad) * r;
          const y = centerY + Math.sin(rad) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = `${color}66`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [analyser, isActive, color, size]);

  return (
    <canvas 
      ref={canvasRef} 
      width={size * 2} 
      height={size * 2} 
      className="max-w-full h-auto transition-all duration-1000"
    />
  );
};
