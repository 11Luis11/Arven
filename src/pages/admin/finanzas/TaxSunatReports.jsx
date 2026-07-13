import { useEffect, useMemo, useState } from 'react';
import { FileBarChart, Download, FileText } from 'lucide-react';
import { DataService, subscribeToRealtime } from '../../../services/dataService';
import { getTaxConfig, getPurchases, subscribeToPurchases, filterByMonth, sumSales } from '../../../utils/taxData';
import { getRegime, splitIGV, formatMoney, estimateRentaPayment, estimateRusFee } from '../../../utils/taxRegimes';
import { downloadCsv } from '../../../utils/csv';
import { KpiCard } from './shared';

export default function TaxSunatReports() {
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [config, setConfig] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const load = async () => {
      const [s, cfg] = await Promise.all([DataService.getSales(), DataService.getConfig()]);
      setSales(s.filter(x => x.status !== 'voided'));
      setConfig(cfg);
      setPurchases(getPurchases());
    };
    load();
    const unsub = subscribeToRealtime(() => load());
    const unsubP = subscribeToPurchases(() => setPurchases(getPurchases()));
    return () => { unsub(); unsubP(); };
  }, []);

  const taxConfig = config ? getTaxConfig(config) : null;
  const regime = taxConfig ? getRegime(taxConfig.regime) : null;

  const names = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const rows = useMemo(() => {
    if (!regime) return [];
    return Array.from({ length: 12 }, (_, m) => {
      const monthSales = filterByMonth(sales, 'created_at', m, year);
      const monthPurchases = filterByMonth(purchases, 'date', m, year);
      const salesTotal = sumSales(monthSales);
      const { base, igv: igvVentas } = splitIGV(salesTotal);
      const igvCompras = monthPurchases.reduce((a, p) => a + p.igv, 0);
      const igvPagar = Math.max(0, igvVentas - igvCompras);
      const renta = regime.hasRenta ? estimateRentaPayment(regime.id, base) : 0;
      const rus = !regime.hasIGV ? estimateRusFee(salesTotal) : 0;
      return { m, salesTotal, igvVentas, igvCompras, igvPagar, renta, rus, total: igvPagar + renta + rus };
    });
  }, [sales, purchases, year, regime]);

  if (!taxConfig || !regime) return null;
  const currency = taxConfig.currency;
  const yearTotal = rows.reduce((a, r) => a + r.total, 0);

  const exportCsv = () => {
    const header = 'Periodo,Ventas,IGV Ventas,Crédito Fiscal,IGV a Pagar,Pago Renta / Cuota,Total a Pagar\n';
    const body = rows.map(r => `${names[r.m]} ${year},${r.salesTotal.toFixed(2)},${r.igvVentas.toFixed(2)},${r.igvCompras.toFixed(2)},${r.igvPagar.toFixed(2)},${(r.renta + r.rus).toFixed(2)},${r.total.toFixed(2)}`).join('\n');
    downloadCsv(`reporte_sunat_${year}.csv`, header + body);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileBarChart size={20} />
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Reportes SUNAT</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>Resumen anual listo para presentar o entregar a tu contador.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input className="input-field" style={{ width: '100px' }} type="number" value={year} onChange={e => setYear(Number(e.target.value))} />
          <button onClick={exportCsv} style={btnStyle}><Download size={14} /> Exportar CSV</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        <KpiCard label="Ventas del año" value={formatMoney(rows.reduce((a, r) => a + r.salesTotal, 0), currency)} icon={FileText} />
        <KpiCard label="IGV pagado (año)" value={formatMoney(rows.reduce((a, r) => a + r.igvPagar, 0), currency)} icon={FileText} tone="info" />
        <KpiCard label="Total tributos (año)" value={formatMoney(yearTotal, currency)} icon={FileText} tone="danger" />
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', minWidth: '680px' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ padding: '8px 6px' }}>Periodo</th>
              <th style={{ padding: '8px 6px' }}>Ventas</th>
              <th style={{ padding: '8px 6px' }}>IGV a Pagar</th>
              <th style={{ padding: '8px 6px' }}>{regime.hasRenta ? 'Pago a cuenta Renta' : 'Cuota fija RUS'}</th>
              <th style={{ padding: '8px 6px' }}>Total a Pagar</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.m} style={{ borderTop: '1px solid var(--border-color)' }}>
                <td style={{ padding: '10px 6px', fontWeight: 600 }}>{names[r.m]}</td>
                <td style={{ padding: '10px 6px' }}>{formatMoney(r.salesTotal, currency)}</td>
                <td style={{ padding: '10px 6px' }}>{formatMoney(r.igvPagar, currency)}</td>
                <td style={{ padding: '10px 6px' }}>{formatMoney(r.renta + r.rus, currency)}</td>
                <td style={{ padding: '10px 6px', fontWeight: 700 }}>{formatMoney(r.total, currency)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--text-primary)', fontWeight: 700 }}>
              <td colSpan={4} style={{ padding: '10px 6px' }}>TOTAL {year}</td>
              <td style={{ padding: '10px 6px' }}>{formatMoney(yearTotal, currency)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
        * Los montos son estimados a partir de tus ventas y compras registradas en ARVEN. Verifica siempre con tu contador o el portal de SUNAT antes de declarar.
      </p>
    </div>
  );
}

const btnStyle = {
  display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '8px',
  border: '1px solid var(--border-color)', backgroundColor: '#FFF', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
};
