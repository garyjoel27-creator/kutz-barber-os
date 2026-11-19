import React, { useState } from 'react';
import { X, Scissors, AlertCircle } from 'lucide-react';
import { useClients } from '../context/ClientContext';

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

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({ name: '', phone: '', email: '', allergies: '', notes: '' });
  };

  return (
    <div className="fixed inset-0 bg-[#090B0E]/80 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-300">
      <div className="bg-[#161920] rounded-3xl border border-[#262B36] shadow-[0_25px_70px_rgba(0,0,0,0.75)] w-full max-w-lg overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        
        {/* Header Modal */}
        <div className="p-6 sm:p-7 border-b border-[#262B36] flex justify-between items-start bg-[#14171D]">
          <div>
            <div className="inline-flex items-center space-x-1.5 text-[10px] font-mono font-bold tracking-[0.2em] uppercase text-[#10B981] mb-1">
              <Scissors size={13} />
              <span>NUEVA FICHA BARBER // CREW</span>
            </div>
            <h2 className="text-2xl font-serif font-bold text-white tracking-tight">
              Alta de Nuevo Cliente
            </h2>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              Registra sus datos, morfología craneal, remolinos y sensibilidades al afeitado.
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-xl bg-[#1C2029] border border-[#262B36] text-[#9CA3AF] hover:text-white hover:border-[#10B981]/40 flex items-center justify-center transition-all cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-6">
          {/* Datos de Contacto */}
          <div className="space-y-4">
            <h3 className="text-[11px] font-mono font-bold tracking-[0.2em] uppercase text-[#10B981]">
              Datos del Cliente
            </h3>
            
            <div>
              <label className="block text-xs font-medium text-[#D1D5DB] mb-1.5">
                Nombre / Apodo <span className="text-[#10B981]">*</span>
              </label>
              <input 
                type="text" 
                required 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                className="w-full px-4 py-3 bg-[#1C2029] border border-[#262B36] rounded-xl text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 transition-all" 
                placeholder="Ej. Marcos 'El Rulo' Mendoza" 
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-[#D1D5DB] mb-1.5">Teléfono (WhatsApp)</label>
                <input 
                  type="tel" 
                  value={formData.phone} 
                  onChange={e => setFormData({...formData, phone: e.target.value})} 
                  className="w-full px-4 py-3 bg-[#1C2029] border border-[#262B36] rounded-xl text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 transition-all" 
                  placeholder="+34 612 345 678" 
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#D1D5DB] mb-1.5">Instagram / Email</label>
                <input 
                  type="text" 
                  value={formData.email} 
                  onChange={e => setFormData({...formData, email: e.target.value})} 
                  className="w-full px-4 py-3 bg-[#1C2029] border border-[#262B36] rounded-xl text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 transition-all" 
                  placeholder="@marcos.kutz o email" 
                />
              </div>
            </div>
          </div>

          <div className="border-t border-[#262B36] pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-mono font-bold tracking-[0.2em] uppercase text-[#10B981]">
                Diagnóstico de Piel, Cráneo & Remolinos
              </h3>
              <span className="text-[10px] font-mono text-[#9CA3AF]">Notas de Sillón</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#D1D5DB] mb-1.5 flex items-center justify-between">
                <span>{activeModeConfig?.allergyLabel || 'Sensibilidad en Piel (Shaver, Navaja o Tinte)'}</span>
                <span className="text-[10px] text-[#F59E0B] font-mono flex items-center">
                  <AlertCircle size={11} className="mr-1" />
                  Aviso al barbero
                </span>
              </label>
              <textarea 
                value={formData.allergies} 
                onChange={e => setFormData({...formData, allergies: e.target.value})} 
                className="w-full px-4 py-2.5 bg-[#1C2029] border border-[#262B36] rounded-xl text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 transition-all h-20 resize-none" 
                placeholder={activeModeConfig?.allergyPlaceholder || 'Ej. Piel sensible en cuello al pasar Shaver, foliculitis en nuca, usar bálsamo sin alcohol...'}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#D1D5DB] mb-1.5">
                {activeModeConfig?.notesLabel || 'Morfología Craneal, Remolinos & Producto de Styling'}
              </label>
              <textarea 
                value={formData.notes} 
                onChange={e => setFormData({...formData, notes: e.target.value})} 
                className="w-full px-4 py-2.5 bg-[#1C2029] border border-[#262B36] rounded-xl text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 transition-all h-20 resize-none" 
                placeholder={activeModeConfig?.notesPlaceholder || 'Ej. Remolino fuerte en coronilla derecha. Usa Polvos Mate. Café solo con hielo...'}
              />
            </div>
          </div>

          {/* Información Básica RGPD - 1ª Capa */}
          <div className="bg-[#14171D] border border-[#262B36] rounded-2xl p-3.5 text-[10px] text-[#9CA3AF] leading-relaxed">
            <p className="font-mono font-bold uppercase tracking-wider text-[#34D399] mb-1">
              Protección de Datos & Derechos de Imagen (RGPD // KUTZ BARBER OS)
            </p>
            <p>
              <strong className="text-white">Responsable:</strong> KUTZ // BARBER STUDIO. <strong className="text-white">Finalidad:</strong> Gestión de ficha de corte, avisos de retoque por WhatsApp y autorización de imagen para Reels/TikTok. Tras crear la ficha, el cliente podrá firmar con el dedo en pantalla.
            </p>
          </div>

          {/* Footer Acciones */}
          <div className="pt-4 flex items-center justify-end space-x-3 border-t border-[#262B36]">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-5 py-2.5 text-xs font-mono font-semibold text-[#9CA3AF] hover:text-white hover:bg-[#1C2029] rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="btn-author text-xs py-2.5 px-6 cursor-pointer"
            >
              Crear Ficha de Cliente
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClientModal;
