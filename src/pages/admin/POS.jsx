import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search, ShoppingBag, Plus, Minus, CheckCircle, AlertTriangle, UserPlus, ShieldAlert, Pencil, X,
  ArrowLeft, ArrowRight, Receipt, FileText, Ticket, Wallet,
  CreditCard, Smartphone, Landmark, Package, Trash2, User
} from 'lucide-react';
import { DataService, subscribeToRealtime } from '../../services/dataService';
import { toast } from '../../utils/toast';
import ReceiptModal from '../../components/receipts/ReceiptModal';
import OrderDetailTable from '../../components/receipts/OrderDetailTable';

/* ============================================================
   Helpers puros (fuera del componente: no se recrean por render)
   ============================================================ */

const DEFAULT_USER = { name: 'Admin Principal', role: 'admin' };
const EMPTY_TICKET_CUSTOMER = { name: '', phone: '', document_number: '' };
const DOC_LABELS = { 'Sin Datos': 'Ticket', Boleta: 'Boleta', Factura: 'Factura' };
const PAYMENT_METHODS = [
  { id: 'Efectivo', icon: Wallet },
  { id: 'Tarjeta', icon: CreditCard },
  { id: 'Yape', icon: Smartphone },
  { id: 'Plin', icon: Smartphone },
  { id: 'Transferencia', icon: Landmark },
];

const readCurrentUser = () => {
  try {
    const raw = localStorage.getItem('admin_user');
    return raw ? { ...DEFAULT_USER, ...JSON.parse(raw) } : DEFAULT_USER;
  } catch {
    return DEFAULT_USER;
  }
};

// Convierte cualquier valor (string, null, undefined) a número finito
const toNum = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

// Redondeo a céntimos robusto frente a errores de coma flotante (1.005 -> 1.01)
const round2 = (v) => {
  const n = toNum(v);
  return Math.round((n + (n >= 0 ? 1e-9 : -1e-9)) * 100) / 100;
};

// Formato a 2 decimales SIN redondear (trunca), corrigiendo el error de coma flotante
// (antes 0.29 se mostraba como 0.28 porque 0.29*100 = 28.999999…)
const formatNoRound = (num) => {
  const n = typeof num === 'number' ? num : parseFloat(num);
  if (!Number.isFinite(n)) return '0.00';
  const sign = n < 0 ? -1 : 1;
  const truncated = Math.trunc(Math.abs(n) * 100 + 1e-6) / 100;
  return (sign * truncated).toFixed(2);
};

const normalize = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Precio base del producto: oferta si existe (> 0), si no el precio regular
const productBasePrice = (p) => {
  const offer = p?.offer_price;
  if (offer !== null && offer !== undefined && offer !== '' && toNum(offer) > 0) return toNum(offer);
  return toNum(p?.price);
};

// Parsea wholesale_tiers de forma segura (puede llegar como string JSON desde Supabase)
const parseTiers = (prod) => {
  let tiers = prod?.wholesale_tiers;
  if (!tiers) return [];
  if (typeof tiers === 'string') { try { tiers = JSON.parse(tiers); } catch { return []; } }
  return Array.isArray(tiers) ? tiers : [];
};

const getSizePrices = (prod) => parseTiers(prod).find(t => t.type === 'size_prices')?.data || {};

// Precio unitario regular por talla (sin promos, sin mayoreo)
const regularUnitPrice = (prod, size) => {
  const sd = getSizePrices(prod)[size];
  if (sd?.offer_price && sd.offer_price !== '') return toNum(sd.offer_price);
  if (sd?.price && sd.price !== '') return toNum(sd.price);
  return productBasePrice(prod);
};

// Precio de lista (sin oferta ni promociones): es el "precio unitario" del comprobante
const listUnitPrice = (prod, size) => {
  const sd = getSizePrices(prod)[size];
  if (sd?.price && sd.price !== '') return toNum(sd.price);
  return toNum(prod?.price) || productBasePrice(prod);
};

// Devuelve la MEJOR promo simple activa dado totalQty (mayor qty alcanzada = mejor descuento)
const getActivePromo = (prod, totalQty) => {
  const promos = parseTiers(prod).find(t => t.type === 'simple_promos')?.data || [];
  const valid = [...promos]
    .filter(p => p.qty && p.price && totalQty >= parseInt(p.qty))
    .sort((a, b) => parseInt(b.qty) - parseInt(a.qty));
  return valid[0] || null;
};

// El descuento mayorista aplica si la suma total de variantes del MISMO producto base
// (distintos colores/tallas) alcanza el mínimo mayorista. También aplica precios por talla y promociones simples.
// Devuelve el total del grupo y QUÉ beneficio se aplicó (siempre el más barato para el cliente).
const getProductGroupPricing = (groupItems, product) => {
  if (!product) return { total: 0, label: '' };
  const sizePrices = getSizePrices(product);
  const totalQty = groupItems.reduce((sum, i) => sum + i.quantity, 0);

  const sizeQuantities = {};
  groupItems.forEach(i => {
    sizeQuantities[i.selectedSize] = (sizeQuantities[i.selectedSize] || 0) + i.quantity;
  });

  // Opción A: precio regular / oferta / tiers mayoristas por talla
  let totalWithTiers = 0;
  let usedTier = false;
  groupItems.forEach(item => {
    const size = item.selectedSize;
    const sizeTiers = Array.isArray(sizePrices[size]?.wholesale_tiers) ? sizePrices[size].wholesale_tiers : [];
    const sizeQty = sizeQuantities[size] || 0;
    const matchedTier = [...sizeTiers]
      .sort((a, b) => toNum(b.min_qty) - toNum(a.min_qty))
      .find(t => sizeQty >= toNum(t.min_qty));
    const regular = regularUnitPrice(product, size);
    const tierPrice = matchedTier ? toNum(matchedTier.price) : Infinity;
    if (tierPrice < regular) usedTier = true;
    totalWithTiers += Math.min(regular, tierPrice) * item.quantity;
  });

  // Opción B: mejor promo simple (mayor qty alcanzada = precio por unidad más bajo)
  const best = getActivePromo(product, totalQty);
  const totalWithPromo = best ? (toNum(best.price) / parseInt(best.qty)) * totalQty : Infinity;

  if (totalWithPromo < totalWithTiers) {
    return { total: totalWithPromo, label: `Promo ${best.qty} x S/ ${toNum(best.price).toFixed(2)}` };
  }
  const hasOffer = groupItems.some(i => regularUnitPrice(product, i.selectedSize) < listUnitPrice(product, i.selectedSize));
  return { total: totalWithTiers, label: usedTier ? 'Precio mayorista' : hasOffer ? 'Oferta' : '' };
};

// Calcula TODOS los precios de cada línea en un solo lugar (carrito, resumen y venta usan lo mismo)
const priceOrder = (orderItems, products, itemDiscounts) => {
  const byId = new Map(products.map(p => [p.id, p]));
  const groupTotals = new Map();
  return orderItems.map(item => {
    const product = byId.get(item.id) || item;
    const groupItems = orderItems.filter(i => i.id === item.id);
    const totalQtyBase = groupItems.reduce((s, i) => s + i.quantity, 0);
    if (!groupTotals.has(item.id)) groupTotals.set(item.id, getProductGroupPricing(groupItems, product));
    const group = groupTotals.get(item.id);
    const unitPrice = totalQtyBase > 0 ? group.total / totalQtyBase : regularUnitPrice(product, item.selectedSize);
    const baseUnit = regularUnitPrice(product, item.selectedSize);
    const listUnit = Math.max(listUnitPrice(product, item.selectedSize), baseUnit, unitPrice);
    const manualPct = toNum(itemDiscounts[item.uniqueId]);
    const promoLabel = [unitPrice < listUnit - 0.004 ? group.label : '', manualPct > 0 ? `-${manualPct}% extra` : '']
      .filter(Boolean).join(' + ');
    const finalUnit = unitPrice * (1 - manualPct / 100);
    const displayPct = baseUnit > 0 ? Math.max(0, Math.round(((baseUnit - finalUnit) / baseUnit) * 100)) : 0;
    const promoPct = baseUnit > 0 ? Math.max(0, Math.round(((baseUnit - unitPrice) / baseUnit) * 100)) : 0;
    return {
      item,
      product,
      baseUnit,
      listUnit,
      promoLabel,
      unitPrice,
      manualPct,
      promoPct,
      finalUnit,
      displayPct,
      savingsUnit: Math.max(0, baseUnit - finalUnit),
      lineBase: baseUnit * item.quantity,
      lineTotal: finalUnit * item.quantity,
      totalQtyBase,
      activePromo: getActivePromo(product, totalQtyBase),
      isWholesaleActive: !!item.wholesale_price && totalQtyBase >= (item.wholesale_min_qty || 6),
    };
  });
};

