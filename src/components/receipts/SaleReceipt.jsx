import { forwardRef } from 'react';
import {
  CalendarDays, Clock3, UserRound, IdCard, CreditCard, MapPin, Phone, Mail,
  BadgeCheck, Tag, ShieldCheck, Coins, UserCog
} from 'lucide-react';
import BrandLogo from '../BrandLogo';
import { buildReceipt, money, DOC_TITLES, docVariant, RECEIPT_WIDTH } from '../../utils/receipt';

// Paleta del comprobante (colores fijos: se ve igual en pantalla, impresión y PDF)
const INK = '#0F172A';
const INK_2 = '#1E293B';
const GOLD = '#B8955E';
const GOLD_SOFT = '#F6F0E6';
const MUTED = '#64748B';
const LINE = '#E2E8F0';
const SOFT = '#F8FAFC';
const GREEN = '#047857';
const RED = '#B91C1C';


const FONT = "'Inter', 'Segoe UI', Roboto, Arial, sans-serif";

function storeInfo(config) {
  return {
    name: config?.businessName || config?.storeName || 'Mi tienda',
    logo: config?.storeLogoUrl || config?.storeLogoDarkUrl || '',
    ruc: config?.ruc || '',
    address: config?.fiscalAddress || '',
    phone: config?.ticketPhone || '',
    email: config?.ticketEmail || '',
  };
}

function formatDate(d) {
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatTime(d) {
  return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function InfoItem({ icon: Icon, label, value }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
      <span style={{ width: 28, height: 28, borderRadius: 8, background: GOLD_SOFT, color: GOLD, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={15} strokeWidth={1.8} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 9.5, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 12.5, color: INK, fontWeight: 600, marginTop: 1, wordBreak: 'break-word' }}>{value || '—'}</div>
      </div>
    </div>
  );
}

function TotalRow({ label, value, color = INK_2, strong = false, size = 12.5 }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '7px 0', fontSize: size, color, fontWeight: strong ? 700 : 500 }}>
      <span>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

