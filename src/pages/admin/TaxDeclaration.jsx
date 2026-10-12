import { useState, useEffect, useMemo } from 'react';
import { DataService, subscribeToRealtime } from '../../services/dataService';
import {
  FileText, Upload, Plus, DollarSign, Trash2, Search, Download, ArrowUpRight, ArrowDownRight, X, Info
} from 'lucide-react';
import { toast } from '../../utils/toast';

const STORAGE_KEY = 'arven_manual_tax_declarations';
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Formato con truncamiento a 2 decimales (sin redondeo), como en el cálculo original
const formatNoRound = (num) => {
  const n = Number(num);
  if (!Number.isFinite(n)) return '0.00';
  const truncated = Math.trunc(n * 100) / 100;
  return truncated.toFixed(2);
};
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const lc = (v) => String(v ?? '').toLowerCase();
const fmtDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-PE');
};
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayLocal = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD en hora local

const loadManual = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Registros manuales corruptos:', e);
    return [];
  }
};

const matches = (q, num, name) => !q || lc(num).includes(q) || lc(name).includes(q);

const inPeriod = (iso, month, year) => {
  const d = new Date(iso);
  return d.getMonth() === month && d.getFullYear() === year;
};

function StatCard({ label, value, sub, icon: Icon, tone }) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span className="stat-label">{label}</span>
        <span className="stat-icon" style={tone ? { background: `var(--color-${tone}-soft)`, color: `var(--color-${tone})` } : undefined}><Icon size={18} /></span>
      </div>
      <span className="stat-value">{value}</span>
      {sub && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{sub}</span>}
    </div>
  );
}

