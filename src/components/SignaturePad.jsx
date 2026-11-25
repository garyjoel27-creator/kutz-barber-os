import React, { useRef, useState, useEffect } from 'react';
import { RotateCcw, Check, PenTool } from 'lucide-react';

/**
 * Componente de firma manuscrita digitalizada en HTML5 Canvas
 * Optimizado para pantallas táctiles (tablets/smartphones) y ratón.
 */
const SignaturePad = ({ onSave, onClear, existingSignature = null }) => {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const initializedRef = useRef(false);
  const lastEmittedRef = useRef(null);
  const sizeRef = useRef({ width: 460, height: 160 });
  const [hasDrawn, setHasDrawn] = useState(Boolean(existingSignature));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Never wipe/reload canvas when parent echoes back our own captured stroke
    if (existingSignature && existingSignature === lastEmittedRef.current && initializedRef.current) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!initializedRef.current) {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(280, Math.round(rect.width || 460));
      const height = Math.max(140, Math.round(rect.height || 160));
      const dpr = Math.min(window.devicePixelRatio || 2, 2);
      sizeRef.current = { width, height };
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.strokeStyle = '#201d1a';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      initializedRef.current = true;
    }

    const { width, height } = sizeRef.current;

    if (existingSignature) {
      let cancelled = false;
      const img = new Image();
      img.onload = () => {
        if (cancelled || drawingRef.current) return;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        setHasDrawn(true);
      };
      img.src = existingSignature;
      return () => {
        cancelled = true;
      };
    } else if (lastEmittedRef.current === null || !drawingRef.current) {
      ctx.clearRect(0, 0, width, height);
      lastEmittedRef.current = null;
      setHasDrawn(false);
    }
  }, [existingSignature]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width ? sizeRef.current.width / rect.width : 1;
    const scaleY = rect.height ? sizeRef.current.height / rect.height : 1;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
    const { x, y } = getCoordinates(e);
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
    drawingRef.current = true;
    setHasDrawn(true);
  };

  const draw = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getCoordinates(e);
    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (e) => {
    if (drawingRef.current) {
      e.preventDefault();
      drawingRef.current = false;
      const canvas = canvasRef.current;
      if (canvas && onSave) {
        const dataUrl = canvas.toDataURL('image/png');
        lastEmittedRef.current = dataUrl;
        onSave(dataUrl);
      }
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, sizeRef.current.width, sizeRef.current.height);
    drawingRef.current = false;
    lastEmittedRef.current = null;
    setHasDrawn(false);
    if (onClear) onClear();
  };

  const exportSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return null;
    const dataUrl = canvas.toDataURL('image/png');
    lastEmittedRef.current = dataUrl;
    return dataUrl;
  };

  return (
    <div className="space-y-3">
      <div className="relative border-2 border-dashed border-[#ede5dc] rounded-2xl bg-[#faf8f5]/80 overflow-hidden touch-none hover:border-[#bfa181] transition-colors">
        <canvas
          ref={canvasRef}
          className="w-full h-40 cursor-crosshair block touch-none"
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          onPointerCancel={stopDrawing}
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