/* ---------------- Boleta / Factura (A4) ---------------- */
function A4Receipt({ sale, config, receipt, isFactura }) {
  const store = storeInfo(config);
  const date = new Date(sale.created_at);
  const th = { padding: '9px 8px', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#E2E8F0', textAlign: 'left', whiteSpace: 'nowrap' };
  const td = { padding: '8px 8px', fontSize: 11, color: INK_2, borderBottom: `1px solid ${LINE}`, verticalAlign: 'top' };
  const num = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

  return (
    <div style={{ width: RECEIPT_WIDTH.factura, minHeight: 1000, background: '#fff', color: INK, fontFamily: FONT, boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      {/* Cabecera */}
      <div style={{ background: `linear-gradient(135deg, ${INK} 0%, ${INK_2} 100%)`, padding: '28px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          {store.logo ? <BrandLogo config={config} bg="dark" maxHeight={52} maxWidth={170} crossOrigin="anonymous" /> : null}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{store.name}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6, fontSize: 10.5, color: '#CBD5E1' }}>
              {store.address && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><MapPin size={12} color={GOLD} /> {store.address}</span>}
              {(store.phone || store.email) && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                  {store.phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Phone size={12} color={GOLD} /> {store.phone}</span>}
                  {store.email && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Mail size={12} color={GOLD} /> {store.email}</span>}
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ border: `1.5px solid ${GOLD}`, borderRadius: 12, padding: '12px 18px', textAlign: 'center', minWidth: 210, background: 'rgba(184,149,94,0.10)', flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: GOLD, letterSpacing: '0.1em' }}>R.U.C. {store.ruc || '— configurar en Ajustes —'}</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{DOC_TITLES[sale.document_type] || 'Comprobante'}</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: GOLD, marginTop: 4, letterSpacing: '0.04em' }}>{sale.invoice_number}</div>
        </div>
      </div>
      <div style={{ height: 4, background: `linear-gradient(90deg, ${GOLD}, #E4D2B0, ${GOLD})` }} />

      <div style={{ padding: '26px 36px 30px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Datos */}
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 14, padding: '18px 20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px 18px', background: SOFT }}>
          <InfoItem icon={UserRound} label={isFactura ? 'Razón social' : 'Cliente'} value={sale.customer_name} />
          <InfoItem icon={IdCard} label={isFactura ? 'R.U.C.' : 'DNI / Doc.'} value={sale.customer_document} />
          <InfoItem icon={CreditCard} label="Forma de pago" value={sale.payment_method} />
          <InfoItem icon={CalendarDays} label="Fecha de emisión" value={formatDate(date)} />
          <InfoItem icon={Clock3} label="Hora" value={formatTime(date)} />
          <InfoItem icon={Coins} label="Moneda" value="Soles (PEN)" />
        </div>

        {/* Detalle por unidad */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '24px 0 10px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: INK, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Detalle de la compra</div>
          <div style={{ fontSize: 11, color: MUTED }}>{receipt.unitCount} unidad{receipt.unitCount === 1 ? '' : 'es'}</div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden' }}>
          <thead>
            <tr style={{ background: INK }}>
              <th style={{ ...th, width: 26, textAlign: 'center' }}>#</th>
              <th style={th}>SKU</th>
              <th style={th}>Descripción</th>
              <th style={th}>Color</th>
              <th style={{ ...th, textAlign: 'center' }}>Talla</th>
              <th style={{ ...th, textAlign: 'center' }}>U.M.</th>
              <th style={{ ...th, textAlign: 'right' }}>P. normal</th>
              <th style={{ ...th, textAlign: 'right' }}>Descuento</th>
              <th style={{ ...th, textAlign: 'right', color: GOLD }}>A pagar</th>
              {isFactura && <th style={{ ...th, textAlign: 'right' }}>V. venta</th>}
              {isFactura && <th style={{ ...th, textAlign: 'right' }}>IGV</th>}
            </tr>
          </thead>
          <tbody>
            {receipt.units.map((u, i) => (
              <tr key={u.n} style={{ background: i % 2 ? SOFT : '#fff' }}>
                <td style={{ ...td, textAlign: 'center', color: MUTED }}>{u.n}</td>
                <td style={{ ...td, fontFamily: 'Consolas, monospace', fontSize: 10.5, color: MUTED, whiteSpace: 'nowrap' }}>{u.sku || '—'}</td>
                <td style={{ ...td, fontWeight: 600, color: INK }}>{u.name}</td>
                <td style={td}>{u.color || '—'}</td>
                <td style={{ ...td, textAlign: 'center' }}>{u.size || 'Única'}</td>
                <td style={{ ...td, textAlign: 'center', color: MUTED }}>{u.um}</td>
                <td style={{ ...td, ...num, color: u.discount > 0 ? MUTED : INK_2, textDecoration: u.discount > 0 ? 'line-through' : 'none' }}>{money(u.listPrice)}</td>
                <td style={{ ...td, ...num, color: u.discount > 0 ? RED : MUTED }}>
                  {u.discount > 0 ? (
                    <>
                      <div style={{ fontWeight: 700 }}>- {money(u.discount)}</div>
                      <div style={{ fontSize: 9, color: MUTED, fontWeight: 500 }}>{u.discountLabel}</div>
                    </>
                  ) : '—'}
                </td>
                <td style={{ ...td, ...num, fontWeight: 700, color: INK }}>{money(u.price)}</td>
                {isFactura && <td style={{ ...td, ...num }}>{money(u.valueNoIgv)}</td>}
                {isFactura && <td style={{ ...td, ...num, color: MUTED }}>{money(u.igv)}</td>}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totales */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginTop: 22, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {receipt.totalSavings > 0.004 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: '#ECFDF5', color: GREEN, fontSize: 12, fontWeight: 600 }}>
                <Tag size={16} /> Ahorraste S/ {money(receipt.totalSavings)} en esta compra
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: MUTED }}>
              <UserCog size={14} color={GOLD} /> Atendido por: <strong style={{ color: INK_2 }}>{sale.operator || '—'}</strong>
            </div>
          </div>
          <div style={{ width: 300, border: `1px solid ${LINE}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '8px 16px' }}>
              <TotalRow label="Precio normal" value={`S/ ${money(receipt.listTotal)}`} />
              {receipt.promoSavings > 0.004 && <TotalRow label="Descuentos y promociones" value={`- S/ ${money(receipt.promoSavings)}`} color={RED} />}
              {receipt.globalDiscount > 0.004 && <TotalRow label="Descuento adicional" value={`- S/ ${money(receipt.globalDiscount)}`} color={RED} />}
              <div style={{ borderTop: `1px dashed ${LINE}`, margin: '4px 0' }} />
              <TotalRow label="Op. gravada" value={`S/ ${money(receipt.base)}`} />
              <TotalRow label="I.G.V. (18%)" value={`S/ ${money(receipt.igv)}`} />
            </div>
            <div style={{ background: INK, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#E2E8F0', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>PRECIO A PAGAR</span>
              <span style={{ color: GOLD, fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>S/ {money(receipt.total)}</span>
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Pie */}
        <div style={{ marginTop: 28, paddingTop: 16, borderTop: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 9.5, color: MUTED, lineHeight: 1.6 }}>
            Representación impresa de la {isFactura ? 'Factura' : 'Boleta de Venta'} Electrónica.<br />
            Los precios incluyen IGV. Conserve este comprobante para cambios y garantías.
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 999, border: `1.5px solid ${GREEN}`, color: GREEN, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
            <BadgeCheck size={15} /> COMPROBANTE EMITIDO
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 11, color: GOLD, fontWeight: 600, letterSpacing: '0.06em' }}>
          Gracias por tu compra
        </div>
      </div>
    </div>
  );
}

/* ---------------- Ticket (80 mm) ---------------- */
function TicketReceipt({ sale, config, receipt }) {
  const store = storeInfo(config);
  const date = new Date(sale.created_at);
  const dash = { borderTop: `1px dashed #CBD5E1`, margin: '10px 0' };

  return (
    <div style={{ width: RECEIPT_WIDTH.ticket, background: '#fff', color: INK, fontFamily: FONT, padding: '18px 14px', boxSizing: 'border-box', fontSize: 11 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <BrandLogo config={config} bg="light" maxHeight={52} maxWidth={190} crossOrigin="anonymous" textStyle={{ fontSize: 17 }} />
        </div>
        {store.ruc && <div style={{ fontSize: 10, color: MUTED, fontWeight: 600, marginTop: 2 }}>RUC {store.ruc}</div>}
        {store.address && <div style={{ fontSize: 9.5, color: MUTED, marginTop: 2 }}>{store.address}</div>}
        {store.phone && <div style={{ fontSize: 9.5, color: MUTED, marginTop: 1 }}>Tel. {store.phone}</div>}
        <div style={{ marginTop: 12, padding: '8px 0', borderTop: `1px solid ${INK}`, borderBottom: `1px solid ${INK}` }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: MUTED, textTransform: 'uppercase' }}>
            {sale.document_type === 'Sin Datos' ? 'Ticket de venta' : sale.document_type === 'Factura' ? 'Factura electrónica' : 'Boleta de venta electrónica'}
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: INK, letterSpacing: '0.06em', marginTop: 2 }}>N° {sale.invoice_number}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 10, fontSize: 10, color: '#334155' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CalendarDays size={12} color={GOLD} /> {formatDate(date)}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock3 size={12} color={GOLD} /> {formatTime(date)}</span>
      </div>

      <div style={dash} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10.5 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><UserRound size={12} color={GOLD} /> {sale.customer_name || 'Cliente genérico'}</span>
        {sale.customer_document && sale.customer_document !== '00000000' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><IdCard size={12} color={GOLD} /> {sale.customer_document}</span>
        )}
      </div>
      <div style={dash} />

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 700, color: MUTED, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
        <span>Detalle ({receipt.unitCount} und.)</span><span>Importe</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {receipt.units.map(u => (
          <div key={u.n} style={{ padding: '6px 0', borderBottom: `1px solid #F1F5F9` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontWeight: 700, color: INK, fontSize: 11 }}>{u.n}. {u.name}</span>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{money(u.price)}</span>
            </div>
            <div style={{ fontSize: 9.5, color: MUTED, marginTop: 2 }}>
              {[u.sku, u.color, u.size ? `Talla ${u.size}` : '', u.um].filter(Boolean).join(' · ')}
            </div>
            {u.discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 9.5, marginTop: 2 }}>
                <span style={{ color: RED, fontWeight: 600 }}>- S/ {money(u.discount)} <span style={{ color: MUTED, fontWeight: 500 }}>({u.discountLabel})</span></span>
                <span style={{ color: MUTED, whiteSpace: 'nowrap' }}>
                  Normal <span style={{ textDecoration: 'line-through' }}>{money(u.listPrice)}</span>
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 8 }}>
        <TotalRow label="Precio normal" value={`S/ ${money(receipt.listTotal)}`} size={11} />
        {receipt.promoSavings > 0.004 && <TotalRow label="Descuentos y promos" value={`- S/ ${money(receipt.promoSavings)}`} color={RED} size={11} />}
        {receipt.globalDiscount > 0.004 && <TotalRow label="Descuento adicional" value={`- S/ ${money(receipt.globalDiscount)}`} color={RED} size={11} />}
      </div>
      <div style={{ borderTop: `1.5px solid ${INK}`, borderBottom: `1.5px solid ${INK}`, padding: '9px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6 }}>
        <span style={{ color: INK, fontWeight: 700, fontSize: 11, letterSpacing: '0.08em' }}>PRECIO A PAGAR</span>
        <span style={{ color: INK, fontWeight: 800, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>S/ {money(receipt.total)}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10, fontSize: 10, color: '#334155' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CreditCard size={12} color={GOLD} /> Pago: <strong>{sale.payment_method}</strong></span>
        {sale.operator && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><UserCog size={12} color={GOLD} /> Atendió: {sale.operator}</span>}
      </div>

      {receipt.totalSavings > 0.004 && (
        <div style={{ marginTop: 10, padding: '6px 10px', borderRadius: 8, border: `1px solid ${GREEN}`, color: GREEN, fontSize: 10.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          <Tag size={12} /> Ahorraste S/ {money(receipt.totalSavings)}
        </div>
      )}

      <div style={dash} />
      <div style={{ textAlign: 'center', fontSize: 10, color: MUTED, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <ShieldCheck size={16} color={GOLD} />
        <span style={{ fontWeight: 600, color: INK_2 }}>Gracias por tu compra</span>
        <span style={{ fontSize: 9 }}>
          {sale.document_type === 'Sin Datos'
            ? 'Documento interno, no válido como comprobante tributario.'
            : `Representación impresa de la ${sale.document_type === 'Factura' ? 'Factura' : 'Boleta'} Electrónica. Precios incluyen IGV.`}
        </span>
      </div>
    </div>
  );
}

function VoidStamp() {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ transform: 'rotate(-24deg)', border: `4px solid ${RED}`, color: RED, borderRadius: 12, padding: '8px 28px', fontSize: 44, fontWeight: 900, letterSpacing: '0.12em', opacity: 0.28, fontFamily: FONT }}>
        ANULADO
      </div>
    </div>
  );
}

// format: 'ticket' fuerza el formato de 80 mm (p. ej. boleta impresa en ticketera)
const SaleReceipt = forwardRef(function SaleReceipt({ sale, config, productsById, format }, ref) {
  const variant = format === 'ticket' ? 'ticket' : docVariant(sale?.document_type);
  const receipt = buildReceipt(sale, productsById);
  return (
    <div ref={ref} className="sale-receipt" data-variant={variant} style={{ width: RECEIPT_WIDTH[variant], background: '#fff', position: 'relative' }}>
      {sale?.status === 'voided' && <VoidStamp />}
      {variant === 'ticket'
        ? <TicketReceipt sale={sale} config={config} receipt={receipt} />
        : <A4Receipt sale={sale} config={config} receipt={receipt} isFactura={sale?.document_type === 'Factura'} />}
    </div>
  );
});

export default SaleReceipt;
