import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Receipt, FileText, ArrowUpRight, ArrowDownRight, ShieldCheck, AlertTriangle,
  Calendar, ArrowRight, Eye, Download, MoreVertical, Percent, Settings2
} from 'lucide-react';
import { DataService, subscribeToRealtime } from '../../../services/dataService';
import { getTaxConfig, getPurchases, subscribeToPurchases, filterByMonth, sumSales, sumPurchases, yearToDateIncome, monthlySeries, documentDistribution } from '../../../utils/taxData';
import { getRegime, splitIGV, formatMoney, monthRangeLabel, estimateRusFee, nextDueDate, daysUntil } from '../../../utils/taxRegimes';
import { KpiCard, Badge, VentasComprasChart, DonutChart, LimitGauge, TaxSetupModal } from './shared';

export default function TaxDashboard() {
  const [config, setConfig] = useState(null);
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [showSetup, setShowSetup] = useState(false);

  const now = new Date();
  const [month] = useState(now.getMonth());
  const [year] = useState(now.getFullYear());

  const load = async () => {
    const [cfg, s] = await Promise.all([DataService.getConfig(), DataService.getSales()]);
    setConfig(cfg);
    setSales(s.filter(x => x.status !== 'voided'));
    setPurchases(getPurchases());
  };

  useEffect(() => {
    load();
    const unsub = subscribeToRealtime(() => load());
    const unsubPur = subscribeToPurchases(() => setPurchases(getPurchases()));
    return () => { unsub(); unsubPur(); };
  }, []);

  const taxConfig = useMemo(() => config ? getTaxConfig(config) : null, [config]);
  const regime = useMemo(() => taxConfig ? getRegime(taxConfig.regime) : null, [taxConfig]);

  useEffect(() => {
    if (taxConfig && !taxConfig.configured) setShowSetup(true);
  }, [taxConfig]);

  if (!config || !taxConfig || !regime) return null;

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

  const igvVentas = splitIGV(salesTotal).igv;
  const igvCompras = purchases.length ? monthPurchases.reduce((a, p) => a + p.igv, 0) : splitIGV(purchasesTotal).igv;
  const igvAPagar = Math.max(0, igvVentas - igvCompras);

  const pctChange = (cur, prev) => prev === 0 ? null : Math.round(((cur - prev) / prev) * 100);
  const salesDelta = pctChange(salesTotal, prevSalesTotal);
  const purchasesDelta = pctChange(purchasesTotal, prevPurchasesTotal);

  const ytdIncome = yearToDateIncome(sales, year);
  const limitPct = regime.annualLimit === Infinity ? 0 : Math.min(100, (ytdIncome / regime.annualLimit) * 100);
  const remaining = regime.annualLimit === Infinity ? Infinity : Math.max(0, regime.annualLimit - ytdIncome);

  const series = monthlySeries(sales, purchases, year);
  const dist = documentDistribution(monthSales);

  const rentaEstimate = regime.hasRenta ? splitIGV(salesTotal).base * (regime.rentaType === 'fixed' ? regime.rentaRate : (regime.rentaRate || 0.015)) : 0;
  const rusFee = !regime.hasIGV ? estimateRusFee(salesTotal) : 0;

  const due = nextDueDate(taxConfig.declarationDay || 15);
  const dueDays = daysUntil(due);

  const recentDocs = [...sales]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 6);

  const alerts = [];
  if (regime.annualLimit !== Infinity && limitPct >= 80) {
    alerts.push({ tone: 'warning', text: `Estás cerca del límite de tu régimen (${limitPct.toFixed(1)}% del límite anual).` });
  }
  if (dueDays <= 7 && dueDays >= 0) {
    alerts.push({ tone: 'warning', text: `Tu próxima declaración vence en ${dueDays} día${dueDays === 1 ? '' : 's'}.` });
  }
  if (igvAPagar > 0 && regime.hasIGV) {
    alerts.push({ tone: 'info', text: `Tienes ${formatMoney(igvAPagar, currency)} de IGV por pagar este periodo.` });
  }
  if (!regime.hasIGV) {
    alerts.push({ tone: 'info', text: `Con el Nuevo RUS solo puedes emitir boletas de venta; recuerda no superar el límite mensual de tu categoría.` });
  }
  if (alerts.length === 0) {
    alerts.push({ tone: 'success', text: 'Todo en orden. No hay alertas tributarias pendientes.' });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Cabecera de periodo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Dashboard Tributario</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {taxConfig.companyName || config.storeName} · RUC {taxConfig.ruc || '—'} · {monthRangeLabel(month, year)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Badge tone="success">Régimen {regime.name} · ACTIVO</Badge>
          <Link to="/admin/finanzas/configuracion" style={{
            display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600,
            border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '8px', color: 'var(--text-primary)'
          }}>
            <Settings2 size={13} /> Configurar
          </Link>
        </div>
      </div>

      {/* KPIs — se adaptan según el régimen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        <KpiCard label="Ventas del mes" value={formatMoney(salesTotal, currency)} icon={Receipt}
          sub={salesDelta !== null ? `${salesDelta >= 0 ? '↑' : '↓'} ${Math.abs(salesDelta)}% vs mes anterior` : 'Incluye facturas y boletas'} />
        <KpiCard label="Compras del mes" value={formatMoney(purchasesTotal, currency)} icon={FileText}
          sub={purchasesDelta !== null ? `${purchasesDelta >= 0 ? '↑' : '↓'} ${Math.abs(purchasesDelta)}% vs mes anterior` : 'Incluye facturas y boletas'} />
        {regime.hasIGV ? (
          <>
            <KpiCard label="IGV Ventas" value={formatMoney(igvVentas, currency)} icon={Percent} tone="info" sub="IGV cobrado" />
            <KpiCard label="Crédito Fiscal" value={formatMoney(igvCompras, currency)} icon={ShieldCheck} tone="info" sub="IGV de compras" />
            <KpiCard label="IGV a Pagar" value={formatMoney(igvAPagar, currency)} icon={AlertTriangle} tone={igvAPagar > 0 ? 'danger' : 'success'} sub="IGV Ventas - Crédito Fiscal" />
          </>
        ) : (
          <>
            <KpiCard label="Categoría RUS" value={`Cat. ${salesTotal <= 5000 ? '1' : '2'}`} icon={ShieldCheck} tone="info" sub="Según ingresos del mes" />
            <KpiCard label="Cuota fija a pagar" value={formatMoney(rusFee, currency)} icon={Percent} tone="warning" sub="Pago único mensual RUS" />
          </>
        )}
        {regime.hasRenta && (
          <KpiCard label="Pago a cuenta Renta" value={formatMoney(rentaEstimate, currency)} icon={Percent} tone="default" sub="Estimado del mes" />
        )}
      </div>

      {/* Régimen tributario + Ventas vs Compras */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '16px' }} className="finanzas-grid-2">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>Régimen Tributario</p>
            <Badge tone="success">ACTIVO</Badge>
          </div>
          <div>
            <p style={{ fontSize: '15px', fontWeight: 700 }}>{regime.fullName}</p>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.5 }}>{regime.description}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
            <Row label="Fecha de inicio" value={new Date(taxConfig.regimeStartDate).toLocaleDateString('es-PE')} />
            <Row label="Límite de ingresos anuales" value={regime.annualLimit === Infinity ? 'Sin límite' : formatMoney(regime.annualLimit, currency)} />
            <Row label="Ingresos acumulados" value={formatMoney(ytdIncome, currency)} />
          </div>
          {regime.annualLimit !== Infinity && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Porcentaje alcanzado</span>
                <span style={{ fontWeight: 700 }}>{limitPct.toFixed(2)}%</span>
              </div>
              <div style={{ height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${limitPct}%`, backgroundColor: limitPct >= 90 ? '#DC2626' : limitPct >= 70 ? '#D97706' : '#16A34A', transition: 'width 0.6s ease' }} />
              </div>
              <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '8px', padding: '10px', backgroundColor: '#FFF7ED', borderRadius: '6px' }}>
                Te quedan {formatMoney(remaining, currency)} para llegar al límite de tu régimen. Si lo superas, deberás cambiar de régimen tributario.
              </p>
            </div>
          )}
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>Ventas vs Compras</p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Año {year}</p>
            </div>
            <div style={{ display: 'flex', gap: '14px', fontSize: '11px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><i style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#16A34A', display: 'inline-block' }} />Ventas</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><i style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#3B82F6', display: 'inline-block' }} />Compras</span>
            </div>
          </div>
          <VentasComprasChart data={series} currency={currency} />
        </div>
      </div>

      {/* Distribución + Resumen impuestos + Próximas obligaciones */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }} className="finanzas-grid-3">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>Distribución de Comprobantes (Este mes)</p>
          <DonutChart
            centerValue={formatMoney(salesTotal, currency)}
            segments={[
              { label: 'Facturas', value: dist.Factura, color: '#16A34A' },
              { label: 'Boletas', value: dist.Boleta, color: '#3B82F6' },
              { label: 'Notas de crédito', value: dist['Nota de crédito'], color: '#8B5CF6' },
              { label: 'Notas de débito', value: dist['Nota de débito'], color: '#F59E0B' },
            ]}
          />
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>Resumen de Impuestos (Este mes)</p>
          <TaxRow label="IGV Ventas (Cobrado)" value={formatMoney(igvVentas, currency)} />
          <TaxRow label="IGV Compras (Crédito Fiscal)" value={formatMoney(igvCompras, currency)} />
          <TaxRow label="IGV a Pagar" value={formatMoney(igvAPagar, currency)} strong tone="danger" />
          {regime.hasRenta && <TaxRow label="Pago a cuenta Renta" value={formatMoney(rentaEstimate, currency)} />}
          {!regime.hasIGV && <TaxRow label="Cuota fija RUS" value={formatMoney(rusFee, currency)} />}
          <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '4px', paddingTop: '10px' }}>
            <TaxRow label="Total a pagar SUNAT" value={formatMoney(igvAPagar + rentaEstimate + rusFee, currency)} strong />
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>Próximas Obligaciones</p>
          <Obligation icon={Percent} title="IGV - Renta Mensual" period={monthLabelYear(month, year)} due={due} />
          <Obligation icon={FileText} title="Registro de Compras" period={monthLabelYear(month, year)} due={due} />
          <Obligation icon={FileText} title="Registro de Ventas" period={monthLabelYear(month, year)} due={due} />
          <Link to="/admin/finanzas/declaraciones" style={{ fontSize: '12px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
            Ver todas las obligaciones <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {/* Comprobantes recientes */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>Comprobantes Recientes</p>
          <Link to="/admin/finanzas/ventas" style={{ fontSize: '12px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Ver todos <ArrowRight size={12} />
          </Link>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', minWidth: '600px' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <th style={{ padding: '8px 6px' }}>Tipo</th>
              <th style={{ padding: '8px 6px' }}>Serie - Número</th>
              <th style={{ padding: '8px 6px' }}>Cliente</th>
              <th style={{ padding: '8px 6px' }}>Fecha</th>
              <th style={{ padding: '8px 6px' }}>Total</th>
              <th style={{ padding: '8px 6px' }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {recentDocs.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Sin comprobantes registrados aún.</td></tr>
            ) : recentDocs.map(s => (
              <tr key={s.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                <td style={{ padding: '10px 6px', fontWeight: 600, color: s.document_type === 'Factura' ? '#16A34A' : '#3B82F6' }}>{s.document_type}</td>
                <td style={{ padding: '10px 6px' }}>{s.invoice_number}</td>
                <td style={{ padding: '10px 6px' }}>{s.customer_name}</td>
                <td style={{ padding: '10px 6px' }}>{new Date(s.created_at).toLocaleDateString('es-PE')}</td>
                <td style={{ padding: '10px 6px', fontWeight: 600 }}>{formatMoney(s.total_amount, currency)}</td>
                <td style={{ padding: '10px 6px' }}><Badge tone="success">Aceptado</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Control de límites + Alertas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="finanzas-grid-2">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', alignSelf: 'flex-start' }}>Control de Límites - {regime.name}</p>
          {regime.annualLimit === Infinity ? (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '30px 0' }}>Este régimen no tiene límite de ingresos anuales.</p>
          ) : (
            <>
              <LimitGauge pct={limitPct} />
              <div style={{ textAlign: 'center', marginTop: '-16px' }}>
                <p style={{ fontSize: '20px', fontWeight: 700 }}>{formatMoney(ytdIncome, currency)}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Ingresos acumulados</p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '11px', color: 'var(--text-secondary)' }}>
                <span>{formatMoney(0, currency)}<br />Inicio del año</span>
                <span style={{ textAlign: 'right' }}>{formatMoney(regime.annualLimit, currency)}<br />Límite anual</span>
              </div>
              <div style={{ width: '100%', backgroundColor: '#DCFCE7', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                <p style={{ fontWeight: 700, fontSize: '14px', color: '#166534' }}>{formatMoney(remaining, currency)}</p>
                <p style={{ fontSize: '11px', color: '#166534' }}>Disponible para alcanzar el límite</p>
              </div>
            </>
          )}
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>Alertas</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {alerts.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', padding: '10px', borderRadius: '8px', backgroundColor: a.tone === 'success' ? '#F0FDF4' : a.tone === 'warning' ? '#FFFBEB' : '#EFF6FF' }}>
                <AlertTriangle size={15} style={{ color: a.tone === 'success' ? '#16A34A' : a.tone === 'warning' ? '#D97706' : '#2563EB', flexShrink: 0, marginTop: '1px' }} />
                <p style={{ fontSize: '12.5px', color: 'var(--text-primary)', lineHeight: 1.4 }}>{a.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showSetup && (
        <TaxSetupModal
          initial={taxConfig}
          onClose={() => setShowSetup(false)}
          onSave={async (patch) => {
            const { saveTaxConfig } = await import('../../../utils/taxData');
            await saveTaxConfig(config, patch);
            setShowSetup(false);
            load();
          }}
        />
      )}

      <style>{`
        @media (max-width: 900px) {
          .finanzas-grid-2, .finanzas-grid-3 { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}:</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function TaxRow({ label, value, strong, tone }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: strong ? '13.5px' : '12.5px' }}>
      <span style={{ color: strong ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: strong ? 700 : 400 }}>{label}</span>
      <span style={{ fontWeight: 700, color: tone === 'danger' ? '#DC2626' : 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

function Obligation({ icon: Icon, title, period, due }) {
  const days = daysUntil(due);
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: '#F1F1F1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={14} />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '12.5px', fontWeight: 600 }}>{title}</p>
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Periodo: {period}</p>
      </div>
      <div style={{ textAlign: 'right' }}>
        <p style={{ fontSize: '11px', color: days <= 7 ? '#DC2626' : 'var(--text-secondary)', fontWeight: 600 }}>Vence:</p>
        <p style={{ fontSize: '11.5px', fontWeight: 700, color: days <= 7 ? '#DC2626' : 'var(--text-primary)' }}>{due.toLocaleDateString('es-PE')}</p>
      </div>
    </div>
  );
}

function monthLabelYear(month, year) {
  const names = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${names[month]} ${year}`;
}
