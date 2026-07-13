import { useEffect, useState } from 'react';
import { Building2, Globe, Coins, Users2, Save, CheckCircle2, Calendar } from 'lucide-react';
import { DataService } from '../../../services/dataService';
import { getTaxConfig, saveTaxConfig } from '../../../utils/taxData';
import { CURRENCIES, TAXPAYER_TYPES, REGIME_LIST, getRegime } from '../../../utils/taxRegimes';
import { Badge } from './shared';

export default function TaxConfigPage() {
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    DataService.getConfig().then(cfg => {
      setConfig(cfg);
      setForm(getTaxConfig(cfg));
    });
  }, []);

  if (!form) return null;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    await saveTaxConfig(config, { ...form, configured: true });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '760px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Configuración Tributaria</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>Estos datos adaptan automáticamente los indicadores, cálculos y alertas de todo el módulo de Finanzas.</p>
        </div>
        {form.configured && <Badge tone="success">Configurado</Badge>}
      </div>

      <form onSubmit={handleSave} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <SectionTitle>Datos de la empresa</SectionTitle>
        <FieldRow>
          <Field label="Nombre de la empresa" icon={Building2}>
            <input className="input-field" value={form.companyName} onChange={e => set('companyName', e.target.value)} placeholder="Ej. Textil Moda SAC" required />
          </Field>
          <Field label="RUC">
            <input className="input-field" value={form.ruc} onChange={e => set('ruc', e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="20123456789" required />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="País" icon={Globe}>
            <input className="input-field" value={form.country} onChange={e => set('country', e.target.value)} />
          </Field>
          <Field label="Moneda" icon={Coins}>
            <select className="input-field" value={form.currency} onChange={e => set('currency', e.target.value)}>
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.name} ({c.symbol})</option>)}
            </select>
          </Field>
        </FieldRow>
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

        <SectionTitle>Régimen tributario</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
          {REGIME_LIST.map(r => (
            <button key={r.id} type="button" onClick={() => set('regime', r.id)}
              style={{
                textAlign: 'left', padding: '12px', borderRadius: '10px', cursor: 'pointer',
                border: form.regime === r.id ? `2px solid ${r.color}` : '1px solid var(--border-color)',
                backgroundColor: form.regime === r.id ? `${r.color}12` : '#FFF',
              }}>
              <span style={{ fontSize: '13px', fontWeight: 700 }}>{r.name}</span>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>{r.fullName}</p>
            </button>
          ))}
        </div>

        <FieldRow>
          <Field label="Fecha de inicio del régimen" icon={Calendar}>
            <input className="input-field" type="date" value={form.regimeStartDate} onChange={e => set('regimeStartDate', e.target.value)} />
          </Field>
          <Field label="Día de vencimiento mensual (referencial)" icon={Calendar}>
            <input className="input-field" type="number" min="1" max="28" value={form.declarationDay} onChange={e => set('declarationDay', Number(e.target.value))} />
          </Field>
        </FieldRow>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
          {saved && <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#16A34A', fontWeight: 600 }}><CheckCircle2 size={14} /> Configuración guardada</span>}
          <button type="submit" style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 22px', borderRadius: '8px', border: 'none',
            backgroundColor: 'var(--text-primary)', color: '#FFF', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}>
            <Save size={14} /> Guardar configuración
          </button>
        </div>
      </form>
    </div>
  );
}

function SectionTitle({ children }) {
  return <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>{children}</p>;
}

function FieldRow({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }} className="finanzas-field-row">{children}<style>{`@media (max-width: 560px){.finanzas-field-row{grid-template-columns:1fr !important;}}`}</style></div>;
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
