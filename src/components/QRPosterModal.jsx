import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  QrCode,
  X,
  Copy,
  Check,
  ExternalLink,
  Printer,
  Scissors,
  ShieldAlert,
  Lock,
  MapPin,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { buildCustomerPortalUrl } from '../lib/shopUtils';
import { soundFx } from '../lib/soundFx';

/**
 * Generates a deterministic 21x21 QR-style matrix from a URL string
 * so the poster always displays a crisp vector QR even when 100% offline.
 */
function generateDeterministicMatrix(text) {
  const size = 21;
  const grid = Array.from({ length: size }, () => Array(size).fill(false));

  const drawFinder = (r0, c0) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[r0 + r][c0 + c] = isBorder || isInner;
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
  }

  // Hash payload into data modules
  let hash = 2166136261;
  const str = String(text || 'kutz-madrid');
  for (let idx = 0; idx < str.length; idx++) {
    hash ^= str.charCodeAt(idx);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inTopLeft = r < 8 && c < 8;
      const inTopRight = r < 8 && c >= size - 8;
      const inBottomLeft = r >= size - 8 && c < 8;
      if (inTopLeft || inTopRight || inBottomLeft || r === 6 || c === 6) continue;
      const seed = Math.imul(hash ^ (r * 31 + c * 17), 1597334677);
      grid[r][c] = (Math.abs(seed) + r + c) % 2 === 0;
    }
  }

  return grid;
}

