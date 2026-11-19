import React, { useRef, useState, useEffect } from 'react';
import { RotateCcw, Check, PenTool } from 'lucide-react';

/**
 * Componente de firma manuscrita digitalizada en HTML5 Canvas
 * Optimizado para pantallas táctiles (tablets/smartphones) y ratón.
 */
const SignaturePad = ({ onSave, onClear, existingSignature = null }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    // Ajustar resolución retina para que la firma sea nítida
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    ctx.strokeStyle = '#201d1a'; // Tinta espresso de lujo
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (existingSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasDrawn(true);
      };
      img.src = existingSignature;
    }
  }, [existingSignature]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if (e.touches && e.touches[0]) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (e) => {
    if (isDrawing) {
      e.preventDefault();
      setIsDrawing(false);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
    if (onClear) onClear();
  };

  const exportSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return null;
    return canvas.toDataURL('image/png');
  };

  return (
    <div className="space-y-3">
      <div className="relative border-2 border-dashed border-[#ede5dc] rounded-2xl bg-[#faf8f5]/80 overflow-hidden touch-none hover:border-[#bfa181] transition-colors">
        <canvas
          ref={canvasRef}
          className="w-full h-40 cursor-crosshair block"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />

        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[#b8afa6] text-xs space-x-2">
            <PenTool size={16} />
            <span>Firma aquí con el dedo o stylus</span>
          </div>
        )}

        <div className="absolute bottom-2 right-3 pointer-events-none text-[9px] uppercase tracking-widest text-[#c4af97] font-semibold">
          Firma Biométrica Digital
        </div>
      </div>

      <div className="flex items-center justify-between text-xs pt-1">
        <button
          type="button"
          onClick={clearCanvas}
          className="inline-flex items-center space-x-1.5 text-[#8f857d] hover:text-[#7a5d42] transition-colors px-3 py-1.5 rounded-lg border border-[#ede7e0] bg-white cursor-pointer"
        >
          <RotateCcw size={13} />
          <span>Borrar firma</span>
        </button>

        {onSave && (
          <button
            type="button"
            disabled={!hasDrawn}
            onClick={() => onSave(exportSignature())}
            className="btn-author text-xs py-1.5 px-4 disabled:opacity-40 cursor-pointer inline-flex items-center space-x-1.5"
          >
            <Check size={14} />
            <span>Confirmar Trazo</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default SignaturePad;
