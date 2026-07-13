import { useState } from 'react';
import { Building2, Globe, Coins, Users2, ShieldCheck, X, ChevronRight, ChevronLeft } from 'lucide-react';
import { TAX_REGIMES, REGIME_LIST, CURRENCIES, TAXPAYER_TYPES, formatMoney } from '../../../utils/taxRegimes';

// ------------------------------------------------------------------
// KPI CARD
// ------------------------------------------------------------------
export function KpiCard({ label, value, sub, icon: Icon, tone = 'default', iconBg }) {
  const toneColors = {
    default: 'var(--text-primary)',
    danger: '#DC2626',
    success: '#16A34A',
    warning: '#D97706',
    info: 'var(--color-primary)',
  };
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {Icon && (
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: iconBg || 'rgba(26,26,255,0.08)', color: toneColors[tone] || toneColors.default, flexShrink: 0,
          }}>
            <Icon size={16} strokeWidth={1.75} />
          </div>
        )}
        <span style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', lineHeight: 1.3 }}>{label}</span>
      </div>
      <span style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', color: toneColors[tone] || toneColors.default, wordBreak: 'break-word' }}>{value}</span>
      {sub && <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{sub}</span>}
    </div>
  );
}

// ------------------------------------------------------------------
// BADGE
// ------------------------------------------------------------------
export function Badge({ children, tone = 'neutral' }) {
  const map = {
    neutral: { bg: '#F1F1F1', fg: '#444' },
    success: { bg: '#DCFCE7', fg: '#166534' },
    warning: { bg: '#FEF3C7', fg: '#92400E' },
    danger: { bg: '#FEE2E2', fg: '#991B1B' },
    info: { bg: '#E0E7FF', fg: '#3730A3' },
  };
  const c = map[tone] || map.neutral;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '3px 10px', fontSize: '11px',
      fontWeight: 700, letterSpacing: '0.03em', borderRadius: '999px', backgroundColor: c.bg, color: c.fg,
    }}>
      {children}
    </span>
  );
}

