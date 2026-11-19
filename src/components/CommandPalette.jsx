import React, { useState, useEffect, useCallback } from 'react';
import { Search, Scissors, Tv, ShieldAlert, Sparkles, User, ArrowRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useClients, normalizeText as contextNormalizeText } from '../context/ClientContext';
import { soundFx } from '../lib/soundFx';

// Fallback robusto para normalización de diacríticos NFD
const normalizeText = (text) => {
  if (typeof contextNormalizeText === 'function') {
    return contextNormalizeText(text);
  }
  if (!text) return '';
  return String(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
};

const CommandPalette = ({ isOpen, onClose, onOpenKiosk, onOpenNoShow, onOpenReel }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { clients } = useClients();

  const handleClose = useCallback(() => {
    soundFx.playClick();
    soundFx.triggerHaptic(10);
    onClose();
  }, [onClose]);

  // Escuchar atajo de teclado Ctrl+K o Cmd+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) handleClose();
      }
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const quickCommands = [
    {
      id: 'demo',
      title: 'Abrir Ficha de Álex Rivera',
      subtitle: 'Fade #000 • Bono VIP • Fotos Antes/Después',
      icon: Scissors,
      action: () => {
        soundFx.playClick();
        soundFx.triggerHaptic(10);
        navigate('/clients/3');
        onClose();
      }
    },
    {
      id: 'kiosk',
      title: 'Poner Pantalla TV (Sala de Espera)',
      subtitle: 'Turnos en grande y aviso por WhatsApp',
      icon: Tv,
      action: () => {
        soundFx.playClick();
        soundFx.triggerHaptic(10);
        onClose();
        if (onOpenKiosk) onOpenKiosk();
      }
    },
    {
      id: 'noshow',
      title: 'Rellenar Huecos Libres / Faltas',
      subtitle: 'Avisar rápido por WhatsApp si alguien cancela',
      icon: ShieldAlert,
      action: () => {
        soundFx.playClick();
        soundFx.triggerHaptic(10);
        onClose();
        if (onOpenNoShow) onOpenNoShow();
      }
    },
    {
      id: 'reel',
      title: 'Crear Reel para Instagram o TikTok',
      subtitle: 'Vídeo vertical del antes y después en 1 toque',
      icon: Sparkles,
      action: () => {
        soundFx.playClick();
        soundFx.triggerHaptic(10);
        onClose();
        if (onOpenReel) onOpenReel();
      }
    }
  ];

  const normQuery = normalizeText(query);

  const filteredCommands = quickCommands.filter(cmd => {
    if (!normQuery) return true;
    const title = normalizeText(cmd.title || '');
    const subtitle = normalizeText(cmd.subtitle || '');
    return title.includes(normQuery) || subtitle.includes(normQuery);
  });

  const matchedClients = clients.filter(c => {
    if (!normQuery) return false;
    const name = normalizeText(c.name || '');
    const phone = (c.phone || '').toString().toLowerCase();
    const formula = normalizeText(c.treatments?.[0]?.formula || '');
    return name.includes(normQuery) || phone.includes(normQuery) || formula.includes(normQuery);
  });

  return (
    <div 
      onClick={handleClose}
      className="fixed inset-0 z-50 bg-[#07080B]/80 backdrop-blur-sm flex items-start justify-center pt-20 p-4"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          willChange: 'transform, opacity',
          transformStyle: 'preserve-3d',
          WebkitBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden'
        }}
        className="luxury-card w-full max-w-xl p-4 sm:p-5 border border-[#10B981]/50 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-200"
      >
        
        {/* Input de Búsqueda */}
        <div className="relative flex items-center border-b border-[#252A36] pb-3">
          <Search size={18} className="text-[#10B981] mr-3 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente, acción rápida o comando..."
            className="w-full bg-transparent text-sm text-white font-mono placeholder-[#6B7280] focus:outline-none min-h-[44px]"
          />
          <button
            type="button"
            onClick={handleClose}
            className="p-2 min-h-[44px] min-w-[44px] rounded-xl bg-[#141820] text-[#9CA3AF] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
            title="Cerrar (Esc)"
          >
            <X size={15} />
          </button>
        </div>

        {/* Lista de Comandos */}
        <div className="mt-3 space-y-1 max-h-[360px] overflow-y-auto">
          {filteredCommands.length > 0 && (
            <>
              <div className="px-2 py-1 text-[10px] font-mono font-bold text-[#6B7280] uppercase tracking-wider">
                HERRAMIENTAS KUTZ OS {filteredCommands.length < quickCommands.length && `(${filteredCommands.length})`}
              </div>
              {filteredCommands.map((cmd) => {
                const Icon = cmd.icon;
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    onClick={cmd.action}
                    className="w-full p-2.5 min-h-[44px] rounded-xl hover:bg-[#1B202B] flex items-center justify-between text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-[#141820] border border-[#252A36] text-[#10B981] group-hover:border-[#10B981] flex items-center justify-center shrink-0">
                        <Icon size={15} />
                      </div>
                      <div>
                        <h4 className="text-xs font-serif font-bold text-white group-hover:text-[#34D399] uppercase">
                          {cmd.title}
                        </h4>
                        <p className="text-[10px] font-mono text-[#9CA3AF]">{cmd.subtitle}</p>
                      </div>
                    </div>
                    <ArrowRight size={13} className="text-[#6B7280] group-hover:text-[#10B981] group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </button>
                );
              })}
            </>
          )}

          {/* Clientes filtrados con normalización diacrítica */}
          {matchedClients.length > 0 && (
            <div className="pt-2">
              <div className="px-2 py-1 text-[10px] font-mono font-bold text-[#6B7280] uppercase tracking-wider">
                CLIENTES ENCONTRADOS ({matchedClients.length})
              </div>
              {matchedClients.slice(0, 4).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    soundFx.triggerHaptic(10);
                    navigate(`/clients/${c.id}`);
                    onClose();
                  }}
                  className="w-full p-2.5 min-h-[44px] rounded-xl hover:bg-[#1B202B] flex items-center justify-between text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-lg bg-[#10B981]/15 text-[#10B981] font-mono font-bold text-xs flex items-center justify-center shrink-0">
                      <User size={13} />
                    </div>
                    <div>
                      <h4 className="text-xs font-serif font-bold text-white uppercase">{c.name}</h4>
                      <p className="text-[10px] font-mono text-[#9CA3AF]">{c.phone || 'Sin teléfono'}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-[#34D399] shrink-0">Abrir Ficha →</span>
                </button>
              ))}
            </div>
          )}

          {normQuery && filteredCommands.length === 0 && matchedClients.length === 0 && (
            <div className="py-8 text-center text-xs font-mono text-[#6B7280]">
              No se encontraron herramientas ni clientes para "{query}"
            </div>
          )}
        </div>

        <div className="mt-3 pt-2 border-t border-[#252A36] flex items-center justify-between text-[10px] font-mono text-[#6B7280]">
          <span>ATAJO: ESC PARA SALIR</span>
          <span>KUTZ COMMAND // V3.0</span>
        </div>

      </div>
    </div>
  );
};

export default CommandPalette;
