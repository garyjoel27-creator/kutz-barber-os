import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  GripHorizontal,
  GripVertical,
  CheckCircle2,
  UserCheck,
  Plus,
  X,
  Lock,
  Sparkles,
  Trash2,
  RotateCcw,
  Clock,
  Edit3,
} from 'lucide-react';
import { soundFx } from '../lib/soundFx';
import { getShopLocalDateTime } from '../lib/shopUtils';

const START_HOUR = 8;
const END_HOUR = 22;
const SNAP_MINUTES = 15;
const ROW_HEIGHT = 22; // 22px per 15 min => 88px per hour
const TOTAL_SLOTS = ((END_HOUR - START_HOUR) * 60) / SNAP_MINUTES;
const CANVAS_HEIGHT = TOTAL_SLOTS * ROW_HEIGHT;

const DURATION_CHIPS = [
  { mins: 15, label: '15m' },
  { mins: 30, label: '30m' },
  { mins: 45, label: '45m' },
  { mins: 60, label: '1h (60m)' },
  { mins: 90, label: '1h 30m' },
  { mins: 120, label: '2h (120m)' },
];

const QUARTER_CHIPS = ['00', '15', '30', '45'];

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 10 * 60;
  const [h, m] = String(timeStr).split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return 10 * 60;
  return h * 60 + m;
}

function formatMinutesToTime(totalMins) {
  const clamped = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, totalMins));
  const h = String(Math.floor(clamped / 60)).padStart(2, '0');
  const m = String(clamped % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function formatLocalIsoDate(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildUpcomingDays(count = 7, shop = null) {
  const days = [];
  const localNow = getShopLocalDateTime(shop, new Date());
  const [baseY, baseM, baseD] = localNow.isoDate.split('-').map(Number);
  const base = new Date(baseY, baseM - 1, baseD, 12, 0, 0);

  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const iso = formatLocalIsoDate(d);
    const dow = d.getDay();
    const dayName =
      i === 0
        ? 'Hoy'
        : i === 1
        ? 'Mañana'
        : d.toLocaleDateString('es-ES', { weekday: 'short' });
    const dayNum = d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
    });
    days.push({ iso, dayName, dayNum, dow });
  }
  return days;
}

/**
 * Computes side-by-side column assignments for overlapping appointments on the same day
 */
