import { useState, useEffect } from 'react';
import { Download, Printer, TrendingUp, DollarSign, ShoppingBag, Eye, AlertTriangle, FileText, CheckCircle, Receipt } from 'lucide-react';
import { DataService, subscribeToRealtime } from '../../services/dataService';

export default function Reports() {
  const loggedInUserRaw = localStorage.getItem('admin_user');
  const currentUser = loggedInUserRaw ? JSON.parse(loggedInUserRaw) : { name: 'Admin Principal', role: 'admin' };

  // Solo admin y viewer pueden ver reportes
  if (currentUser.role === 'employee') {
    return <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>Acceso restringido. Contacta al administrador.</div>;
  }

  const [sales, setSales] = useState([]);
  const [saleItems, setSaleItems] = useState([]);
  const [products, setProducts] = useState([]);
  
  // Períodos de filtro
  const [period, setPeriod] = useState('month'); // 'day', 'week', 'month', 'year'

  // Modal para detalle y factura SUNAT
  const [selectedSale, setSelectedSale] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [msg, setMsg] = useState('');

  const loadData = async () => {
    const s = await DataService.getSales();
    setSales(s);

    const items = await DataService.getSaleItems();
    setSaleItems(items);

    const prods = await DataService.getProducts();
    setProducts(prods);
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToRealtime(() => {
      loadData();
    });
    return () => unsubscribe();
  }, []);

  const formatNoRound = (num) => {
    if (num === undefined || num === null || isNaN(num)) return '0.00';
    const factor = 100;
    const truncated = Math.trunc(num * factor) / factor;
    const parts = truncated.toString().split('.');
    if (parts.length === 1) {
      return parts[0] + '.00';
    }
    if (parts[1].length === 1) {
      return parts[0] + '.' + parts[1] + '0';
    }
    return parts[0] + '.' + parts[1].substring(0, 2);
  };

  const getFilteredSales = () => {
    const now = new Date();
    return sales.filter(sale => {
      const saleDate = new Date(sale.created_at);
      if (period === 'day') {
        return saleDate.toDateString() === now.toDateString();
      }
      if (period === 'week') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return saleDate >= oneWeekAgo;
      }
      if (period === 'month') {
        return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
      }
      if (period === 'year') {
        return saleDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  };

  const periodSales = getFilteredSales();

  // Calcular métricas (excluyendo ventas anuladas)
  const activeSales = periodSales.filter(s => s.status !== 'voided');
  const totalRevenue = activeSales.reduce((sum, s) => sum + s.total_amount, 0);
  const totalDiscounts = activeSales.reduce((sum, s) => sum + s.discount_amount, 0);
  
  const getTopProducts = () => {
    const counts = {};
    activeSales.forEach(s => {
      const items = saleItems.filter(item => item.sale_id === s.id);
      items.forEach(item => {
        counts[item.product_id] = (counts[item.product_id] || 0) + item.quantity;
      });
    });

    return Object.keys(counts).map(pId => {
      const prod = products.find(p => p.id === pId);
      return {
        name: prod ? prod.name : 'Polo descatalogado',
        sku: prod ? prod.sku : 'N/A',
        qty: counts[pId],
        revenue: counts[pId] * (prod ? (prod.offer_price || prod.price) : 0)
      };
    }).sort((a, b) => b.qty - a.qty).slice(0, 5);
  };

  const topProducts = getTopProducts();

  // Anulación de venta
  const handleVoidSale = async (saleId) => {
    if (window.confirm('¿Seguro que deseas ANULAR esta venta? Esto restaurará el inventario de polos y emitirá una nota correctiva en la caja registradora activa.')) {
      await DataService.voidSale(saleId, currentUser.name);
      setMsg('Venta anulada con éxito. Caja e Inventario actualizados.');
      setTimeout(() => setMsg(''), 3000);
      loadData();
    }
  };

  // Exportar CSV
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Nro Comprobante,Cliente,Atendido por,Metodo Pago,Fecha,Hora,Tipo,Descuento,Total,Estado\r\n';

    periodSales.forEach(s => {
      const d = new Date(s.created_at);
      const fecha = d.toLocaleDateString("es-PE");
      const hora = d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: true });
      const row = `"${s.invoice_number}","${s.customer_name}","${s.operator || "—"}","${s.payment_method}","${fecha}","${hora}","${s.type}",S/. ${formatNoRound(s.discount_amount)},S/. ${formatNoRound(s.total_amount)},"${s.status}"`;
      csvContent += row + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Ventas_${period.toUpperCase()}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openInvoice = (sale) => {
    setSelectedSale(sale);
    setShowInvoiceModal(true);
    setShowTicketModal(false);
  };

  const openTicket = (sale) => {
    setSelectedSale(sale);
    setShowTicketModal(true);
    setShowInvoiceModal(false);
  };

  // Obtener items de una venta
  const getItemsForSale = (saleId) => saleItems.filter(item => item.sale_id === saleId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Selector de Rango */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', border: '1px solid var(--border-color)', backgroundColor: '#FFF' }}>
          {[
            { label: 'Hoy', value: 'day' },
            { label: 'Semana', value: 'week' },
            { label: 'Mes', value: 'month' },
            { label: 'Año', value: 'year' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              style={{
                padding: '8px 16px',
                border: 'none',
                backgroundColor: period === opt.value ? 'var(--text-primary)' : '#FFF',
                color: period === opt.value ? '#FFF' : 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleExportCSV} className="btn-secondary" style={{ display: 'flex', gap: '8px', padding: '8px 16px', fontSize: '13px', borderRadius: '0px' }}>
            <Download size={14} /> Exportar Excel
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ padding: '12px 16px', border: '1px solid #DEF7EC', backgroundColor: '#F3FBF7', color: '#03543F', fontSize: '13px' }}>
          {msg}
        </div>
      )}

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Ventas Activas</span>
          <span style={{ fontSize: '28px', fontWeight: 600 }}>{activeSales.length}</span>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Excluye anuladas</span>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Ingresos Neto</span>
          <span style={{ fontSize: '28px', fontWeight: 600 }}>S/. {formatNoRound(totalRevenue)}</span>
          <span style={{ fontSize: '11px', color: 'green' }}>Facturación real</span>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Descuentos</span>
          <span style={{ fontSize: '28px', fontWeight: 600, color: 'var(--color-secondary)' }}>S/. {formatNoRound(totalDiscounts)}</span>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Cupones aplicados</span>
        </div>
      </div>

      {/* DETALLES DE TRANSACCIONES */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.4fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Historial con opción de ver SUNAT, Ticket o Anular */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600 }}>
            Registro de Comprobantes emitidos

          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: '#FAFAFA' }}>
                  <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Nro Doc</th>
                  <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Cliente</th>
                  <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Atendido por</th>
                  <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Método Pago</th>
                  <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Fecha / Hora</th>
                  <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Total</th>
                  <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Estado</th>
                  <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', textAlign: 'right' }}>Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {periodSales.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Ninguna venta en este periodo.
                    </td>
                  </tr>
                ) : (
                  periodSales.map(s => {
                    const isVoided = s.status === 'voided';
                    const docType = s.document_type || 'Boleta';
                    const isTicket = docType === 'Sin Datos';
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: isVoided ? '#FFF5F5' : 'transparent' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 500 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span>{s.invoice_number}</span>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 400 }}>{docType}</span>
                          </div>
                        </td>
                        <td style={{ padding: '8px 12px' }}>{s.customer_name}</td>
                        <td style={{ padding: '8px 12px', fontSize: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.operator || '—'}</span>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{s.type === 'pos' ? 'POS' : 'Online'}</span>
                          </div>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '12px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 7px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: s.payment_method === 'Efectivo' ? '#F0FFF4' : s.payment_method === 'Yape' || s.payment_method === 'Plin' ? '#EBF5FF' : '#FFF8E7',
                            color: s.payment_method === 'Efectivo' ? '#276749' : s.payment_method === 'Yape' || s.payment_method === 'Plin' ? '#1a56db' : '#92400E',
                            border: `1px solid ${s.payment_method === 'Efectivo' ? '#9AE6B4' : s.payment_method === 'Yape' || s.payment_method === 'Plin' ? '#BFDBFE' : '#FCD34D'}`
                          }}>
                            {s.payment_method || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{new Date(s.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                            <span>{new Date(s.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                          </div>
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>S/. {formatNoRound(s.total_amount)}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '2px 6px',
                            backgroundColor: isVoided ? '#FDE8E8' : '#DEF7EC',
                            color: isVoided ? '#9B1C1C' : '#03543F'
                          }}>
                            {isVoided ? 'ANULADA' : 'EMITIDA'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            {/* Mostrar solo el comprobante que corresponde */}
                            {isTicket ? (
                              <button 
                                onClick={() => openTicket(s)}
                                style={{ 
                                  background: 'none', 
                                  border: '1px solid var(--border-color)', 
                                  cursor: 'pointer', 
                                  color: '#555',
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: '3px',
                                  padding: '3px 8px',
                                  fontSize: '11px',
                                  fontWeight: 500,
                                  backgroundColor: '#F9F9F9'
                                }}
                                title="Ver Ticket"
                              >
                                <Receipt size={12} /> Ticket
                              </button>
                            ) : (
                              <button 
                                onClick={() => openInvoice(s)}
                                style={{ 
                                  background: 'none', 
                                  border: '1px solid #1a56db', 
                                  cursor: 'pointer', 
                                  color: '#1a56db',
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: '3px',
                                  padding: '3px 8px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  backgroundColor: '#EBF5FF'
                                }}
                                title={`Ver ${docType} SUNAT`}
                              >
                                <FileText size={12} /> {docType}
                              </button>
                            )}
                            {!isVoided && (
                              <button 
                                onClick={() => handleVoidSale(s.id)}
                                style={{ 
                                  background: 'none', 
                                  border: '1px solid #e02424', 
                                  cursor: 'pointer', 
                                  color: '#e02424',
                                  padding: '3px 8px',
                                  fontSize: '11px',
                                  fontWeight: 500,
                                  backgroundColor: '#FFF5F5'
                                }}
                                title="Anular venta y reponer stock"
                              >
                                Anular
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* TOP PRODUCTOS */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Top de Ventas</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {topProducts.map((tp, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid var(--border-color)', backgroundColor: '#FFF' }}>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginRight: '8px' }}>#{idx + 1}</span>
                  <strong style={{ fontSize: '13px' }}>{tp.name}</strong>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)' }}>SKU: {tp.sku}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{tp.qty} uds</span>
                  <span style={{ display: 'block', fontSize: '11px', color: 'green' }}>S/. {formatNoRound(tp.revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* =====================================================
          MODAL 1: TICKET NORMAL (Estilo Térmico / Recibo Simple)
          ===================================================== */}
      {showTicketModal && selectedSale && (() => {
        const items = getItemsForSale(selectedSale.id);
        const saleDate = new Date(selectedSale.created_at);
        
        return (
          <div className="ticket-print-container" style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <div style={{
              backgroundColor: '#FFF',
              width: '320px',
              maxHeight: '90vh',
              overflowY: 'auto',
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: '12px',
              padding: '24px 20px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              border: '1px dashed #ccc'
            }}>
              {/* Cabecera Ticket */}
              <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '0.05em' }}>CARRILLO STORE</div>
                <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>Av. Larco 123, Miraflores</div>
                <div style={{ fontSize: '10px', color: '#666' }}>Lima - Perú</div>
                <div style={{ fontSize: '10px', color: '#666' }}>Tel: +51 987 654 321</div>
              </div>

              {/* Línea divisoria */}
              <div style={{ borderTop: '1px dashed #333', margin: '8px 0' }} />

              {/* Info del ticket */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>TICKET:</span>
                  <span style={{ fontWeight: 700 }}>{selectedSale.invoice_number}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>FECHA:</span>
                  <span>{saleDate.toLocaleDateString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>HORA:</span>
                  <span>{saleDate.toLocaleTimeString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>CLIENTE:</span>
                  <span>{selectedSale.customer_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>PAGO:</span>
                  <span>{selectedSale.payment_method}</span>
                </div>
              </div>

              {/* Línea divisoria */}
              <div style={{ borderTop: '1px dashed #333', margin: '8px 0' }} />

              {/* Header de items */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: '4px', fontSize: '11px' }}>
                <span style={{ flex: 2 }}>PRODUCTO</span>
                <span style={{ flex: 0.5, textAlign: 'center' }}>CTD</span>
                <span style={{ flex: 1, textAlign: 'right' }}>P.U.</span>
                <span style={{ flex: 1, textAlign: 'right' }}>TOTAL</span>
              </div>

              <div style={{ borderTop: '1px solid #ddd', margin: '2px 0 4px 0' }} />

              {/* Items del ticket */}
              {items.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px' }}>
                  <span style={{ flex: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product_name}</span>
                  <span style={{ flex: 0.5, textAlign: 'center' }}>{item.quantity}</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>{formatNoRound(item.unit_price)}</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>{formatNoRound(item.total_price)}</span>
                </div>
              ))}

              {/* Línea divisoria */}
              <div style={{ borderTop: '1px dashed #333', margin: '8px 0' }} />

              {/* Totales */}
              <div style={{ marginBottom: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>SUBTOTAL:</span>
                  <span>S/. {formatNoRound(selectedSale.total_amount + selectedSale.discount_amount)}</span>
                </div>
                {selectedSale.discount_amount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e02424' }}>
                    <span>DESCUENTO:</span>
                    <span>- S/. {formatNoRound(selectedSale.discount_amount)}</span>
                  </div>
                )}
                <div style={{ borderTop: '1px solid #333', margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '15px' }}>
                  <span>TOTAL:</span>
                  <span>S/. {formatNoRound(selectedSale.total_amount)}</span>
                </div>
              </div>

              {/* Línea divisoria */}
              <div style={{ borderTop: '1px dashed #333', margin: '8px 0' }} />

              {/* Pie de ticket */}
              <div style={{ textAlign: 'center', fontSize: '10px', color: '#666' }}>
                <div>¡Gracias por tu compra!</div>
                <div>Cambios hasta 7 días con ticket</div>
                <div style={{ marginTop: '6px' }}>www.carrillostore.com</div>
              </div>

              {/* Línea divisoria */}
              <div style={{ borderTop: '1px dashed #333', margin: '12px 0' }} />

              {/* Estado */}
              {selectedSale.status === 'voided' && (
                <div style={{ textAlign: 'center', fontWeight: 700, color: '#e02424', fontSize: '14px', border: '2px solid #e02424', padding: '6px', margin: '8px 0' }}>
                  *** ANULADO ***
                </div>
              )}

              {/* Botones de acción */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px', fontFamily: 'inherit' }}>
                <button 
                  onClick={() => window.print()}
                  className="btn-primary" 
                  style={{ flex: 1, display: 'flex', gap: '6px', justifyContent: 'center', borderRadius: '0px', fontSize: '12px', fontFamily: 'inherit', padding: '10px' }}
                >
                  <Printer size={14} /> Imprimir
                </button>
                <button 
                  onClick={() => { setShowTicketModal(false); setSelectedSale(null); }}
                  className="btn-secondary" 
                  style={{ flex: 1, borderRadius: '0px', fontSize: '12px', fontFamily: 'inherit', padding: '10px' }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}


      {/* =====================================================
          MODAL 2: COMPROBANTE SUNAT (Boleta/Factura Electrónica)
          Con desglose tributario IGV 18% por producto
          ===================================================== */}
      {showInvoiceModal && selectedSale && (() => {
        const items = getItemsForSale(selectedSale.id);
        const saleDate = new Date(selectedSale.created_at);
        
        // Cálculo de impuestos SUNAT:
        // El precio de venta ya incluye IGV (18%).
        // Para cada producto: Valor Venta (base) = Precio Venta / 1.18
        // IGV por producto = Precio Venta - Valor Venta
        // Luego se suma todo para los totales

        const itemsWithTax = items.map(item => {
          const precioVentaUnitario = item.unit_price;
          // Base sin IGV (truncada a 2 decimales)
          const valorVentaUnitario = Math.trunc((precioVentaUnitario / 1.18) * 100) / 100;
          // IGV unitario = exactamente el 18% del valor unitario truncado (también truncado a 2 decimales)
          const igvUnitario = Math.trunc((valorVentaUnitario * 0.18) * 100) / 100;
          
          const totalBase = valorVentaUnitario * item.quantity;
          const totalIgv = igvUnitario * item.quantity;
          const totalConIgv = totalBase + totalIgv;

          const prod = products.find(p => p.id === item.product_id);
          const sku = prod ? prod.sku : 'N/A';

          return {
            ...item,
            valorVentaUnitario,
            igvUnitario,
            totalBase,
            totalIgv,
            totalConIgv,
            sku
          };
        });

        const totalBaseGravada = itemsWithTax.reduce((sum, i) => sum + i.totalBase, 0);
        const totalIGV = itemsWithTax.reduce((sum, i) => sum + i.totalIgv, 0);
        const descuento = selectedSale.discount_amount;
        const totalImporte = totalBaseGravada + totalIGV - descuento;

        return (
          <div className="invoice-print-container" style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <div style={{
              backgroundColor: '#FFF',
              padding: '32px',
              border: '2px solid #1a1a2e',
              maxWidth: '580px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
              fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
            }}>
              
              {/* === CABECERA SUNAT: Datos del Emisor === */}
              <div style={{ 
                display: 'flex', 
                gap: '20px', 
                paddingBottom: '16px', 
                borderBottom: '2px solid #1a1a2e',
                marginBottom: '16px'
              }}>
                {/* Logo / Nombre Empresa */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#1a1a2e', letterSpacing: '0.03em' }}>
                    CARRILLO STORE S.A.C.
                  </div>
                  <div style={{ fontSize: '11px', color: '#555', marginTop: '4px', lineHeight: 1.5 }}>
                    Av. Larco 123, Miraflores<br />
                    Lima - Lima - Perú<br />
                    Tel: +51 987 654 321<br />
                    Email: ventas@carrillostore.com
                  </div>
                </div>

                {/* Cuadro del Comprobante */}
                <div style={{ 
                  border: '2px solid #c0392b', 
                  padding: '12px 16px', 
                  textAlign: 'center',
                  minWidth: '200px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: '4px'
                }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: '#c0392b', letterSpacing: '0.05em' }}>
                    R.U.C. N° 20601234567
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#c0392b' }}>
                    {selectedSale.invoice_number.startsWith('FFF1') ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA'}
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#c0392b' }}>
                    N° {selectedSale.invoice_number}
                  </div>
                </div>
              </div>

              {/* === DATOS DEL ADQUIRIENTE === */}
              <div style={{ 
                border: '1px solid #ddd', 
                padding: '12px 14px', 
                fontSize: '12px', 
                marginBottom: '16px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '6px 20px',
                backgroundColor: '#FAFAFA'
              }}>
                <div><strong>Adquiriente:</strong> {selectedSale.customer_name}</div>
                <div><strong>Doc. Identidad:</strong> {selectedSale.customer_document}</div>
                <div><strong>Fecha de Emisión:</strong> {saleDate.toLocaleDateString()}</div>
                <div><strong>Hora:</strong> {saleDate.toLocaleTimeString()}</div>
                <div><strong>Moneda:</strong> SOLES (PEN)</div>
                <div><strong>Forma de Pago:</strong> {selectedSale.payment_method}</div>
              </div>

              {/* === TABLA DE ITEMS CON DESGLOSE IGV === */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left', marginBottom: '16px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1a1a2e', color: '#FFF' }}>
                    <th style={{ padding: '8px 6px', fontWeight: 600 }}>Cantidad</th>
                    <th style={{ padding: '8px 6px', fontWeight: 600 }}>Unidad Medida</th>
                    <th style={{ padding: '8px 6px', fontWeight: 600 }}>Código</th>
                    <th style={{ padding: '8px 6px', fontWeight: 600 }}>Descripción</th>
                    <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600 }}>Valor Unitario</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsWithTax.map((item, idx) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #eee', backgroundColor: idx % 2 === 0 ? '#FFF' : '#F9F9FB' }}>
                      <td style={{ padding: '8px 6px' }}>{item.quantity}</td>
                      <td style={{ padding: '8px 6px' }}>NIU</td>
                      <td style={{ padding: '8px 6px' }}>{item.sku}</td>
                      <td style={{ padding: '8px 6px' }}>{item.product_name}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right' }}>S/. {formatNoRound(item.valorVentaUnitario)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* === RESUMEN TRIBUTARIO === */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-end',
                marginBottom: '16px'
              }}>
                <div style={{ 
                  width: '280px', 
                  border: '1px solid #ddd',
                  fontSize: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #eee' }}>
                    <span>Op. Gravada (Base):</span>
                    <span>S/. {formatNoRound(totalBaseGravada)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #eee', color: '#c0392b', fontWeight: 600 }}>
                    <span>I.G.V. (18%):</span>
                    <span>S/. {formatNoRound(totalIGV)}</span>
                  </div>
                  {descuento > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #eee', color: '#e67e22' }}>
                      <span>Descuento:</span>
                      <span>- S/. {formatNoRound(descuento)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', fontWeight: 700, fontSize: '15px', backgroundColor: '#1a1a2e', color: '#FFF' }}>
                    <span>IMPORTE TOTAL:</span>
                    <span>S/. {formatNoRound(totalImporte)}</span>
                  </div>
                </div>
              </div>

              {/* === ESTADO DEL COMPROBANTE === */}
              <div style={{ 
                textAlign: 'center', 
                padding: '8px',
                marginBottom: '12px',
                border: `2px solid ${selectedSale.status === 'voided' ? '#e02424' : '#059669'}`,
                color: selectedSale.status === 'voided' ? '#e02424' : '#059669',
                fontWeight: 700,
                fontSize: '13px',
                letterSpacing: '0.05em'
              }}>
                {selectedSale.status === 'voided' ? '✗ COMPROBANTE ANULADO' : '✓ ACEPTADA POR SUNAT'}
              </div>

              {/* === QR + Pie legal === */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderTop: '1px solid #ddd', paddingTop: '14px', marginBottom: '16px' }}>
                {/* QR Mock SVG */}
                <svg width="60" height="60" viewBox="0 0 100 100" fill="none" stroke="#111" strokeWidth="4">
                  <rect x="10" y="10" width="80" height="80" strokeWidth="2" />
                  <rect x="20" y="20" width="20" height="20" />
                  <rect x="60" y="20" width="20" height="20" />
                  <rect x="20" y="60" width="20" height="20" />
                  <line x1="50" y1="20" x2="50" y2="80" strokeWidth="2" strokeDasharray="4 4" />
                  <line x1="20" y1="50" x2="80" y2="50" strokeWidth="2" strokeDasharray="4 4" />
                </svg>
                <div style={{ fontSize: '9px', color: '#888', lineHeight: 1.5 }}>
                  Representación impresa de la {selectedSale.invoice_number.startsWith('FFF1') ? 'Factura' : 'Boleta de Venta'} Electrónica.
                  Consulte este comprobante en: <strong>carrillostore.com/consultas</strong><br />
                  Autorizado mediante resolución SUNAT N° 034-2020/SUNAT.<br />
                  Hash: {btoa(selectedSale.id).slice(0, 24)}
                </div>
              </div>

              {/* === Botones de Acción === */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => window.print()}
                  className="btn-primary" 
                  style={{ flex: 1, display: 'flex', gap: '8px', justifyContent: 'center', borderRadius: '0px', fontSize: '13px', padding: '12px' }}
                >
                  <Printer size={15} /> Imprimir Comprobante
                </button>
                <button 
                  onClick={() => { setShowInvoiceModal(false); setSelectedSale(null); }}
                  className="btn-secondary" 
                  style={{ flex: 1, borderRadius: '0px', fontSize: '13px', padding: '12px' }}
                >
                  Cerrar
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Estilos CSS de impresión específicos para ocultar el panel principal al imprimir el comprobante */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .invoice-print-container, .invoice-print-container *,
          .ticket-print-container, .ticket-print-container * {
            visibility: visible;
          }
          .invoice-print-container, .ticket-print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            background: #FFF;
          }
          .invoice-print-container button,
          .ticket-print-container button {
            display: none !important;
          }
        }
        @media (max-width: 768px) {
          .reports-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

    </div>
  );
}
