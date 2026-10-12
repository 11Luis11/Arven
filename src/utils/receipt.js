// Lógica compartida de comprobantes (POS, Reportes, PDF e impresión).
// Convierte las líneas de una venta en filas POR UNIDAD, con precio de lista,
// descuento aplicado y precio final, garantizando que la suma de las filas
// coincida al céntimo con el total cobrado.

export const IGV_RATE = 0.18;

// Ancho del documento en px (A4 = 210 mm a 96 dpi; ticket = 80 mm)
export const RECEIPT_WIDTH = { ticket: 302, boleta: 794, factura: 794 };

const toNum = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

export const round2 = (v) => {
  const n = toNum(v);
  return Math.round((n + (n >= 0 ? 1e-9 : -1e-9)) * 100) / 100;
};

export const money = (v) => round2(v).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const DOC_TITLES = {
  Factura: 'Factura electrónica',
  Boleta: 'Boleta de venta electrónica',
  'Sin Datos': 'Ticket de venta',
};

export const docVariant = (documentType) => (documentType === 'Factura' ? 'factura' : documentType === 'Boleta' ? 'boleta' : 'ticket');

// Reparte `targetCents` entre montos crudos (en soles) usando el método del
// mayor residuo: cada fila queda en céntimos exactos y la suma es exacta.
function distributeCents(rawAmounts, targetCents) {
  if (rawAmounts.length === 0) return [];
  const floors = rawAmounts.map(a => Math.floor(Math.max(0, a) * 100 + 1e-6));
  let diff = targetCents - floors.reduce((s, c) => s + c, 0);
  const order = rawAmounts
    .map((a, i) => ({ i, frac: Math.max(0, a) * 100 - floors[i] }))
    .sort((x, y) => y.frac - x.frac || x.i - y.i);
  const cents = [...floors];
  let k = 0;
  while (diff !== 0 && k < 100000) {
    const { i } = order[k % order.length];
    if (diff > 0) { cents[i] += 1; diff -= 1; }
    else if (cents[i] > 0) { cents[i] -= 1; diff += 1; }
    k += 1;
  }
  return cents;
}

// Datos de la variante a partir del producto (para ventas antiguas sin campos detallados)
function enrichFromProduct(item, productsById) {
  const product = productsById?.get?.(item.product_id);
  const colorName = item.color_name
    || (item.color_hex && product?.colors?.find(c => (c.hex || '').toLowerCase() === String(item.color_hex).toLowerCase())?.name)
    || '';
  // Precio normal de respaldo (ventas guardadas antes de registrar list_price):
  // precio regular de la talla o del producto, sin oferta ni promociones.
  let fallbackList = 0;
  if (product) {
    let tiers = product.wholesale_tiers;
    if (typeof tiers === 'string') { try { tiers = JSON.parse(tiers); } catch { tiers = []; } }
    const sizePrices = (Array.isArray(tiers) ? tiers : []).find(t => t.type === 'size_prices')?.data || {};
    fallbackList = toNum(sizePrices[item.selected_size]?.price) || toNum(product.price);
  }
  return {
    fallbackList,
    sku: item.sku || product?.sku || '',
    name: item.base_name || product?.name || item.product_name || 'Producto',
    color: colorName,
    size: item.selected_size || '',
  };
}

/**
 * @param sale { items, total_amount, discount_amount }
 *   items: [{ product_id, product_name, base_name?, sku?, color_name?, color_hex?, selected_size?,
 *             quantity, unit_price (final c/IGV), list_price?, promo_label? }]
 * @param productsById Map opcional para completar SKU/color en ventas antiguas
 */
export function buildReceipt(sale, productsById) {
  const items = Array.isArray(sale?.items) ? sale.items : [];
  const total = round2(sale?.total_amount);
  const globalDiscount = round2(sale?.discount_amount);
  const subtotal = round2(total + globalDiscount); // lo que suman las filas

  // 1. Expandir a unidades
  const rawUnits = [];
  items.forEach(item => {
    const qty = Math.max(0, Math.round(toNum(item.quantity)));
    const info = enrichFromProduct(item, productsById);
    const unitPrice = toNum(item.unit_price);
    const savedList = toNum(item.list_price);
    const listPrice = Math.max(unitPrice, savedList || info.fallbackList || unitPrice);
    const promoLabel = item.promo_label || (!savedList && listPrice > unitPrice + 0.004 ? 'Descuento' : '');
    for (let u = 0; u < qty; u += 1) {
      rawUnits.push({ ...info, lineId: item.line_id, rawPrice: unitPrice, listPrice: round2(listPrice), promoLabel });
    }
  });

  // 2. Precio final por unidad en céntimos exactos (suma = subtotal)
  const cents = distributeCents(rawUnits.map(u => u.rawPrice), Math.round(subtotal * 100));
  const units = rawUnits.map((u, idx) => {
    const price = cents[idx] / 100;
    const listPrice = Math.max(u.listPrice, price);
    const discount = round2(listPrice - price);
    const pct = listPrice > 0 ? Math.round((discount / listPrice) * 100) : 0;
    const valueNoIgv = round2(price / (1 + IGV_RATE));
    return {
      n: idx + 1,
      lineId: u.lineId,
      sku: u.sku,
      name: u.name,
      color: u.color,
      size: u.size,
      um: 'UND',
      listPrice,
      price,
      discount,
      discountLabel: discount > 0.004 ? (u.promoLabel || `-${pct}%`) : '',
      valueNoIgv,
      igv: round2(price - valueNoIgv),
    };
  });

  const listTotal = round2(units.reduce((s, u) => s + u.listPrice, 0));
  const promoSavings = round2(Math.max(0, listTotal - subtotal));
  // IGV incluido en el precio: se respeta que el cliente paga exactamente el total
  const base = round2(total / (1 + IGV_RATE));
  const igv = round2(total - base);

  return {
    units,
    unitCount: units.length,
    listTotal,
    promoSavings,
    subtotal,
    globalDiscount,
    totalSavings: round2(promoSavings + globalDiscount),
    total,
    base,
    igv,
  };
}
