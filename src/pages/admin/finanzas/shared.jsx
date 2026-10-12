import { useState } from 'react';
import { Building2, Globe, Coins, Users2, ShieldCheck, X, ChevronRight, ChevronLeft, Inbox } from 'lucide-react';
import { REGIME_LIST, CURRENCIES, TAXPAYER_TYPES, MONTH_SHORT, formatMoney, toLocalISODate } from '../../../utils/taxRegimes';
import { toast } from '../../../utils/toast';
import { CHART_COLORS, num, limitColor } from './helpers';

const TONE_COLOR = {
  default: 'var(--text-primary)',
  danger: 'var(--color-danger)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  info: 'var(--color-primary)',
};
const TONE_SOFT = {
  default: 'var(--bg-subtle)',
  danger: 'var(--color-danger-soft)',
  success: 'var(--color-success-soft)',
  warning: 'var(--color-warning-soft)',
  info: 'var(--color-primary-soft)',
};

// ------------------------------------------------------------------
// KPI CARD
// ------------------------------------------------------------------
export function KpiCard({ label, value, sub, icon: Icon, tone = 'default' }) {
  return (
    <div className="stat-card" style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <span className="stat-label">{label}</span>
        {Icon && (
          <span className="stat-icon" style={{ width: 36, height: 36, flexShrink: 0, background: TONE_SOFT[tone] || TONE_SOFT.default, color: TONE_COLOR[tone] === TONE_COLOR.default ? 'var(--text-secondary)' : TONE_COLOR[tone] }}>
            <Icon size={17} strokeWidth={1.9} />
          </span>
        )}
      </div>
      <span className="stat-value" style={{ fontSize: '22px', color: TONE_COLOR[tone] || TONE_COLOR.default, wordBreak: 'break-word' }}>{value}</span>
      {sub && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{sub}</span>}
    </div>
  );
}

export function KpiGrid({ children, min = 180 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))`, gap: '16px' }}>
      {children}
    </div>
  );
}

// ------------------------------------------------------------------
// BADGE (usa las clases .badge del sistema de diseño)
// ------------------------------------------------------------------
export function Badge({ children, tone = 'neutral' }) {
  const cls = tone === 'neutral' ? 'badge' : `badge badge-${tone}`;
  return <span className={cls}>{children}</span>;
}

// ------------------------------------------------------------------
// Encabezados, estados y utilidades de UI
// ------------------------------------------------------------------
export function SectionHeader({ title, subtitle, icon: Icon, actions }) {
  return (
    <div className="page-header" style={{ marginBottom: 0, alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        {Icon && (
          <span className="stat-icon" style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 'var(--radius)', background: 'var(--color-primary-soft)', color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={19} />
          </span>
        )}
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700 }}>{title}</h1>
          {subtitle && <p style={{ fontSize: '13.5px', marginTop: '2px' }}>{subtitle}</p>}
        </div>
      </div>
      {actions && <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>{actions}</div>}
    </div>
  );
}

export function CardTitle({ children, right }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{children}</h3>
      {right}
    </div>
  );
}

export function LoadingState({ label = 'Cargando información...' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', minHeight: '40vh', color: 'var(--text-secondary)', fontSize: '13px' }}>
      <div className="spinner" />
      {label}
    </div>
  );
}

export function EmptyRow({ colSpan, title, text, icon: Icon = Inbox }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: 0 }}>
        <div className="empty-state">
          <Icon size={28} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
          <h3>{title}</h3>
          {text && <p style={{ fontSize: '13px', maxWidth: '380px' }}>{text}</p>}
        </div>
      </td>
    </tr>
  );
}

// Selector de periodo (mes opcional + año) reutilizado por las pestañas.
export function PeriodPicker({ month, onMonth, year, onYear }) {
  const current = new Date().getFullYear();
  const years = [];
  for (let y = current + 1; y >= current - 6; y--) years.push(y);
  if (!years.includes(year)) years.push(year);
  return (
    <>
      {onMonth && (
        <select className="input-field" aria-label="Mes" style={{ width: 'auto', minWidth: '96px' }} value={month} onChange={e => onMonth(Number(e.target.value))}>
          {MONTH_SHORT.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
      )}
      <select className="input-field" aria-label="Año" style={{ width: 'auto', minWidth: '96px' }} value={year} onChange={e => onYear(Number(e.target.value))}>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </>
  );
}

export function SaleStatusBadge({ sale }) {
  if (sale.status === 'voided') return <Badge tone="danger">Anulado</Badge>;
  if (sale.status === 'exchanged') return <Badge tone="info">Con cambio</Badge>;
  return <Badge tone="success">Aceptado</Badge>;
}

// ------------------------------------------------------------------
// GRUPO BARRAS: Ventas vs Compras (SVG)
// ------------------------------------------------------------------
function compact(v) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10_000 ? 0 : 1)}K`;
  return String(Math.round(v));
}

