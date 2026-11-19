import React, { useState, useEffect } from 'react';
import { X, Play, Pause, Share2, ShieldCheck, ShieldAlert, Sparkles, Download, Volume2, VolumeX, Scissors } from 'lucide-react';

const ReelStudioModal = ({ isOpen, onClose, client, treatment }) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentPhase, setCurrentPhase] = useState(0); // 0: Antes, 1: Transición, 2: Después
  const [isMuted, setIsMuted] = useState(true);
  const [shareNotice, setShareNotice] = useState('');

  // Encontrar fotos de antes y después
  const beforePhoto = treatment?.photos?.before || client?.treatments?.find(t => t.photos?.before)?.photos?.before || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=800';
  const afterPhoto = treatment?.photos?.after || client?.treatments?.find(t => t.photos?.after)?.photos?.after || 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=800';
  const recipeFormula = treatment?.formula || client?.treatments?.[0]?.formula || '#000 Shaver → #0.5 → #1.5 Skin Fade';
  const treatmentName = treatment?.name || client?.treatments?.[0]?.name || 'Skin Fade + Barba a Navaja';
  const isConsentSigned = client?.consent?.signed;

  // Temporizador para simular reproducción continua de Reel 9:16
  useEffect(() => {
    if (!isOpen || !isPlaying) return;
    const interval = setInterval(() => {
      setCurrentPhase(prev => (prev + 1) % 3);
    }, 2400);
    return () => clearInterval(interval);
  }, [isOpen, isPlaying]);

  if (!isOpen) return null;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `KUTZ // Reel Antes y Después: ${client?.name || 'Cliente'}`,
          text: `Evolución Skin Fade en KUTZ Studio. Receta: ${recipeFormula}`,
          url: window.location.href
        });
        setShareNotice('¡Enlace del Reel compartido!');
      } catch {
        // Cancelado
      }
    } else {
      navigator.clipboard.writeText(`Lookbook KUTZ // ${client?.name}: ${recipeFormula} — ${window.location.href}`);
      setShareNotice('Enlace del Reel copiado al portapapeles');
    }
    setTimeout(() => setShareNotice(''), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#07080B]/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="luxury-card w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 sm:p-7 border border-[#10B981]/50 space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#252A36]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#10B981] text-[#07090C] flex items-center justify-center shadow-[3px_3px_0px_#065F46]">
              <Sparkles size={20} strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-[#10B981] uppercase">
                  REEL STUDIO // 9:16 SOCIAL GENERATOR
                </span>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#10B981]/20 text-[#34D399] border border-[#10B981]/40">
                  INSTAGRAM & TIKTOK
                </span>
              </div>
              <h2 className="text-xl font-serif font-bold text-white uppercase tracking-tight">
                GENERADOR DE VÍDEO VERTICAL (ANTES / DESPUÉS)
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-[#141820] border border-[#252A36] text-[#9CA3AF] hover:text-white transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {shareNotice && (
          <div className="p-3 bg-[#10B981]/15 border border-[#10B981] rounded-xl text-xs font-mono font-bold text-[#34D399] animate-in fade-in">
            {shareNotice}
          </div>
        )}

        {/* Verificación de Consentimiento RGPD para Redes Sociales */}
        <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-mono ${
          isConsentSigned
            ? 'bg-[#10B981]/10 border-[#10B981]/40 text-[#34D399]'
            : 'bg-[#F59E0B]/15 border-[#F59E0B]/40 text-[#FBBF24]'
        }`}>
          <div className="flex items-center space-x-2.5">
            {isConsentSigned ? <ShieldCheck size={18} className="text-[#10B981]" /> : <ShieldAlert size={18} className="text-[#FBBF24]" />}
            <div>
              <span className="font-bold uppercase block">
                {isConsentSigned ? '✓ AUTORIZACIÓN LEGAL VERIFICADA (RGPD Art. 9)' : '⚠️ FIRMA DE CESIÓN DE IMAGEN PENDIENTE'}
              </span>
              <span className="text-[10px] text-[#9CA3AF]">
                {isConsentSigned
                  ? `El cliente ${client?.name} ha firmado digitalmente la cesión de imagen para Instagram Reels y TikTok.`
                  : 'Recuerda solicitar la firma digital en la pestaña RGPD antes de difundir en redes públicas.'}
              </span>
            </div>
          </div>
        </div>

        {/* Contenedor del Móvil en Formato 9:16 */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
          
          {/* Frame 9:16 tipo pantalla de smartphone */}
          <div className="w-[280px] h-[490px] rounded-3xl bg-[#0A0C0F] border-4 border-[#252A36] relative overflow-hidden shadow-2xl flex flex-col justify-between p-4">
            
            {/* Foto de fondo interactiva según la fase */}
            <div className="absolute inset-0">
              <img
                src={currentPhase === 0 ? beforePhoto : afterPhoto}
                alt="Reel frame"
                className={`w-full h-full object-cover transition-opacity duration-700 ${
                  currentPhase === 1 ? 'opacity-70 scale-105' : 'opacity-100 scale-100'
                }`}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-[#07090C]/80 via-transparent to-[#07090C]/90"></div>
            </div>

            {/* Overlays del Reel */}
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-white uppercase border border-white/20">
                  {currentPhase === 0 ? '01 // EL ANTES' : (currentPhase === 1 ? '02 // PROCESO' : '03 // EL RESULTADO')}
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold text-white/80 bg-black/50 px-2 py-0.5 rounded">
                KUTZ® 9:16
              </span>
            </div>

            {/* Centro: Efecto de barrido / morph */}
            {currentPhase === 1 && (
              <div className="relative z-10 text-center animate-pulse">
                <span className="text-xs font-mono font-extrabold px-3 py-1 rounded bg-[#10B981] text-[#07090C] uppercase tracking-wider">
                  ⚡ TRANSFORMACIÓN EN SILLÓN ⚡
                </span>
              </div>
            )}

            {/* Parte inferior del Reel: Título, Receta de Peines y Marca */}
            <div className="relative z-10 space-y-2">
              <div className="p-3 rounded-xl bg-black/75 backdrop-blur-md border border-white/10 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-serif font-bold text-white uppercase">{treatmentName}</h4>
                  <span className="text-[9px] font-mono text-[#10B981] font-bold">@kutzbarber</span>
                </div>
                <p className="text-[10px] font-mono text-[#34D399] truncate">
                  ⚡ {recipeFormula}
                </p>
                <div className="flex items-center justify-between text-[9px] font-mono text-[#9CA3AF] pt-1 border-t border-white/10">
                  <span>CLIENTE: {client?.name}</span>
                  <span>BARBER: REX</span>
                </div>
              </div>
            </div>
          </div>

          {/* Controles de reproducción y edición */}
          <div className="space-y-4 w-full sm:w-64 text-xs font-mono">
            <div>
              <span className="text-[#9CA3AF] uppercase text-[10px] block mb-2 font-bold">FASE DEL REEL:</span>
              <div className="grid grid-cols-3 gap-1.5">
                {['Antes', 'Corte', 'Resultado'].map((label, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setCurrentPhase(idx);
                      setIsPlaying(false);
                    }}
                    className={`py-2 px-1 rounded-lg text-center font-bold uppercase transition-all cursor-pointer border ${
                      currentPhase === idx
                        ? 'bg-[#10B981] text-[#07090C] border-[#34D399]'
                        : 'bg-[#141820] text-[#9CA3AF] border-[#252A36] hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="btn-author-secondary flex-1 py-2.5 cursor-pointer"
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                <span>{isPlaying ? 'Pausar' : 'Reproducir'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className="p-2.5 rounded-xl bg-[#141820] border border-[#252A36] text-[#D1D5DB] hover:text-white cursor-pointer"
                title={isMuted ? 'Activar ritmo' : 'Silenciar'}
              >
                {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} className="text-[#10B981]" />}
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0E1117] border border-[#252A36] space-y-2 text-[11px] text-[#9CA3AF]">
              <span className="text-[#10B981] font-bold block uppercase">FÓRMULA GANADORA REELS:</span>
              <p>• 0-2s: Gancho con el estado inicial.</p>
              <p>• 2-4s: Ritmo dinámico de máquina.</p>
              <p>• 4-6s: Revelado HD con peines en texto.</p>
            </div>

            <button
              type="button"
              onClick={handleShare}
              className="btn-author w-full py-3 cursor-pointer uppercase flex items-center justify-center space-x-2"
            >
              <Share2 size={15} />
              <span>Publicar en Instagram / TikTok ⚡</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

export default ReelStudioModal;
