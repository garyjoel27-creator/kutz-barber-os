import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Pause, X, Sparkles, Maximize2, Minimize2, 
  RotateCcw, Sliders, ChevronLeft, ChevronRight, Layers 
} from 'lucide-react';

/**
 * Watermark oficial de LuminaDesk para Time-Lapse Clínico
 */
export const MORPH_WATERMARK = 'LuminaDesk • Atelier & Clinical Management';

/**
 * Normaliza cualquier formato de fotografías entrante (array de strings,
 * array de objetos con url/label/date, o estructura { before, after }).
 */
function normalizePhotos(photos) {
  if (!photos) return [];

  if (Array.isArray(photos)) {
    const result = [];
    photos.forEach((p, idx) => {
      if (!p) return;
      if (typeof p === 'string') {
        const trimmed = p.trim();
        if (trimmed) {
          result.push({
            url: trimmed,
            label: idx === 0 ? 'Antes' : 'Después',
            type: idx === 0 ? 'before' : 'after',
            date: ''
          });
        }
      } else if (typeof p === 'object') {
        if (p.url) {
          result.push({
            url: p.url,
            label: p.label || (p.type === 'before' ? 'Antes' : p.type === 'after' ? 'Después' : `Fase ${idx + 1}`),
            type: p.type || (idx === 0 ? 'before' : 'after'),
            date: p.date || ''
          });
        } else {
          if (p.before) {
            result.push({
              url: p.before,
              label: 'Antes',
              type: 'before',
              date: p.date || ''
            });
          }
          if (p.after) {
            result.push({
              url: p.after,
              label: 'Después',
              type: 'after',
              date: p.date || ''
            });
          }
        }
      }
    });
    return result;
  }

  if (typeof photos === 'object') {
    const result = [];
    if (photos.before) {
      result.push({
        url: photos.before,
        label: 'Antes',
        type: 'before',
        date: photos.date || ''
      });
    }
    if (photos.after) {
      result.push({
        url: photos.after,
        label: 'Después',
        type: 'after',
        date: photos.date || ''
      });
    }
    return result;
  }

  return [];
}

/**
 * Duración del ciclo completo (0% a 100%) según multiplicador de velocidad
 */
function getCycleDuration(speed) {
  switch (speed) {
    case 0.5:
      return 4000;
    case 2:
      return 1000;
    case 1:
    default:
      return 2000;
  }
}

/**
 * Componente LuminaMorphModal
 * Visualizador interactivo de evolución dérmica con animación en bucle,
 * controles de reproducción, scrub manual y estética Haute Esthétique / Quiet Luxury.
 */
