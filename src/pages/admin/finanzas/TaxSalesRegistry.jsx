import { useEffect, useMemo, useState } from 'react';
import { Download, BookOpen } from 'lucide-react';
import { DataService, subscribeToRealtime } from '../../../services/dataService';
import { getTaxConfig } from '../../../utils/taxData';
import { splitIGV, formatMoney } from '../../../utils/taxRegimes';
import { downloadCsv } from '../../../utils/csv';

export default function TaxSalesRegistry() {
  const [sales, setSales] = useState([]);
  const [currency, setCurrency] = useState('PEN');
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const load = async () => {
      const [s, cfg] = await Promise.all([DataService.getSales(), DataService.getConfig()]);
      setSales(s.filter(x => x.status !== 'voided'));
      setCurrency(getTaxConfig(cfg).currency);
    };
    load();
    const unsub = subscribeToRealtime(() => load());
    return () => unsub();
  }, []);

  const rows = useMemo(() => sales
    .filter(s => { const d = new Date(s.created_at); return d.getMonth() === month && d.getFullYear() === year; })
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map((s, i) => {
      const { base, igv } = splitIGV(s.total_amount);
      return { n: i + 1, ...s, base, igv };
    }), [sales, month, year]);

  const totals = rows.reduce((acc, r) => { acc.base += r.base; acc.igv += r.igv; acc.total += r.total_amount; return acc; }, { base: 0, igv: 0, total: 0 });

  const exportCsv = () => {
    const header = 'N°,Fecha Emisión,Tipo CP,Serie-Número,Cliente,N° Doc.,Base Imponible,IGV,Total\n';
    const body = rows.map(r => `${r.n},${new Date(r.created_at).toLocaleDateString('es-PE')},${r.document_type},${r.invoice_number},"${r.customer_name}",${r.customer_document || ''},${r.base.toFixed(2)},${r.igv.toFixed(2)},${r.total_amount.toFixed(2)}`).join('\n');
    downloadCsv(`registro_ventas_${year}_${month + 1}.csv`, header + body);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BookOpen size={20} />
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Registro de Ventas</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>Formato compatible con el Libro de Ventas exigido por SUNAT (PLE).</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select className="input-field" style={{ width: 'auto' }} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'].map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <input className="input-field" style={{ width: '90px' }} type="number" value={year} onChange={e => setYear(Number(e.target.value))} />
          <button onClick={exportCsv} style={btnStyle}><Download size={14} /> Exportar</button>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '820px' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '10.5px', textTransform: 'uppercase' }}>
              <th style={thStyle}>N°</th>
              <th style={thStyle}>Fecha Emisión</th>
              <th style={thStyle}>Tipo CP</th>
              <th style={thStyle}>Serie-Número</th>
              <th style={thStyle}>Cliente</th>
              <th style={thStyle}>N° Doc.</th>
              <th style={thStyle}>Base Imponible</th>
              <th style={thStyle}>IGV</th>
              <th style={thStyle}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>Sin ventas en este periodo.</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                <td style={tdStyle}>{r.n}</td>
                <td style={tdStyle}>{new Date(r.created_at).toLocaleDateString('es-PE')}</td>
                <td style={tdStyle}>{r.document_type}</td>
                <td style={tdStyle}>{r.invoice_number}</td>
                <td style={tdStyle}>{r.customer_name}</td>
                <td style={tdStyle}>{r.customer_document}</td>
                <td style={tdStyle}>{formatMoney(r.base, currency)}</td>
                <td style={tdStyle}>{formatMoney(r.igv, currency)}</td>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{formatMoney(r.total_amount, currency)}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--text-primary)', fontWeight: 700 }}>
                <td colSpan={6} style={tdStyle}>TOTALES</td>
                <td style={tdStyle}>{formatMoney(totals.base, currency)}</td>
                <td style={tdStyle}>{formatMoney(totals.igv, currency)}</td>
                <td style={tdStyle}>{formatMoney(totals.total, currency)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

const thStyle = { padding: '8px 6px' };
const tdStyle = { padding: '9px 6px' };
const btnStyle = {
  display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '8px',
  border: '1px solid var(--border-color)', backgroundColor: '#FFF', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
};
