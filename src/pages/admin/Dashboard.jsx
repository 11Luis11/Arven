import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Wallet, ShoppingBag, Users, AlertTriangle, ArrowRight, Package, Award, Receipt } from 'lucide-react';
import { DataService, subscribeToRealtime } from '../../services/dataService';
import { Link } from 'react-router-dom';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const money = (v) => `S/. ${num(v).toFixed(2)}`;

// Clave de fecha LOCAL (YYYY-MM-DD). Evita desfases por UTC.
const localKey = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('sv-SE');
};
const dayKeyOffset = (baseKey, offsetDays) => {
  const d = new Date(baseKey + 'T00:00:00');
  d.setDate(d.getDate() + offsetDays);
  return localKey(d);
};
const todayKey = () => localKey(new Date());

const SALE_STATUS = {
  voided: { label: 'Anulada', cls: 'badge-danger' },
  exchanged: { label: 'Con cambio', cls: 'badge-primary' },
};
const saleStatus = (s) => SALE_STATUS[s] || { label: 'Pagada', cls: 'badge-success' };

// Gráfico lineal SVG
function LineChart({ data, valueKey, color = 'var(--color-primary)', formatY }) {
  const W = 560, H = 160, PL = 52, PR = 12, PT = 12, PB = 32;
  const cW = W - PL - PR, cH = H - PT - PB;
  if (!data || data.length < 2) return (
    <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
      Sin datos aún — registra ventas para ver la tendencia
    </div>
  );
  const vals = data.map(d => d[valueKey]);
  const maxV = Math.max(...vals, 1);
  const toX = i => PL + (i / (data.length - 1)) * cW;
  const toY = v => PT + cH - (v / maxV) * cH;
  const pts = data.map((d, i) => ({ x: toX(i), y: toY(d[valueKey]) }));
  const line = pts.map(p => `${p.x},${p.y}`).join(' ');
  const area = `M${pts[0].x},${toY(0)} ${pts.map(p => `L${p.x},${p.y}`).join(' ')} L${pts[pts.length - 1].x},${toY(0)}Z`;
  const gridVals = [0, 0.5, 1].map(f => ({ y: PT + cH - f * cH, v: f * maxV }));
  const gradId = `g-${valueKey}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', maxHeight: H, overflow: 'visible' }} role="img" aria-label={`Tendencia de ${valueKey}`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          {/* style (no atributo) para que funcionen variables CSS */}
          <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.16 }} />
          <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      {gridVals.map((g, i) => (
        <g key={i}>
          <line x1={PL} y1={g.y} x2={W - PR} y2={g.y} style={{ stroke: 'var(--border-color)' }} strokeWidth="1" />
          <text x={PL - 8} y={g.y + 4} textAnchor="end" fontSize="11" style={{ fill: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
            {formatY ? formatY(g.v) : Math.round(g.v)}
          </text>
        </g>
      ))}
      <path d={area} fill={`url(#${gradId})`} />
      <polyline points={line} fill="none" style={{ stroke: color }} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => {
        const isLast = i === pts.length - 1;
        return (
          <circle key={i} cx={p.x} cy={p.y} r={isLast ? 5 : 3}
            style={{ fill: isLast ? color : 'var(--bg-card)', stroke: color }} strokeWidth="2">
            <title>{`${data[i].label}: ${formatY ? formatY(data[i][valueKey]) : data[i][valueKey]}`}</title>
          </circle>
        );
      })}
      {data.map((d, i) => {
        if (data.length > 10 && i % 2 !== 0 && i !== data.length - 1) return null;
        return (
          <text key={i} x={toX(i)} y={H - 6} textAnchor="middle" fontSize="11" style={{ fill: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

// Tarjeta KPI (fuera del componente para no remontarse en cada render)
function StatCard({ label, value, sub, icon: Icon, delta, tone = 'primary' }) {
  const toneStyle = {
    primary: { background: 'var(--color-primary-soft)', color: 'var(--color-primary)' },
    success: { background: 'var(--color-success-soft)', color: 'var(--color-success)' },
    warning: { background: 'var(--color-warning-soft)', color: 'var(--color-warning)' },
    info: { background: 'var(--color-info-soft)', color: 'var(--color-info)' },
  }[tone];
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <span className="stat-label">{label}</span>
        <span className="stat-icon" style={toneStyle}><Icon size={20} strokeWidth={1.75} /></span>
      </div>
      <span className="stat-value" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={String(value)}>{value}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minHeight: '20px', flexWrap: 'wrap' }}>
        {delta && (
          <span className={`badge ${delta.up ? 'badge-success' : 'badge-danger'}`}>
            {delta.up ? '↑' : '↓'} {Math.abs(delta.pct)}%
          </span>
        )}
        {delta && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>vs. día anterior</span>}
        {sub && !delta && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{sub}</span>}
      </div>
    </div>
  );
}

function SectionTitle({ title, subtitle, icon: Icon }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 600 }}>{title}</h3>
        {subtitle && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>{subtitle}</p>}
      </div>
      {Icon && <Icon size={18} strokeWidth={1.75} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
    </div>
  );
}

const deltaLabel = (cur, prev) => {
  if (!prev) return null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  return { pct, up: pct >= 0 };
};

// Cálculo puro de todas las métricas a partir de los datos crudos
function computeDashboard({ sales, saleItems, customers, products, register }, selectedDate) {
  const today = todayKey();
  const prevDate = dayKeyOffset(selectedDate, -1);

  // Índice de unidades por venta: O(n) en vez de filtrar items por cada venta
  const qtyBySale = new Map();
  for (const i of saleItems) qtyBySale.set(i.sale_id, (qtyBySale.get(i.sale_id) || 0) + num(i.quantity));

  const validSales = sales.filter(s => s.status !== 'voided'); // 'exchanged' sí cuenta
  const voidedIds = new Set(sales.filter(s => s.status === 'voided').map(s => s.id));

  // Agrupar ventas válidas por día local
  const byDay = new Map();
  for (const s of validSales) {
    const k = localKey(s.created_at);
    const acc = byDay.get(k) || { count: 0, total: 0, polos: 0 };
    acc.count += 1;
    acc.total += num(s.total_amount);
    acc.polos += qtyBySale.get(s.id) || 0;
    byDay.set(k, acc);
  }
  const empty = { count: 0, total: 0, polos: 0 };
  const cur = byDay.get(selectedDate) || empty;
  const prev = byDay.get(prevDate) || empty;

  const cash = register?.status === 'open' && register.currentSession ? num(register.currentSession.theoretical_amount) : 0;

  // Últimos 14 días (hasta hoy)
  const daily = Array.from({ length: 14 }, (_, i) => {
    const k = dayKeyOffset(today, i - 13);
    const d = new Date(k + 'T00:00:00');
    const v = byDay.get(k) || empty;
    return { label: `${d.getDate()} ${MONTHS[d.getMonth()]}`, total: v.total, polos: v.polos };
  });

  // Top productos histórico (excluye ítems de ventas anuladas)
  const cnt = {};
  for (const i of saleItems) {
    if (voidedIds.has(i.sale_id)) continue;
    cnt[i.product_id] = (cnt[i.product_id] || 0) + num(i.quantity);
  }
  const productById = new Map(products.map(p => [p.id, p]));
  const topProds = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, qty]) => ({
    id, name: productById.get(id)?.name || 'Producto descatalogado', qty
  }));

  // Colaborador estrella (acumulado histórico)
  const sellerTotals = {};
  for (const s of validSales) {
    const op = s.operator || 'Admin Principal';
    sellerTotals[op] = (sellerTotals[op] || 0) + num(s.total_amount);
  }
  const topSeller = Object.entries(sellerTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => ({ name, amount }))[0] || { name: 'Ninguno', amount: 0 };

  // Ventas del día seleccionado (incluye anuladas para mostrarlas con su estado)
  const daySales = sales
    .filter(s => localKey(s.created_at) === selectedDate)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8);

  return {
    metrics: { sales: cur.count, earnings: cur.total, polos: cur.polos, customers: customers.length, cash, cashOpen: register?.status === 'open' },
    prevMetrics: { sales: prev.count, earnings: prev.total, polos: prev.polos },
    dailySales: daily.map(d => ({ label: d.label, total: d.total })),
    dailyPolos: daily.map(d => ({ label: d.label, polos: d.polos })),
    lowStock: products.filter(p => num(p.stock) <= 5).sort((a, b) => num(a.stock) - num(b.stock)),
    topProds,
    topSeller,
    daySales,
  };
}