// Convierte las líneas del pedido al formato del comprobante (una fila por unidad)
const toReceiptItems = (pricedItems) => pricedItems.map(({ item, product, finalUnit, listUnit, promoLabel }) => ({
  line_id: item.uniqueId,
  product_id: item.id,
  product_name: item.detailName,
  base_name: item.name,
  sku: product?.sku || item.sku || '',
  color_hex: item.selectedColor ? item.selectedColor.hex : null,
  color_name: item.selectedColor ? item.selectedColor.name : null,
  selected_size: item.selectedSize || null,
  quantity: item.quantity,
  unit_price: finalUnit,
  list_price: listUnit,
  promo_label: promoLabel,
}));

// Stock disponible de una variante (producto + color + talla)
const variantStock = (product, colorHex, size) => {
  if (!product) return 0;
  const color = colorHex ? (product.colors || []).find(c => c.hex === colorHex) : null;
  if (color) {
    const ss = color.sizes_stock;
    if (size && ss && typeof ss === 'object' && Object.keys(ss).length > 0) return toNum(ss[size]);
    return toNum(color.stock);
  }
  return toNum(product.stock);
};

const firstAvailableSize = (product, color) => {
  const sizes = product?.sizes || [];
  if (sizes.length === 0) return '';
  return sizes.find(s => variantStock(product, color?.hex, s) > 0) || sizes[0];
};

// Valida el carrito completo contra el inventario más reciente. Devuelve mensaje de error o null.
const validateCartStock = (orderItems, products) => {
  const byId = new Map(products.map(p => [p.id, p]));
  const perProduct = new Map();
  for (const item of orderItems) {
    const product = byId.get(item.id);
    if (!product) return `"${item.name}" ya no está disponible para la venta.`;
    const available = variantStock(product, item.selectedColor?.hex, item.selectedSize);
    if (item.quantity > available) {
      return `Stock insuficiente para ${item.detailName}: disponible ${Math.max(0, available)} ud(s), en pedido ${item.quantity}.`;
    }
    perProduct.set(item.id, (perProduct.get(item.id) || 0) + item.quantity);
  }
  for (const [id, qty] of perProduct) {
    const product = byId.get(id);
    if (qty > toNum(product.stock)) {
      return `Stock insuficiente de "${product.name}": disponible ${Math.max(0, toNum(product.stock))} ud(s), en pedido ${qty}.`;
    }
  }
  return null;
};

const STEPS = [
  { id: 'billing', label: 'Comprobante' },
  { id: 'sales', label: 'Productos' },
  { id: 'payment', label: 'Cobro' },
];

