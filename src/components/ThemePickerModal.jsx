import React from 'react';
import { X, Palette, Check, Sparkles } from 'lucide-react';
import { BARBER_THEMES } from '../lib/shopUtils';
import { useShop } from '../context/ShopContext';
import { soundFx } from '../lib/soundFx';

const ThemePickerModal = ({ isOpen, onClose }) => {
  const { activeThemeId, setShopTheme, activeShop } = useShop();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div
        data-testid="theme-picker-modal"
        className="w-full max-w-md bg-[#101318] border border-[#252A36] rounded-3xl overflow-hidden shadow-2xl my-auto"
      >
        <div className="px-5 py-4 bg-[#141820] border-b border-[#252A36] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-serif font-black text-white flex items-center gap-2">
              <Palette size={18} className="text-[#10B981]" />
              <span>Estilo y Colores</span>
            </h2>
            <p className="text-xs text-[#D1D5DB] mt-0.5">
              Personaliza {activeShop?.name || 'tu barbería'} en 1 toque
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar selector de estilo"
            className="p-2 rounded-xl bg-[#1B202B] text-[#D1D5DB] hover:text-white cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-2.5">
          {BARBER_THEMES.map((theme) => {
            const isSelected = activeThemeId === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                data-testid={`theme-option-${theme.id}`}
                onClick={() => {
                  soundFx.playClick();
                  setShopTheme(theme.id);
                }}
                className={`w-full p-3.5 rounded-2xl border-2 text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#10B981]/15 border-[#10B981] shadow-sm'
                    : 'bg-[#141820] border-[#252A36] hover:border-[#10B981]/60'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex -space-x-1.5 shrink-0">
                    {theme.swatches.map((hex, i) => (
                      <span
                        key={i}
                        className="w-6 h-6 rounded-full border-2 border-[#0A0C0F] shadow-sm"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-white block truncate">
                      {theme.name}
                    </span>
                    <span className="text-xs text-[#D1D5DB] block truncate">
                      {theme.tagline}
                    </span>
                  </div>
                </div>
                {isSelected && (
                  <span className="w-7 h-7 rounded-full bg-[#10B981] text-[#07090C] flex items-center justify-center shrink-0">
                    <Check size={15} />
                  </span>
                )}
              </button>
            );
          })}

          <div className="mt-3 p-3 rounded-xl bg-[#141820] border border-[#252A36] text-xs text-[#D1D5DB] flex items-start gap-2">
            <Sparkles size={15} className="text-[#34D399] shrink-0 mt-0.5" />
            <span>
              El estilo elegido se guarda para esta barbería y se aplica también en el portal de reservas de tus clientes.
            </span>
          </div>
        </div>

        <div className="px-5 py-3.5 bg-[#141820] border-t border-[#252A36]">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-[#10B981] hover:bg-[#34D399] text-[#07090C] text-sm font-black uppercase cursor-pointer"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThemePickerModal;
