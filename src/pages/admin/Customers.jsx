import { useState, useEffect, useMemo } from 'react';
import { Search, Mail, Phone, MapPin, FileText, Pencil, Trash2, UserPlus, Users, X, Loader2, ShoppingBag } from 'lucide-react';
import { DataService, subscribeToRealtime } from '../../services/dataService';
import { toast } from '../../utils/toast';

const EMPTY_CUST = { id: '', name: '', phone: '', email: '', document_number: '', address: '', document_type: 'DNI' };
const SPIN = { animation: 'spin 0.8s linear infinite' };

const money = (v) => (Number(v) || 0).toFixed(2);
const isVoided = (s) => s.status === 'voided';
const fmtDate = (d) => { const x = new Date(d); return isNaN(x) ? '—' : x.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }); };
const fmtDateTime = (d) => { const x = new Date(d); return isNaN(x) ? '—' : x.toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };

// DNI = 8 dígitos, RUC = 11 dígitos
function docTypeFor(num) {
  if (/^\d{8}$/.test(num)) return 'DNI';
  if (/^\d{11}$/.test(num)) return 'RUC';
  return null;
}

function validateCustomer(c, customers) {
  const errors = {};
  if (!c.name.trim()) errors.name = 'Ingresa el nombre del cliente.';
  const doc = c.document_number.trim();
  if (!doc) errors.document_number = 'Ingresa el DNI o RUC.';
  else if (!docTypeFor(doc)) errors.document_number = 'El DNI debe tener 8 dígitos y el RUC 11 dígitos.';
  else if (customers.some(x => x.id !== c.id && String(x.document_number || '').trim() === doc)) errors.document_number = 'Ya existe un cliente con este documento.';
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) errors.email = 'Correo no válido.';
  return errors;
}

