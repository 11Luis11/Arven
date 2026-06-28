import { useState, useEffect } from 'react';
import { Search, Mail, Phone, MapPin, FileText, ShoppingBag } from 'lucide-react';
import { DataService, subscribeToRealtime } from '../../services/dataService';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  // Formulario de creación
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', phone: '', email: '', document_number: '', address: '' });
  const [msg, setMsg] = useState('');

  const loadData = async () => {
    const custs = await DataService.getCustomers();
    setCustomers(custs);

    const s = await DataService.getSales();
    setSales(s);
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToRealtime(() => {
      loadData();
    });
    return () => unsubscribe();
  }, []);

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!newCust.name || !newCust.document_number) return;
    const saved = await DataService.saveCustomer({
      ...newCust,
      document_type: 'DNI'
    });
    setCustomers([...customers, saved]);
    setShowAddForm(false);
    setNewCust({ name: '', phone: '', email: '', document_number: '', address: '' });
    setMsg('Cliente registrado exitosamente.');
    setTimeout(() => setMsg(''), 3000);
  };

  // Filtrado de clientes
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.document_number.includes(searchQuery)
  );

  const activeCustomer = customers.find(c => c.id === selectedCustomerId) || null;
  const activeCustomerSales = activeCustomer 
    ? sales.filter(s => s.customer_id === activeCustomer.id)
    : [];

  const getCustomerStats = (customerId) => {
    const custSales = sales.filter(s => s.customer_id === customerId);
    const totalSpent = custSales.reduce((sum, s) => sum + s.total_amount, 0);
    const lastSale = custSales.length > 0 ? custSales[0].created_at : null;
    return {
      totalSpent,
      purchaseCount: custSales.length,
      lastPurchaseDate: lastSale ? new Date(lastSale).toLocaleDateString() : 'Sin compras'
    };
  };

  return (
    <div className="customers-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '24px' }}>
      
      {/* LADO IZQUIERDO: SELECCIÓN Y BÚSQUEDA */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: 'fit-content' }}>
        
        {msg && (
          <div style={{
            padding: '10px 12px',
            backgroundColor: '#EBFBEE',
            color: '#2F855A',
            border: '1px solid #C6F6D5',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>✓</span> {msg}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Directorio de Clientes</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Selecciona un cliente para ver su historial completo</p>
          </div>
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              backgroundColor: showAddForm ? '#E2E8F0' : 'var(--text-primary)',
              color: showAddForm ? 'var(--text-primary)' : '#FFF',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            {showAddForm ? 'Cancelar' : 'Nuevo Cliente'}
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleCreateCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px', border: '1px solid var(--border-color)', backgroundColor: '#FAFAFA' }}>
            <strong style={{ fontSize: '12px', display: 'block' }}>Registrar Nuevo Cliente</strong>
            <div>
              <label style={{ display: 'block', fontSize: '10px', marginBottom: '2px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Nombre Completo</label>
              <input type="text" required placeholder="Ej. Juan Pérez" value={newCust.name} onChange={e => setNewCust({ ...newCust, name: e.target.value })} style={{ width: '100%', padding: '6px', fontSize: '12px', border: '1px solid var(--border-color)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '10px', marginBottom: '2px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>DNI / RUC</label>
              <input type="text" required placeholder="Ej. 10456789" value={newCust.document_number} onChange={e => setNewCust({ ...newCust, document_number: e.target.value })} style={{ width: '100%', padding: '6px', fontSize: '12px', border: '1px solid var(--border-color)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '10px', marginBottom: '2px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Teléfono</label>
              <input type="text" placeholder="Ej. 987654321" value={newCust.phone} onChange={e => setNewCust({ ...newCust, phone: e.target.value })} style={{ width: '100%', padding: '6px', fontSize: '12px', border: '1px solid var(--border-color)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '10px', marginBottom: '2px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Correo Electrónico</label>
              <input type="email" placeholder="Ej. juan@correo.com" value={newCust.email} onChange={e => setNewCust({ ...newCust, email: e.target.value })} style={{ width: '100%', padding: '6px', fontSize: '12px', border: '1px solid var(--border-color)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '10px', marginBottom: '2px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Dirección</label>
              <input type="text" placeholder="Ej. Av. Larco 123" value={newCust.address} onChange={e => setNewCust({ ...newCust, address: e.target.value })} style={{ width: '100%', padding: '6px', fontSize: '12px', border: '1px solid var(--border-color)' }} />
            </div>
            <button type="submit" style={{ width: '100%', padding: '8px', fontSize: '12px', backgroundColor: 'var(--text-primary)', color: '#FFF', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              Guardar Cliente
            </button>
          </form>
        )}

        {/* Buscador */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)' }} />
          <input 
            type="text"
            placeholder="Buscar por DNI o Nombre..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              border: '1px solid var(--border-color)',
              fontSize: '13px',
              outline: 'none'
            }}
          />
        </div>

        {/* Listado */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '450px', overflowY: 'auto' }}>
          {filteredCustomers.map(c => {
            const stats = getCustomerStats(c.id);
            const isSelected = selectedCustomerId === c.id;

            return (
              <div 
                key={c.id}
                onClick={() => setSelectedCustomerId(isSelected ? null : c.id)}
                style={{
                  padding: '12px',
                  border: '1px solid',
                  borderColor: isSelected ? 'var(--text-primary)' : 'var(--border-color)',
                  backgroundColor: isSelected ? '#FAFAFA' : '#FFF',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{c.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{c.document_number}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <span>Compras: {stats.purchaseCount}</span>
                  <span>Total Gastado: S/. {stats.totalSpent.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* LADO DERECHO: DETALLES E HISTORIAL */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {activeCustomer ? (
          <>
            {/* Info Ficha */}
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '16px' }}>Ficha de Cliente</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={16} style={{ color: 'var(--text-secondary)' }} />
                  <span>DNI/RUC: <strong>{activeCustomer.document_number}</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Phone size={16} style={{ color: 'var(--text-secondary)' }} />
                  <span>Teléfono: <strong>{activeCustomer.phone || 'No registrado'}</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Mail size={16} style={{ color: 'var(--text-secondary)' }} />
                  <span>Email: <strong>{activeCustomer.email || 'No registrado'}</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={16} style={{ color: 'var(--text-secondary)' }} />
                  <span>Dirección: <strong>{activeCustomer.address || 'No registrada'}</strong></span>
                </div>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

            {/* Métricas Acumuladas */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Historial Comercial</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', textAlign: 'center' }}>
                <div style={{ padding: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Total Invertido</span>
                  <span style={{ fontSize: '18px', fontWeight: 600 }}>S/. {getCustomerStats(activeCustomer.id).totalSpent.toFixed(2)}</span>
                </div>
                <div style={{ padding: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Número de Compras</span>
                  <span style={{ fontSize: '18px', fontWeight: 600 }}>{getCustomerStats(activeCustomer.id).purchaseCount}</span>
                </div>
                <div style={{ padding: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Última Compra</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, lineHeight: '22px' }}>{getCustomerStats(activeCustomer.id).lastPurchaseDate}</span>
                </div>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

            {/* Listado Boletas */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Ventas del Cliente</h4>
              {activeCustomerSales.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>El cliente aún no ha registrado transacciones.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeCustomerSales.map(sale => (
                    <div 
                      key={sale.id}
                      style={{
                        padding: '12px',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '13px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ShoppingBag size={14} style={{ color: 'var(--color-primary)' }} />
                        <div>
                          <span style={{ fontWeight: 500 }}>Venta #{sale.id.toUpperCase().slice(-5)}</span>
                          <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {new Date(sale.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 600 }}>S/. {sale.total_amount.toFixed(2)}</span>
                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)' }}>{sale.payment_method}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{
            height: '300px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            fontSize: '13px'
          }}>
            Selecciona un cliente de la lista para ver su perfil.
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 991px) {
          .customers-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
