import { useEffect, useState } from 'react';
import { ShieldCheck, CheckCircle2, CalendarDays, Target, TrendingUp } from 'lucide-react';
import { DataService, subscribeToRealtime } from '../../../services/dataService';
import { getTaxConfig, saveTaxConfig, yearToDateIncome, isActiveSale } from '../../../utils/taxData';
import { REGIME_LIST, getRegime, formatMoney, formatDate, toLocalISODate } from '../../../utils/taxRegimes';
import { toast } from '../../../utils/toast';
import { Badge, LimitGauge, SectionHeader, LoadingState } from './shared';
import { num } from './helpers';

export default function TaxRegime() {
  const [config, setConfig] = useState(null);
  const [sales, setSales] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [cfg, s] = await Promise.all([DataService.getConfig(), DataService.getSales()]);
        setConfig(cfg);
        setSales((s || []).filter(isActiveSale));
      } catch (e) {
        console.error(e);
        toast.error('No se pudo cargar el régimen tributario.');
      }
    };
    load();
    const unsub = subscribeToRealtime(() => load());
    return () => unsub();
  }, []);

  if (!config) return <LoadingState label="Cargando régimen..." />;
  const taxConfig = getTaxConfig(config);
  const currentRegime = getRegime(taxConfig.regime);
  const year = new Date().getFullYear();
  const ytd = yearToDateIncome(sales, year);
  const hasLimit = currentRegime.annualLimit !== Infinity;
  const limitPct = hasLimit ? Math.min(100, (ytd / currentRegime.annualLimit) * 100) : 0;

  const handleChangeRegime = async (regimeId) => {
    if (saving || regimeId === taxConfig.regime) return;
    const target = getRegime(regimeId);
    if (!window.confirm(`¿Confirmas el cambio a ${target.fullName}? Esto adaptará automáticamente los indicadores y cálculos del dashboard tributario.`)) return;
    setSaving(true);
    try {
      const updated = await saveTaxConfig(config, { regime: regimeId, regimeStartDate: toLocalISODate() });
      setConfig(c => ({ ...c, taxConfig: updated }));
      toast.success(`Régimen actualizado a ${target.name}`);
    } catch (e) {
      console.error(e);
      toast.error('No se pudo cambiar el régimen. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <SectionHeader
        icon={ShieldCheck}
        title="Régimen tributario"
        subtitle="Tu régimen determina qué impuestos aplicas, los límites de ingresos y qué comprobantes puedes emitir."
      />

      <div className="card" style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <Badge tone="success"><CheckCircle2 size={12} /> Régimen actual</Badge>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginTop: '10px' }}>{currentRegime.fullName}</h2>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6, maxWidth: '560px' }}>{currentRegime.description}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginTop: '18px' }}>
            <Stat icon={CalendarDays} label="Desde" value={formatDate(taxConfig.regimeStartDate)} />
            <Stat icon={Target} label="Límite anual" value={hasLimit ? formatMoney(currentRegime.annualLimit, taxConfig.currency) : 'Sin límite'} />
            <Stat icon={TrendingUp} label={`Acumulado ${year}`} value={formatMoney(ytd, taxConfig.currency)} />
          </div>
        </div>
        {hasLimit && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto', margin: '0 auto' }}>
            <LimitGauge pct={limitPct} />
            <p style={{ ...num, fontSize: '20px', fontWeight: 700, marginTop: '-18px' }}>{limitPct.toFixed(1)}%</p>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>del límite anual</p>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Cambiar de régimen</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '14px' }}>
          {REGIME_LIST.map(r => {
            const active = r.id === taxConfig.regime;
            return (
              <div key={r.id} className="card card-hover" style={{
                display: 'flex', flexDirection: 'column', gap: '10px', padding: '20px',
                border: active ? `2px solid ${r.color}` : '1px solid var(--border-color)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={17} color={r.color} />
                    <span style={{ fontWeight: 700, fontSize: '14.5px' }}>{r.name}</span>
                  </div>
                  {active && <Badge tone="success">Actual</Badge>}
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.55, flex: 1 }}>{r.description}</p>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                  Límite: <strong style={{ ...num, color: 'var(--text-primary)' }}>{r.annualLimit === Infinity ? 'Sin límite' : formatMoney(r.annualLimit, taxConfig.currency)}</strong>
                </p>
                <button
                  type="button"
                  className={active ? 'btn-secondary btn-block' : 'btn-primary btn-block'}
                  disabled={active || saving}
                  onClick={() => handleChangeRegime(r.id)}
                >
                  {active ? 'Régimen actual' : saving ? 'Guardando...' : 'Seleccionar'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
      <span style={{ width: 34, height: 34, borderRadius: 'var(--radius)', background: 'var(--bg-subtle)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} />
      </span>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{label}</p>
        <p style={{ ...num, fontSize: '14px', fontWeight: 700 }}>{value}</p>
      </div>
    </div>
  );
}
