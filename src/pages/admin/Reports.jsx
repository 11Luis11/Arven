import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Download, FileText, Receipt, Search, ShieldAlert, TrendingUp, DollarSign, Tag, Ban, Package, RefreshCw } from 'lucide-react';
import { DataService, subscribeToRealtime } from '../../services/dataService';
import { toast } from '../../utils/toast';
import { downloadCsv } from '../../utils/csv';
import ReceiptModal from '../../components/receipts/ReceiptModal';

const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem('admin_user');
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    /* sesión corrupta: usar valores por defecto */
  }
  return { name: 'Admin Principal', role: 'admin' };
};

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const formatNoRound = (value) => {
  const n = num(value);
  const truncated = Math.trunc(n * 100) / 100;
  const parts = truncated.toString().split('.');
  if (parts.length === 1) return parts[0] + '.00';
  if (parts[1].length === 1) return parts[0] + '.' + parts[1] + '0';
  return parts[0] + '.' + parts[1].substring(0, 2);
};

const isExchangedName = (name) => String(name || '').includes('CAMBIO');

const PERIODS = [
  { label: 'Hoy', value: 'day', hint: 'Ventas de hoy' },
  { label: '7 días', value: 'week', hint: 'Últimos 7 días (incluye hoy)' },
  { label: 'Mes', value: 'month', hint: 'Mes en curso' },
  { label: 'Año', value: 'year', hint: 'Año en curso' },
];

// Inicio del periodo en hora LOCAL (medianoche)
const getPeriodStart = (period) => {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'week') d.setDate(d.getDate() - 6);
  else if (period === 'month') d.setDate(1);
  else if (period === 'year') d.setMonth(0, 1);
  return d;
};

const STATUS = {
  voided: { label: 'Anulada', cls: 'badge-danger' },
  exchanged: { label: 'Con cambio', cls: 'badge-primary' },
};
const statusBadge = (s) => STATUS[s] || { label: 'Emitida', cls: 'badge-success' };
const paymentBadge = (m) => (m === 'Efectivo' ? 'badge-success' : m === 'Yape' || m === 'Plin' ? 'badge-info' : 'badge-warning');

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

const PAGE_SIZE = 50;

export default function Reports() {
  const [currentUser] = useState(getCurrentUser);

  // Solo admin y viewer pueden ver reportes (el return va DESPUÉS de los hooks)
  if (currentUser.role === 'employee') {
    return (
      <div className="card">
        <div className="empty-state">
          <ShieldAlert size={36} strokeWidth={1.5} />
          <h3>Acceso restringido</h3>
          <p style={{ fontSize: '14px' }}>No tienes permisos para ver los reportes. Contacta al administrador.</p>
        </div>
      </div>
    );
  }
  return <ReportsView currentUser={currentUser} />;
}

