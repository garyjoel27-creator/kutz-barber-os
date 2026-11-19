import React, { useState, useEffect } from 'react';
import { X, Tv, Plus, Users, Scissors, MessageSquare, CheckCircle2, Maximize2, Minimize2 } from 'lucide-react';
import { useClients } from '../context/ClientContext';
import { soundFx } from '../lib/soundFx';

const WalkInKioskModal = ({ isOpen, onClose }) => {
  const { walkInQueue, addWalkIn, removeWalkIn, notifyWalkInWhatsApp } = useClients();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newEntry, setNewEntry] = useState({
    name: '',
    phone: '',
    service: 'Corte Skin Fade Express (30m)',
    barber: 'Cualquiera',
    waitMinutes: 20
  });
  const [notificationMsg, setNotificationMsg] = useState('');

  // Sincronizar reloj para modo TV
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleClose = () => {
    soundFx.playClick();
    soundFx.triggerHaptic(10);
    onClose();
  };

  if (!isOpen) return null;

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!newEntry.name.trim()) return;
    soundFx.playClick();
    soundFx.triggerHaptic(10);
    addWalkIn(newEntry);
    setNewEntry({
      name: '',
      phone: '',
      service: 'Corte Skin Fade Express (30m)',
      barber: 'Cualquiera',
      waitMinutes: 20
    });
    setIsAdding(false);
    setNotificationMsg('¡Cliente añadido a la Cola Viva!');
    setTimeout(() => setNotificationMsg(''), 3000);
  };

  const handleNotify = (queueId) => {
    soundFx.playClick();
    soundFx.triggerHaptic(10);
    notifyWalkInWhatsApp(queueId);
    setNotificationMsg('Mensaje de aviso enviado por WhatsApp.');
    setTimeout(() => setNotificationMsg(''), 3500);
  };

  const toggleFullscreen = () => {
    soundFx.playClick();
    soundFx.triggerHaptic(10);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const nextClient = walkInQueue[0];

  return (
    <div 
      style={{
        willChange: 'transform, opacity',
        transformStyle: 'preserve-3d',
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden'
      }}
      className={`fixed inset-0 z-50 bg-[#07080B]/95 backdrop-blur-md flex flex-col justify-between overflow-y-auto animate-in fade-in zoom-in-95 duration-200 ${isFullscreen ? 'p-6 sm:p-10' : 'p-4 sm:p-6'}`}
    >
      
      {/* Barra superior de control */}
      <div className="flex items-center justify-between pb-4 border-b border-[#252A36]">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#10B981] text-[#07090C] flex items-center justify-center shadow-[3px_3px_0px_#065F46]">
            <Tv size={20} strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-[#10B981] uppercase">
                TERMINAL KIOSKO // MODO TV
              </span>
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping"></span>
            </div>
            <h1 className="text-xl sm:text-2xl font-serif font-bold text-white uppercase tracking-tight">
              COLA VIVA DE WALK-INS & ESPERA EN SILLÓN
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-right hidden sm:block">
            <span className="text-2xl font-mono font-bold text-white tracking-tight">{currentTime}</span>
            <span className="text-[10px] font-mono text-[#34D399] block uppercase">Estudio en Directo</span>
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-[#141820] border border-[#252A36] text-[#D1D5DB] hover:text-white hover:border-[#10B981] transition-all cursor-pointer"
            title="Pantalla Completa TV"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="p-2.5 min-h-[44px] min-w-[44px] rounded-xl bg-[#141820] border border-[#252A36] text-[#9CA3AF] hover:text-white hover:border-rose-500 transition-all cursor-pointer flex items-center justify-center"
            title="Cerrar Kiosko"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {notificationMsg && (
        <div className="my-2 p-3 bg-[#10B981]/15 border border-[#10B981] rounded-xl text-xs font-mono font-bold text-[#34D399] flex items-center justify-between animate-in fade-in">
          <span>{notificationMsg}</span>
          <CheckCircle2 size={16} />
        </div>
      )}

      {/* Pantalla Gigante Central Estilo Kiosko / Cartel de Aeropuerto */}
      <div className="my-6 grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 items-stretch">
        
        {/* Banner Gigante: Turno Siguiente (Para proyectar en TV del local) */}
        <div className="lg:col-span-2 luxury-card p-6 sm:p-8 flex flex-col justify-between border-l-4 border-l-[#10B981] bg-gradient-to-br from-[#12161F] via-[#0E1117] to-[#0A0C0F]">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[#252A36]">
              <span className="text-xs font-mono font-extrabold text-[#10B981] tracking-[0.25em] uppercase">
                ⚡ EN SILLÓN AHORA / TURNO INMEDIATO
              </span>
              <span className="text-xs font-mono px-3 py-1 rounded bg-[#10B981]/20 text-[#34D399] font-bold border border-[#10B981]/40">
                PUESTO ASIGNADO
              </span>
            </div>

            {nextClient ? (
              <div className="my-6 space-y-4">
                <span className="text-sm font-mono text-[#9CA3AF] uppercase">SIGUIENTE CLIENTE LLAMADO:</span>
                <div className="text-4xl sm:text-6xl font-serif font-extrabold text-white tracking-tight uppercase leading-none drop-shadow-md">
                  {nextClient.name}
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <span className="px-3.5 py-1.5 rounded-lg bg-[#141820] border border-[#252A36] text-sm font-mono font-bold text-[#34D399]">
                    💈 {nextClient.service}
                  </span>
                  <span className="px-3.5 py-1.5 rounded-lg bg-[#141820] border border-[#252A36] text-sm font-mono font-bold text-white">
                    SILLÓN: {nextClient.barber}
                  </span>
                  <span className="px-3.5 py-1.5 rounded-lg bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-sm font-mono font-bold text-[#FBBF24]">
                    ⏱️ ESPERA ESTIMADA: ~{nextClient.waitMinutes} MIN
                  </span>
                </div>
              </div>
            ) : (
              <div className="my-12 text-center space-y-3">
                <Scissors size={40} className="mx-auto text-[#10B981]" />
                <h3 className="text-2xl font-serif font-bold text-white uppercase">Sillones Disponibles</h3>
                <p className="text-xs text-[#9CA3AF] font-mono">No hay clientes en espera. Los walk-ins pasan de inmediato.</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#252A36] flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs font-mono text-[#9CA3AF]">
              TOTAL EN COLA: <strong className="text-white">{walkInQueue.length} personas</strong>
            </span>
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {nextClient && (
                <>
                  <button
                    type="button"
                    onClick={() => handleNotify(nextClient.id)}
                    className="btn-author-secondary text-xs py-2 px-3.5 flex-1 sm:flex-none cursor-pointer"
                  >
                    <MessageSquare size={14} className="text-[#10B981]" />
                    <span>Avisar WhatsApp ⚡</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeWalkIn(nextClient.id)}
                    className="btn-author text-xs py-2 px-4 flex-1 sm:flex-none cursor-pointer"
                  >
                    <span>Pasar al Sillón ✓</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Panel Lateral: Lista de Espera + Check-In Rápido */}
        <div className="luxury-card p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#252A36]">
              <h3 className="text-sm font-serif font-bold text-white uppercase flex items-center">
                <Users size={16} className="mr-2 text-[#10B981]" />
                Cola de Turnos ({walkInQueue.length})
              </h3>
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  soundFx.triggerHaptic(10);
                  setIsAdding(!isAdding);
                }}
                className="text-xs font-mono font-bold px-2.5 py-1 min-h-[36px] sm:min-h-0 rounded bg-[#10B981] text-[#07090C] hover:bg-[#34D399] transition-all cursor-pointer flex items-center space-x-1 uppercase"
              >
                <Plus size={12} />
                <span>{isAdding ? 'Cerrar' : '+ Anotar'}</span>
              </button>
            </div>

            {/* Formulario Rápido de Entrada */}
            {isAdding && (
              <form onSubmit={handleAddSubmit} className="my-3 p-3.5 rounded-xl bg-[#0E1117] border border-[#10B981]/50 space-y-2.5 text-xs animate-in fade-in">
                <span className="text-[10px] font-mono font-bold text-[#10B981] uppercase block">Añadir Walk-in al Kiosko:</span>
                <input
                  type="text"
                  placeholder="Nombre o Apodo..."
                  value={newEntry.name}
                  onChange={(e) => setNewEntry({ ...newEntry, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#141820] border border-[#252A36] rounded-lg text-white font-mono text-xs focus:outline-none focus:border-[#10B981]"
                  required
                />
                <input
                  type="tel"
                  placeholder="WhatsApp (+34 600...)"
                  value={newEntry.phone}
                  onChange={(e) => setNewEntry({ ...newEntry, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-[#141820] border border-[#252A36] rounded-lg text-white font-mono text-xs focus:outline-none focus:border-[#10B981]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newEntry.barber}
                    onChange={(e) => setNewEntry({ ...newEntry, barber: e.target.value })}
                    className="px-2 py-2 bg-[#141820] border border-[#252A36] rounded-lg text-white font-mono text-xs"
                  >
                    <option value="Cualquiera">Cualquier Barber</option>
                    <option value="REX">REX (Fade Master)</option>
                    <option value="KIKO">KIKO</option>
                    <option value="NICO">NICO</option>
                  </select>
                  <select
                    value={newEntry.waitMinutes}
                    onChange={(e) => setNewEntry({ ...newEntry, waitMinutes: Number(e.target.value) })}
                    className="px-2 py-2 bg-[#141820] border border-[#252A36] rounded-lg text-white font-mono text-xs"
                  >
                    <option value="15">~15 min</option>
                    <option value="25">~25 min</option>
                    <option value="35">~35 min</option>
                    <option value="45">~45 min</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-[#10B981] text-[#07090C] font-mono font-bold rounded-lg uppercase cursor-pointer"
                >
                  Registrar en Turno
                </button>
              </form>
            )}

            {/* Listado de clientes en espera */}
            <div className="mt-3 space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
              {walkInQueue.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-[#0E1117] border border-[#252A36] flex items-center justify-between text-xs group"
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-6 h-6 rounded-md bg-[#141820] border border-[#252A36] text-[10px] font-mono font-bold text-[#10B981] flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <h4 className="font-serif font-bold text-white uppercase">{item.name}</h4>
                      <p className="text-[10px] font-mono text-[#9CA3AF]">
                        {item.service} • <span className="text-[#34D399]">{item.barber}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-mono text-[#FBBF24] font-bold">
                      {item.waitMinutes}m
                    </span>
                    <button
                      type="button"
                      onClick={() => handleNotify(item.id)}
                      className="p-1.5 text-[#9CA3AF] hover:text-[#10B981] cursor-pointer"
                      title="Avisar por WhatsApp"
                    >
                      <MessageSquare size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        soundFx.triggerHaptic(10);
                        removeWalkIn(item.id);
                      }}
                      className="p-1.5 text-[#9CA3AF] hover:text-rose-400 cursor-pointer"
                      title="Eliminar de cola"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-[#252A36] text-[10px] font-mono text-[#6B7280] text-center">
            PWA KIOSKO • SIN PERMANENCIA • TIEMPO REAL
          </div>
        </div>

      </div>
    </div>
  );
};

export default WalkInKioskModal;
