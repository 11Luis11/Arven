import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Download, X, Send, CheckCircle2, Loader2 } from 'lucide-react';
import SaleReceipt from './SaleReceipt';
import { docVariant, DOC_TITLES, money, RECEIPT_WIDTH } from '../../utils/receipt';
import { receiptToPdfBlob, downloadBlob } from '../../utils/receiptPdf';
import { DataService } from '../../services/dataService';
import { toast } from '../../utils/toast';

const fileNameFor = (sale) => `${(sale.invoice_number || 'comprobante').replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;

/**
 * Visor de comprobante: vista previa, impresión, PDF y envío por WhatsApp.
 * La vista previa, la impresión y el PDF usan el mismo componente <SaleReceipt>.
 */
export default function ReceiptModal({ sale, config, productsById, onClose, title, defaultPhone = '', format }) {
  const variant = format === 'ticket' ? 'ticket' : docVariant(sale.document_type);
  const width = RECEIPT_WIDTH[variant];
  const captureRef = useRef(null);
  const previewBoxRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [busy, setBusy] = useState(null); // 'pdf' | 'wa' | null
  const [phone, setPhone] = useState(defaultPhone || sale.customer_phone || '');
  const [ticketHeightMm, setTicketHeightMm] = useState(200);

  // Chrome no acepta "80mm auto": se mide el ticket para que la hoja tenga su largo exacto
  useLayoutEffect(() => {
    if (variant !== 'ticket' || !captureRef.current) return;
    setTicketHeightMm(Math.ceil((captureRef.current.offsetHeight * 25.4) / 96) + 4);
  }, [variant, sale]);

  // Ajusta la vista previa al ancho disponible sin alterar el documento real
  useLayoutEffect(() => {
    const box = previewBoxRef.current;
    if (!box) return undefined;
    const update = () => setScale(Math.min(1, (box.clientWidth - 32) / width));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(box);
    return () => ro.disconnect();
  }, [width]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const makePdf = () => receiptToPdfBlob(captureRef.current, variant);

  const handleDownload = async () => {
    if (busy) return;
    setBusy('pdf');
    try {
      downloadBlob(await makePdf(), fileNameFor(sale));
    } catch (err) {
      console.error(err);
      toast.error('No se pudo generar el PDF.');
    } finally {
      setBusy(null);
    }
  };

  const handleWhatsApp = async () => {
    if (busy) return;
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.length === 9 && clean.startsWith('9')) clean = `51${clean}`;
    if (clean.length < 11) {
      toast.warning('Ingresa el número de WhatsApp del cliente (9 dígitos).');
      return;
    }
    setBusy('wa');
    try {
      const blob = await makePdf();
      const file = new File([blob], fileNameFor(sale), { type: 'application/pdf' });
      const url = await DataService.uploadReceipt(file);
      const store = config?.businessName || config?.storeName || 'Nuestra tienda';
      const text = `*${store}*\n${DOC_TITLES[sale.document_type] || 'Comprobante'} N° ${sale.invoice_number}\nTotal: S/ ${money(sale.total_amount)}\n\nDescarga tu comprobante:\n${url}`;
      window.open(`https://api.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    } catch (err) {
      console.error(err);
      toast.error(err?.message || 'No se pudo enviar el comprobante.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="receipt-modal-overlay" role="dialog" aria-modal="true" aria-label={`Comprobante ${sale.invoice_number}`}>
      <div className="receipt-modal">
        <div className="receipt-modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span className="receipt-modal-icon"><CheckCircle2 size={18} /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{title || `${DOC_TITLES[sale.document_type] || 'Comprobante'} ${sale.invoice_number}`}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total S/ {money(sale.total_amount)} · {sale.payment_method}</div>
            </div>
          </div>
          <button type="button" className="btn-ghost btn-icon" onClick={onClose} disabled={!!busy} aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div className="receipt-modal-body">
        <div className="receipt-modal-preview" ref={previewBoxRef}>
          <div style={{ width: width * scale, height: 'auto', margin: '0 auto' }}>
            <div className="receipt-paper" style={{ zoom: scale }}>
              <SaleReceipt sale={sale} config={config} productsById={productsById} format={format} />
            </div>
          </div>
        </div>

        <div className="receipt-modal-actions">
          <p className="receipt-modal-label">Comprobante</p>
          <button type="button" className="btn-primary btn-block" onClick={() => window.print()} disabled={!!busy}>
            <Printer size={16} /> Imprimir
          </button>
          <button type="button" className="btn-secondary btn-block" onClick={handleDownload} disabled={!!busy}>
            {busy === 'pdf' ? <Loader2 size={16} className="spin" /> : <Download size={16} />} Descargar PDF
          </button>
          <p className="receipt-modal-label" style={{ marginTop: 8 }}>Enviar al cliente</p>
          <div className="receipt-modal-actions-row">
            <input
              type="tel"
              inputMode="numeric"
              className="input-field"
              placeholder="WhatsApp del cliente (ej. 987654321)"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleWhatsApp(); }}
              style={{ flex: 1, minWidth: 0 }}
            />
          </div>
          <button type="button" className="btn-success btn-block" onClick={handleWhatsApp} disabled={!!busy}>
            {busy === 'wa' ? <Loader2 size={16} className="spin" /> : <Send size={16} />} Enviar por WhatsApp
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn-ghost btn-block" onClick={onClose} disabled={!!busy}>Continuar</button>
        </div>
        </div>
      </div>

      {/* Copia sin escalar, colgada directo del <body>: se usa para el PDF y para imprimir */}
      {createPortal(
        <div className="receipt-print-area" aria-hidden="true">
          <SaleReceipt ref={captureRef} sale={sale} config={config} productsById={productsById} format={format} />
        </div>,
        document.body
      )}

      <style>{`
        .receipt-modal-overlay {
          position: fixed; inset: 0; z-index: 5000; background: rgba(15,23,42,.55); backdrop-filter: blur(3px);
          display: flex; align-items: center; justify-content: center; padding: 16px; animation: fadeIn .2s ease both;
        }
        .receipt-modal {
          background: var(--bg-card); border-radius: 18px; box-shadow: var(--shadow-lg);
          width: 100%; max-width: ${variant === 'ticket' ? 720 : 1160}px; height: calc(100vh - 32px); max-height: 1000px;
          display: flex; flex-direction: column; overflow: hidden; animation: scaleIn .22s cubic-bezier(.16,1,.3,1) both;
        }
        .receipt-modal-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; border-bottom: 1px solid var(--border-color); }
        .receipt-modal-icon { width: 34px; height: 34px; border-radius: 10px; background: var(--color-success-soft); color: var(--color-success); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .receipt-modal-body { flex: 1; min-height: 0; display: flex; }
        .receipt-modal-preview { flex: 1; min-width: 0; overflow: auto; background: #E9EDF2; padding: 16px; }
        .receipt-paper { box-shadow: 0 10px 30px -10px rgba(15,23,42,.35); border-radius: 4px; overflow: hidden; background: #fff; }
        .receipt-modal-actions { width: 280px; flex-shrink: 0; padding: 18px; border-left: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
        .receipt-modal-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--text-secondary); }
        .receipt-modal-actions-row { display: flex; gap: 10px; }
        @media (max-width: 760px) {
          .receipt-modal { height: auto; max-height: calc(100vh - 32px); overflow-y: auto; }
          .receipt-modal-body { flex-direction: column; }
          .receipt-modal-preview { min-height: 55vh; flex: none; }
          .receipt-modal-actions { width: 100%; border-left: none; border-top: 1px solid var(--border-color); }
        }
        .receipt-print-area { position: fixed; left: -20000px; top: 0; pointer-events: none; }

        @media print {
          @page { size: ${variant === 'ticket' ? `80mm ${ticketHeightMm}mm` : 'A4'}; margin: 0; }
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; }
          body > *:not(.receipt-print-area) { display: none !important; }
          .receipt-print-area { position: static !important; left: auto !important; }
          .receipt-print-area, .receipt-print-area * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}
