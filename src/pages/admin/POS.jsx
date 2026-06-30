import { useState, useEffect } from 'react';
import { Search, ShoppingBag, Plus, Minus, Trash2, CheckCircle, AlertTriangle, UserPlus, HelpCircle, ArrowLeft, ShieldAlert, Pencil, X, ChevronDown, Phone } from 'lucide-react';
import { DataService, subscribeToRealtime } from '../../services/dataService';

export default function POS() {
  const loggedInUserRaw = localStorage.getItem('admin_user');
  const currentUser = loggedInUserRaw ? JSON.parse(loggedInUserRaw) : { name: 'Admin Principal', role: 'admin' };

  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // POS Order & Flow State
  const [currentStep, setCurrentStep] = useState('billing'); // 'billing' | 'sales' | 'payment'
  const [orderItems, setOrderItems] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [documentType, setDocumentType] = useState('Boleta'); // 'Boleta', 'Factura', 'Sin Datos'

  // Cash Received & Change (Vuelto)
  const [receivedAmount, setReceivedAmount] = useState('');

  // Product Selection Modal
  const [showProdModal, setShowProdModal] = useState(false);
  const [activeProduct, setActiveProduct] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedQty, setSelectedQty] = useState(1);

  // Cash Register State
  const [isCashOpen, setIsCashOpen] = useState(false);
  const [cashSessionId, setCashSessionId] = useState('');
  const [openingAmount, setOpeningAmount] = useState('100');

  // Customer Creator Modal
  const [showCustModal, setShowCustModal] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', phone: '', email: '', document_number: '' });

  // Admin Authorization Modal for POS opening
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authAction, setAuthAction] = useState(null);
  const [adminVerifiedName, setAdminVerifiedName] = useState(''); // After admin verifies, stores name
  const [authOpeningAmount, setAuthOpeningAmount] = useState('100');

  // Confirmation / Success States
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Print Dialog States
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [lastCreatedSale, setLastCreatedSale] = useState(null);

  // NEW: Item-level discount (% per item)
  const [itemDiscounts, setItemDiscounts] = useState({}); // { [uniqueId]: number }
  const [editingItemId, setEditingItemId] = useState(null);

  // NEW: Ticket customer data modal (optional for "Sin Datos")
  const [showTicketCustomerModal, setShowTicketCustomerModal] = useState(false);
  const [ticketCustomerData, setTicketCustomerData] = useState({ name: '', phone: '', document_number: '' });

  // NEW: Bottom bar client search
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const loadData = async () => {
    const prods = await DataService.getProducts();
    setProducts(prods.filter(p => p.active));

    const custs = await DataService.getCustomers();
    setCustomers(custs);

    const register = await DataService.getCashRegister();
    if (register.status === 'open' && register.currentSession) {
      setIsCashOpen(true);
      setCashSessionId(register.currentSession.id);
    } else {
      setIsCashOpen(false);
      setCashSessionId('');
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToRealtime(() => {
      loadData();
    });
    return () => unsubscribe();
  }, []);

  const handleOpenCash = () => {
    if (!openingAmount) return;
    
    const action = async (adminName) => {
      const register = await DataService.openCashRegister(openingAmount, currentUser.name, adminName);
      setIsCashOpen(true);
      setCashSessionId(register.currentSession.id);
      setSuccessMsg(`Caja abierta y autorizada por ${adminName}.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    };

    if (currentUser.role === 'admin') {
      action(currentUser.name);
    } else {
      setAuthAction(() => action);
      setAuthEmail('');
      setAuthPassword('');
      setAuthError('');
      setShowAuthModal(true);
    }
  };

  const handleAdminAuthSubmit = async (e) => {
    e.preventDefault();

    // If admin is already verified (second step: opening amount), handle opening
    if (adminVerifiedName && !authAction) {
      if (!authOpeningAmount) return;
      const register = await DataService.openCashRegister(authOpeningAmount, currentUser.name, adminVerifiedName);
      setIsCashOpen(true);
      setCashSessionId(register.currentSession.id);
      setShowAuthModal(false);
      setAdminVerifiedName('');
      setSuccessMsg(`Caja abierta y autorizada por ${adminVerifiedName}.`);
      setTimeout(() => setSuccessMsg(''), 3000);
      return;
    }

    const config = await DataService.getConfig();
    let matchedAdmin = config.users?.find(
      u => u.email.toLowerCase() === authEmail.toLowerCase() && u.role === 'admin' && (u.password || 'password') === authPassword
    );
    if (!matchedAdmin && authEmail.toLowerCase() === 'admin@carrillostore.com' && authPassword === 'password') {
      matchedAdmin = { name: 'Admin Principal' };
    }

    if (matchedAdmin) {
      if (authAction) {
        // Direct action callback (e.g. from handleOpenCash for admin role)
        setShowAuthModal(false);
        authAction(matchedAdmin.name);
      } else {
        // Collaborator opening flow: admin verified, now show opening amount input
        setAdminVerifiedName(matchedAdmin.name);
        setAuthError('');
      }
    } else {
      setAuthError('Acceso denegado. Credenciales de Administrador inválidas.');
    }
  };

  const formatNoRound = (num) => {
    if (num === undefined || num === null || isNaN(num)) return '0.00';
    const factor = 100;
    const truncated = Math.trunc(num * factor) / factor;
    const parts = truncated.toString().split('.');
    if (parts.length === 1) return parts[0] + '.00';
    if (parts[1].length === 1) return parts[0] + '.' + parts[1] + '0';
    return parts[0] + '.' + parts[1].substring(0, 2);
  };

  // Abrir modal de selección detallada de polo
  const handleProductClick = (product) => {
    if (product.stock <= 0) {
      setErrorMsg('Producto sin stock general.');
      setTimeout(() => setErrorMsg(''), 2000);
      return;
    }
    setActiveProduct(product);
    setSelectedColor(product.colors?.length > 0 ? product.colors[0] : null);
    setSelectedSize(product.sizes?.length > 0 ? product.sizes[0] : 'M');
    setSelectedQty(1);
    setShowProdModal(true);
  };

  // Agregar al pedido con color y talla seleccionados
  const handleAddProductWithDetails = () => {
    if (!activeProduct) return;

    // Leer el producto fresco del estado para tener stock actualizado
    const freshProduct = products.find(p => p.id === activeProduct.id) || activeProduct;
    const freshColor = selectedColor
      ? freshProduct.colors?.find(c => c.hex === selectedColor.hex) || selectedColor
      : null;

    // Validar stock del color específico y talla si aplica
    if (freshColor) {
      let availableStock = freshColor.stock;
      if (freshColor.sizes_stock && freshColor.sizes_stock[selectedSize] !== undefined) {
        availableStock = freshColor.sizes_stock[selectedSize];
      }
      if (selectedQty > availableStock) {
        setErrorMsg(`Stock insuficiente para el color ${freshColor.name} talla ${selectedSize} (Disponible: ${availableStock} uds).`);
        setTimeout(() => setErrorMsg(''), 3000);
        return;
      }
    } else {
      if (selectedQty > freshProduct.stock) {
        setErrorMsg(`Stock insuficiente. Disponible: ${freshProduct.stock} uds.`);
        setTimeout(() => setErrorMsg(''), 3000);
        return;
      }
    }

    // Crear un ID único para la combinación de Producto + Talla + Color
    const itemUniqueId = `${freshProduct.id}-${selectedSize}-${freshColor ? freshColor.hex : 'no-color'}`;
    
    const existingIndex = orderItems.findIndex(item => item.uniqueId === itemUniqueId);

    const detailName = `${freshProduct.name} ${freshColor ? freshColor.name.toUpperCase() : ''} ${selectedSize}`.trim();

    if (existingIndex !== -1) {
      const updated = [...orderItems];
      const newQty = updated[existingIndex].quantity + selectedQty;
      
      // Validar límite superior con stock fresco
      const limit = freshColor
        ? (freshColor.sizes_stock && freshColor.sizes_stock[selectedSize] !== undefined ? freshColor.sizes_stock[selectedSize] : freshColor.stock)
        : freshProduct.stock;
      if (newQty > limit) {
        setErrorMsg(`No puedes agregar más. Supera el stock de ${limit} uds.`);
        setTimeout(() => setErrorMsg(''), 3000);
        return;
      }
      updated[existingIndex].quantity = newQty;
      setOrderItems(updated);
    } else {
      setOrderItems([...orderItems, {
        ...freshProduct,
        uniqueId: itemUniqueId,
        detailName,
        selectedColor: freshColor,
        selectedSize,
        quantity: selectedQty,
      }]);
    }

    setShowProdModal(false);
    setActiveProduct(null);
    setSuccessMsg('Producto agregado al pedido.');
    setTimeout(() => setSuccessMsg(''), 2000);
  };

  const updateQty = (uniqueId, change) => {
    const item = orderItems.find(i => i.uniqueId === uniqueId);
    if (!item) return;

    const newQty = item.quantity + change;
    if (newQty <= 0) {
      setOrderItems(orderItems.filter(i => i.uniqueId !== uniqueId));
      const newDiscounts = { ...itemDiscounts };
      delete newDiscounts[uniqueId];
      setItemDiscounts(newDiscounts);
      return;
    }

    const limit = item.selectedColor
      ? (item.selectedColor.sizes_stock && item.selectedColor.sizes_stock[item.selectedSize] !== undefined ? item.selectedColor.sizes_stock[item.selectedSize] : item.selectedColor.stock)
      : item.stock;
    if (newQty > limit) {
      setErrorMsg(`Supera el stock de inventario para este color/talla (${limit} uds).`);
      setTimeout(() => setErrorMsg(''), 2000);
      return;
    }

    setOrderItems(orderItems.map(i => i.uniqueId === uniqueId ? { ...i, quantity: newQty } : i));
  };

  const removeFromOrder = (uniqueId) => {
    setOrderItems(orderItems.filter(item => item.uniqueId !== uniqueId));
    const newDiscounts = { ...itemDiscounts };
    delete newDiscounts[uniqueId];
    setItemDiscounts(newDiscounts);
    if (editingItemId === uniqueId) setEditingItemId(null);
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!newCust.name) return;
    const saved = await DataService.saveCustomer({
      ...newCust,
      document_type: 'DNI'
    });
    setCustomers([...customers, saved]);
    setSelectedCustomerId(saved.id);
    setShowCustModal(false);
    setNewCust({ name: '', phone: '', email: '', document_number: '' });
    setSuccessMsg('Cliente registrado y seleccionado.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Helper: get unit price for an item
  // El descuento mayorista aplica si la suma total de variantes del MISMO producto base
  // (distintos colores/tallas) alcanza el minimo mayorista.
  const getItemUnitPrice = (item, allItems = orderItems) => {
    const basePrice = item.offer_price || item.price;
    const totalQtyForProduct = allItems
      .filter(i => i.id === item.id)
      .reduce((sum, i) => sum + i.quantity, 0);

    let applicableWholesalePrice = null;

    if (Array.isArray(item.wholesale_tiers) && item.wholesale_tiers.length > 0) {
      const sortedTiers = [...item.wholesale_tiers].sort((a, b) => b.min_qty - a.min_qty);
      const matchedTier = sortedTiers.find(t => totalQtyForProduct >= t.min_qty);
      if (matchedTier) {
        applicableWholesalePrice = matchedTier.price;
      }
    } else if (item.wholesale_price) {
      const minQty = item.wholesale_min_qty || 6;
      if (totalQtyForProduct >= minQty) {
        applicableWholesalePrice = item.wholesale_price;
      }
    }

    return applicableWholesalePrice !== null ? applicableWholesalePrice : basePrice;
  };

  // Totales (includes item-level discounts)
  const subtotal = orderItems.reduce((sum, item) => {
    const price = getItemUnitPrice(item);
    const discountPct = itemDiscounts[item.uniqueId] || 0;
    const lineTotal = price * item.quantity * (1 - discountPct / 100);
    return sum + lineTotal;
  }, 0);
  const total = Math.max(0, subtotal - parseFloat(discountAmount || 0));
  const totalItemsCount = orderItems.reduce((s, i) => s + i.quantity, 0);

  // WhatsApp functions
  const generateWhatsAppMessage = (sale) => {
    let msg = `🧾 *CARRILLO STORE*\n`;
    msg += `Comprobante: ${sale.document_type || 'Ticket'} N° ${sale.invoice_number}\n`;
    msg += `Fecha: ${new Date(sale.created_at).toLocaleDateString()}\n`;
    msg += `─────────────\n`;
    sale.items.forEach(item => {
      msg += `${item.quantity}x ${item.product_name}\n`;
      msg += `   S/. ${formatNoRound(item.unit_price)} c/u → S/. ${formatNoRound(item.unit_price * item.quantity)}\n`;
    });
    msg += `─────────────\n`;
    if (sale.discount_amount > 0) {
      msg += `Descuento: -S/. ${formatNoRound(sale.discount_amount)}\n`;
    }
    msg += `*TOTAL: S/. ${formatNoRound(sale.total_amount)}*\n`;
    msg += `─────────────\n`;
    msg += `¡Gracias por tu compra! 🛍️\n`;
    msg += `www.carrillostore.com`;
    return msg;
  };

  const openWhatsApp = (phone, message) => {
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    // Add Peru country code if it's a 9-digit number starting with 9
    if (cleanPhone.length === 9 && cleanPhone.startsWith('9')) {
      cleanPhone = '51' + cleanPhone;
    }
    const encodedMsg = encodeURIComponent(message);
    window.open(`https://wa.me/${cleanPhone}?text=${encodedMsg}`, '_blank');
  };

  // Confirmar y Emitir Venta
  const handleConfirmSale = async () => {
    if (orderItems.length === 0) {
      setErrorMsg('El pedido está vacío.');
      setTimeout(() => setErrorMsg(''), 2000);
      return;
    }

    if (paymentMethod === 'Efectivo') {
      const cashReceived = parseFloat(receivedAmount) || 0;
      if (cashReceived < total) {
        setErrorMsg('El dinero recibido es menor que el monto total a pagar.');
        setTimeout(() => setErrorMsg(''), 3000);
        return;
      }
    }

    try {
      const customer = customers.find(c => c.id === selectedCustomerId);
      
      // Determine customer info based on document type
      let customerName, customerDoc, customerPhone;
      if (documentType === 'Sin Datos') {
        customerName = ticketCustomerData.name || 'Cliente Genérico';
        customerDoc = ticketCustomerData.document_number || '00000000';
        customerPhone = ticketCustomerData.phone || '';
      } else {
        customerName = customer ? customer.name : 'Cliente Genérico';
        customerDoc = customer ? customer.document_number : '00000000';
        customerPhone = customer ? (customer.phone || '') : '';
      }

      const saleData = {
        customer_id: documentType === 'Sin Datos' ? null : (selectedCustomerId || null),
        customer_name: customerName,
        customer_document: customerDoc,
        total_amount: total,
        discount_amount: parseFloat(discountAmount || 0),
        payment_method: paymentMethod,
        document_type: documentType,
        type: 'pos',
        operator: currentUser.name,
        items: orderItems.map(item => {
          const unitPrice = getItemUnitPrice(item);
          const discountPct = itemDiscounts[item.uniqueId] || 0;
          const effectivePrice = unitPrice * (1 - discountPct / 100);
          return {
            product_id: item.id,
            product_name: item.detailName,
            quantity: item.quantity,
            unit_price: effectivePrice,
            original_price: unitPrice,
            discount_pct: discountPct,
            color_hex: item.selectedColor ? item.selectedColor.hex : null,
            color_name: item.selectedColor ? item.selectedColor.name : null,
            selected_size: item.selectedSize || null,
          };
        })
      };

      const createdSale = await DataService.createSale(saleData);

      const saleToPrint = {
        ...saleData,
        invoice_number: createdSale.invoice_number,
        created_at: createdSale.created_at,
        customer_phone: customerPhone,
        document_type: documentType,
      };
      setLastCreatedSale(saleToPrint);
      setShowPrintModal(true);

      // Refrescar productos para que el stock se actualice en pantalla
      loadData();

      setSuccessMsg('¡Venta realizada con éxito!');
      setOrderItems([]);
      setItemDiscounts({});
      setDiscountAmount(0);
      setSelectedCustomerId('');
      setReceivedAmount('');
      setCurrentStep('billing');
      setTicketCustomerData({ name: '', phone: '', document_number: '' });
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e) {
      console.error(e);
      setErrorMsg('Error al registrar la venta.');
      setTimeout(() => setErrorMsg(''), 2500);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filtered clients for bottom bar search
  const filteredClients = clientSearchQuery.trim()
    ? customers.filter(c =>
        c.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
        (c.document_number && c.document_number.includes(clientSearchQuery)) ||
        (c.email && c.email.toLowerCase().includes(clientSearchQuery.toLowerCase()))
      )
    : [];

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      
      {/* Mensajes de Notificación */}
      {successMsg && (
        <div style={{ padding: '12px', backgroundColor: '#EBFBEE', color: '#2F855A', border: '1px solid #C6F6D5', marginBottom: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={16} /> {successMsg}
        </div>
      )}
      {errorMsg && (
        <div style={{ padding: '12px', backgroundColor: '#FFF5F5', color: '#C53030', border: '1px solid #FED7D7', marginBottom: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={16} /> {errorMsg}
        </div>
      )}

      {!isCashOpen ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' }}>
          <div style={{ maxWidth: '420px', width: '100%', padding: '40px 32px', border: '1px solid var(--border-color)', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ width: '56px', height: '56px', backgroundColor: 'rgba(255, 77, 109, 0.05)', color: 'var(--color-secondary)', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <ShieldAlert size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 500 }}>Apertura de Caja Requerida</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                {currentUser.role === 'admin'
                  ? 'Ingresa el saldo inicial para habilitar las ventas en el terminal POS.'
                  : 'Se requiere que un Administrador inicie sesión para aperturar la caja e iniciar el turno de ventas.'
                }
              </p>
            </div>

            {currentUser.role === 'admin' ? (
              <>
                <div style={{ textAlign: 'left' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>
                    Monto de Apertura (S/.)
                  </label>
                  <input type="number" value={openingAmount} onChange={e => setOpeningAmount(e.target.value)} className="input-field" />
                </div>
                <button onClick={handleOpenCash} className="btn-primary" style={{ width: '100%', borderRadius: '0px' }}>
                  Abrir Turno de Caja
                </button>
              </>
            ) : (
              <button onClick={() => {
                setAuthAction(null);
                setAuthEmail('');
                setAuthPassword('');
                setAuthError('');
                setShowAuthModal(true);
              }} className="btn-primary" style={{ width: '100%', borderRadius: '0px' }}>
                🔑 Solicitar Apertura (Requiere Admin)
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          
          {/* ==================== PASO 1: DATOS FACTURACIÓN ==================== */}
          {currentStep === 'billing' && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
              <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ textAlign: 'center' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Paso 1: Tipo de Comprobante & Cliente</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Elige el tipo de documento a emitir para esta venta</p>
                </div>

                {/* Selección de Tipo */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['Sin Datos', 'Boleta', 'Factura'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setDocumentType(type);
                        if (type === 'Sin Datos') {
                          setSelectedCustomerId('');
                          // Show optional customer data modal for tickets
                          setShowTicketCustomerModal(true);
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '12px 8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: documentType === type ? 'var(--text-primary)' : '#FFF',
                        color: documentType === type ? '#FFF' : 'var(--text-primary)',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 600,
                        textAlign: 'center'
                      }}
                    >
                      {type === 'Sin Datos' ? 'Ticket (Sin datos)' : type}
                    </button>
                  ))}
                </div>

                {/* Formulario Cliente si no es Sin Datos */}
                {documentType !== 'Sin Datos' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '12px', fontWeight: 500 }}>Seleccionar Cliente</label>
                      <button onClick={() => setShowCustModal(true)} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <UserPlus size={14} /> + Nuevo Cliente
                      </button>
                    </div>
                    <select
                      value={selectedCustomerId}
                      onChange={e => setSelectedCustomerId(e.target.value)}
                      style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', fontSize: '13px', backgroundColor: '#FFF' }}
                    >
                      <option value="">-- Seleccionar cliente registrado --</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.document_number})</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Info ticket customer data if provided */}
                {documentType === 'Sin Datos' && ticketCustomerData.name && (
                  <div style={{ padding: '12px', backgroundColor: '#F0FFF4', border: '1px solid #C6F6D5', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontWeight: 600, color: '#2F855A', marginBottom: '4px' }}>✓ Datos opcionales del cliente registrados:</div>
                    {ticketCustomerData.name && <div><strong>Nombre:</strong> {ticketCustomerData.name}</div>}
                    {ticketCustomerData.phone && <div><strong>Teléfono:</strong> {ticketCustomerData.phone}</div>}
                    {ticketCustomerData.document_number && <div><strong>DNI:</strong> {ticketCustomerData.document_number}</div>}
                    <button onClick={() => setShowTicketCustomerModal(true)} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '11px', cursor: 'pointer', textAlign: 'left', marginTop: '4px', padding: 0 }}>
                      Editar datos →
                    </button>
                  </div>
                )}

                <button
                  onClick={() => {
                    if (documentType !== 'Sin Datos' && !selectedCustomerId) {
                      setErrorMsg('Por favor selecciona un cliente o elige "Ticket (Sin datos)".');
                      setTimeout(() => setErrorMsg(''), 3000);
                      return;
                    }
                    setCurrentStep('sales');
                  }}
                  className="btn-primary"
                  style={{ width: '100%', padding: '12px', borderRadius: '0px', fontSize: '14px' }}
                >
                  Continuar al Catálogo →
                </button>
              </div>
            </div>
          )}

          {/* ==================== PASO 2: CATÁLOGO Y PEDIDO ==================== */}
          {currentStep === 'sales' && (
            <div className="pos-grid-container" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.3fr', gap: '0', flex: 1, minHeight: 0 }}>
              
              {/* Lado Izquierdo: Catálogo */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0, padding: '16px', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button onClick={() => setCurrentStep('billing')} className="btn-secondary" style={{ padding: '8px 12px', fontSize: '12px', borderRadius: '0px' }}>
                    ← Paso 1
                  </button>
                  <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)' }} />
                    <input 
                      type="text"
                      placeholder="Buscar polos..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px 8px 36px', fontSize: '13px', border: '1px solid var(--border-color)', backgroundColor: '#FFF', outline: 'none' }}
                    />
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))', gap: '10px', alignContent: 'start' }}>
                  {filteredProducts.map(p => (
                    <div 
                      key={p.id}
                      onClick={() => handleProductClick(p)}
                      style={{ backgroundColor: '#FFF', border: '1px solid var(--border-color)', padding: '10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '200px', position: 'relative', transition: 'box-shadow 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                    >
                      <span style={{ position: 'absolute', top: '6px', right: '6px', fontSize: '9px', backgroundColor: p.stock <= 5 ? '#FEF3C7' : '#F3F4F6', color: p.stock <= 5 ? '#B45309' : '#374151', padding: '2px 5px', fontWeight: 600 }}>
                        {p.stock} uds
                      </span>
                      <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '90px', objectFit: 'cover', marginBottom: '6px' }} />
                      <div>
                        <h4 style={{ fontSize: '11px', fontWeight: 500, marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</h4>
                        <span style={{ fontSize: '12px', fontWeight: 600 }}>S/. {(p.offer_price || p.price).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ===================== Lado Derecho: Resumen de Venta (Estilo Imagen) ===================== */}
              <div style={{ backgroundColor: '#FFF', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                
                {/* Tabla Header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '70px 1fr 100px 80px 100px 70px',
                  borderBottom: '2px solid #E5E7EB',
                  backgroundColor: '#FAFAFA',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#6B7280',
                  letterSpacing: '0.02em'
                }}>
                  <div style={{ padding: '12px 8px', textAlign: 'center' }}>Cantidad</div>
                  <div style={{ padding: '12px 10px' }}>Detalle</div>
                  <div style={{ padding: '12px 8px', textAlign: 'right' }}>$/unidad</div>
                  <div style={{ padding: '12px 8px', textAlign: 'center' }}>% desc.</div>
                  <div style={{ padding: '12px 8px', textAlign: 'right' }}>Subtotal</div>
                  <div style={{ padding: '12px 8px', textAlign: 'center' }}></div>
                </div>

                {/* Tabla Body - Scrollable */}
                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                  {orderItems.length === 0 ? (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', gap: '10px', padding: '40px' }}>
                      <ShoppingBag size={32} style={{ opacity: 0.3 }} />
                      <span style={{ fontSize: '13px' }}>Selecciona prendas del catálogo</span>
                      <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Los productos aparecerán aquí</span>
                    </div>
                  ) : (
                    orderItems.map((item, idx) => {
                      const unitPrice = getItemUnitPrice(item);
                      const discountPct = itemDiscounts[item.uniqueId] || 0;
                      const lineSubtotal = unitPrice * item.quantity * (1 - discountPct / 100);
                      const isEditing = editingItemId === item.uniqueId;
                      // Indicador mayoreo: sumar todas las variantes del mismo producto base
                      const totalQtyBase = orderItems.filter(i => i.id === item.id).reduce((s, i) => s + i.quantity, 0);
                      const minWholesale = item.wholesale_min_qty || 6;
                      const isWholesaleActive = item.wholesale_price && totalQtyBase >= minWholesale;

                      return (
                        <div
                          key={item.uniqueId}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '70px 1fr 100px 80px 100px 70px',
                            borderBottom: '1px solid #F3F4F6',
                            alignItems: 'center',
                            fontSize: '13px',
                            transition: 'background-color 0.15s',
                            backgroundColor: isEditing ? '#FFFBEB' : (idx % 2 === 0 ? '#FFF' : '#FAFBFC')
                          }}
                        >
                          {/* Cantidad */}
                          <div style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 500 }}>
                            {item.quantity}
                          </div>

                          {/* Detalle */}
                          <div style={{ padding: '10px 10px' }}>
                            <div style={{ fontWeight: 500, fontSize: '13px', lineHeight: 1.3 }}>{item.detailName}</div>
                            {isWholesaleActive && (
                              <span style={{ fontSize: '10px', fontWeight: 700, color: '#065F46', backgroundColor: '#D1FAE5', padding: '1px 5px', display: 'inline-block', marginTop: '2px', border: '1px solid #6EE7B7', letterSpacing: '0.03em' }}>
                                MAYOREO ({totalQtyBase} uds)
                              </span>
                            )}
                            {item.wholesale_price && !isWholesaleActive && (
                              <span style={{ fontSize: '10px', color: '#9CA3AF', display: 'block', marginTop: '1px' }}>
                                Mayoreo desde {minWholesale} uds · llevas {totalQtyBase}
                              </span>
                            )}
                          </div>

                          {/* $/unidad */}
                          <div style={{ padding: '10px 8px', textAlign: 'right', color: '#374151' }}>
                            S/ {formatNoRound(unitPrice)}
                          </div>

                          {/* % desc. */}
                          <div style={{ padding: '10px 8px', textAlign: 'center' }}>
                            {isEditing ? (
                              <input
                                type="number"
                                min="0"
                                max="100"
                                autoFocus
                                value={discountPct}
                                onChange={e => {
                                  const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                                  setItemDiscounts({ ...itemDiscounts, [item.uniqueId]: val });
                                }}
                                onBlur={() => setEditingItemId(null)}
                                onKeyDown={e => { if (e.key === 'Enter') setEditingItemId(null); }}
                                style={{
                                  width: '50px',
                                  padding: '4px',
                                  border: '1px solid #D1D5DB',
                                  borderRadius: '4px',
                                  textAlign: 'center',
                                  fontSize: '12px',
                                  outline: 'none'
                                }}
                              />
                            ) : (
                              <span style={{ color: discountPct > 0 ? '#DC2626' : '#9CA3AF' }}>
                                {discountPct} %
                              </span>
                            )}
                          </div>

                          {/* Subtotal */}
                          <div style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: '#111' }}>
                            S/ {formatNoRound(lineSubtotal)}
                          </div>

                          {/* Acciones */}
                          <div style={{ padding: '10px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <button
                              onClick={() => setEditingItemId(isEditing ? null : item.uniqueId)}
                              title="Editar descuento"
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                border: '1px solid #D1D5DB',
                                backgroundColor: isEditing ? '#FEF3C7' : '#F9FAFB',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#E5E7EB'; }}
                              onMouseLeave={e => { e.currentTarget.style.backgroundColor = isEditing ? '#FEF3C7' : '#F9FAFB'; }}
                            >
                              <Pencil size={13} color="#6B7280" />
                            </button>
                            <button
                              onClick={() => removeFromOrder(item.uniqueId)}
                              title="Eliminar"
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                border: '1px solid #D1D5DB',
                                backgroundColor: '#F9FAFB',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#FEE2E2'; e.currentTarget.style.borderColor = '#FCA5A5'; }}
                              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB'; }}
                            >
                              <X size={13} color="#6B7280" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* ===================== Barra Inferior Integrada ===================== */}
                <div style={{ borderTop: '2px solid #E5E7EB' }}>
                  
                  {/* Fila de Confirmar */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    backgroundColor: '#F3F4F6'
                  }}>
                    <span style={{ fontSize: '12px', color: '#6B7280' }}>
                      Nr. Líneas: {orderItems.length} / Tot. Ítems: {totalItemsCount}
                    </span>
                    <button
                      onClick={() => {
                        if (orderItems.length === 0) {
                          setErrorMsg('Debes agregar al menos un polo al pedido.');
                          setTimeout(() => setErrorMsg(''), 2000);
                          return;
                        }
                        setCurrentStep('payment');
                      }}
                      style={{
                        padding: '10px 28px',
                        backgroundColor: '#0EA5E9',
                        color: '#FFF',
                        border: 'none',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        borderRadius: '6px',
                        transition: 'all 0.15s',
                        letterSpacing: '0.02em'
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#0284C7'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = '#0EA5E9'}
                    >
                      Confirmar
                    </button>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ==================== PASO 3: PAGO & VUELTO ==================== */}
          {currentStep === 'payment' && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
              <div className="card" style={{ maxWidth: '650px', width: '100%', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button onClick={() => setCurrentStep('sales')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    ← Regresar al Pedido
                  </button>
                  <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Paso 3: Totalización & Método de Pago</h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '24px' }}>
                  
                  {/* Columna Izquierda: Métodos de pago */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>Selecciona Método de Pago</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {['Efectivo', 'Tarjeta', 'Yape', 'Plin', 'Transferencia'].map(method => (
                          <button
                            key={method}
                            type="button"
                            onClick={() => setPaymentMethod(method)}
                            style={{
                              padding: '10px 6px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: paymentMethod === method ? 'var(--text-primary)' : '#FFF',
                              color: paymentMethod === method ? '#FFF' : 'var(--text-primary)',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 600
                            }}
                          >
                            {method}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Flujo Efectivo (Caja registradora real) */}
                    {paymentMethod === 'Efectivo' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px', backgroundColor: '#F9F9F9', border: '1px solid var(--border-color)' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Dinero Recibido (S/.)</label>
                          <input 
                            type="number" 
                            placeholder="Monto entregado por cliente" 
                            value={receivedAmount} 
                            onChange={e => setReceivedAmount(e.target.value)} 
                            style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid var(--border-color)', fontWeight: 'bold' }} 
                          />
                        </div>

                        {receivedAmount && (() => {
                          const received = parseFloat(receivedAmount) || 0;
                          const change = received - total;
                          const isOk = change >= 0;
                          return (
                            <div style={{
                              padding: '10px',
                              fontSize: '14px',
                              fontWeight: 700,
                              backgroundColor: isOk ? '#EBFBEE' : '#FFF5F5',
                              color: isOk ? '#2F855A' : '#C53030',
                              border: '1px solid',
                              borderColor: isOk ? '#C6F6D5' : '#FED7D7',
                              textAlign: 'center'
                            }}>
                              {isOk 
                                ? `Vuelto a entregar: S/. ${change.toFixed(2)}` 
                                : `Monto insuficiente (Falta S/. ${Math.abs(change).toFixed(2)})`
                              }
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Columna Derecha: Resumen de Compra Detallado en Tabla */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '1px solid var(--border-color)', paddingLeft: '20px' }}>
                    <h4 style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Resumen de Venta</h4>
                    <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div><strong>Documento:</strong> {documentType}</div>
                      <div><strong>Cliente:</strong> {documentType === 'Sin Datos' ? (ticketCustomerData.name || 'Genérico') : (customers.find(c => c.id === selectedCustomerId)?.name || 'Genérico')}</div>
                      <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />
                      
                      {/* Tabla compacta del pedido */}
                      <div style={{ border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden', marginTop: '4px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#F9F9F9', borderBottom: '1px solid var(--border-color)' }}>
                              <th style={{ padding: '6px 8px' }}>Polo</th>
                              <th style={{ padding: '6px 8px', textAlign: 'center' }}>Cant.</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orderItems.map(item => {
                              const price = getItemUnitPrice(item);
                              const discPct = itemDiscounts[item.uniqueId] || 0;
                              const lineTotal = price * item.quantity * (1 - discPct / 100);
                              return (
                                <tr key={item.uniqueId} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                  <td style={{ padding: '6px 8px' }}>
                                    <div style={{ fontWeight: 500 }}>{item.detailName}</div>
                                    {discPct > 0 && <div style={{ fontSize: '9px', color: '#DC2626' }}>-{discPct}% desc.</div>}
                                  </td>
                                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>{item.quantity}</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>S/. {formatNoRound(lineTotal)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />
                      {discountAmount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#DC2626', fontSize: '12px' }}>
                          <span>Descuento manual:</span>
                          <span>- S/. {formatNoRound(discountAmount)}</span>
                        </div>
                      )}
                      <div style={{ fontSize: '16px', fontWeight: 700, display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                        <span>TOTAL:</span>
                        <span style={{ color: 'var(--color-primary)' }}>S/. {total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                </div>

                <button
                  onClick={handleConfirmSale}
                  disabled={paymentMethod === 'Efectivo' && (parseFloat(receivedAmount) || 0) < total}
                  className="btn-primary"
                  style={{
                    width: '100%',
                    padding: '14px',
                    fontSize: '14px',
                    borderRadius: '0px',
                    marginTop: '10px',
                    opacity: (paymentMethod === 'Efectivo' && (parseFloat(receivedAmount) || 0) < total) ? 0.5 : 1,
                    cursor: (paymentMethod === 'Efectivo' && (parseFloat(receivedAmount) || 0) < total) ? 'not-allowed' : 'pointer'
                  }}
                >
                  CONFIRMAR Y EMITIR COMPROBANTE
                </button>
              </div>
            </div>
          )}

          {/* ==================== MODAL: ATRIBUTOS DE PRENDA ==================== */}
          {showProdModal && activeProduct && (() => {
            // Siempre leer datos frescos del estado products para tener stock actualizado
            const freshProd = products.find(p => p.id === activeProduct.id) || activeProduct;
            return (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="card" style={{ backgroundColor: '#FFF', padding: '24px', maxWidth: '440px', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Seleccionar Atributos del Polo</h3>
                  <button onClick={() => setShowProdModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <img src={freshProd.image_url} alt="" style={{ width: '60px', height: '75px', objectFit: 'cover' }} />
                  <div>
                    <strong style={{ fontSize: '14px', display: 'block' }}>{freshProd.name}</strong>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>SKU: {freshProd.sku}</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginTop: '4px' }}>S/. {(freshProd.offer_price || freshProd.price).toFixed(2)}</span>
                  </div>
                </div>

                {/* Selector de Color */}
                {freshProd.colors?.length > 0 && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>Color del Polo</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      {freshProd.colors.map(c => {
                        const isSelected = selectedColor?.hex === c.hex;
                        return (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => setSelectedColor(c)}
                            title={`${c.name} (Stock: ${c.stock} uds)`}
                            style={{
                              padding: '6px 12px',
                              border: isSelected ? '2px solid var(--text-primary)' : '1px solid var(--border-color)',
                              backgroundColor: '#FFF',
                              fontSize: '12px',
                              cursor: c.stock <= 0 ? 'not-allowed' : 'pointer',
                              opacity: c.stock <= 0 ? 0.4 : 1,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: c.hex, border: '1px solid rgba(0,0,0,0.1)' }} />
                            <span>{c.name} ({c.stock})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Selector de Talla */}
                {freshProd.sizes?.length > 0 && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>Talla</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {freshProd.sizes.map(size => {
                        const isSelected = selectedSize === size;
                        const sizeStock = selectedColor && selectedColor.sizes_stock
                          ? (selectedColor.sizes_stock[size] !== undefined ? selectedColor.sizes_stock[size] : 0)
                          : 0;
                        return (
                          <button
                            key={size}
                            type="button"
                            onClick={() => setSelectedSize(size)}
                            style={{
                              padding: '8px 12px',
                              border: isSelected ? '2px solid var(--text-primary)' : '1px solid var(--border-color)',
                              backgroundColor: isSelected ? 'var(--text-primary)' : '#FFF',
                              color: isSelected ? '#FFF' : 'var(--text-primary)',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 600,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center'
                            }}
                          >
                            <span>{size}</span>
                            {selectedColor && (
                              <span style={{ fontSize: '9px', fontWeight: 'normal', opacity: 0.8 }}>({sizeStock})</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Cantidad */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>Cantidad</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button type="button" onClick={() => setSelectedQty(q => Math.max(1, q - 1))} style={{ padding: '6px 12px', border: '1px solid var(--border-color)', cursor: 'pointer' }}>-</button>
                    <input 
                      type="number" 
                      min="1" 
                      value={selectedQty} 
                      onChange={e => setSelectedQty(Math.max(1, parseInt(e.target.value) || 1))} 
                      style={{ width: '60px', padding: '6px', textAlign: 'center', border: '1px solid var(--border-color)' }} 
                    />
                    <button type="button" onClick={() => setSelectedQty(q => q + 1)} style={{ padding: '6px 12px', border: '1px solid var(--border-color)', cursor: 'pointer' }}>+</button>
                  </div>
                </div>

                <button
                  onClick={handleAddProductWithDetails}
                  className="btn-primary"
                  style={{ width: '100%', padding: '12px', borderRadius: '0px', fontSize: '13px', marginTop: '8px' }}
                >
                  Añadir al Pedido
                </button>
              </div>
            </div>
            );
          })()}

          {/* MODAL NUEVO CLIENTE */}
          {showCustModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <form onSubmit={handleCreateCustomer} style={{ backgroundColor: '#FFF', padding: '30px', border: '1px solid var(--border-color)', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 500 }}>Registrar Cliente</h3>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Nombre</label>
                  <input type="text" required className="input-field" value={newCust.name} onChange={e => setNewCust({ ...newCust, name: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>DNI / RUC</label>
                  <input type="text" className="input-field" value={newCust.document_number} onChange={e => setNewCust({ ...newCust, document_number: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Teléfono</label>
                  <input type="text" className="input-field" value={newCust.phone} onChange={e => setNewCust({ ...newCust, phone: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button type="button" onClick={() => setShowCustModal(false)} className="btn-secondary" style={{ flex: 1, borderRadius: '0px' }}>Cancelar</button>
                  <button type="submit" className="btn-primary" style={{ flex: 1, borderRadius: '0px' }}>Guardar</button>
                </div>
              </form>
            </div>
          )}

          {/* ==================== MODAL: DATOS OPCIONALES CLIENTE (TICKET) ==================== */}
          {showTicketCustomerModal && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 3500,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '20px'
            }}>
              <div style={{
                backgroundColor: '#FFF',
                padding: '28px',
                border: '1px solid var(--border-color)',
                width: '100%',
                maxWidth: '420px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.15)'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: '48px', height: '48px',
                    backgroundColor: '#F0FFF4',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 12px'
                  }}>
                    <UserPlus size={22} color="#38A169" />
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Datos del Cliente (Opcional)</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Puedes agregar datos del cliente para el ticket.<br />
                    Si agregas un número de teléfono, podrás enviar el comprobante por WhatsApp.
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: '#374151' }}>
                    Nombre del cliente
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Juan Pérez"
                    className="input-field"
                    value={ticketCustomerData.name}
                    onChange={e => setTicketCustomerData({ ...ticketCustomerData, name: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: '#374151' }}>
                    📱 Teléfono / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 987654321"
                    className="input-field"
                    value={ticketCustomerData.phone}
                    onChange={e => setTicketCustomerData({ ...ticketCustomerData, phone: e.target.value })}
                  />
                  <span style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '2px', display: 'block' }}>
                    Si proporcionas un número, podrás compartir el ticket por WhatsApp
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: '#374151' }}>
                    DNI
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 12345678"
                    className="input-field"
                    value={ticketCustomerData.document_number}
                    onChange={e => setTicketCustomerData({ ...ticketCustomerData, document_number: e.target.value })}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setTicketCustomerData({ name: '', phone: '', document_number: '' });
                      setShowTicketCustomerModal(false);
                    }}
                    className="btn-secondary"
                    style={{ flex: 1, borderRadius: '0px', fontSize: '13px' }}
                  >
                    Omitir
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTicketCustomerModal(false)}
                    className="btn-primary"
                    style={{ flex: 1, borderRadius: '0px', fontSize: '13px' }}
                  >
                    {ticketCustomerData.name || ticketCustomerData.phone ? 'Guardar y Continuar' : 'Continuar'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* MODAL DE AUTORIZACIÓN DEL ADMINISTRADOR - Siempre accesible */}
      {showAuthModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleAdminAuthSubmit} style={{ backgroundColor: '#FFF', padding: '30px', border: '2px solid var(--text-primary)', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <ShieldAlert size={20} style={{ color: 'var(--color-secondary)' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 600 }}>
                {adminVerifiedName ? 'Apertura de Caja' : 'Autorización del Administrador'}
              </h3>
            </div>
            
            {adminVerifiedName ? (
              <>
                <p style={{ fontSize: '12px', color: 'green', fontWeight: 600 }}>
                  ✓ Admin verificado: {adminVerifiedName}
                </p>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Monto de Apertura (S/.)</label>
                  <input 
                    type="number"
                    step="0.01"
                    required 
                    placeholder="100.00" 
                    className="input-field" 
                    value={authOpeningAmount} 
                    onChange={e => setAuthOpeningAmount(e.target.value)} 
                  />
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Esta acción requiere credenciales de seguridad de un Administrador para habilitar el turno en caja.
                </p>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Correo de Administrador</label>
                  <input 
                    type="email" 
                    required 
                    placeholder="admin@carrillostore.com" 
                    className="input-field" 
                    value={authEmail} 
                    onChange={e => setAuthEmail(e.target.value)} 
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Contraseña</label>
                  <input 
                    type="password" 
                    required 
                    placeholder="••••••••" 
                    className="input-field" 
                    value={authPassword} 
                    onChange={e => setAuthPassword(e.target.value)} 
                  />
                </div>
              </>
            )}

            {authError && (
              <span style={{ fontSize: '11px', color: 'var(--color-secondary)', fontWeight: 600 }}>
                {authError}
              </span>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button type="button" onClick={() => { setShowAuthModal(false); setAdminVerifiedName(''); }} className="btn-secondary" style={{ flex: 1, borderRadius: '0px', fontSize: '13px' }}>Cancelar</button>
              <button type="submit" className="btn-primary" style={{ flex: 1, borderRadius: '0px', fontSize: '13px' }}>
                {adminVerifiedName ? 'Abrir Caja' : 'Autorizar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL TICKET (Sin Datos) */}
      {showPrintModal && lastCreatedSale && lastCreatedSale.document_type === 'Sin Datos' && (() => {
        const saleDate = new Date(lastCreatedSale.created_at);
        const items = lastCreatedSale.items;
        const hasPhone = lastCreatedSale.customer_phone && lastCreatedSale.customer_phone.trim().length > 0;
        return (
          <div className="ticket-print-container" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 5000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}>
            <div style={{
              backgroundColor: '#FFF', width: '100%', maxWidth: '320px',
              maxHeight: '90vh', overflowY: 'auto',
              fontFamily: "'Courier New', Courier, monospace", fontSize: '12px', color: '#000',
              padding: '24px 20px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: '1px dashed #ccc'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '0.05em' }}>CARRILLO STORE</div>
                <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>Av. Larco 123, Miraflores</div>
                <div style={{ fontSize: '10px', color: '#666' }}>Lima - Perú</div>
                <div style={{ fontSize: '10px', color: '#666' }}>Tel: +51 987 654 321</div>
              </div>
              <div style={{ borderTop: '1px dashed #333', margin: '8px 0' }} />
              <div style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>TICKET:</span><span style={{ fontWeight: 700 }}>{lastCreatedSale.invoice_number}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>FECHA:</span><span>{saleDate.toLocaleDateString()}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>HORA:</span><span>{saleDate.toLocaleTimeString()}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>CAJERO:</span><span>{lastCreatedSale.operator}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>CLIENTE:</span><span>{lastCreatedSale.customer_name}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>PAGO:</span><span>{lastCreatedSale.payment_method}</span></div>
              </div>
              <div style={{ borderTop: '1px dashed #333', margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: '4px', fontSize: '11px' }}>
                <span style={{ flex: 2 }}>PRODUCTO</span>
                <span style={{ flex: 0.5, textAlign: 'center' }}>CTD</span>
                <span style={{ flex: 1, textAlign: 'right' }}>P.U.</span>
                <span style={{ flex: 1, textAlign: 'right' }}>TOTAL</span>
              </div>
              <div style={{ borderTop: '1px solid #ddd', margin: '2px 0 4px 0' }} />
              {items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px' }}>
                  <span style={{ flex: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product_name}</span>
                  <span style={{ flex: 0.5, textAlign: 'center' }}>{item.quantity}</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>{formatNoRound(item.unit_price)}</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>{formatNoRound(item.quantity * item.unit_price)}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px dashed #333', margin: '8px 0' }} />
              <div style={{ marginBottom: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>SUBTOTAL:</span><span>S/. {formatNoRound(lastCreatedSale.total_amount + lastCreatedSale.discount_amount)}</span>
                </div>
                {lastCreatedSale.discount_amount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e02424' }}>
                    <span>DESCUENTO:</span><span>- S/. {formatNoRound(lastCreatedSale.discount_amount)}</span>
                  </div>
                )}
                <div style={{ borderTop: '1px solid #333', margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '15px' }}>
                  <span>TOTAL:</span><span>S/. {formatNoRound(lastCreatedSale.total_amount)}</span>
                </div>
              </div>
              <div style={{ borderTop: '1px dashed #333', margin: '8px 0' }} />
              <div style={{ textAlign: 'center', fontSize: '10px', color: '#666' }}>
                <div>¡Gracias por tu compra!</div>
                <div>Cambios hasta 7 días con ticket</div>
                <div style={{ marginTop: '6px' }}>www.carrillostore.com</div>
              </div>
              <div style={{ borderTop: '1px dashed #333', margin: '12px 0' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px', fontFamily: 'inherit' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => window.print()} className="btn-primary" style={{ flex: 1, display: 'flex', gap: '6px', justifyContent: 'center', borderRadius: '0px', fontSize: '12px', padding: '10px' }}>
                    🖨️ Imprimir
                  </button>
                  <button onClick={() => { setShowPrintModal(false); setLastCreatedSale(null); }} className="btn-secondary" style={{ flex: 1, borderRadius: '0px', fontSize: '12px', padding: '10px' }}>
                    Continuar
                  </button>
                </div>
                {/* WhatsApp Button - only if phone exists */}
                {hasPhone && (
                  <button
                    onClick={() => {
                      const msg = generateWhatsAppMessage(lastCreatedSale);
                      openWhatsApp(lastCreatedSale.customer_phone, msg);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px',
                      backgroundColor: '#25D366',
                      color: '#FFF',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      borderRadius: '0px',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1EBE5A'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#25D366'}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Enviar por WhatsApp
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL BOLETA / FACTURA SUNAT */}
      {showPrintModal && lastCreatedSale && lastCreatedSale.document_type !== 'Sin Datos' && (() => {
        const saleDate = new Date(lastCreatedSale.created_at);
        const items = lastCreatedSale.items;
        const isFactura = lastCreatedSale.document_type === 'Factura';
        const hasPhone = lastCreatedSale.customer_phone && lastCreatedSale.customer_phone.trim().length > 0;

        const itemsWithTax = items.map(item => {
          const precioVentaUnitario = item.unit_price;
          const valorVentaUnitario = Math.trunc((precioVentaUnitario / 1.18) * 100) / 100;
          const igvUnitario = Math.trunc((valorVentaUnitario * 0.18) * 100) / 100;
          const totalBase = valorVentaUnitario * item.quantity;
          const totalIgv = igvUnitario * item.quantity;
          return { ...item, valorVentaUnitario, igvUnitario, totalBase, totalIgv };
        });

        const totalBaseGravada = itemsWithTax.reduce((sum, i) => sum + i.totalBase, 0);
        const totalIGV = itemsWithTax.reduce((sum, i) => sum + i.totalIgv, 0);
        const descuento = lastCreatedSale.discount_amount;
        const totalImporte = totalBaseGravada + totalIGV - descuento;

        return (
          <div className="invoice-print-container" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 5000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}>
            <div style={{
              backgroundColor: '#FFF', padding: '32px', border: '2px solid #1a1a2e',
              maxWidth: '580px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: '0',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
              fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
            }}>
              {/* CABECERA */}
              <div style={{ display: 'flex', gap: '20px', paddingBottom: '16px', borderBottom: '2px solid #1a1a2e', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#1a1a2e', letterSpacing: '0.03em' }}>CARRILLO STORE S.A.C.</div>
                  <div style={{ fontSize: '11px', color: '#555', marginTop: '4px', lineHeight: 1.5 }}>
                    Av. Larco 123, Miraflores<br />Lima - Lima - Perú<br />Tel: +51 987 654 321<br />Email: ventas@carrillostore.com
                  </div>
                </div>
                <div style={{ border: '2px solid #c0392b', padding: '12px 16px', textAlign: 'center', minWidth: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: '#c0392b', letterSpacing: '0.05em' }}>R.U.C. N° 20601234567</div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#c0392b' }}>{isFactura ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA'}</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#c0392b' }}>N° {lastCreatedSale.invoice_number}</div>
                </div>
              </div>

              {/* DATOS ADQUIRIENTE */}
              <div style={{ border: '1px solid #ddd', padding: '12px 14px', fontSize: '12px', marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px', backgroundColor: '#FAFAFA' }}>
                <div><strong>Adquiriente:</strong> {lastCreatedSale.customer_name}</div>
                <div><strong>Doc. Identidad:</strong> {lastCreatedSale.customer_document}</div>
                <div><strong>Fecha de Emisión:</strong> {saleDate.toLocaleDateString()}</div>
                <div><strong>Hora:</strong> {saleDate.toLocaleTimeString()}</div>
                <div><strong>Moneda:</strong> SOLES (PEN)</div>
                <div><strong>Forma de Pago:</strong> {lastCreatedSale.payment_method}</div>
              </div>

              {/* TABLA DE ITEMS */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left', marginBottom: '16px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1a1a2e', color: '#FFF' }}>
                    <th style={{ padding: '8px 6px', fontWeight: 600 }}>Cantidad</th>
                    <th style={{ padding: '8px 6px', fontWeight: 600 }}>Unidad</th>
                    <th style={{ padding: '8px 6px', fontWeight: 600 }}>Descripción</th>
                    <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600 }}>Valor Unitario</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsWithTax.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #eee', backgroundColor: idx % 2 === 0 ? '#FFF' : '#F9F9FB' }}>
                      <td style={{ padding: '8px 6px' }}>{item.quantity}</td>
                      <td style={{ padding: '8px 6px' }}>NIU</td>
                      <td style={{ padding: '8px 6px' }}>{item.product_name}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right' }}>S/. {formatNoRound(item.valorVentaUnitario)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* RESUMEN TRIBUTARIO */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <div style={{ width: '280px', border: '1px solid #ddd', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #eee' }}>
                    <span>Op. Gravada (Base):</span><span>S/. {formatNoRound(totalBaseGravada)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #eee', color: '#c0392b', fontWeight: 600 }}>
                    <span>I.G.V. (18%):</span><span>S/. {formatNoRound(totalIGV)}</span>
                  </div>
                  {descuento > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #eee', color: '#e67e22' }}>
                      <span>Descuento:</span><span>- S/. {formatNoRound(descuento)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', fontWeight: 700, fontSize: '15px', backgroundColor: '#1a1a2e', color: '#FFF' }}>
                    <span>IMPORTE TOTAL:</span><span>S/. {formatNoRound(totalImporte)}</span>
                  </div>
                </div>
              </div>

              {/* ESTADO */}
              <div style={{ textAlign: 'center', padding: '8px', marginBottom: '12px', border: '2px solid #059669', color: '#059669', fontWeight: 700, fontSize: '13px', letterSpacing: '0.05em' }}>
                ✓ COMPROBANTE EMITIDO
              </div>

              {/* QR + Pie */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderTop: '1px solid #ddd', paddingTop: '14px', marginBottom: '16px' }}>
                <svg width="60" height="60" viewBox="0 0 100 100" fill="none" stroke="#111" strokeWidth="4">
                  <rect x="10" y="10" width="80" height="80" strokeWidth="2" />
                  <rect x="20" y="20" width="20" height="20" />
                  <rect x="60" y="20" width="20" height="20" />
                  <rect x="20" y="60" width="20" height="20" />
                  <line x1="50" y1="20" x2="50" y2="80" strokeWidth="2" strokeDasharray="4 4" />
                  <line x1="20" y1="50" x2="80" y2="50" strokeWidth="2" strokeDasharray="4 4" />
                </svg>
                <div style={{ fontSize: '9px', color: '#888', lineHeight: 1.5 }}>
                  Representación impresa de la {isFactura ? 'Factura' : 'Boleta de Venta'} Electrónica.
                  Consulte en: <strong>carrillostore.com/consultas</strong><br />
                  Autorizado mediante resolución SUNAT N° 034-2020/SUNAT.<br />
                  Hash: {btoa(lastCreatedSale.invoice_number).slice(0, 24)}
                </div>
              </div>

              {/* Botones */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => window.print()} className="btn-primary" style={{ flex: 1, display: 'flex', gap: '8px', justifyContent: 'center', borderRadius: '0px', fontSize: '13px', padding: '12px' }}>
                    🖨️ Imprimir Comprobante
                  </button>
                  <button onClick={() => { setShowPrintModal(false); setLastCreatedSale(null); }} className="btn-secondary" style={{ flex: 1, borderRadius: '0px', fontSize: '13px', padding: '12px' }}>
                    Continuar
                  </button>
                </div>
                {/* WhatsApp Button - only if phone exists */}
                {hasPhone && (
                  <button
                    onClick={() => {
                      const msg = generateWhatsAppMessage(lastCreatedSale);
                      openWhatsApp(lastCreatedSale.customer_phone, msg);
                    }}
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: '#25D366',
                      color: '#FFF',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      borderRadius: '0px',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1EBE5A'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#25D366'}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Enviar Comprobante por WhatsApp
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* CSS de impresión — oculta todo excepto el comprobante */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .invoice-print-container, .invoice-print-container *,
          .ticket-print-container, .ticket-print-container * { visibility: visible; }
          .invoice-print-container, .ticket-print-container {
            position: absolute; left: 0; top: 0; width: 100%; height: auto; background: #FFF;
          }
          .invoice-print-container button,
          .ticket-print-container button { display: none !important; }
        }
      `}
      </style>

    </div>
  );
}
