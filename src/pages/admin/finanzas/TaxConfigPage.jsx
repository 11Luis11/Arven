import { useEffect, useState } from 'react';
import { Building2, Globe, Coins, Users2, Save, Calendar, Sliders, ShieldCheck } from 'lucide-react';
import { DataService } from '../../../services/dataService';
import { getTaxConfig, saveTaxConfig } from '../../../utils/taxData';
import { CURRENCIES, TAXPAYER_TYPES, REGIME_LIST } from '../../../utils/taxRegimes';
import { toast } from '../../../utils/toast';
import { Badge, SectionHeader, LoadingState, Field, ChoiceCard } from './shared';

export default function TaxConfigPage() {
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    DataService.getConfig()
      .then(cfg => {
        setConfig(cfg);
        setForm(getTaxConfig(cfg));
      })
      .catch(e => {
        console.error(e);
        toast.error('No se pudo cargar la configuración.');
      });
  }, []);

  if (!form) return <LoadingState label="Cargando configuración..." />;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const rucLen = (form.ruc || '').length;

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const day = Math.min(28, Math.max(1, Math.round(Number(form.declarationDay) || 15)));
      const updated = await saveTaxConfig(config, { ...form, declarationDay: day, configured: true });
      // Mantener la config local al día evita sobrescribir con datos viejos en un segundo guardado.
      setConfig(c => ({ ...c, taxConfig: updated }));
      setForm(updated);
      toast.success('Configuración tributaria guardada');
    } catch (err) {
      console.error(err);
      toast.error('No se pudo guardar la configuración. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '820px' }}>
      <SectionHeader
        icon={Sliders}
        title="Configuración tributaria"
        subtitle="Estos datos adaptan automáticamente los indicadores, cálculos y alertas de todo el módulo de Finanzas."
        actions={form.configured ? <Badge tone="success">Configurado</Badge> : <Badge tone="warning">Pendiente</Badge>}
      />

      <form onSubmit={handleSave} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <SectionTitle>Datos de la empresa</SectionTitle>
        <FieldRow>
          <Field label="Nombre de la empresa" icon={Building2}>
            <input className="input-field" value={form.companyName} onChange={e => set('companyName', e.target.value)} placeholder="Ej. Textil Moda SAC" required />
          </Field>
          <Field label="RUC" hint={rucLen > 0 && rucLen !== 11 ? `El RUC tiene 11 dígitos (llevas ${rucLen}).` : 'Inicia en 10 (persona natural) o 20 (persona jurídica).'}>
            <input className="input-field" inputMode="numeric" value={form.ruc} onChange={e => set('ruc', e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="20123456789" required />
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
            {TAXPAYER_TYPES.map(t => (
              <ChoiceCard key={t.id} active={form.taxpayerType === t.id} onClick={() => set('taxpayerType', t.id)}>
                <div style={{ fontSize: '13.5px', fontWeight: 600 }}>{t.label}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{t.hint}</div>
              </ChoiceCard>
            ))}
          </div>
        </Field>

        <div style={{ borderTop: '1px solid var(--border-color)' }} />

        <SectionTitle>Régimen tributario</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '10px' }}>
          {REGIME_LIST.map(r => (
            <ChoiceCard key={r.id} active={form.regime === r.id} color={r.color} onClick={() => set('regime', r.id)}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 700 }}>
                <ShieldCheck size={15} color={r.color} /> {r.name}
              </span>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>{r.fullName}</p>
            </ChoiceCard>
          ))}
        </div>

        <FieldRow>
          <Field label="Fecha de inicio del régimen" icon={Calendar}>
            <input className="input-field" type="date" value={form.regimeStartDate} onChange={e => set('regimeStartDate', e.target.value)} />
          </Field>
          <Field label="Día de vencimiento mensual" icon={Calendar} hint="Referencial: según el cronograma SUNAT por último dígito del RUC.">
            <input className="input-field" type="number" min="1" max="28" value={form.declarationDay} onChange={e => set('declarationDay', e.target.value === '' ? '' : Number(e.target.value))} />
          </Field>
        </FieldRow>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
          <button type="submit" className="btn-primary" disabled={saving}>
            <Save size={15} /> {saving ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
      </form>
    </div>
  );
}

function SectionTitle({ children }) {
  return <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{children}</h3>;
}

function FieldRow({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '16px' }}>{children}</div>;
}