function Row({ label, value, strong, tone, dashed = true }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0',
      borderBottom: `1px ${dashed ? 'dashed' : 'solid'} var(--border-color)`,
      fontWeight: strong ? 600 : 400, color: tone ? `var(--color-${tone})` : undefined
    }}>
      <span style={{ color: tone ? undefined : 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

export default function TaxDeclaration() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [manualInvoices, setManualInvoices] = useState(loadManual);
  const [activeSubTab, setActiveSubTab] = useState('summary');

  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState('');

  // Formulario de registro manual
  const [showAddModal, setShowAddModal] = useState(false);
  const [entryType, setEntryType] = useState('purchase');
  const [docType, setDocType] = useState('Factura');
  const [docNumber, setDocNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientRuc, setClientRuc] = useState('');
  const [amountTotal, setAmountTotal] = useState('');
  const [dateStr, setDateStr] = useState(todayLocal);
  const [attachedFile, setAttachedFile] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let active = true;
    const load = () => DataService.getSales()
      .then(dbSales => {
        if (!active) return;
        setSales((dbSales || []).filter(s => s.status !== 'voided' && s.document_type !== 'Sin Datos'));
      })
      .catch(err => {
        console.error(err);
        if (active) toast.error('No se pudieron cargar las ventas.');
      })
      .finally(() => { if (active) setLoading(false); });

    load();
    const unsubscribe = subscribeToRealtime(load);
    return () => { active = false; unsubscribe(); };
  }, []);

  const saveManualInvoices = (updated) => {
    setManualInvoices(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
      toast.error('No se pudo guardar en este navegador.');
    }
  };

  const resetForm = () => {
    setEntryType('purchase');
    setDocType('Factura');
    setDocNumber('');
    setClientName('');
    setClientRuc('');
    setAmountTotal('');
    setDateStr(todayLocal());
    setAttachedFile('');
    setFormError('');
  };

  const closeModal = () => { setShowAddModal(false); resetForm(); };

  // Adjuntar PDF: se prellenan solo los datos que se pueden leer del NOMBRE del archivo
  // (tipo, serie-número y RUC). Antes se inventaban datos al azar (RUC y montos ficticios).
  const handlePdfUpload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const name = file.name;
    const lower = name.toLowerCase();
    const found = [];

    if (/factura|^f\w{3}[-_]/i.test(lower)) { setDocType('Factura'); found.push('tipo'); }
    else if (/boleta|^b\w{3}[-_]/i.test(lower)) { setDocType('Boleta'); found.push('tipo'); }

    const serie = name.match(/\b([FBE][A-Z0-9]{3})[-_ ]?(\d{1,8})\b/i);
    if (serie) { setDocNumber(`${serie[1].toUpperCase()}-${serie[2]}`); found.push('número'); }

    const ruc = name.match(/\b(10|15|17|20)\d{9}\b/);
    if (ruc) { setClientRuc(ruc[0]); found.push('RUC'); }

    setAttachedFile(name);
    if (found.length) toast.info(`Datos leídos del nombre del archivo: ${found.join(', ')}. Completa y verifica el resto.`);
    else toast.info('PDF adjuntado. Completa los datos del comprobante manualmente.');
  };

  const handleSaveManualEntry = (e) => {
    e.preventDefault();
    setFormError('');
    const amount = parseFloat(String(amountTotal).replace(',', '.'));
    const doc = clientRuc.trim();

    if (!docNumber.trim() || !clientName.trim()) { setFormError('Completa el número de comprobante y el nombre.'); return; }
    if (!Number.isFinite(amount) || amount <= 0) { setFormError('El monto total debe ser un número mayor a 0.'); return; }
    if (docType === 'Factura' && !/^\d{11}$/.test(doc)) { setFormError('Una factura requiere un RUC de 11 dígitos.'); return; }
    if (doc && !/^\d{8}$|^\d{11}$/.test(doc)) { setFormError('El documento debe tener 8 (DNI) u 11 (RUC) dígitos.'); return; }
    if (!dateStr) { setFormError('Indica la fecha de emisión.'); return; }

    const number = docNumber.trim().toUpperCase();
    const duplicate = manualInvoices.some(m => m.entryType === entryType && lc(m.invoiceNumber) === lc(number) && (m.customerDocument || '') === doc);
    if (duplicate && !window.confirm('Ya existe un comprobante con ese número y documento. ¿Registrarlo de todas formas?')) return;

    const newEntry = {
      id: `tax-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      entryType,
      documentType: docType,
      invoiceNumber: number,
      customerName: clientName.trim(),
      customerDocument: doc,
      totalAmount: Math.round(amount * 100) / 100,
      createdAt: new Date(`${dateStr}T12:00:00`).toISOString(),
      isManual: true,
      ...(attachedFile ? { attachmentName: attachedFile } : {})
    };

    saveManualInvoices([newEntry, ...manualInvoices]);
    closeModal();
    toast.success('Comprobante registrado');

    // Si el comprobante es de otro periodo, llevar la vista a ese mes para que el usuario lo vea
    const d = new Date(newEntry.createdAt);
    if (d.getMonth() !== selectedMonth || d.getFullYear() !== selectedYear) {
      setSelectedMonth(d.getMonth());
      setSelectedYear(d.getFullYear());
    }
  };

  const handleDeleteManual = (id) => {
    if (!window.confirm('¿Deseas eliminar este comprobante de la declaración?')) return;
    saveManualInvoices(manualInvoices.filter(item => item.id !== id));
    toast.success('Comprobante eliminado');
  };

  // ---------- Filtros y cálculos ----------
  const q = searchQuery.trim().toLowerCase();

  const filteredPurchases = useMemo(() => manualInvoices
    .filter(p => p.entryType === 'purchase' && inPeriod(p.createdAt, selectedMonth, selectedYear) && matches(q, p.invoiceNumber, p.customerName))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  [manualInvoices, selectedMonth, selectedYear, q]);

  const totalSalesList = useMemo(() => {
    const dbMapped = sales
      .filter(s => inPeriod(s.created_at, selectedMonth, selectedYear) && matches(q, s.invoice_number, s.customer_name))
      .map(s => ({
        id: s.id,
        documentType: s.document_type || 'Boleta',
        invoiceNumber: s.invoice_number || '—',
        customerName: s.customer_name || 'Cliente varios',
        customerDocument: s.customer_document || '—',
        totalAmount: toNum(s.total_amount), // Supabase puede devolver numeric como string
        createdAt: s.created_at,
        isManual: false
      }));
    const manualSales = manualInvoices.filter(p => p.entryType === 'sale' && inPeriod(p.createdAt, selectedMonth, selectedYear) && matches(q, p.invoiceNumber, p.customerName));
    return [...dbMapped, ...manualSales].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [sales, manualInvoices, selectedMonth, selectedYear, q]);

  const summary = useMemo(() => {
    const salesTotal = totalSalesList.reduce((s, x) => s + toNum(x.totalAmount), 0);
    const purchasesTotal = filteredPurchases.reduce((s, x) => s + toNum(x.totalAmount), 0);
    // IGV 18% (montos con IGV incluido)
    const salesBase = salesTotal / 1.18;
    const salesIgv = salesTotal - salesBase;
    const purchasesBase = purchasesTotal / 1.18;
    const purchasesIgv = purchasesTotal - purchasesBase;
    return { salesTotal, salesBase, salesIgv, purchasesTotal, purchasesBase, purchasesIgv, igvResult: salesIgv - purchasesIgv };
  }, [totalSalesList, filteredPurchases]);

  // Años disponibles: actual ± 2 y los presentes en los datos
  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear();
    const set = new Set([now - 2, now - 1, now, now + 1, selectedYear]);
    sales.forEach(s => { const y = new Date(s.created_at).getFullYear(); if (Number.isFinite(y)) set.add(y); });
    manualInvoices.forEach(m => { const y = new Date(m.createdAt).getFullYear(); if (Number.isFinite(y)) set.add(y); });
    return [...set].sort((a, b) => b - a);
  }, [sales, manualInvoices, selectedYear]);

  const handleExportExcel = () => {
    const money = (v) => `S/. ${formatNoRound(v)}`;
    const rowsOf = (list) => list.map(x => `
      <tr>
        <td>${fmtDate(x.createdAt)}</td>
        <td>${escapeHtml(x.documentType)}</td>
        <td>${escapeHtml(x.invoiceNumber)}</td>
        <td>${escapeHtml(x.customerName)}</td>
        <td>${escapeHtml(x.customerDocument)}</td>
        <td>${money(x.totalAmount)}</td>
      </tr>`).join('');

    const xls = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"/><style>
        table { border-collapse: collapse; }
        th { background-color: #111827; color: #ffffff; font-weight: bold; }
        td, th { border: 1px solid #dddddd; padding: 8px; text-align: left; }
        .accent { color: #4F46E5; font-weight: bold; }
      </style></head>
      <body>
      <h2>Reporte mensual declaración SUNAT</h2>
      <p>Periodo: ${MONTHS[selectedMonth]} ${selectedYear}</p>
      <h3>RESUMEN TRIBUTARIO</h3>
      <table>
        <tr><th>Concepto</th><th>Base gravada</th><th>IGV (18%)</th><th>Total</th></tr>
        <tr><td>Ventas declaradas</td><td>${money(summary.salesBase)}</td><td>${money(summary.salesIgv)}</td><td>${money(summary.salesTotal)}</td></tr>
        <tr><td>Compras declaradas</td><td>${money(summary.purchasesBase)}</td><td>${money(summary.purchasesIgv)}</td><td>${money(summary.purchasesTotal)}</td></tr>
        <tr class="accent"><td>IGV RESULTANTE ${summary.igvResult >= 0 ? 'A PAGAR' : '(SALDO A FAVOR)'}</td><td>—</td><td>—</td><td>${money(summary.igvResult)}</td></tr>
      </table>
      <h3>DETALLE DE COMPROBANTES DE VENTAS</h3>
      <table>
        <tr><th>Fecha</th><th>Tipo</th><th>Número</th><th>Adquiriente</th><th>Doc. identidad</th><th>Monto total</th></tr>
        ${rowsOf(totalSalesList)}
      </table>
      <h3>DETALLE DE COMPROBANTES DE COMPRAS</h3>
      <table>
        <tr><th>Fecha</th><th>Tipo</th><th>Número</th><th>Proveedor</th><th>RUC proveedor</th><th>Monto total</th></tr>
        ${rowsOf(filteredPurchases)}
      </table>
      </body></html>
    `;

    const blob = new Blob([xls], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Declaracion_SUNAT_${String(selectedMonth + 1).padStart(2, '0')}_${selectedYear}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('Excel exportado');
  };

  const docBadge = (type) => <span className={`badge ${type === 'Factura' ? 'badge-info' : 'badge-primary'}`}>{type}</span>;
  const numCell = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, whiteSpace: 'nowrap' };
  const recent = [
    ...totalSalesList.slice(0, 5).map(x => ({ ...x, kind: 'sale' })),
    ...filteredPurchases.slice(0, 5).map(x => ({ ...x, kind: 'purchase' }))
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1>Declaración SUNAT</h1>
          <p>Resumen mensual de IGV con ventas del sistema y compras registradas.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="input-field" value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value, 10))} style={{ width: 'auto' }} aria-label="Mes">
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select className="input-field" value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value, 10))} style={{ width: 'auto' }} aria-label="Año">
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button type="button" className="btn-secondary" onClick={handleExportExcel}><Download size={16} /> Exportar</button>
          <button type="button" className="btn-primary" onClick={() => { resetForm(); setShowAddModal(true); }}><Plus size={16} /> Registrar comprobante</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 16 }}>
        <StatCard label="Ventas del periodo" value={`S/. ${formatNoRound(summary.salesTotal)}`} sub={`IGV: S/. ${formatNoRound(summary.salesIgv)}`} icon={ArrowUpRight} tone="success" />
        <StatCard label="Compras facturadas" value={`S/. ${formatNoRound(summary.purchasesTotal)}`} sub={`IGV: S/. ${formatNoRound(summary.purchasesIgv)}`} icon={ArrowDownRight} tone="danger" />
        <StatCard label="IGV resultante" value={`S/. ${formatNoRound(summary.igvResult)}`}
          sub={summary.igvResult >= 0 ? 'Monto a pagar' : 'Saldo a favor'} icon={DollarSign} />
      </div>

      <div className="card" style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input type="search" className="input-field" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por N° de comprobante o nombre…" style={{ paddingLeft: 36 }} />
        </div>
        <div className="tabs">
          {[
            { id: 'summary', label: 'Resumen' },
            { id: 'sales', label: `Ventas (${totalSalesList.length})` },
            { id: 'purchases', label: `Compras (${filteredPurchases.length})` }
          ].map(tab => (
            <button key={tab.id} type="button" className={`tab${activeSubTab === tab.id ? ' active' : ''}`} onClick={() => setActiveSubTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card empty-state"><div className="spinner" /><p>Cargando comprobantes…</p></div>
      ) : (
        <>
          {activeSubTab === 'summary' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 16, alignItems: 'start' }}>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600 }}>Movimientos recientes del periodo</h3>
                {recent.length === 0 ? (
                  <div className="empty-state" style={{ padding: 24 }}>
                    <FileText size={32} style={{ opacity: 0.4 }} />
                    <h3>Sin movimientos</h3>
                    <p>No hay comprobantes en {MONTHS[selectedMonth]} {selectedYear}.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {recent.map(x => (
                      <div key={`${x.kind}-${x.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span className={`badge ${x.kind === 'sale' ? 'badge-success' : 'badge-danger'}`}>{x.kind === 'sale' ? 'Venta' : 'Compra'}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{x.documentType} · {fmtDate(x.createdAt)}</span>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {x.invoiceNumber} — {x.customerName}
                          </div>
                        </div>
                        <span style={numCell}>S/. {formatNoRound(x.totalAmount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Cálculo del IGV</h3>
                <Row label="Ventas brutas" value={`S/. ${formatNoRound(summary.salesTotal)}`} />
                <Row label="Base imponible ventas" value={`S/. ${formatNoRound(summary.salesBase)}`} />
                <Row label="IGV ventas (+)" value={`S/. ${formatNoRound(summary.salesIgv)}`} strong tone="success" dashed={false} />
                <div style={{ height: 8 }} />
                <Row label="Compras brutas" value={`S/. ${formatNoRound(summary.purchasesTotal)}`} />
                <Row label="Base imponible compras" value={`S/. ${formatNoRound(summary.purchasesBase)}`} />
                <Row label="IGV compras (−)" value={`S/. ${formatNoRound(summary.purchasesIgv)}`} strong tone="danger" dashed={false} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, padding: 12, borderRadius: 'var(--radius)', background: summary.igvResult >= 0 ? 'var(--bg-subtle)' : 'var(--color-success-soft)', fontWeight: 700, fontSize: 15 }}>
                  <span>{summary.igvResult >= 0 ? 'IGV a pagar' : 'Saldo a favor'}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>S/. {formatNoRound(Math.abs(summary.igvResult))}</span>
                </div>
                <p className="field-hint" style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 8 }}>
                  <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} /> Estimación referencial: asume que todos los montos incluyen IGV al 18%. Valida con tu contador antes de declarar.
                </p>
              </div>
            </div>
          )}

          {activeSubTab === 'sales' && (
            totalSalesList.length === 0 ? (
              <div className="card empty-state"><FileText size={32} style={{ opacity: 0.4 }} /><h3>Sin ventas</h3><p>No hay comprobantes de venta en este periodo.</p></div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr><th>Fecha</th><th>Tipo</th><th>Número</th><th>Adquiriente</th><th>Doc. identidad</th><th style={{ textAlign: 'right' }}>Monto total</th><th style={{ textAlign: 'right' }}>Acciones</th></tr>
                  </thead>
                  <tbody>
                    {totalSalesList.map(s => (
                      <tr key={`${s.isManual ? 'm' : 'db'}-${s.id}`}>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(s.createdAt)}</td>
                        <td>{docBadge(s.documentType)}{s.isManual && <span className="badge" style={{ marginLeft: 4 }}>Manual</span>}</td>
                        <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{s.invoiceNumber}</td>
                        <td>{s.customerName}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{s.customerDocument || '—'}</td>
                        <td style={numCell}>S/. {formatNoRound(s.totalAmount)}</td>
                        <td style={{ textAlign: 'right' }}>
                          {s.isManual && (
                            <button type="button" className="btn-ghost btn-icon" title="Eliminar registro manual" onClick={() => handleDeleteManual(s.id)} style={{ color: 'var(--color-danger)' }}>
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeSubTab === 'purchases' && (
            filteredPurchases.length === 0 ? (
              <div className="card empty-state">
                <FileText size={32} style={{ opacity: 0.4 }} />
                <h3>Sin compras registradas</h3>
                <p>Registra tus facturas de compra para descontar su IGV.</p>
                <button type="button" className="btn-primary" style={{ marginTop: 8 }} onClick={() => { resetForm(); setShowAddModal(true); }}><Plus size={16} /> Registrar compra</button>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr><th>Fecha</th><th>Tipo</th><th>Número</th><th>Proveedor</th><th>RUC proveedor</th><th style={{ textAlign: 'right' }}>Monto total</th><th style={{ textAlign: 'right' }}>Acciones</th></tr>
                  </thead>
                  <tbody>
                    {filteredPurchases.map(p => (
                      <tr key={p.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(p.createdAt)}</td>
                        <td>{docBadge(p.documentType)}</td>
                        <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{p.invoiceNumber}</td>
                        <td>{p.customerName}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{p.customerDocument || '—'}</td>
                        <td style={numCell}>S/. {formatNoRound(p.totalAmount)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button type="button" className="btn-ghost btn-icon" title="Eliminar" onClick={() => handleDeleteManual(p.id)} style={{ color: 'var(--color-danger)' }}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>Registrar comprobante</h3>
              <button type="button" className="btn-ghost btn-icon" onClick={closeModal} aria-label="Cerrar"><X size={18} /></button>
            </div>

            <label style={{ border: '2px dashed var(--border-strong)', borderRadius: 'var(--radius)', padding: 16, textAlign: 'center', marginBottom: 16, background: 'var(--bg-subtle)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input type="file" accept="application/pdf" onChange={handlePdfUpload} style={{ display: 'none' }} />
              <Upload size={20} style={{ color: 'var(--color-primary)' }} />
              <span style={{ fontSize: 14, fontWeight: 500 }}>{attachedFile ? attachedFile : 'Adjuntar factura o boleta en PDF'}</span>
              <span className="field-hint" style={{ marginTop: 0 }}>Se prellenan el tipo, número y RUC si aparecen en el nombre del archivo.</span>
            </label>

            {formError && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{formError}</div>}

            <form onSubmit={handleSaveManualEntry} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 12 }}>
                <div>
                  <label className="field-label">Tipo de registro</label>
                  <select className="input-field" value={entryType} onChange={e => setEntryType(e.target.value)}>
                    <option value="purchase">Compra (gasto con RUC)</option>
                    <option value="sale">Venta manual</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Comprobante</label>
                  <select className="input-field" value={docType} onChange={e => setDocType(e.target.value)}>
                    <option value="Factura">Factura</option>
                    <option value="Boleta">Boleta</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="field-label">Número de comprobante *</label>
                <input type="text" className="input-field" value={docNumber} onChange={e => setDocNumber(e.target.value)} placeholder="Ej. F001-0004523" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 12 }}>
                <div>
                  <label className="field-label">{entryType === 'purchase' ? 'RUC proveedor' : 'DNI/RUC adquiriente'}{docType === 'Factura' ? ' *' : ''}</label>
                  <input type="text" inputMode="numeric" maxLength={11} className="input-field" value={clientRuc}
                    onChange={e => setClientRuc(e.target.value.replace(/\D/g, ''))} placeholder="Ej. 20601234567" />
                </div>
                <div>
                  <label className="field-label">{entryType === 'purchase' ? 'Razón social proveedor *' : 'Nombre del cliente *'}</label>
                  <input type="text" className="input-field" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Ej. Textil Peruano S.A.C." />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 12 }}>
                <div>
                  <label className="field-label">Monto total con IGV (S/.) *</label>
                  <input type="number" inputMode="decimal" min="0.01" step="0.01" className="input-field" value={amountTotal}
                    onChange={e => setAmountTotal(e.target.value)} placeholder="0.00" style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }} />
                </div>
                <div>
                  <label className="field-label">Fecha de emisión *</label>
                  <input type="date" className="input-field" value={dateStr} onChange={e => setDateStr(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn-secondary" onClick={closeModal} style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Guardar registro</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