// ------------------------------------------------------------------
// GRUPO BARRAS: Ventas vs Compras (SVG)
// ------------------------------------------------------------------
export function VentasComprasChart({ data, currency }) {
  const W = 720, H = 220, PL = 50, PR = 10, PT = 10, PB = 26;
  const cW = W - PL - PR, cH = H - PT - PB;
  const maxV = Math.max(...data.map(d => Math.max(d.ventas, d.compras)), 1);
  const groupW = cW / data.length;
  const barW = Math.min(16, groupW * 0.32);
  const toY = v => PT + cH - (v / maxV) * cH;
  const gridVals = [0, 0.25, 0.5, 0.75, 1].map(f => ({ y: PT + cH - f * cH, v: f * maxV }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
      {gridVals.map((g, i) => (
        <g key={i}>
          <line x1={PL} y1={g.y} x2={W - PR} y2={g.y} stroke="#EEE" strokeWidth="1" />
          <text x={PL - 6} y={g.y + 3} textAnchor="end" fontSize="9" fill="#9CA3AF">{Math.round(g.v / 1000)}K</text>
        </g>
      ))}
      {data.map((d, i) => {
        const cx = PL + i * groupW + groupW / 2;
        return (
          <g key={i}>
            <rect x={cx - barW - 2} y={toY(d.ventas)} width={barW} height={cH - (toY(d.ventas) - PT)} rx="2" fill="#16A34A" />
            <rect x={cx + 2} y={toY(d.compras)} width={barW} height={cH - (toY(d.compras) - PT)} rx="2" fill="#3B82F6" />
            <text x={cx} y={H - 6} textAnchor="middle" fontSize="10" fill="#6B7280">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ------------------------------------------------------------------
// DONUT: Distribución de comprobantes
// ------------------------------------------------------------------
export function DonutChart({ segments, centerLabel, centerValue }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const R = 70, CX = 90, CY = 90, STROKE = 26;
  const circumference = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
      <svg viewBox="0 0 180 180" style={{ width: '160px', height: '160px', flexShrink: 0 }}>
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#F1F1F1" strokeWidth={STROKE} />
        {segments.filter(s => s.value > 0).map((s, i) => {
          const frac = s.value / total;
          const dash = frac * circumference;
          const circle = (
            <circle
              key={i}
              cx={CX} cy={CY} r={R} fill="none" stroke={s.color} strokeWidth={STROKE}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${CX} ${CY})`}
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return circle;
        })}
        <text x={CX} y={CY - 6} textAnchor="middle" fontSize="11" fill="var(--text-secondary)">Total</text>
        <text x={CX} y={CY + 12} textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--text-primary)">{centerValue}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '150px' }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '3px', backgroundColor: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1, color: 'var(--text-primary)' }}>{s.label}</span>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
              {formatMoney(s.value)} <span style={{ opacity: 0.7 }}>({total ? Math.round((s.value / total) * 100) : 0}%)</span>
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
  const clamped = Math.min(100, Math.max(0, pct));
  const R = 80, CX = 100, CY = 100, STROKE = 16;
  const circumference = Math.PI * R; // media circunferencia
  const dash = (clamped / 100) * circumference;
  const color = clamped >= 90 ? '#DC2626' : clamped >= 70 ? '#D97706' : '#16A34A';
  return (
    <svg viewBox="0 0 200 110" style={{ width: '220px', height: '120px' }}>
      <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke="#F1F1F1" strokeWidth={STROKE} strokeLinecap="round" />
      <path
        d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
        fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference - dash}`}
      />
    </svg>
  );
}

// ------------------------------------------------------------------
// MODAL DE CONFIGURACIÓN INICIAL (Onboarding tributario)
// ------------------------------------------------------------------
export function TaxSetupModal({ initial, onSave, onClose }) {
  const [step, setStep] = useState(0);
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

  const handleFinish = () => {
    onSave({ ...form, configured: true, regimeStartDate: new Date().toISOString().slice(0, 10) });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    }}>
      <div style={{
        backgroundColor: '#FFF', width: '560px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto',
        borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Configuración inicial</p>
            <h2 style={{ fontSize: '19px', fontWeight: 700, marginTop: '4px' }}>
              {step === 0 ? 'Datos de tu empresa' : 'Selecciona tu régimen tributario'}
            </h2>
          </div>
          {onClose && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <X size={20} />
            </button>
          )}
        </div>

        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {step === 0 ? (
            <>
              <Field label="Nombre de la empresa" icon={Building2}>
                <input className="input-field" value={form.companyName} onChange={e => set('companyName', e.target.value)} placeholder="Ej. Textil Moda SAC" />
              </Field>
              <Field label="RUC">
                <input className="input-field" value={form.ruc} onChange={e => set('ruc', e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="20123456789" />
              </Field>
              <Field label="País" icon={Globe}>
                <input className="input-field" value={form.country} onChange={e => set('country', e.target.value)} />
              </Field>
              <Field label="Moneda" icon={Coins}>
                <select className="input-field" value={form.currency} onChange={e => set('currency', e.target.value)}>
                  {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.name} ({c.symbol})</option>)}
                </select>
              </Field>
              <Field label="Tipo de contribuyente" icon={Users2}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {TAXPAYER_TYPES.map(t => (
                    <button key={t.id} type="button" onClick={() => set('taxpayerType', t.id)}
                      style={{
                        flex: 1, padding: '12px', borderRadius: '8px', textAlign: 'left', cursor: 'pointer',
                        border: form.taxpayerType === t.id ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                        backgroundColor: form.taxpayerType === t.id ? 'rgba(26,26,255,0.05)' : '#FFF',
                      }}>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{t.label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{t.hint}</div>
                    </button>
                  ))}
                </div>
              </Field>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {REGIME_LIST.map(r => (
                <button key={r.id} type="button" onClick={() => set('regime', r.id)}
                  style={{
                    textAlign: 'left', padding: '14px', borderRadius: '10px', cursor: 'pointer',
                    border: form.regime === r.id ? `2px solid ${r.color}` : '1px solid var(--border-color)',
                    backgroundColor: form.regime === r.id ? `${r.color}12` : '#FFF',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={15} color={r.color} />
                    <span style={{ fontSize: '13.5px', fontWeight: 700 }}>{r.fullName}</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.5 }}>{r.description}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    Límite de ingresos anuales: <strong>{r.annualLimit === Infinity ? 'Sin límite' : formatMoney(r.annualLimit, form.currency)}</strong>
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '18px 28px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
          <button
            onClick={() => step === 0 ? onClose && onClose() : setStep(0)}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' }}
          >
            <ChevronLeft size={15} /> {step === 0 ? 'Más tarde' : 'Atrás'}
          </button>
          <button
            disabled={!canContinue}
            onClick={() => step === 0 ? setStep(1) : handleFinish()}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 22px', borderRadius: '8px', border: 'none',
              backgroundColor: canContinue ? 'var(--text-primary)' : '#D1D1D1', color: '#FFF', fontSize: '13px', fontWeight: 600,
              cursor: canContinue ? 'pointer' : 'not-allowed',
            }}
          >
            {step === 0 ? 'Continuar' : 'Finalizar configuración'} <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, children }) {
  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
        {Icon && <Icon size={13} />} {label}
      </label>
      {children}
    </div>
  );
}
