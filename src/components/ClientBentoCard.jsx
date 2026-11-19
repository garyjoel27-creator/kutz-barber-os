import React, { useState } from 'react';
import {
  RotateCw,
  RotateCcw,
  Phone,
  Scissors,
  Ticket,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  User,
  AlertTriangle,
  Edit3,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { soundFx } from '../lib/soundFx';
import { useClients, getFadeAlert } from '../context/ClientContext';
import { buildWhatsAppUrl } from '../lib/shopUtils';

/**
 * Tarjeta 3D Giratoria para Barberos (Bento Flip Card)
 * Anverso: Foto grande, nombre, aviso de repaso / bono VIP, WhatsApp y botón Girar.
 * Reverso: Receta real del cliente, avisos (remolinos/piel) y botón de 1 toque "Repetir corte hoy".
 */
const ClientBentoCard = ({
  client,
  isHero = false,
  onUpdate,
  onQuickSession,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isEditingFormula, setIsEditingFormula] = useState(false);
  const [quickFormula, setQuickFormula] = useState('');
  const [quickNotes, setQuickNotes] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const navigate = useNavigate();
  const { quickAddSession, updateClient, deleteClient } = useClients();

  if (!client) return null;

  const alert = getFadeAlert(client);
  const photoUrl = client.photo || client.avatar;
  const initials = client.name
    ? client.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'CL';
  const latestTreatment = client.treatments?.[0];
  const currentFormula =
    latestTreatment?.formula ||
    client.treatment ||
    'Fade #0.5 → #1.5 · Tijera arriba';
  const activeBono = client.bonos?.find(
    (b) => b.totalSessions - b.usedSessions > 0
  );
  const cleanPhone = (client.phone || '').replace(/\D/g, '');

  // Extraer pasos legibles de la receta real del cliente
  const formulaSteps = currentFormula
    .split(/[→·+|]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);

  const handleFlip = (e) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    soundFx.playFlip();
    soundFx.triggerHaptic(12);
    setIsFlipped((prev) => !prev);
  };

  const handleSaveQuickSession = (e) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    soundFx.playClick();
    soundFx.triggerHaptic(15);

    const formulaToSave = quickFormula.trim() || currentFormula;
    const notesToSave =
      quickNotes.trim() ||
      latestTreatment?.notes ||
      'Corte habitual realizado en sillón';

    const sessionPayload = {
      name: latestTreatment?.name || 'Corte de Cabello / Fade',
      formula: formulaToSave,
      notes: notesToSave,
      ritual: latestTreatment?.ritual || 'Acabado con navaja y polvos mate',
      date: new Date().toISOString().split('T')[0],
      timestamp: Date.now(),
    };

    if (onQuickSession) {
      onQuickSession(client.id, sessionPayload);
    } else if (quickAddSession) {
      quickAddSession(client.id, sessionPayload);
    }

    if (quickFormula.trim()) {
      if (onUpdate) {
        onUpdate(client.id, { treatment: formulaToSave });
      } else if (updateClient) {
        updateClient(client.id, { treatment: formulaToSave });
      }
    }

    setQuickFormula('');
    setQuickNotes('');
    setIsEditingFormula(false);
    setFeedbackMsg('¡Corte guardado hoy!');
    setTimeout(() => setFeedbackMsg(''), 2500);
  };

  return (
    <div
      className={`perspective-1000 w-full select-none ${
        isHero ? 'h-[450px] md:h-[470px]' : 'h-[450px]'
      }`}
    >
      <div
        onClick={handleFlip}
        className={`relative w-full h-full transform-style-3d flip-transition cursor-pointer ${
          isFlipped ? 'rotate-y-180' : 'rotate-y-0'
        }`}
      >
        {/* ================================================================= */}
        {/* CARA FRONTAL: Foto, Aviso y Acceso en 1 Toque                     */}
        {/* ================================================================= */}
        <div
          style={{ position: 'absolute' }}
          className="!absolute inset-0 w-full h-full backface-hidden luxury-card rounded-2xl overflow-hidden border border-[#2A303F] flex flex-col justify-between p-4 sm:p-5 shadow-2xl transition-all duration-300 hover:border-[#10B981]/60 bg-[#12161F]"
        >
          {/* Retrato Completo */}
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={client.name}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 w-full h-full bg-[#161B26] flex items-center justify-center text-[#10B981] font-serif text-6xl font-black opacity-25">
              {initials}
            </div>
          )}

          {/* Gradientes para contraste perfecto */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#090C11] via-[#0E1117]/65 to-[#0E1117]/30 pointer-events-none" />

          {/* Fila Superior: Estado del Corte + Bono VIP */}
          <div className="relative z-10 flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border shadow-md backdrop-blur-md ${
                  alert.alertLevel === 'urgent'
                    ? 'bg-[#EF4444]/85 text-white border-[#FCA5A5]/60'
                    : alert.alertLevel === 'warning'
                    ? 'bg-[#F59E0B]/85 text-[#07090C] border-[#FCD34D]'
                    : 'bg-[#101318]/85 text-[#6EE7B7] border-[#10B981]/50'
                }`}
              >
                <span>{alert.label}</span>
              </span>

              {activeBono ? (
                <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#10B981] text-[#07090C] shadow-md">
                  <Ticket size={13} />
                  <span>
                    Bono: {activeBono.totalSessions - activeBono.usedSessions} libres
                  </span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#E5E7EB] bg-[#141820]/85 border border-[#262C3A] backdrop-blur-md">
                  <User size={12} />
                  <span>Normal</span>
                </span>
              )}
            </div>

            {(isHero || String(client.id) === '3') && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-[11px] font-black bg-[#10B981] text-[#07090C] uppercase tracking-wider shadow-lg">
                <Sparkles size={12} />
                <span>VIP</span>
              </span>
            )}
          </div>

          {/* Fila Inferior: Nombre + Último Corte + Botones Grandes */}
          <div className="relative z-10 space-y-3.5">
            <div>
              <h3 className="text-2xl font-serif font-black text-white uppercase tracking-tight drop-shadow-lg leading-tight truncate">
                {client.name}
              </h3>

              <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-[#E5E7EB]">
                {latestTreatment && (
                  <span className="flex items-center font-semibold text-[#34D399] truncate max-w-full">
                    <Scissors size={13} className="mr-1.5 text-[#10B981] shrink-0" />
                    <span className="truncate">{latestTreatment.name}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-1.5 pt-2.5 border-t border-white/15">
              <div className="flex items-center gap-1.5 min-w-0">
                {cleanPhone.length >= 9 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      soundFx.playClick();
                      const firstName = (client.name || 'crack').split(' ')[0];
                      const draft = `¡Qué pasa ${firstName}! 💈 Te escribimos de la barbería. ¿Te guardamos sillón esta semana para repasar el corte? 🔥`;
                      window.open(
                        buildWhatsAppUrl(client.phone, draft),
                        '_blank',
                        'noopener,noreferrer'
                      );
                    }}
                    className="px-2.5 py-2 min-h-[40px] rounded-xl text-[11px] sm:text-xs font-black bg-[#10B981] hover:bg-[#34D399] text-[#07090C] flex items-center space-x-1 cursor-pointer shrink-0 shadow-md transition-all"
                    title="Mandar WhatsApp directo"
                  >
                    <Phone size={13} />
                    <span>WhatsApp</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    soundFx.playClick();
                    navigate(`/clients/${client.id}`);
                  }}
                  className="px-2.5 py-2 min-h-[40px] rounded-xl text-[11px] sm:text-xs font-bold text-white bg-[#141820]/90 hover:bg-[#1E2430] border border-[#262C3A] transition-all cursor-pointer flex items-center space-x-0.5 shrink-0"
                >
                  <span>Fotos</span>
                  <ChevronRight size={13} />
                </button>

                {deleteClient && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      soundFx.playClick();
                      if (
                        typeof window === 'undefined' ||
                        window.confirm(`¿Borrar la ficha de ${client.name}?`)
                      ) {
                        deleteClient(client.id);
                      }
                    }}
                    className="p-2 min-h-[40px] min-w-[36px] rounded-xl text-xs font-bold text-[#9CA3AF] hover:text-[#FCA5A5] bg-[#141820]/90 hover:bg-[#EF4444]/20 border border-[#262C3A] hover:border-[#EF4444]/50 transition-all cursor-pointer flex items-center justify-center shrink-0"
                    title="Borrar ficha del cliente"
                    aria-label={`Borrar ficha de ${client.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleFlip}
                className="px-2.5 sm:px-3.5 py-2 min-h-[40px] rounded-xl text-[11px] sm:text-xs font-bold bg-white text-[#07090C] hover:bg-[#10B981] transition-all flex items-center space-x-1 cursor-pointer shadow-lg shrink-0"
                title="Girar tarjeta para ver su corte"
              >
                <RotateCw size={13} />
                <span>Ver corte</span>
              </button>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* CARA TRASERA: Su Corte Habitual + Botón Repetir en 1 Toque        */}
        {/* ================================================================= */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'absolute' }}
          className="!absolute inset-0 w-full h-full backface-hidden rotate-y-180 luxury-card rounded-2xl overflow-hidden border border-[#10B981]/50 flex flex-col justify-between p-4 sm:p-5 shadow-2xl bg-[#10141C] cursor-default"
        >
          {/* Cabecera */}
          <div className="space-y-3 overflow-y-auto max-h-[380px] no-scrollbar pr-0.5">
            <div className="flex items-center justify-between pb-3 border-b border-[#252A36]">
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-[#34D399] uppercase tracking-wider block">
                  Su corte habitual
                </span>
                <h4 className="text-lg font-serif font-black text-white uppercase tracking-tight truncate">
                  {client.name}
                </h4>
              </div>

              <button
                type="button"
                onClick={handleFlip}
                className="px-3 py-2 rounded-xl bg-[#181D27] hover:bg-[#10B981] text-white hover:text-[#07090C] border border-[#262C3A] text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 shrink-0"
                title="Volver a la foto"
              >
                <RotateCcw size={14} />
                <span>Foto</span>
              </button>
            </div>

            {/* Pasos de su corte en pastillas claras */}
            <div>
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {formulaSteps.map((step, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 text-xs font-bold text-[#34D399]"
                  >
                    {step}
                  </span>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-[#0A0C0F]/90 border border-[#262C3A] text-xs text-[#E5E7EB] leading-relaxed">
                <span className="text-[#9CA3AF] font-semibold block text-[11px] mb-0.5">
                  Detalle de máquina y tijera:
                </span>
                {currentFormula}
              </div>
            </div>

            {/* Aviso importante del cliente (remolinos / piel sensible) */}
            {(client.notes || client.allergies) && (
              <div className="p-3 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-xs space-y-1">
                <div className="flex items-center space-x-1.5 text-[#FBBF24] font-bold">
                  <AlertTriangle size={13} />
                  <span>Ten en cuenta:</span>
                </div>
                {client.notes && (
                  <p className="text-[#F3F4F6] leading-snug">{client.notes}</p>
                )}
                {client.allergies && (
                  <p className="text-[#FCD34D] font-semibold">
                    Piel: {client.allergies}
                  </p>
                )}
              </div>
            )}

            {/* Formulario opcional solo si quiere cambiar el corte habitual */}
            {isEditingFormula && (
              <div className="space-y-2 pt-1 animate-in fade-in">
                <input
                  type="text"
                  value={quickFormula}
                  onChange={(e) => setQuickFormula(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Nueva fórmula (ej. #0.5 Fade + Barba)..."
                  className="w-full px-3 py-2 bg-[#0A0C0F] border border-[#10B981]/50 rounded-xl text-xs text-white placeholder-[#6B7280] focus:outline-none"
                />
                <input
                  type="text"
                  value={quickNotes}
                  onChange={(e) => setQuickNotes(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Nota rápida..."
                  className="w-full px-3 py-2 bg-[#0A0C0F] border border-[#262C3A] rounded-xl text-xs text-white placeholder-[#6B7280] focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Zona Inferior: Botón 1-Toque "Repetir Corte Hoy" (Cero escritura) */}
          <div className="pt-3 border-t border-[#252A36] space-y-2 shrink-0">
            {feedbackMsg ? (
              <div className="w-full py-3 rounded-xl bg-[#10B981] text-[#07090C] text-xs font-black uppercase flex items-center justify-center space-x-2">
                <CheckCircle2 size={16} />
                <span>{feedbackMsg}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSaveQuickSession}
                className="btn-author w-full !py-3 text-xs cursor-pointer"
              >
                <Scissors size={15} />
                <span>
                  {isEditingFormula
                    ? 'Guardar nuevo corte hoy'
                    : '✓ Repetir su corte hoy'}
                </span>
              </button>
            )}

            <div className="flex items-center justify-between text-xs pt-0.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  soundFx.playClick();
                  setIsEditingFormula((prev) => !prev);
                }}
                className="text-[#9CA3AF] hover:text-white flex items-center space-x-1 cursor-pointer"
              >
                <Edit3 size={12} />
                <span>{isEditingFormula ? 'Cancelar edición' : 'Cambiar corte'}</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  soundFx.playClick();
                  navigate(`/clients/${client.id}`);
                }}
                className="text-[#34D399] hover:text-white font-bold flex items-center cursor-pointer"
              >
                <span>Ver historial completo</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientBentoCard;
