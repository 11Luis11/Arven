import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Wallet, ShoppingBag, Users, AlertTriangle, ArrowRight, Package } from 'lucide-react';
import { DataService, subscribeToRealtime } from '../../services/dataService';
import { Link } from 'react-router-dom';

// Gráfico lineal SVG — estilo referencia (línea azul, fondo lila suave, punto rojo en hoy)
function LineChart({ data, valueKey, color = '#1A1AFF', formatY }) {
  const W = 560, H = 140, PL = 48, PR = 12, PT = 12, PB = 32;
  const cW = W - PL - PR, cH = H - PT - PB;
  if (!data || data.length < 2) return (
    <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
      Sin datos aún — registra ventas para ver la tendencia
    </div>
  );
  const vals = data.map(d => d[valueKey]);
  const maxV = Math.max(...vals, 1);
  const toX = i => PL + (i / (data.length - 1)) * cW;
  const toY = v => PT + cH - (v / maxV) * cH;
  const pts = data.map((d, i) => ({ x: toX(i), y: toY(d[valueKey]) }));
  const line = pts.map(p => `${p.x},${p.y}`).join(' ');
  const area = `M${pts[0].x},${toY(0)} ${pts.map(p => `L${p.x},${p.y}`).join(' ')} L${pts[pts.length-1].x},${toY(0)}Z`;
  const gridVals = [0, 0.5, 1].map(f => ({ y: PT + cH - f * cH, v: f * maxV }));
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, overflow: 'visible' }}>
      <defs>
        <linearGradient id={`g-${valueKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.12"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {gridVals.map((g, i) => (
        <g key={i}>
          <line x1={PL} y1={g.y} x2={W - PR} y2={g.y} stroke="#EAEAEA" strokeWidth="1"/>
          <text x={PL - 6} y={g.y + 4} textAnchor="end" fontSize="10" fill="#6B7280" fontFamily="var(--font-sans)">
            {formatY ? formatY(g.v) : Math.round(g.v)}
          </text>
        </g>
      ))}
      <path d={area} fill={`url(#g-${valueKey})`}/>
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
      {pts.map((p, i) => {
        const isLast = i === pts.length - 1;
        return (
          <circle key={i} cx={p.x} cy={p.y} r={isLast ? 5 : 3.5}
            fill={isLast ? '#FF4D6D' : '#fff'} stroke={isLast ? '#FF4D6D' : color} strokeWidth="2"/>
        );
      })}
      {data.map((d, i) => {
        if (data.length > 10 && i % 2 !== 0 && i !== data.length - 1) return null;
        return (
          <text key={i} x={toX(i)} y={H - 4} textAnchor="middle" fontSize="10" fill="#6B7280" fontFamily="var(--font-sans)">
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('sv-SE'));
  const [metrics, setMetrics] = useState({ sales: 0, earnings: 0, polos: 0, customers: 0, cash: 0 });
  const [prevMetrics, setPrevMetrics] = useState({ sales: 0, earnings: 0, polos: 0 });
  const [dailySales, setDailySales] = useState([]);
  const [dailyPolos, setDailyPolos] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [topProds, setTopProds] = useState([]);
  const [topSeller, setTopSeller] = useState({ name: 'Ninguno', amount: 0 });

  const calcMetrics = async () => {
    const [sales, saleItems, customers, products, register] = await Promise.all([
      DataService.getSales(),
      DataService.getSaleItems(),
      DataService.getCustomers(),
      DataService.getProducts(),
      DataService.getCashRegister()
    ]);

    const targetDate = new Date(selectedDate + 'T00:00:00');
    const dayBefore = new Date(targetDate);
    dayBefore.setDate(dayBefore.getDate() - 1);

    const filterDay = (d) => {
      const s = new Date(d); s.setHours(0,0,0,0); return s.getTime() === targetDate.getTime();
    };
    const filterYday = (d) => {
      const s = new Date(d); s.setHours(0,0,0,0); return s.getTime() === dayBefore.getTime();
    };

    const todaySales = sales.filter(s => s.status !== 'voided' && filterDay(s.created_at));
    const ydaySales = sales.filter(s => s.status !== 'voided' && filterYday(s.created_at));

    const countPolos = (salesList) => {
      let n = 0;
      salesList.forEach(s => saleItems.filter(i => i.sale_id === s.id).forEach(i => { n += i.quantity; }));
      return n;
    };

    setMetrics({
      sales: todaySales.length,
      earnings: todaySales.reduce((a, s) => a + s.total_amount, 0),
      polos: countPolos(todaySales),
      customers: customers.length,
      cash: register.status === 'open' && register.currentSession ? register.currentSession.theoretical_amount : 0
    });

    setPrevMetrics({
      sales: ydaySales.length,
      earnings: ydaySales.reduce((a, s) => a + s.total_amount, 0),
      polos: countPolos(ydaySales)
    });

    setLowStock(products.filter(p => p.stock <= 5));

    // Últimos 14 días
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (13 - i)); d.setHours(0,0,0,0);
      return { date: d, label: `${d.getDate()} ${['ene','feb','mar','abr','may','jun','jul','ago','set','oct','nov','dic'][d.getMonth()]}`, total: 0, polos: 0 };
    });
    sales.filter(s => s.status !== 'voided').forEach(s => {
      const sd = new Date(s.created_at); sd.setHours(0,0,0,0);
      const day = days.find(d => d.date.getTime() === sd.getTime());
      if (day) {
        day.total += s.total_amount;
        saleItems.filter(i => i.sale_id === s.id).forEach(i => { day.polos += i.quantity; });
      }
    });
    setDailySales(days.map(d => ({ label: d.label, total: d.total })));
    setDailyPolos(days.map(d => ({ label: d.label, polos: d.polos })));

    // Top productos
    const cnt = {};
    saleItems.forEach(i => { cnt[i.product_id] = (cnt[i.product_id] || 0) + i.quantity; });
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, qty]) => {
      const p = products.find(pr => pr.id === id);
      return { name: p ? p.name : 'Producto', qty };
    });
    setTopProds(top);

    // Colaborador estrella (el que más vende acumulado histórico)
    const sellerTotals = {};
    sales.filter(s => s.status !== 'voided').forEach(s => {
      const op = s.operator || 'Admin Principal';
      sellerTotals[op] = (sellerTotals[op] || 0) + s.total_amount;
    });
    const topSellerResult = Object.entries(sellerTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => ({ name, amount }))[0] || { name: 'Ninguno', amount: 0 };
    setTopSeller(topSellerResult);
  };

  useEffect(() => {
    calcMetrics();
    const unsub = subscribeToRealtime(() => calcMetrics());
    return () => unsub();
  }, [selectedDate]);

  const deltaLabel = (cur, prev) => {
    if (prev === 0) return null;
    const pct = Math.round(((cur - prev) / prev) * 100);
    return { pct, up: pct >= 0 };
  };

  const handleSetQuickDate = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    setSelectedDate(d.toLocaleDateString('sv-SE'));
  };

  const KPI = ({ label, value, sub, icon: Icon, delta }) => (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>{label}</span>
        <Icon size={14} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
      </div>
      <span style={{ fontSize: '26px', fontWeight: 600, letterSpacing: '-0.02em' }}>{value}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {delta && (
          <span style={{ fontSize: '10px', fontWeight: 600, color: delta.up ? '#16A34A' : '#DC2626', letterSpacing: '0.03em' }}>
            {delta.up ? '↑' : '↓'} {Math.abs(delta.pct)}% vs día anterior
          </span>
        )}
        {sub && !delta && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{sub}</span>}
      </div>
    </div>
  );

  const todayStr = new Date().toLocaleDateString('sv-SE');
  const yesterdayStr = new Date(Date.now() - 86400000).toLocaleDateString('sv-SE');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Selector de día con calendario */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => handleSetQuickDate(0)} 
            style={{
              background: 'none', border: '1px solid var(--border-color)',
              padding: '6px 16px', fontSize: '13px', fontWeight: 500,
              backgroundColor: selectedDate === todayStr ? 'var(--text-primary)' : 'transparent',
              color: selectedDate === todayStr ? '#FFF' : 'var(--text-primary)',
              cursor: 'pointer', letterSpacing: '0.02em'
            }}
          >
            Hoy
          </button>
          <button 
            onClick={() => handleSetQuickDate(1)} 
            style={{
              background: 'none', border: '1px solid var(--border-color)',
              padding: '6px 16px', fontSize: '13px', fontWeight: 500,
              backgroundColor: selectedDate === yesterdayStr ? 'var(--text-primary)' : 'transparent',
              color: selectedDate === yesterdayStr ? '#FFF' : 'var(--text-primary)',
              cursor: 'pointer', letterSpacing: '0.02em'
            }}
          >
            Ayer
          </button>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Seleccionar día:</span>
          <input 
            type="date" 
            value={selectedDate} 
            onChange={e => setSelectedDate(e.target.value)} 
            style={{
              padding: '6px 10px',
              fontSize: '13px',
              border: '1px solid var(--border-color)',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
              backgroundColor: '#FFF'
            }}
          />
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '16px' }}>
        <KPI label="Facturación" value={`S/. ${metrics.earnings.toFixed(2)}`} icon={DollarSign}
          delta={deltaLabel(metrics.earnings, prevMetrics.earnings)}
          sub="del día" />
        <KPI label="Polos vendidos" value={`${metrics.polos} uds`} icon={ShoppingBag}
          delta={deltaLabel(metrics.polos, prevMetrics.polos)}
          sub="del día" />
        <KPI label="Transacciones" value={metrics.sales} icon={TrendingUp}
          delta={deltaLabel(metrics.sales, prevMetrics.sales)}
          sub="ventas" />
        <KPI label="Caja actual" value={`S/. ${metrics.cash.toFixed(2)}`} icon={Wallet}
          sub="fondo teórico" />
        <KPI label="Clientes" value={metrics.customers} icon={Users}
          sub="registrados en total" />
        <KPI label="Cajero Estrella" value={topSeller.name} icon={Users}
          sub={`Histórico: S/. ${topSeller.amount.toFixed(2)}`} />
      </div>

      {/* Gráficos lineales */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>Facturación diaria</p>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Soles — últimos 14 días</p>
          </div>
          <LineChart data={dailySales} valueKey="total" color="var(--color-primary)" formatY={v => `S/${Math.round(v)}`} />
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>Polos vendidos</p>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Unidades — últimos 14 días</p>
          </div>
          <LineChart data={dailyPolos} valueKey="polos" color="#111111" />
        </div>
      </div>

      {/* Top productos + Stock crítico */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>Top 5 más vendidos</p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Acumulado histórico</p>
            </div>
            <Package size={14} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
          </div>
          {topProds.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '20px 0', textAlign: 'center' }}>Sin ventas aún</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {topProds.map((p, i) => {
                const pct = (p.qty / topProds[0].qty) * 100;
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px' }}>
                      <span style={{ fontWeight: 500 }}>#{i+1} {p.name}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{p.qty} uds</span>
                    </div>
                    <div style={{ height: '3px', backgroundColor: 'var(--border-color)' }}>
                      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: 'var(--text-primary)', transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Link to="/admin/reports" style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
            Ver reportes <ArrowRight size={12} />
          </Link>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>Stock crítico</p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>5 uds o menos</p>
            </div>
            <AlertTriangle size={14} strokeWidth={1.5} style={{ color: 'var(--color-secondary)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            {lowStock.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '20px 0', textAlign: 'center' }}>
                Sin quiebres de stock
              </p>
            ) : lowStock.map(p => (
              <div key={p.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)'
              }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 500 }}>{p.name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>SKU: {p.sku}</div>
                </div>
                <span style={{
                  backgroundColor: p.stock === 0 ? 'var(--color-secondary)' : '#FEF3C7',
                  color: p.stock === 0 ? '#FFF' : '#92400E',
                  fontSize: '10px', fontWeight: 700, padding: '2px 8px', letterSpacing: '0.05em'
                }}>
                  {p.stock} uds
                </span>
              </div>
            ))}
          </div>
          <Link to="/admin/inventory" style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Gestionar inventario <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}
