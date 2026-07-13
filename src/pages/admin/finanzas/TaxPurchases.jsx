import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Download, Search, X, FileText, Receipt } from 'lucide-react';
import { DataService } from '../../../services/dataService';
import { getTaxConfig, getPurchases, savePurchase, deletePurchase, subscribeToPurchases } from '../../../utils/taxData';
import { formatMoney } from '../../../utils/taxRegimes';
import { Badge, KpiCard } from './shared';
import { downloadCsv } from '../../../utils/csv';

const emptyForm = { docType: 'Factura', series: '', providerName: '', providerRuc: '', date: new Date().toISOString().slice(0, 10), total: '', category: 'General' };

export default function TaxPurchases() {
  const [purchases, setPurchases] = useState([]);
  const [currency, setCurrency] = useState('PEN');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = () => setPurchases(getPurchases());

  useEffect(() => {
    load();
    DataService.getConfig().then(cfg => setCurrency(getTaxConfig(cfg).currency));
    const unsub = subscribeToPurchases(load);
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    return purchases.filter(p => !search || `${p.series} ${p.providerName} ${p.providerRuc}`.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [purchases, search]);

  const totals = filtered.reduce((acc, p) => { acc.total += p.total; acc.base += p.base; acc.igv += p.igv; return acc; }, { total: 0, base: 0, igv: 0 });

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.providerName.trim() || !form.total) return;
    savePurchase(form);
    setShowModal(false);
    setForm(emptyForm);
  };

  const exportCsv = () => {
    const header = 'Tipo,Serie,Proveedor,RUC,Fecha,Base Imponible,IGV,Total\n';
    const rows = filtered.map(p => `${p.docType},${p.series},"${p.providerName}",${p.providerRuc},${new Date(p.date).toLocaleDateString('es-PE')},${p.base.toFixed(2)},${p.igv.toFixed(2)},${p.total.toFixed(2)}`).join('\n');
    downloadCsv('compras.csv', header + rows);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Compras (Facturas y Boletas)</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>Registra los comprobantes de tus proveedores para calcular tu crédito fiscal.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={exportCsv} style={btnStyle}><Download size={14} /> Exportar</button>
          <button onClick={() => { setForm(emptyForm); setShowModal(true); }} style={{ ...btnStyle, backgroundColor: 'var(--text-primary)', color: '#FFF', border: 'none' }}>
            <Plus size={14} /> Registrar compra
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
        <KpiCard label="Total compras" value={formatMoney(totals.total, currency)} icon={Receipt} />
        <KpiCard label="Base imponible" value={formatMoney(totals.base, currency)} icon={FileText} />
        <KpiCard label="Crédito fiscal (IGV)" value={formatMoney(totals.igv, currency)} icon={FileText} tone="info" />
        <KpiCard label="Comprobantes" value={filtered.length} icon={Receipt} />
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowX: 'auto' }}>
        <div style={{ position: 'relative', maxWidth: '320px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input className="input-field" style={{ paddingLeft: '32px' }} placeholder="Buscar por proveedor, RUC o serie..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', minWidth: '760px' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <th style={thStyle}>Tipo</th>
              <th style={thStyle}>Serie</th>
              <th style={thStyle}>Proveedor</th>
              <th style={thStyle}>RUC</th>
              <th style={thStyle}>Fecha</th>
              <th style={thStyle}>Base</th>
              <th style={thStyle}>IGV</th>
              <th style={thStyle}>Total</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>Aún no registras compras. Usa "Registrar compra" para añadir tu primer comprobante.</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{p.docType}</td>
                <td style={tdStyle}>{p.series || '—'}</td>
                <td style={tdStyle}>{p.providerName}</td>
                <td style={tdStyle}>{p.providerRuc || '—'}</td>
                <td style={tdStyle}>{new Date(p.date).toLocaleDateString('es-PE')}</td>
                <td style={tdStyle}>{formatMoney(p.base, currency)}</td>
                <td style={tdStyle}>{formatMoney(p.igv, currency)}</td>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{formatMoney(p.total, currency)}</td>
                <td style={tdStyle}>
                  <button onClick={() => deletePurchase(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626' }}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <form onSubmit={handleSave} style={{ backgroundColor: '#FFF', width: '440px', maxWidth: '100%', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Registrar compra</h3>
              <button type="button" onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <select className="input-field" value={form.docType} onChange={e => setForm(f => ({ ...f, docType: e.target.value }))}>
                  <option value="Factura">Factura</option>
                  <option value="Boleta">Boleta</option>
                </select>
                <input className="input-field" placeholder="Serie-Número" value={form.series} onChange={e => setForm(f => ({ ...f, series: e.target.value }))} />
              </div>
              <input className="input-field" placeholder="Razón social del proveedor" value={form.providerName} onChange={e => setForm(f => ({ ...f, providerName: e.target.value }))} required />
              <input className="input-field" placeholder="RUC del proveedor" value={form.providerRuc} onChange={e => setForm(f => ({ ...f, providerRuc: e.target.value.replace(/\D/g, '').slice(0, 11) }))} />
              <div style={{ display: 'flex', gap: '10px' }}>
                <input className="input-field" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                <input className="input-field" type="number" step="0.01" min="0" placeholder="Total (incl. IGV)" value={form.total} onChange={e => setForm(f => ({ ...f, total: e.target.value }))} required />
              </div>
              <select className="input-field" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="General">Compra general</option>
                <option value="Mercadería">Mercadería / Insumos</option>
                <option value="Activo Fijo">Activo fijo</option>
                <option value="Servicios">Servicios</option>
              </select>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setShowModal(false)} style={btnStyle}>Cancelar</button>
              <button type="submit" style={{ ...btnStyle, backgroundColor: 'var(--text-primary)', color: '#FFF', border: 'none' }}>Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const thStyle = { padding: '8px 6px' };
const tdStyle = { padding: '10px 6px' };
const btnStyle = {
  display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '8px',
  border: '1px solid var(--border-color)', backgroundColor: '#FFF', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
};
