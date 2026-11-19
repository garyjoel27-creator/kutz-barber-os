import React, { useState, useRef, useCallback } from 'react';
import { ChevronsLeftRight } from 'lucide-react';

const PhotoCompare = ({ before, after }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef(null);

  const updatePosition = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = Math.max(0, Math.min((x / rect.width) * 100, 100));
    setSliderPosition(percent);
  }, []);

  const handleMouseMove = (e) => {
    updatePosition(e.clientX);
  };

  const handleTouchMove = (e) => {
    if (e.touches && e.touches[0]) {
      updatePosition(e.touches[0].clientX);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-72 sm:h-96 bg-[#14171D] rounded-3xl overflow-hidden cursor-ew-resize select-none border border-[#262B36] shadow-[0_12px_35px_rgba(0,0,0,0.6)] touch-none"
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
    >
      {/* Imagen Después (Capa de fondo) */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${after})` }}
      />

      {/* Imagen Antes (Capa recortada con clip-path) */}
      <div 
        className="absolute inset-0 bg-cover bg-center transition-none"
        style={{ 
          backgroundImage: `url(${before})`,
          clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)`
        }}
      />

      {/* Etiqueta Antes - Matte Dark */}
      <div className="absolute top-4 left-4 bg-[#0F1115]/85 text-[#F3F4F6] text-[10px] font-mono font-bold tracking-[0.2em] uppercase px-3 py-1.5 rounded-lg backdrop-blur-md pointer-events-none shadow-md border border-[#262B36]">
        ANTES
      </div>

      {/* Etiqueta Después - Acid Volt / Emerald */}
      <div className="absolute top-4 right-4 bg-[#10B981] text-[#090B0E] text-[10px] font-mono font-bold tracking-[0.2em] uppercase px-3 py-1.5 rounded-lg backdrop-blur-md pointer-events-none shadow-md">
        DESPUÉS // FRESH CUT
      </div>

      {/* Divisoria Slider Line */}
      <div 
        className="absolute top-0 bottom-0 w-0.5 bg-[#10B981] shadow-[0_0_15px_#10B981] pointer-events-none"
        style={{ left: `${sliderPosition}%` }}
      >
        {/* Handle Central Streetwear */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-[#161920] text-[#10B981] border-2 border-[#10B981] shadow-[0_0_20px_rgba(16,185,129,0.5)] flex items-center justify-center">
          <ChevronsLeftRight size={18} />
        </div>
      </div>

      {/* Indicador táctil inferior */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-[#0F1115]/80 text-[#D1D5DB] text-[10px] font-mono tracking-wider uppercase font-semibold px-3 py-1 rounded-lg border border-[#262B36] backdrop-blur-md pointer-events-none hidden sm:block">
        Desliza para comparar el Fade
      </div>
    </div>
  );
};

export default PhotoCompare;