const LuminaMorphModal = ({
  isOpen,
  onClose,
  photos = [],
  clientName = '',
  treatmentName = '',
  marketingAuthorized = false
}) => {
  // Estado de reproducción y animación
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0); // 0 a 100
  const [speed, setSpeed] = useState(1); // 0.5x, 1x, 2x
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPointerScrubbing, setIsPointerScrubbing] = useState(false);

  // Referencias para el bucle de requestAnimationFrame
  const animFrameRef = useRef(null);
  const lastTimeRef = useRef(null);
  const directionRef = useRef(1); // 1 = avance hacia Después, -1 = retroceso hacia Antes
  const pauseUntilRef = useRef(0);
  const visualizerContainerRef = useRef(null);

  // Lista normalizada de fotos disponibles
  const photoList = normalizePhotos(photos);
  const hasSufficientPhotos = photoList.length >= 2;

  // Determinar pares de fotos activas según progreso actual
  let currentBefore = photoList[0] || null;
  let currentAfter = photoList[1] || null;
  let currentOpacity = Math.max(0, Math.min(100, progress)) / 100;

  if (photoList.length > 2) {
    const totalSegments = photoList.length - 1;
    const scaled = (Math.max(0, Math.min(100, progress)) / 100) * totalSegments;
    const segmentIndex = Math.min(Math.floor(scaled), totalSegments - 1);
    const segmentAlpha = scaled - segmentIndex;
    currentBefore = photoList[segmentIndex];
    currentAfter = photoList[segmentIndex + 1];
    currentOpacity = Number(segmentAlpha.toFixed(4));
  }

  // Bucle de animación fluida con requestAnimationFrame
  useEffect(() => {
    if (!isOpen || !hasSufficientPhotos) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    lastTimeRef.current = null;

    const animateLoop = (timestamp) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = timestamp;
      }
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      if (isPlaying) {
        // Pausa elegante en los extremos (0% y 100%) para apreciar el resultado dérmico
        if (timestamp < pauseUntilRef.current) {
          animFrameRef.current = requestAnimationFrame(animateLoop);
          return;
        }

        const cycleDuration = getCycleDuration(speed);
        const change = (delta / cycleDuration) * 100 * directionRef.current;

        setProgress((prev) => {
          let next = prev + change;
          if (next >= 100) {
            next = 100;
            directionRef.current = -1;
            pauseUntilRef.current = timestamp + (900 / speed); // pausa en el Después
          } else if (next <= 0) {
            next = 0;
            directionRef.current = 1;
            pauseUntilRef.current = timestamp + (900 / speed); // pausa en el Antes
          }
          return next;
        });
      }

      animFrameRef.current = requestAnimationFrame(animateLoop);
    };

    if (isPlaying) {
      animFrameRef.current = requestAnimationFrame(animateLoop);
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isOpen, isPlaying, speed, hasSufficientPhotos]);

  // Manejo de teclado (Espacio = Play/Pause, Esc = Cerrar, Flechas = Scrub fino)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => {
          const nextState = !p;
          if (nextState) {
            lastTimeRef.current = null;
            pauseUntilRef.current = 0;
          }
          return nextState;
        });
      } else if (e.key === 'ArrowLeft') {
        setIsPlaying(false);
        setProgress((prev) => Math.max(0, prev - 5));
      } else if (e.key === 'ArrowRight') {
        setIsPlaying(false);
        setProgress((prev) => Math.min(100, prev + 5));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Control interactivo del scrub slider
  const handleSliderChange = (e) => {
    setIsPlaying(false);
    setProgress(Number(e.target.value));
  };

  // Salto rápido a 0% ("Antes") o 100% ("Después")
  const handleJumpTo = (target) => {
    setIsPlaying(false);
    setProgress(target);
    directionRef.current = target === 0 ? 1 : -1;
  };

  // Alternar reproducción
  const handleTogglePlay = () => {
    setIsPlaying((prev) => {
      const next = !prev;
      if (next) {
        lastTimeRef.current = null;
        pauseUntilRef.current = 0;
        if (progress >= 100) {
          directionRef.current = -1;
        } else if (progress <= 0) {
          directionRef.current = 1;
        }
      }
      return next;
    });
  };

  // Cambio de velocidad
  const handleSetSpeed = (newSpeed) => {
    setSpeed(newSpeed);
    pauseUntilRef.current = 0;
  };

  // Soporte para arrastre táctil / puntero directamente sobre la imagen
  const updateProgressFromPointer = useCallback((clientX) => {
    if (!visualizerContainerRef.current) return;
    const rect = visualizerContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = Math.max(0, Math.min((x / rect.width) * 100, 100));
    setProgress(percent);
  }, []);

  const handlePointerDown = (e) => {
    setIsPointerScrubbing(true);
    setIsPlaying(false);
    updateProgressFromPointer(e.clientX);
  };

  const handlePointerMove = (e) => {
    if (isPointerScrubbing) {
      updateProgressFromPointer(e.clientX);
    }
  };

  const handlePointerUp = () => {
    setIsPointerScrubbing(false);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-[#120f0d]/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lumina-morph-title"
    >
      {/* Contenedor Modal de Lujo Editorial */}
      <div 
        className={`w-full bg-[#1c1815] text-[#f7f4f0] border border-[#9c7a5b]/30 shadow-[0_25px_80px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden transition-all duration-300 ${
          isFullscreen 
            ? 'fixed inset-0 rounded-none z-50 p-4 sm:p-8' 
            : 'max-w-3xl rounded-3xl p-5 sm:p-7 max-h-[95vh]'
        }`}
      >
        {/* Cabecera Atelier con Watermark de Marca */}
        <div className="flex items-start justify-between pb-4 border-b border-white/10 gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-[#d4af37] animate-pulse" />
              <span 
                id="lumina-morph-title"
                className="text-[11px] sm:text-xs font-serif uppercase tracking-[0.22em] text-[#d4af37] font-semibold"
              >
                {MORPH_WATERMARK}
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-serif text-[#faf8f5]">
              {treatmentName ? `Evolución: ${treatmentName}` : 'Evolución Dérmica Lumina Morph™'}
            </h3>
            <p className="text-xs text-[#b8ada3] font-light flex items-center space-x-3 flex-wrap">
              <span>Paciente: <strong className="font-medium text-[#f5efe9]">{clientName || 'Expediente Confidencial'}</strong></span>
              {currentBefore?.date && <span>• Antes: {currentBefore.date}</span>}
              {currentAfter?.date && <span>• Después: {currentAfter.date}</span>}
            </p>

            <div className="pt-1">
              {marketingAuthorized ? (
                <span className="text-[10px] bg-[#537559]/20 text-[#7bb884] border border-[#537559]/40 px-2.5 py-0.5 rounded-full inline-flex items-center space-x-1">
                  <span>✓ Difusión en redes autorizada por consentimiento RGPD</span>
                </span>
              ) : (
                <span className="text-[10px] bg-[#96423b]/20 text-[#e08982] border border-[#96423b]/40 px-2.5 py-0.5 rounded-full inline-flex items-center space-x-1">
                  <span>🔒 Uso estrictamente confidencial en cabina (Redes no autorizadas)</span>
                </span>
              )}
            </div>
          </div>

          {/* Acciones de Cabecera (Pantalla Completa y Cerrar) */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="w-9 h-9 rounded-full bg-white/5 border border-white/10 text-[#c4b9af] hover:text-white hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer min-h-[44px] min-w-[44px]"
              title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/5 border border-white/10 text-[#c4b9af] hover:text-white hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer min-h-[44px] min-w-[44px]"
              title="Cerrar reproductor (Esc)"
              aria-label="Cerrar reproductor"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Cuerpo del Visualizador */}
        <div className="py-4 sm:py-5 flex-1 flex flex-col items-center justify-center overflow-y-auto">
          {!hasSufficientPhotos ? (
            <div className="w-full py-16 px-6 text-center space-y-4 bg-white/5 rounded-2xl border border-white/10">
              <Layers size={32} className="text-[#9c7a5b] mx-auto" />
              <h4 className="text-base font-serif text-[#f5efe9]">
                Fotografías Insuficientes
              </h4>
              <p className="text-xs text-[#a4998e] max-w-md mx-auto">
                Lumina Morph requiere al menos 2 fotografías (Antes y Después) para generar la transición temporal.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="btn-author text-xs py-2 px-6 mx-auto cursor-pointer"
              >
                Entendido
              </button>
            </div>
          ) : (
            <div className="w-full space-y-4">
              
              {/* Lienzo del Time-Lapse Visualizador con Soporte de Arrastre Táctil */}
              <div
                ref={visualizerContainerRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="relative w-full aspect-[4/5] sm:aspect-[4/3] max-h-[50vh] sm:max-h-[56vh] bg-[#120f0d] rounded-2xl sm:rounded-3xl overflow-hidden select-none border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.6)] touch-none cursor-ew-resize mx-auto"
              >
                {/* Capa Base: Fotografía "Antes" */}
                {currentBefore && (
                  <img
                    src={currentBefore.url}
                    alt={currentBefore.label || 'Foto Antes'}
                    className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
                    draggable={false}
                  />
                )}

                {/* Capa Superior con Opacidad Dinámica: Fotografía "Después" */}
                {currentAfter && (
                  <img
                    src={currentAfter.url}
                    alt={currentAfter.label || 'Foto Después'}
                    className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none transition-none"
                    style={{ opacity: currentOpacity }}
                    draggable={false}
                  />
                )}

                {/* Watermark de Lujo sobre la Imagen */}
                <div className="absolute top-3 left-3 sm:top-4 sm:left-4 pointer-events-none">
                  <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#1c1815]/80 backdrop-blur-md border border-[#9c7a5b]/30 shadow-sm text-white">
                    <Sparkles size={11} className="text-[#d4af37]" />
                    <span className="text-[10px] font-serif tracking-[0.16em] uppercase text-[#f5efe9]">
                      {MORPH_WATERMARK}
                    </span>
                  </div>
                </div>

                {/* Insignias de Estado y Porcentaje de Transición */}
                <div className="absolute bottom-3 inset-x-3 sm:bottom-4 sm:inset-x-4 flex items-center justify-between pointer-events-none gap-2">
                  <div className={`px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-medium backdrop-blur-md border transition-all ${
                    progress < 50 
                      ? 'bg-[#201d1a]/90 text-[#f5efe9] border-white/20 shadow-md font-semibold' 
                      : 'bg-black/40 text-white/70 border-transparent'
                  }`}>
                    <span>{currentBefore?.label || 'Antes'}</span>
                    {currentBefore?.date && <span className="ml-1 opacity-70 text-[9px]">({currentBefore.date})</span>}
                  </div>

                  <div className="px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium tracking-wider bg-black/70 text-[#f5efe9] backdrop-blur-md border border-white/10 shadow-sm">
                    <span>Evolución: <strong className="text-[#d4af37] font-semibold">{Math.round(progress)}%</strong></span>
                  </div>

                  <div className={`px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-medium backdrop-blur-md border transition-all ${
                    progress >= 50 
                      ? 'bg-[#9c7a5b]/95 text-white border-white/20 shadow-md font-semibold' 
                      : 'bg-black/40 text-white/70 border-transparent'
                  }`}>
                    <span>{currentAfter?.label || 'Después'}</span>
                    {currentAfter?.date && <span className="ml-1 opacity-70 text-[9px]">({currentAfter.date})</span>}
                  </div>
                </div>
              </div>

              {/* Barra de Herramientas de Control */}
              <div className="bg-[#161311] border border-[#9c7a5b]/25 rounded-2xl p-3.5 sm:p-4 space-y-3.5 shadow-lg">
                
                {/* Scrub Slider con Botones Rápidos de Salto */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => handleJumpTo(0)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer min-h-[36px] ${
                        progress === 0 
                          ? 'bg-[#f5efe9] text-[#201d1a] border-white font-bold shadow-xs' 
                          : 'bg-white/5 border-white/10 hover:border-[#9c7a5b]/50 text-[#c4b9af] hover:text-white'
                      }`}
                    >
                      Antes (0%)
                    </button>

                    <div className="text-center">
                      <span className="text-[11px] font-mono tracking-wider text-[#d4af37] font-semibold">
                        {Math.round(progress)}% Transición
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleJumpTo(100)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer min-h-[36px] ${
                        progress === 100 
                          ? 'bg-[#9c7a5b] text-white border-[#bfa181] font-bold shadow-xs' 
                          : 'bg-white/5 border-white/10 hover:border-[#9c7a5b]/50 text-[#c4b9af] hover:text-white'
                      }`}
                    >
                      Después (100%)
                    </button>
                  </div>

                  {/* Range Slider de Scrub */}
                  <div className="relative flex items-center pt-1">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.5"
                      value={progress}
                      onChange={handleSliderChange}
                      className="w-full h-2 bg-[#2d2824] rounded-lg appearance-none cursor-pointer accent-[#bfa181] focus:outline-none"
                      aria-label="Control deslizante de evolución dérmica"
                    />
                  </div>
                </div>

                {/* Controles de Reproducción y Selectores de Velocidad */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  
                  {/* Botón Play / Pause Toggle */}
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={handleTogglePlay}
                      className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#bfa181] to-[#9c7a5b] hover:from-[#cbb194] hover:to-[#a98767] text-[#1c1917] font-semibold text-xs transition-all shadow-md active:scale-95 cursor-pointer min-h-[44px]"
                      title={isPlaying ? 'Pausar animación' : 'Reproducir animación en bucle'}
                      aria-label={isPlaying ? 'Pausar animación' : 'Reproducir animación en bucle'}
                    >
                      {isPlaying ? (
                        <>
                          <Pause size={15} className="fill-[#1c1917]" />
                          <span>Pausar</span>
                        </>
                      ) : (
                        <>
                          <Play size={15} className="fill-[#1c1917]" />
                          <span>Reproducir</span>
                        </>
                      )}
                    </button>

                    <span className="hidden sm:inline-flex items-center space-x-1.5 text-[11px] text-[#a4998e]">
                      <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-[#537559] animate-pulse' : 'bg-[#7a7168]'}`} />
                      <span>{isPlaying ? 'Oscilación continua' : 'Pausado'}</span>
                    </span>
                  </div>

                  {/* Selector de Velocidad (0.5x, 1x, 2x) */}
                  <div className="flex items-center space-x-1 bg-[#120f0d] p-1 rounded-xl border border-white/10">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#8f857d] px-2 hidden sm:inline">
                      Velocidad:
                    </span>
                    {[0.5, 1, 2].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleSetSpeed(s)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[36px] ${
                          speed === s
                            ? 'bg-[#9c7a5b] text-white shadow-xs'
                            : 'text-[#a4998e] hover:text-white hover:bg-white/5'
                        }`}
                        aria-label={`Velocidad ${s}x`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>

                  {/* Botón de Reinicio Rápido */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setProgress(0);
                      directionRef.current = 1;
                    }}
                    className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-[#9c7a5b]/40 text-[#c4b9af] hover:text-white transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Reiniciar al inicio (0%)"
                    aria-label="Reiniciar al inicio"
                  >
                    <RotateCcw size={15} />
                  </button>

                </div>
              </div>

            </div>
          )}
        </div>

        {/* Pie de Página con Notas de Teclado y Orientación */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-[#8f857d]">
          <span className="hidden sm:inline">
            Atajos: <kbd className="px-1.5 py-0.5 bg-white/5 rounded border border-white/10 font-mono text-[10px]">Espacio</kbd> reproducir/pausar • <kbd className="px-1.5 py-0.5 bg-white/5 rounded border border-white/10 font-mono text-[10px]">← / →</kbd> deslizar fino • <kbd className="px-1.5 py-0.5 bg-white/5 rounded border border-white/10 font-mono text-[10px]">Esc</kbd> salir
          </span>
          <span className="ml-auto text-[#9c7a5b] font-serif">
            LuminaDesk Aesthetic Suite
          </span>
        </div>

      </div>
    </div>
  );
};

export default LuminaMorphModal;
