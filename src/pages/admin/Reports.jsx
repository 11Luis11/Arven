import React, { useState, useEffect } from 'react';
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
  const [config, setConfig] = useState(null);
  
  // Períodos de filtro
  const [period, setPeriod] = useState('month'); // 'day', 'week', 'month', 'year'

  // Modal para detalle y factura SUNAT
  const [selectedSale, setSelectedSale] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [msg, setMsg] = useState('');

  // Estados para cambios y devoluciones
  const [exchangeSale, setExchangeSale] = useState(null);
  const [exchangeItem, setExchangeItem] = useState(null);
  const [exchangeQty, setExchangeQty] = useState(1);
  const [replacementProductId, setReplacementProductId] = useState('');
  const [replacementColorHex, setReplacementColorHex] = useState('');
  const [replacementSize, setReplacementSize] = useState('');
  const [exchangeLoading, setExchangeLoading] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');

  const loadData = async () => {
    const s = await DataService.getSales();
    const uniqueSales = Array.from(new Map(s.map(item => [item.id, item])).values());
    setSales(uniqueSales);

    const items = await DataService.getSaleItems();
    const uniqueItems = Array.from(new Map(items.map(item => [item.id, item])).values());
    setSaleItems(uniqueItems);

    const prods = await DataService.getProducts();
    setProducts(prods);

    const cfg = await DataService.getConfig();
    setConfig(cfg);
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

  const handleShareWhatsApp = (sale, items, phone) => {
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 9 && cleanPhone.startsWith('9')) {
      cleanPhone = '51' + cleanPhone;
    }
    const storeName = config?.businessName || config?.storeName || 'ARVEN';
    const itemsText = items.map(item => `• ${item.quantity}x ${item.product_name} - S/. ${formatNoRound(item.total_price)}`).join('\n');
    const text = `🧾 *${storeName.toUpperCase()}*\n*${sale.document_type || 'Boleta'} N° ${sale.invoice_number}*\n\n📅 Fecha: ${new Date(sale.created_at).toLocaleDateString('es-PE')}\n👤 Cliente: ${sale.customer_name}\n💳 Pago: ${sale.payment_method}\n\n*Detalle de compra:*\n${itemsText}\n\n*Total: S/. ${formatNoRound(sale.total_amount)}*\n\n¡Gracias por tu preferencia! ¡Te esperamos pronto! 🤎`;
    const encodedMsg = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMsg}`, '_blank');
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
                    const isExchanged = s.status === 'exchanged';
                    const docType = s.document_type || 'Boleta';
                    const isTicket = docType === 'Sin Datos';

                    const items = getItemsForSale(s.id);
                    const selectedReplacementProduct = products.find(p => p.id === replacementProductId);
                    const replacementColors = selectedReplacementProduct?.colors || [];
                    const selectedRepColor = replacementColors.find(c => c.hex === replacementColorHex);
                    const replacementSizes = selectedReplacementProduct?.sizes || [];

                    return (
                      <React.Fragment key={s.id}>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: isVoided ? '#FFF5F5' : isExchanged ? '#F9F5FF' : 'transparent' }}>
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
                              backgroundColor: isVoided ? '#FDE8E8' : isExchanged ? '#F5F3FF' : '#DEF7EC',
                              color: isVoided ? '#9B1C1C' : isExchanged ? '#7C3AED' : '#03543F'
                            }}>
                              {isVoided ? 'ANULADA' : isExchanged ? 'CAMBIADA' : 'EMITIDA'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
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
                                    fontWeight: 600,
                                    backgroundColor: '#F3F4F6'
                                  }}
                                  title="Imprimir Ticket"
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
                                <>
                                  <button 
                                    onClick={() => {
                                      if (exchangeSale?.id === s.id) {
                                        setExchangeSale(null);
                                      } else {
                                        setExchangeSale(s);
                                        setExchangeItem(null);
                                        setExchangeQty(1);
                                        setReplacementProductId('');
                                        setReplacementColorHex('');
                                        setReplacementSize('');
                                      }
                                    }}
                                    style={{ 
                                      background: 'none', 
                                      border: '1px solid #7C3AED', 
                                      cursor: 'pointer', 
                                      color: exchangeSale?.id === s.id ? '#FFF' : '#7C3AED',
                                      padding: '3px 8px',
                                      fontSize: '11px',
                                      fontWeight: 500,
                                      backgroundColor: exchangeSale?.id === s.id ? '#7C3AED' : '#F5F3FF'
                                    }}
                                    title="Cambio de producto"
                                  >
                                    {exchangeSale?.id === s.id ? 'Cerrar' : 'Cambio'}
                                  </button>
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
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                        {exchangeSale?.id === s.id && (
                          <tr key={`${s.id}-exchange`}>
                            <td colSpan={8} style={{ padding: '24px', backgroundColor: '#F9F5FF', borderBottom: '2px solid #7C3AED' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '650px' }}>
                                <div>
                                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#7C3AED', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    ↻ CAMBIAR PRENDAS DE ESTA VENTA
                                  </h4>
                                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                    Selecciona una de las prendas vendidas, ingresa la cantidad a cambiar, y elige su reemplazo. El inventario y el total del comprobante se recalcularán automáticamente.
                                  </p>
                                </div>

                                {/* Paso 1: Seleccionar item a cambiar */}
                                <div>
                                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                    1. Selecciona el producto a devolver:
                                  </label>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {items.map(item => {
                                      const isExchangedItem = item.product_name.includes('[CAMBIO]') || item.product_name.includes('CAMBIO');
                                      return (
                                        <button
                                          key={item.id}
                                          type="button"
                                          onClick={() => {
                                            setExchangeItem(item);
                                            setExchangeQty(1);
                                          }}
                                          style={{
                                            padding: '12px 14px',
                                            border: exchangeItem?.id === item.id ? '2px solid #7C3AED' : '1px solid var(--border-color)',
                                            backgroundColor: exchangeItem?.id === item.id ? '#FFF' : '#F9FAFB',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            fontSize: '13px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            boxShadow: exchangeItem?.id === item.id ? '0 4px 12px rgba(124, 58, 237, 0.08)' : 'none',
                                            position: 'relative'
                                          }}
                                        >
                                          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                                            {item.quantity}x {item.product_name}
                                            {isExchangedItem && (
                                              <span style={{ marginLeft: '8px', fontSize: '10px', backgroundColor: '#EDE9FE', color: '#7C3AED', padding: '2px 6px', borderRadius: '12px', fontWeight: 600 }}>
                                                CAMBIADO
                                              </span>
                                            )}
                                          </span>
                                          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>S/. {formatNoRound(item.unit_price)} c/u</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {exchangeItem && (
                                  <>
                                    {/* Paso 1.5: Cantidad a cambiar */}
                                    {exchangeItem.quantity > 1 && (
                                      <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                          Cantidad a cambiar (Max {exchangeItem.quantity}):
                                        </label>
                                        <input
                                          type="number"
                                          min={1}
                                          max={exchangeItem.quantity}
                                          value={exchangeQty}
                                          onChange={e => {
                                            const val = Math.max(1, Math.min(exchangeItem.quantity, parseInt(e.target.value) || 1));
                                            setExchangeQty(val);
                                          }}
                                          style={{
                                            padding: '8px 12px',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '6px',
                                            width: '100px',
                                            fontSize: '13px'
                                          }}
                                        />
                                      </div>
                                    )}

                                    {/* Paso 2: Seleccionar nuevo producto */}
                                    <div>
                                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                        2. Selecciona el nuevo producto:
                                      </label>
                                      <select
                                        value={replacementProductId}
                                        onChange={e => { setReplacementProductId(e.target.value); setReplacementColorHex(''); setReplacementSize(''); }}
                                        style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px', backgroundColor: '#FFF' }}
                                      >
                                        <option value="">— Seleccionar producto —</option>
                                        {products.filter(p => p.active && p.stock > 0).map(p => (
                                          <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Paso 3: Color */}
                                    {replacementColors.length > 0 && (
                                      <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                          3. Selecciona el color:
                                        </label>
                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                          {replacementColors.map(c => (
                                            <button
                                              key={c.hex}
                                              type="button"
                                              onClick={() => setReplacementColorHex(c.hex)}
                                              title={c.name}
                                              style={{
                                                width: '34px', height: '34px', borderRadius: '50%',
                                                backgroundColor: c.hex,
                                                border: replacementColorHex === c.hex ? '3px solid #7C3AED' : '1px solid var(--border-color)',
                                                cursor: 'pointer',
                                                boxShadow: replacementColorHex === c.hex ? '0 0 0 2px #FFF, 0 0 0 4px #7C3AED' : 'none'
                                              }}
                                            />
                                          ))}
                                        </div>
                                        {selectedRepColor && <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>{selectedRepColor.name} — Stock: {selectedRepColor.stock || 0}</p>}
                                      </div>
                                    )}

                                    {/* Paso 4: Talla */}
                                    {replacementSizes.length > 0 && (
                                      <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                          4. Selecciona la talla:
                                        </label>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                          {replacementSizes.map(s => {
                                            const sizeStock = selectedRepColor?.sizes_stock?.[s] ?? '?';
                                            return (
                                              <button
                                                key={s}
                                                type="button"
                                                onClick={() => setReplacementSize(s)}
                                                style={{
                                                  padding: '6px 14px', fontSize: '12px', fontWeight: 600,
                                                  border: replacementSize === s ? '2px solid #7C3AED' : '1px solid var(--border-color)',
                                                  backgroundColor: replacementSize === s ? '#7C3AED' : '#FFF',
                                                  color: replacementSize === s ? '#FFF' : 'var(--text-secondary)',
                                                  cursor: 'pointer',
                                                  borderRadius: '4px'
                                                }}
                                              >
                                                {s} ({sizeStock})
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {/* Diferencia de Precio */}
                                    {replacementSize && (() => {
                                      const repSizePrices = (selectedReplacementProduct?.wholesale_tiers || []).find(t => t.type === 'size_prices')?.data || {};
                                      const repSizeData = repSizePrices[replacementSize] || {};
                                      const repRegularPrice = (repSizeData.price && repSizeData.price !== '')
                                        ? parseFloat(repSizeData.price)
                                        : (selectedReplacementProduct ? (selectedReplacementProduct.offer_price !== null ? parseFloat(selectedReplacementProduct.offer_price) : parseFloat(selectedReplacementProduct.price)) : 0);
                                      
                                      const repActivePrice = (repSizeData.offer_price && repSizeData.offer_price !== '')
                                        ? parseFloat(repSizeData.offer_price)
                                        : repRegularPrice;

                                      const originalUnitPrice = parseFloat(exchangeItem.unit_price) || 0;
                                      const diffAmountUnit = repActivePrice - originalUnitPrice;
                                      const diffAmountTotal = diffAmountUnit * exchangeQty;

                                      return (
                                        <div style={{
                                          padding: '14px',
                                          backgroundColor: diffAmountTotal > 0 ? '#FFFBEB' : diffAmountTotal < 0 ? '#ECFDF5' : '#F9FAFB',
                                          border: '1px solid',
                                          borderRadius: '6px',
                                          borderColor: diffAmountTotal > 0 ? '#FBBF24' : diffAmountTotal < 0 ? '#34D399' : '#E5E7EB',
                                          marginTop: '16px',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: '4px'
                                        }}>
                                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cálculo de Diferencia ({exchangeQty} uds):</span>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-primary)' }}>
                                            <span>Precio unitario devuelto:</span>
                                            <strong>S/. {originalUnitPrice.toFixed(2)}</strong>
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-primary)' }}>
                                            <span>Precio unitario nuevo:</span>
                                            <strong>S/. {repActivePrice.toFixed(2)}</strong>
                                          </div>
                                          <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', margin: '6px 0' }} />
                                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700, color: diffAmountTotal > 0 ? '#B45309' : diffAmountTotal < 0 ? '#047857' : 'var(--text-primary)' }}>
                                            <span>{diffAmountTotal > 0 ? 'DIFERENCIA A COBRAR:' : diffAmountTotal < 0 ? 'DIFERENCIA A DEVOLVER:' : 'SIN DIFERENCIA:'}</span>
                                            <span>S/. {Math.abs(diffAmountTotal).toFixed(2)}</span>
                                          </div>
                                        </div>
                                      );
                                    })()}

                                    {/* Botones de acción */}
                                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                      <button
                                        disabled={exchangeLoading || !replacementProductId || (replacementColors.length > 0 && !replacementColorHex) || (replacementSizes.length > 0 && !replacementSize)}
                                        onClick={async () => {
                                          setExchangeLoading(true);
                                          try {
                                            const colorName = selectedRepColor?.name || '';
                                            await DataService.exchangeProduct(
                                              s.id,
                                              exchangeItem.id,
                                              replacementProductId,
                                              replacementColorHex || null,
                                              colorName || null,
                                              replacementSize || null,
                                              currentUser.name,
                                              exchangeQty
                                            );
                                            setMsg('✅ Cambio de producto realizado con éxito.');
                                            setTimeout(() => setMsg(''), 4000);
                                            setExchangeSale(null);
                                            loadData();
                                          } catch (err) {
                                            alert('Error al realizar el cambio: ' + (err.message || ''));
                                          } finally {
                                            setExchangeLoading(false);
                                          }
                                        }}
                                        style={{
                                          padding: '10px 20px',
                                          backgroundColor: '#7C3AED',
                                          color: '#FFF',
                                          border: 'none',
                                          borderRadius: '6px',
                                          cursor: exchangeLoading ? 'wait' : 'pointer',
                                          fontSize: '13px',
                                          fontWeight: 600,
                                          opacity: (exchangeLoading || !replacementProductId || (replacementColors.length > 0 && !replacementColorHex) || (replacementSizes.length > 0 && !replacementSize)) ? 0.5 : 1
                                        }}
                                      >
                                        {exchangeLoading ? 'Procesando...' : 'Confirmar Cambio'}
                                      </button>
                                      <button
                                        onClick={() => setExchangeSale(null)}
                                        style={{
                                          padding: '10px 20px',
                                          border: '1px solid var(--border-color)',
                                          backgroundColor: '#FFF',
                                          borderRadius: '6px',
                                          cursor: 'pointer',
                                          fontSize: '13px'
                                        }}
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
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
              width: '340px',
              maxHeight: '90vh',
              overflowY: 'auto',
              fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
              fontSize: '12px',
              padding: '28px 24px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              border: '1px solid #E5E7EB',
              borderRadius: '8px'
            }}>
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                {config?.storeLogoUrl ? (
                  <img src={config.storeLogoUrl} alt="Logo" style={{ maxHeight: '55px', maxWidth: '200px', objectFit: 'contain', marginBottom: '10px' }} />
                ) : (
                  <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#111', marginBottom: '10px' }}>
                    {config?.businessName || config?.storeName || 'ARVEN'}
                  </div>
                )}
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#111', textTransform: 'uppercase', letterSpacing: '0.04em' }}>TICKET DE VENTA</div>
                <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '2px', fontWeight: 600 }}>RUC: {config?.ruc || '20601234567'}</div>
              </div>

              {/* Date & Time Icons */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', fontSize: '10px', color: '#4B5563', backgroundColor: '#F9FAFB', padding: '6px 12px', borderRadius: '4px', border: '1px solid #E5E7EB', marginBottom: '12px' }}>
                <span>📅 {saleDate.toLocaleDateString('es-PE')}</span>
                <span>🕐 {saleDate.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
              </div>

              <div style={{ textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#C5A880', letterSpacing: '0.05em', marginBottom: '14px' }}>
                {selectedSale.invoice_number}
              </div>

              <div style={{ borderTop: '1px dashed #D1D5DB', margin: '10px 0' }} />

              {/* Customer info (if exists) */}
              <div style={{ fontSize: '11px', color: '#4B5563', lineHeight: '1.4', marginBottom: '10px' }}>
                <div><strong>Cliente:</strong> {selectedSale.customer_name}</div>
                {selectedSale.customer_document && <div><strong>Doc:</strong> {selectedSale.customer_document}</div>}
              </div>

              <div style={{ borderTop: '1px dashed #D1D5DB', margin: '10px 0' }} />

              {/* Table Headers */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '10px', color: '#374151', textTransform: 'uppercase', marginBottom: '6px' }}>
                <span style={{ flex: 0.5, textAlign: 'center' }}>CANT.</span>
                <span style={{ flex: 2, textAlign: 'left' }}>DESCRIPCIÓN</span>
                <span style={{ flex: 1, textAlign: 'right' }}>TOTAL</span>
              </div>

              <div style={{ borderTop: '1px solid #E5E7EB', marginBottom: '8px' }} />

              {/* Items List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                {items.map(item => {
                  const isExchangedItem = item.product_name.includes('[CAMBIO]') || item.product_name.includes('CAMBIO');
                  return (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', alignItems: 'center', color: isExchangedItem ? '#7C3AED' : '#111' }}>
                      <span style={{ flex: 0.5, textAlign: 'center', fontWeight: 600 }}>{item.quantity}</span>
                      <span style={{ flex: 2, textAlign: 'left', fontWeight: isExchangedItem ? 'bold' : 'normal' }}>
                        {item.product_name}
                      </span>
                      <span style={{ flex: 1, textAlign: 'right', fontWeight: 600 }}>S/. {formatNoRound(item.total_price)}</span>
                    </div>
                  );
                })}
              </div>

              <div style={{ borderTop: '1px dashed #D1D5DB', margin: '10px 0' }} />

              {/* Totals Box */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: '#4B5563', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>SUBTOTAL:</span>
                  <span>S/. {formatNoRound(selectedSale.total_amount + selectedSale.discount_amount)}</span>
                </div>
                {selectedSale.discount_amount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#EF4444' }}>
                    <span>DESCUENTO:</span>
                    <span>- S/. {formatNoRound(selectedSale.discount_amount)}</span>
                  </div>
                )}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  backgroundColor: '#111',
                  color: '#C5A880',
                  padding: '6px 10px',
                  fontWeight: 700,
                  fontSize: '13px',
                  marginTop: '4px'
                }}>
                  <span>TOTAL:</span>
                  <span>S/. {formatNoRound(selectedSale.total_amount)}</span>
                </div>
              </div>

              <div style={{ borderTop: '1px dashed #D1D5DB', margin: '10px 0' }} />

              {/* Forma de pago */}
              <div style={{ textAlign: 'center', fontSize: '11px', color: '#4B5563', marginBottom: '12px' }}>
                <strong>Forma de pago:</strong> {selectedSale.payment_method}
              </div>

              <div style={{ textAlign: 'center', fontSize: '10px', color: '#6B7280', margin: '12px 0', fontStyle: 'italic' }}>
                ¡Gracias por tu compra! ♡
              </div>

              {/* Social networks dark bar */}
              <div style={{
                backgroundColor: '#111',
                color: '#FFF',
                padding: '10px',
                textAlign: 'center',
                fontSize: '9px',
                borderRadius: '4px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                marginBottom: '16px'
              }}>
                <div>Instagram: @arven.brands | Cel: {config?.footer?.whatsapp || '+51 987 654 321'}</div>
                <div style={{ letterSpacing: '0.08em', fontWeight: 700, marginTop: '2px' }}>WWW.ARVEN.COM</div>
              </div>

              {/* Action Buttons */}
              <div className="no-print" style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => window.print()}
                  className="btn-primary"
                  style={{ flex: 1, display: 'flex', gap: '6px', justifyContent: 'center', borderRadius: '4px', fontSize: '12px', padding: '10px' }}
                >
                  <Printer size={14} /> Imprimir
                </button>
                <button
                  onClick={() => { setShowTicketModal(false); setSelectedSale(null); }}
                  className="btn-secondary"
                  style={{ flex: 1, borderRadius: '4px', fontSize: '12px', padding: '10px' }}
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
          const valorVentaUnitario = precioVentaUnitario / 1.18;
          const igvUnitario = precioVentaUnitario - valorVentaUnitario;
          
          const totalBase = valorVentaUnitario * item.quantity;
          const totalIgv = igvUnitario * item.quantity;
          const totalConIgv = precioVentaUnitario * item.quantity;

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

        const totalImporte = selectedSale.total_amount;
        const totalBaseGravada = totalImporte / 1.18;
        const totalIGV = totalImporte - totalBaseGravada;
        const descuento = selectedSale.discount_amount;

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
              padding: '36px 32px',
              border: '1px solid #E5E7EB',
              borderRadius: '12px',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
              fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
            }}>
              
              {/* === CABECERA SUNAT: Datos del Emisor === */}
              <div style={{ 
                display: 'flex', 
                gap: '20px', 
                paddingBottom: '20px', 
                borderBottom: '2px solid #111',
                marginBottom: '20px',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                {/* Logo / Nombre Empresa */}
                <div style={{ flex: 1, display: 'flex', gap: '14px', alignItems: 'center' }}>
                  {config?.storeLogoUrl ? (
                    <img src={config.storeLogoUrl} alt="Logo" style={{ maxHeight: '55px', maxWidth: '200px', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#111', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      {config?.businessName || config?.storeName || 'ARVEN'}
                    </div>
                  )}
                </div>

                {/* Cuadro del Comprobante */}
                <div style={{ 
                  border: '1px solid #111', 
                  padding: '12px 18px', 
                  textAlign: 'center',
                  minWidth: '220px',
                  backgroundColor: '#FFF',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#6B7280', letterSpacing: '0.05em' }}>
                    R.U.C. N° {config?.ruc || '20601234567'}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#111', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {selectedSale.invoice_number.startsWith('FFF1') ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA'}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#C5A880', letterSpacing: '0.04em' }}>
                    N° {selectedSale.invoice_number}
                  </div>
                </div>
              </div>

              {/* Emisor Fiscal details */}
              <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '20px', lineHeight: '1.4' }}>
                <div><strong>Domicilio Fiscal:</strong> {config?.fiscalAddress || 'Av. Larco 123, Miraflores, Lima'}</div>
                <div><strong>Contacto:</strong> {config?.ticketPhone ? `Cel: ${config.ticketPhone}` : ''} {config?.ticketEmail ? `| Email: ${config.ticketEmail}` : ''}</div>
              </div>

              {/* === DATOS DEL ADQUIRIENTE === */}
              <div style={{
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                padding: '14px 16px',
                backgroundColor: '#FFF',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
              }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: '#F3F4F6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#6B7280'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px', fontSize: '12px' }}>
                  <div><strong>Adquiriente:</strong> {selectedSale.customer_name}</div>
                  <div><strong>Doc. Identidad:</strong> {selectedSale.customer_document}</div>
                  <div><strong>Fecha de Emisión:</strong> {saleDate.toLocaleDateString()}</div>
                  <div><strong>Hora de Emisión:</strong> {saleDate.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                  <div><strong>Moneda:</strong> SOLES (PEN)</div>
                  <div><strong>Forma de Pago:</strong> {selectedSale.payment_method}</div>
                </div>
              </div>

              {/* === TABLA DE ITEMS CON DESGLOSE IGV === */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left', marginBottom: '20px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#111', color: '#FFF' }}>
                    <th style={{ padding: '10px 8px', fontWeight: 600, textAlign: 'center', width: '60px' }}>CANT.</th>
                    <th style={{ padding: '10px 8px', fontWeight: 600, width: '60px' }}>UNIDAD</th>
                    <th style={{ padding: '10px 8px', fontWeight: 600, width: '100px' }}>CÓDIGO</th>
                    <th style={{ padding: '10px 8px', fontWeight: 600 }}>DESCRIPCIÓN</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, width: '110px' }}>VALOR UNIT.</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsWithTax.map((item, idx) => {
                    const isExchangedItem = item.product_name.includes('[CAMBIO]') || item.product_name.includes('CAMBIO');
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #eee', backgroundColor: isExchangedItem ? '#F5F3FF' : '#FFF' }}>
                        <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
                        <td style={{ padding: '10px 8px', color: '#4B5563' }}>NIU</td>
                        <td style={{ padding: '10px 8px', color: '#6B7280' }}>{item.sku || 'N/A'}</td>
                        <td style={{ padding: '10px 8px', fontWeight: isExchangedItem ? 'bold' : 'normal', color: isExchangedItem ? '#7C3AED' : '#111' }}>
                          {item.product_name}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600 }}>S/. {formatNoRound(item.valorVentaUnitario)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* === RESUMEN TRIBUTARIO === */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-end',
                marginBottom: '20px'
              }}>
                <div style={{ 
                  width: '240px', 
                  fontSize: '11px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4B5563' }}>
                    <span>OP. GRAVADA:</span>
                    <span>S/. {formatNoRound(totalBaseGravada)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4B5563' }}>
                    <span>I.G.V. (18%):</span>
                    <span>S/. {formatNoRound(totalIGV)}</span>
                  </div>
                  {descuento > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#EF4444' }}>
                      <span>DESCUENTO:</span>
                      <span>- S/. {formatNoRound(descuento)}</span>
                    </div>
                  )}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    fontWeight: 700, 
                    fontSize: '13px', 
                    backgroundColor: '#111', 
                    color: '#C5A880',
                    padding: '8px 12px',
                    marginTop: '4px'
                  }}>
                    <span>TOTAL:</span>
                    <span>S/. {formatNoRound(totalImporte)}</span>
                  </div>
                </div>
              </div>

              {/* === ESTADO DEL COMPROBANTE === */}
              <div style={{ 
                textAlign: 'center', 
                padding: '6px 12px',
                marginBottom: '20px',
                border: `1px solid ${selectedSale.status === 'voided' ? '#EF4444' : selectedSale.status === 'exchanged' ? '#7C3AED' : '#10B981'}`,
                color: selectedSale.status === 'voided' ? '#EF4444' : selectedSale.status === 'exchanged' ? '#7C3AED' : '#10B981',
                fontWeight: 700,
                fontSize: '12px',
                letterSpacing: '0.04em',
                borderRadius: '4px'
              }}>
                {selectedSale.status === 'voided' ? '✗ COMPROBANTE ANULADO' : selectedSale.status === 'exchanged' ? '↻ COMPROBANTE CON CAMBIO' : '✓ ACEPTADA POR SUNAT'}
              </div>

              {/* === Pie legal === */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderTop: '1px solid #E5E7EB', paddingTop: '16px', marginBottom: '20px' }}>
                <div style={{ fontSize: '9px', color: '#6B7280', lineHeight: 1.5 }}>
                  Representación impresa de la {selectedSale.invoice_number.startsWith('FFF1') ? 'Factura' : 'Boleta de Venta'} Electrónica.<br />
                  Consulte este comprobante en: <strong>carrillostore.com/consultas</strong><br />
                  Autorizado mediante resolución SUNAT N° 034-2020/SUNAT.<br />
                  Hash: {btoa(selectedSale.id).slice(0, 24)}
                </div>
              </div>

              {/* Brand Dark Bar */}
              <div style={{
                backgroundColor: '#111',
                color: '#FFF',
                padding: '12px',
                textAlign: 'center',
                fontSize: '9px',
                borderRadius: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                marginBottom: '20px'
              }}>
                <div>Instagram: @arven.brands | Soporte WhatsApp: {config?.footer?.whatsapp || '+51 987 654 321'}</div>
                <div style={{ letterSpacing: '0.08em', fontWeight: 700, marginTop: '2px' }}>WWW.ARVEN.COM</div>
              </div>

              {/* === Botones de Acción === */}
              <div className="no-print" style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => window.print()}
                  className="btn-primary" 
                  style={{ flex: 1, display: 'flex', gap: '8px', justifyContent: 'center', borderRadius: '4px', fontSize: '13px', padding: '12px' }}
                >
                  <Printer size={15} /> Imprimir
                </button>
                <button 
                  onClick={() => { setShowInvoiceModal(false); setSelectedSale(null); }}
                  className="btn-secondary" 
                  style={{ flex: 1, borderRadius: '4px', fontSize: '13px', padding: '12px' }}
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
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: #FFF !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .invoice-print-container button,
          .ticket-print-container button,
          .no-print {
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
