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
  const [whatsappNumber, setWhatsappNumber] = useState('');

  // NEW: Item-level discount (% per item)
  const [itemDiscounts, setItemDiscounts] = useState({}); // { [uniqueId]: number }
  const [editingItemId, setEditingItemId] = useState(null);

  // NEW: Ticket customer data modal (optional for "Sin Datos")
  const [showTicketCustomerModal, setShowTicketCustomerModal] = useState(false);
  const [ticketCustomerData, setTicketCustomerData] = useState({ name: '', phone: '', document_number: '' });

  // NEW: Bottom bar client search
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [config, setConfig] = useState(null);

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
  // (distintos colores/tallas) alcanza el minimo mayorista. También aplica precios por talla y promociones simples.
  const getProductGroupTotalPrice = (productId, groupItems, product) => {
    if (!product) return 0;
    
    // Extraer configuraciones de tallas y promociones simples
    const sizePrices = (product.wholesale_tiers || []).find(t => t.type === 'size_prices')?.data || {};
    const simplePromos = (product.wholesale_tiers || []).find(t => t.type === 'simple_promos')?.data || [];

    const totalQty = groupItems.reduce((sum, i) => sum + i.quantity, 0);

    // Calcular cantidad por talla en la orden
    const sizeQuantities = {};
    groupItems.forEach(i => {
      sizeQuantities[i.selectedSize] = (sizeQuantities[i.selectedSize] || 0) + i.quantity;
    });

    // Expandir variantes en unidades individuales
    const units = [];
    groupItems.forEach(item => {
      const size = item.selectedSize;
      const sizePriceData = sizePrices[size];
      
      const regularPrice = (sizePriceData?.offer_price && sizePriceData.offer_price !== '')
        ? parseFloat(sizePriceData.offer_price)
        : ((sizePriceData?.price && sizePriceData.price !== '')
          ? parseFloat(sizePriceData.price)
          : (product.offer_price !== null ? parseFloat(product.offer_price) : parseFloat(product.price)));

      for (let k = 0; k < item.quantity; k++) {
        units.push({
          regularPrice,
          size
        });
      }
    });

    // Ordenar promociones por cantidad descendente
    const sortedPromos = [...simplePromos]
      .filter(p => p.qty && p.price)
      .sort((a, b) => b.qty - a.qty);

    let remainingQty = totalQty;
    let totalPrice = 0;

    // Aplicar promociones simples de forma codiciosa (greedy)
    for (const promo of sortedPromos) {
      const promoQty = parseInt(promo.qty);
      const promoPrice = parseFloat(promo.price);
      while (remainingQty >= promoQty) {
        totalPrice += promoPrice;
        remainingQty -= promoQty;
      }
    }

    // Cobrar unidades restantes con precio unitario o mayorista (con variaciones por talla)
    if (remainingQty > 0) {
      const remainingUnits = units.slice(0, remainingQty);
      for (const unit of remainingUnits) {
        // Evaluar si aplica mayorista para la talla específica
        const sizeData = sizePrices[unit.size];
        const sizeTiers = sizeData?.wholesale_tiers || [];
        const sizeQty = sizeQuantities[unit.size] || 0;

        const matchedSizeTier = [...sizeTiers]
          .sort((a, b) => b.min_qty - a.min_qty)
          .find(t => sizeQty >= t.min_qty);

        if (matchedSizeTier) {
          totalPrice += parseFloat(matchedSizeTier.price);
        } else {
          totalPrice += unit.regularPrice;
        }
      }
    }

    return totalPrice;
  };

  const getItemUnitPrice = (item, allItems = orderItems) => {
    const freshProd = products.find(p => p.id === item.id) || item;
    const groupItems = allItems.filter(i => i.id === item.id);
    const totalQty = groupItems.reduce((sum, i) => sum + i.quantity, 0);
    
    if (totalQty === 0) {
      const sizePrices = (freshProd.wholesale_tiers || []).find(t => t.type === 'size_prices')?.data || {};
      const sizeData = sizePrices[item.selectedSize];
      const basePrice = (sizeData?.offer_price && sizeData.offer_price !== '')
        ? parseFloat(sizeData.offer_price)
        : ((sizeData?.price && sizeData.price !== '')
          ? parseFloat(sizeData.price)
          : (freshProd.offer_price !== null ? freshProd.offer_price : freshProd.price));
      return basePrice;
    }
    
    const totalGroupPrice = getProductGroupTotalPrice(item.id, groupItems, freshProd);
    return totalGroupPrice / totalQty;
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

  // WhatsApp functions — generate PDF, upload, and share link
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  const getImageDataUrl = (url) => {
    return new Promise((resolve) => {
      if (!url) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          resolve(dataUrl);
        } catch (err) {
          console.error('Error base64 image conversion:', err);
          resolve(null);
        }
      };
      img.onerror = () => {
        resolve(null);
      };
      img.src = url;
    });
  };

  const generatePdfBlob = async (sale) => {
    const { jsPDF } = window.jspdf || {};
    let activeJsPDF = jsPDF;
    if (!activeJsPDF) {
      const mod = await import('jspdf');
      activeJsPDF = mod.jsPDF || mod.default;
    }
    
    const isInvoice = sale.document_type === 'Boleta' || sale.document_type === 'Factura';
    
    let logoBase64 = null;
    if (config?.storeLogoUrl) {
      logoBase64 = await getImageDataUrl(config.storeLogoUrl);
    }

    if (isInvoice) {
      // Create A4 premium styled layout for PDF downloads and WhatsApp sharing
      const doc = new activeJsPDF({ unit: 'mm', format: 'a4' });
      return _buildInvoicePdf(doc, sale, logoBase64);
    } else {
      // Keep thermal ticket format for sales tickets
      const doc = new activeJsPDF({ unit: 'mm', format: [80, 250] });
      return _buildPdf(doc, sale, logoBase64);
    }
  };

  const _buildInvoicePdf = (doc, sale, logoBase64) => {
    const storeName = (config?.businessName || config?.storeName || 'ARVEN').toUpperCase();
    const address = config?.fiscalAddress || 'Dirección Fiscal';
    const phone = config?.ticketPhone || '';
    const email = config?.ticketEmail || '';
    const ruc = config?.ruc || '20601234567';
    const saleDate = new Date(sale.created_at);
    const isFactura = sale.document_type === 'Factura';

    // Primary Colors from design
    const colorDark = [17, 17, 17]; // #111
    const colorGold = [197, 168, 128]; // #C5A880
    const colorLightBg = [250, 250, 250]; // #FAFAFA

    // Header layout
    // Draw Dark Header Banner
    doc.setFillColor(colorDark[0], colorDark[1], colorDark[2]);
    doc.rect(0, 0, 210, 42, 'F');

    // Draw Gold accent bar under banner
    doc.setFillColor(colorGold[0], colorGold[1], colorGold[2]);
    doc.rect(0, 42, 210, 3, 'F');

    // Logo / Business Name in Dark Header
    let textX = 15;
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', 15, 8, 38, 25);
        textX = 60;
      } catch (err) {
        console.error('Error rendering logo in Invoice PDF:', err);
      }
    }

    // Company info
    doc.setTextColor(255, 255, 255);
    if (!logoBase64) {
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text(storeName, 15, 18);
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(200, 200, 200);
      doc.text(address, 15, 26, { maxWidth: 100 });
      if (phone || email) {
        doc.text(`${phone ? 'Tel: ' + phone : ''} ${email ? '| Email: ' + email : ''}`, 15, 33);
      }
    } else {
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(200, 200, 200);
      doc.text(address, textX, 16, { maxWidth: 85 });
      if (phone || email) {
        doc.text(`${phone ? 'Tel: ' + phone : ''} ${email ? '| Email: ' + email : ''}`, textX, 28);
      }
    }

    // Document Box in Header (Floating card on the right)
    const boxX = 145;
    const boxY = 7;
    const boxW = 50;
    const boxH = 28;
    
    // Draw outer box
    doc.setDrawColor(colorGold[0], colorGold[1], colorGold[2]);
    doc.setLineWidth(0.6);
    doc.setFillColor(26, 26, 46); // dark navy
    doc.rect(boxX, boxY, boxW, boxH, 'FD');

    doc.setTextColor(colorGold[0], colorGold[1], colorGold[2]);
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text(`R.U.C. N° ${ruc}`, boxX + (boxW/2), boxY + 7, { align: 'center' });

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    const docLabel = isFactura ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA';
    doc.text(docLabel, boxX + (boxW/2), boxY + 15, { align: 'center' });

    doc.setTextColor(colorGold[0], colorGold[1], colorGold[2]);
    doc.setFontSize(11);
    doc.text(`N° ${sale.invoice_number}`, boxX + (boxW/2), boxY + 23, { align: 'center' });

    // Client card / Details section
    let y = 58;
    
    // Title
    doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('DATOS DEL ADQUIRIENTE', 15, y);
    y += 4;

    // Draw background card for client info
    doc.setFillColor(colorLightBg[0], colorLightBg[1], colorLightBg[2]);
    doc.setDrawColor(229, 231, 235); // #E5E7EB
    doc.setLineWidth(0.2);
    doc.rect(15, y, 180, 26, 'FD');

    // Details grid
    doc.setTextColor(107, 114, 128); // #6B7280
    doc.setFontSize(7);
    doc.text('CLIENTE', 20, y + 6);
    doc.text('DOC. IDENTIDAD', 110, y + 6);
    
    doc.text('FECHA DE EMISIÓN', 20, y + 15);
    doc.text('HORA DE EMISIÓN', 70, y + 15);
    doc.text('FORMA DE PAGO', 120, y + 15);
    doc.text('MONEDA', 165, y + 15);

    doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
    doc.setFontSize(8.5);
    doc.setFont(undefined, 'bold');
    doc.text(sale.customer_name, 20, y + 10);
    doc.text(sale.customer_document || '—', 110, y + 10);
    
    doc.text(saleDate.toLocaleDateString('es-PE'), 20, y + 19);
    doc.text(saleDate.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true }), 70, y + 19);
    doc.text(sale.payment_method, 120, y + 19);
    doc.text('SOLES (PEN)', 165, y + 19);

    y += 36;

    // Table of Items
    doc.setFillColor(colorDark[0], colorDark[1], colorDark[2]);
    doc.rect(15, y, 180, 8, 'F');

    doc.setTextColor(colorGold[0], colorGold[1], colorGold[2]);
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.text('CANT.', 20, y + 5.5);
    doc.text('UNIDAD', 35, y + 5.5);
    doc.text('DESCRIPCIÓN', 55, y + 5.5);
    doc.text('V. UNIT.', 135, y + 5.5, { align: 'right' });
    doc.text('IGV (18%)', 160, y + 5.5, { align: 'right' });
    doc.text('TOTAL', 190, y + 5.5, { align: 'right' });

    y += 8;

    const items = sale.items || [];
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);

    items.forEach((item, idx) => {
      // Alternating row background
      if (idx % 2 === 1) {
        doc.setFillColor(250, 250, 250);
        doc.rect(15, y, 180, 8, 'F');
      }
      doc.setDrawColor(243, 244, 246); // #F3F4F6
      doc.line(15, y + 8, 195, y + 8);

      const precioVenta = item.unit_price;
      const valorVenta = precioVenta / 1.18;
      const igv = precioVenta - valorVenta;

      doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
      doc.text(String(item.quantity), 20, y + 5.5);
      doc.setTextColor(107, 114, 128);
      doc.text('NIU', 35, y + 5.5);
      doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
      
      const pName = item.product_name || item.detailName || 'Producto';
      const displayName = pName.length > 38 ? pName.substring(0, 38) + '…' : pName;
      doc.text(displayName, 55, y + 5.5);

      doc.text(`S/. ${formatNoRound(valorVenta)}`, 135, y + 5.5, { align: 'right' });
      doc.setTextColor(239, 68, 68); // light red for IGV
      doc.text(`S/. ${formatNoRound(igv * item.quantity)}`, 160, y + 5.5, { align: 'right' });
      doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
      doc.setFont(undefined, 'bold');
      doc.text(`S/. ${formatNoRound(item.quantity * precioVenta)}`, 190, y + 5.5, { align: 'right' });
      doc.setFont(undefined, 'normal');

      y += 8;
    });

    y += 8;

    // Totals card on bottom right
    const totX = 135;
    const totW = 60;
    const totalImporte = sale.total_amount;
    const totalBaseGravada = totalImporte / 1.18;
    const totalIGV = totalImporte - totalBaseGravada;
    const descuento = sale.discount_amount || 0;

    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.2);
    doc.setFillColor(255, 255, 255);
    doc.rect(totX, y, totW, descuento > 0 ? 32 : 24, 'FD');

    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('Op. Gravada (Base):', totX + 3, y + 5.5);
    doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
    doc.text(`S/. ${formatNoRound(totalBaseGravada)}`, totX + totW - 3, y + 5.5, { align: 'right' });

    y += 8;
    doc.setTextColor(239, 68, 68);
    doc.text('I.G.V. (18%):', totX + 3, y + 5.5);
    doc.text(`S/. ${formatNoRound(totalIGV)}`, totX + totW - 3, y + 5.5, { align: 'right' });

    if (descuento > 0) {
      y += 8;
      doc.setTextColor(245, 158, 11);
      doc.text('Descuento:', totX + 3, y + 5.5);
      doc.text(`- S/. ${formatNoRound(descuento)}`, totX + totW - 3, y + 5.5, { align: 'right' });
    }

    y += 8;
    // Total banner
    doc.setFillColor(colorDark[0], colorDark[1], colorDark[2]);
    doc.rect(totX, y, totW, 10, 'F');
    doc.setTextColor(colorGold[0], colorGold[1], colorGold[2]);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(9);
    doc.text('TOTAL:', totX + 4, y + 6.5);
    doc.text(`S/. ${formatNoRound(totalImporte)}`, totX + totW - 4, y + 6.5, { align: 'right' });

    y += 18;

    // Stamp / Resolution banner
    doc.setFillColor(5, 150, 105, 0.05); // light green bg
    doc.setDrawColor(5, 150, 105);
    doc.setLineWidth(0.4);
    doc.rect(15, y, 180, 8, 'FD');
    doc.setTextColor(5, 150, 105);
    doc.setFontSize(8.5);
    doc.text('COMPROBANTE EMITIDO DE ACUERDO A LA REGULACIÓN SUNAT', 105, y + 5.5, { align: 'center' });

    y += 15;

    // Footer info
    doc.setDrawColor(229, 231, 235);
    doc.line(15, y, 195, y);
    
    doc.setTextColor(156, 163, 175);
    doc.setFontSize(7.5);
    doc.setFont(undefined, 'normal');
    doc.text([
      `Representación impresa de la ${isFactura ? 'Factura' : 'Boleta de Venta'} Electrónica.`,
      `Consulte en: ${storeName.toLowerCase().replace(/\s/g, '')}.com/consultas`,
      'Autorizado mediante resolución SUNAT N° 034-2020/SUNAT.',
      `Hash: ${btoa(sale.invoice_number).slice(0, 24)}`
    ], 15, y + 5);

    return doc.output('blob');
  };

  const _buildPdf = (doc, sale, logoBase64) => {
    const storeName = (config?.businessName || config?.storeName || 'CARRILLO STORE').toUpperCase();
    const address = config?.fiscalAddress || '';
    const phone = config?.ticketPhone || '';
    const ruc = config?.ruc || '';
    const saleDate = new Date(sale.created_at);
    const isInvoice = sale.document_type === 'Boleta' || sale.document_type === 'Factura';
    let y = 8;
    const lm = 4; // left margin
    const pw = 72; // printable width

    // Header Logo
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', 25, y, 30, 15);
        y += 18;
      } catch (err) {
        console.error('Error drawing logo in PDF:', err);
      }
    }

    // Header
    if (!logoBase64) {
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(storeName, 40, y, { align: 'center' });
      y += 5;
    }

    if (ruc) {
      doc.setFontSize(7);
      doc.setFont(undefined, 'normal');
      doc.text(`RUC: ${ruc}`, 40, y, { align: 'center' });
      y += 3.5;
    }
    if (address) {
      doc.setFontSize(7);
      doc.text(address, 40, y, { align: 'center', maxWidth: pw });
      y += 3.5;
    }
    if (phone) {
      doc.setFontSize(7);
      doc.text(`Tel: ${phone}`, 40, y, { align: 'center' });
      y += 3.5;
    }

    // Divider
    y += 1;
    doc.setLineDashPattern([1, 1], 0);
    doc.line(lm, y, lm + pw, y);
    y += 4;

    // Document info
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    const docLabel = isInvoice ? (sale.document_type === 'Factura' ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA') : 'TICKET DE VENTA';
    doc.text(docLabel, 40, y, { align: 'center' });
    y += 4;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(7);
    doc.text(`N°: ${sale.invoice_number}`, lm, y); y += 3.5;
    doc.text(`Fecha: ${saleDate.toLocaleDateString()}`, lm, y);
    doc.text(`Hora: ${saleDate.toLocaleTimeString()}`, lm + 38, y); y += 3.5;
    doc.text(`Cajero: ${sale.operator || ''}`, lm, y); y += 3.5;
    doc.text(`Cliente: ${sale.customer_name}`, lm, y); y += 3.5;
    doc.text(`Pago: ${sale.payment_method}`, lm, y); y += 2;

    // Divider
    y += 1;
    doc.line(lm, y, lm + pw, y);
    y += 3;

    // Items header
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.text('PRODUCTO', lm, y);
    doc.text('CTD', lm + 40, y, { align: 'center' });
    doc.text('P.U.', lm + 52, y, { align: 'right' });
    doc.text('TOTAL', lm + pw, y, { align: 'right' });
    y += 1;
    doc.line(lm, y, lm + pw, y);
    y += 3;

    // Items
    doc.setFont(undefined, 'normal');
    (sale.items || []).forEach(item => {
      const name = item.product_name.length > 22 ? item.product_name.substring(0, 22) + '…' : item.product_name;
      doc.text(name, lm, y);
      doc.text(String(item.quantity), lm + 40, y, { align: 'center' });
      doc.text(formatNoRound(item.unit_price), lm + 52, y, { align: 'right' });
      doc.text(formatNoRound(item.quantity * item.unit_price), lm + pw, y, { align: 'right' });
      y += 3.5;
    });

    // Divider
    y += 1;
    doc.line(lm, y, lm + pw, y);
    y += 4;

    // Totals
    doc.setFontSize(7);
    if (sale.discount_amount > 0) {
      doc.text('Descuento:', lm, y);
      doc.text(`-S/. ${formatNoRound(sale.discount_amount)}`, lm + pw, y, { align: 'right' });
      y += 4;
    }

    if (isInvoice) {
      const totalFinal = sale.total_amount;
      const baseGravada = totalFinal / 1.18;
      const igv = totalFinal - baseGravada;
      doc.text('Base Gravada:', lm, y);
      doc.text(`S/. ${formatNoRound(baseGravada)}`, lm + pw, y, { align: 'right' });
      y += 3.5;
      doc.text('IGV (18%):', lm, y);
      doc.text(`S/. ${formatNoRound(igv)}`, lm + pw, y, { align: 'right' });
      y += 3.5;
    }

    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('TOTAL:', lm, y);
    doc.text(`S/. ${formatNoRound(sale.total_amount)}`, lm + pw, y, { align: 'right' });
    y += 6;

    // Footer
    doc.setFontSize(7);
    doc.setFont(undefined, 'normal');
    doc.text('¡Gracias por su compra!', 40, y, { align: 'center' });
    y += 8;

    // Return generated blob directly without buggy page resizing
    return doc.output('blob');
  };

  const handleShareWhatsApp = (sale, items, phone) => {
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 9 && cleanPhone.startsWith('9')) {
      cleanPhone = '51' + cleanPhone;
    }
    const storeName = config?.businessName || config?.storeName || 'ARVEN';
    const itemsText = items.map(item => `• ${item.quantity}x ${item.product_name || item.detailName} - S/. ${formatNoRound(item.total_price || (item.quantity * item.unit_price))}`).join('\n');
    const text = `🧾 *${storeName.toUpperCase()}*\n*${sale.document_type || 'Boleta'} N° ${sale.invoice_number}*\n\n📅 Fecha: ${new Date(sale.created_at).toLocaleDateString('es-PE')}\n👤 Cliente: ${sale.customer_name}\n💳 Pago: ${sale.payment_method}\n\n*Detalle de compra:*\n${itemsText}\n\n*Total: S/. ${formatNoRound(sale.total_amount)}*\n\n¡Gracias por tu preferencia! ¡Te esperamos pronto! 🤎`;
    const encodedMsg = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMsg}`, '_blank');
  };

  const sendPdfViaWhatsApp = async (sale) => {
    setSendingWhatsApp(true);
    try {
      const blob = await generatePdfBlob(sale);
      const fileName = `comprobante_${sale.invoice_number.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      const file = new File([blob], fileName, { type: 'application/pdf' });

      // Intentar compartir el archivo PDF real de forma nativa (útil en móviles)
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `Comprobante ${sale.invoice_number}`,
            text: `Comprobante de pago ${sale.invoice_number} por S/. ${formatNoRound(sale.total_amount)}`
          });
          setSendingWhatsApp(false);
          return;
        } catch (shareErr) {
          console.log('Navegación nativa cancelada o fallida, usando fallback de enlace.');
        }
      }

      // Fallback: Subir a Supabase y compartir enlace en api.whatsapp.com
      const publicUrl = await DataService.uploadImage(file);

      let phone = sale.customer_phone;
      if (!phone || !phone.trim()) {
        phone = prompt('Por favor ingresa el número de WhatsApp del cliente:');
        if (!phone || !phone.trim()) {
          setSendingWhatsApp(false);
          return;
        }
      }

      let cleanPhone = phone.replace(/[^0-9]/g, '');
      if (cleanPhone.length === 9 && cleanPhone.startsWith('9')) {
        cleanPhone = '51' + cleanPhone;
      }

      const storeName = config?.businessName || config?.storeName || 'CARRILLO STORE';
      const text = `🧾 *${storeName}*\nComprobante: ${sale.document_type || 'Ticket'} N° ${sale.invoice_number}\nTotal: S/. ${formatNoRound(sale.total_amount)}\n\n📄 Descarga tu comprobante en PDF:\n${publicUrl}`;
      const encodedMsg = encodeURIComponent(text);
      window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMsg}`, '_blank');
    } catch (err) {
      console.error('Error generando PDF para WhatsApp:', err);
      setErrorMsg('No se pudo generar el PDF. Verifica la conexión.');
      setTimeout(() => setErrorMsg(''), 3000);
    } finally {
      setSendingWhatsApp(false);
    }
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

                    {paymentMethod === 'Tarjeta' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: '#FEF3C7', border: '1px solid #F59E0B', color: '#92400E', fontSize: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                          <AlertTriangle size={14} />
                          <span>Comisión de Tarjeta (5%): S/. {formatNoRound(total * 0.05)}</span>
                        </div>
                        <div>Monto total a pagar con recargo: <strong>S/. {formatNoRound(total * 1.05)}</strong></div>
                        <div style={{ fontSize: '10px', fontStyle: 'italic', color: '#B45309' }}>(Nota: Esta comisión es referencial y no se guardará en la boleta/factura/ticket).</div>
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

                {/* Selector de Color con Stock Detallado */}
                {freshProd.colors?.length > 0 && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>Color del Polo</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {freshProd.colors.map(c => {
                        const isSelected = selectedColor?.hex === c.hex;
                        return (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => setSelectedColor(c)}
                            style={{
                              padding: '8px 14px',
                              border: isSelected ? '2px solid var(--text-primary)' : '1px solid var(--border-color)',
                              backgroundColor: isSelected ? 'var(--bg-secondary)' : '#FFF',
                              fontSize: '12px',
                              cursor: c.stock <= 0 ? 'not-allowed' : 'pointer',
                              opacity: c.stock <= 0 ? 0.4 : 1,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontWeight: isSelected ? 700 : 400,
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <span style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: c.hex, border: '1px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />
                            <span>{c.name}</span>
                            <span style={{ fontSize: '10px', fontWeight: 700, backgroundColor: c.stock > 0 ? '#DEF7EC' : '#FDE8E8', color: c.stock > 0 ? '#03543F' : '#9B1C1C', padding: '2px 6px', borderRadius: '10px', marginLeft: '2px' }}>{c.stock}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Selector de Talla con Stock Visible */}
                {freshProd.sizes?.length > 0 && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>Talla</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {freshProd.sizes.map(size => {
                        const isSelected = selectedSize === size;
                        const sizeStock = selectedColor && selectedColor.sizes_stock
                          ? (selectedColor.sizes_stock[size] || 0)
                          : 0;
                        const hasStock = sizeStock > 0;
                        return (
                          <button
                            key={size}
                            type="button"
                            onClick={() => setSelectedSize(size)}
                            style={{
                              padding: '8px 14px',
                              border: isSelected ? '2px solid var(--text-primary)' : '1px solid var(--border-color)',
                              backgroundColor: isSelected ? 'var(--text-primary)' : '#FFF',
                              color: isSelected ? '#FFF' : (hasStock ? 'var(--text-primary)' : '#CCC'),
                              cursor: hasStock ? 'pointer' : 'not-allowed',
                              opacity: hasStock ? 1 : 0.5,
                              fontSize: '13px',
                              fontWeight: 600,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '4px',
                              minWidth: '50px',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <span>{size}</span>
                            <span style={{ fontSize: '10px', fontWeight: 700, opacity: 0.85 }}>
                              {sizeStock > 0 ? `${sizeStock} uds` : 'Agotado'}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Tabla resumen rápido de stock por color/talla */}
                    {freshProd.colors?.length > 0 && (
                      <div style={{ marginTop: '12px', border: '1px solid var(--border-color)', fontSize: '11px', overflow: 'auto', maxHeight: '140px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                              <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, backgroundColor: 'var(--bg-secondary)' }}>Color</th>
                              {freshProd.sizes.map(s => (
                                <th key={s} style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600, borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, backgroundColor: 'var(--bg-secondary)' }}>{s}</th>
                              ))}
                              <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, backgroundColor: 'var(--bg-secondary)' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {freshProd.colors.map(c => (
                              <tr key={c.hex} style={{ backgroundColor: selectedColor?.hex === c.hex ? '#F0F9FF' : 'transparent' }}>
                                <td style={{ padding: '5px 10px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: c.hex, border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
                                  {c.name}
                                </td>
                                {freshProd.sizes.map(s => {
                                  const qty = c.sizes_stock ? (c.sizes_stock[s] || 0) : 0;
                                  return (
                                    <td key={s} style={{ padding: '5px 8px', textAlign: 'center', borderBottom: '1px solid var(--border-color)', fontWeight: qty > 0 ? 700 : 400, color: qty > 0 ? '#03543F' : '#CCC' }}>
                                      {qty}
                                    </td>
                                  );
                                })}
                                <td style={{ padding: '5px 8px', textAlign: 'center', borderBottom: '1px solid var(--border-color)', fontWeight: 700 }}>{c.stock}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
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
              backgroundColor: '#FFF', width: '100%', maxWidth: '340px',
              maxHeight: '90vh', overflowY: 'auto',
              fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', sans-serif", fontSize: '12px', color: '#111',
              padding: '28px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: '1px solid #E5E7EB',
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
                {lastCreatedSale.invoice_number}
              </div>

              <div style={{ borderTop: '1px dashed #D1D5DB', margin: '10px 0' }} />

              {/* Customer info (if exists) */}
              <div style={{ fontSize: '11px', color: '#4B5563', lineHeight: '1.4', marginBottom: '10px' }}>
                <div><strong>Cliente:</strong> {lastCreatedSale.customer_name}</div>
                {lastCreatedSale.customer_document && <div><strong>Doc:</strong> {lastCreatedSale.customer_document}</div>}
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
                {items.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', alignItems: 'center', color: '#111' }}>
                    <span style={{ flex: 0.5, textAlign: 'center', fontWeight: 600 }}>{item.quantity}</span>
                    <span style={{ flex: 2, textAlign: 'left' }}>{item.product_name || item.detailName}</span>
                    <span style={{ flex: 1, textAlign: 'right', fontWeight: 600 }}>S/. {formatNoRound(item.quantity * item.unit_price)}</span>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px dashed #D1D5DB', margin: '10px 0' }} />

              {/* Totals Box */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: '#4B5563', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>SUBTOTAL:</span>
                  <span>S/. {formatNoRound(lastCreatedSale.total_amount + lastCreatedSale.discount_amount)}</span>
                </div>
                {lastCreatedSale.discount_amount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#EF4444' }}>
                    <span>DESCUENTO:</span>
                    <span>- S/. {formatNoRound(lastCreatedSale.discount_amount)}</span>
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
                  <span>S/. {formatNoRound(lastCreatedSale.total_amount)}</span>
                </div>
              </div>

              <div style={{ borderTop: '1px dashed #D1D5DB', margin: '10px 0' }} />

              {/* Forma de pago */}
              <div style={{ textAlign: 'center', fontSize: '11px', color: '#4B5563', marginBottom: '12px' }}>
                <strong>Forma de pago:</strong> {lastCreatedSale.payment_method}
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
              <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => window.print()} className="btn-primary" style={{ flex: 1, display: 'flex', gap: '6px', justifyContent: 'center', borderRadius: '4px', fontSize: '12px', padding: '10px' }}>
                    🖨️ Imprimir
                  </button>
                  <button onClick={() => { setShowPrintModal(false); setLastCreatedSale(null); }} className="btn-secondary" style={{ flex: 1, borderRadius: '4px', fontSize: '12px', padding: '10px' }}>
                    Continuar
                  </button>
                </div>
                
                {/* PDF Option */}
                <button
                  disabled={sendingWhatsApp}
                  onClick={() => sendPdfViaWhatsApp(lastCreatedSale)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: '#E5E7EB',
                    color: '#374151',
                    border: '1px solid #D1D5DB',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: sendingWhatsApp ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    borderRadius: '4px'
                  }}
                >
                  {sendingWhatsApp ? 'Generando PDF...' : 'Descargar / Enviar PDF del Ticket'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL BOLETA / FACTURA SUNAT — Premium Design */}
      {showPrintModal && lastCreatedSale && lastCreatedSale.document_type !== 'Sin Datos' && (() => {
        const saleDate = new Date(lastCreatedSale.created_at);
        const items = lastCreatedSale.items;
        const isFactura = lastCreatedSale.document_type === 'Factura';
        const hasPhone = lastCreatedSale.customer_phone && lastCreatedSale.customer_phone.trim().length > 0;

        const itemsWithTax = items.map(item => {
          const precioVentaUnitario = item.unit_price;
          const valorVentaUnitario = precioVentaUnitario / 1.18;
          const igvUnitario = precioVentaUnitario - valorVentaUnitario;
          const totalBase = valorVentaUnitario * item.quantity;
          const totalIgv = igvUnitario * item.quantity;
          return { ...item, valorVentaUnitario, igvUnitario, totalBase, totalIgv };
        });

        const totalImporte = lastCreatedSale.total_amount;
        const totalBaseGravada = totalImporte / 1.18;
        const totalIGV = totalImporte - totalBaseGravada;
        const descuento = lastCreatedSale.discount_amount;

        return (
          <div className="invoice-print-container" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 5000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
            backdropFilter: 'blur(4px)'
          }}>
            <div style={{
              backgroundColor: '#FFF', maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 25px 80px rgba(0,0,0,0.25)',
              fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
              borderRadius: '10px',
              overflow: 'hidden'
            }}>
              {/* CABECERA PREMIUM — Fondo oscuro con acento dorado */}
              <div style={{
                background: 'linear-gradient(135deg, #111 0%, #1a1a2e 100%)',
                padding: '24px 28px',
                display: 'flex', gap: '20px', alignItems: 'center'
              }}>
                <div style={{ flex: 1, display: 'flex', gap: '14px', alignItems: 'center' }}>
                  {config?.storeLogoUrl ? (
                    <img src={config.storeLogoUrl} alt="Logo" style={{ maxHeight: '50px', maxWidth: '110px', objectFit: 'contain', borderRadius: '6px' }} />
                  ) : (
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#FFF', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {config?.businessName || config?.storeName || 'ARVEN'}
                    </div>
                  )}
                  {config?.storeLogoUrl && (
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                      {config?.fiscalAddress || ''}<br />
                      {config?.ticketPhone && <>Tel: {config.ticketPhone}</>}
                    </div>
                  )}
                  {!config?.storeLogoUrl && (
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                      {config?.fiscalAddress || 'Dirección Fiscal'}<br />
                      {config?.ticketPhone && <>Tel: {config.ticketPhone}<br /></>}
                      {config?.ticketEmail && <>Email: {config.ticketEmail}</>}
                    </div>
                  )}
                </div>
                {/* Recuadro del tipo de comprobante */}
                <div style={{
                  border: '2px solid #C5A880', borderRadius: '8px',
                  padding: '10px 16px', textAlign: 'center', minWidth: '190px',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '3px',
                  backgroundColor: 'rgba(197,168,128,0.08)'
                }}>
                  <div style={{ fontSize: '9px', fontWeight: 600, color: '#C5A880', letterSpacing: '0.08em', textTransform: 'uppercase' }}>R.U.C. N° {config?.ruc || '20601234567'}</div>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#FFF', letterSpacing: '0.02em' }}>{isFactura ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA'}</div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#C5A880' }}>N° {lastCreatedSale.invoice_number}</div>
                </div>
              </div>

              {/* CUERPO */}
              <div style={{ padding: '24px 28px' }}>

                {/* DATOS ADQUIRIENTE — Tarjeta con icono */}
                <div style={{
                  border: '1px solid #E5E7EB', borderRadius: '8px',
                  padding: '14px 16px', fontSize: '12px', marginBottom: '20px',
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px',
                  backgroundColor: '#FAFAFA', position: 'relative'
                }}>
                  <div style={{ position: 'absolute', top: '-10px', left: '16px', backgroundColor: '#FFF', padding: '0 8px', fontSize: '10px', fontWeight: 700, color: '#C5A880', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Datos del Adquiriente
                  </div>
                  <div><span style={{ color: '#6B7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cliente</span><br /><strong style={{ color: '#111' }}>{lastCreatedSale.customer_name}</strong></div>
                  <div><span style={{ color: '#6B7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Doc. Identidad</span><br /><strong style={{ color: '#111' }}>{lastCreatedSale.customer_document}</strong></div>
                  <div><span style={{ color: '#6B7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fecha de Emisión</span><br /><strong style={{ color: '#111' }}>{saleDate.toLocaleDateString('es-PE')}</strong></div>
                  <div><span style={{ color: '#6B7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Hora</span><br /><strong style={{ color: '#111' }}>{saleDate.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true })}</strong></div>
                  <div><span style={{ color: '#6B7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Moneda</span><br /><strong style={{ color: '#111' }}>SOLES (PEN)</strong></div>
                  <div><span style={{ color: '#6B7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Forma de Pago</span><br /><strong style={{ color: '#111' }}>{lastCreatedSale.payment_method}</strong></div>
                </div>

                {/* TABLA DE ITEMS — Cabecera dorada */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left', marginBottom: '20px', borderRadius: '6px', overflow: 'hidden' }}>
                  <thead>
                    <tr style={{ background: 'linear-gradient(135deg, #111 0%, #1a1a2e 100%)', color: '#C5A880' }}>
                      <th style={{ padding: '10px 8px', fontWeight: 700, fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Cant.</th>
                      <th style={{ padding: '10px 8px', fontWeight: 700, fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Unidad</th>
                      <th style={{ padding: '10px 8px', fontWeight: 700, fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Descripción</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>V. Unit.</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>IGV</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsWithTax.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: idx % 2 === 0 ? '#FFF' : '#FAFAFA', transition: 'background-color 0.15s' }}>
                        <td style={{ padding: '9px 8px', fontWeight: 600, color: '#111' }}>{item.quantity}</td>
                        <td style={{ padding: '9px 8px', color: '#6B7280' }}>NIU</td>
                        <td style={{ padding: '9px 8px', color: '#111' }}>{item.product_name}</td>
                        <td style={{ padding: '9px 8px', textAlign: 'right', color: '#374151' }}>S/. {formatNoRound(item.valorVentaUnitario)}</td>
                        <td style={{ padding: '9px 8px', textAlign: 'right', color: '#EF4444', fontSize: '10px' }}>S/. {formatNoRound(item.totalIgv)}</td>
                        <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 700, color: '#111' }}>S/. {formatNoRound(item.quantity * item.unit_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* RESUMEN TRIBUTARIO — Alineado a la derecha */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                  <div style={{ width: '300px', border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #F3F4F6', color: '#374151' }}>
                      <span>Op. Gravada (Base):</span><span style={{ fontWeight: 600 }}>S/. {formatNoRound(totalBaseGravada)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #F3F4F6', color: '#EF4444', fontWeight: 600 }}>
                      <span>I.G.V. (18%):</span><span>S/. {formatNoRound(totalIGV)}</span>
                    </div>
                    {descuento > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #F3F4F6', color: '#F59E0B', fontWeight: 600 }}>
                        <span>Descuento:</span><span>- S/. {formatNoRound(descuento)}</span>
                      </div>
                    )}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', padding: '12px 14px',
                      fontWeight: 800, fontSize: '15px',
                      background: 'linear-gradient(135deg, #111 0%, #1a1a2e 100%)', color: '#C5A880'
                    }}>
                      <span>IMPORTE TOTAL:</span><span>S/. {formatNoRound(totalImporte)}</span>
                    </div>
                  </div>
                </div>

                {/* ESTADO — Badge verde */}
                <div style={{
                  textAlign: 'center', padding: '10px',
                  marginBottom: '16px', borderRadius: '8px',
                  border: '2px solid #059669', color: '#059669',
                  fontWeight: 700, fontSize: '13px', letterSpacing: '0.05em',
                  backgroundColor: 'rgba(5,150,105,0.04)'
                }}>
                  ✓ COMPROBANTE EMITIDO
                </div>

                {/* Pie legal */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '16px',
                  borderTop: '1px solid #E5E7EB', paddingTop: '14px', marginBottom: '18px'
                }}>
                  <div style={{ fontSize: '9px', color: '#9CA3AF', lineHeight: 1.6 }}>
                    Representación impresa de la {isFactura ? 'Factura' : 'Boleta de Venta'} Electrónica.<br />
                    Consulte en: <strong style={{ color: '#6B7280' }}>{config?.storeName?.toLowerCase().replace(/\s/g, '') || 'arven'}.com/consultas</strong><br />
                    Autorizado mediante resolución SUNAT N° 034-2020/SUNAT.<br />
                    Hash: <span style={{ fontFamily: 'monospace', fontSize: '8px' }}>{btoa(lastCreatedSale.invoice_number).slice(0, 24)}</span>
                  </div>
                </div>

                {/* Action Buttons (no-print) */}
                <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => window.print()}
                      style={{
                        flex: 1, display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center',
                        padding: '12px', fontSize: '13px', fontWeight: 700,
                        background: 'linear-gradient(135deg, #111 0%, #1a1a2e 100%)', color: '#C5A880',
                        border: 'none', borderRadius: '8px', cursor: 'pointer',
                        transition: 'opacity 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                      🖨️ Imprimir Comprobante
                    </button>
                    <button
                      onClick={() => { setShowPrintModal(false); setLastCreatedSale(null); }}
                      style={{
                        flex: 1, padding: '12px', fontSize: '13px', fontWeight: 700,
                        backgroundColor: '#F3F4F6', color: '#374151',
                        border: '1px solid #E5E7EB', borderRadius: '8px',
                        cursor: 'pointer', transition: 'background-color 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#E5E7EB'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                    >
                      Continuar
                    </button>
                  </div>

                  {/* PDF Download / WhatsApp PDF */}
                  <button
                    disabled={sendingWhatsApp}
                    onClick={() => sendPdfViaWhatsApp(lastCreatedSale)}
                    style={{
                      width: '100%', padding: '12px',
                      backgroundColor: sendingWhatsApp ? '#88d4a0' : '#25D366',
                      color: '#FFF', border: 'none',
                      fontSize: '13px', fontWeight: 700,
                      cursor: sendingWhatsApp ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      borderRadius: '8px', transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={e => { if (!sendingWhatsApp) e.currentTarget.style.backgroundColor = '#1EBE5A'; }}
                    onMouseLeave={e => { if (!sendingWhatsApp) e.currentTarget.style.backgroundColor = '#25D366'; }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    {sendingWhatsApp ? 'Generando PDF...' : 'Descargar / Enviar PDF del Comprobante'}
                  </button>
                </div>

              </div>
            </div>
          </div>
        );
      })()}

      {/* CSS de impresión — oculta todo excepto el comprobante */}
      <style>{`
        @media print {
          /* Ocultar todo por defecto */
          body * { visibility: hidden; }

          /* Mostrar solo el contenedor de impresión activo */
          .invoice-print-container, .invoice-print-container *,
          .ticket-print-container, .ticket-print-container * {
            visibility: visible;
          }

          /* Posicionar el contenedor de impresión en la página */
          .invoice-print-container, .ticket-print-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: #FFF !important;
            padding: 0 !important;
            margin: 0 !important;
            z-index: 99999 !important;
          }

          /* Ocultar botones y paneles no-print */
          .no-print,
          .invoice-print-container button,
          .ticket-print-container button,
          .invoice-print-container input,
          .ticket-print-container input {
            display: none !important;
          }

          /* Ocultar sidebar, header y chrome del admin layout */
          nav, aside, header,
          [class*="sidebar"], [class*="Sidebar"],
          [class*="admin-header"], [class*="AdminHeader"],
          [class*="topbar"], [class*="Topbar"] {
            display: none !important;
            visibility: hidden !important;
          }

          /* Resetear body y html */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
        }
      `}
      </style>

    </div>
  );
}
