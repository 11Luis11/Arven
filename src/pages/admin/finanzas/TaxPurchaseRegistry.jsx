import { useEffect, useMemo, useState } from 'react';
import { Download, BookOpen } from 'lucide-react';
import { DataService } from '../../../services/dataService';
import { getTaxConfig, getPurchases, subscribeToPurchases } from '../../../utils/taxData';
import { formatMoney } from '../../../utils/taxRegimes';
import { downloadCsv } from '../../../utils/csv';

export default function TaxPurchaseRegistry() {
  const [purchases, setPurchases] = useState([]);
  const [currency, setCurrency] = useState('PEN');
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    setPurchases(getPurchases());
    DataService.getConfig().then(cfg => setCurrency(getTaxConfig(cfg).currency));
    return subscribeToPurchases(() => setPurchases(getPurchases()));
  }, []);

  const rows = useMemo(() => purchases
    .filter(p => { const d = new Date(p.date); return d.getMonth() === month && d.getFullYear() === year; })
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((p, i) => ({ n: i + 1, ...p })), [purchases, month, year]);

  const totals = rows.reduce((acc, r) => { acc.base += r.base; acc.igv += r.igv; acc.total += r.total; return acc; }, { base: 0, igv: 0, total: 0 });

  const exportCsv = () => {
    const header = 'N°,Fecha,Tipo CP,Serie,Proveedor,RUC,Base Imponible,IGV,Total\n';
    const body = rows.map(r => `${r.n},${new Date(r.date).toLocaleDateString('es-PE')},${r.docType},${r.series},"${r.providerName}",${r.providerRuc},${r.base.toFixed(2)},${r.igv.toFixed(2)},${r.total.toFixed(2)}`).join('\n');
    downloadCsv(`registro_compras_${year}_${month + 1}.csv`, header + body);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BookOpen size={20} />
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Registro de Compras</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>Formato compatible con el Libro de Compras exigido por SUNAT (PLE).</p>
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
              <th style={thStyle}>Fecha</th>
              <th style={thStyle}>Tipo CP</th>
              <th style={thStyle}>Serie</th>
              <th style={thStyle}>Proveedor</th>
              <th style={thStyle}>RUC</th>
              <th style={thStyle}>Base Imponible</th>
              <th style={thStyle}>IGV</th>
              <th style={thStyle}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>Sin compras registradas en este periodo.</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                <td style={tdStyle}>{r.n}</td>
                <td style={tdStyle}>{new Date(r.date).toLocaleDateString('es-PE')}</td>
                <td style={tdStyle}>{r.docType}</td>
                <td style={tdStyle}>{r.series || '—'}</td>
                <td style={tdStyle}>{r.providerName}</td>
                <td style={tdStyle}>{r.providerRuc || '—'}</td>
                <td style={tdStyle}>{formatMoney(r.base, currency)}</td>
                <td style={tdStyle}>{formatMoney(r.igv, currency)}</td>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{formatMoney(r.total, currency)}</td>
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
