import { useEffect, useMemo, useState } from 'react';
import { Download, BookOpen } from 'lucide-react';
import { DataService, subscribeToRealtime } from '../../../services/dataService';
import { getTaxConfig, isActiveSale, toNum } from '../../../utils/taxData';
import { splitIGV, formatMoney, formatDate } from '../../../utils/taxRegimes';
import { downloadCsv } from '../../../utils/csv';
import { toast } from '../../../utils/toast';
import { SectionHeader, LoadingState, EmptyRow, PeriodPicker } from './shared';
import { csvRow, money2, docLabel, num, numRight } from './helpers';

export default function TaxSalesRegistry() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState('PEN');
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [year, setYear] = useState(() => new Date().getFullYear());

  useEffect(() => {
    const load = async () => {
      try {
        const [s, cfg] = await Promise.all([DataService.getSales(), DataService.getConfig()]);
        setSales((s || []).filter(isActiveSale));
        setCurrency(getTaxConfig(cfg).currency);
      } catch (e) {
        console.error(e);
        toast.error('No se pudo cargar el registro de ventas.');
      } finally {
        setLoading(false);
      }
    };
    load();
    const unsub = subscribeToRealtime(() => load());
    return () => unsub();
  }, []);

  const rows = useMemo(() => sales
    .filter(s => { const d = new Date(s.created_at); return d.getMonth() === month && d.getFullYear() === year; })
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map((s, i) => {
      const total = toNum(s.total_amount);
      const { base, igv } = splitIGV(total);
      return { n: i + 1, ...s, total, base, igv };
    }), [sales, month, year]);

  const totals = rows.reduce((acc, r) => { acc.base += r.base; acc.igv += r.igv; acc.total += r.total; return acc; }, { base: 0, igv: 0, total: 0 });

  const exportCsv = () => {
    if (rows.length === 0) { toast.warning('No hay ventas para exportar en este periodo.'); return; }
    const header = 'N°,Fecha Emisión,Tipo CP,Serie-Número,Cliente,N° Doc.,Base Imponible,IGV,Total\n';
    const body = rows.map(r => csvRow([
      r.n, formatDate(r.created_at), r.document_type, r.invoice_number, r.customer_name, r.customer_document || '',
      money2(r.base), money2(r.igv), money2(r.total),
    ])).join('\n');
    downloadCsv(`registro_ventas_${year}_${month + 1}.csv`, header + body);
    toast.success('Registro de ventas exportado');
  };

  if (loading) return <LoadingState label="Cargando registro de ventas..." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <SectionHeader
        icon={BookOpen}
        title="Registro de Ventas"
        subtitle="Formato compatible con el Libro de Ventas exigido por SUNAT (PLE)."
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
              <th>Fecha emisión</th>
              <th>Tipo CP</th>
              <th>Serie-Número</th>
              <th>Cliente</th>
              <th>N° Doc.</th>
              <th style={{ textAlign: 'right' }}>Base imponible</th>
              <th style={{ textAlign: 'right' }}>IGV</th>
              <th style={{ textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={9} icon={BookOpen} title="Sin ventas en este periodo" text="Selecciona otro mes o año para ver su registro." />
            ) : rows.map(r => (
              <tr key={r.id}>
                <td style={{ ...num, color: 'var(--text-secondary)' }}>{r.n}</td>
                <td style={num}>{formatDate(r.created_at)}</td>
                <td>{docLabel(r.document_type)}</td>
                <td style={{ ...num, fontWeight: 500 }}>{r.invoice_number || '—'}</td>
                <td>{r.customer_name || 'Cliente varios'}</td>
                <td style={num}>{r.customer_document || '—'}</td>
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
