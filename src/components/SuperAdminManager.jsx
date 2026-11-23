import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  KeyRound,
  Plus,
  Check,
  Copy,
  ExternalLink,
  Power,
  AlertCircle,
  Users,
  Eye,
  EyeOff,
  LogOut,
  MapPin,
  Phone,
  Edit3,
  Scale
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { normalizeShopSlug, buildCustomerPortalUrl } from '../lib/shopUtils';
import LegalComplianceModal from './LegalComplianceModal';
import { soundFx } from '../lib/soundFx';

const VALID_MASTER_KEYS = new Set([
  'kutz-master-secret-2026',
  'kutz-superadmin-2026',
  'kutz-super-admin-2026',
  'kutz_super_admin_secret_2026'
]);

export default function SuperAdminManager({ onClose = null, showCloseButton = false }) {
  const {
    activeShopSlug,
    shopsList,
    switchShop,
    createShop,
    updateShop,
    toggleShopStatus,
    refreshShops,
    isLoading
  } = useShop();

  // Authentication state with session storage memory (no automated webdriver bypass)
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try {
      const stored = sessionStorage.getItem('kutz_superadmin_auth');
      return stored === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (isAuthenticated && typeof refreshShops === 'function') {
      refreshShops();
    }
  }, [isAuthenticated, refreshShops]);

  const [masterKeyInput, setMasterKeyInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'provision'
  const [editingSlug, setEditingSlug] = useState(null);
  const [copiedSlug, setCopiedSlug] = useState(null);
  const [copiedPanelSlug, setCopiedPanelSlug] = useState(null);
  const [dpaShop, setDpaShop] = useState(null);
  const [revealedPins, setRevealedPins] = useState({});

  // Provisioning form state
  const [newShopName, setNewShopName] = useState('');
  const [newShopSlug, setNewShopSlug] = useState('');
  const [newShopPin, setNewShopPin] = useState('');
  const [newShopPhone, setNewShopPhone] = useState('');
  const [newShopAddress, setNewShopAddress] = useState('');
  const [newShopBarbers, setNewShopBarbers] = useState([
    { id: 'b1', name: 'Master Barber', role: 'Fade Specialist', available: true }
  ]);
  const [newShopServices, setNewShopServices] = useState([
    { id: 's1', name: 'Skin Fade Clásico', durationMinutes: 30, price: 20 },
    { id: 's2', name: 'Barba Ritual', durationMinutes: 30, price: 15 }
  ]);
  const [newShopStartHour, setNewShopStartHour] = useState(9);
  const [newShopEndHour, setNewShopEndHour] = useState(20);
  const [newShopSlotMinutes, setNewShopSlotMinutes] = useState(30);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Auto-derive kebab-case slug when shop name changes (only when creating a new shop)
  const handleNameChange = (e) => {
    const val = e.target.value;
    setNewShopName(val);
    if (!editingSlug) {
      setNewShopSlug(normalizeShopSlug(val));
    }
    setFormError('');
  };

  const handleStartEditShop = (shop) => {
    soundFx.playClick();
    setEditingSlug(shop.slug);
    setNewShopName(shop.name || '');
    setNewShopSlug(shop.slug || '');
    setNewShopPin(shop.pin || '1234');
    setNewShopPhone(shop.phone || '');
    setNewShopAddress(shop.address || '');
    setNewShopBarbers(
      Array.isArray(shop.barbers) && shop.barbers.length > 0
        ? shop.barbers
        : [{ id: 'b1', name: 'Master Barber', role: 'Fade Specialist', available: true }]
    );
    setNewShopServices(
      Array.isArray(shop.services) && shop.services.length > 0
        ? shop.services
        : [{ id: 's1', name: 'Skin Fade Clásico', durationMinutes: 30, price: 20 }]
    );
    const openH = parseInt(String(shop.schedule?.openTime || '09:00').split(':')[0], 10) || 9;
    const closeH = parseInt(String(shop.schedule?.closeTime || '20:00').split(':')[0], 10) || 20;
    setNewShopStartHour(openH);
    setNewShopEndHour(closeH);
    setNewShopSlotMinutes(
      Number(shop.schedule?.slotMinutes || shop.schedule?.slotIntervalMinutes || 30)
    );
    setFormError('');
    setFormSuccess('');
    setActiveTab('provision');
  };

  const handleMasterKeySubmit = (e) => {
    e.preventDefault();
    soundFx.playClick();
    soundFx.triggerHaptic(10);

    const clean = masterKeyInput.trim();
    if (VALID_MASTER_KEYS.has(clean) || clean === 'kutz-master-secret-2026') {
      setIsAuthenticated(true);
      setAuthError('');
      try {
        sessionStorage.setItem('kutz_superadmin_auth', 'true');
      } catch {
        // ignore
      }
    } else {
      setAuthError('Clave Master incorrecta. Acceso denegado.');
      soundFx.triggerHaptic(25);
    }
  };

  const handleLogout = () => {
    soundFx.playClick();
    setIsAuthenticated(false);
    setMasterKeyInput('');
    try {
      sessionStorage.removeItem('kutz_superadmin_auth');
    } catch {
      // ignore
    }
  };

  const handleCopyLink = async (slug) => {
    soundFx.playClick();
    soundFx.triggerHaptic(10);
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://luminadesk-gary.netlify.app';
    const url = buildCustomerPortalUrl(origin, slug);

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else if (typeof document !== 'undefined') {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug(null), 2500);
    } catch {
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug(null), 2500);
    }
  };

  const handleCopyPanelLink = async (slug) => {
    soundFx.playClick();
    soundFx.triggerHaptic(10);
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://luminadesk-gary.netlify.app';
    // Clean URL: omit secret PIN query parameter from shareable salon panel URLs
    const cleanPanelUrl = `${origin}/?shop=${encodeURIComponent(slug)}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(cleanPanelUrl);
      }
    } catch {
      // ignore
    }
    setCopiedPanelSlug(slug);
    setTimeout(() => setCopiedPanelSlug(null), 2500);
  };

  const togglePinReveal = (slug) => {
    soundFx.playClick();
    setRevealedPins((prev) => ({ ...prev, [slug]: !prev[slug] }));
  };

  const handleAddBarber = () => {
    soundFx.playClick();
    setNewShopBarbers((prev) => {
      let nextNum = prev.length + 1;
      while (prev.some((b) => b.id === `b${nextNum}`)) {
        nextNum++;
      }
      return [
        ...prev,
        { id: `b${nextNum}`, name: `Barbero ${nextNum}`, role: 'Barbero', specialty: 'Barbero', available: true }
      ];
    });
  };

  const handleRemoveBarber = (index) => {
    soundFx.playClick();
    if (newShopBarbers.length <= 1) return;
    setNewShopBarbers((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAddService = () => {
    soundFx.playClick();
    setNewShopServices((prev) => {
      let nextNum = prev.length + 1;
      while (prev.some((s) => s.id === `s${nextNum}`)) {
        nextNum++;
      }
      return [
        ...prev,
        { id: `s${nextNum}`, name: 'Corte Especial', durationMinutes: 30, price: 20 }
      ];
    });
  };

  const handleRemoveService = (index) => {
    soundFx.playClick();
    if (newShopServices.length <= 1) return;
    setNewShopServices((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleProvisionSubmit = async (e) => {
    e.preventDefault();
    soundFx.playClick();
    soundFx.triggerHaptic(10);
    setFormError('');
    setFormSuccess('');

    if (!newShopName.trim()) {
      setFormError('El nombre de la barbería es obligatorio.');
      return;
    }
    if (!newShopSlug.trim()) {
      setFormError('El slug de la barbería es obligatorio.');
      return;
    }
    if (!/^\d{4}$/.test(newShopPin.trim())) {
      setFormError('El PIN debe tener exactamente 4 dígitos numéricos.');
      return;
    }
    if (newShopBarbers.length === 0) {
      setFormError('Debe agregar al menos 1 barbero activo.');
      return;
    }
    if (newShopServices.length === 0) {
      setFormError('Debe agregar al menos 1 servicio.');
      return;
    }

    const existingTarget = editingSlug ? shopsList.find((s) => s.slug === editingSlug) : null;
    const formattedOpen = `${String(Number(newShopStartHour) || 9).padStart(2, '0')}:00`;
    const formattedClose = `${String(Number(newShopEndHour) || 20).padStart(2, '0')}:00`;
    const prevOpenH = existingTarget
      ? parseInt(String(existingTarget.schedule?.openTime || '09:00').split(':')[0], 10) || 9
      : null;
    const prevCloseH = existingTarget
      ? parseInt(String(existingTarget.schedule?.closeTime || '20:00').split(':')[0], 10) || 20
      : null;
    const hoursChangedInAdmin =
      existingTarget && (Number(newShopStartHour) !== prevOpenH || Number(newShopEndHour) !== prevCloseH);

    let nextHoursByDay = existingTarget?.schedule?.hoursByDay;
    if (hoursChangedInAdmin && nextHoursByDay && typeof nextHoursByDay === 'object') {
      nextHoursByDay = Object.fromEntries(
        Object.entries(nextHoursByDay).map(([dayKey, dayVal]) => [
          dayKey,
          { ...(dayVal || {}), openTime: formattedOpen, closeTime: formattedClose }
        ])
      );
    }

    const payload = {
      slug: newShopSlug.trim(),
      name: newShopName.trim(),
      pin: newShopPin.trim(),
      phone: newShopPhone.trim(),
      address: newShopAddress.trim(),
      barbers: newShopBarbers.map((b) => ({
        ...b,
        role: b.role || b.specialty || 'Barbero',
        specialty: b.specialty || b.role || 'Barbero'
      })),
      services: newShopServices,
      status: existingTarget?.status || 'active',
      schedule: {
        ...(existingTarget?.schedule || {}),
        ...(nextHoursByDay ? { hoursByDay: nextHoursByDay } : {}),
        startHour: Number(newShopStartHour) || 9,
        endHour: Number(newShopEndHour) || 20,
        slotMinutes: Number(newShopSlotMinutes) || 30,
        slotIntervalMinutes: Number(newShopSlotMinutes) || 30,
        openTime: formattedOpen,
        closeTime: formattedClose,
        workDays: existingTarget?.schedule?.workDays || [1, 2, 3, 4, 5, 6]
      }
    };

    const res = editingSlug
      ? await updateShop(editingSlug, payload)
      : await createShop(payload);
    if (!res.success) {
      setFormError(res.error || 'Error al guardar la barbería.');
    } else {
      setFormSuccess(
        editingSlug
          ? `¡Barbería "${payload.name}" actualizada correctamente!`
          : `¡Barbería "${payload.name}" dada de alta correctamente!`
      );
      setEditingSlug(null);
      setNewShopName('');
      setNewShopSlug('');
      setNewShopPin('');
      setNewShopPhone('');
      setNewShopAddress('');
      setTimeout(() => {
        setActiveTab('list');
        setFormSuccess('');
      }, 1500);
    }
  };

  // Metrics summary
  const metrics = useMemo(() => {
    const total = shopsList.length;
    const active = shopsList.filter((s) => String(s.status || '').toLowerCase() !== 'paused').length;
    const paused = total - active;
    return { total, active, paused };
  }, [shopsList]);

  // If not authenticated, render Master Key Gate
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto p-6 bg-[#101318]/95 backdrop-blur-md rounded-2xl border border-[#252A36] shadow-[0_10px_40px_rgba(0,0,0,0.85)] text-[#F3F4F6]">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#10B981]/15 text-[#10B981] flex items-center justify-center border border-[#10B981]/30 mb-3 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <ShieldCheck size={28} />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white uppercase">Acceso Súper-Admin</h2>
          <p className="text-xs text-[#9CA3AF] mt-1">Gestión Central Multi-Barbería KUTZ OS</p>
        </div>

        <form onSubmit={handleMasterKeySubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#9CA3AF] mb-1.5">
              Clave Master de Seguridad
            </label>
            <div className="relative">
              <input
                type="password"
                value={masterKeyInput}
                onChange={(e) => setMasterKeyInput(e.target.value)}
                placeholder="Introduce la clave master..."
                className="w-full px-4 py-3 rounded-xl bg-[#141820] border border-[#252A36] focus:border-[#10B981] focus:outline-none text-white text-sm font-mono placeholder-[#6B7280] transition-colors"
                autoFocus
              />
              <KeyRound size={17} className="absolute right-3.5 top-3.5 text-[#6B7280]" />
            </div>
            {authError && (
              <p className="text-xs text-rose-400 mt-2 flex items-center gap-1.5 font-medium">
                <AlertCircle size={14} />
                <span>{authError}</span>
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#07090C] font-bold text-sm tracking-wide uppercase transition-all shadow-[0_4px_14px_rgba(16,185,129,0.35)] cursor-pointer"
          >
            Verificar y Entrar
          </button>

          {showCloseButton && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 text-xs font-bold text-[#9CA3AF] hover:text-white transition-colors cursor-pointer"
            >
              Cancelar y volver
            </button>
          )}
        </form>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 bg-[#101318]/95 backdrop-blur-md rounded-2xl border border-[#252A36] shadow-[0_10px_45px_rgba(0,0,0,0.85)] text-[#F3F4F6] space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#252A36] pb-5">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#10B981] text-[#07090C] flex items-center justify-center shadow-[3px_3px_0px_#065F46] shrink-0">
            <Building2 size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white font-serif">
                Panel Súper-Admin
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#10B981]/20 text-[#34D399] border border-[#10B981]/40">
                MASTER
              </span>
            </div>
            <p className="text-xs text-[#9CA3AF] mt-0.5">Control Central Multi-Local & Gestión de Tiendas</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => refreshShops()}
            disabled={isLoading}
            className="px-3 py-2 rounded-xl bg-[#141820] hover:bg-[#1B202B] border border-[#252A36] text-xs font-bold text-[#9CA3AF] hover:text-white transition-colors cursor-pointer"
            title="Recargar locales"
          >
            Actualizar
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut size={14} />
            <span>Salir</span>
          </button>
          {showCloseButton && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-[#141820] hover:bg-[#1B202B] border border-[#252A36] text-xs font-bold text-white transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-[#141820] border border-[#252A36]">
          <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase">Locales Totales</p>
          <p className="text-2xl font-bold text-white mt-0.5">{metrics.total}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-[#141820] border border-[#10B981]/30">
          <p className="text-[11px] font-semibold text-[#10B981] uppercase">Activas</p>
          <p className="text-2xl font-bold text-[#10B981] mt-0.5">{metrics.active}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-[#141820] border border-[#F59E0B]/30">
          <p className="text-[11px] font-semibold text-[#F59E0B] uppercase">Pausadas</p>
          <p className="text-2xl font-bold text-[#F59E0B] mt-0.5">{metrics.paused}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#252A36]">
        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            setActiveTab('list');
          }}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
            activeTab === 'list'
              ? 'border-[#10B981] text-[#10B981] bg-[#10B981]/5'
              : 'border-transparent text-[#9CA3AF] hover:text-white'
          }`}
        >
          Barberías Registradas ({shopsList.length})
        </button>
        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            setActiveTab('provision');
          }}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'provision'
              ? 'border-[#10B981] text-[#10B981] bg-[#10B981]/5'
              : 'border-transparent text-[#9CA3AF] hover:text-white'
          }`}
        >
          <Plus size={14} />
          <span>Dar de Alta Nueva Barbería</span>
        </button>
      </div>

      {/* TAB 1: Shop List */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shopsList.map((shop) => {
              const isShopActive = String(shop.status || '').toLowerCase() !== 'paused';
              const isCurrentSalon = shop.slug === activeShopSlug;
              const isPinShown = revealedPins[shop.slug];

              return (
                <div
                  key={shop.slug}
                  className={`p-4 sm:p-5 rounded-xl border transition-all ${
                    isCurrentSalon
                      ? 'bg-[#141820] border-[#10B981]/60 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                      : 'bg-[#141820]/70 border-[#252A36] hover:border-[#384152]'
                  }`}
                >
                  {/* Shop Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-white text-base leading-snug">{shop.name}</h3>
                        {isCurrentSalon && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#10B981] text-[#07090C]">
                            SALÓN EN USO
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-mono text-[#9CA3AF] mt-0.5">/r/{shop.slug}</p>
                    </div>

                    {/* Status Pill */}
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${
                        isShopActive
                          ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40'
                          : 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40'
                      }`}
                    >
                      {isShopActive ? 'ACTIVA' : 'PAUSADA'}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="space-y-1.5 text-xs text-[#9CA3AF] mb-4">
                    {shop.address && (
                      <p className="flex items-center gap-1.5 truncate">
                        <MapPin size={13} className="shrink-0 text-[#6B7280]" />
                        <span className="truncate">{shop.address}</span>
                      </p>
                    )}
                    {shop.phone && (
                      <p className="flex items-center gap-1.5">
                        <Phone size={13} className="shrink-0 text-[#6B7280]" />
                        <span>{shop.phone}</span>
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t border-[#252A36]/60">
                      <span className="flex items-center gap-1 text-[#D1D5DB]">
                        <Users size={13} className="text-[#10B981]" />
                        <span>{shop.barberCount || shop.barbers?.length || 1} barberos</span>
                      </span>
                      <div className="flex items-center gap-1 font-mono">
                        <span className="text-[#6B7280]">PIN:</span>
                        <span className="text-white font-bold">{isPinShown ? shop.pin || '1234' : '••••'}</span>
                        <button
                          type="button"
                          onClick={() => togglePinReveal(shop.slug)}
                          className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-white cursor-pointer"
                          title="Mostrar/Ocultar PIN"
                        >
                          {isPinShown ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Actions Deck */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-[#252A36]">
                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        switchShop(shop.slug, shop.pin);
                      }}
                      disabled={isCurrentSalon}
                      className={`py-2 px-3 min-h-[38px] rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isCurrentSalon
                          ? 'bg-[#10B981]/20 text-[#34D399] cursor-default'
                          : 'bg-[#1B202B] hover:bg-[#252A36] text-white border border-[#252A36]'
                      }`}
                    >
                      {isCurrentSalon ? 'Salón Activo' : 'Cambiar a Este'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStartEditShop(shop)}
                      className="py-2 px-3 min-h-[38px] rounded-lg bg-[#141820] hover:bg-[#1B202B] border border-[#10B981]/40 text-[#34D399] text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Edit3 size={13} />
                      <span>Editar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        soundFx.triggerHaptic(10);
                        toggleShopStatus(shop.slug);
                      }}
                      className={`py-2 px-3 min-h-[38px] rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        isShopActive
                          ? 'bg-[#F59E0B]/15 hover:bg-[#F59E0B]/25 text-[#F59E0B] border border-[#F59E0B]/40'
                          : 'bg-[#10B981]/15 hover:bg-[#10B981]/25 text-[#10B981] border border-[#10B981]/40'
                      }`}
                    >
                      <Power size={13} />
                      <span>{isShopActive ? 'Pausar' : 'Activar'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyLink(shop.slug)}
                      className="py-2 px-3 min-h-[38px] rounded-lg bg-[#141820] hover:bg-[#1B202B] border border-[#252A36] text-[#D1D5DB] text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      {copiedSlug === shop.slug ? <Check size={13} className="text-[#10B981]" /> : <Copy size={13} />}
                      <span>{copiedSlug === shop.slug ? '¡Copiado!' : 'Copiar QR'}</span>
                    </button>

                    <a
                      href={buildCustomerPortalUrl('', shop.slug)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 px-3 min-h-[38px] rounded-lg bg-[#141820] hover:bg-[#1B202B] border border-[#252A36] text-[#D1D5DB] text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                    >
                      <ExternalLink size={13} />
                      <span>Ver Portal</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => handleCopyPanelLink(shop.slug)}
                      className="py-2 px-3 min-h-[38px] rounded-lg bg-[#141820] hover:bg-[#1B202B] border border-[#252A36] text-[#D1D5DB] text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      title="Copiar URL limpia del panel privado (sin PIN en la URL)"
                    >
                      {copiedPanelSlug === shop.slug ? <Check size={13} className="text-[#10B981]" /> : <Copy size={13} />}
                      <span>{copiedPanelSlug === shop.slug ? '¡Copiado!' : 'Link Panel'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        setDpaShop(shop);
                      }}
                      className="py-2 px-3 min-h-[38px] rounded-lg bg-[#141820] hover:bg-[#1B202B] border border-[#10B981]/35 text-[#34D399] text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer col-span-2 sm:col-span-2"
                    >
                      <Scale size={13} />
                      <span>Contrato DPA (Art. 28)</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: Provision New Shop Form */}
      {activeTab === 'provision' && (
        <form onSubmit={handleProvisionSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1">
                Nombre de la Barbería *
              </label>
              <input
                type="text"
                value={newShopName}
                onChange={handleNameChange}
                placeholder="Ej. Barbería Los Andes"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#141820] border border-[#252A36] focus:border-[#10B981] focus:outline-none text-white text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1">
                Slug URL (Auto-derivado) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs text-[#6B7280] font-mono">/r/</span>
                <input
                  type="text"
                  value={newShopSlug}
                  onChange={(e) => setNewShopSlug(normalizeShopSlug(e.target.value))}
                  placeholder="barberia-los-andes"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#141820] border border-[#252A36] focus:border-[#10B981] focus:outline-none text-white text-sm font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1">
                PIN de 4 Dígitos del Barbero *
              </label>
              <input
                type="text"
                maxLength={4}
                value={newShopPin}
                onChange={(e) => setNewShopPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Ej. 1234"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#141820] border border-[#252A36] focus:border-[#10B981] focus:outline-none text-white text-sm font-mono tracking-widest"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1">
                Teléfono de Contacto
              </label>
              <input
                type="tel"
                value={newShopPhone}
                onChange={(e) => setNewShopPhone(e.target.value)}
                placeholder="+34 600 000 000"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#141820] border border-[#252A36] focus:border-[#10B981] focus:outline-none text-white text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1">
                Dirección Física
              </label>
              <input
                type="text"
                value={newShopAddress}
                onChange={(e) => setNewShopAddress(e.target.value)}
                placeholder="Calle Gran Vía 12, Madrid"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#141820] border border-[#252A36] focus:border-[#10B981] focus:outline-none text-white text-sm"
              />
            </div>
          </div>

          {/* Barbers Manager */}
          <div className="border-t border-[#252A36] pt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">
                Equipo de Barberos ({newShopBarbers.length})
              </label>
              <button
                type="button"
                onClick={handleAddBarber}
                className="text-xs font-bold text-[#10B981] hover:text-[#34D399] flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> Añadir Barbero
              </button>
            </div>
            <div className="space-y-2">
              {newShopBarbers.map((barber, idx) => (
                <div key={barber.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={barber.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewShopBarbers((prev) =>
                        prev.map((b, i) => (i === idx ? { ...b, name: val } : b))
                      );
                    }}
                    placeholder="Nombre del Barbero"
                    className="flex-1 px-3 py-2 rounded-lg bg-[#141820] border border-[#252A36] text-xs text-white"
                  />
                  <input
                    type="text"
                    value={barber.role}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewShopBarbers((prev) =>
                        prev.map((b, i) => (i === idx ? { ...b, role: val } : b))
                      );
                    }}
                    placeholder="Especialidad / Rol"
                    className="flex-1 px-3 py-2 rounded-lg bg-[#141820] border border-[#252A36] text-xs text-white"
                  />
                  {newShopBarbers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveBarber(idx)}
                      className="px-2 py-2 text-rose-400 hover:text-rose-300 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Services Manager */}
          <div className="border-t border-[#252A36] pt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">
                Servicios y Tarifas ({newShopServices.length})
              </label>
              <button
                type="button"
                onClick={handleAddService}
                className="text-xs font-bold text-[#10B981] hover:text-[#34D399] flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> Añadir Servicio
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                <span className="flex-2">Nombre del Servicio</span>
                <span className="w-20 text-center">Duración (min)</span>
                <span className="w-20 text-center">Precio (€)</span>
                {newShopServices.length > 1 && <span className="w-6" />}
              </div>
              {newShopServices.map((svc, idx) => (
                <div key={svc.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={svc.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewShopServices((prev) =>
                        prev.map((s, i) => (i === idx ? { ...s, name: val } : s))
                      );
                    }}
                    placeholder="Nombre del Servicio"
                    className="flex-2 px-3 py-2 rounded-lg bg-[#141820] border border-[#252A36] text-xs text-white"
                  />
                  <input
                    type="number"
                    value={svc.durationMinutes}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 30;
                      setNewShopServices((prev) =>
                        prev.map((s, i) => (i === idx ? { ...s, durationMinutes: val } : s))
                      );
                    }}
                    placeholder="Min"
                    className="w-20 px-3 py-2 rounded-lg bg-[#141820] border border-[#252A36] text-xs text-white"
                  />
                  <input
                    type="number"
                    value={svc.price}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setNewShopServices((prev) =>
                        prev.map((s, i) => (i === idx ? { ...s, price: val } : s))
                      );
                    }}
                    placeholder="€"
                    className="w-20 px-3 py-2 rounded-lg bg-[#141820] border border-[#252A36] text-xs text-white"
                  />
                  {newShopServices.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveService(idx)}
                      className="px-2 py-2 text-rose-400 hover:text-rose-300 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Horario y Frecuencia de Citas */}
          <div className="p-4 rounded-xl bg-[#0A0C0F] border border-[#252A36] space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] block">
              Horario de Apertura y Frecuencia de Citas
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-[11px] text-[#9CA3AF] block mb-1">Apertura (Hora)</span>
                <select
                  value={newShopStartHour}
                  onChange={(e) => setNewShopStartHour(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-[#141820] border border-[#252A36] text-xs text-white"
                >
                  {[7, 8, 9, 10, 11, 12].map((h) => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="text-[11px] text-[#9CA3AF] block mb-1">Cierre (Hora)</span>
                <select
                  value={newShopEndHour}
                  onChange={(e) => setNewShopEndHour(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-[#141820] border border-[#252A36] text-xs text-white"
                >
                  {[18, 19, 20, 21, 22, 23].map((h) => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="text-[11px] text-[#34D399] font-bold block mb-1">Citas cada:</span>
                <select
                  value={newShopSlotMinutes}
                  onChange={(e) => setNewShopSlotMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-[#141820] border border-[#10B981]/60 text-xs font-bold text-white"
                >
                  <option value={30}>Cada 30 min</option>
                  <option value={45}>Cada 45 min</option>
                  <option value={60}>Cada 1 hora (60 min)</option>
                </select>
              </div>
            </div>
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="p-3 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30 text-[#34D399] text-xs flex items-center gap-2">
              <Check size={15} className="shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#07090C] font-bold text-sm tracking-wide uppercase transition-all shadow-[0_4px_14px_rgba(16,185,129,0.35)] cursor-pointer"
            >
              {isLoading ? 'Guardando en la nube...' : 'Dar de Alta Barbería en 1 Minuto'}
            </button>
          </div>
        </form>
      )}

      <LegalComplianceModal
        isOpen={Boolean(dpaShop)}
        onClose={() => setDpaShop(null)}
        shop={dpaShop}
        shopSlug={dpaShop?.slug || activeShopSlug}
        publicOnly={false}
        initialTab="dpa"
      />
    </div>
  );
}