// Formulario reutilizado para crear y editar (fuera del componente para no remontarse en cada render)
function CustomerForm({ value, onChange, errors, saving, onCancel, onSubmit, submitLabel }) {
  const set = (key) => (e) => {
    let v = e.target.value;
    if (key === 'document_number' || key === 'phone') v = v.replace(/\D/g, '');
    onChange({ ...value, [key]: v });
  };
  const detected = docTypeFor(value.document_number.trim());
  const errStyle = (k) => errors[k] ? { borderColor: 'var(--color-danger)' } : undefined;

  return (
    <form onSubmit={onSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <label className="field-label" htmlFor="cust-name">Nombre completo o razón social *</label>
        <input id="cust-name" className="input-field" style={errStyle('name')} placeholder="Ej. Juan Pérez" value={value.name} onChange={set('name')} autoFocus />
        {errors.name && <p className="field-hint" style={{ color: 'var(--color-danger)' }}>{errors.name}</p>}
      </div>
      <div>
        <label className="field-label" htmlFor="cust-doc">DNI / RUC *</label>
        <div style={{ position: 'relative' }}>
          <input id="cust-doc" className="input-field" style={{ ...errStyle('document_number'), paddingRight: '64px', fontVariantNumeric: 'tabular-nums' }}
            inputMode="numeric" maxLength={11} placeholder="8 dígitos (DNI) u 11 (RUC)" value={value.document_number} onChange={set('document_number')} />
          {detected && <span className="badge badge-primary" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)' }}>{detected}</span>}
        </div>
        {errors.document_number
          ? <p className="field-hint" style={{ color: 'var(--color-danger)' }}>{errors.document_number}</p>
          : <p className="field-hint">{value.document_number.length}/{value.document_number.length > 8 ? 11 : 8} dígitos</p>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
        <div>
          <label className="field-label" htmlFor="cust-phone">Teléfono</label>
          <input id="cust-phone" className="input-field" inputMode="tel" maxLength={15} placeholder="987654321" value={value.phone} onChange={set('phone')} />
        </div>
        <div>
          <label className="field-label" htmlFor="cust-email">Correo electrónico</label>
          <input id="cust-email" type="email" className="input-field" style={errStyle('email')} placeholder="juan@correo.com" value={value.email} onChange={set('email')} />
          {errors.email && <p className="field-hint" style={{ color: 'var(--color-danger)' }}>{errors.email}</p>}
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="cust-address">Dirección</label>
        <input id="cust-address" className="input-field" placeholder="Ej. Av. Larco 123, Miraflores" value={value.address} onChange={set('address')} />
      </div>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px', flexWrap: 'wrap' }}>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? <><Loader2 size={16} style={SPIN} /> Guardando...</> : submitLabel}
        </button>
      </div>
    </form>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', minWidth: 0 }}>
      <span style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-subtle)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={15} style={{ color: 'var(--text-secondary)' }} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{label}</div>
        <div style={{ fontSize: '14px', fontWeight: 500, wordBreak: 'break-word', color: value ? 'var(--text-primary)' : 'var(--text-muted)' }}>{value || 'No registrado'}</div>
      </div>
    </div>
  );
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  // Modal crear/editar
  const [modalMode, setModalMode] = useState(null); // null | 'create' | 'edit'
  const [formData, setFormData] = useState(EMPTY_CUST);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    try {
      const [custs, s] = await Promise.all([DataService.getCustomers(), DataService.getSales()]);
      setCustomers(custs || []);
      setSales(s || []);
    } catch (err) {
      console.error(err);
      toast.error('No se pudieron cargar los clientes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos
    loadData();
    const unsubscribe = subscribeToRealtime(() => loadData());
    return () => unsubscribe();
  }, []);

  // Estadísticas por cliente en una sola pasada (excluye ventas anuladas)
  const statsById = useMemo(() => {
    const map = {};
    sales.forEach(s => {
      if (!s.customer_id || isVoided(s)) return;
      const st = map[s.customer_id] || (map[s.customer_id] = { totalSpent: 0, purchaseCount: 0, last: null });
      st.totalSpent += Number(s.total_amount) || 0;
      st.purchaseCount += 1;
      if (!st.last || new Date(s.created_at) > new Date(st.last)) st.last = s.created_at;
    });
    return map;
  }, [sales]);
  const statsFor = (id) => statsById[id] || { totalSpent: 0, purchaseCount: 0, last: null };

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = !q ? customers : customers.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      String(c.document_number || '').includes(q) ||
      String(c.phone || '').includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
    return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' }));
  }, [customers, searchQuery]);

  const activeCustomer = customers.find(c => c.id === selectedCustomerId) || null;
  const activeCustomerSales = useMemo(() => (
    activeCustomer
      ? sales.filter(s => s.customer_id === activeCustomer.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      : []
  ), [sales, activeCustomer]);
  const activeStats = activeCustomer ? statsFor(activeCustomer.id) : null;

  // --- Acciones ---
  const openCreate = () => { setFormData(EMPTY_CUST); setFormErrors({}); setModalMode('create'); };
  const openEdit = (cust) => {
    setFormData({
      id: cust.id,
      name: cust.name || '',
      phone: cust.phone || '',
      email: cust.email || '',
      document_number: String(cust.document_number || ''),
      address: cust.address || '',
      document_type: cust.document_type || 'DNI'
    });
    setFormErrors({});
    setModalMode('edit');
  };
  const closeModal = () => { if (!saving) setModalMode(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const errors = validateCustomer(formData, customers);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const doc = formData.document_number.trim();
    const payload = {
      ...formData,
      name: formData.name.trim(),
      email: formData.email.trim(),
      address: formData.address.trim(),
      document_number: doc,
      document_type: docTypeFor(doc),
    };
    const isNew = modalMode === 'create';
    if (isNew) delete payload.id;

    setSaving(true);
    try {
      const saved = await DataService.saveCustomer(payload);
      setCustomers(list => isNew ? [...list, saved] : list.map(c => c.id === saved.id ? saved : c));
      if (isNew) setSelectedCustomerId(saved.id);
      setModalMode(null);
      toast.success(isNew ? 'Cliente registrado.' : 'Cliente actualizado.');
    } catch (err) {
      console.error(err);
      toast.error(err?.message || 'No se pudo guardar el cliente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cust) => {
    if (deleting) return;
    if (!window.confirm(`¿Eliminar al cliente "${cust.name}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    try {
      await DataService.deleteCustomer(cust.id);
      setCustomers(list => list.filter(c => c.id !== cust.id));
      setSelectedCustomerId(null);
      toast.success('Cliente eliminado.');
    } catch (err) {
      console.error(err);
      const msg = String(err?.message || '');
      toast.error(/foreign key|violates|referenc/i.test(msg)
        ? 'No se puede eliminar: el cliente tiene ventas registradas.'
        : (msg || 'No se pudo eliminar el cliente.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1>Clientes</h1>
          <p>{customers.length} cliente(s) registrados. Selecciona uno para ver su historial de compras.</p>
        </div>
        <button className="btn-primary" onClick={openCreate}><UserPlus size={16} /> Nuevo cliente</button>
      </div>

      <div className="customers-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1.9fr)', gap: '20px', alignItems: 'start' }}>

        {/* LISTADO */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" className="input-field" style={{ paddingLeft: '38px' }}
              placeholder="Buscar por nombre, DNI/RUC, teléfono..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '560px', overflowY: 'auto', margin: '0 -4px', padding: '0 4px' }}>
            {loading ? (
              [0, 1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '62px' }} />)
            ) : customers.length === 0 ? (
              <div className="empty-state" style={{ padding: '32px 12px' }}>
                <Users size={36} style={{ color: 'var(--text-muted)' }} />
                <h3>Aún no hay clientes</h3>
                <p style={{ fontSize: '13px' }}>Registra a tus clientes para llevar su historial de compras.</p>
                <button className="btn-secondary btn-sm" style={{ marginTop: '6px' }} onClick={openCreate}><UserPlus size={14} /> Registrar cliente</button>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="empty-state" style={{ padding: '32px 12px' }}>
                <Search size={32} style={{ color: 'var(--text-muted)' }} />
                <h3>Sin resultados</h3>
                <p style={{ fontSize: '13px' }}>No encontramos clientes con “{searchQuery}”.</p>
              </div>
            ) : filteredCustomers.map(c => {
              const stats = statsFor(c.id);
              const isSelected = selectedCustomerId === c.id;
              return (
                <button key={c.id} type="button" onClick={() => setSelectedCustomerId(isSelected ? null : c.id)} aria-pressed={isSelected}
                  style={{
                    textAlign: 'left', font: 'inherit', color: 'inherit', width: '100%',
                    padding: '12px', borderRadius: 'var(--radius)', cursor: 'pointer',
                    border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-color)'}`,
                    background: isSelected ? 'var(--color-primary-soft)' : 'var(--bg-card)',
                    transition: 'var(--transition-fast)'
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{c.document_number}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    <span>{stats.purchaseCount} compra(s)</span>
                    <span>S/. {money(stats.totalSpent)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* DETALLE */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {!activeCustomer ? (
            <div className="empty-state">
              <Users size={40} style={{ color: 'var(--text-muted)' }} />
              <h3>Selecciona un cliente</h3>
              <p style={{ fontSize: '14px' }}>Aquí verás sus datos de contacto, métricas y compras.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: '20px', fontWeight: 700, wordBreak: 'break-word' }}>{activeCustomer.name}</h3>
                  <span className="badge badge-primary" style={{ marginTop: '6px' }}>{activeCustomer.document_type || docTypeFor(String(activeCustomer.document_number || '')) || 'Doc.'} {activeCustomer.document_number}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn-secondary btn-sm" onClick={() => openEdit(activeCustomer)}><Pencil size={14} /> Editar</button>
                  <button className="btn-danger btn-sm" onClick={() => handleDelete(activeCustomer)} disabled={deleting}>
                    {deleting ? <Loader2 size={14} style={SPIN} /> : <Trash2 size={14} />} Eliminar
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <InfoRow icon={FileText} label="DNI / RUC" value={activeCustomer.document_number} />
                <InfoRow icon={Phone} label="Teléfono" value={activeCustomer.phone} />
                <InfoRow icon={Mail} label="Correo" value={activeCustomer.email} />
                <InfoRow icon={MapPin} label="Dirección" value={activeCustomer.address} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                <div className="stat-card" style={{ padding: '16px' }}>
                  <span className="stat-label">Total invertido</span>
                  <span className="stat-value" style={{ fontSize: '22px' }}>S/. {money(activeStats.totalSpent)}</span>
                </div>
                <div className="stat-card" style={{ padding: '16px' }}>
                  <span className="stat-label">Compras</span>
                  <span className="stat-value" style={{ fontSize: '22px' }}>{activeStats.purchaseCount}</span>
                </div>
                <div className="stat-card" style={{ padding: '16px' }}>
                  <span className="stat-label">Última compra</span>
                  <span className="stat-value" style={{ fontSize: '16px' }}>{activeStats.last ? fmtDate(activeStats.last) : 'Sin compras'}</span>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>Ventas del cliente</h4>
                {activeCustomerSales.length === 0 ? (
                  <div className="empty-state" style={{ padding: '28px 12px', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius)' }}>
                    <ShoppingBag size={28} style={{ color: 'var(--text-muted)' }} />
                    <p style={{ fontSize: '13px' }}>Este cliente aún no tiene compras registradas.</p>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Comprobante</th>
                          <th>Fecha</th>
                          <th>Pago</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeCustomerSales.map(sale => {
                          const voided = isVoided(sale);
                          return (
                            <tr key={sale.id} style={voided ? { opacity: 0.65 } : undefined}>
                              <td style={{ whiteSpace: 'nowrap' }}>
                                <div style={{ fontWeight: 600 }}>{sale.invoice_number || `#${String(sale.id).toUpperCase().slice(-5)}`}</div>
                                <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                                  {sale.document_type && sale.document_type !== 'Sin Datos' && <span className="badge" style={{ fontSize: '11px' }}>{sale.document_type}</span>}
                                  {voided && <span className="badge badge-danger" style={{ fontSize: '11px' }}>Anulado</span>}
                                </div>
                              </td>
                              <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: '13px' }}>{fmtDateTime(sale.created_at)}</td>
                              <td style={{ fontSize: '13px' }}>{sale.payment_method || '—'}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textDecoration: voided ? 'line-through' : 'none' }}>S/. {money(sale.total_amount)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* MODAL CREAR / EDITAR */}
      {modalMode && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={modalMode === 'create' ? 'Nuevo cliente' : 'Editar cliente'}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700 }}>{modalMode === 'create' ? 'Nuevo cliente' : 'Editar cliente'}</h3>
              <button type="button" className="btn-ghost btn-icon" onClick={closeModal} aria-label="Cerrar"><X size={18} /></button>
            </div>
            <CustomerForm
              value={formData}
              onChange={(v) => { setFormData(v); if (Object.keys(formErrors).length) setFormErrors({}); }}
              errors={formErrors}
              saving={saving}
              onCancel={closeModal}
              onSubmit={handleSubmit}
              submitLabel={modalMode === 'create' ? 'Registrar cliente' : 'Guardar cambios'}
            />
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 991px) {
          .customers-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
