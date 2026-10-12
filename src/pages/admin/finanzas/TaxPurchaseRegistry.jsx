import { useEffect, useMemo, useState } from 'react';
import { Download, BookOpen } from 'lucide-react';
import { DataService } from '../../../services/dataService';
import { getTaxConfig, getPurchases, subscribeToPurchases, filterByMonth, toNum } from '../../../utils/taxData';
import { formatMoney, formatDate, parseLocalDate } from '../../../utils/taxRegimes';
import { downloadCsv } from '../../../utils/csv';
import { toast } from '../../../utils/toast';
import { SectionHeader, EmptyRow, PeriodPicker } from './shared';
import { csvRow, money2, num, numRight } from './helpers';

export default function TaxPurchaseRegistry() {
  // Las compras viven en localStorage: se leen de forma síncrona en el primer render.
  const [purchases, setPurchases] = useState(getPurchases);
  const [currency, setCurrency] = useState('PEN');
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [year, setYear] = useState(() => new Date().getFullYear());

  useEffect(() => {
    DataService.getConfig()
      .then(cfg => setCurrency(getTaxConfig(cfg).currency))
      .catch(e => console.error(e));
    return subscribeToPurchases(() => setPurchases(getPurchases()));
  }, []);

  const rows = useMemo(() => filterByMonth(purchases, 'date', month, year)
    .sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date))
    .map((p, i) => ({ n: i + 1, ...p, base: toNum(p.base), igv: toNum(p.igv), total: toNum(p.total) })), [purchases, month, year]);

  const totals = rows.reduce((acc, r) => { acc.base += r.base; acc.igv += r.igv; acc.total += r.total; return acc; }, { base: 0, igv: 0, total: 0 });

  const exportCsv = () => {
    if (rows.length === 0) { toast.warning('No hay compras para exportar en este periodo.'); return; }
    const header = 'N°,Fecha,Tipo CP,Serie,Proveedor,RUC,Base Imponible,IGV,Total\n';
    const body = rows.map(r => csvRow([
      r.n, formatDate(r.date), r.docType, r.series, r.providerName, r.providerRuc,
      money2(r.base), money2(r.igv), money2(r.total),
    ])).join('\n');
    downloadCsv(`registro_compras_${year}_${month + 1}.csv`, header + body);
    toast.success('Registro de compras exportado');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <SectionHeader
        icon={BookOpen}
        title="Registro de Compras"
        subtitle="Formato compatible con el Libro de Compras exigido por SUNAT (PLE)."
        actions={<>
          <PeriodPicker month={month} onMonth={setMonth} year={year} onYear={setYear} />
          <button type="button" className="btn-secondary" onClick={exportCsv}><Download size={15} /> Exportar</button>
        </>}
      />

      <div className="table-wrap">
        <table className="data-table" style={{ minWidth: '860px', fontSize: '13px' }}>
          <thead>
            <tr>
              <th>N°</th>
              <th>Fecha</th>
              <th>Tipo CP</th>
              <th>Serie</th>
              <th>Proveedor</th>
              <th>RUC</th>
              <th style={{ textAlign: 'right' }}>Base imponible</th>
              <th style={{ textAlign: 'right' }}>IGV</th>
              <th style={{ textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={9} icon={BookOpen} title="Sin compras en este periodo" text="Registra tus comprobantes de proveedores en la pestaña Compras." />
            ) : rows.map(r => (
              <tr key={r.id}>
                <td style={{ ...num, color: 'var(--text-secondary)' }}>{r.n}</td>
                <td style={num}>{formatDate(r.date)}</td>
                <td>{r.docType}</td>
                <td style={num}>{r.series || '—'}</td>
                <td>{r.providerName}</td>
                <td style={num}>{r.providerRuc || '—'}</td>
                <td style={numRight}>{formatMoney(r.base, currency)}</td>
                <td style={numRight}>{formatMoney(r.igv, currency)}</td>
                <td style={{ ...numRight, fontWeight: 600 }}>{formatMoney(r.total, currency)}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ background: 'var(--bg-subtle)', fontWeight: 700 }}>
                <td colSpan={6} style={{ padding: '12px 16px' }}>Totales ({rows.length} comprobantes)</td>
                <td style={{ ...numRight, padding: '12px 16px' }}>{formatMoney(totals.base, currency)}</td>
                <td style={{ ...numRight, padding: '12px 16px' }}>{formatMoney(totals.igv, currency)}</td>
                <td style={{ ...numRight, padding: '12px 16px' }}>{formatMoney(totals.total, currency)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