function StepIndicator({ current }) {
  const currentIdx = STEPS.findIndex(s => s.id === current);
  return (
    <div className="pos-steps" aria-label="Pasos de la venta">
      {STEPS.map((s, idx) => {
        const state = idx < currentIdx ? 'done' : idx === currentIdx ? 'active' : 'todo';
        return (
          <div key={s.id} className={`pos-step pos-step-${state}`}>
            <span className="pos-step-num">{state === 'done' ? <CheckCircle size={14} /> : idx + 1}</span>
            <span className="pos-step-label">{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function POS() {
  const [currentUser] = useState(readCurrentUser);

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef(null);

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
  const [openingAmount, setOpeningAmount] = useState('100');
  const [openingCash, setOpeningCash] = useState(false);

  // Customer Creator Modal
  const [showCustModal, setShowCustModal] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', phone: '', email: '', document_number: '' });
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Admin Authorization Modal for POS opening
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authAction, setAuthAction] = useState(null);
  const [adminVerifiedName, setAdminVerifiedName] = useState(''); // After admin verifies, stores name
  const [authOpeningAmount, setAuthOpeningAmount] = useState('100');
  const [authBusy, setAuthBusy] = useState(false);

  // Emisión de venta (bloqueo anti doble clic)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  // Print Dialog States
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [lastCreatedSale, setLastCreatedSale] = useState(null);

  // Item-level discount (% per item)
  const [itemDiscounts, setItemDiscounts] = useState({}); // { [uniqueId]: number }
  const [editingItemId, setEditingItemId] = useState(null);

  // Ticket customer data modal (optional for "Sin Datos")
  const [showTicketCustomerModal, setShowTicketCustomerModal] = useState(false);
  const [ticketCustomerData, setTicketCustomerData] = useState(EMPTY_TICKET_CUSTOMER);

  // Búsqueda de cliente (paso 1)
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [config, setConfig] = useState(null);


  const applyData = useCallback(([prods, custs, register, cfg]) => {
    setProducts((prods || []).filter(p => p.active));
    setCustomers(custs || []);
    setIsCashOpen(!!(register && register.status === 'open' && register.currentSession));
    setConfig(cfg || null);
    setLoading(false);
  }, []);

  const fetchData = useCallback(
    () => Promise.all([
      DataService.getProducts(),
      DataService.getCustomers(),
      DataService.getCashRegister(),
      DataService.getConfig(),
    ]),
    []
  );

  const loadData = useCallback(async () => {
    try {
      applyData(await fetchData());
    } catch (err) {
      console.error('Error cargando datos del POS:', err);
      setLoading(false);
    }
  }, [applyData, fetchData]);

  useEffect(() => {
    let active = true;
    const run = () => fetchData()
      .then(data => { if (active) applyData(data); })
      .catch(err => {
        console.error('Error cargando datos del POS:', err);
        if (active) {
          setLoading(false);
          toast.error('No se pudieron cargar los datos del POS. Revisa tu conexión.');
        }
      });
    run();
    const unsubscribe = subscribeToRealtime(run);
    return () => { active = false; unsubscribe(); };
  }, [fetchData, applyData]);

  /* ---------------------------- Caja ---------------------------- */

  const openRegister = async (amount, adminName) => {
    await DataService.openCashRegister(amount, currentUser.name, adminName);
    setIsCashOpen(true);
    toast.success(`Caja abierta y autorizada por ${adminName}.`);
  };

  const handleOpenCash = async () => {
    const amount = toNum(openingAmount);
    if (openingAmount === '' || amount < 0) {
      toast.warning('Ingresa un monto de apertura válido.');
      return;
    }

    const action = async (adminName) => {
      if (openingCash) return;
      setOpeningCash(true);
      try {
        await openRegister(amount, adminName);
      } catch (err) {
        console.error(err);
        toast.error(err?.message || 'No se pudo abrir la caja.');
      } finally {
        setOpeningCash(false);
      }
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
    if (authBusy) return;
    setAuthBusy(true);
    try {
      // Segundo paso (admin ya verificado): monto de apertura
      if (adminVerifiedName && !authAction) {
        const amount = toNum(authOpeningAmount);
        if (authOpeningAmount === '' || amount < 0) {
          setAuthError('Ingresa un monto de apertura válido.');
          return;
        }
        await openRegister(amount, adminVerifiedName);
        setShowAuthModal(false);
        setAdminVerifiedName('');
        return;
      }

      const matchedAdmin = await DataService.verifyAdmin(authEmail, authPassword);

      if (matchedAdmin) {
        if (authAction) {
          setShowAuthModal(false);
          authAction(matchedAdmin.name);
        } else {
          // Flujo colaborador: admin verificado, ahora pedir monto de apertura
          setAdminVerifiedName(matchedAdmin.name);
          setAuthError('');
        }
      } else {
        setAuthError('Acceso denegado. Credenciales de Administrador inválidas.');
      }
    } catch (err) {
      console.error(err);
      setAuthError(err?.message || 'No se pudo completar la operación.');
    } finally {
      setAuthBusy(false);
    }
  };

  /* ---------------------------- Pedido ---------------------------- */

  const cartQtyFor = (uniqueId) => orderItems.find(i => i.uniqueId === uniqueId)?.quantity || 0;

  // Abrir modal de selección detallada de polo
  const handleProductClick = (product) => {
    if (toNum(product.stock) <= 0) {
      toast.warning('Producto sin stock.');
      return;
    }
    const colors = product.colors || [];
    const firstColor = colors.find(c => toNum(c.stock) > 0) || colors[0] || null;
    setActiveProduct(product);
    setSelectedColor(firstColor);
    setSelectedSize(firstAvailableSize(product, firstColor));
    setSelectedQty(1);
    setShowProdModal(true);
  };

  const closeProductModal = () => {
    setShowProdModal(false);
    setActiveProduct(null);
  };

  const focusSearch = () => {
    setTimeout(() => {
      if (searchRef.current) {
        searchRef.current.focus();
        searchRef.current.select();
      }
    }, 0);
  };

  // Agregar al pedido con color y talla seleccionados
  const handleAddProductWithDetails = () => {
    if (!activeProduct) return;

    // Leer el producto fresco del estado para tener stock actualizado
    const freshProduct = products.find(p => p.id === activeProduct.id) || activeProduct;
    const freshColor = selectedColor
      ? (freshProduct.colors || []).find(c => c.hex === selectedColor.hex) || selectedColor
      : null;

    const itemUniqueId = `${freshProduct.id}-${selectedSize}-${freshColor ? freshColor.hex : 'no-color'}`;
    const available = variantStock(freshProduct, freshColor?.hex, selectedSize);
    const inCart = cartQtyFor(itemUniqueId);
    const qty = Math.max(1, parseInt(selectedQty) || 1);

    if (inCart + qty > available) {
      const label = [freshColor?.name, selectedSize].filter(Boolean).join(' / ');
      toast.error(
        `Stock insuficiente${label ? ` para ${label}` : ''}. Disponible: ${Math.max(0, available)} ud(s)` +
        (inCart ? `, ya tienes ${inCart} en el pedido.` : '.')
      );
      return;
    }

    const detailName = `${freshProduct.name} ${freshColor ? String(freshColor.name || '').toUpperCase() : ''} ${selectedSize}`.replace(/\s+/g, ' ').trim();

    if (inCart > 0) {
      setOrderItems(prev => prev.map(i => i.uniqueId === itemUniqueId ? { ...i, quantity: i.quantity + qty } : i));
    } else {
      setOrderItems(prev => [...prev, {
        ...freshProduct,
        uniqueId: itemUniqueId,
        detailName,
        selectedColor: freshColor,
        selectedSize,
        quantity: qty,
      }]);
    }

    closeProductModal();
    toast.success(`${qty} × ${detailName} agregado`, 1500);
    focusSearch();
  };

  const removeFromOrder = (uniqueId) => {
    setOrderItems(prev => prev.filter(item => item.uniqueId !== uniqueId));
    setItemDiscounts(prev => {
      const next = { ...prev };
      delete next[uniqueId];
      return next;
    });
    if (editingItemId === uniqueId) setEditingItemId(null);
  };

  const updateQty = (uniqueId, change) => {
    const item = orderItems.find(i => i.uniqueId === uniqueId);
    if (!item) return;

    const newQty = item.quantity + change;
    if (newQty <= 0) {
      removeFromOrder(uniqueId);
      return;
    }

    const freshProduct = products.find(p => p.id === item.id) || item;
    const limit = variantStock(freshProduct, item.selectedColor?.hex, item.selectedSize);
    if (newQty > limit) {
      toast.warning(`Solo hay ${Math.max(0, limit)} ud(s) disponibles de ${item.detailName}.`);
      return;
    }

    setOrderItems(prev => prev.map(i => i.uniqueId === uniqueId ? { ...i, quantity: newQty } : i));
  };

  const clearOrder = () => {
    if (orderItems.length === 0) return;
    if (!window.confirm('¿Vaciar todo el pedido?')) return;
    setOrderItems([]);
    setItemDiscounts({});
    setEditingItemId(null);
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!newCust.name.trim() || savingCustomer) return;
    setSavingCustomer(true);
    try {
      const saved = await DataService.saveCustomer({
        ...newCust,
        name: newCust.name.trim(),
        document_type: 'DNI'
      });
      setCustomers(prev => [...prev, saved]);
      setSelectedCustomerId(saved.id);
      setShowCustModal(false);
      setNewCust({ name: '', phone: '', email: '', document_number: '' });
      toast.success('Cliente registrado y seleccionado.');
    } catch (err) {
      console.error(err);
      toast.error(err?.message || 'No se pudo registrar el cliente.');
    } finally {
      setSavingCustomer(false);
    }
  };

  /* ---------------------------- Totales ---------------------------- */

  const pricedItems = useMemo(
    () => priceOrder(orderItems, products, itemDiscounts),
    [orderItems, products, itemDiscounts]
  );
  const listSubtotal = pricedItems.reduce((s, l) => s + l.listUnit * l.item.quantity, 0);
  const receiptItems = useMemo(() => toReceiptItems(pricedItems), [pricedItems]);
  const subtotal = pricedItems.reduce((s, l) => s + l.lineTotal, 0);
  const total = round2(Math.max(0, subtotal - toNum(discountAmount)));
  const totalItemsCount = orderItems.reduce((s, i) => s + i.quantity, 0);

  const receivedNum = round2(receivedAmount);
  const changeAmount = round2(receivedNum - total);
  const cashInsufficient = paymentMethod === 'Efectivo' && receivedNum < total;

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId) || null;
  const customerLabel = documentType === 'Sin Datos'
    ? (ticketCustomerData.name || 'Cliente genérico')
    : (selectedCustomer?.name || 'Cliente genérico');

  const closePrintModal = () => {
    setShowPrintModal(false);
    setLastCreatedSale(null);
    focusSearch();
  };

  const goToPayment = () => {
    if (orderItems.length === 0) {
      toast.warning('Agrega al menos un producto al pedido.');
      return;
    }
    const stockError = validateCartStock(orderItems, products);
    if (stockError) {
      toast.error(stockError);
      return;
    }
    setEditingItemId(null);
    setCurrentStep('payment');
  };

  // Confirmar y Emitir Venta
  const handleConfirmSale = async () => {
    // Bloqueo síncrono: evita ventas duplicadas por doble clic / Enter repetido
    if (submittingRef.current) return;

    if (orderItems.length === 0) {
      toast.warning('El pedido está vacío.');
      return;
    }
    if (paymentMethod === 'Efectivo' && receivedNum < total) {
      toast.warning('El dinero recibido es menor que el total a pagar.');
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      // Revalidar stock con inventario actualizado justo antes de cobrar
      const freshProducts = ((await DataService.getProducts()) || []).filter(p => p.active);
      setProducts(freshProducts);
      const stockError = validateCartStock(orderItems, freshProducts);
      if (stockError) {
        toast.error(stockError);
        setCurrentStep('sales');
        return;
      }

      // Datos del cliente según tipo de documento
      let customerName, customerDoc, customerPhone;
      if (documentType === 'Sin Datos') {
        customerName = ticketCustomerData.name.trim() || 'Cliente Genérico';
        customerDoc = ticketCustomerData.document_number.trim() || '00000000';
        customerPhone = ticketCustomerData.phone.trim();
      } else {
        customerName = selectedCustomer ? selectedCustomer.name : 'Cliente Genérico';
        customerDoc = selectedCustomer ? (selectedCustomer.document_number || '00000000') : '00000000';
        customerPhone = selectedCustomer ? (selectedCustomer.phone || '') : '';
      }

      const saleData = {
        customer_id: documentType === 'Sin Datos' ? null : (selectedCustomerId || null),
        customer_name: customerName,
        customer_document: customerDoc,
        total_amount: total,
        discount_amount: toNum(discountAmount),
        payment_method: paymentMethod,
        document_type: documentType,
        type: 'pos',
        operator: currentUser.name,
        items: toReceiptItems(pricedItems)
      };

      const createdSale = await DataService.createSale(saleData);

      setLastCreatedSale({
        ...saleData,
        id: createdSale.id,
        invoice_number: createdSale.invoice_number,
        created_at: createdSale.created_at,
        customer_phone: customerPhone,
        document_type: documentType,
      });
      setShowPrintModal(true);

      // Refrescar productos para que el stock se actualice en pantalla
      loadData();

      toast.success(`Venta ${createdSale.invoice_number} registrada.`);
      setOrderItems([]);
      setItemDiscounts({});
      setEditingItemId(null);
      setDiscountAmount(0);
      setSelectedCustomerId('');
      setClientSearchQuery('');
      setReceivedAmount('');
      setSearchQuery('');
      setCurrentStep('billing');
      setTicketCustomerData(EMPTY_TICKET_CUSTOMER);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || 'Error al registrar la venta. No se cobró nada: inténtalo de nuevo.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Panel del pedido detallado: mismo lugar en los pasos Productos y Cobro
  const renderOrderPanel = (readOnly) => (
              <div className="pos-cart card">
                <div className="pos-cart-header">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Pedido actual</h3>
                      {totalItemsCount > 0 && <span className="badge badge-primary tabular">{totalItemsCount} ud{totalItemsCount === 1 ? '' : 's'}</span>}
                    </div>
                    <button type="button" onClick={() => setCurrentStep('billing')} className="pos-cart-client" title="Cambiar comprobante o cliente">
                      {DOC_LABELS[documentType]} · {customerLabel}
                    </button>
                  </div>
                  {readOnly ? (
                    <button type="button" onClick={() => setCurrentStep('sales')} disabled={isSubmitting} className="btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Pencil size={14} /> Editar pedido
                    </button>
                  ) : orderItems.length > 0 && (
                    <button type="button" onClick={clearOrder} className="btn-ghost btn-sm" style={{ color: 'var(--color-danger)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Trash2 size={14} /> Vaciar
                    </button>
                  )}
                </div>

                <div className="pos-cart-lines">
                  {pricedItems.length === 0 ? (
                    <div className="empty-state" style={{ padding: '40px 16px' }}>
                      <ShoppingBag size={32} style={{ opacity: 0.35 }} />
                      <h3 style={{ fontSize: '14px' }}>Pedido vacío</h3>
                      <p style={{ fontSize: '12px' }}>Toca un producto del catálogo o búscalo por SKU. Cada unidad aparecerá aquí con su precio y descuento.</p>
                    </div>
                  ) : (
                    <OrderDetailTable
                      items={receiptItems}
                      total={total}
                      discount={toNum(discountAmount)}
                      showTotals={false}
                      compact
                      actions={readOnly ? undefined : {
                        editingLineId: editingItemId,
                        onEditLine: (lineId) => setEditingItemId(prev => (prev === lineId ? null : lineId)),
                        onRemoveUnit: (lineId) => updateQty(lineId, -1),
                      }}
                    />
                  )}
                </div>

                {(() => {
                  const line = pricedItems.find(l => l.item.uniqueId === editingItemId);
                  if (!line || readOnly) return null;
                  return (
                    <div className="pos-discount-bar">
                      <label htmlFor="pos-extra-disc" style={{ fontSize: '12px', minWidth: 0, flex: 1 }}>
                        Descuento extra · <strong>{line.item.detailName}</strong>
                        {line.promoPct > 0 && <span style={{ color: 'var(--text-muted)' }}> (ya tiene -{line.promoPct}%)</span>}
                      </label>
                      <input
                        id="pos-extra-disc"
                        type="number"
                        min="0"
                        max="100"
                        autoFocus
                        value={line.manualPct || ''}
                        placeholder="0"
                        onChange={e => {
                          const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                          setItemDiscounts(prev => ({ ...prev, [line.item.uniqueId]: val }));
                        }}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingItemId(null); }}
                        className="input-field tabular"
                        style={{ width: '76px', minHeight: '34px', padding: '4px 8px' }}
                      />
                      <span style={{ fontSize: '13px' }}>%</span>
                      <button type="button" className="btn-ghost btn-icon btn-sm" onClick={() => setEditingItemId(null)} aria-label="Cerrar"><X size={15} /></button>
                    </div>
                  );
                })()}

                <div className="pos-cart-footer">
                  <div className="pos-sum-normal">
                    {totalItemsCount} unidad{totalItemsCount === 1 ? '' : 'es'} · Precio normal <strong className="tabular">S/ {formatNoRound(listSubtotal)}</strong>
                    {listSubtotal - total > 0.004 && (
                      <> · <span style={{ color: 'var(--color-success)' }}>Ahorro <strong className="tabular" style={{ color: 'inherit' }}>S/ {formatNoRound(listSubtotal - total)}</strong></span></>
                    )}
                  </div>
                  {toNum(discountAmount) > 0 && (
                    <div className="pos-sum-normal" style={{ color: 'var(--color-danger)' }}>
                      Descuento adicional <strong className="tabular" style={{ color: 'inherit' }}>- S/ {formatNoRound(discountAmount)}</strong>
                    </div>
                  )}
                  <div className="pos-sum-pay">
                    <span>Precio a pagar</span>
                    <strong className="tabular">S/ {formatNoRound(total)}</strong>
                  </div>
                  {readOnly ? (
                    <button
                      type="button"
                      onClick={handleConfirmSale}
                      disabled={isSubmitting || cashInsufficient}
                      className="btn-success btn-lg btn-block"
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '16px', marginTop: '6px' }}
                    >
                      {isSubmitting
                        ? <><span className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px', borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#FFF' }} /> Emitiendo…</>
                        : <><CheckCircle size={18} /> Confirmar y emitir {DOC_LABELS[documentType]}</>}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={goToPayment}
                      disabled={orderItems.length === 0}
                      className="btn-primary btn-lg btn-block"
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '16px', marginTop: '6px' }}
                    >
                      Cobrar S/ {formatNoRound(total)} <ArrowRight size={18} />
                    </button>
                  )}
                </div>
              </div>
  );

  const filteredProducts = useMemo(() => {
    const q = normalize(searchQuery.trim());
    if (!q) return products;
    return products.filter(p => normalize(p.name).includes(q) || normalize(p.sku).includes(q));
  }, [products, searchQuery]);

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') {
      setSearchQuery('');
      return;
    }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const q = normalize(searchQuery.trim());
    if (!q) return;
    const exact = products.find(p => normalize(p.sku) === q);
    if (exact) return handleProductClick(exact);
    if (filteredProducts.length === 1) return handleProductClick(filteredProducts[0]);
    if (filteredProducts.length === 0) toast.info('No se encontraron productos.');
  };

  // Clientes filtrados para el buscador del paso 1
  const filteredClients = useMemo(() => {
    const q = normalize(clientSearchQuery.trim());
    const list = q
      ? customers.filter(c =>
          normalize(c.name).includes(q) ||
          String(c.document_number || '').includes(q) ||
          String(c.phone || '').includes(q) ||
          normalize(c.email).includes(q)
        )
      : customers;
    return list.slice(0, 30);
  }, [customers, clientSearchQuery]);

  const quickCashAmounts = useMemo(() => {
    if (total <= 0) return [];
    const opts = [total];
    [10, 20, 50, 100, 200].forEach(v => {
      const rounded = Math.ceil(total / v) * v;
      if (rounded > total && !opts.includes(rounded)) opts.push(rounded);
    });
    return opts.sort((a, b) => a - b).slice(0, 5);
  }, [total]);

  const selectDocumentType = (type) => {
    setDocumentType(type);
    if (type === 'Sin Datos') {
      setSelectedCustomerId('');
      setShowTicketCustomerModal(true);
    }
  };

  const continueToCatalog = () => {
    if (documentType !== 'Sin Datos' && !selectedCustomerId) {
      toast.warning('Selecciona un cliente o elige "Ticket" (sin datos).');
      return;
    }
    setCurrentStep('sales');
  };

  /* ============================================================
     Modal de producto: datos derivados
     ============================================================ */
  const modalProduct = showProdModal && activeProduct
    ? (products.find(p => p.id === activeProduct.id) || activeProduct)
    : null;
  const modalColor = modalProduct && selectedColor
    ? ((modalProduct.colors || []).find(c => c.hex === selectedColor.hex) || selectedColor)
    : null;
  const modalUniqueId = modalProduct ? `${modalProduct.id}-${selectedSize}-${modalColor ? modalColor.hex : 'no-color'}` : '';
  const modalAvailable = modalProduct ? variantStock(modalProduct, modalColor?.hex, selectedSize) : 0;
  const modalInCart = modalProduct ? cartQtyFor(modalUniqueId) : 0;
  const modalRemaining = Math.max(0, modalAvailable - modalInCart);

  const docTypeOptions = [
    { id: 'Sin Datos', label: 'Ticket', hint: 'Sin datos del cliente', icon: Ticket },
    { id: 'Boleta', label: 'Boleta', hint: 'Cliente con DNI', icon: Receipt },
    { id: 'Factura', label: 'Factura', hint: 'Empresa con RUC', icon: FileText },
  ];

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'var(--text-secondary)' }}>
        <div className="spinner" />
        <span style={{ fontSize: '13px' }}>Cargando punto de venta…</span>
      </div>
    );
  }

  return (
    <div className="pos-root">

      {!isCashOpen ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0' }}>
          <div className="card" style={{ maxWidth: '420px', width: '100%', padding: '36px 28px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ width: '56px', height: '56px', backgroundColor: 'var(--color-warning-soft)', color: 'var(--color-warning)', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <ShieldAlert size={26} />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Apertura de caja requerida</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.5 }}>
                {currentUser.role === 'admin'
                  ? 'Ingresa el saldo inicial para habilitar las ventas en el terminal POS.'
                  : 'Se requiere que un Administrador autorice la apertura de caja para iniciar el turno de ventas.'
                }
              </p>
            </div>

            {currentUser.role === 'admin' ? (
              <form onSubmit={e => { e.preventDefault(); handleOpenCash(); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ textAlign: 'left' }}>
                  <label className="field-label">Monto de apertura (S/.)</label>
                  <input type="number" min="0" step="0.01" inputMode="decimal" value={openingAmount} onChange={e => setOpeningAmount(e.target.value)} className="input-field tabular" autoFocus />
                </div>
                <button type="submit" disabled={openingCash} className="btn-primary btn-lg btn-block">
                  {openingCash ? 'Abriendo caja…' : 'Abrir turno de caja'}
                </button>
              </form>
            ) : (
              <button onClick={() => {
                setAuthAction(null);
                setAuthEmail('');
                setAuthPassword('');
                setAuthError('');
                setShowAuthModal(true);
              }} className="btn-primary btn-lg btn-block" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <ShieldAlert size={16} /> Solicitar apertura (requiere Admin)
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, gap: '16px' }}>

          <StepIndicator current={currentStep} />

          {/* ==================== PASO 1: DATOS FACTURACIÓN ==================== */}
          {currentStep === 'billing' && (
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
              <div className="card" style={{ maxWidth: '560px', width: '100%', padding: '28px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 700 }}>Tipo de comprobante y cliente</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Elige el documento a emitir para esta venta.</p>
                </div>

                {/* Selección de Tipo */}
                <div className="pos-doc-grid">
                  {docTypeOptions.map(opt => {
                    const Icon = opt.icon;
                    const active = documentType === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => selectDocumentType(opt.id)}
                        className={`pos-choice ${active ? 'is-active' : ''}`}
                        aria-pressed={active}
                      >
                        <Icon size={20} />
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{opt.label}</span>
                        <span style={{ fontSize: '11px', color: active ? 'inherit' : 'var(--text-muted)', opacity: active ? 0.8 : 1 }}>{opt.hint}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Cliente si no es Sin Datos */}
                {documentType !== 'Sin Datos' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="field-label" style={{ margin: 0 }}>Cliente</label>
                      <button type="button" onClick={() => setShowCustModal(true)} className="btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--color-primary)' }}>
                        <UserPlus size={14} /> Nuevo cliente
                      </button>
                    </div>

                    {selectedCustomer ? (
                      <div className="pos-selected-client">
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--color-primary-soft)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <User size={18} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedCustomer.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {selectedCustomer.document_number || 'Sin documento'}{selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ''}
                          </div>
                        </div>
                        <button type="button" className="btn-secondary btn-sm" onClick={() => setSelectedCustomerId('')}>Cambiar</button>
                      </div>
                    ) : (
                      <>
                        <div style={{ position: 'relative' }}>
                          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                          <input
                            type="text"
                            className="input-field"
                            placeholder="Buscar por nombre, DNI/RUC o teléfono…"
                            value={clientSearchQuery}
                            onChange={e => setClientSearchQuery(e.target.value)}
                            style={{ paddingLeft: '36px' }}
                          />
                        </div>
                        <div className="pos-client-list">
                          {filteredClients.length === 0 ? (
                            <div style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
                              No hay clientes que coincidan.{' '}
                              <button type="button" className="btn-ghost btn-sm" style={{ color: 'var(--color-primary)' }} onClick={() => { setNewCust(c => ({ ...c, name: clientSearchQuery })); setShowCustModal(true); }}>
                                Registrar nuevo
                              </button>
                            </div>
                          ) : filteredClients.map(c => (
                            <button key={c.id} type="button" className="pos-client-row" onClick={() => setSelectedCustomerId(c.id)}>
                              <span style={{ fontWeight: 500 }}>{c.name}</span>
                              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }} className="tabular">{c.document_number || '—'}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {documentType === 'Factura' && selectedCustomer && String(selectedCustomer.document_number || '').replace(/\D/g, '').length !== 11 && (
                      <div className="alert alert-warning">
                        <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                        <span>Para emitir Factura el cliente debería tener un RUC de 11 dígitos.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Datos opcionales del ticket */}
                {documentType === 'Sin Datos' && (
                  ticketCustomerData.name || ticketCustomerData.phone || ticketCustomerData.document_number ? (
                    <div className="alert alert-success" style={{ flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontWeight: 600 }}>Datos opcionales del cliente</div>
                      {ticketCustomerData.name && <div>Nombre: {ticketCustomerData.name}</div>}
                      {ticketCustomerData.phone && <div>Teléfono: {ticketCustomerData.phone}</div>}
                      {ticketCustomerData.document_number && <div>DNI: {ticketCustomerData.document_number}</div>}
                      <button type="button" onClick={() => setShowTicketCustomerModal(true)} className="btn-ghost btn-sm" style={{ alignSelf: 'flex-start', padding: 0, color: 'inherit', textDecoration: 'underline' }}>
                        Editar datos
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setShowTicketCustomerModal(true)} className="btn-secondary btn-sm" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <UserPlus size={14} /> Agregar datos opcionales (para WhatsApp)
                    </button>
                  )
                )}

                <button onClick={continueToCatalog} className="btn-primary btn-lg btn-block" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  Continuar a productos <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ==================== PASO 2: CATÁLOGO Y PEDIDO ==================== */}
          {currentStep === 'sales' && (
            <div className="pos-grid-container">

              {/* Lado Izquierdo: Catálogo */}
              <div className="pos-catalog">
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button onClick={() => setCurrentStep('billing')} className="btn-secondary btn-icon" title="Volver al paso 1" aria-label="Volver al paso 1">
                    <ArrowLeft size={16} />
                  </button>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      ref={searchRef}
                      type="search"
                      autoFocus
                      placeholder="Buscar por nombre o SKU (Enter para agregar)"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      className="input-field"
                      style={{ paddingLeft: '36px' }}
                    />
                  </div>
                </div>

                <div className="pos-catalog-grid">
                  {filteredProducts.length === 0 ? (
                    <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                      <Package size={32} style={{ opacity: 0.4 }} />
                      <h3>{products.length === 0 ? 'No hay productos activos' : 'Sin resultados'}</h3>
                      <p style={{ fontSize: '13px' }}>
                        {products.length === 0 ? 'Activa productos en el inventario para venderlos aquí.' : `No encontramos "${searchQuery}".`}
                      </p>
                      {searchQuery && <button className="btn-secondary btn-sm" onClick={() => setSearchQuery('')}>Limpiar búsqueda</button>}
                    </div>
                  ) : filteredProducts.map(p => {
                    const stock = toNum(p.stock);
                    const price = productBasePrice(p);
                    const regular = toNum(p.price);
                    const out = stock <= 0;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleProductClick(p)}
                        className={`pos-product-card ${out ? 'is-out' : ''}`}
                        aria-disabled={out}
                      >
                        <div className="pos-product-img">
                          {p.image_url
                            ? <img src={p.image_url} alt={p.name} loading="lazy" />
                            : <Package size={28} style={{ color: 'var(--text-muted)' }} />}
                          <span className={`badge ${out ? 'badge-danger' : stock <= 5 ? 'badge-warning' : ''}`} style={{ position: 'absolute', top: '6px', right: '6px' }}>
                            {out ? 'Agotado' : `${stock} uds`}
                          </span>
                        </div>
                        <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left', width: '100%' }}>
                          <span className="pos-product-name">{p.name}</span>
                          {p.sku && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.sku}</span>}
                          <span style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }} className="tabular">
                            <strong style={{ fontSize: '14px' }}>S/. {formatNoRound(price)}</strong>
                            {regular > price && <span style={{ fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>{formatNoRound(regular)}</span>}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

              </div>

              {renderOrderPanel(false)}
            </div>
          )}

          {/* ==================== PASO 3: PAGO & VUELTO ==================== */}
          {currentStep === 'payment' && (
            <div className="pos-grid-container">
              <div className="card pos-pay-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button onClick={() => setCurrentStep('sales')} disabled={isSubmitting} className="btn-secondary btn-icon" title="Regresar al pedido" aria-label="Regresar al pedido">
                    <ArrowLeft size={16} />
                  </button>
                  <div>
                    <h3 style={{ fontSize: '17px', fontWeight: 700 }}>Cobro</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{DOC_LABELS[documentType]} · {customerLabel}</p>
                  </div>
                </div>
                  {/* Métodos de pago */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label className="field-label">Método de pago</label>
                      <div className="pos-pay-methods">
                        {PAYMENT_METHODS.map(({ id, icon: Icon }) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setPaymentMethod(id)}
                            className={`pos-choice pos-choice-sm ${paymentMethod === id ? 'is-active' : ''}`}
                            aria-pressed={paymentMethod === id}
                          >
                            <Icon size={16} /> {id}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Efectivo: dinero recibido y vuelto */}
                    {paymentMethod === 'Efectivo' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div>
                          <label className="field-label" htmlFor="pos-received">Dinero recibido (S/.)</label>
                          <input
                            id="pos-received"
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            autoFocus
                            placeholder={formatNoRound(total)}
                            value={receivedAmount}
                            onChange={e => setReceivedAmount(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !cashInsufficient) handleConfirmSale(); }}
                            className="input-field tabular"
                            style={{ fontSize: '20px', fontWeight: 700, padding: '12px 14px' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {quickCashAmounts.map((amt, idx) => (
                            <button key={amt} type="button" className="btn-secondary btn-sm tabular" onClick={() => setReceivedAmount(amt.toFixed(2))}>
                              {idx === 0 ? `Exacto ${formatNoRound(amt)}` : `S/. ${amt}`}
                            </button>
                          ))}
                        </div>

                        {receivedAmount !== '' && (
                          <div className={`pos-change ${cashInsufficient ? 'is-bad' : 'is-ok'}`}>
                            <span>{cashInsufficient ? 'Falta' : 'Vuelto a entregar'}</span>
                            <strong className="tabular">S/. {formatNoRound(Math.abs(changeAmount))}</strong>
                          </div>
                        )}
                      </div>
                    )}

                    {paymentMethod === 'Tarjeta' && (
                      <div className="alert alert-warning" style={{ flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                          <AlertTriangle size={14} />
                          <span>Comisión de tarjeta (5%): S/. {formatNoRound(total * 0.05)}</span>
                        </div>
                        <div>Monto total con recargo: <strong className="tabular">S/. {formatNoRound(total * 1.05)}</strong></div>
                        <div style={{ fontSize: '11px', fontStyle: 'italic' }}>Referencial: no se guarda en la boleta/factura/ticket.</div>
                      </div>
                    )}
                  </div>
              </div>

              {renderOrderPanel(true)}
            </div>
          )}

          {/* ==================== MODAL: ATRIBUTOS DE PRENDA ==================== */}
          {modalProduct && (
            <div className="modal-overlay" onClick={closeProductModal}>
              <div className="modal" style={{ maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '18px' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: '64px', height: '80px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--bg-subtle)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {modalProduct.image_url ? <img src={modalProduct.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package size={24} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: '15px', display: 'block' }}>{modalProduct.name}</strong>
                    {modalProduct.sku && <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>SKU: {modalProduct.sku}</span>}
                    <span className="tabular" style={{ fontSize: '15px', fontWeight: 700, display: 'block', marginTop: '4px' }}>S/. {formatNoRound(regularUnitPrice(modalProduct, selectedSize))}</span>
                  </div>
                  <button onClick={closeProductModal} className="btn-ghost btn-icon" aria-label="Cerrar"><X size={18} /></button>
                </div>

                {/* Selector de Color */}
                {modalProduct.colors?.length > 0 && (
                  <div>
                    <label className="field-label">Color</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {modalProduct.colors.map(c => {
                        const isSelected = modalColor?.hex === c.hex;
                        const out = toNum(c.stock) <= 0;
                        return (
                          <button
                            key={c.hex}
                            type="button"
                            disabled={out}
                            onClick={() => {
                              setSelectedColor(c);
                              if (variantStock(modalProduct, c.hex, selectedSize) <= 0) setSelectedSize(firstAvailableSize(modalProduct, c));
                            }}
                            className={`pos-chip ${isSelected ? 'is-active' : ''}`}
                          >
                            <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: c.hex, border: '1px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />
                            <span>{c.name}</span>
                            <span className={`badge ${out ? 'badge-danger' : 'badge-success'} tabular`}>{toNum(c.stock)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Selector de Talla */}
                {modalProduct.sizes?.length > 0 && (
                  <div>
                    <label className="field-label">Talla</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {modalProduct.sizes.map(size => {
                        const isSelected = selectedSize === size;
                        const sizeStock = variantStock(modalProduct, modalColor?.hex, size);
                        const hasStock = sizeStock > 0;
                        return (
                          <button
                            key={size}
                            type="button"
                            disabled={!hasStock}
                            onClick={() => setSelectedSize(size)}
                            className={`pos-size ${isSelected ? 'is-active' : ''}`}
                          >
                            <span>{size}</span>
                            <span style={{ fontSize: '10px', fontWeight: 600, opacity: 0.85 }} className="tabular">
                              {hasStock ? `${sizeStock} uds` : 'Agotado'}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Tabla resumen rápido de stock por color/talla */}
                    {modalProduct.colors?.length > 0 && (
                      <div className="table-wrap" style={{ marginTop: '12px', maxHeight: '160px', overflow: 'auto' }}>
                        <table className="data-table" style={{ fontSize: '11px' }}>
                          <thead>
                            <tr>
                              <th style={{ padding: '6px 10px', position: 'sticky', top: 0 }}>Color</th>
                              {modalProduct.sizes.map(s => (
                                <th key={s} style={{ padding: '6px 8px', textAlign: 'center', position: 'sticky', top: 0 }}>{s}</th>
                              ))}
                              <th style={{ padding: '6px 8px', textAlign: 'center', position: 'sticky', top: 0 }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {modalProduct.colors.map(c => (
                              <tr key={c.hex} style={{ backgroundColor: modalColor?.hex === c.hex ? 'var(--color-primary-soft)' : undefined }}>
                                <td style={{ padding: '5px 10px' }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: c.hex, border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
                                    {c.name}
                                  </span>
                                </td>
                                {modalProduct.sizes.map(s => {
                                  const qty = variantStock(modalProduct, c.hex, s);
                                  return (
                                    <td key={s} style={{ padding: '5px 8px', textAlign: 'center', fontWeight: qty > 0 ? 700 : 400, color: qty > 0 ? 'var(--color-success)' : 'var(--text-muted)' }}>
                                      {qty}
                                    </td>
                                  );
                                })}
                                <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700 }}>{toNum(c.stock)}</td>
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
                  <label className="field-label">Cantidad</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div className="pos-qty pos-qty-lg">
                      <button type="button" onClick={() => setSelectedQty(q => Math.max(1, q - 1))} aria-label="Restar"><Minus size={16} /></button>
                      <input
                        type="number"
                        min="1"
                        max={Math.max(1, modalRemaining)}
                        value={selectedQty}
                        onChange={e => setSelectedQty(Math.max(1, parseInt(e.target.value) || 1))}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddProductWithDetails(); }}
                        className="tabular"
                        aria-label="Cantidad"
                      />
                      <button type="button" onClick={() => setSelectedQty(q => Math.min(Math.max(1, modalRemaining), q + 1))} aria-label="Sumar"><Plus size={16} /></button>
                    </div>
                    <span style={{ fontSize: '12px', color: modalRemaining > 0 ? 'var(--text-secondary)' : 'var(--color-danger)' }}>
                      Disponible: <strong className="tabular">{modalRemaining}</strong>
                      {modalInCart > 0 && ` (ya ${modalInCart} en el pedido)`}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleAddProductWithDetails}
                  disabled={modalRemaining <= 0 || selectedQty > modalRemaining}
                  className="btn-primary btn-lg btn-block"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <Plus size={16} />
                  {modalRemaining <= 0 ? 'Sin stock para esta variante' : 'Añadir al pedido'}
                </button>
              </div>
            </div>
          )}

          {/* MODAL NUEVO CLIENTE */}
          {showCustModal && (
            <div className="modal-overlay" style={{ zIndex: 3000 }} onClick={() => !savingCustomer && setShowCustModal(false)}>
              <form onSubmit={handleCreateCustomer} className="modal" style={{ maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '14px' }} onClick={e => e.stopPropagation()}>
                <h3 style={{ fontSize: '17px', fontWeight: 700 }}>Registrar cliente</h3>
                <div>
                  <label className="field-label">Nombre *</label>
                  <input type="text" required autoFocus className="input-field" value={newCust.name} onChange={e => setNewCust({ ...newCust, name: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">DNI / RUC</label>
                  <input type="text" inputMode="numeric" className="input-field" value={newCust.document_number} onChange={e => setNewCust({ ...newCust, document_number: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Teléfono</label>
                  <input type="tel" className="input-field" value={newCust.phone} onChange={e => setNewCust({ ...newCust, phone: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <button type="button" onClick={() => setShowCustModal(false)} disabled={savingCustomer} className="btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                  <button type="submit" disabled={savingCustomer} className="btn-primary" style={{ flex: 1 }}>{savingCustomer ? 'Guardando…' : 'Guardar'}</button>
                </div>
              </form>
            </div>
          )}

          {/* ==================== MODAL: DATOS OPCIONALES CLIENTE (TICKET) ==================== */}
          {showTicketCustomerModal && (
            <div className="modal-overlay" style={{ zIndex: 3500 }} onClick={() => setShowTicketCustomerModal(false)}>
              <form
                className="modal"
                style={{ maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '14px' }}
                onClick={e => e.stopPropagation()}
                onSubmit={e => { e.preventDefault(); setShowTicketCustomerModal(false); }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: '48px', height: '48px', backgroundColor: 'var(--color-success-soft)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <UserPlus size={22} color="var(--color-success)" />
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>Datos del cliente (opcional)</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Si agregas un teléfono, podrás enviar el comprobante por WhatsApp.
                  </p>
                </div>

                <div>
                  <label className="field-label">Nombre del cliente</label>
                  <input type="text" placeholder="Ej: Juan Pérez" autoFocus className="input-field" value={ticketCustomerData.name} onChange={e => setTicketCustomerData({ ...ticketCustomerData, name: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Teléfono / WhatsApp</label>
                  <input type="tel" placeholder="Ej: 987654321" className="input-field" value={ticketCustomerData.phone} onChange={e => setTicketCustomerData({ ...ticketCustomerData, phone: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">DNI</label>
                  <input type="text" inputMode="numeric" placeholder="Ej: 12345678" className="input-field" value={ticketCustomerData.document_number} onChange={e => setTicketCustomerData({ ...ticketCustomerData, document_number: e.target.value })} />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setTicketCustomerData(EMPTY_TICKET_CUSTOMER);
                      setShowTicketCustomerModal(false);
                    }}
                    className="btn-secondary"
                    style={{ flex: 1 }}
                  >
                    Omitir
                  </button>
                  <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                    {ticketCustomerData.name || ticketCustomerData.phone ? 'Guardar y continuar' : 'Continuar'}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      )}

      {/* MODAL DE AUTORIZACIÓN DEL ADMINISTRADOR - Siempre accesible */}
      {showAuthModal && (
        <div className="modal-overlay" style={{ zIndex: 4000 }}>
          <form onSubmit={handleAdminAuthSubmit} className="modal" style={{ maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <ShieldAlert size={20} style={{ color: 'var(--color-warning)' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
                {adminVerifiedName ? 'Apertura de caja' : 'Autorización del administrador'}
              </h3>
            </div>

            {adminVerifiedName ? (
              <>
                <div className="alert alert-success" style={{ padding: '8px 12px' }}>
                  <CheckCircle size={16} /> Admin verificado: {adminVerifiedName}
                </div>
                <div>
                  <label className="field-label">Monto de apertura (S/.)</label>
                  <input type="number" step="0.01" min="0" inputMode="decimal" required autoFocus placeholder="100.00" className="input-field tabular" value={authOpeningAmount} onChange={e => setAuthOpeningAmount(e.target.value)} />
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Esta acción requiere credenciales de un Administrador para habilitar el turno en caja.
                </p>
                <div>
                  <label className="field-label">Correo de administrador</label>
                  <input type="email" required autoFocus autoComplete="username" placeholder="correo del administrador" className="input-field" value={authEmail} onChange={e => setAuthEmail(e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Contraseña</label>
                  <input type="password" required autoComplete="current-password" placeholder="••••••••" className="input-field" value={authPassword} onChange={e => setAuthPassword(e.target.value)} />
                </div>
              </>
            )}

            {authError && (
              <div className="alert alert-danger" style={{ padding: '8px 12px' }}>
                <AlertTriangle size={16} /> {authError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button type="button" disabled={authBusy} onClick={() => { setShowAuthModal(false); setAdminVerifiedName(''); }} className="btn-secondary" style={{ flex: 1 }}>Cancelar</button>
              <button type="submit" disabled={authBusy} className="btn-primary" style={{ flex: 1 }}>
                {authBusy ? 'Verificando…' : adminVerifiedName ? 'Abrir caja' : 'Autorizar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* COMPROBANTE: vista previa, impresión, PDF y WhatsApp (mismo diseño en los tres) */}
      {showPrintModal && lastCreatedSale && (
        <ReceiptModal
          sale={lastCreatedSale}
          config={config}
          onClose={closePrintModal}
          defaultPhone={lastCreatedSale.customer_phone}
        />
      )}

      {/* Estilos de layout del POS (responsivos) */}
      <style>{`
        .pos-root { height: calc(100vh - 120px); display: flex; flex-direction: column; min-height: 0; }
        .pos-steps { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .pos-step { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px 6px 6px; border-radius: var(--radius-pill); font-size: 13px; font-weight: 500; color: var(--text-muted); background: var(--bg-card); border: 1px solid var(--border-color); }
        .pos-step-num { width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; background: var(--bg-subtle); color: var(--text-secondary); }
        .pos-step-active { color: var(--text-primary); border-color: var(--color-primary); box-shadow: var(--shadow-xs); }
        .pos-step-active .pos-step-num { background: var(--color-primary); color: #FFF; }
        .pos-step-done { color: var(--text-secondary); }
        .pos-step-done .pos-step-num { background: var(--color-success-soft); color: var(--color-success); }

        .pos-doc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .pos-choice { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 14px 8px; border: 1px solid var(--border-color); border-radius: var(--radius); background: var(--bg-card); color: var(--text-primary); cursor: pointer; font-family: inherit; transition: border-color .15s, background .15s, box-shadow .15s; }
        .pos-choice:hover { border-color: var(--border-strong); background: var(--bg-hover); }
        .pos-choice.is-active { background: var(--color-primary); border-color: var(--color-primary); color: #FFF; box-shadow: var(--shadow-sm); }
        .pos-choice-sm { flex-direction: row; gap: 8px; padding: 12px 10px; font-size: 13px; font-weight: 600; }
        .pos-pay-methods { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }

        .pos-selected-client { display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid var(--color-primary); background: var(--color-primary-soft); border-radius: var(--radius); }
        .pos-client-list { max-height: 240px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius); }
        .pos-client-row { display: flex; justify-content: space-between; gap: 12px; width: 100%; padding: 10px 12px; border: none; border-bottom: 1px solid var(--border-color); background: var(--bg-card); cursor: pointer; text-align: left; font-size: 13px; font-family: inherit; color: var(--text-primary); }
        .pos-client-row:last-child { border-bottom: none; }
        .pos-client-row:hover { background: var(--bg-hover); }

        .pos-grid-container { display: grid; grid-template-columns: minmax(300px, 1fr) minmax(0, 640px); gap: 16px; flex: 1; min-height: 0; }
        .pos-catalog { display: flex; flex-direction: column; gap: 12px; min-height: 0; }
        .pos-detail-panel { flex: 0 1 auto; max-height: 48%; min-height: 0; display: flex; flex-direction: column; gap: 8px; padding: 14px 16px; overflow-y: auto; }
        .pos-detail-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--text-secondary); }
        .pos-catalog-grid { flex: 1; min-height: 140px; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; align-content: start; padding: 2px 2px 8px; }
        .pos-product-card { position: relative; display: flex; flex-direction: column; padding: 0; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius); overflow: hidden; cursor: pointer; font-family: inherit; color: var(--text-primary); transition: box-shadow .15s, border-color .15s, transform .15s; }
        .pos-product-card:hover { box-shadow: var(--shadow-md); border-color: var(--border-strong); transform: translateY(-1px); }
        .pos-product-card:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
        .pos-product-card.is-out { opacity: .55; cursor: not-allowed; }
        .pos-product-card.is-out:hover { transform: none; box-shadow: none; }
        .pos-product-img { position: relative; width: 100%; height: 120px; background: var(--bg-subtle); display: flex; align-items: center; justify-content: center; }
        .pos-product-img img { width: 100%; height: 100%; object-fit: cover; }
        .pos-product-name { font-size: 13px; font-weight: 500; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

        .pos-cart { display: flex; flex-direction: column; min-height: 0; padding: 0; overflow: hidden; }
        .pos-cart-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; padding: 14px 16px; border-bottom: 1px solid var(--border-color); }
        .pos-cart-client { background: none; border: none; padding: 0; margin-top: 2px; font-size: 12px; color: var(--text-secondary); cursor: pointer; text-align: left; font-family: inherit; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pos-cart-client:hover { color: var(--color-primary); text-decoration: underline; }
        .pos-cart-lines { flex: 1; min-height: 0; overflow: auto; padding: 12px; }
        .pos-cart-lines .table-wrap { border-radius: var(--radius); }
        .pos-discount-bar { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-top: 1px solid var(--border-color); background: var(--color-warning-soft); }
        .pos-sum-normal { text-align: right; font-size: 13px; color: var(--text-secondary); }
        .pos-sum-normal strong { color: var(--text-primary); }
        .pos-sum-pay { display: flex; justify-content: flex-end; align-items: baseline; gap: 12px; }
        .pos-sum-pay span { font-size: 14px; font-weight: 600; color: var(--text-secondary); }
        .pos-sum-pay strong { font-size: 28px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.01em; }
        .pos-line { padding: 12px 16px; border-bottom: 1px solid var(--border-color); }
        .pos-line.is-editing { background: var(--color-warning-soft); }
        .pos-cart-footer { border-top: 1px solid var(--border-color); padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 6px; background: var(--bg-subtle); }
        .pos-total-row { display: flex; justify-content: space-between; font-size: 13px; color: var(--text-secondary); }
        .pos-grand-total { font-size: 22px; font-weight: 700; color: var(--text-primary); padding: 6px 0 8px; letter-spacing: -0.01em; }

        .pos-qty { display: inline-flex; align-items: center; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-card); overflow: hidden; }
        .pos-qty button { width: 32px; height: 32px; border: none; background: transparent; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; color: var(--text-primary); }
        .pos-qty button:hover { background: var(--bg-hover); }
        .pos-qty span, .pos-qty input { min-width: 36px; text-align: center; font-weight: 600; font-size: 14px; }
        .pos-qty input { width: 56px; height: 40px; border: none; border-left: 1px solid var(--border-color); border-right: 1px solid var(--border-color); outline: none; font-family: inherit; -moz-appearance: textfield; }
        .pos-qty input::-webkit-outer-spin-button, .pos-qty input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .pos-qty-lg button { width: 40px; height: 40px; }

        .pos-chip { display: inline-flex; align-items: center; gap: 8px; padding: 7px 12px; border: 1px solid var(--border-color); border-radius: var(--radius-pill); background: var(--bg-card); font-size: 13px; cursor: pointer; font-family: inherit; color: var(--text-primary); }
        .pos-chip:hover:not(:disabled) { border-color: var(--border-strong); }
        .pos-chip.is-active { border-color: var(--color-primary); box-shadow: 0 0 0 2px var(--color-primary-soft); font-weight: 600; }
        .pos-chip:disabled { opacity: .45; cursor: not-allowed; }
        .pos-size { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 56px; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-card); color: var(--text-primary); font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .pos-size:hover:not(:disabled) { border-color: var(--border-strong); }
        .pos-size.is-active { background: var(--color-primary); border-color: var(--color-primary); color: #FFF; }
        .pos-size:disabled { opacity: .45; cursor: not-allowed; color: var(--text-muted); }

        .pos-pay-card { display: flex; flex-direction: column; gap: 18px; padding: 20px; min-height: 0; overflow-y: auto; align-self: start; }
        .pos-pay-grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 24px; }
        .pos-pay-summary { display: flex; flex-direction: column; gap: 10px; padding: 16px; border-radius: var(--radius); background: var(--bg-subtle); border: 1px solid var(--border-color); min-width: 0; }
        .pos-pay-lines { max-height: 260px; overflow-y: auto; }
        .pos-change { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-radius: var(--radius); font-size: 14px; font-weight: 600; border: 1px solid transparent; }
        .pos-change strong { font-size: 24px; }
        .pos-change.is-ok { background: var(--color-success-soft); color: #065F46; border-color: #A7F3D0; }
        .pos-change.is-bad { background: var(--color-danger-soft); color: #991B1B; border-color: #FECACA; }

        @media (max-width: 1100px) {
          .pos-grid-container { grid-template-columns: minmax(260px, 1fr) minmax(0, 600px); }
        }
        @media (max-width: 860px) {
          .pos-root { height: auto; }
          .pos-grid-container { grid-template-columns: 1fr; }
          .pos-catalog-grid { max-height: 55vh; }
          .pos-pay-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 480px) {
          .pos-catalog-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
          .pos-product-img { height: 100px; }
          .pos-doc-grid { gap: 6px; }
          .pos-choice { padding: 12px 4px; }
          .pos-step-label { display: none; }
          .pos-step { padding: 4px; }
        }
        @media print {
          .pos-root { height: auto !important; }
        }
      `}</style>

    </div>
  );
}
