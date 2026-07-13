import { useEffect, useMemo, useState } from 'react';
import { Search, Download, FileText, Receipt } from 'lucide-react';
import { DataService, subscribeToRealtime } from '../../../services/dataService';
import { getTaxConfig } from '../../../utils/taxData';
import { splitIGV, formatMoney } from '../../../utils/taxRegimes';
import { Badge, KpiCard } from './shared';
import { downloadCsv } from '../../../utils/csv';

export default function TaxSales() {
  const [sales, setSales] = useState([]);
  const [currency, setCurrency] = useState('PEN');
  const [docFilter, setDocFilter] = useState('Todos');
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());

  const load = async () => {
    const [s, cfg] = await Promise.all([DataService.getSales(), DataService.getConfig()]);
    setSales(s.filter(x => x.status !== 'voided'));
    setCurrency(getTaxConfig(cfg).currency);
  };

  useEffect(() => {
    load();
    const unsub = subscribeToRealtime(() => load());
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    return sales.filter(s => {
      const d = new Date(s.created_at);
      if (d.getMonth() !== month || d.getFullYear() !== year) return false;
      if (docFilter !== 'Todos' && s.document_type !== docFilter) return false;
      if (search && !(`${s.invoice_number} ${s.customer_name}`.toLowerCase().includes(search.toLowerCase()))) return false;
      return true;
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [sales, docFilter, search, month, year]);

  const totals = filtered.reduce((acc, s) => {
    const { base, igv } = splitIGV(s.total_amount);
    acc.total += s.total_amount; acc.base += base; acc.igv += igv;
    return acc;
  }, { total: 0, base: 0, igv: 0 });

  const facturas = filtered.filter(s => s.document_type === 'Factura').length;
  const boletas = filtered.filter(s => s.document_type !== 'Factura').length;

  const exportCsv = () => {
    const header = 'Tipo,Serie-Numero,Cliente,Documento,Fecha,Base Imponible,IGV,Total\n';
    const rows = filtered.map(s => {
      const { base, igv } = splitIGV(s.total_amount);
      return `${s.document_type},${s.invoice_number},"${s.customer_name}",${s.customer_document || ''},${new Date(s.created_at).toLocaleDateString('es-PE')},${base.toFixed(2)},${igv.toFixed(2)},${s.total_amount.toFixed(2)}`;
    }).join('\n');
    downloadCsv(`ventas_${year}_${month + 1}.csv`, header + rows);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Ventas (Facturas y Boletas)</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>Comprobantes de venta emitidos automáticamente desde POS y Storefront.</p>
        </div>
        <button onClick={exportCsv} style={btnStyle}><Download size={14} /> Exportar CSV</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
        <KpiCard label="Total ventas" value={formatMoney(totals.total, currency)} icon={Receipt} />
        <KpiCard label="Base imponible" value={formatMoney(totals.base, currency)} icon={FileText} />
        <KpiCard label="IGV cobrado" value={formatMoney(totals.igv, currency)} icon={FileText} tone="info" />
        <KpiCard label="Facturas / Boletas" value={`${facturas} / ${boletas}`} icon={Receipt} />
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input className="input-field" style={{ paddingLeft: '32px' }} placeholder="Buscar por número o cliente..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input-field" style={{ width: 'auto' }} value={docFilter} onChange={e => setDocFilter(e.target.value)}>
            {['Todos', 'Factura', 'Boleta', 'Sin Datos'].map(o => <option key={o} value={o}>{o === 'Sin Datos' ? 'Ticket' : o}</option>)}
          </select>
          <select className="input-field" style={{ width: 'auto' }} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'].map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <input className="input-field" style={{ width: '90px' }} type="number" value={year} onChange={e => setYear(Number(e.target.value))} />
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', minWidth: '760px' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <th style={thStyle}>Tipo</th>
              <th style={thStyle}>Serie-Número</th>
              <th style={thStyle}>Cliente</th>
              <th style={thStyle}>Fecha</th>
              <th style={thStyle}>Base</th>
              <th style={thStyle}>IGV</th>
              <th style={thStyle}>Total</th>
              <th style={thStyle}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>No hay comprobantes en este periodo.</td></tr>
            ) : filtered.map(s => {
              const { base, igv } = splitIGV(s.total_amount);
              return (
                <tr key={s.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                  <td style={{ ...tdStyle, fontWeight: 600, color: s.document_type === 'Factura' ? '#16A34A' : '#3B82F6' }}>{s.document_type === 'Sin Datos' ? 'Ticket' : s.document_type}</td>
                  <td style={tdStyle}>{s.invoice_number}</td>
                  <td style={tdStyle}>{s.customer_name}</td>
                  <td style={tdStyle}>{new Date(s.created_at).toLocaleDateString('es-PE')}</td>
                  <td style={tdStyle}>{formatMoney(base, currency)}</td>
                  <td style={tdStyle}>{formatMoney(igv, currency)}</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{formatMoney(s.total_amount, currency)}</td>
                  <td style={tdStyle}><Badge tone="success">Aceptado</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle = { padding: '8px 6px' };
const tdStyle = { padding: '10px 6px' };
const btnStyle = {
  display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '8px',
  border: '1px solid var(--border-color)', backgroundColor: '#FFF', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
};
