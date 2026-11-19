import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Sparkles,
  Scissors,
  Radio,
  Tv,
  Zap,
  Film,
  Search,
  Image as ImageIcon,
  Star,
  QrCode,
  Lock,
} from 'lucide-react';
import AIAssistantModal from './AIAssistantModal';
import WalkInKioskModal from './WalkInKioskModal';
import NoShowShieldModal from './NoShowShieldModal';
import ReelStudioModal from './ReelStudioModal';
import CommandPalette from './CommandPalette';
import SuperAdminModal from './SuperAdminModal';
import QRPosterModal, { BarberPinLockModal } from './QRPosterModal';
import { useClients } from '../context/ClientContext';
import { useShop } from '../context/ShopContext';
import { soundFx } from '../lib/soundFx';

const WALLPAPER_THEMES = [
  {
    id: 'urban',
    name: 'Estudio Urbano',
    url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=85&w=1920',
    opacityClass: 'opacity-75',
  },
  {
    id: 'razor',
    name: 'Navaja & Luces',
    url: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&q=85&w=1920',
    opacityClass: 'opacity-75',
  },
  {
    id: 'club',
    name: 'Barber Club',
    url: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&q=85&w=1920',
    opacityClass: 'opacity-75',
  },
  {
    id: 'matte',
    name: 'Negro Mate',
    url: null,
    opacityClass: 'opacity-0',
  },
];

