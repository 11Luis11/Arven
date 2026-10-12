import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Receipt, FileText, ShieldCheck, AlertTriangle, ArrowRight, Percent, Settings2,
  CheckCircle2, Info, CalendarClock, Landmark, TrendingUp, TrendingDown,
} from 'lucide-react';
import { DataService, subscribeToRealtime } from '../../../services/dataService';
import {
  getTaxConfig, saveTaxConfig, getPurchases, subscribeToPurchases, filterByMonth, sumSales, sumPurchases,
  sumPurchasesIGV, yearToDateIncome, monthlySeries, documentDistribution, isActiveSale, toNum,
} from '../../../utils/taxData';
import {
  getRegime, splitIGV, formatMoney, formatDate, monthRangeLabel, estimateRentaPayment, estimateRusFee,
  nextDueDate, daysUntil, MONTH_NAMES, TAX_REGIMES,
} from '../../../utils/taxRegimes';
import { toast } from '../../../utils/toast';
import {
  KpiCard, KpiGrid, Badge, CardTitle, SectionHeader, LoadingState, EmptyRow, SaleStatusBadge,
  VentasComprasChart, ChartLegend, DonutChart, LimitGauge, TaxSetupModal,
} from './shared';
import { CHART_COLORS, docLabel, docTone, limitColor, num, numRight } from './helpers';

const ALERT_ICON = { success: CheckCircle2, warning: AlertTriangle, info: Info, danger: AlertTriangle };

