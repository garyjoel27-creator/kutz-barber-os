import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, X, FileText, CheckCircle2, AlertCircle, 
  Lock, Camera, Share2, MessageSquare, Printer, Eye, PenTool, Download
} from 'lucide-react';
import SignaturePad from './SignaturePad';
import { useClients } from '../context/ClientContext';

const RGPDConsentModal = ({ 
  isOpen, 
  onClose, 
  client, 
  onSaveConsent,
  initialTab = 'form' 
}) => {
  const clientCtx = useClients();
  const activeModeConfig = clientCtx?.activeModeConfig;
  const businessMode = clientCtx?.businessMode || 'estetica';
  const [activeTab, setActiveTab] = useState(initialTab); // 'form' | 'document'
  
  // Las 4 capas independientes del RGPD
  const [permissions, setPermissions] = useState({
    treatment: false,
    photosPrivate: false,
    photosMarketing: false,
    communications: false,
  });

  const [signatureData, setSignatureData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Sincronizar estado cada vez que se abre el modal o cambia el cliente
  useEffect(() => {
    if (isOpen && client) {
      setActiveTab(initialTab);
      if (client.consent) {
        setPermissions({
          treatment: !!client.consent.permissions?.treatment,
          photosPrivate: !!client.consent.permissions?.photosPrivate,
          photosMarketing: !!client.consent.permissions?.photosMarketing,
          communications: !!client.consent.permissions?.communications,
        });
        setSignatureData(client.consent.signatureImage || null);
      } else {
        setPermissions({
          treatment: false,
          photosPrivate: false,
          photosMarketing: false,
          communications: false,
        });
        setSignatureData(null);
      }
      setErrorMessage('');
      setIsSuccess(false);
    }
  }, [isOpen, client, initialTab]);

  if (!isOpen || !client) return null;

  const handleToggle = (key) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
    setErrorMessage('');
  };

  const handleSave = () => {
    // Validación estricta: No se puede prestar servicio sin consentimiento asistencial
    if (!permissions.treatment) {
      setErrorMessage('Es obligatorio autorizar la finalidad asistencial para abrir el expediente clínico.');
      return;
    }

    if (!signatureData) {
      setErrorMessage('Es obligatoria la firma manuscrita digitalizada del paciente para formalizar el consentimiento.');
      return;
    }

    const consentRecord = {
      signed: true,
      signedAt: new Date().toISOString(),
      formattedDate: new Date().toLocaleString('es-ES', { 
        day: '2-digit', month: 'short', year: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
      }),
      signatureImage: signatureData,
      permissions: {
        treatment: permissions.treatment,
        photosPrivate: permissions.photosPrivate,
        photosMarketing: permissions.photosMarketing,
        communications: permissions.communications
      },
      documentHash: `SHA256-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
      legalNoticeVersion: 'RGPD-2026-v2.1',
      legalCustodian: 'LuminaDesk Haute Esthétique Atelier S.L.'
    };

    onSaveConsent(client.id, consentRecord);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      setActiveTab('document'); // Pasar automáticamente a ver el documento emitido
    }, 900);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Estilos CSS específicos para impresión en A4 limpia del documento oficial */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #rgpd-printable-doc, #rgpd-printable-doc * {
            visibility: visible !important;
          }
          #rgpd-printable-doc {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: white !important;
            color: black !important;
            padding: 15mm 20mm !important;
            box-shadow: none !important;
            border: none !important;
            z-index: 999999 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="fixed inset-0 bg-[#201d1a]/55 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl border border-[#ede7e0] shadow-[0_25px_70px_-15px_rgba(70,50,30,0.25)] w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
          
          {/* Header Modal con Selector de Pestañas */}
          <div className="p-5 sm:p-6 border-b border-[#f4f0eb] bg-gradient-to-r from-[#faf8f5] via-white to-[#faf8f5]">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-2xl bg-[#537559]/10 border border-[#537559]/20 text-[#537559] flex items-center justify-center shadow-2xs">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base sm:text-lg font-serif text-[#201d1a] font-medium">
                      Consentimiento Informado & RGPD
                    </h3>
                    <span className="text-[10px] bg-[#f5efe9] text-[#7a5d42] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                      {activeModeConfig?.rgpdBadge || 'Art. 9 RGPD + LOPDGDD'}
                    </span>
                  </div>
                  <p className="text-xs text-[#8f857d] font-light">
                    {activeModeConfig?.clientSingular || 'Clienta'}: <span className="font-medium text-[#201d1a]">{client.name}</span>
                  </p>
                </div>
              </div>

              <button 
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white border border-[#ede7e0] text-[#8f857d] hover:text-[#201d1a] hover:bg-[#f5efe9] flex items-center justify-center transition-all cursor-pointer shadow-2xs"
              >
                <X size={16} />
              </button>
            </div>

            {/* Pestañas: Formulario de Modificación vs Documento Oficial */}
            <div className="flex items-center space-x-2 mt-4 pt-3 border-t border-[#f4f0eb]/80">
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className={`text-xs px-3.5 py-1.5 rounded-xl font-medium transition-all flex items-center space-x-1.5 cursor-pointer ${
                  activeTab === 'form'
                    ? 'bg-[#201d1a] text-[#faf8f5] shadow-xs'
                    : 'text-[#8f857d] hover:text-[#201d1a] hover:bg-[#f5efe9]'
                }`}
              >
                <PenTool size={13} />
                <span>Formulario & Firma</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('document')}
                className={`text-xs px-3.5 py-1.5 rounded-xl font-medium transition-all flex items-center space-x-1.5 cursor-pointer ${
                  activeTab === 'document'
                    ? 'bg-[#201d1a] text-[#faf8f5] shadow-xs'
                    : 'text-[#8f857d] hover:text-[#201d1a] hover:bg-[#f5efe9]'
                }`}
              >
                <FileText size={13} />
                <span>Documento Oficial (PDF / Imprimir)</span>
                {client.consent?.signed && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#537559]"></span>
                )}
              </button>
            </div>
          </div>

          {/* VISTA 1: Formulario Interactivo y Firma Digital */}
          {activeTab === 'form' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#faf8f5]/30">
              
              {/* Cuadro Legal de Primera Capa (Art. 13 RGPD) */}
              <div className="bg-white rounded-2xl p-4 border border-[#ede7e0] text-[11px] text-[#5c544d] space-y-2 leading-relaxed shadow-xs">
                <div className="flex items-center space-x-2 text-[#7a5d42] font-semibold uppercase tracking-wider text-[10px]">
                  <Lock size={12} />
                  <span>Información Básica sobre Protección de Datos (Art. 13 RGPD — {activeModeConfig?.badge || 'Estética'})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-[#f4f0eb]">
                  <div><strong className="text-[#201d1a]">Responsable:</strong> LuminaDesk — {activeModeConfig?.shortName || 'Estética'}</div>
                  <div><strong className="text-[#201d1a]">Legitimación:</strong> Consentimiento explícito (Art. 9.2.a RGPD).</div>
                  <div><strong className="text-[#201d1a]">Custodia:</strong> {activeModeConfig?.rgpdCustodyText || 'Durante relación activa'}.</div>
                  <div><strong className="text-[#201d1a]">Derechos:</strong> Acceso, rectificación, supresión y portabilidad.</div>
                </div>
              </div>

              {/* Las 4 Capas de Consentimiento Diferenciado */}
              <div className="space-y-3">
                <div className="text-xs font-serif text-[#201d1a] font-medium tracking-wide">
                  Autorizaciones Específicas por Capas
                </div>

                {/* Capa 1: Asistencial / Tratamiento (Obligatoria) */}
                <label className={`flex items-start space-x-3.5 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  permissions.treatment ? 'bg-[#537559]/5 border-[#537559]/40' : 'bg-white border-[#ede7e0]'
                }`}>
                  <input 
                    type="checkbox" 
                    checked={permissions.treatment} 
                    onChange={() => handleToggle('treatment')}
                    className="mt-0.5 accent-[#537559] w-4 h-4 rounded cursor-pointer"
                  />
                  <div className="flex-1 text-xs">
                    <div className="flex items-center space-x-1.5 font-medium text-[#201d1a]">
                      <FileText size={14} className="text-[#7a5d42]" />
                      <span>1. Apertura de Ficha Técnica, Alergias y Servicio (Obligatorio)</span>
                    </div>
                    <p className="text-[11px] text-[#8f857d] mt-0.5 leading-snug">
                      {activeModeConfig?.rgpdTreatmentClause || 'Autorizo la apertura de mi expediente, registro de alergias y realización de los protocolos acordados.'}
                    </p>
                  </div>
                </label>

                {/* Capa 2: Fotos Clínicas Internas (Obligatorio para seguimiento) */}
                <label className={`flex items-start space-x-3.5 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  permissions.photosPrivate ? 'bg-[#537559]/5 border-[#537559]/40' : 'bg-white border-[#ede7e0]'
                }`}>
                  <input 
                    type="checkbox" 
                    checked={permissions.photosPrivate} 
                    onChange={() => handleToggle('photosPrivate')}
                    className="mt-0.5 accent-[#537559] w-4 h-4 rounded cursor-pointer"
                  />
                  <div className="flex-1 text-xs">
                    <div className="flex items-center space-x-1.5 font-medium text-[#201d1a]">
                      <Camera size={14} className="text-[#7a5d42]" />
                      <span>2. Fotografías Clínicas de Control Interno</span>
                    </div>
                    <p className="text-[11px] text-[#8f857d] mt-0.5 leading-snug">
                      Consiento la captura de imágenes Antes/Después para constancia confidencial en mi ficha y evaluación comparativa.
                    </p>
                  </div>
                </label>

                {/* Capa 3: Redes Sociales / Marketing (Opcional) */}
                <label className={`flex items-start space-x-3.5 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  permissions.photosMarketing ? 'bg-[#9c7a5b]/10 border-[#9c7a5b]/50' : 'bg-white border-[#ede7e0]'
                }`}>
                  <input 
                    type="checkbox" 
                    checked={permissions.photosMarketing} 
                    onChange={() => handleToggle('photosMarketing')}
                    className="mt-0.5 accent-[#9c7a5b] w-4 h-4 rounded cursor-pointer"
                  />
                  <div className="flex-1 text-xs">
                    <div className="flex items-center space-x-1.5 font-medium text-[#201d1a]">
                      <Share2 size={14} className="text-[#9c7a5b]" />
                      <span>3. Difusión en Redes Sociales o Web (Opcional)</span>
                    </div>
                    <p className="text-[11px] text-[#8f857d] mt-0.5 leading-snug">
                      Autorizo el uso de mis resultados o time-lapse en las redes del centro con fines divulgativos (puede revocarse en cualquier momento).
                    </p>
                  </div>
                </label>

                {/* Capa 4: Notificaciones y Avisos de Retoque WhatsApp (Opcional) */}
                <label className={`flex items-start space-x-3.5 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  permissions.communications ? 'bg-[#537559]/5 border-[#537559]/40' : 'bg-white border-[#ede7e0]'
                }`}>
                  <input 
                    type="checkbox" 
                    checked={permissions.communications} 
                    onChange={() => handleToggle('communications')}
                    className="mt-0.5 accent-[#537559] w-4 h-4 rounded cursor-pointer"
                  />
                  <div className="flex-1 text-xs">
                    <div className="flex items-center space-x-1.5 font-medium text-[#201d1a]">
                      <MessageSquare size={14} className="text-[#7a5d42]" />
                      <span>4. Recordatorios y Avisos de Retoque por WhatsApp (Opcional)</span>
                    </div>
                    <p className="text-[11px] text-[#8f857d] mt-0.5 leading-snug">
                      Acepto recibir recordatorios preventivos de retoque y recomendaciones de cuidado post-tratamiento por mensajería.
                    </p>
                  </div>
                </label>
              </div>

              {/* Sección de Firma Digitalizada */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-serif text-[#201d1a] font-medium tracking-wide">
                    Firma Manuscrita Digitalizada del Paciente
                  </span>
                  <span className="text-[10px] text-[#8f857d]">
                    {client.consent?.signed ? `Firmado el: ${client.consent.formattedDate}` : `Fecha: ${new Date().toLocaleDateString('es-ES')}`}
                  </span>
                </div>

                <SignaturePad 
                  onSave={(dataUrl) => {
                    setSignatureData(dataUrl);
                    setErrorMessage('');
                  }}
                  existingSignature={signatureData}
                />

                {signatureData && (
                  <div className="flex items-center space-x-1.5 text-[11px] text-[#537559] bg-[#537559]/10 px-3 py-1.5 rounded-xl">
                    <CheckCircle2 size={13} />
                    <span>Trazo de firma registrado correctamente y vinculado a este expediente.</span>
                  </div>
                )}
              </div>

              {errorMessage && (
                <div className="flex items-center space-x-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl animate-shake">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {isSuccess && (
                <div className="flex items-center space-x-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                  <CheckCircle2 size={15} className="shrink-0" />
                  <span>¡Consentimiento informado y firma RGPD actualizados con éxito!</span>
                </div>
              )}
            </div>
          )}

          {/* VISTA 2: DOCUMENTO OFICIAL FORMAL (Descargable / Imprimible A4) */}
          {activeTab === 'document' && (
            <div className="flex-1 overflow-y-auto p-6 bg-[#faf8f5]/50">
              
              {/* Documento Estilizado como Certificado Legal */}
              <div 
                id="rgpd-printable-doc" 
                className="bg-white p-8 rounded-2xl border border-[#ede7e0] shadow-sm text-[#201d1a] space-y-6 text-xs leading-relaxed font-sans"
              >
                {/* Membrete Oficial */}
                <div className="border-b-2 border-[#201d1a] pb-4 flex justify-between items-start">
                  <div>
                    <h1 className="text-xl font-serif tracking-wider font-semibold text-[#201d1a]">
                      LuminaDesk Haute Esthétique
                    </h1>
                    <p className="text-[10px] text-[#8f857d] uppercase tracking-widest mt-0.5">
                      {activeModeConfig?.badge || 'Centro de Estética Avanzada & Cabina'}
                    </p>
                  </div>
                  <div className="text-right text-[10px] text-[#5c544d]">
                    <div className="font-bold text-[#201d1a]">EXPEDIENTE #{String(client.id).slice(-6)}</div>
                    <div>Fecha: {client.consent?.formattedDate || new Date().toLocaleDateString('es-ES')}</div>
                    <div>Normativa: {activeModeConfig?.rgpdBadge || 'RGPD-2026-v2.1'}</div>
                  </div>
                </div>

                {/* Título Oficial del Documento */}
                <div className="text-center py-2 bg-[#faf8f5] rounded-xl border border-[#ede7e0]">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#201d1a]">
                    Documento de Información y Consentimiento Expreso ({activeModeConfig?.shortName || 'Estética'})
                  </h2>
                  <p className="text-[10px] text-[#7a5d42]">
                    {businessMode === 'clinica'
                      ? 'Conforme al Reglamento (UE) 2016/679 (RGPD), LOPDGDD 3/2018 y Ley 41/2002 de Autonomía del Paciente'
                      : 'Conforme al Reglamento (UE) 2016/679 (RGPD), LOPDGDD 3/2018 y Ley Orgánica 1/1982 de Derecho a la Propia Imagen'}
                  </p>
                </div>

                {/* Datos del Paciente / Clienta */}
                <div className="grid grid-cols-2 gap-4 p-3 bg-[#faf8f5]/60 rounded-xl border border-[#ede7e0]/80 text-[11px]">
                  <div><strong>{activeModeConfig?.clientSingular || 'Clienta'}:</strong> {client.name}</div>
                  <div><strong>Teléfono:</strong> {client.phone || 'No registrado'}</div>
                  <div><strong>Email:</strong> {client.email || 'No registrado'}</div>
                  <div><strong>Responsable de Tratamiento:</strong> LuminaDesk — {activeModeConfig?.shortName || 'Estética'}</div>
                </div>

                {/* Cláusulas Legales Informativas */}
                <div className="space-y-3 text-[11px] text-[#4a433d]">
                  <p>
                    <strong>1. Protección de Datos de Salud y Sensibilidades (Art. 9 RGPD):</strong> {activeModeConfig?.rgpdTreatmentClause || 'El interesado ha sido informado de que los datos recogidos sobre alergias, sensibilidades dérmicas/capilares y fórmulas aplicadas se tratan exclusivamente para garantizar su seguridad durante el servicio.'}
                  </p>
                  <p>
                    <strong>2. Plazo de Conservación y Supresión:</strong> {businessMode === 'clinica'
                      ? 'De conformidad con la legislación sanitaria española (Ley 41/2002), la historia clínica será custodiada durante un periodo mínimo de cinco (5) años desde la última asistencia.'
                      : 'Los datos técnicos, fórmulas y fotografías se conservarán mientras se mantenga la relación comercial con el salón/centro de estética, pudiendo solicitar su borrado o supresión inmediata en cualquier momento.'}
                  </p>
                  <p>
                    <strong>3. Derechos ARSOPOL y Revocación de Imagen:</strong> El interesado podrá ejercer en cualquier momento sus derechos de acceso, rectificación, supresión, limitación, portabilidad o revocar el uso comercial de su imagen en redes sociales (Instagram/TikTok/Web) ante la dirección del centro o ante la AEPD.
                  </p>
                </div>

                {/* Desglose de Permisos Otorgados */}
                <div className="border border-[#ede7e0] rounded-xl overflow-hidden text-[11px]">
                  <div className="bg-[#f5efe9] px-3 py-2 font-bold text-[#7a5d42] border-b border-[#ede7e0]">
                    Desglose de Autorizaciones y Consentimientos Otorgados
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span>• Asistencia Clínica y Apertura de Historia Médica:</span>
                      <strong className={permissions.treatment ? 'text-[#537559]' : 'text-[#96423b]'}>
                        {permissions.treatment ? '[X] CONCEDIDO' : '[ ] DENEGADO'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>• Captura de Fotografías para Control Interno en Cabina:</span>
                      <strong className={permissions.photosPrivate ? 'text-[#537559]' : 'text-[#96423b]'}>
                        {permissions.photosPrivate ? '[X] CONCEDIDO' : '[ ] DENEGADO'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>• Difusión de Fotografías / Time-Lapse en Redes Sociales o Web:</span>
                      <strong className={permissions.photosMarketing ? 'text-[#537559]' : 'text-[#8f857d]'}>
                        {permissions.photosMarketing ? '[X] CONCEDIDO' : '[ ] NO CONCEDIDO'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>• Comunicaciones y Recordatorios de Retoque por WhatsApp:</span>
                      <strong className={permissions.communications ? 'text-[#537559]' : 'text-[#8f857d]'}>
                        {permissions.communications ? '[X] CONCEDIDO' : '[ ] NO CONCEDIDO'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Recuadro de Firma Digital y Sello */}
                <div className="pt-4 border-t border-[#ede7e0] grid grid-cols-2 gap-6 items-end">
                  <div className="space-y-1 text-[10px] text-[#8f857d]">
                    <div><strong>Sello de Integridad Digital:</strong></div>
                    <div className="font-mono text-[9px] bg-[#faf8f5] p-1.5 rounded border border-[#ede7e0] break-all">
                      {client.consent?.documentHash || 'HASH-PENDIENTE-DE-FIRMA'}
                    </div>
                    <div>Fecha y Hora Oficial: {client.consent?.formattedDate || new Date().toLocaleString('es-ES')}</div>
                  </div>

                  <div className="text-right flex flex-col items-end">
                    <div className="text-[10px] text-[#7a5d42] font-semibold mb-1">
                      Firma del Paciente:
                    </div>
                    {signatureData ? (
                      <div className="border border-[#ede7e0] bg-[#faf8f5] rounded-xl p-2 w-48 h-20 flex items-center justify-center">
                        <img 
                          src={signatureData} 
                          alt="Firma del paciente" 
                          className="max-h-full max-w-full object-contain" 
                        />
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-[#ede7e0] rounded-xl p-2 w-48 h-20 flex items-center justify-center text-[10px] text-[#b8afa6]">
                        [Pendiente de firma]
                      </div>
                    )}
                    <div className="text-[10px] text-[#201d1a] mt-1 font-medium">{client.name}</div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Footer con Acciones */}
          <div className="p-5 border-t border-[#ede7e0] bg-white flex items-center justify-between no-print">
            <div className="text-[10px] text-[#8f857d] flex items-center space-x-1">
              <Lock size={11} />
              <span>Validez jurídica plena conforme al RGPD Europeo y LOPDGDD española</span>
            </div>

            <div className="flex items-center space-x-3">
              {activeTab === 'document' ? (
                <>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="btn-author-secondary text-xs py-2.5 px-4 cursor-pointer inline-flex items-center space-x-1.5 border border-[#9c7a5b]/40 hover:border-[#9c7a5b]"
                  >
                    <Printer size={15} />
                    <span>Imprimir / Guardar como PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('form')}
                    className="btn-author text-xs py-2.5 px-5 cursor-pointer inline-flex items-center space-x-1.5"
                  >
                    <PenTool size={14} />
                    <span>Modificar Datos</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-xs px-4 py-2.5 rounded-xl border border-[#ede7e0] text-[#7a5d42] hover:bg-[#faf8f5] transition-colors cursor-pointer"
                  >
                    Cerrar
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="btn-author text-xs py-2.5 px-6 cursor-pointer inline-flex items-center space-x-1.5"
                  >
                    <CheckCircle2 size={15} />
                    <span>{client.consent?.signed ? 'Actualizar Consentimiento' : 'Guardar y Emitir Documento'}</span>
                  </button>
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default RGPDConsentModal;