const Layout = () => {
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [isKioskOpen, setIsKioskOpen] = useState(false);
  const [isNoShowOpen, setIsNoShowOpen] = useState(false);
  const [isReelOpen, setIsReelOpen] = useState(false);
  const [isCmdKOpen, setIsCmdKOpen] = useState(false);
  const [isQRPosterOpen, setIsQRPosterOpen] = useState(false);
  const [isPinLocked, setIsPinLocked] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(true);
  const [wallpaperIdx, setWallpaperIdx] = useState(() => {
    try {
      const saved = localStorage.getItem('kutz_wallpaper_idx');
      const parsed = saved ? parseInt(saved, 10) : 0;
      return parsed >= 0 && parsed < WALLPAPER_THEMES.length ? parsed : 0;
    } catch {
      return 0;
    }
  });

  const { activeModeConfig, clients } = useClients();
  const {
    activeShop,
    activeShopSlug,
    isSuperAdminOpen,
    openSuperAdmin,
    closeSuperAdmin,
    needsPinSync,
    verifyAndUnlockShopPin,
  } = useShop();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCmdKOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCycleWallpaper = () => {
    soundFx.playClick();
    soundFx.triggerHaptic(10);
    setWallpaperIdx((prev) => {
      const next = (prev + 1) % WALLPAPER_THEMES.length;
      try {
        localStorage.setItem('kutz_wallpaper_idx', String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const currentWallpaper = WALLPAPER_THEMES[wallpaperIdx] || WALLPAPER_THEMES[0];
  const starClient = clients.find((c) => String(c.id) === '3') || clients[0];
  void openSuperAdmin;

  const mainNav = [
    { path: '/', icon: LayoutDashboard, label: 'Salón Hoy' },
    { path: '/clients', icon: Users, label: 'Clientes 3D' },
  ];

  return (
    <div className="flex h-screen min-h-[100dvh] bg-[#0A0C0F] text-[#F3F4F6] overflow-hidden relative">
      {/* Fondo Atmosférico Real de Barbería (Nítido y visible, cambia con 1 toque) */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none" aria-hidden="true">
        {currentWallpaper.url && (
          <img
            key={currentWallpaper.id}
            src={currentWallpaper.url}
            alt=""
            className={`w-full h-full object-cover object-center ${currentWallpaper.opacityClass} filter saturate-105 contrast-105 transition-all duration-700 ease-out`}
            loading="eager"
          />
        )}

        {/* Grano industrial sutil */}
        <div
          className="absolute inset-0 opacity-[0.02] mix-blend-overlay"
          style={{
            backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.25) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Veladura ligera para que el fondo se vea nítido sin perder lectura */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A0C0F]/45 via-[#0A0C0F]/30 to-[#0A0C0F]/55" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#10B981]/10 via-transparent to-[#0A0C0F]/45" />
      </div>

      {/* Sidebar Escritorio — Limpia, Clara y Cañera */}
      <aside className="hidden md:flex w-72 bg-[#101318]/80 backdrop-blur-sm border-r border-[#252A36] flex-col justify-between shadow-[6px_0_35px_rgba(0,0,0,0.65)] z-20">
        <div className="overflow-y-auto no-scrollbar">
          {/* Marca */}
          <div className="p-5 border-b border-[#252A36]">
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 rounded-xl bg-[#10B981] text-[#07090C] flex items-center justify-center shadow-[3px_3px_0px_#065F46] shrink-0">
                <Scissors size={22} strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-2xl font-serif font-black tracking-tight text-white leading-none uppercase">
                  KUTZ <span className="text-[#10B981]">BARBER</span>
                </h1>
                <p className="text-[11px] text-[#9CA3AF] mt-1 font-medium">
                  Control diario de barbería
                </p>
              </div>
            </div>

            {/* Estado del Local en 1 Toque */}
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                setWalkInOpen(!walkInOpen);
              }}
              className={`mt-4 w-full px-3.5 py-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                walkInOpen
                  ? 'bg-[#10B981]/15 border-[#10B981]/50 hover:bg-[#10B981]/25'
                  : 'bg-[#F59E0B]/15 border-[#F59E0B]/50 hover:bg-[#F59E0B]/25'
              }`}
              title="Toca para cambiar si coges gente sin cita"
            >
              <div className="flex items-center space-x-2">
                <Radio size={15} className={walkInOpen ? 'text-[#10B981] animate-pulse' : 'text-[#F59E0B]'} />
                <span className="text-xs font-bold text-white">
                  {walkInOpen ? 'Abiertos · Sin cita' : 'Solo con cita previa'}
                </span>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  walkInOpen ? 'bg-[#10B981] text-[#07090C]' : 'bg-[#F59E0B] text-[#07090C]'
                }`}
              >
                {walkInOpen ? 'ON' : 'VIP'}
              </span>
            </button>
          </div>

          {/* Navegación Principal */}
          <nav className="p-4 space-y-2">
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
              Menú Principal
            </p>

            {mainNav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  onClick={() => soundFx.playClick()}
                  className={({ isActive }) => {
                    const isTabActive = isActive || (item.path === '/' && location.pathname === '/dashboard');
                    return `flex items-center space-x-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-150 ${
                      isTabActive
                        ? 'bg-[#10B981] text-[#07090C] shadow-[3px_3px_0px_#065F46]'
                        : 'text-[#E5E7EB] bg-[#141820]/70 hover:bg-[#1B202B] hover:text-white border border-transparent hover:border-[#252A36]'
                    }`;
                  }}
                >
                  <Icon size={19} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}

            <div className="pt-4">
              <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                Herramientas del Salón
              </p>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setIsKioskOpen(true);
                  }}
                  className="w-full px-3.5 py-3 rounded-xl bg-[#141820]/80 hover:bg-[#1B202B] border border-[#252A36] hover:border-[#10B981]/60 flex items-center space-x-3 text-left transition-all cursor-pointer group"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#10B981]/15 text-[#10B981] flex items-center justify-center shrink-0">
                    <Tv size={18} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-white block leading-tight">Pantalla TV</span>
                    <span className="text-[11px] text-[#9CA3AF] block truncate">Turnos en sala de espera</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setIsNoShowOpen(true);
                  }}
                  className="w-full px-3.5 py-3 rounded-xl bg-[#141820]/80 hover:bg-[#1B202B] border border-[#252A36] hover:border-[#F59E0B]/60 flex items-center space-x-3 text-left transition-all cursor-pointer group"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#F59E0B]/15 text-[#F59E0B] flex items-center justify-center shrink-0">
                    <Zap size={18} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-white block leading-tight">Rellenar Huecos</span>
                    <span className="text-[11px] text-[#9CA3AF] block truncate">Avisar si alguien cancela</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setIsReelOpen(true);
                  }}
                  className="w-full px-3.5 py-3 rounded-xl bg-[#141820]/80 hover:bg-[#1B202B] border border-[#252A36] hover:border-[#10B981]/60 flex items-center space-x-3 text-left transition-all cursor-pointer group"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#10B981]/15 text-[#34D399] flex items-center justify-center shrink-0">
                    <Film size={18} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-white block leading-tight">Crear Reel 9:16</span>
                    <span className="text-[11px] text-[#9CA3AF] block truncate">Antes y después para redes</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setIsAIOpen(true);
                  }}
                  className="w-full px-3.5 py-3 rounded-xl bg-[#141820]/80 hover:bg-[#1B202B] border border-[#252A36] hover:border-[#10B981]/60 flex items-center space-x-3 text-left transition-all cursor-pointer group"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#10B981]/15 text-[#10B981] flex items-center justify-center shrink-0">
                    <Sparkles size={18} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-white block leading-tight">Asistente Rápido</span>
                    <span className="text-[11px] text-[#9CA3AF] block truncate">Preguntar sobre clientes</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setIsQRPosterOpen(true);
                  }}
                  className="w-full px-3.5 py-3 rounded-xl bg-[#10B981]/15 hover:bg-[#10B981]/25 border border-[#10B981]/50 flex items-center space-x-3 text-left transition-all cursor-pointer group"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#10B981] text-[#07090C] flex items-center justify-center shrink-0">
                    <QrCode size={18} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-white block leading-tight">Mi Cartel QR</span>
                    <span className="text-[11px] text-[#34D399] block truncate">Reservas desde el móvil</span>
                  </div>
                </button>
              </div>
            </div>
          </nav>
        </div>

        {/* Pie Sidebar: Acceso rápido a ficha destacada y nombre del salón */}
        <div className="p-4 border-t border-[#252A36] space-y-2.5 bg-[#0E1117]/80">
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              navigate(starClient ? `/clients/${starClient.id}` : '/clients');
            }}
            className="w-full px-3 py-2.5 rounded-xl bg-[#141820] hover:bg-[#1B202B] border border-[#10B981]/40 flex items-center justify-between text-left transition-all cursor-pointer"
          >
            <div className="flex items-center space-x-2 min-w-0">
              <Star size={14} className="text-[#10B981] fill-[#10B981] shrink-0" />
              <span className="text-xs font-bold text-white truncate">
                {starClient ? `Ficha VIP: ${starClient.name.split(' ')[0]}` : 'Directorio Clientes 3D'}
              </span>
            </div>
            <span className="text-[10px] font-bold text-[#34D399] shrink-0">Abrir →</span>
          </button>

          <div className="flex items-center justify-between px-1 text-[11px] text-[#9CA3AF]">
            <span className="font-semibold truncate">{activeShop?.name || activeModeConfig?.shortName || 'KUTZ BARBER'}</span>
            <span className={activeShop?.status === 'paused' ? 'text-[#F59E0B] font-semibold' : 'text-[#34D399] font-semibold'}>
              ● {activeShop?.status === 'paused' ? 'Pausado' : 'Online'}
            </span>
          </div>
        </div>
      </aside>

      {/* Zona Principal */}
      <div className="flex-1 flex flex-col h-screen min-h-[100dvh] overflow-hidden relative z-10">
        {/* Barra Superior Limpia (0px overflow en 375px y 390px): Marca + Buscador + Acciones Rápidas */}
        <header className="bg-[#101318]/75 backdrop-blur-sm border-b border-[#252A36] px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 z-30">
          {/* Logo y salón activo en móvil */}
          <div className="flex items-center space-x-2 min-w-0 flex-1 md:hidden">
            <div className="w-8 h-8 rounded-xl bg-[#10B981] text-[#07090C] flex items-center justify-center shadow-[2px_2px_0px_#065F46] shrink-0">
              <Scissors size={16} strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xs font-serif font-black text-white leading-tight uppercase truncate">
                {activeShop?.name || 'KUTZ BARBER'}
              </h1>
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setWalkInOpen(!walkInOpen);
                }}
                className="text-[10px] font-semibold text-[#34D399] block truncate"
              >
                {walkInOpen ? '🟢 Abiertos (Sin cita)' : '🟡 Solo con cita'}
              </button>
            </div>
          </div>

          {/* Barra de búsqueda rápida escritorio */}
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              setIsCmdKOpen(true);
            }}
            className="hidden md:flex items-center justify-between flex-1 max-w-md px-4 py-2 rounded-xl bg-[#141820]/90 hover:bg-[#1B202B] border border-[#252A36] hover:border-[#10B981]/50 text-xs text-[#9CA3AF] hover:text-white transition-all cursor-pointer"
          >
            <span className="flex items-center space-x-2.5">
              <Search size={15} className="text-[#10B981]" />
              <span>Buscar cliente, teléfono o corte rápido...</span>
            </span>
            <span className="text-[10px] font-mono bg-[#0A0C0F] px-2 py-0.5 rounded border border-[#252A36] text-[#9CA3AF]">
              Ctrl + K
            </span>
          </button>

          {/* Botones directos compactos (0px overflow en 375px / 390px) */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            {/* Insignia del Salón Activo en Escritorio (sin botón Admin expuesto al barbero) */}
            <div
              className="hidden md:flex px-3 py-2 min-h-[40px] rounded-xl bg-[#141820]/90 border border-[#252A36] text-xs font-bold text-white items-center space-x-2"
              title="Barbería activa"
            >
              <span className={`w-2 h-2 rounded-full ${activeShop?.status === 'paused' ? 'bg-[#F59E0B]' : 'bg-[#10B981] animate-pulse'}`} />
              <span className="truncate max-w-[180px]">{activeShop?.name || activeShopSlug}</span>
            </div>

            {/* Botón directo Mi Cartel QR */}
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                setIsQRPosterOpen(true);
              }}
              className="px-2.5 sm:px-3 py-2 min-h-[40px] rounded-xl bg-[#10B981] hover:bg-[#34D399] text-[#07090C] text-xs font-black flex items-center space-x-1 transition-all cursor-pointer shadow-sm shrink-0"
              title="Ver e imprimir el Cartel QR de reservas del local"
            >
              <QrCode size={15} />
              <span className="text-[11px] sm:text-xs">Mi QR</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                setIsCmdKOpen(true);
              }}
              className="md:hidden p-2 min-h-[40px] min-w-[38px] rounded-xl bg-[#141820] border border-[#252A36] text-[#D1D5DB] flex items-center justify-center shrink-0 cursor-pointer"
              aria-label="Buscar cliente"
              title="Buscar cliente"
            >
              <Search size={16} />
            </button>

            <button
              type="button"
              onClick={handleCycleWallpaper}
              className="p-2 sm:px-3 sm:py-2 min-h-[40px] min-w-[38px] rounded-xl bg-[#141820]/90 hover:bg-[#1B202B] border border-[#252A36] hover:border-[#10B981]/50 text-xs font-bold text-white flex items-center justify-center space-x-1.5 transition-all cursor-pointer shrink-0"
              title="Cambiar foto de fondo de la barbería"
              aria-label="Cambiar fondo"
            >
              <ImageIcon size={15} className="text-[#10B981]" />
              <span className="hidden sm:inline">Fondo: {currentWallpaper.name}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                setIsPinLocked(true);
              }}
              className="p-2 min-h-[40px] min-w-[38px] rounded-xl bg-[#141820]/90 hover:bg-[#1B202B] border border-[#252A36] hover:border-[#F59E0B]/50 text-[#9CA3AF] hover:text-[#FBBF24] flex items-center justify-center transition-all cursor-pointer shrink-0"
              title="Bloquear pantalla con PIN de 4 dígitos"
              aria-label="Bloquear con PIN"
            >
              <Lock size={15} />
            </button>
          </div>
        </header>

        {/* Contenido Principal con scroll fluido */}
        <main className="flex-1 overflow-y-auto pb-24 md:pb-10 scroll-smooth">
          <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
            <Outlet
              context={{
                openKiosk: () => setIsKioskOpen(true),
                openNoShow: () => setIsNoShowOpen(true),
                openReel: () => setIsReelOpen(true),
                openAssistant: () => setIsAIOpen(true),
                openQRPoster: () => setIsQRPosterOpen(true),
                lockScreen: () => setIsPinLocked(true),
              }}
            />
          </div>
        </main>

        {/* Barra de Navegación Inferior Móvil (4 botones claros y grandes con safe-area) */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 bg-[#101318]/95 backdrop-blur-lg border-t border-[#252A36] flex justify-around pt-2 px-2 z-40 shadow-[0_-4px_25px_rgba(0,0,0,0.65)]"
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
          {mainNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={() => soundFx.playClick()}
                className={({ isActive }) => {
                  const isTabActive = isActive || (item.path === '/' && location.pathname === '/dashboard');
                  return `flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all min-w-[64px] ${
                    isTabActive ? 'text-[#10B981] font-bold' : 'text-[#9CA3AF]'
                  }`;
                }}
              >
                <Icon size={20} />
                <span className="text-[11px] mt-1">{item.label}</span>
              </NavLink>
            );
          })}

          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              setIsKioskOpen(true);
            }}
            className="flex flex-col items-center justify-center py-1.5 px-3 rounded-xl text-[#9CA3AF] hover:text-white min-w-[64px]"
          >
            <Tv size={20} />
            <span className="text-[11px] mt-1">Modo TV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              setIsReelOpen(true);
            }}
            className="flex flex-col items-center justify-center py-1.5 px-3 rounded-xl text-[#9CA3AF] hover:text-white min-w-[64px]"
          >
            <Film size={20} />
            <span className="text-[11px] mt-1">Reels</span>
          </button>
        </nav>
      </div>

      {/* Modales */}
      <AIAssistantModal isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />

      <WalkInKioskModal isOpen={isKioskOpen} onClose={() => setIsKioskOpen(false)} />

      <NoShowShieldModal isOpen={isNoShowOpen} onClose={() => setIsNoShowOpen(false)} />

      <ReelStudioModal
        isOpen={isReelOpen}
        onClose={() => setIsReelOpen(false)}
        client={starClient}
        treatment={starClient?.treatments?.[0]}
      />

      <CommandPalette
        isOpen={isCmdKOpen}
        onClose={() => setIsCmdKOpen(false)}
        onOpenKiosk={() => setIsKioskOpen(true)}
        onOpenNoShow={() => setIsNoShowOpen(true)}
        onOpenReel={() => setIsReelOpen(true)}
      />

      <SuperAdminModal
        isOpen={isSuperAdminOpen}
        onClose={closeSuperAdmin}
      />

      <QRPosterModal
        isOpen={isQRPosterOpen}
        onClose={() => setIsQRPosterOpen(false)}
        onLockScreen={() => setIsPinLocked(true)}
      />

      <BarberPinLockModal
        isOpen={isPinLocked || needsPinSync}
        expectedPin={activeShop?.pin || '1234'}
        shopName={activeShop?.name || 'KUTZ BARBER'}
        onVerifyPin={verifyAndUnlockShopPin}
        onCancel={isPinLocked && !needsPinSync ? () => setIsPinLocked(false) : null}
        onUnlock={() => setIsPinLocked(false)}
      />
    </div>
  );
};

export default Layout;