export default function TaxDashboard() {
  const [config, setConfig] = useState(null);
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [setupDismissed, setSetupDismissed] = useState(false);
  const [{ month, year }] = useState(() => {
    const now = new Date();
    return { month: now.getMonth(), year: now.getFullYear() };
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [cfg, s] = await Promise.all([DataService.getConfig(), DataService.getSales()]);
        setConfig(cfg);
        setSales((s || []).filter(isActiveSale));
        setPurchases(getPurchases());
      } catch (e) {
        console.error(e);
        toast.error('No se pudo cargar la información tributaria.');
      }
    };
    load();
    const unsub = subscribeToRealtime(() => load());
    const unsubPur = subscribeToPurchases(() => setPurchases(getPurchases()));
    return () => { unsub(); unsubPur(); };
  }, []);

  if (!config) return <LoadingState label="Cargando dashboard tributario..." />;

  const taxConfig = getTaxConfig(config);
  const regime = getRegime(taxConfig.regime);
  // Se muestra automáticamente mientras no se haya configurado; "Más tarde" lo oculta
  // (antes se reabría con cada actualización en tiempo real).
  const showSetup = !taxConfig.configured && !setupDismissed;
  const currency = taxConfig.currency;

  const monthSales = filterByMonth(sales, 'created_at', month, year);
  const monthPurchases = filterByMonth(purchases, 'date', month, year);
  const prevMonthDate = new Date(year, month - 1, 1);
  const prevSales = filterByMonth(sales, 'created_at', prevMonthDate.getMonth(), prevMonthDate.getFullYear());
  const prevPurchases = filterByMonth(purchases, 'date', prevMonthDate.getMonth(), prevMonthDate.getFullYear());

  const salesTotal = sumSales(monthSales);
  const purchasesTotal = sumPurchases(monthPurchases);
  const prevSalesTotal = sumSales(prevSales);
  const prevPurchasesTotal = sumPurchases(prevPurchases);

  const { base: salesBase, igv: igvVentas } = splitIGV(salesTotal);
  const igvCompras = sumPurchasesIGV(monthPurchases);
  // El Nuevo RUS no paga IGV: solo cuota fija.
  const igvAPagar = regime.hasIGV ? Math.max(0, igvVentas - igvCompras) : 0;

  const pctChange = (cur, prev) => prev === 0 ? null : Math.round(((cur - prev) / prev) * 100);
  const salesDelta = pctChange(salesTotal, prevSalesTotal);
  const purchasesDelta = pctChange(purchasesTotal, prevPurchasesTotal);
  const deltaText = (d) => d === null ? 'Sin datos del mes anterior' : `${d >= 0 ? '↑' : '↓'} ${Math.abs(d)}% vs mes anterior`;

  const hasLimit = regime.annualLimit !== Infinity;
  const ytdIncome = yearToDateIncome(sales, year);
  const limitPct = hasLimit ? Math.min(100, (ytdIncome / regime.annualLimit) * 100) : 0;
  const remaining = hasLimit ? Math.max(0, regime.annualLimit - ytdIncome) : Infinity;

  const series = monthlySeries(sales, purchases, year);
  const dist = documentDistribution(monthSales);

  const rentaEstimate = regime.hasRenta ? estimateRentaPayment(regime.id, salesBase) : 0;
  const rusFee = !regime.hasIGV ? estimateRusFee(salesTotal) : 0;
  const rusCats = TAX_REGIMES.RUS.categories;
  const rusMax = rusCats[rusCats.length - 1].maxMonthly;
  const rusCat = (rusCats.find(c => salesTotal <= c.maxMonthly) || rusCats[rusCats.length - 1]).id;

  const due = nextDueDate(taxConfig.declarationDay || 15);
  const dueDays = daysUntil(due);

  const recentDocs = [...sales]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 6);

  const alerts = [];
  if (hasLimit && limitPct >= 80) {
    alerts.push({ tone: limitPct >= 95 ? 'danger' : 'warning', text: `Estás cerca del límite de tu régimen (${limitPct.toFixed(1)}% del límite anual).` });
  }
  if (dueDays <= 7 && dueDays >= 0) {
    alerts.push({ tone: 'warning', text: `Tu próxima declaración vence en ${dueDays} día${dueDays === 1 ? '' : 's'}.` });
  }
  if (igvAPagar > 0) {
    alerts.push({ tone: 'info', text: `Tienes ${formatMoney(igvAPagar, currency)} de IGV por pagar este periodo.` });
  }
  if (!regime.hasIGV) {
    alerts.push(salesTotal > rusMax
      ? { tone: 'danger', text: `Tus ventas del mes superan ${formatMoney(rusMax, currency)}, el máximo de la categoría más alta del Nuevo RUS. Consulta con tu contador un cambio de régimen.` }
      : { tone: 'info', text: 'Con el Nuevo RUS solo puedes emitir boletas de venta; recuerda no superar el límite mensual de tu categoría.' });
  }
  if (alerts.length === 0) {
    alerts.push({ tone: 'success', text: 'Todo en orden. No hay alertas tributarias pendientes.' });
  }

  const period = `${MONTH_NAMES[month]} ${year}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <SectionHeader
        title="Dashboard Tributario"
        subtitle={`${taxConfig.companyName || config.storeName || 'Mi empresa'} · RUC ${taxConfig.ruc || '—'} · ${monthRangeLabel(month, year)}`}
        actions={<>
          <Badge tone="success"><ShieldCheck size={12} /> {regime.name} · Activo</Badge>
          <Link to="/admin/finanzas/configuracion" className="btn-secondary btn-sm"><Settings2 size={14} /> Configurar</Link>
        </>}
      />

      {!taxConfig.configured && setupDismissed && (
        <div className="alert alert-info" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Info size={16} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: '200px' }}>Aún no configuras tus datos tributarios. Los cálculos usan el régimen {regime.name} por defecto.</span>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setSetupDismissed(false)}>Configurar ahora</button>
        </div>
      )}

      {/* KPIs — se adaptan según el régimen */}
      <KpiGrid>
        <KpiCard label="Ventas del mes" value={formatMoney(salesTotal, currency)} icon={salesDelta !== null && salesDelta < 0 ? TrendingDown : TrendingUp} sub={deltaText(salesDelta)} />
        <KpiCard label="Compras del mes" value={formatMoney(purchasesTotal, currency)} icon={FileText} sub={deltaText(purchasesDelta)} />
        {regime.hasIGV ? (
          <>
            <KpiCard label="IGV ventas" value={formatMoney(igvVentas, currency)} icon={Percent} tone="info" sub="IGV cobrado (18%)" />
            <KpiCard label="Crédito fiscal" value={formatMoney(igvCompras, currency)} icon={ShieldCheck} tone="info" sub="IGV de compras" />
            <KpiCard label="IGV a pagar" value={formatMoney(igvAPagar, currency)} icon={AlertTriangle} tone={igvAPagar > 0 ? 'danger' : 'success'} sub="IGV ventas − crédito fiscal" />
          </>
        ) : (
          <>
            <KpiCard label="Categoría RUS" value={`Cat. ${rusCat}`} icon={ShieldCheck} tone={salesTotal > rusMax ? 'danger' : 'info'} sub={salesTotal > rusMax ? 'Supera el máximo del RUS' : 'Según ingresos del mes'} />
            <KpiCard label="Cuota fija a pagar" value={formatMoney(rusFee, currency)} icon={Percent} tone="warning" sub="Pago único mensual RUS" />
          </>
        )}
        {regime.hasRenta && (
          <KpiCard label="Pago a cuenta renta" value={formatMoney(rentaEstimate, currency)} icon={Landmark} sub={`Estimado (${(regime.rentaRate * 100).toFixed(1)}% de la base)`} />
        )}
      </KpiGrid>

      {/* Régimen tributario + Ventas vs Compras */}
      <div className="finanzas-grid-2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.5fr)', gap: '16px' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <CardTitle right={<Badge tone="success">Activo</Badge>}>Régimen tributario</CardTitle>
          <div>
            <p style={{ fontSize: '16px', fontWeight: 700 }}>{regime.fullName}</p>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.55 }}>{regime.description}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <Row label="Fecha de inicio" value={formatDate(taxConfig.regimeStartDate)} />
            <Row label="Límite de ingresos anuales" value={hasLimit ? formatMoney(regime.annualLimit, currency) : 'Sin límite'} />
            <Row label={`Ingresos acumulados ${year}`} value={formatMoney(ytdIncome, currency)} />
          </div>
          {hasLimit && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Porcentaje alcanzado</span>
                <span style={{ ...num, fontWeight: 700 }}>{limitPct.toFixed(2)}%</span>
              </div>
              <div style={{ height: '8px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${limitPct}%`, background: limitColor(limitPct), borderRadius: 'var(--radius-pill)', transition: 'width 0.6s ease' }} />
              </div>
              <p className={`alert ${limitPct >= 80 ? 'alert-warning' : 'alert-info'}`} style={{ marginTop: '12px', fontSize: '12.5px' }}>
                Te quedan {formatMoney(remaining, currency)} para llegar al límite de tu régimen. Si lo superas, deberás cambiar de régimen tributario.
              </p>
            </div>
          )}
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
          <CardTitle right={<ChartLegend items={[{ label: 'Ventas', color: CHART_COLORS.ventas }, { label: 'Compras', color: CHART_COLORS.compras }]} />}>
            Ventas vs compras · {year}
          </CardTitle>
          <VentasComprasChart data={series} currency={currency} />
        </div>
      </div>

      {/* Distribución + Resumen impuestos + Próximas obligaciones */}
      <div className="finanzas-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <CardTitle>Comprobantes del mes</CardTitle>
          <DonutChart
            currency={currency}
            centerValue={formatMoney(salesTotal, currency)}
            segments={[
              { label: 'Facturas', value: dist.Factura, color: CHART_COLORS.factura },
              { label: 'Boletas / tickets', value: dist.Boleta, color: CHART_COLORS.boleta },
              { label: 'Notas de crédito', value: dist['Nota de crédito'], color: CHART_COLORS.notaCredito },
              { label: 'Notas de débito', value: dist['Nota de débito'], color: CHART_COLORS.notaDebito },
            ]}
          />
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <CardTitle>Resumen de impuestos · {period}</CardTitle>
          {regime.hasIGV && (
            <>
              <TaxRow label="IGV ventas (cobrado)" value={formatMoney(igvVentas, currency)} />
              <TaxRow label="IGV compras (crédito fiscal)" value={formatMoney(igvCompras, currency)} />
              <TaxRow label="IGV a pagar" value={formatMoney(igvAPagar, currency)} tone={igvAPagar > 0 ? 'danger' : undefined} />
            </>
          )}
          {regime.hasRenta && <TaxRow label="Pago a cuenta renta" value={formatMoney(rentaEstimate, currency)} />}
          {!regime.hasIGV && <TaxRow label="Cuota fija RUS" value={formatMoney(rusFee, currency)} />}
          <div style={{ borderTop: '1px solid var(--border-color)', marginTop: 'auto', paddingTop: '12px' }}>
            <TaxRow label="Total estimado a pagar SUNAT" value={formatMoney(igvAPagar + rentaEstimate + rusFee, currency)} strong />
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <CardTitle>Próximas obligaciones</CardTitle>
          <Obligation icon={Percent} title={regime.hasIGV ? 'IGV - Renta mensual' : 'Cuota mensual Nuevo RUS'} period={period} due={due} days={dueDays} />
          {regime.hasIGV && <Obligation icon={FileText} title="Registro de Compras" period={period} due={due} days={dueDays} />}
          {regime.hasIGV && <Obligation icon={Receipt} title="Registro de Ventas" period={period} due={due} days={dueDays} />}
          <Link to="/admin/finanzas/declaraciones" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: 'auto' }}>
            Ver todas las obligaciones <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* Comprobantes recientes */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '20px' }}>
        <CardTitle right={
          <Link to="/admin/finanzas/ventas" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            Ver todos <ArrowRight size={14} />
          </Link>
        }>Comprobantes recientes</CardTitle>
        <div className="table-wrap">
          <table className="data-table" style={{ minWidth: '640px' }}>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Serie - Número</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {recentDocs.length === 0 ? (
                <EmptyRow colSpan={6} icon={Receipt} title="Sin comprobantes aún" text="Las ventas emitidas desde el POS y la tienda aparecerán aquí automáticamente." />
              ) : recentDocs.map(s => (
                <tr key={s.id}>
                  <td><Badge tone={docTone(s.document_type)}>{docLabel(s.document_type)}</Badge></td>
                  <td style={{ ...num, fontWeight: 500 }}>{s.invoice_number || '—'}</td>
                  <td>{s.customer_name || 'Cliente varios'}</td>
                  <td style={num}>{formatDate(s.created_at)}</td>
                  <td style={{ ...numRight, fontWeight: 600 }}>{formatMoney(toNum(s.total_amount), currency)}</td>
                  <td><SaleStatusBadge sale={s} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Control de límites + Alertas */}
      <div className="finanzas-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ alignSelf: 'stretch' }}><CardTitle>Control de límites · {regime.name}</CardTitle></div>
          {!hasLimit ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <CheckCircle2 size={28} style={{ color: 'var(--color-success)' }} />
              <p style={{ fontSize: '13px' }}>Este régimen no tiene límite de ingresos anuales.</p>
            </div>
          ) : (
            <>
              <LimitGauge pct={limitPct} />
              <div style={{ textAlign: 'center', marginTop: '-18px' }}>
                <p style={{ ...num, fontSize: '22px', fontWeight: 700 }}>{formatMoney(ytdIncome, currency)}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Ingresos acumulados · {limitPct.toFixed(1)}%</p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '12px', color: 'var(--text-secondary)', gap: '12px' }}>
                <span><span style={num}>{formatMoney(0, currency)}</span><br />Inicio del año</span>
                <span style={{ textAlign: 'right' }}><span style={num}>{formatMoney(regime.annualLimit, currency)}</span><br />Límite anual</span>
              </div>
              <div className={`alert ${limitPct >= 80 ? 'alert-warning' : 'alert-success'}`} style={{ width: '100%', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '2px' }}>
                <strong style={{ ...num, fontSize: '15px' }}>{formatMoney(remaining, currency)}</strong>
                <span style={{ fontSize: '12px' }}>Disponible antes de alcanzar el límite</span>
              </div>
            </>
          )}
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <CardTitle>Alertas</CardTitle>
          {alerts.map(a => {
            const Icon = ALERT_ICON[a.tone] || Info;
            return (
              <div key={a.text} className={`alert alert-${a.tone}`}>
                <Icon size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span style={{ lineHeight: 1.45 }}>{a.text}</span>
              </div>
            );
          })}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: 'auto', paddingTop: '4px' }}>
            <CalendarClock size={14} /> Próximo vencimiento referencial: {due.toLocaleDateString('es-PE')}
          </div>
        </div>
      </div>

      {showSetup && (
        <TaxSetupModal
          initial={taxConfig}
          onClose={() => setSetupDismissed(true)}
          onSave={async (patch) => {
            const updated = await saveTaxConfig(config, patch);
            setConfig(c => ({ ...c, taxConfig: updated }));
          }}
        />
      )}

      <style>{`
        @media (max-width: 900px) {
          .finanzas-grid-2, .finanzas-grid-3 { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ ...num, fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function TaxRow({ label, value, strong, tone }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: strong ? '14px' : '13px' }}>
      <span style={{ color: strong ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: strong ? 600 : 400 }}>{label}</span>
      <span style={{ ...num, fontWeight: strong ? 700 : 600, color: tone === 'danger' ? 'var(--color-danger)' : 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

function Obligation({ icon: Icon, title, period, due, days }) {
  const urgent = days <= 7;
  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
      <span style={{ width: '34px', height: '34px', borderRadius: 'var(--radius)', background: urgent ? 'var(--color-danger-soft)' : 'var(--bg-subtle)', color: urgent ? 'var(--color-danger)' : 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '13px', fontWeight: 600 }}>{title}</p>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Periodo: {period}</p>
      </div>
      <div style={{ textAlign: 'right' }}>
        <p style={{ ...num, fontSize: '12.5px', fontWeight: 600, color: urgent ? 'var(--color-danger)' : 'var(--text-primary)' }}>{due.toLocaleDateString('es-PE')}</p>
        <p style={{ fontSize: '11.5px', color: urgent ? 'var(--color-danger)' : 'var(--text-secondary)' }}>{days >= 0 ? `en ${days} día${days === 1 ? '' : 's'}` : 'vencido'}</p>
      </div>
    </div>
  );
}