function ReportsView({ currentUser }) {
  const [sales, setSales] = useState([]);
  const [saleItems, setSaleItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [period, setPeriod] = useState('month');
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);

  // Modales de comprobante
  const [selectedSale, setSelectedSale] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);

  // Anulación
  const [voidingId, setVoidingId] = useState(null);

  // Cambios y devoluciones
  const [exchangeSale, setExchangeSale] = useState(null);
  const [exchangeItem, setExchangeItem] = useState(null);
  const [exchangeQty, setExchangeQty] = useState(1);
  const [replacementProductId, setReplacementProductId] = useState('');
  const [replacementColorHex, setReplacementColorHex] = useState('');
  const [replacementSize, setReplacementSize] = useState('');
  const [exchangeLoading, setExchangeLoading] = useState(false);

  const loadSeq = useRef(0);
  const loadData = useCallback(async () => {
    const seq = ++loadSeq.current;
    // Cargas en paralelo
    const result = await Promise.all([
      DataService.getSales(),
      DataService.getSaleItems(),
      DataService.getProducts(),
      DataService.getConfig(),
    ]).catch(err => {
      console.error('Error al cargar reportes:', err);
      toast.error('No se pudieron cargar los reportes.');
      return null;
    });
    if (seq !== loadSeq.current) return;
    setLoading(false);
    if (!result) return;
    const [s, items, prods, cfg] = result;
    const salesArr = Array.isArray(s) ? s : [];
    const itemsArr = Array.isArray(items) ? items : [];
    setSales(Array.from(new Map(salesArr.map(item => [item.id, item])).values()));
    setSaleItems(Array.from(new Map(itemsArr.map(item => [item.id, item])).values()));
    setProducts(Array.isArray(prods) ? prods : []);
    setConfig(cfg || null);
  }, []);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToRealtime(() => loadData());
    return () => unsubscribe();
  }, [loadData]);

  // Índice items por venta (evita filtrar todo el arreglo por cada fila)
  const itemsBySale = useMemo(() => {
    const map = new Map();
    for (const it of saleItems) {
      const list = map.get(it.sale_id);
      if (list) list.push(it); else map.set(it.sale_id, [it]);
    }
    return map;
  }, [saleItems]);
  const getItemsForSale = (saleId) => itemsBySale.get(saleId) || [];
  const productsById = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

  const periodSales = useMemo(() => {
    const start = getPeriodStart(period).getTime();
    return sales.filter(sale => {
      const t = new Date(sale.created_at).getTime();
      return Number.isFinite(t) && t >= start;
    });
  }, [sales, period]);

  // Métricas: se excluyen ANULADAS; las ventas con cambio ('exchanged') sí suman
  const { activeSales, totalRevenue, totalDiscounts, voidedCount, avgTicket } = useMemo(() => {
    const active = periodSales.filter(s => s.status !== 'voided');
    const revenue = active.reduce((sum, s) => sum + num(s.total_amount), 0);
    return {
      activeSales: active,
      totalRevenue: revenue,
      totalDiscounts: active.reduce((sum, s) => sum + num(s.discount_amount), 0),
      voidedCount: periodSales.length - active.length,
      avgTicket: active.length ? revenue / active.length : 0,
    };
  }, [periodSales]);

  const topProducts = useMemo(() => {
    const productById = new Map(products.map(p => [p.id, p]));
    const acc = {};
    activeSales.forEach(s => {
      (itemsBySale.get(s.id) || []).forEach(item => {
        const e = acc[item.product_id] || (acc[item.product_id] = { qty: 0, revenue: 0 });
        e.qty += num(item.quantity);
        // Ingreso real vendido (no el precio actual del catálogo)
        e.revenue += item.total_price != null ? num(item.total_price) : num(item.quantity) * num(item.unit_price);
      });
    });
    return Object.entries(acc).map(([pId, v]) => {
      const prod = productById.get(pId);
      return { id: pId, name: prod ? prod.name : 'Polo descatalogado', sku: prod ? prod.sku : 'N/A', qty: v.qty, revenue: v.revenue };
    }).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [activeSales, itemsBySale, products]);

  const tableSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return periodSales;
    return periodSales.filter(s =>
      String(s.invoice_number || '').toLowerCase().includes(q) ||
      String(s.customer_name || '').toLowerCase().includes(q) ||
      String(s.customer_document || '').toLowerCase().includes(q) ||
      String(s.operator || '').toLowerCase().includes(q)
    );
  }, [periodSales, search]);

  // Anulación de venta
  const handleVoidSale = async (saleId) => {
    if (voidingId) return;
    if (!window.confirm('¿Seguro que deseas ANULAR esta venta? Esto restaurará el inventario y registrará la corrección en la caja activa.')) return;
    setVoidingId(saleId);
    try {
      await DataService.voidSale(saleId, currentUser.name);
      toast.success('Venta anulada. Caja e inventario actualizados.');
      if (exchangeSale?.id === saleId) setExchangeSale(null);
    } catch (err) {
      toast.error(err?.message || 'No se pudo anular la venta.');
    } finally {
      setVoidingId(null);
      loadData();
    }
  };

  // Exportar CSV (abre en Excel; BOM UTF-8 para tildes)
  const handleExportCSV = () => {
    if (periodSales.length === 0) {
      toast.warning('No hay ventas en este periodo para exportar.');
      return;
    }
    const header = 'Nro Comprobante,Cliente,Atendido por,Metodo Pago,Fecha,Hora,Tipo,Descuento,Total,Estado';
    const rows = periodSales.map(s => {
      const d = new Date(s.created_at);
      return [
        csvCell(s.invoice_number),
        csvCell(s.customer_name),
        csvCell(s.operator || '—'),
        csvCell(s.payment_method),
        csvCell(d.toLocaleDateString('es-PE')),
        csvCell(d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true })),
        csvCell(s.type),
        csvCell(`S/. ${formatNoRound(s.discount_amount)}`),
        csvCell(`S/. ${formatNoRound(s.total_amount)}`),
        csvCell(s.status),
      ].join(',');
    });
    downloadCsv(`Ventas_${period.toUpperCase()}_${new Date().toLocaleDateString('sv-SE')}.csv`, [header, ...rows].join('\r\n'));
    toast.success(`${periodSales.length} ventas exportadas.`);
  };

  const openInvoice = (sale) => {
    setSelectedSale(sale);
    setShowInvoiceModal(true);
    setShowTicketModal(false);
  };

  const openTicket = (sale) => {
    setSelectedSale(sale);
    setShowTicketModal(true);
    setShowInvoiceModal(false);
  };

  const toggleExchange = (s) => {
    if (exchangeSale?.id === s.id) {
      setExchangeSale(null);
    } else {
      setExchangeSale(s);
      setExchangeItem(null);
      setExchangeQty(1);
      setReplacementProductId('');
      setReplacementColorHex('');
      setReplacementSize('');
    }
  };

  // Datos del producto de reemplazo (se calculan una vez, no por fila)
  const selectedReplacementProduct = products.find(p => p.id === replacementProductId);
  const replacementColors = selectedReplacementProduct?.colors || [];
  const selectedRepColor = replacementColors.find(c => c.hex === replacementColorHex);
  const replacementSizes = selectedReplacementProduct?.sizes || [];
  const exchangeDisabled = exchangeLoading || !exchangeItem || !replacementProductId
    || (replacementColors.length > 0 && !replacementColorHex)
    || (replacementSizes.length > 0 && !replacementSize);

  const getReplacementPrice = () => {
    const p = selectedReplacementProduct;
    if (!p) return 0;
    const sizePrices = (p.wholesale_tiers || []).find(t => t.type === 'size_prices')?.data || {};
    const sizeData = sizePrices[replacementSize] || {};
    const hasOffer = p.offer_price !== null && p.offer_price !== undefined && p.offer_price !== '';
    const regular = (sizeData.price && sizeData.price !== '')
      ? num(sizeData.price)
      : num(hasOffer ? p.offer_price : p.price);
    return (sizeData.offer_price && sizeData.offer_price !== '') ? num(sizeData.offer_price) : regular;
  };

  const handleConfirmExchange = async (sale) => {
    if (exchangeDisabled) return;
    setExchangeLoading(true);
    try {
      await DataService.exchangeProduct(
        sale.id,
        exchangeItem.id,
        replacementProductId,
        replacementColorHex || null,
        selectedRepColor?.name || null,
        replacementSize || null,
        currentUser.name,
        exchangeQty
      );
      toast.success('Cambio de producto realizado con éxito.');
      setExchangeSale(null);
    } catch (err) {
      toast.error('Error al realizar el cambio: ' + (err?.message || 'inténtalo nuevamente.'));
    } finally {
      setExchangeLoading(false);
      loadData();
    }
  };

  const stepLabel = { display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', marginBottom: '8px' };

  // Panel de cambio (función que devuelve JSX, no un componente anidado)
  const renderExchangePanel = (s, items) => {
    let priceBox = null;
    if (exchangeItem && replacementSize) {
      const repActivePrice = getReplacementPrice();
      const originalUnitPrice = num(exchangeItem.unit_price);
      const diffAmountTotal = (repActivePrice - originalUnitPrice) * exchangeQty;
      const tone = diffAmountTotal > 0 ? 'alert-warning' : diffAmountTotal < 0 ? 'alert-success' : 'alert-info';
      priceBox = (
        <div className={`alert ${tone}`} style={{ flexDirection: 'column', gap: '6px', fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cálculo de diferencia ({exchangeQty} uds)</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <span>Precio unitario devuelto</span><strong>S/. {originalUnitPrice.toFixed(2)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <span>Precio unitario nuevo</span><strong>S/. {repActivePrice.toFixed(2)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '15px', fontWeight: 700, borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '6px' }}>
            <span>{diffAmountTotal > 0 ? 'Diferencia a cobrar' : diffAmountTotal < 0 ? 'Diferencia a devolver' : 'Sin diferencia'}</span>
            <span>S/. {Math.abs(diffAmountTotal).toFixed(2)}</span>
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '650px' }}>
        <div>
          <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-primary)' }}>↻ Cambiar prendas de esta venta</h4>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Elige la prenda vendida, la cantidad y su reemplazo. El inventario y el total del comprobante se recalculan automáticamente.
          </p>
        </div>

        <div>
          <span style={stepLabel}>1. Producto a devolver</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {items.length === 0 && <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Esta venta no tiene ítems registrados.</p>}
            {items.map(item => {
              const active = exchangeItem?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setExchangeItem(item); setExchangeQty(1); }}
                  style={{
                    padding: '12px 14px',
                    border: active ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                    background: active ? 'var(--bg-card)' : 'var(--bg-subtle)',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer', textAlign: 'left', fontSize: '14px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
                    boxShadow: active ? 'var(--shadow-sm)' : 'none'
                  }}
                >
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                    {item.quantity}x {item.product_name}
                    {isExchangedName(item.product_name) && <span className="badge badge-primary" style={{ marginLeft: '8px' }}>Cambiado</span>}
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>S/. {formatNoRound(item.unit_price)} c/u</span>
                </button>
              );
            })}
          </div>
        </div>

        {exchangeItem && (
          <>
            {exchangeItem.quantity > 1 && (
              <div>
                <label style={stepLabel} htmlFor="exchange-qty">Cantidad a cambiar (máx. {exchangeItem.quantity})</label>
                <input
                  id="exchange-qty"
                  type="number"
                  min={1}
                  max={exchangeItem.quantity}
                  className="input-field"
                  value={exchangeQty}
                  onChange={e => setExchangeQty(Math.max(1, Math.min(exchangeItem.quantity, parseInt(e.target.value, 10) || 1)))}
                  style={{ width: '120px' }}
                />
              </div>
            )}

            <div>
              <label style={stepLabel} htmlFor="exchange-product">2. Nuevo producto</label>
              <select
                id="exchange-product"
                className="input-field"
                value={replacementProductId}
                onChange={e => { setReplacementProductId(e.target.value); setReplacementColorHex(''); setReplacementSize(''); }}
              >
                <option value="">— Seleccionar producto —</option>
                {products.filter(p => p.active && p.stock > 0).map(p => (
                  <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>
                ))}
              </select>
            </div>

            {replacementColors.length > 0 && (
              <div>
                <span style={stepLabel}>3. Color</span>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {replacementColors.map(c => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setReplacementColorHex(c.hex)}
                      title={c.name}
                      aria-label={c.name}
                      style={{
                        width: '34px', height: '34px', borderRadius: '50%',
                        backgroundColor: c.hex,
                        border: '1px solid var(--border-strong)',
                        cursor: 'pointer',
                        boxShadow: replacementColorHex === c.hex ? '0 0 0 2px #FFF, 0 0 0 4px var(--color-primary)' : 'none'
                      }}
                    />
                  ))}
                </div>
                {selectedRepColor && <p className="field-hint">{selectedRepColor.name} — Stock: {selectedRepColor.stock || 0}</p>}
              </div>
            )}

            {replacementSizes.length > 0 && (
              <div>
                <span style={stepLabel}>4. Talla</span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {replacementSizes.map(sz => {
                    const sizeStock = selectedRepColor?.sizes_stock?.[sz] ?? '?';
                    const active = replacementSize === sz;
                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setReplacementSize(sz)}
                        className={active ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                      >
                        {sz} ({sizeStock})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {priceBox}

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button className="btn-primary" disabled={exchangeDisabled} onClick={() => handleConfirmExchange(s)}>
                {exchangeLoading ? 'Procesando…' : 'Confirmar cambio'}
              </button>
              <button className="btn-secondary" onClick={() => setExchangeSale(null)} disabled={exchangeLoading}>
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  const periodHint = PERIODS.find(p => p.value === period)?.hint;
  const shownSales = tableSales.slice(0, visible);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Cabecera */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1>Reportes de ventas</h1>
          <p>{periodHint}. Las ventas anuladas no suman en los totales.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="tabs" role="tablist">
            {PERIODS.map(opt => (
              <button
                key={opt.value}
                role="tab"
                aria-selected={period === opt.value}
                className={`tab ${period === opt.value ? 'active' : ''}`}
                onClick={() => { setPeriod(opt.value); setVisible(PAGE_SIZE); }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button onClick={handleExportCSV} className="btn-secondary">
            <Download size={16} /> Exportar Excel
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '16px' }}>
        {[
          { label: 'Ingresos netos', value: `S/. ${formatNoRound(totalRevenue)}`, sub: 'Facturación real', icon: DollarSign, tone: ['var(--color-success-soft)', 'var(--color-success)'] },
          { label: 'Ventas activas', value: activeSales.length, sub: 'Excluye anuladas', icon: TrendingUp, tone: ['var(--color-primary-soft)', 'var(--color-primary)'] },
          { label: 'Ticket promedio', value: `S/. ${formatNoRound(avgTicket)}`, sub: 'Por venta', icon: Receipt, tone: ['var(--color-info-soft)', 'var(--color-info)'] },
          { label: 'Descuentos', value: `S/. ${formatNoRound(totalDiscounts)}`, sub: 'Cupones aplicados', icon: Tag, tone: ['var(--color-warning-soft)', 'var(--color-warning)'] },
          { label: 'Anuladas', value: voidedCount, sub: 'En el periodo', icon: Ban, tone: ['var(--color-danger-soft)', 'var(--color-danger)'] },
        ].map(k => (
          <div key={k.label} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <span className="stat-label">{k.label}</span>
              <span className="stat-icon" style={{ background: k.tone[0], color: k.tone[1] }}><k.icon size={20} strokeWidth={1.75} /></span>
            </div>
            {loading ? <div className="skeleton" style={{ height: '30px', width: '70%' }} /> : <span className="stat-value">{k.value}</span>}
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{k.sub}</span>
          </div>
        ))}
      </div>

      {/* TOP PRODUCTOS */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Top de ventas</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>Productos más vendidos del periodo</p>
        </div>
        {topProducts.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 16px' }}>
            <Package size={28} strokeWidth={1.5} />
            <p style={{ fontSize: '14px' }}>Sin ventas en este periodo.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: '12px' }}>
            {topProducts.map((tp, idx) => (
              <div key={tp.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '14px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', background: idx === 0 ? 'var(--color-primary-soft)' : 'var(--bg-card)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={`badge ${idx === 0 ? 'badge-primary' : ''}`}>#{idx + 1}</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{tp.qty} uds</span>
                </div>
                <strong style={{ fontSize: '14px', lineHeight: 1.3 }}>{tp.name}</strong>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span>SKU: {tp.sku}</span>
                  <span style={{ color: 'var(--color-success)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>S/. {formatNoRound(tp.revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* REGISTRO DE COMPROBANTES */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Comprobantes emitidos</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {tableSales.length} {tableSales.length === 1 ? 'comprobante' : 'comprobantes'}{search ? ' encontrados' : ' en el periodo'}
            </p>
          </div>
          <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              type="search"
              className="input-field"
              placeholder="Buscar N°, cliente, DNI u operador…"
              value={search}
              onChange={e => { setSearch(e.target.value); setVisible(PAGE_SIZE); }}
              style={{ paddingLeft: '36px' }}
              aria-label="Buscar comprobantes"
            />
          </div>
        </div>

        {loading ? (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Array.from({ length: 5 }, (_, i) => <div key={i} className="skeleton" style={{ height: '22px' }} />)}
          </div>
        ) : tableSales.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <Receipt size={36} strokeWidth={1.5} />
              <h3>{search ? 'Sin resultados' : 'Ninguna venta en este periodo'}</h3>
              <p style={{ fontSize: '14px' }}>{search ? 'Prueba con otro término de búsqueda.' : 'Cambia el periodo para ver otras ventas.'}</p>
              {search && <button className="btn-secondary btn-sm" onClick={() => setSearch('')} style={{ marginTop: '8px' }}>Limpiar búsqueda</button>}
            </div>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <thead>
                  <tr>
                    <th>Nro doc</th>
                    <th>Cliente</th>
                    <th>Atendido por</th>
                    <th>Pago</th>
                    <th>Fecha / hora</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th>Estado</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {shownSales.map(s => {
                    const isVoided = s.status === 'voided';
                    const docType = s.document_type || 'Boleta';
                    const isTicket = docType === 'Sin Datos';
                    const st = statusBadge(s.status);
                    const isExchangeOpen = exchangeSale?.id === s.id;
                    const d = new Date(s.created_at);

                    return (
                      <React.Fragment key={s.id}>
                        <tr style={isVoided ? { background: 'var(--color-danger-soft)' } : undefined}>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 600 }}>{s.invoice_number || '—'}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{docType}</div>
                          </td>
                          <td style={{ maxWidth: '200px' }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.customer_name || 'Cliente general'}</div>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 500 }}>{s.operator || '—'}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{s.type === 'pos' ? 'POS' : 'Online'}</div>
                          </td>
                          <td><span className={`badge ${paymentBadge(s.payment_method)}`}>{s.payment_method || '—'}</span></td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 500 }}>{d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', textDecoration: isVoided ? 'line-through' : 'none', color: isVoided ? 'var(--text-muted)' : 'inherit' }}>
                            S/. {formatNoRound(s.total_amount)}
                          </td>
                          <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                              {isTicket ? (
                                <button onClick={() => openTicket(s)} className="btn-secondary btn-sm" title="Ver / imprimir ticket">
                                  <Receipt size={14} /> Ticket
                                </button>
                              ) : (
                                <button onClick={() => openInvoice(s)} className="btn-secondary btn-sm" title={`Ver ${docType} SUNAT`}>
                                  <FileText size={14} /> {docType}
                                </button>
                              )}
                              {!isVoided && (
                                <>
                                  <button
                                    onClick={() => toggleExchange(s)}
                                    className={isExchangeOpen ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
                                    title="Cambio de producto"
                                  >
                                    <RefreshCw size={14} /> {isExchangeOpen ? 'Cerrar' : 'Cambio'}
                                  </button>
                                  <button
                                    onClick={() => handleVoidSale(s.id)}
                                    className="btn-danger btn-sm"
                                    disabled={!!voidingId}
                                    title="Anular venta y reponer stock"
                                  >
                                    {voidingId === s.id ? 'Anulando…' : 'Anular'}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExchangeOpen && (
                          <tr>
                            <td colSpan={8} style={{ padding: '24px', background: 'var(--bg-subtle)', borderBottom: '2px solid var(--color-primary)' }}>
                              {renderExchangePanel(s, getItemsForSale(s.id))}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {tableSales.length > visible && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button className="btn-secondary" onClick={() => setVisible(v => v + PAGE_SIZE)}>
                  Mostrar más ({tableSales.length - visible} restantes)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Comprobante (mismo diseño que el POS: pantalla, impresión y PDF) */}
      {selectedSale && (showTicketModal || showInvoiceModal) && (
        <ReceiptModal
          sale={{ ...selectedSale, items: getItemsForSale(selectedSale.id) }}
          config={config}
          productsById={productsById}
          format={showTicketModal ? 'ticket' : undefined}
          onClose={() => { setShowTicketModal(false); setShowInvoiceModal(false); setSelectedSale(null); }}
        />
      )}

      <style>{`
        @media (max-width: 768px) {
          .reports-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>




    </div>
  );
}
