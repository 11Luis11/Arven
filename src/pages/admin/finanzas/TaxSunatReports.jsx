import { useEffect, useState } from 'react';
import { FileBarChart, Download, Receipt, Percent, Landmark, Info } from 'lucide-react';
import { DataService, subscribeToRealtime } from '../../../services/dataService';
import { getTaxConfig, getPurchases, subscribeToPurchases, monthlyTaxRows, isActiveSale } from '../../../utils/taxData';
import { getRegime, formatMoney, MONTH_NAMES } from '../../../utils/taxRegimes';
import { downloadCsv } from '../../../utils/csv';
import { toast } from '../../../utils/toast';
import { KpiCard, KpiGrid, SectionHeader, LoadingState, PeriodPicker } from './shared';
import { csvRow, money2, numRight } from './helpers';

export default function TaxSunatReports() {
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState(getPurchases);
  const [config, setConfig] = useState(null);
  const [year, setYear] = useState(() => new Date().getFullYear());

  useEffect(() => {
    const load = async () => {
      try {
        const [s, cfg] = await Promise.all([DataService.getSales(), DataService.getConfig()]);
        setSales((s || []).filter(isActiveSale));
        setConfig(cfg);
        setPurchases(getPurchases());
      } catch (e) {
        console.error(e);
        toast.error('No se pudo cargar el reporte SUNAT.');
      }
    };
    load();
    const unsub = subscribeToRealtime(() => load());
    const unsubP = subscribeToPurchases(() => setPurchases(getPurchases()));
    return () => { unsub(); unsubP(); };
  }, []);

  if (!config) return <LoadingState label="Preparando reporte SUNAT..." />;

  const taxConfig = getTaxConfig(config);
  const regime = getRegime(taxConfig.regime);
  const currency = taxConfig.currency;
  // Cálculo puro (el React Compiler lo memoiza); el Nuevo RUS no suma IGV al total.
  const rows = monthlyTaxRows(sales, purchases, year, regime);
  const yearSales = rows.reduce((a, r) => a + r.salesTotal, 0);
  const yearIgv = rows.reduce((a, r) => a + r.igvPagar, 0);
  const yearOther = rows.reduce((a, r) => a + r.renta + r.rus, 0);
  const yearTotal = rows.reduce((a, r) => a + r.total, 0);
  const otherLabel = regime.hasRenta ? 'Pago a cuenta renta' : 'Cuota fija RUS';

  const exportCsv = () => {
    const header = 'Periodo,Ventas,IGV Ventas,Crédito Fiscal,IGV a Pagar,Pago Renta / Cuota,Total a Pagar\n';
    const body = rows.map(r => csvRow([
      `${MONTH_NAMES[r.m]} ${year}`, money2(r.salesTotal), money2(r.igvVentas), money2(r.igvCompras),
      money2(r.igvPagar), money2(r.renta + r.rus), money2(r.total),
    ])).join('\n');
    downloadCsv(`reporte_sunat_${year}.csv`, header + body);
    toast.success(`Reporte SUNAT ${year} exportado`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <SectionHeader
        icon={FileBarChart}
        title="Reportes SUNAT"
        subtitle={`Resumen anual listo para presentar o entregar a tu contador · ${regime.fullName}.`}
        actions={<>
          <PeriodPicker year={year} onYear={setYear} />
          <button type="button" className="btn-secondary" onClick={exportCsv}><Download size={15} /> Exportar CSV</button>
        </>}
      />

      <KpiGrid>
        <KpiCard label={`Ventas ${year}`} value={formatMoney(yearSales, currency)} icon={Receipt} />
        {regime.hasIGV && <KpiCard label={`IGV a pagar ${year}`} value={formatMoney(yearIgv, currency)} icon={Percent} tone="info" sub="Estimado según ventas y compras" />}
        <KpiCard label={`${otherLabel} ${year}`} value={formatMoney(yearOther, currency)} icon={Landmark} />
        <KpiCard label={`Total tributos ${year}`} value={formatMoney(yearTotal, currency)} icon={FileBarChart} tone="danger" />
      </KpiGrid>

      <div className="table-wrap">
        <table className="data-table" style={{ minWidth: '640px' }}>
          <thead>
            <tr>
              <th>Periodo</th>
              <th style={{ textAlign: 'right' }}>Ventas</th>
              <th style={{ textAlign: 'right' }}>IGV a pagar</th>
              <th style={{ textAlign: 'right' }}>{otherLabel}</th>
              <th style={{ textAlign: 'right' }}>Total a pagar</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.m}>
                <td style={{ fontWeight: 600 }}>{MONTH_NAMES[r.m]}</td>
                <td style={numRight}>{formatMoney(r.salesTotal, currency)}</td>
                <td style={{ ...numRight, color: r.igvPagar > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{formatMoney(r.igvPagar, currency)}</td>
                <td style={numRight}>{formatMoney(r.renta + r.rus, currency)}</td>
                <td style={{ ...numRight, fontWeight: 700 }}>{formatMoney(r.total, currency)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: 'var(--bg-subtle)', fontWeight: 700 }}>
              <td style={{ padding: '12px 16px' }}>Total {year}</td>
              <td style={{ ...numRight, padding: '12px 16px' }}>{formatMoney(yearSales, currency)}</td>
              <td style={{ ...numRight, padding: '12px 16px' }}>{formatMoney(yearIgv, currency)}</td>
              <td style={{ ...numRight, padding: '12px 16px' }}>{formatMoney(yearOther, currency)}</td>
              <td style={{ ...numRight, padding: '12px 16px' }}>{formatMoney(yearTotal, currency)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="alert alert-info">
        <Info size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
        <span>Los montos son estimados a partir de tus ventas y compras registradas en el sistema. Verifica siempre con tu contador o el portal de SUNAT antes de declarar.</span>
      </div>
    </div>
  );
}