export function VentasComprasChart({ data, currency }) {
  const W = 720, H = 230, PL = 44, PR = 8, PT = 12, PB = 26;
  const cW = W - PL - PR, cH = H - PT - PB;
  const maxV = Math.max(...data.map(d => Math.max(d.ventas, d.compras)), 1);
  const groupW = cW / data.length;
  const barW = Math.min(14, groupW * 0.3);
  const toH = v => (v / maxV) * cH;
  const gridVals = [0, 0.25, 0.5, 0.75, 1].map(f => ({ y: PT + cH - f * cH, v: f * maxV }));
  const baseY = PT + cH;

  // Barra con extremo superior redondeado (4px) anclada a la línea base.
  const bar = (x, h) => {
    if (h <= 0) return null;
    const r = Math.min(4, h, barW / 2);
    const y = baseY - h;
    return `M${x},${baseY} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${baseY} Z`;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ventas vs compras por mes" style={{ width: '100%', height: 'auto', display: 'block' }}>
      {gridVals.map((g, i) => (
        <g key={i}>
          <line x1={PL} y1={g.y} x2={W - PR} y2={g.y} style={{ stroke: 'var(--border-color)' }} strokeWidth="1" strokeDasharray={i === 0 ? undefined : '3 4'} />
          <text x={PL - 8} y={g.y + 3} textAnchor="end" fontSize="10" style={{ fill: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{compact(g.v)}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const cx = PL + i * groupW + groupW / 2;
        const pV = bar(cx - barW - 1, toH(d.ventas));
        const pC = bar(cx + 1, toH(d.compras));
        return (
          <g key={d.label}>
            <title>{`${d.label} · Ventas ${formatMoney(d.ventas, currency)} · Compras ${formatMoney(d.compras, currency)}`}</title>
            <rect x={PL + i * groupW} y={PT} width={groupW} height={cH} fill="transparent" className="fin-chart-hit" />
            {pV && <path d={pV} style={{ fill: CHART_COLORS.ventas }} />}
            {pC && <path d={pC} style={{ fill: CHART_COLORS.compras }} />}
            <text x={cx} y={H - 8} textAnchor="middle" fontSize="10.5" style={{ fill: 'var(--text-secondary)' }}>{d.label}</text>
          </g>
        );
      })}
      <style>{`.fin-chart-hit:hover { fill: var(--bg-hover); }`}</style>
    </svg>
  );
}

export function ChartLegend({ items }) {
  return (
    <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
      {items.map(it => (
        <span key={it.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <i style={{ width: 10, height: 10, borderRadius: 3, background: it.color, display: 'inline-block' }} />{it.label}
        </span>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------
// DONUT: Distribución de comprobantes
// ------------------------------------------------------------------
export function DonutChart({ segments, centerLabel = 'Total', centerValue, currency }) {
  const sum = segments.reduce((a, s) => a + s.value, 0);
  const total = sum || 1;
  const R = 70, CX = 90, CY = 90, STROKE = 22;
  const circumference = 2 * Math.PI * R;
  const GAP = 2; // separación de 2px entre segmentos

  // Offsets acumulados precalculados (cálculo puro, sin reasignar variables durante el render).
  const visible = segments.filter(s => s.value > 0);
  const arcs = visible.reduce((acc, s) => {
    const start = acc.length ? acc[acc.length - 1].end : 0;
    const len = (s.value / total) * circumference;
    acc.push({ ...s, start, len, end: start + len });
    return acc;
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
      <svg viewBox="0 0 180 180" role="img" aria-label="Distribución de comprobantes" style={{ width: '150px', height: '150px', flexShrink: 0 }}>
        <circle cx={CX} cy={CY} r={R} fill="none" style={{ stroke: 'var(--bg-subtle)' }} strokeWidth={STROKE} />
        {arcs.map(a => {
          const dash = arcs.length > 1 ? Math.max(0, a.len - GAP) : a.len;
          return (
            <circle
              key={a.label}
              cx={CX} cy={CY} r={R} fill="none" style={{ stroke: a.color }} strokeWidth={STROKE}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-a.start}
              transform={`rotate(-90 ${CX} ${CY})`}
            >
              <title>{`${a.label}: ${formatMoney(a.value, currency)} (${Math.round((a.value / total) * 100)}%)`}</title>
            </circle>
          );
        })}
        <text x={CX} y={CY - 6} textAnchor="middle" fontSize="11" style={{ fill: 'var(--text-secondary)' }}>{centerLabel}</text>
        <text x={CX} y={CY + 13} textAnchor="middle" fontSize="14" fontWeight="700" style={{ fill: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{centerValue}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minWidth: '170px' }}>
        {segments.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1, color: 'var(--text-primary)' }}>{s.label}</span>
            <span style={{ ...num, color: 'var(--text-secondary)', fontWeight: 600 }}>
              {formatMoney(s.value, currency)} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({sum ? Math.round((s.value / total) * 100) : 0}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// GAUGE semicircular (control de límite de régimen)
// ------------------------------------------------------------------
export function LimitGauge({ pct }) {
  const clamped = Math.min(100, Math.max(0, Number(pct) || 0));
  const R = 80, CX = 100, CY = 100, STROKE = 14;
  const circumference = Math.PI * R; // media circunferencia
  const dash = (clamped / 100) * circumference;
  const arc = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;
  return (
    <svg viewBox="0 0 200 110" role="img" aria-label={`${clamped.toFixed(1)}% del límite anual`} style={{ width: '220px', maxWidth: '100%', height: 'auto' }}>
      <path d={arc} fill="none" style={{ stroke: 'var(--bg-subtle)' }} strokeWidth={STROKE} strokeLinecap="round" />
      {clamped > 0 && (
        <path d={arc} fill="none" style={{ stroke: limitColor(clamped), transition: 'stroke-dasharray 0.6s ease' }} strokeWidth={STROKE} strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`} />
      )}
    </svg>
  );
}

// Tarjeta seleccionable (tipo de contribuyente / régimen)
export function ChoiceCard({ active, color = 'var(--color-primary)', onClick, children, style }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      style={{
        textAlign: 'left', padding: '14px', borderRadius: 'var(--radius)', cursor: 'pointer', width: '100%',
        border: active ? `2px solid ${color}` : '1px solid var(--border-color)',
        background: active ? 'var(--color-primary-soft)' : 'var(--bg-card)',
        boxShadow: active ? 'var(--shadow-sm)' : 'none',
        transition: 'border-color .15s ease, background .15s ease',
        ...style,
      }}>
      {children}
    </button>
  );
}

// ------------------------------------------------------------------
// MODAL DE CONFIGURACIÓN INICIAL (Onboarding tributario)
// ------------------------------------------------------------------
export function TaxSetupModal({ initial, onSave, onClose }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    companyName: initial.companyName || '',
    country: initial.country || 'Perú',
    currency: initial.currency || 'PEN',
    taxpayerType: initial.taxpayerType || 'juridica',
    ruc: initial.ruc || '',
    regime: initial.regime || 'RMT',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const canContinue = step === 0
    ? form.companyName.trim().length > 1 && form.ruc.trim().length >= 8
    : true;

  const handleFinish = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave({ ...form, configured: true, regimeStartDate: toLocalISODate() });
      toast.success('Configuración tributaria guardada');
    } catch (e) {
      console.error(e);
      toast.error('No se pudo guardar la configuración. Inténtalo de nuevo.');
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => onClose && !saving && onClose()}>
      <div className="modal" style={{ padding: 0 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '22px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)' }}>Configuración inicial · Paso {step + 1} de 2</p>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px' }}>
              {step === 0 ? 'Datos de tu empresa' : 'Selecciona tu régimen tributario'}
            </h2>
          </div>
          {onClose && (
            <button type="button" className="btn-ghost btn-icon" onClick={onClose} aria-label="Cerrar" disabled={saving}>
              <X size={18} />
            </button>
          )}
        </div>

        <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {step === 0 ? (
            <>
              <Field label="Nombre de la empresa" icon={Building2}>
                <input className="input-field" value={form.companyName} onChange={e => set('companyName', e.target.value)} placeholder="Ej. Textil Moda SAC" autoFocus />
              </Field>
              <Field label="RUC" hint="11 dígitos. Inicia en 10 (persona natural) o 20 (persona jurídica).">
                <input className="input-field" inputMode="numeric" value={form.ruc} onChange={e => set('ruc', e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="20123456789" />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                <Field label="País" icon={Globe}>
                  <input className="input-field" value={form.country} onChange={e => set('country', e.target.value)} />
                </Field>
                <Field label="Moneda" icon={Coins}>
                  <select className="input-field" value={form.currency} onChange={e => set('currency', e.target.value)}>
                    {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.name} ({c.symbol})</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Tipo de contribuyente" icon={Users2}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                  {TAXPAYER_TYPES.map(t => (
                    <ChoiceCard key={t.id} active={form.taxpayerType === t.id} onClick={() => set('taxpayerType', t.id)}>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{t.label}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{t.hint}</div>
                    </ChoiceCard>
                  ))}
                </div>
              </Field>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {REGIME_LIST.map(r => (
                <ChoiceCard key={r.id} active={form.regime === r.id} color={r.color} onClick={() => set('regime', r.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={16} color={r.color} />
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>{r.fullName}</span>
                  </div>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.5 }}>{r.description}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    Límite de ingresos anuales: <strong style={{ color: 'var(--text-primary)' }}>{r.annualLimit === Infinity ? 'Sin límite' : formatMoney(r.annualLimit, form.currency)}</strong>
                  </p>
                </ChoiceCard>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" className="btn-ghost" disabled={saving}
            onClick={() => step === 0 ? onClose && onClose() : setStep(0)}>
            <ChevronLeft size={15} /> {step === 0 ? 'Más tarde' : 'Atrás'}
          </button>
          <button type="button" className="btn-primary" disabled={!canContinue || saving}
            onClick={() => step === 0 ? setStep(1) : handleFinish()}>
            {step === 0 ? 'Continuar' : saving ? 'Guardando...' : 'Finalizar configuración'} <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Field({ label, icon: Icon, hint, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {Icon && <Icon size={14} style={{ color: 'var(--text-secondary)' }} />} {label}
      </label>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
