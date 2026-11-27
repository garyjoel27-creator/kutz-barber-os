import React, { useState } from 'react';
import { X, Scissors, AlertCircle, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { useClients } from '../context/ClientContext';

const QUICK_CUT_PRESETS = [
  'Skin Fade',
  'Low Taper Fade',
  'Corte Clásico',
  'Corte + Barba',
];

const ClientModal = ({ isOpen, onClose, onSubmit }) => {
  const clientCtx = useClients();
  const activeModeConfig = clientCtx?.activeModeConfig;

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    allergies: '',
    notes: ''
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({ name: '', phone: '', email: '', allergies: '', notes: '' });
    setShowAdvanced(false);
  };

  return (
    <div className="fixed inset-0 bg-[#090B0E]/80 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#161920] rounded-3xl border border-[#262B36] shadow-[0_25px_70px_rgba(0,0,0,0.75)] w-full max-w-lg overflow-hidden my-auto">
        {/* Cabecera limpia */}
        <div className="p-5 sm:p-6 border-b border-[#262B36] flex justify-between items-start bg-[#14171D]">
          <div>
            <div className="inline-flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-[#34D399] mb-1">
              <Scissors size={14} />
              <span>Nuevo Cliente en 3 Segundos</span>
            </div>
            <h2 className="text-2xl font-serif font-bold text-white tracking-tight">
              Guardar Cliente
            </h2>
            <p className="text-sm text-[#D1D5DB] mt-0.5">
              Solo necesitas nombre y móvil. Los detalles son opcionales.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="w-9 h-9 rounded-xl bg-[#1C2029] border border-[#262B36] text-[#D1D5DB] hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          {/* 2 campos esenciales grandes y claros */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-white mb-1.5">
                1. Nombre o apodo <span className="text-[#34D399]">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 min-h-[48px] bg-[#1C2029] border border-[#262B36] rounded-xl text-base text-white placeholder-[#9CA3AF] focus:outline-none focus:border-[#10B981]"
                placeholder="Ej. Carlos Pérez"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-white mb-1.5">
                2. Teléfono WhatsApp
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 min-h-[48px] bg-[#1C2029] border border-[#262B36] rounded-xl text-base text-white placeholder-[#9CA3AF] focus:outline-none focus:border-[#10B981]"
                placeholder="Ej. 612 345 678"
              />
            </div>

            {/* Pastillas rápidas de corte habitual (1 toque, sin escribir) */}
            <div>
              <span className="block text-xs font-bold text-[#D1D5DB] mb-2">
                Corte habitual (opcional · 1 toque):
              </span>
              <div className="flex flex-wrap gap-2">
                {QUICK_CUT_PRESETS.map((cut) => {
                  const active = formData.notes === cut;
                  return (
                    <button
                      key={cut}
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, notes: active ? '' : cut })
                      }
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        active
                          ? 'bg-[#10B981] text-[#07090C] border-[#10B981]'
                          : 'bg-[#1C2029] text-[#E5E7EB] border-[#262B36] hover:border-[#10B981]/60'
                      }`}
                    >
                      {cut}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Desplegable limpio para detalles opcionales */}
          <button
            type="button"
            data-testid="toggle-client-details"
            onClick={() => setShowAdvanced((v) => !v)}
            className="w-full px-4 py-3 rounded-xl bg-[#14171D] hover:bg-[#1C2029] border border-[#262B36] text-sm font-bold text-[#D1D5DB] flex items-center justify-between cursor-pointer transition-all"
          >
            <span>
              {showAdvanced
                ? 'Ocultar detalles opcionales'
                : '+ Añadir detalles opcionales (alergias, notas, Instagram)'}
            </span>
            {showAdvanced ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {showAdvanced && (
            <div className="space-y-4 pt-1 border-t border-[#262B36]">
              <div>
                <label className="block text-sm font-semibold text-[#E5E7EB] mb-1.5">
                  Instagram o Email
                </label>
                <input
                  type="text"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#1C2029] border border-[#262B36] rounded-xl text-base text-white placeholder-[#9CA3AF] focus:outline-none focus:border-[#10B981]"
                  placeholder="@usuario o correo"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#E5E7EB] mb-1.5 flex items-center justify-between">
                  <span>{activeModeConfig?.allergyLabel || 'Piel sensible o alergias'}</span>
                  <span className="text-xs text-[#F59E0B] font-bold flex items-center gap-1">
                    <AlertCircle size={13} />
                    Aviso
                  </span>
                </label>
                <textarea
                  value={formData.allergies}
                  onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#1C2029] border border-[#262B36] rounded-xl text-base text-white placeholder-[#9CA3AF] focus:outline-none focus:border-[#10B981] h-20 resize-none"
                  placeholder={activeModeConfig?.allergyPlaceholder || 'Ej. Piel sensible en cuello al pasar shaver...'}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#E5E7EB] mb-1.5">
                  {activeModeConfig?.notesLabel || 'Notas del corte (números, remolinos, producto)'}
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#1C2029] border border-[#262B36] rounded-xl text-base text-white placeholder-[#9CA3AF] focus:outline-none focus:border-[#10B981] h-20 resize-none"
                  placeholder={activeModeConfig?.notesPlaceholder || 'Ej. Degradado al 0, remolino atrás derecha...'}
                />
              </div>
            </div>
          )}

          {/* Información Básica RGPD - 1ª Capa legible */}
          <div className="bg-[#14171D] border border-[#262B36] rounded-2xl p-3.5 text-xs text-[#D1D5DB] leading-relaxed">
            <p className="font-bold text-[#34D399] mb-1">
              Protección de Datos (RGPD)
            </p>
            <p>
              <strong className="text-white">Finalidad:</strong> Gestión de ficha de corte y avisos de retoque. Después podrás recoger su firma RGPD en pantalla.
            </p>
          </div>

          {/* Footer Acciones */}
          <div className="pt-2 flex items-center justify-end space-x-3 border-t border-[#262B36]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 text-sm font-bold text-[#D1D5DB] hover:text-white hover:bg-[#1C2029] rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-author text-sm py-3 px-6 flex items-center gap-2 cursor-pointer"
            >
              <Check size={17} />
              <span>Guardar Cliente</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClientModal;
