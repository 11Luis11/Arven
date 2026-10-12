import { useEffect, useState } from 'react';
import { Percent, ShieldCheck, AlertTriangle, CalendarRange } from 'lucide-react';
import { DataService, subscribeToRealtime } from '../../../services/dataService';
import { getTaxConfig, getPurchases, subscribeToPurchases, monthlyTaxRows, isActiveSale } from '../../../utils/taxData';
import { getRegime, formatMoney, MONTH_NAMES } from '../../../utils/taxRegimes';
import { toast } from '../../../utils/toast';
import { KpiCard, KpiGrid, Badge, SectionHeader, LoadingState, PeriodPicker } from './shared';
import { num, numRight } from './helpers';

export default function TaxIGV() {
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState(getPurchases);
  const [config, setConfig] = useState(null);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [today] = useState(() => new Date());

  useEffect(() => {
    const load = async () => {
      try {
        const [s, cfg] = await Promise.all([DataService.getSales(), DataService.getConfig()]);
        setSales((s || []).filter(isActiveSale));
        setConfig(cfg);
        setPurchases(getPurchases());
      } catch (e) {
        console.error(e);
        toast.error('No se pudo cargar la información de IGV.');
      }
    };
    load();
    const unsub = subscribeToRealtime(() => load());
    const unsubP = subscribeToPurchases(() => setPurchases(getPurchases()));
    return () => { unsub(); unsubP(); };
  }, []);

  if (!config) return <LoadingState label="Calculando IGV..." />;

  const taxConfig = getTaxConfig(config);
  const regime = getRegime(taxConfig.regime);
  const currency = taxConfig.currency;
  // El React Compiler memoiza este cálculo; no hace falta useMemo manual.
  const monthlyRows = monthlyTaxRows(sales, purchases, year, regime);

  const yearTotals = monthlyRows.reduce((acc, r) => ({
    igvVentas: acc.igvVentas + r.igvVentas,
    igvCompras: acc.igvCompras + r.igvCompras,
    saldo: acc.saldo + Math.max(0, r.saldo),
  }), { igvVentas: 0, igvCompras: 0, saldo: 0 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <SectionHeader
        icon={Percent}
        title="IGV e impuestos"
        subtitle="Impuesto General a las Ventas (18%, incluido en el precio) — resumen mensual y proyección anual."
        actions={<PeriodPicker year={year} onYear={setYear} />}
      />

      {!regime.hasIGV && (
        <div className="alert alert-warning">
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>
            El régimen <strong>{regime.name}</strong> no calcula IGV: tus comprobantes no generan ni consumen crédito fiscal. Solo debes pagar la cuota fija mensual según tu categoría. Los montos siguientes son referenciales.
          </span>
        </div>
      )}

      <KpiGrid>
        <KpiCard label={`IGV ventas ${year}`} value={formatMoney(yearTotals.igvVentas, currency)} icon={Percent} tone="info" sub="IGV cobrado en tus ventas" />
        <KpiCard label={`Crédito fiscal ${year}`} value={formatMoney(yearTotals.igvCompras, currency)} icon={ShieldCheck} tone="info" sub="IGV de tus compras" />
        <KpiCard label={`IGV neto a pagar ${year}`} value={formatMoney(yearTotals.saldo, currency)} icon={AlertTriangle} tone={yearTotals.saldo > 0 ? 'danger' : 'success'} sub="Suma de meses con saldo a pagar" />
      </KpiGrid>

      <div className="table-wrap">
        <table className="data-table" style={{ minWidth: '680px' }}>
          <thead>
            <tr>
              <th>Periodo</th>
              <th style={{ textAlign: 'right' }}>Ventas</th>
              <th style={{ textAlign: 'right' }}>IGV ventas</th>
              <th style={{ textAlign: 'right' }}>Crédito fiscal</th>
              <th style={{ textAlign: 'right' }}>IGV a pagar</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {monthlyRows.map(r => {
              const isPast = new Date(year, r.m + 1, 15) < today;
              const hasActivity = r.salesTotal > 0 || r.igvCompras > 0;
              const pay = Math.max(0, r.saldo);
              return (
                <tr key={r.m}>
                  <td style={{ fontWeight: 600 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <CalendarRange size={14} style={{ color: 'var(--text-muted)' }} />{MONTH_NAMES[r.m]}
                    </span>
                  </td>
                  <td style={numRight}>{formatMoney(r.salesTotal, currency)}</td>
                  <td style={numRight}>{formatMoney(r.igvVentas, currency)}</td>
                  <td style={numRight}>{formatMoney(r.igvCompras, currency)}</td>
                  <td style={{ ...numRight, fontWeight: 700, color: pay > 0 ? 'var(--color-danger)' : hasActivity ? 'var(--color-success)' : 'var(--text-muted)' }}>{formatMoney(pay, currency)}</td>
                  <td>
                    {!hasActivity ? <Badge>Sin movimiento</Badge> : isPast ? <Badge tone="success">Declarado</Badge> : <Badge tone="warning">Pendiente</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: 'var(--bg-subtle)', fontWeight: 700 }}>
              <td style={{ padding: '12px 16px' }}>Total {year}</td>
              <td style={{ ...numRight, padding: '12px 16px' }}>{formatMoney(monthlyRows.reduce((a, r) => a + r.salesTotal, 0), currency)}</td>
              <td style={{ ...numRight, padding: '12px 16px' }}>{formatMoney(yearTotals.igvVentas, currency)}</td>
              <td style={{ ...numRight, padding: '12px 16px' }}>{formatMoney(yearTotals.igvCompras, currency)}</td>
              <td style={{ ...numRight, padding: '12px 16px' }}>{formatMoney(yearTotals.saldo, currency)}</td>
              <td style={{ ...num, padding: '12px 16px' }} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
