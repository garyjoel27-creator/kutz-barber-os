import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Scale,
  FileText,
  Download,
  Printer,
  Lock,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

function buildDpaDraftText({ shopName, shopSlug, shopAddress, shopPhone, formattedDate }) {
  return `CONTRATO DE ENCARGO DEL TRATAMIENTO DE DATOS PERSONALES (ART. 28 RGPD)
======================================================================
Plataforma tecnológica: KUTZ // BARBER OS
Fecha de emisión del borrador: ${formattedDate}

1. PARTES CONTRATANTES
----------------------
A) RESPONSABLE DEL TRATAMIENTO (EL ESTABLECIMIENTO):
   - Nombre comercial / Salón: ${shopName}
   - Identificador de entorno (slug): ${shopSlug}
   - Dirección: ${shopAddress || '[Completar dirección fiscal del establecimiento]'}
   - Teléfono: ${shopPhone || '[Completar teléfono]'}
   - NIF / CIF: [Completar NIF/CIF del establecimiento]

B) ENCARGADO DEL TRATAMIENTO (PROVEEDOR TECNOLÓGICO):
   - Titular / Razón Social: [NOMBRE O RAZÓN SOCIAL DEL TITULAR DE KUTZ BARBER OS]
   - NIF / CIF: [NIF/CIF DEL PROVEEDOR]
   - Domicilio fiscal: [DOMICILIO FISCAL EN ESPAÑA / UE]
   - Correo de contacto RGPD: [EMAIL LEGAL / PRIVACIDAD]

2. OBJETO Y DURACIÓN DEL ENCARGO
--------------------------------
El Encargado presta al Responsable el servicio SaaS de gestión de citas QR, cola de espera en sala, fichas técnicas de corte/barbería y control operativo interno ("KUTZ // BARBER OS"). La duración del presente encargo coincide con la vigencia de la prestación del servicio SaaS.

3. CATEGORÍAS DE INTERESADOS Y DATOS TRATADOS
---------------------------------------------
- Interesados: Clientes del establecimiento y profesionales/barberos asignados.
- Datos identificativos y de contacto: Nombre, teléfono móvil (WhatsApp), correo electrónico opcional.
- Datos operativos: Historial de citas, preferencias técnicas de corte y peines, bonos internos.
- Categorías especiales (Art. 9 RGPD, si se registran): Notas sobre sensibilidad cutánea/alergias a cosméticos o afeitado y fotografías Antes/Después (siempre bajo consentimiento explícito recabado por el Responsable).

4. OBLIGACIONES DEL ENCARGADO (ART. 28.3 RGPD)
----------------------------------------------
a) Tratar los datos personales únicamente siguiendo instrucciones documentadas del Responsable.
b) Garantizar el deber de confidencialidad de las personas autorizadas.
c) Aplicar medidas técnicas y organizativas de seguridad (Art. 32 RGPD): cifrado en tránsito (HTTPS/TLS), aislamiento multi-inquilino por establecimiento, protección anti fuerza bruta sobre PIN (bloqueo 15 min tras 5 intentos fallidos) y registro de auditoría de operaciones sensibles.
d) Asistir al Responsable en la atención de derechos ARSOPOL (Acceso, Rectificación, Supresión, Oposición, Portabilidad en JSON y Limitación) mediante herramientas integradas en la ficha del cliente.
e) Notificar al Responsable cualquier violación de la seguridad de los datos personales sin dilación indebida (máximo 48 horas desde su conocimiento) para facilitar, en su caso, la notificación a la AEPD en plazo de 72 horas.
f) A la finalización del servicio, poner a disposición del Responsable la exportación de datos y proceder a su supresión segura salvo obligación legal de conservación.

5. SUBENCARGADOS AUTORIZADOS Y TRANSFERENCIAS INTERNACIONALES
-------------------------------------------------------------
El Responsable autoriza el uso de la infraestructura cloud de Netlify, Inc. (alojamiento web, funciones serverless y almacenamiento Netlify Blobs), entidad adherida al Marco de Privacidad de Datos UE-EE. UU. (EU-US Data Privacy Framework) con cláusulas contractuales tipo vigentes.

6. EXENCIÓN FISCAL (VERIFACTU / RD 1007/2023)
---------------------------------------------
Las utilidades de control interno de caja y reparto de comisiones tienen finalidad estrictamente operativa interna y NO constituyen un sistema informático de facturación (SIF) ni emiten facturas o tickets fiscales válidos ante la AEAT.

FIRMAS (Borrador listo para firma digital o manuscrita)
-------------------------------------------------------
Por el Responsable (${shopName}): ___________________________   Fecha: ${formattedDate}
Por el Encargado (KUTZ // BARBER OS): _______________________   Fecha: ${formattedDate}
`;
}

