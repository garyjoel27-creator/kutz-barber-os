import React, { useState } from 'react';
import { X, ShieldAlert, Zap, Clock, UserX, CheckCircle2, MessageSquare, AlertTriangle, Users, Plus } from 'lucide-react';
import { useClients } from '../context/ClientContext';

const NoShowShieldModal = ({ isOpen, onClose }) => {
  const { clients, waitlist, addWaitlistEntry, removeWaitlistEntry, notifyFlashSlot, recordNoShow } = useClients();
  const [slotTime, setSlotTime] = useState('18:30');
  const [barberName, setBarberName] = useState('REX');
  const [notice, setNotice] = useState('');
  const [newWaitlistClient, setNewWaitlistClient] = useState({ clientName: '', phone: '', service: 'Skin Fade + Barba' });
  const [showAddWaitlist, setShowAddWaitlist] = useState(false);

  if (!isOpen) return null;

  const handleLaunchFlashSlot = (entry) => {
    notifyFlashSlot(entry, slotTime, barberName);
    setNotice(`¡Mensaje de Hueco Flash (10 min) enviado por WhatsApp a ${entry.clientName}!`);
    setTimeout(() => setNotice(''), 4000);
  };

  const handleRegisterNoShow = (clientId, clientName) => {
    if (window.confirm(`¿Confirmar falta injustificada (No-Show) de ${clientName}? Su índice de fiabilidad bajará y se le requerirá fianza o solo walk-in.`)) {
      recordNoShow(clientId);
      setNotice(`Falta registrada a ${clientName}. Puntuación de fiabilidad actualizada.`);
      setTimeout(() => setNotice(''), 4000);
    }
  };

  const handleAddWaitlist = (e) => {
    e.preventDefault();
    if (!newWaitlistClient.clientName.trim()) return;
    addWaitlistEntry(newWaitlistClient);
    setNewWaitlistClient({ clientName: '', phone: '', service: 'Skin Fade + Barba' });
    setShowAddWaitlist(false);
    setNotice('Cliente añadido a la Lista de Espera de Huecos Flash.');
    setTimeout(() => setNotice(''), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#07080B]/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="luxury-card w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 border-l-4 border-l-[#F59E0B] space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#252A36]">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-[#F59E0B] flex items-center justify-center">
              <ShieldAlert size={22} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold text-[#F59E0B] uppercase">
                  Recuperar citas perdidas
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-white uppercase tracking-tight">
                Rellenar Huecos Libres & Control de Faltas
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

        {notice && (
          <div className="p-3 bg-[#10B981]/15 border border-[#10B981] rounded-xl text-xs font-mono font-bold text-[#34D399] flex items-center justify-between animate-in fade-in">
            <span>{notice}</span>
            <CheckCircle2 size={16} />
          </div>
        )}

        {/* Sección 1: Disparador Rellena Huecos Flash (Cuando falla un cliente) */}
        <div className="luxury-card p-5 sm:p-6 bg-gradient-to-r from-[#171B24] to-[#12161E] border border-[#F59E0B]/30 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#252A36]">
            <div>
              <div className="flex items-center space-x-2">
                <Zap size={16} className="text-[#F59E0B]" />
                <h3 className="text-base font-serif font-bold text-white uppercase">
                  Rellena Huecos Flash (10 Minutos)
                </h3>
              </div>
              <p className="text-xs text-[#9CA3AF] font-mono mt-0.5">
                ¿Se canceló una cita o te queda un hueco libre hoy? Lanza un aviso prioritario por WhatsApp con cuenta atrás de 10 min.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={slotTime}
                onChange={(e) => setSlotTime(e.target.value)}
                placeholder="Hora libre (ej. 18:30)"
                className="w-24 px-2.5 py-1.5 bg-[#0E1117] border border-[#252A36] rounded-lg text-xs font-mono text-white text-center"
              />
              <select
                value={barberName}
                onChange={(e) => setBarberName(e.target.value)}
                className="px-2.5 py-1.5 bg-[#0E1117] border border-[#252A36] rounded-lg text-xs font-mono text-[#34D399]"
              >
                <option value="REX">REX</option>
                <option value="KIKO">KIKO</option>
                <option value="NICO">NICO</option>
              </select>
            </div>
          </div>

          {/* Lista de espera para huecos flash */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#9CA3AF] uppercase">LISTA DE ESPERA ACTIVA ({waitlist.length} CLIENTES):</span>
              <button
                type="button"
                onClick={() => setShowAddWaitlist(!showAddWaitlist)}
                className="text-[#10B981] hover:underline font-bold flex items-center space-x-1"
              >
                <Plus size={12} />
                <span>Añadir a Espera</span>
              </button>
            </div>

            {showAddWaitlist && (
              <form onSubmit={handleAddWaitlist} className="p-3 rounded-xl bg-[#0E1117] border border-[#252A36] flex flex-wrap gap-2 text-xs">
                <input
                  type="text"
                  placeholder="Nombre cliente..."
                  value={newWaitlistClient.clientName}
                  onChange={(e) => setNewWaitlistClient({ ...newWaitlistClient, clientName: e.target.value })}
                  className="px-3 py-1.5 bg-[#141820] border border-[#252A36] rounded-lg text-white font-mono flex-1 min-w-[120px]"
                  required
                />
                <input
                  type="tel"
                  placeholder="WhatsApp..."
                  value={newWaitlistClient.phone}
                  onChange={(e) => setNewWaitlistClient({ ...newWaitlistClient, phone: e.target.value })}
                  className="px-3 py-1.5 bg-[#141820] border border-[#252A36] rounded-lg text-white font-mono flex-1 min-w-[120px]"
                  required
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#10B981] text-[#07090C] font-mono font-bold rounded-lg uppercase"
                >
                  Guardar
                </button>
              </form>
            )}

            {waitlist.map((entry) => (
              <div
                key={entry.id}
                className="p-3.5 rounded-xl bg-[#0E1117] border border-[#252A36] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-serif font-bold text-white uppercase">{entry.clientName}</h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#10B981]/15 text-[#34D399] font-bold">
                      {entry.requestedSlot}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-[#9CA3AF] mt-0.5">
                    {entry.service} • Tel: {entry.phone} • Esperando con: {entry.preferredBarber}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleLaunchFlashSlot(entry)}
                    className="btn-author text-xs py-1.5 px-3.5 cursor-pointer uppercase"
                  >
                    <MessageSquare size={13} />
                    <span>Lanzar Hueco Flash (10 min) ⚡</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeWaitlistEntry(entry.id)}
                    className="p-1 text-[#6B7280] hover:text-rose-400"
                    title="Eliminar de lista"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sección 2: Semáforo de Fiabilidad de Clientes (Regla de 2 No-Shows) */}
        <div className="luxury-card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#252A36]">
            <div>
              <h3 className="text-base font-serif font-bold text-white uppercase">
                Auditoría de Fiabilidad de Clientes
              </h3>
              <p className="text-xs text-[#9CA3AF] font-mono mt-0.5">
                Al 2.º no-show, el sistema marca al cliente en rojo y restringe su reserva anticipada (solo puede venir sin cita o con fianza Bizum).
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {clients.map((c) => {
              const score = c.reliabilityScore !== undefined ? c.reliabilityScore : 100;
              const noShows = c.noShowCount || 0;
              const isBlocked = c.isWalkInOnly || noShows >= 2;

              let badgeColor = 'bg-[#10B981]/20 text-[#34D399] border-[#10B981]/40';
              let badgeLabel = '100% FIABLE (VIP)';
              if (noShows === 1) {
                badgeColor = 'bg-[#F59E0B]/20 text-[#FBBF24] border-[#F59E0B]/40';
                badgeLabel = '1 FALTA (AVISO)';
              } else if (isBlocked) {
                badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
                badgeLabel = '2+ FALTAS: SOLO WALK-IN';
              }

              return (
                <div
                  key={c.id}
                  className="p-3.5 rounded-xl bg-[#0E1117] border border-[#252A36] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-[#141820] border border-[#252A36] text-[#10B981] font-mono font-bold flex items-center justify-center">
                      {c.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-serif font-bold text-white uppercase">{c.name}</h4>
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${badgeColor}`}>
                          {badgeLabel}
                        </span>
                      </div>
                      <p className="text-[10px] font-mono text-[#9CA3AF]">
                        Tel: {c.phone} • Faltas registradas: <strong className="text-white">{noShows}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleRegisterNoShow(c.id, c.name)}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300 hover:bg-rose-500 hover:text-white font-mono font-bold transition-all cursor-pointer flex items-center space-x-1"
                      title="Registrar que no acudió a su cita hoy"
                    >
                      <UserX size={13} />
                      <span>Marcar No-Show</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};

export default NoShowShieldModal;
