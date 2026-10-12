import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Download, Search, X, FileText, Receipt, Percent, Hash } from 'lucide-react';
import { DataService } from '../../../services/dataService';
import { getTaxConfig, getPurchases, savePurchase, deletePurchase, subscribeToPurchases, toNum } from '../../../utils/taxData';
import { formatMoney, formatDate, parseLocalDate, splitIGV, toLocalISODate } from '../../../utils/taxRegimes';
import { downloadCsv } from '../../../utils/csv';
import { toast } from '../../../utils/toast';
import { Badge, KpiCard, KpiGrid, SectionHeader, Field } from './shared';
import { csvRow, money2, num, numRight } from './helpers';

// Se genera en cada apertura para que la fecha por defecto sea la de hoy (hora local).
const makeEmptyForm = () => ({ docType: 'Factura', series: '', providerName: '', providerRuc: '', date: toLocalISODate(), total: '', category: 'General' });

export default function TaxPurchases() {
  const [purchases, setPurchases] = useState(getPurchases);
  const [currency, setCurrency] = useState('PEN');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(makeEmptyForm);

  useEffect(() => {
    DataService.getConfig()
      .then(cfg => setCurrency(getTaxConfig(cfg).currency))
      .catch(e => console.error(e));
    return subscribeToPurchases(() => setPurchases(getPurchases()));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return purchases
      .filter(p => !q || `${p.series} ${p.providerName} ${p.providerRuc}`.toLowerCase().includes(q))
      .sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date));
  }, [purchases, search]);

  const totals = filtered.reduce((acc, p) => {
    acc.total += toNum(p.total); acc.base += toNum(p.base); acc.igv += toNum(p.igv);
    return acc;
  }, { total: 0, base: 0, igv: 0 });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const preview = splitIGV(toNum(form.total));

  const openModal = () => { setForm(makeEmptyForm()); setShowModal(true); };

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.providerName.trim()) { toast.warning('Ingresa la razón social del proveedor.'); return; }
    if (!(toNum(form.total) > 0)) { toast.warning('El total debe ser mayor a 0.'); return; }
    try {
      savePurchase(form);
      toast.success('Compra registrada');
      setShowModal(false);
      setForm(makeEmptyForm());
    } catch (err) {
      console.error(err);
      toast.error('No se pudo guardar la compra (almacenamiento del navegador lleno o bloqueado).');
    }
  };

  const handleDelete = (p) => {
    if (!window.confirm(`¿Eliminar el comprobante ${p.series || ''} de ${p.providerName}? Esta acción no se puede deshacer.`)) return;
    try {
      deletePurchase(p.id);
      toast.success('Compra eliminada');
    } catch (err) {
      console.error(err);
      toast.error('No se pudo eliminar la compra.');
    }
  };

  const exportCsv = () => {
    if (filtered.length === 0) { toast.warning('No hay compras para exportar.'); return; }
    const header = 'Tipo,Serie,Proveedor,RUC,Fecha,Base Imponible,IGV,Total\n';
    const rows = filtered.map(p => csvRow([
      p.docType, p.series, p.providerName, p.providerRuc, formatDate(p.date), money2(p.base), money2(p.igv), money2(p.total),
    ])).join('\n');
    downloadCsv('compras.csv', header + rows);
    toast.success(`Exportadas ${filtered.length} compras`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <SectionHeader
        title="Compras (facturas y boletas)"
        subtitle="Registra los comprobantes de tus proveedores para calcular tu crédito fiscal."
        actions={<>
          <button type="button" className="btn-secondary" onClick={exportCsv}><Download size={15} /> Exportar</button>
          <button type="button" className="btn-primary" onClick={openModal}><Plus size={15} /> Registrar compra</button>
        </>}
      />

      <KpiGrid min={170}>
        <KpiCard label="Total compras" value={formatMoney(totals.total, currency)} icon={Receipt} />
        <KpiCard label="Base imponible" value={formatMoney(totals.base, currency)} icon={FileText} />
        <KpiCard label="Crédito fiscal (IGV)" value={formatMoney(totals.igv, currency)} icon={Percent} tone="info" />
        <KpiCard label="Comprobantes" value={filtered.length} icon={Hash} />
      </KpiGrid>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
        <div style={{ position: 'relative', maxWidth: '360px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input-field" style={{ paddingLeft: '36px' }} placeholder="Buscar por proveedor, RUC o serie..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="table-wrap">
          <table className="data-table" style={{ minWidth: '800px' }}>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Serie</th>
                <th>Proveedor</th>
                <th>RUC</th>
                <th>Fecha</th>
                <th style={{ textAlign: 'right' }}>Base</th>
                <th style={{ textAlign: 'right' }}>IGV</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ width: 56 }} aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 0 }}>
                    <div className="empty-state">
                      <FileText size={28} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
                      <h3>{search ? 'Sin resultados' : 'Aún no registras compras'}</h3>
                      <p style={{ fontSize: '13px', maxWidth: '380px' }}>
                        {search ? 'Prueba con otro proveedor, RUC o serie.' : 'Añade tus facturas de proveedores para descontar el IGV de compras (crédito fiscal).'}
                      </p>
                      {!search && <button type="button" className="btn-primary btn-sm" style={{ marginTop: '8px' }} onClick={openModal}><Plus size={14} /> Registrar compra</button>}
                    </div>
                  </td>
                </tr>
              ) : filtered.map(p => (
                <tr key={p.id}>
                  <td><Badge tone={p.docType === 'Factura' ? 'primary' : 'warning'}>{p.docType}</Badge></td>
                  <td style={num}>{p.series || '—'}</td>
                  <td style={{ fontWeight: 500 }}>{p.providerName}</td>
                  <td style={num}>{p.providerRuc || '—'}</td>
                  <td style={num}>{formatDate(p.date)}</td>
                  <td style={numRight}>{formatMoney(p.base, currency)}</td>
                  <td style={numRight}>{formatMoney(p.igv, currency)}</td>
                  <td style={{ ...numRight, fontWeight: 600 }}>{formatMoney(p.total, currency)}</td>
                  <td>
                    <button type="button" className="btn-ghost btn-icon" onClick={() => handleDelete(p)} aria-label="Eliminar compra" title="Eliminar" style={{ color: 'var(--color-danger)' }}>
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <form className="modal" onSubmit={handleSave} onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', padding: 0 }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700 }}>Registrar compra</h3>
              <button type="button" className="btn-ghost btn-icon" onClick={() => setShowModal(false)} aria-label="Cerrar"><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                <Field label="Tipo de comprobante">
                  <select className="input-field" value={form.docType} onChange={e => set('docType', e.target.value)}>
                    <option value="Factura">Factura</option>
                    <option value="Boleta">Boleta</option>
                  </select>
                </Field>
                <Field label="Serie-Número">
                  <input className="input-field" placeholder="F001-000123" value={form.series} onChange={e => set('series', e.target.value)} />
                </Field>
              </div>
              <Field label="Razón social del proveedor">
                <input className="input-field" placeholder="Ej. Distribuidora Lima SAC" value={form.providerName} onChange={e => set('providerName', e.target.value)} required autoFocus />
              </Field>
              <Field label="RUC del proveedor">
                <input className="input-field" inputMode="numeric" placeholder="20123456789" value={form.providerRuc} onChange={e => set('providerRuc', e.target.value.replace(/\D/g, '').slice(0, 11))} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                <Field label="Fecha de emisión">
                  <input className="input-field" type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
                </Field>
                <Field label="Total (incluye IGV)">
                  <input className="input-field" type="number" step="0.01" min="0.01" placeholder="0.00" value={form.total} onChange={e => set('total', e.target.value)} required />
                </Field>
              </div>
              <Field label="Categoría">
                <select className="input-field" value={form.category} onChange={e => set('category', e.target.value)}>
                  <option value="General">Compra general</option>
                  <option value="Mercadería">Mercadería / Insumos</option>
                  <option value="Activo Fijo">Activo fijo</option>
                  <option value="Servicios">Servicios</option>
                </select>
              </Field>
              {toNum(form.total) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', padding: '10px 12px', borderRadius: 'var(--radius)', background: 'var(--bg-subtle)', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                  <span>Base: <strong style={{ ...num, color: 'var(--text-primary)' }}>{formatMoney(preview.base, currency)}</strong></span>
                  <span>IGV (18%): <strong style={{ ...num, color: 'var(--text-primary)' }}>{formatMoney(preview.igv, currency)}</strong></span>
                </div>
              )}
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button type="submit" className="btn-primary">Guardar compra</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
