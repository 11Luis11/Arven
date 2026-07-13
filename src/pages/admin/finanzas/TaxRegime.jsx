import { useEffect, useState } from 'react';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';
import { DataService, subscribeToRealtime } from '../../../services/dataService';
import { getTaxConfig, saveTaxConfig, yearToDateIncome } from '../../../utils/taxData';
import { REGIME_LIST, getRegime, formatMoney } from '../../../utils/taxRegimes';
import { Badge, LimitGauge } from './shared';

export default function TaxRegime() {
  const [config, setConfig] = useState(null);
  const [sales, setSales] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [cfg, s] = await Promise.all([DataService.getConfig(), DataService.getSales()]);
    setConfig(cfg);
    setSales(s.filter(x => x.status !== 'voided'));
  };

  useEffect(() => {
    load();
    const unsub = subscribeToRealtime(() => load());
    return () => unsub();
  }, []);

  if (!config) return null;
  const taxConfig = getTaxConfig(config);
  const currentRegime = getRegime(taxConfig.regime);
  const year = new Date().getFullYear();
  const ytd = yearToDateIncome(sales, year);
  const limitPct = currentRegime.annualLimit === Infinity ? 0 : Math.min(100, (ytd / currentRegime.annualLimit) * 100);

  const handleChangeRegime = async (regimeId) => {
    if (regimeId === taxConfig.regime) return;
    if (!confirm(`¿Confirmas el cambio a ${getRegime(regimeId).fullName}? Esto adaptará automáticamente los indicadores y cálculos del dashboard tributario.`)) return;
    setSaving(true);
    await saveTaxConfig(config, { regime: regimeId, regimeStartDate: new Date().toISOString().slice(0, 10) });
    setSaving(false);
    load();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Régimen Tributario</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          Tu régimen determina qué impuestos aplicas, los límites de ingresos y qué comprobantes puedes emitir.
        </p>
      </div>

      <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '20px', alignItems: 'center' }}>
        <div>
          <Badge tone="success">ACTIVO</Badge>
          <h3 style={{ fontSize: '20px', fontWeight: 700, marginTop: '10px' }}>{currentRegime.fullName}</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6, maxWidth: '520px' }}>{currentRegime.description}</p>
          <div style={{ display: 'flex', gap: '24px', marginTop: '16px', fontSize: '12.5px' }}>
            <div>
              <p style={{ color: 'var(--text-secondary)' }}>Desde</p>
              <p style={{ fontWeight: 700 }}>{new Date(taxConfig.regimeStartDate).toLocaleDateString('es-PE')}</p>
            </div>
            <div>
              <p style={{ color: 'var(--text-secondary)' }}>Límite anual</p>
              <p style={{ fontWeight: 700 }}>{currentRegime.annualLimit === Infinity ? 'Sin límite' : formatMoney(currentRegime.annualLimit, taxConfig.currency)}</p>
            </div>
            <div>
              <p style={{ color: 'var(--text-secondary)' }}>Acumulado {year}</p>
              <p style={{ fontWeight: 700 }}>{formatMoney(ytd, taxConfig.currency)}</p>
            </div>
          </div>
        </div>
        {currentRegime.annualLimit !== Infinity && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <LimitGauge pct={limitPct} />
            <p style={{ fontSize: '18px', fontWeight: 700, marginTop: '-14px' }}>{limitPct.toFixed(1)}%</p>
          </div>
        )}
      </div>

      <div>
        <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '12px' }}>Cambiar de régimen</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
          {REGIME_LIST.map(r => {
            const active = r.id === taxConfig.regime;
            return (
              <div key={r.id} className="card" style={{
                display: 'flex', flexDirection: 'column', gap: '10px',
                border: active ? `2px solid ${r.color}` : '1px solid var(--border-color)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={15} color={r.color} />
                    <span style={{ fontWeight: 700, fontSize: '13.5px' }}>{r.name}</span>
                  </div>
                  {active && <CheckCircle2 size={16} color={r.color} />}
                </div>
                <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.5, minHeight: '66px' }}>{r.description}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Límite: <strong>{r.annualLimit === Infinity ? 'Sin límite' : formatMoney(r.annualLimit, taxConfig.currency)}</strong>
                </p>
                <button
                  disabled={active || saving}
                  onClick={() => handleChangeRegime(r.id)}
                  style={{
                    marginTop: '4px', padding: '8px', borderRadius: '8px', border: 'none', fontSize: '12.5px', fontWeight: 600,
                    backgroundColor: active ? '#F1F1F1' : 'var(--text-primary)', color: active ? '#999' : '#FFF',
                    cursor: active ? 'default' : 'pointer',
                  }}
                >
                  {active ? 'Régimen actual' : 'Seleccionar'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