const arr = (v) => (Array.isArray(v) ? v : []);

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [raw, setRaw] = useState(null);

  // Carga en paralelo; una sola suscripción realtime
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [sales, saleItems, customers, products, register] = await Promise.all([
        DataService.getSales(),
        DataService.getSaleItems(),
        DataService.getCustomers(),
        DataService.getProducts(),
        DataService.getCashRegister()
      ]);
      if (cancelled) return;
      setRaw({ sales: arr(sales), saleItems: arr(saleItems), customers: arr(customers), products: arr(products), register });
    };
    load();
    const unsub = subscribeToRealtime(() => load());
    return () => { cancelled = true; unsub(); };
  }, []);

  const handleSetQuickDate = (daysAgo) => setSelectedDate(dayKeyOffset(todayKey(), -daysAgo));

  if (!raw) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="skeleton" style={{ height: '36px', width: '240px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '16px' }}>
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton" style={{ height: '120px', borderRadius: 'var(--radius-lg)' }} />)}
        </div>
        <div className="skeleton" style={{ height: '220px', borderRadius: 'var(--radius-lg)' }} />
      </div>
    );
  }

  const { metrics, prevMetrics, dailySales, dailyPolos, lowStock, topProds, topSeller, daySales } = computeDashboard(raw, selectedDate);
  const today = todayKey();
  const yesterday = dayKeyOffset(today, -1);
  const isToday = selectedDate === today;
  const dayLabel = isToday ? 'hoy' : selectedDate === yesterday ? 'ayer'
    : new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });

  const twoCol = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: '16px' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Cabecera + selector de día */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1>Resumen</h1>
          <p>Indicadores de ventas de {dayLabel}.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div className="tabs">
            <button className={`tab ${selectedDate === today ? 'active' : ''}`} onClick={() => handleSetQuickDate(0)}>Hoy</button>
            <button className={`tab ${selectedDate === yesterday ? 'active' : ''}`} onClick={() => handleSetQuickDate(1)}>Ayer</button>
          </div>
          <input
            type="date"
            aria-label="Seleccionar día"
            className="input-field"
            value={selectedDate}
            max={today}
            onChange={e => e.target.value && setSelectedDate(e.target.value)}
            style={{ width: 'auto' }}
          />
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '16px' }}>
        <StatCard label="Facturación" value={money(metrics.earnings)} icon={DollarSign} tone="success"
          delta={deltaLabel(metrics.earnings, prevMetrics.earnings)} sub={`Ventas de ${dayLabel}`} />
        <StatCard label="Polos vendidos" value={`${metrics.polos} uds`} icon={ShoppingBag}
          delta={deltaLabel(metrics.polos, prevMetrics.polos)} sub={`Unidades de ${dayLabel}`} />
        <StatCard label="Transacciones" value={metrics.sales} icon={TrendingUp} tone="info"
          delta={deltaLabel(metrics.sales, prevMetrics.sales)} sub="Ventas válidas" />
        <StatCard label="Caja actual" value={money(metrics.cash)} icon={Wallet} tone={metrics.cashOpen ? 'success' : 'warning'}
          sub={metrics.cashOpen ? 'Caja abierta · efectivo esperado' : 'Caja cerrada'} />
        <StatCard label="Clientes" value={metrics.customers} icon={Users} tone="info" sub="Registrados en total" />
        <StatCard label="Cajero estrella" value={topSeller.name} icon={Award} tone="warning"
          sub={`Histórico: ${money(topSeller.amount)}`} />
      </div>

      {/* Gráficos */}
      <div style={twoCol}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
          <SectionTitle title="Facturación diaria" subtitle="Soles · últimos 14 días" />
          <LineChart data={dailySales} valueKey="total" color="var(--color-primary)" formatY={v => `S/${Math.round(v)}`} />
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
          <SectionTitle title="Polos vendidos" subtitle="Unidades · últimos 14 días" />
          <LineChart data={dailyPolos} valueKey="polos" color="var(--color-success)" />
        </div>
      </div>

      {/* Ventas del día */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <SectionTitle title={`Ventas de ${dayLabel}`} subtitle="Últimos comprobantes emitidos" />
          <Link to="/admin/reports" className="btn-ghost btn-sm">Ver todas <ArrowRight size={14} /></Link>
        </div>
        {daySales.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 16px' }}>
            <Receipt size={32} strokeWidth={1.5} />
            <p style={{ fontSize: '14px' }}>No hay ventas registradas {isToday ? 'hoy' : 'en este día'}.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                <tr>
                  <th>Comprobante</th>
                  <th>Cliente</th>
                  <th>Hora</th>
                  <th>Pago</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {daySales.map(s => {
                  const st = saleStatus(s.status);
                  const voided = s.status === 'voided';
                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{s.invoice_number || '—'}</td>
                      <td style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.customer_name || 'Cliente general'}</td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                        {new Date(s.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </td>
                      <td>{s.payment_method || '—'}</td>
                      <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', textDecoration: voided ? 'line-through' : 'none', color: voided ? 'var(--text-muted)' : 'inherit' }}>
                        {money(s.total_amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top productos + Stock crítico */}
      <div style={twoCol}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          <SectionTitle title="Top 5 más vendidos" subtitle="Acumulado histórico" icon={Package} />
          {topProds.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 16px' }}>
              <Package size={28} strokeWidth={1.5} />
              <p style={{ fontSize: '14px' }}>Aún no hay ventas.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {topProds.map((p, i) => {
                const pct = topProds[0].qty ? (p.qty / topProds[0].qty) * 100 : 0;
                return (
                  <div key={p.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '14px', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>#{i + 1}</span>{p.name}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{p.qty} uds</span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-primary)', borderRadius: 'var(--radius-pill)', transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Link to="/admin/reports" className="btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}>
            Ver reportes <ArrowRight size={14} />
          </Link>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          <SectionTitle title="Stock crítico" subtitle="Productos con 5 unidades o menos" icon={AlertTriangle} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
            {lowStock.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 16px' }}>
                <Package size={28} strokeWidth={1.5} />
                <p style={{ fontSize: '14px' }}>Todo en orden: sin quiebres de stock.</p>
              </div>
            ) : lowStock.map(p => (
              <div key={p.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
                padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', background: 'var(--bg-subtle)'
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>SKU: {p.sku || '—'}</div>
                </div>
                <span className={`badge ${num(p.stock) === 0 ? 'badge-danger' : 'badge-warning'}`}>
                  {num(p.stock) === 0 ? 'Agotado' : `${num(p.stock)} uds`}
                </span>
              </div>
            ))}
          </div>
          <Link to="/admin/inventory" className="btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}>
            Gestionar inventario <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
