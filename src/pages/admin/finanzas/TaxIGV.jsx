import { useEffect, useMemo, useState } from 'react';
import { Percent, ShieldCheck, AlertTriangle } from 'lucide-react';
import { DataService, subscribeToRealtime } from '../../../services/dataService';
import { getTaxConfig, getPurchases, subscribeToPurchases, filterByMonth, sumSales, monthlySeries } from '../../../utils/taxData';
import { getRegime, splitIGV, formatMoney } from '../../../utils/taxRegimes';
import { KpiCard, Badge } from './shared';

export default function TaxIGV() {
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [config, setConfig] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());

  const load = async () => {
    const [s, cfg] = await Promise.all([DataService.getSales(), DataService.getConfig()]);
    setSales(s.filter(x => x.status !== 'voided'));
    setConfig(cfg);
    setPurchases(getPurchases());
  };

  useEffect(() => {
    load();
    const unsub = subscribeToRealtime(() => load());
    const unsubP = subscribeToPurchases(() => setPurchases(getPurchases()));
    return () => { unsub(); unsubP(); };
  }, []);

  const taxConfig = config ? getTaxConfig(config) : null;
  const regime = taxConfig ? getRegime(taxConfig.regime) : null;

  const monthlyRows = useMemo(() => {
    if (!regime) return [];
    return Array.from({ length: 12 }, (_, m) => {
      const monthSales = filterByMonth(sales, 'created_at', m, year);
      const monthPurchases = filterByMonth(purchases, 'date', m, year);
      const salesTotal = sumSales(monthSales);
      const igvVentas = splitIGV(salesTotal).igv;
      const igvCompras = monthPurchases.reduce((a, p) => a + p.igv, 0);
      const saldo = igvVentas - igvCompras;
      return { m, salesTotal, igvVentas, igvCompras, saldo };
    });
  }, [sales, purchases, year, regime]);

  if (!taxConfig || !regime) return null;
  const currency = taxConfig.currency;

  const yearTotals = monthlyRows.reduce((acc, r) => {
    acc.igvVentas += r.igvVentas; acc.igvCompras += r.igvCompras; acc.saldo += Math.max(0, r.saldo);
    return acc;
  }, { igvVentas: 0, igvCompras: 0, saldo: 0 });

  const names = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>IGV e Impuestos</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>Impuesto General a las Ventas (18%) — resumen mensual y proyección anual.</p>
        </div>
        <input className="input-field" style={{ width: '100px' }} type="number" value={year} onChange={e => setYear(Number(e.target.value))} />
      </div>

      {!regime.hasIGV && (
        <div className="card" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', backgroundColor: '#FFFBEB' }}>
          <AlertTriangle size={16} style={{ color: '#D97706', marginTop: '2px' }} />
          <p style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
            El régimen <strong>{regime.name}</strong> no calcula IGV: tus comprobantes no generan ni consumen crédito fiscal. Solo debes pagar la cuota fija mensual según tu categoría.
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        <KpiCard label="IGV Ventas (Año)" value={formatMoney(yearTotals.igvVentas, currency)} icon={Percent} tone="info" />
        <KpiCard label="Crédito Fiscal (Año)" value={formatMoney(yearTotals.igvCompras, currency)} icon={ShieldCheck} tone="info" />
        <KpiCard label="IGV Neto a Pagar (Año)" value={formatMoney(yearTotals.saldo, currency)} icon={AlertTriangle} tone="danger" />
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '14px' }}>Detalle mensual {year}</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', minWidth: '640px' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ padding: '8px 6px' }}>Periodo</th>
              <th style={{ padding: '8px 6px' }}>Ventas</th>
              <th style={{ padding: '8px 6px' }}>IGV Ventas</th>
              <th style={{ padding: '8px 6px' }}>Crédito Fiscal</th>
              <th style={{ padding: '8px 6px' }}>IGV a Pagar</th>
              <th style={{ padding: '8px 6px' }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {monthlyRows.map(r => {
              const isPast = new Date(year, r.m + 1, 15) < new Date();
              const hasActivity = r.salesTotal > 0 || r.igvCompras > 0;
              return (
                <tr key={r.m} style={{ borderTop: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '10px 6px', fontWeight: 600 }}>{names[r.m]}</td>
                  <td style={{ padding: '10px 6px' }}>{formatMoney(r.salesTotal, currency)}</td>
                  <td style={{ padding: '10px 6px' }}>{formatMoney(r.igvVentas, currency)}</td>
                  <td style={{ padding: '10px 6px' }}>{formatMoney(r.igvCompras, currency)}</td>
                  <td style={{ padding: '10px 6px', fontWeight: 700, color: r.saldo > 0 ? '#DC2626' : '#16A34A' }}>{formatMoney(Math.max(0, r.saldo), currency)}</td>
                  <td style={{ padding: '10px 6px' }}>
                    {!hasActivity ? <Badge>Sin movimiento</Badge> : isPast ? <Badge tone="success">Declarado</Badge> : <Badge tone="warning">Pendiente</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
