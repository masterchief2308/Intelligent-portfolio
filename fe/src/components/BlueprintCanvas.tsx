'use client';

import { useEffect, useRef } from 'react';

export default function BlueprintCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    let mouseX = -1000;
    let mouseY = -1000;
    let currentX = mouseX;
    let currentY = mouseY;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener('resize', handleResize);

    const drawGrid = () => {
      currentX += (mouseX - currentX) * 0.1;
      currentY += (mouseY - currentY) * 0.1;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, width, height);

      const gridSize = 80;
      ctx.lineWidth = 1;
      
      for (let x = 0; x <= width; x += gridSize) {
        for (let y = 0; y <= height; y += gridSize) {
          const dx = x - currentX;
          const dy = y - currentY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          let opacity = 0.015;
          
          if (dist < 300) {
            opacity = 0.015 + (1 - dist / 300) * 0.15;
            ctx.strokeStyle = `rgba(255, 160, 50, ${opacity})`;
          } else {
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
          }
          ctx.strokeRect(x, y, gridSize, gridSize);
        }
      }

      if (currentX > 0 && currentY > 0) {
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
        ctx.beginPath();
        ctx.moveTo(currentX - 10, currentY);
        ctx.lineTo(currentX + 10, currentY);
        ctx.moveTo(currentX, currentY - 10);
        ctx.lineTo(currentX, currentY + 10);
        ctx.stroke();
      }

      requestAnimationFrame(drawGrid);
    };

    const animationId = requestAnimationFrame(drawGrid);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[-1]" />;
}