function computeOverlapLayout(appointments = []) {
  if (!Array.isArray(appointments) || appointments.length === 0) return {};

  const sorted = [...appointments]
    .map((apt) => {
      const start = parseTimeToMinutes(apt.timeSlot || apt.time);
      const dur = Math.max(15, Number(apt.durationMinutes) || 60);
      return { id: apt.id, start, end: start + dur };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const layoutMap = {};
  let cluster = [];
  let clusterMaxEnd = -1;

  const flushCluster = (items) => {
    if (items.length === 0) return;
    const columns = [];
    items.forEach((item) => {
      let placedCol = -1;
      for (let c = 0; c < columns.length; c++) {
        if (columns[c] <= item.start) {
          placedCol = c;
          columns[c] = item.end;
          break;
        }
      }
      if (placedCol === -1) {
        placedCol = columns.length;
        columns.push(item.end);
      }
      layoutMap[item.id] = { colIndex: placedCol, totalCols: 1 };
    });
    const totalCols = Math.max(1, columns.length);
    items.forEach((item) => {
      layoutMap[item.id].totalCols = totalCols;
    });
  };

  sorted.forEach((item) => {
    if (cluster.length === 0 || item.start < clusterMaxEnd) {
      cluster.push(item);
      clusterMaxEnd = Math.max(clusterMaxEnd, item.end);
    } else {
      flushCluster(cluster);
      cluster = [item];
      clusterMaxEnd = item.end;
    }
  });
  flushCluster(cluster);

  return layoutMap;
}

export default function VisualAgendaTimeline({
  appointments = [],
  services = [],
  barberId = 'joseh',
  barberName = 'José',
  schedule = {},
  shop = null,
  onReschedule,
  onApprove,
  onSeat,
  onOpenClient,
  onAddManual,
  onDelete,
  onOpenScheduleEditor,
}) {
  const days = useMemo(() => buildUpcomingDays(7, shop), [shop]);
  const todayIso = days[0]?.iso;
  const [selectedDate, setSelectedDate] = useState(todayIso);

  // Live clock tick every 60s
  const [clockTick, setClockTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setClockTick((t) => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  // Active pointer drag/resize session (only triggered from dedicated drag/resize handles)
  const [dragState, setDragState] = useState(null);
  const lastSnappedValRef = useRef(null);

  // Undo toast state after moving/resizing an appointment
  const [undoState, setUndoState] = useState(null);
  const undoTimerRef = useRef(null);

  // Centered Tactile Bottom Sheet / Modal for creating or editing an appointment/block
  const [modalMode, setModalMode] = useState(null); // null | 'create' | 'edit'
  const [editingApt, setEditingApt] = useState(null);
  const [quickSlot, setQuickSlot] = useState('10:00');
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickServiceId, setQuickServiceId] = useState(services[0]?.id || 's1');
  const [quickServiceName, setQuickServiceName] = useState(
    services[0]?.name || 'Corte (incluye cejas)'
  );
  const [quickDuration, setQuickDuration] = useState(
    Number(services[0]?.durationMinutes) || 60
  );

  // Appointments for the selected date
  const dayAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      if (!apt.date) return selectedDate === todayIso;
      return apt.date === selectedDate;
    });
  }, [appointments, selectedDate, todayIso]);

  const overlapLayout = useMemo(
    () => computeOverlapLayout(dayAppointments),
    [dayAppointments]
  );

  // Selected day schedule info
  const selectedDayInfo = useMemo(() => {
    const found = days.find((d) => d.iso === selectedDate);
    const dow = found ? found.dow : 1;
    const workDays = schedule?.workDays || schedule?.daysOpen || [1, 2, 3, 4, 5, 6];
    const dayHrs = schedule?.hoursByDay?.[dow] || schedule?.hoursByDay?.[String(dow)] || {};
    const isOpen =
      !dayHrs.closed &&
      (workDays.includes(dow) || (dow === 0 && workDays.includes(7)));
    const openTime = dayHrs.openTime || schedule?.openTime || '10:00';
    const closeTime = dayHrs.closeTime || schedule?.closeTime || '18:00';
    return { dow, isOpen, openTime, closeTime };
  }, [days, selectedDate, schedule]);

  // Count per day for badges
  const countsByDate = useMemo(() => {
    const map = {};
    appointments.forEach((apt) => {
      const d = apt.date || todayIso;
      map[d] = (map[d] || 0) + 1;
    });
    return map;
  }, [appointments, todayIso]);

  // Live current-time red indicator line when viewing Today
  const nowIndicatorTop = useMemo(() => {
    void clockTick;
    if (selectedDate !== todayIso) return null;
    const localNow = getShopLocalDateTime(shop, new Date());
    const mins = localNow.totalMinutes;
    if (mins < START_HOUR * 60 || mins > END_HOUR * 60) return null;
    return ((mins - START_HOUR * 60) / SNAP_MINUTES) * ROW_HEIGHT;
  }, [selectedDate, todayIso, shop, clockTick]);

  const hoursList = useMemo(() => {
    const arr = [];
    for (let h = START_HOUR; h < END_HOUR; h++) {
      arr.push(`${String(h).padStart(2, '0')}:00`);
    }
    return arr;
  }, []);

  const registerUndo = (apt, prevTimeSlot, prevDate, prevDuration) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoState({
      apt,
      prevTimeSlot,
      prevDate,
      prevDuration,
    });
    undoTimerRef.current = setTimeout(() => {
      setUndoState(null);
    }, 8000);
  };

  const handleUndo = () => {
    if (!undoState || !onReschedule) return;
    soundFx.playClick();
    soundFx.triggerHaptic(12);
    onReschedule(undoState.apt, {
      timeSlot: undoState.prevTimeSlot,
      date: undoState.prevDate,
      durationMinutes: undoState.prevDuration,
    });
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoState(null);
  };

  // Open tactile modal on tapping an empty hour slot
  const handleOpenCreateModal = (hourLabel) => {
    soundFx.playClick();
    const defaultSvc = services[0] || {
      id: 's1',
      name: 'Corte (incluye cejas)',
      durationMinutes: 60,
    };
    setModalMode('create');
    setEditingApt(null);
    setQuickSlot(hourLabel);
    setQuickName('');
    setQuickPhone('');
    setQuickServiceId(defaultSvc.id);
    setQuickServiceName(defaultSvc.name);
    setQuickDuration(Number(defaultSvc.durationMinutes) || 60);
  };

  // Open tactile modal on tapping an existing appointment to edit time/duration/delete
  const handleOpenEditModal = (apt) => {
    soundFx.playClick();
    setModalMode('edit');
    setEditingApt(apt);
    setQuickSlot(apt.timeSlot || apt.time || '10:00');
    setQuickName(apt.clientName || '');
    setQuickPhone(apt.clientPhone || '');
    const matchedSvc = services.find(
      (s) => s.id === apt.serviceId || s.name === apt.serviceName
    );
    setQuickServiceId(matchedSvc?.id || apt.serviceId || services[0]?.id || 's1');
    setQuickServiceName(
      apt.serviceName || matchedSvc?.name || services[0]?.name || 'Corte'
    );
    setQuickDuration(Math.max(15, Number(apt.durationMinutes) || 60));
  };

  // When changing service in modal, automatically sync durationMinutes
  const handleServiceSelectChange = (svcNameOrId) => {
    const found = services.find(
      (s) => s.id === svcNameOrId || s.name === svcNameOrId
    );
    if (found) {
      setQuickServiceId(found.id);
      setQuickServiceName(found.name);
      setQuickDuration(Number(found.durationMinutes) || 60);
    } else {
      setQuickServiceName(svcNameOrId);
    }
  };

  // Helper to change quickSlot hour or minute quarter in tactile modal
  const currentSlotParts = useMemo(() => {
    const [hh = '10', mm = '00'] = String(quickSlot || '10:00').split(':');
    return {
      hour: Math.max(START_HOUR, Math.min(END_HOUR - 1, parseInt(hh, 10) || 10)),
      minute: QUARTER_CHIPS.includes(mm) ? mm : '00',
    };
  }, [quickSlot]);

  const setSlotHour = (newHour) => {
    const clampedH = Math.max(START_HOUR, Math.min(END_HOUR - 1, newHour));
    soundFx.playClick();
    setQuickSlot(`${String(clampedH).padStart(2, '0')}:${currentSlotParts.minute}`);
  };

  const setSlotMinute = (newMin) => {
    soundFx.playClick();
    setQuickSlot(`${String(currentSlotParts.hour).padStart(2, '0')}:${newMin}`);
  };

  // Begin touch/mouse drag ONLY from dedicated handle
  const handleStartDrag = (e, apt, mode) => {
    e.stopPropagation();
    if (e.currentTarget && typeof e.currentTarget.setPointerCapture === 'function') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    const startMins = parseTimeToMinutes(apt.timeSlot || apt.time);
    const duration = Math.max(15, Number(apt.durationMinutes) || 60);
    lastSnappedValRef.current = mode === 'move' ? startMins : duration;

    soundFx.triggerHaptic(10);
    setDragState({
      aptId: apt.id,
      mode, // 'move' | 'resize'
      originY: e.clientY,
      hasMovedThreshold: false,
      initialStartMins: startMins,
      initialDuration: duration,
      currentStartMins: startMins,
      currentDuration: duration,
    });
  };

  const handlePointerMove = (e) => {
    if (!dragState) return;
    e.stopPropagation();

    const deltaY = e.clientY - dragState.originY;
    if (!dragState.hasMovedThreshold && Math.abs(deltaY) < 10) {
      return;
    }

    const deltaSnaps = Math.round(deltaY / ROW_HEIGHT);
    const deltaMins = deltaSnaps * SNAP_MINUTES;

    if (dragState.mode === 'move') {
      const maxStart = END_HOUR * 60 - dragState.initialDuration;
      const nextStart = Math.max(
        START_HOUR * 60,
        Math.min(maxStart, dragState.initialStartMins + deltaMins)
      );
      if (nextStart !== lastSnappedValRef.current) {
        lastSnappedValRef.current = nextStart;
        soundFx.triggerHaptic(5);
      }
      setDragState((prev) =>
        prev
          ? { ...prev, hasMovedThreshold: true, currentStartMins: nextStart }
          : null
      );
    } else if (dragState.mode === 'resize') {
      const maxDur = Math.min(240, END_HOUR * 60 - dragState.initialStartMins);
      const nextDur = Math.max(
        15,
        Math.min(maxDur, dragState.initialDuration + deltaMins)
      );
      if (nextDur !== lastSnappedValRef.current) {
        lastSnappedValRef.current = nextDur;
        soundFx.triggerHaptic(5);
      }
      setDragState((prev) =>
        prev
          ? { ...prev, hasMovedThreshold: true, currentDuration: nextDur }
          : null
      );
    }
  };

  const handlePointerUp = (e) => {
    if (!dragState) return;
    e.stopPropagation();

    const targetApt = dayAppointments.find((a) => a.id === dragState.aptId);
    const changed =
      dragState.hasMovedThreshold &&
      (dragState.currentStartMins !== dragState.initialStartMins ||
        dragState.currentDuration !== dragState.initialDuration);

    const prevTimeSlot = formatMinutesToTime(dragState.initialStartMins);
    const prevDuration = dragState.initialDuration;
    const finalTimeSlot = formatMinutesToTime(dragState.currentStartMins);
    const finalDuration = dragState.currentDuration;

    setDragState(null);

    if (changed && targetApt && onReschedule) {
      soundFx.playClick();
      registerUndo(targetApt, prevTimeSlot, selectedDate, prevDuration);
      onReschedule(targetApt, {
        timeSlot: finalTimeSlot,
        date: selectedDate,
        durationMinutes: finalDuration,
      });
    }
  };

  // CRITICAL FIX: Aborted touch gesture (pointercancel / touchcancel) cancels drag and NEVER saves
  const handlePointerCancel = (e) => {
    if (!dragState) return;
    e.stopPropagation();
    setDragState(null);
  };

  const handleSaveModal = (isBreakBlock = false) => {
    soundFx.playClick();
    soundFx.triggerHaptic(12);
    const matchedSvc = services.find(
      (s) => s.id === quickServiceId || s.name === quickServiceName
    );

    if (modalMode === 'edit' && editingApt && onReschedule) {
      const prevTime = editingApt.timeSlot || editingApt.time || '10:00';
      const prevDur = Math.max(15, Number(editingApt.durationMinutes) || 60);
      registerUndo(editingApt, prevTime, editingApt.date || selectedDate, prevDur);

      onReschedule(editingApt, {
        timeSlot: quickSlot,
        date: selectedDate,
        durationMinutes: Number(quickDuration) || 60,
        clientName: isBreakBlock
          ? '🔒 Bloqueo / Descanso'
          : quickName.trim() || editingApt.clientName || 'Cliente',
        clientPhone: quickPhone.trim(),
        serviceId: isBreakBlock ? 'block' : matchedSvc?.id || quickServiceId,
        serviceName: isBreakBlock ? 'Horario Bloqueado' : quickServiceName,
        price: isBreakBlock ? 0 : matchedSvc?.price ?? editingApt.price ?? 20,
        barberId: editingApt.barberId || barberId || 'any',
        barberName: editingApt.barberName || barberName,
        isBlock: isBreakBlock ? true : Boolean(editingApt.isBlock),
      });
      setModalMode(null);
      setEditingApt(null);
      return;
    }

    if (!onAddManual) return;
    const clientLabel = isBreakBlock
      ? '🔒 Bloqueo / Descanso'
      : quickName.trim() || 'Cliente Telefónico';

    onAddManual({
      clientName: clientLabel,
      clientPhone: quickPhone.trim(),
      serviceId: isBreakBlock ? 'block' : matchedSvc?.id || quickServiceId,
      serviceName: isBreakBlock ? 'Horario Bloqueado' : quickServiceName,
      price: isBreakBlock ? 0 : matchedSvc?.price ?? 20,
      barberId: barberId || 'any',
      barberName,
      date: selectedDate,
      timeSlot: quickSlot,
      durationMinutes: Number(quickDuration) || 60,
      status: 'confirmed',
      isBlock: isBreakBlock,
    });
    setModalMode(null);
    setQuickName('');
    setQuickPhone('');
  };

  const handleDeleteFromModal = () => {
    if (!editingApt || !onDelete) return;
    soundFx.playClick();
    soundFx.triggerHaptic(15);
    onDelete(editingApt);
    setModalMode(null);
    setEditingApt(null);
  };

  return (
    <div className="space-y-3 animate-in fade-in">
      {/* Barra superior informativa + Horario del día + Botón Editar Horario */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 text-[11px] text-[#D1D5DB]">
        <div className="flex items-center gap-2 flex-wrap">
          <Clock size={14} className="text-[#34D399] shrink-0" />
          <span>
            {selectedDayInfo.isOpen ? (
              <>
                Horario del día:{' '}
                <strong className="text-white font-mono">
                  {selectedDayInfo.openTime} – {selectedDayInfo.closeTime}
                </strong>
              </>
            ) : (
              <strong className="text-[#FCD34D]">🔒 Día cerrado por descanso</strong>
            )}
            <span className="hidden sm:inline text-[#9CA3AF]">
              {' '}
              · Toca cualquier hueco o cita para editar hora/duración o usa el asa ⠿ para arrastrar
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onOpenScheduleEditor && (
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                onOpenScheduleEditor();
              }}
              className="px-2.5 py-1.5 min-h-[36px] rounded-lg bg-[#141820] hover:bg-[#1B202B] border border-[#10B981]/50 text-[#34D399] text-[11px] font-black flex items-center gap-1 cursor-pointer"
            >
              <Clock size={12} />
              <span>🕒 Editar Horario L–D</span>
            </button>
          )}
        </div>
      </div>

      {/* Toast Táctil de Deshacer (Undo) tras mover o redimensionar una cita */}
      {undoState && (
        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[#141820] border-2 border-[#F59E0B] text-xs text-white shadow-lg animate-in fade-in">
          <span className="font-bold truncate">
            🕒 Cita de <strong className="text-[#34D399]">{undoState.apt.clientName}</strong> modificada
          </span>
          <button
            type="button"
            onClick={handleUndo}
            className="px-3 py-1.5 min-h-[38px] rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] text-[#07090C] text-xs font-black uppercase flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Deshacer</span>
          </button>
        </div>
      )}

      {/* Selector de días estilo Booksy (7 días) */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
        {days.map((d) => {
          const isSelected = d.iso === selectedDate;
          const cnt = countsByDate[d.iso] || 0;
          return (
            <button
              key={d.iso}
              type="button"
              onClick={() => {
                soundFx.playClick();
                setSelectedDate(d.iso);
              }}
              className={`py-2 px-2 min-h-[48px] rounded-xl border text-center transition-all cursor-pointer relative ${
                isSelected
                  ? 'bg-[#10B981] text-[#07090C] border-[#34D399] shadow-md'
                  : 'bg-[#0A0C0F]/90 text-[#D1D5DB] border-[#252A36] hover:border-[#10B981]/50'
              }`}
            >
              <span className="text-[10px] font-bold uppercase block leading-none">
                {d.dayName}
              </span>
              <span className="text-xs font-black block mt-1">{d.dayNum}</span>
              {cnt > 0 && (
                <span
                  className={`absolute top-1 right-1.5 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center ${
                    isSelected
                      ? 'bg-[#07090C] text-[#34D399]'
                      : 'bg-[#10B981]/25 text-[#34D399]'
                  }`}
                >
                  {cnt}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* =================================================================== */}
      {/* LIENZO DE AGENDA VISUAL TÁCTIL (Scroll libre + Asa dedicada 44x44)  */}
      {/* =================================================================== */}
      <div className="rounded-2xl bg-[#0A0C0F]/90 border border-[#252A36] overflow-hidden">
        <div
          className="max-h-[560px] overflow-y-auto relative select-none"
          style={{ touchAction: 'pan-y' }}
        >
          <div
            className="relative w-full"
            style={{ height: `${CANVAS_HEIGHT}px` }}
          >
            {/* Rejilla de horas tocables */}
            {hoursList.map((hourLabel, idx) => {
              const topPx = idx * 4 * ROW_HEIGHT;
              return (
                <div
                  key={hourLabel}
                  onClick={() => handleOpenCreateModal(hourLabel)}
                  className="absolute left-0 right-0 flex group cursor-pointer hover:bg-[#10B981]/5 active:bg-[#10B981]/10 transition-colors"
                  style={{ top: `${topPx}px`, height: `${4 * ROW_HEIGHT}px` }}
                >
                  {/* Etiqueta de la hora */}
                  <div className="w-14 sm:w-16 shrink-0 border-r border-[#252A36] pr-2 pt-1.5 text-right">
                    <span className="text-[11px] font-mono font-bold text-[#9CA3AF] group-hover:text-[#34D399]">
                      {hourLabel}
                    </span>
                  </div>

                  {/* Líneas de cuartos y media hora */}
                  <div className="flex-1 border-t border-[#252A36] relative">
                    <div
                      className="absolute left-0 right-0 border-t border-dashed border-[#1E2430]"
                      style={{ top: `${2 * ROW_HEIGHT}px` }}
                    />
                    <span className="opacity-0 group-hover:opacity-100 text-[10px] font-bold text-[#34D399] absolute right-3 top-1.5 transition-opacity">
                      + Añadir o bloquear ({hourLabel})
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Línea de hora actual en directo */}
            {nowIndicatorTop !== null && (
              <div
                className="absolute left-14 sm:left-16 right-0 z-10 pointer-events-none flex items-center"
                style={{ top: `${nowIndicatorTop}px` }}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] -ml-1.5 shadow-[0_0_8px_#EF4444]" />
                <div className="flex-1 h-[2px] bg-[#EF4444]/80" />
              </div>
            )}

            {/* Bloques Interactivos de Citas (Con soporte de columnas paralelas y asa táctil) */}
            {dayAppointments.map((apt) => {
              const isDraggingThis = dragState?.aptId === apt.id;
              const startMins = isDraggingThis
                ? dragState.currentStartMins
                : parseTimeToMinutes(apt.timeSlot || apt.time);
              const duration = isDraggingThis
                ? dragState.currentDuration
                : Math.max(15, Number(apt.durationMinutes) || 60);

              const topPx =
                ((startMins - START_HOUR * 60) / SNAP_MINUTES) * ROW_HEIGHT;
              const rawHeightPx = (duration / SNAP_MINUTES) * ROW_HEIGHT;
              const heightPx = Math.max(ROW_HEIGHT * 1.45, rawHeightPx);
              const isCompactSlot = duration <= 20;

              const displayStart = formatMinutesToTime(startMins);
              const displayEnd = formatMinutesToTime(startMins + duration);
              const isPending =
                apt.status === 'pending' || apt.status === 'expired';
              const isBlock = Boolean(apt.isBlock);

              const colInfo = overlapLayout[apt.id] || {
                colIndex: 0,
                totalCols: 1,
              };
              const widthPercent = 100 / colInfo.totalCols;
              const leftPercent = colInfo.colIndex * widthPercent;

              return (
                <div
                  key={apt.id}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerCancel}
                  className={`absolute rounded-xl border-l-4 border flex flex-col justify-between overflow-visible transition-shadow ${
                    isDraggingThis
                      ? 'z-30 shadow-[0_12px_40px_rgba(16,185,129,0.45)] ring-2 ring-[#34D399] scale-[1.01]'
                      : 'z-20 shadow-lg'
                  } ${
                    isBlock
                      ? 'bg-[#1F2430]/95 border-[#6B7280] border-l-[#9CA3AF]'
                      : isPending
                      ? 'bg-[#1D1B14]/95 border-[#F59E0B]/60 border-l-[#F59E0B]'
                      : 'bg-[#0F241D]/95 border-[#10B981]/60 border-l-[#10B981]'
                  }`}
                  style={{
                    top: `${topPx}px`,
                    height: `${heightPx}px`,
                    left: `calc(3.75rem + (100% - 4.25rem) * ${leftPercent / 100})`,
                    width: `calc((100% - 4.25rem) * ${widthPercent / 100} - 4px)`,
                    touchAction: 'pan-y',
                  }}
                >
                  {/* Etiqueta flotante de hora exacta mientras arrastras el dedo */}
                  {isDraggingThis && (
                    <div className="absolute -top-9 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#10B981] text-[#07090C] text-xs font-mono font-black shadow-xl whitespace-nowrap z-40">
                      🕒 {displayStart} → {displayEnd} ({duration} min)
                    </div>
                  )}

                  {/* Cuerpo principal de la cita: tocar abre editor táctil; el asa lateral 44x44 mueve con 1 dedo */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEditModal(apt);
                    }}
                    className={`flex-1 flex items-center justify-between gap-1.5 overflow-hidden cursor-pointer ${
                      isCompactSlot ? 'px-2 py-0.5' : 'px-2.5 py-1.5'
                    }`}
                  >
                    {/* ASA TÁCTIL DEDICADA DE ARRASTRE (44x44px target) — separa el scroll del arrastre */}
                    <div
                      onPointerDown={(e) => handleStartDrag(e, apt, 'move')}
                      onClick={(e) => e.stopPropagation()}
                      className="w-8 min-w-[32px] self-stretch flex items-center justify-center rounded-lg bg-black/25 hover:bg-[#10B981]/25 text-[#9CA3AF] hover:text-[#34D399] cursor-grab active:cursor-grabbing shrink-0"
                      style={{ touchAction: 'none' }}
                      title="Mantén y arrastra aquí para mover de hora"
                      aria-label="Mover hora de la cita"
                    >
                      <GripVertical size={15} />
                    </div>

                    {/* Información de la cita */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap leading-none">
                        <span className="text-[11px] font-mono font-black text-[#34D399]">
                          {displayStart}–{displayEnd}
                        </span>
                        <span className="text-[10px] font-mono text-[#9CA3AF]">
                          ({duration}m)
                        </span>
                        {!isCompactSlot && (
                          <span className="text-xs sm:text-sm font-serif font-black text-white truncate">
                            · {apt.clientName}
                          </span>
                        )}
                        {isCompactSlot && (
                          <span className="text-[11px] font-bold text-white truncate">
                            {apt.clientName}
                          </span>
                        )}
                      </div>

                      {!isCompactSlot && heightPx >= 56 && (
                        <p className="text-[11px] text-[#D1D5DB] truncate mt-0.5">
                          ✂️ {apt.serviceName || 'Corte'}
                          {apt.recipePills?.length > 0 && (
                            <span className="text-[#34D399] font-mono ml-1.5">
                              [{apt.recipePills.slice(0, 2).join(' ')}]
                            </span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Acciones rápidas en 1 toque */}
                    <div
                      className="flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {!isBlock && isPending && onApprove && (
                        <button
                          type="button"
                          onClick={() => onApprove(apt)}
                          className="px-2 py-1 min-h-[30px] rounded-lg bg-[#10B981] hover:bg-[#34D399] text-[#07090C] text-[10px] font-black flex items-center gap-0.5 cursor-pointer"
                          title="Aceptar cita"
                        >
                          <CheckCircle2 size={12} />
                          <span className="hidden sm:inline">Aceptar</span>
                        </button>
                      )}
                      {!isBlock && !isPending && onSeat && (
                        <button
                          type="button"
                          onClick={() => onSeat(apt)}
                          className="px-2 py-1 min-h-[30px] rounded-lg bg-[#3B82F6] hover:bg-[#60A5FA] text-[#07090C] text-[10px] font-black flex items-center gap-0.5 cursor-pointer"
                          title="Pasar al sillón"
                        >
                          <UserCheck size={12} />
                          <span className="hidden sm:inline">Sillón</span>
                        </button>
                      )}
                      {apt.matchedClient && onOpenClient && (
                        <button
                          type="button"
                          onClick={() => onOpenClient(apt.matchedClient.id)}
                          className="p-1.5 min-h-[30px] min-w-[30px] rounded-lg bg-[#141820] border border-[#10B981]/50 text-[#34D399] text-[10px] font-bold flex items-center justify-center cursor-pointer"
                          title="Ver receta 3D"
                        >
                          <Sparkles size={11} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(apt)}
                        className="p-1.5 min-h-[30px] min-w-[30px] rounded-lg bg-[#141820]/90 hover:bg-[#1B202B] border border-[#252A36] text-[#D1D5DB] hover:text-white flex items-center justify-center cursor-pointer"
                        title="Editar hora, duración o borrar"
                        aria-label="Editar cita"
                      >
                        <Edit3 size={11} />
                      </button>
                    </div>
                  </div>

                  {/* Tirador inferior táctil para ALARGAR / RECORTAR duración con el dedo */}
                  {!isCompactSlot && (
                    <div
                      onPointerDown={(e) => handleStartDrag(e, apt, 'resize')}
                      onClick={(e) => e.stopPropagation()}
                      className="h-6 w-full bg-black/35 hover:bg-[#10B981]/25 border-t border-white/10 rounded-b-xl cursor-ns-resize flex items-center justify-center gap-1 text-[9px] font-bold text-[#9CA3AF] hover:text-[#34D399]"
                      style={{ touchAction: 'none' }}
                      title="Arrastra hacia abajo o arriba para alargar o recortar la duración"
                    >
                      <GripHorizontal size={13} />
                      <span>↕ {duration} min (estirar)</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* BOTTOM SHEET / MODAL TÁCTIL CENTRADO (NUNCA FUERA DE PANTALLA)      */}
      {/* =================================================================== */}
      {modalMode && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setModalMode(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[#101318] border-2 border-[#10B981] rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto"
          >
            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between border-b border-[#252A36] pb-3">
              <div>
                <span className="text-xs font-black uppercase text-[#34D399] flex items-center gap-1.5">
                  {modalMode === 'edit' ? <Edit3 size={14} /> : <Plus size={14} />}
                  <span>
                    {modalMode === 'edit'
                      ? 'Editar Cita o Bloqueo en Agenda'
                      : 'Añadir Cita o Bloqueo en Agenda'}
                  </span>
                </span>
                <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                  📅 {selectedDate} a las <strong className="text-white font-mono">{quickSlot}</strong> ({quickDuration} min)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="p-2 min-h-[40px] min-w-[40px] rounded-xl bg-[#141820] text-[#9CA3AF] hover:text-white flex items-center justify-center cursor-pointer"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            {/* 1. Selector Táctil de Hora Exacta y Cuartos (:00, :15, :30, :45) */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] block">
                1. Hora Exacta de Inicio (Toque rápido con 1 dedo):
              </span>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSlotHour(currentSlotParts.hour - 1)}
                    className="px-3 py-2.5 min-h-[44px] rounded-xl bg-[#141820] hover:bg-[#1B202B] border border-[#252A36] text-xs font-black text-white cursor-pointer"
                  >
                    -1h
                  </button>
                  <div className="px-3.5 py-2.5 min-h-[44px] rounded-xl bg-[#0A0C0F] border border-[#10B981]/60 font-mono text-base font-black text-[#34D399] flex items-center justify-center">
                    {quickSlot}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSlotHour(currentSlotParts.hour + 1)}
                    className="px-3 py-2.5 min-h-[44px] rounded-xl bg-[#141820] hover:bg-[#1B202B] border border-[#252A36] text-xs font-black text-white cursor-pointer"
                  >
                    +1h
                  </button>
                </div>

                {/* Cuartos de hora :00 :15 :30 :45 */}
                <div className="grid grid-cols-4 gap-1 flex-1 max-w-[210px]">
                  {QUARTER_CHIPS.map((q) => {
                    const active = currentSlotParts.minute === q;
                    return (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setSlotMinute(q)}
                        className={`py-2.5 min-h-[44px] rounded-xl font-mono text-xs font-black border transition-all cursor-pointer ${
                          active
                            ? 'bg-[#10B981] text-[#07090C] border-[#34D399]'
                            : 'bg-[#141820] text-[#D1D5DB] border-[#252A36]'
                        }`}
                      >
                        :{q}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 2. Chips Táctiles Grandes de Duración (15m a 2h) */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] block">
                2. Duración en Agenda:
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {DURATION_CHIPS.map((chip) => {
                  const active = Number(quickDuration) === chip.mins;
                  return (
                    <button
                      key={chip.mins}
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        setQuickDuration(chip.mins);
                      }}
                      className={`py-2.5 px-2 min-h-[44px] rounded-xl text-xs font-black border transition-all cursor-pointer ${
                        active
                          ? 'bg-[#10B981] text-[#07090C] border-[#34D399] shadow-md'
                          : 'bg-[#141820] text-[#D1D5DB] border-[#252A36] hover:border-[#10B981]/50'
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Datos del Cliente y Servicio (Sincronizado con Duración) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <span className="text-[11px] font-bold text-[#9CA3AF] block mb-1">
                  Nombre del Cliente:
                </span>
                <input
                  type="text"
                  placeholder="Ej. Carlos (o vacío para bloqueo)"
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-[#0A0C0F] border border-[#252A36] text-xs text-white focus:outline-none focus:border-[#10B981]"
                />
              </div>

              <div>
                <span className="text-[11px] font-bold text-[#9CA3AF] block mb-1">
                  Servicio (ajusta duración auto):
                </span>
                <select
                  value={quickServiceName}
                  onChange={(e) => handleServiceSelectChange(e.target.value)}
                  className="w-full px-3 py-2.5 min-h-[44px] rounded-xl bg-[#0A0C0F] border border-[#252A36] text-xs text-white"
                >
                  {(services.length > 0
                    ? services
                    : [{ id: 'def', name: 'Corte (incluye cejas)', durationMinutes: 60 }]
                  ).map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name} ({s.durationMinutes || 60}m)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Botones de Acción Táctiles (>= 44px) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-[#252A36]">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <button
                  type="button"
                  onClick={() => handleSaveModal(false)}
                  className="flex-1 py-3 px-4 min-h-[46px] rounded-xl bg-[#10B981] hover:bg-[#34D399] text-[#07090C] text-xs font-black uppercase cursor-pointer shadow-md"
                >
                  ✓ {modalMode === 'edit' ? 'Guardar Cambios' : `Guardar Cita (${quickSlot})`}
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveModal(true)}
                  className="py-3 px-3.5 min-h-[46px] rounded-xl bg-[#1B202B] hover:bg-[#252A36] border border-[#F59E0B]/50 text-[#FCD34D] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Lock size={13} />
                  <span>🔒 Bloquear Descanso</span>
                </button>
              </div>

              {modalMode === 'edit' && editingApt && onDelete && (
                <button
                  type="button"
                  onClick={handleDeleteFromModal}
                  className="py-3 px-3.5 min-h-[46px] rounded-xl bg-[#EF4444]/15 hover:bg-[#EF4444] text-[#FCA5A5] hover:text-white border border-[#EF4444]/40 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                  title="Eliminar cita o bloqueo de la agenda"
                >
                  <Trash2 size={14} />
                  <span>Borrar</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