export default function LegalComplianceModal({
  isOpen,
  onClose,
  shop = null,
  shopSlug = 'kutz-madrid',
  publicOnly = false,
  initialTab = 'privacy',
}) {
  const [activeTab, setActiveTab] = useState(
    publicOnly && initialTab === 'dpa' ? 'privacy' : initialTab
  );
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(publicOnly && initialTab === 'dpa' ? 'privacy' : initialTab);
      setDownloadSuccess(false);
    }
  }, [isOpen, publicOnly, initialTab]);

  if (!isOpen) return null;

  const shopName = shop?.name || 'KUTZ // BARBER STUDIO';
  const shopAddress = shop?.address || 'Dirección del establecimiento';
  const shopPhone = shop?.phone || 'Teléfono del establecimiento';
  const safeSlug = String(shopSlug || shop?.slug || 'salon').toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const todayFormatted = new Date().toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const isoDate = new Date().toISOString().split('T')[0];

  const dpaText = buildDpaDraftText({
    shopName,
    shopSlug: safeSlug,
    shopAddress,
    shopPhone,
    formattedDate: todayFormatted,
  });

  const handleDownloadDpa = () => {
    const blob = new Blob([dpaText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DPA-Art28-${safeSlug}-${isoDate}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  const handlePrintDpa = () => {
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  };

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #legal-dpa-printable, #legal-dpa-printable * { visibility: visible !important; }
          #legal-dpa-printable {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100vw !important;
            background: white !important;
            color: #111827 !important;
            padding: 16mm !important;
            z-index: 999999 !important;
            font-size: 11px !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div
        className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose?.();
        }}
      >
        <div className="w-full max-w-2xl max-h-[90vh] bg-[#101318] border border-[#252A36] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[#F3F4F6]">
          {/* Header */}
          <div className="p-4 sm:p-5 bg-[#141820] border-b border-[#252A36] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] flex items-center justify-center shrink-0">
                <Scale size={20} />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-serif font-black uppercase text-white truncate">
                  {publicOnly ? 'Privacidad & Aviso Legal' : 'Centro Legal, RGPD & Contrato DPA'}
                </h2>
                <p className="text-[11px] text-[#9CA3AF] truncate">
                  {shopName} · Cumplimiento RGPD (UE) 2016/679, LOPDGDD 3/2018 & LSSI-CE
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-[#1B202B] text-[#9CA3AF] hover:text-white cursor-pointer shrink-0"
              aria-label="Cerrar modal legal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tabs */}
          <div className="px-4 sm:px-5 pt-3 pb-2 bg-[#141820]/70 border-b border-[#252A36] flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('privacy')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer transition-all ${
                activeTab === 'privacy'
                  ? 'bg-[#10B981] text-[#07090C]'
                  : 'bg-[#101318] text-[#9CA3AF] hover:text-white border border-[#252A36]'
              }`}
            >
              <ShieldCheck size={14} />
              <span>Política de Privacidad</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('legal')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer transition-all ${
                activeTab === 'legal'
                  ? 'bg-[#10B981] text-[#07090C]'
                  : 'bg-[#101318] text-[#9CA3AF] hover:text-white border border-[#252A36]'
              }`}
            >
              <Scale size={14} />
              <span>Aviso Legal (LSSI-CE)</span>
            </button>

            {!publicOnly && (
              <button
                type="button"
                onClick={() => setActiveTab('dpa')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer transition-all ${
                  activeTab === 'dpa'
                    ? 'bg-[#10B981] text-[#07090C]'
                    : 'bg-[#101318] text-[#9CA3AF] hover:text-white border border-[#252A36]'
                }`}
              >
                <FileText size={14} />
                <span>Contrato DPA (Art. 28)</span>
              </button>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs text-[#D1D5DB] leading-relaxed">
            {activeTab === 'privacy' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#141820] border border-[#10B981]/35 space-y-2">
                  <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#34D399] flex items-center gap-1.5">
                    <Lock size={13} /> Información Básica de Protección de Datos (Art. 13 RGPD)
                  </p>
                  <ul className="space-y-1.5 text-xs">
                    <li><strong className="text-white">Responsable del tratamiento:</strong> {shopName} ({shopAddress} · Tel. {shopPhone}).</li>
                    <li><strong className="text-white">Finalidad:</strong> Gestión de reservas de citas, turnos en sala de espera, ficha técnica de preferencias de corte/barbería y atención al cliente.</li>
                    <li><strong className="text-white">Legitimación:</strong> Ejecución de la relación de servicio (Art. 6.1.b RGPD) y consentimiento explícito del interesado (Art. 6.1.a y Art. 9.2.a RGPD para notas de sensibilidad de piel/alergias y fotografías).</li>
                    <li><strong className="text-white">Destinatarios y transferencias:</strong> No se ceden datos a terceros salvo obligación legal. Infraestructura tecnológica segura operada sobre Netlify (adherida al marco EU-US Data Privacy Framework).</li>
                    <li><strong className="text-white">Conservación:</strong> Mientras se mantenga la relación activa con el establecimiento o hasta que el cliente solicite la supresión, respetando los plazos legales de prescripción aplicables.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-[#141820] border border-[#252A36] space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    Datos Especiales (Art. 9 RGPD) e Imagen
                  </h3>
                  <p>
                    Las anotaciones relativas a alergias, irritación dérmica o sensibilidad con productos de afeitado/coloración se recogen únicamente para proteger la seguridad física del cliente durante el servicio. La captura de fotografías Antes/Después y su eventual difusión en redes sociales (Reels/TikTok) requieren consentimiento independiente, específico y revocable en cualquier momento.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#141820] border border-[#252A36] space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    Ejercicio de Derechos ARSOPOL
                  </h3>
                  <p>
                    Puedes ejercer gratuitamente tus derechos de <strong className="text-white">Acceso, Rectificación, Supresión, Oposición, Portabilidad (exportación JSON) y Limitación</strong> del tratamiento dirigiéndote directamente a {shopName} ({shopPhone}) o solicitando la revocación de permisos opcionales de WhatsApp/Redes en tu ficha. Asimismo, tienes derecho a presentar reclamación ante la Agencia Española de Protección de Datos (<span className="text-[#34D399]">www.aepd.es</span>).
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'legal' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#141820] border border-[#252A36] space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#34D399]">
                    Identificación del Titular (Ley 34/2002 LSSI-CE)
                  </h3>
                  <p>
                    En cumplimiento del artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE):
                  </p>
                  <div className="p-3 rounded-lg bg-[#0A0C0F] border border-[#252A36] font-mono text-[11px] space-y-1 text-[#E5E7EB]">
                    <p><strong>Plataforma SaaS:</strong> KUTZ // BARBER OS</p>
                    <p><strong>Titular / Prestador:</strong> [NOMBRE O RAZÓN SOCIAL DEL TITULAR]</p>
                    <p><strong>NIF / CIF:</strong> [NIF/CIF DEL AUTÓNOMO O SOCIEDAD]</p>
                    <p><strong>Domicilio fiscal:</strong> [DOMICILIO FISCAL COMPLETO, ESPAÑA]</p>
                    <p><strong>Email de contacto legal:</strong> [LEGAL@TUDOMINIO.ES]</p>
                    <p><strong>Establecimiento activo:</strong> {shopName} ({shopAddress})</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/40 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#FBBF24] flex items-center gap-1.5">
                    <AlertTriangle size={14} /> Cláusula VeriFactu / Ley Antifraude (RD 1007/2023)
                  </h3>
                  <p className="text-[#FDE68A]">
                    El módulo de caja diaria, arqueo orientativo y reparto de comisiones de <strong>KUTZ // BARBER OS</strong> es estrictamente una <strong>herramienta interna de control operativo de servicios y comisiones</strong>. <strong>NO es un software de facturación certificado ni sustituye a un sistema VeriFactu</strong>, y ningún resumen generado en la aplicación tiene validez como factura ni como ticket fiscal ante la Agencia Tributaria (AEAT).
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#141820] border border-[#252A36] space-y-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    Propiedad Intelectual y Responsabilidad
                  </h3>
                  <p>
                    El software, diseño e interfaz son propiedad del titular de la plataforma. Cada establecimiento usuario es el único responsable de la veracidad de sus tarifas, horarios, obligaciones fiscales y de recabar los consentimientos oportunos de sus clientes finales.
                  </p>
                </div>
              </div>
            )}

            {!publicOnly && activeTab === 'dpa' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-[#10B981]/10 border border-[#10B981]/35">
                  <div>
                    <p className="text-xs font-bold text-white">
                      Borrador de Contrato DPA (Art. 28 RGPD) pre-rellenado
                    </p>
                    <p className="text-[11px] text-[#34D399]">
                      Salón: {shopName} · Slug: {safeSlug} · Fecha: {todayFormatted}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadDpa}
                      className="px-3 py-2 rounded-xl bg-[#10B981] hover:bg-[#34D399] text-[#07090C] text-xs font-black flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download size={14} />
                      <span>Descargar Borrador DPA (.txt)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintDpa}
                      className="px-3 py-2 rounded-xl bg-[#1B202B] hover:bg-[#252A36] border border-[#252A36] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer size={14} />
                      <span>Imprimir / Guardar PDF</span>
                    </button>
                  </div>
                </div>

                {downloadSuccess && (
                  <div className="p-3 rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 text-[#34D399] text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 size={15} />
                    <span>Borrador DPA descargado correctamente (DPA-Art28-{safeSlug}-{isoDate}.txt).</span>
                  </div>
                )}

                <pre
                  id="legal-dpa-printable"
                  className="p-4 rounded-xl bg-[#0A0C0F] border border-[#252A36] text-[11px] font-mono text-[#E5E7EB] whitespace-pre-wrap leading-relaxed"
                >
                  {dpaText}
                </pre>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-[#141820] border-t border-[#252A36] flex items-center justify-between gap-2 no-print">
            <span className="text-[10px] text-[#9CA3AF]">
              Versión legal 2026.1 · RGPD / LOPDGDD / LSSI-CE
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#1B202B] hover:bg-[#252A36] text-xs font-bold text-white cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