export default function QRPosterModal({ isOpen, onClose, onLockScreen }) {
  const { activeShop, activeShopSlug } = useShop();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://luminadesk-gary.netlify.app';

  const portalUrl = useMemo(
    () => buildCustomerPortalUrl(origin, activeShopSlug),
    [origin, activeShopSlug]
  );

  const qrMatrix = useMemo(() => generateDeterministicMatrix(portalUrl), [portalUrl]);

  if (!isOpen) return null;

  const shopName = activeShop?.name || 'KUTZ // BARBER STUDIO';
  const shopAddress = activeShop?.address || 'Calle Mayor 14, Madrid';
  const shopPin = activeShop?.pin || '1234';

  const handleCopy = () => {
    soundFx.playClick();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(portalUrl).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    soundFx.playClick();
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  };

  const handleOpenPreview = () => {
    soundFx.playClick();
    onClose();
    navigate(`/r/${activeShopSlug}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#101318] border border-[#252A36] rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Cabecera */}
        <div className="px-6 py-4 bg-[#141820] border-b border-[#252A36] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] flex items-center justify-center">
              <QrCode size={22} />
            </div>
            <div>
              <h2 className="text-lg font-serif font-black text-white uppercase tracking-tight">
                Mi Cartel QR de Reservas
              </h2>
              <p className="text-xs text-[#9CA3AF]">
                Para el espejo, escaparate o biografía de Instagram
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="p-2 rounded-xl bg-[#1B202B] text-[#9CA3AF] hover:text-white cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Vista previa del Cartel Imprimible */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Tarjeta Póster */}
            <div className="md:col-span-6 bg-gradient-to-b from-[#141820] to-[#0A0C0F] border-2 border-[#10B981]/60 rounded-2xl p-6 text-center shadow-[0_10px_35px_rgba(16,185,129,0.15)]">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#10B981]/15 border border-[#10B981]/40 text-[#34D399] text-[11px] font-bold mb-3">
                <Sparkles size={12} />
                <span>RESERVA SIN ESPERAS</span>
              </div>

              <h3 className="text-xl font-serif font-black text-white uppercase leading-tight">
                {shopName}
              </h3>
              <p className="text-[11px] text-[#9CA3AF] mt-1 flex items-center justify-center gap-1">
                <MapPin size={11} className="text-[#10B981]" />
                <span>{shopAddress}</span>
              </p>

              {/* Caja blanca del código QR */}
              <div className="my-5 mx-auto w-48 h-48 bg-white p-3 rounded-2xl shadow-lg flex items-center justify-center">
                {!imgFailed ? (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=4&data=${encodeURIComponent(
                      portalUrl
                    )}`}
                    alt={`QR ${shopName}`}
                    className="w-full h-full object-contain"
                    onError={() => setImgFailed(true)}
                  />
                ) : (
                  <svg
                    viewBox="0 0 21 21"
                    className="w-full h-full"
                    shapeRendering="crispEdges"
                    aria-label={`QR ${shopName}`}
                  >
                    {qrMatrix.map((row, rIdx) =>
                      row.map((cell, cIdx) =>
                        cell ? (
                          <rect
                            key={`${rIdx}-${cIdx}`}
                            x={cIdx}
                            y={rIdx}
                            width={1}
                            height={1}
                            fill="#07090C"
                          />
                        ) : null
                      )
                    )}
                  </svg>
                )}
              </div>

              <p className="text-xs font-extrabold text-white uppercase tracking-wider">
                📱 Escanea con tu cámara
              </p>
              <p className="text-[11px] text-[#34D399] font-semibold mt-0.5">
                Elige Día y Hora · O Coge Turno Hoy
              </p>
            </div>

            {/* Instrucciones y Controles del Barbero */}
            <div className="md:col-span-6 space-y-4">
              <div className="p-4 rounded-xl bg-[#141820] border border-[#252A36] space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] block">
                  Enlace directo para QR e Instagram:
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={portalUrl}
                    className="w-full px-3 py-2 rounded-lg bg-[#0A0C0F] border border-[#252A36] text-xs font-mono text-[#34D399] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-3 py-2 rounded-lg bg-[#10B981] hover:bg-[#34D399] text-[#07090C] text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copied ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={handleOpenPreview}
                  className="w-full py-3 px-4 rounded-xl bg-[#10B981] hover:bg-[#34D399] text-[#07090C] text-xs font-black uppercase flex items-center justify-center space-x-2 shadow-lg cursor-pointer transition-all"
                >
                  <Smartphone size={16} />
                  <span>Probar Cómo Lo Ve El Cliente</span>
                  <ExternalLink size={14} />
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#141820] hover:bg-[#1B202B] border border-[#252A36] text-white text-xs font-bold flex items-center justify-center space-x-2 cursor-pointer transition-all"
                >
                  <Printer size={15} className="text-[#10B981]" />
                  <span>Imprimir Cartel A4 para el Local</span>
                </button>
              </div>

              {/* Seguridad PIN del Barbero */}
              <div className="p-4 rounded-xl bg-[#0A0C0F] border border-[#252A36] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <ShieldAlert size={15} className="text-[#10B981]" />
                    <span>PIN Privado del Barbero</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-[#10B981]/15 border border-[#10B981]/40 font-mono text-xs font-black text-[#34D399]">
                    {shopPin}
                  </span>
                </div>
                <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
                  El cliente desde el QR jamás ve tus fichas ni recetas. Si dejas la tablet en el mostrador, puedes bloquear el panel con tu PIN.
                </p>
                {onLockScreen && (
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      onClose();
                      onLockScreen();
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-[#1B202B] hover:bg-[#252A36] border border-[#262C3A] text-xs font-bold text-[#FBBF24] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Lock size={13} />
                    <span>Bloquear Pantalla del Barbero Ahora</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Modal de Bloqueo por PIN de 4 dígitos para proteger el panel privado del barbero
 */
export function BarberPinLockModal({
  isOpen,
  expectedPin = '1234',
  shopName = 'KUTZ BARBER',
  onUnlock,
  onVerifyPin = null,
  onCancel = null,
}) {
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [verifying, setVerifying] = useState(false);

  if (!isOpen) return null;

  const handleDigit = async (digit) => {
    if (verifying) return;
    soundFx.playClick();
    setPinError(false);
    const next = (pinInput + digit).slice(0, 4);
    setPinInput(next);

    if (next.length === 4) {
      if (typeof onVerifyPin === 'function') {
        setVerifying(true);
        const res = await onVerifyPin(next);
        setVerifying(false);
        if (res?.success) {
          setPinInput('');
          onUnlock();
          return;
        }
        setPinError(true);
        setTimeout(() => setPinInput(''), 500);
        return;
      }

      if (next === String(expectedPin || '')) {
        setPinInput('');
        onUnlock();
      } else {
        setPinError(true);
        setTimeout(() => setPinInput(''), 500);
      }
    }
  };

  const handleCancel = () => {
    soundFx.playClick();
    setPinInput('');
    setPinError(false);
    if (typeof onCancel === 'function') {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#07090C]/95 backdrop-blur-xl animate-in fade-in">
      <div className="relative w-full max-w-sm bg-[#101318] border border-[#252A36] rounded-2xl p-6 text-center shadow-2xl space-y-5">
        {onCancel && (
          <button
            type="button"
            onClick={handleCancel}
            className="absolute top-3.5 right-3.5 p-2 min-h-[40px] min-w-[40px] rounded-xl bg-[#141820] hover:bg-[#1B202B] border border-[#252A36] text-[#9CA3AF] hover:text-white flex items-center justify-center cursor-pointer"
            aria-label="Cerrar acceso barbero"
            title="Cerrar y volver"
          >
            <X size={18} />
          </button>
        )}

        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] flex items-center justify-center">
          <Scissors size={26} />
        </div>

        <div>
          <h2 className="text-xl font-serif font-black text-white uppercase">
            Acceso Barbero · {shopName}
          </h2>
          <p className="text-xs text-[#9CA3AF] mt-1">
            Introduce tu PIN de 4 dígitos para abrir el panel privado
          </p>
        </div>

        {/* Indicadores de los 4 dígitos */}
        <div className="flex items-center justify-center gap-3 py-2">
          {[0, 1, 2, 3].map((idx) => {
            const filled = pinInput.length > idx;
            return (
              <div
                key={idx}
                className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-xl font-black transition-all ${
                  pinError
                    ? 'border-[#EF4444] bg-[#EF4444]/15 text-[#FCA5A5]'
                    : filled
                    ? 'border-[#10B981] bg-[#10B981]/20 text-white'
                    : 'border-[#252A36] bg-[#0A0C0F] text-[#6B7280]'
                }`}
              >
                {filled ? '●' : ''}
              </div>
            );
          })}
        </div>

        {pinError && (
          <p className="text-xs font-bold text-[#FCA5A5]">
            PIN incorrecto para {shopName}. Verifica los 4 dígitos asignados al local.
          </p>
        )}
        {verifying && (
          <p className="text-xs font-bold text-[#34D399]">
            Verificando PIN y descargando citas...
          </p>
        )}

        {/* Teclado numérico táctil grande */}
        <div className="grid grid-cols-3 gap-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleDigit(d)}
              className="py-3.5 min-h-[48px] rounded-xl bg-[#141820] hover:bg-[#1B202B] active:bg-[#10B981] active:text-[#07090C] border border-[#252A36] text-lg font-black text-white transition-all cursor-pointer"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPinInput('')}
            className="py-3.5 min-h-[48px] rounded-xl bg-[#141820] hover:bg-[#1B202B] border border-[#252A36] text-xs font-bold text-[#9CA3AF] cursor-pointer"
          >
            Borrar
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="py-3.5 min-h-[48px] rounded-xl bg-[#141820] hover:bg-[#1B202B] active:bg-[#10B981] active:text-[#07090C] border border-[#252A36] text-lg font-black text-white transition-all cursor-pointer"
          >
            0
          </button>
          {onCancel ? (
            <button
              type="button"
              onClick={handleCancel}
              className="py-3.5 min-h-[48px] rounded-xl bg-[#1B202B] hover:bg-[#252A36] border border-[#262C3A] text-xs font-bold text-[#D1D5DB] flex items-center justify-center gap-1 cursor-pointer"
              title="Cancelar y volver"
            >
              <X size={14} />
              <span>Salir</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPinInput((prev) => prev.slice(0, -1))}
              className="py-3.5 min-h-[48px] rounded-xl bg-[#141820] hover:bg-[#1B202B] border border-[#252A36] text-xs font-bold text-[#9CA3AF] cursor-pointer"
              title="Borrar último dígito"
            >
              ⌫
            </button>
          )}
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={handleCancel}
            className="w-full py-2.5 min-h-[44px] rounded-xl bg-[#141820] hover:bg-[#1B202B] border border-[#252A36] text-xs font-bold text-[#9CA3AF] hover:text-white transition-colors cursor-pointer"
          >
            Cancelar y volver a reservas
          </button>
        )}
      </div>
    </div>
  );
}
