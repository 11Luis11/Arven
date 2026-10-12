// src/utils/pricing.js
// Helpers de precios/stock para la tienda pública. Evitan NaN / crashes al
// formatear precios null, undefined o strings.

/** Convierte a número; devuelve null si no es un número válido ('' / null / 'abc'). */
export function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

/** "S/. 49.90" — tolera valores nulos o strings. */
export function formatMoney(value) {
  const n = toNumber(value) ?? 0;
  return `S/. ${n.toFixed(2)}`;
}

/**
 * Precio a mostrar en tarjetas: oferta (si es menor que el precio regular) o precio regular.
 * @returns {{ price: number, original: number|null, discount: number }}
 */
export function getCardPricing(product) {
  const regular = toNumber(product?.price) ?? 0;
  const offer = toNumber(product?.offer_price);
  if (offer !== null && offer > 0 && offer < regular) {
    return { price: offer, original: regular, discount: getDiscountPercent(regular, offer) };
  }
  return { price: regular, original: null, discount: 0 };
}

/** % de descuento redondeado (0 si no aplica). */
export function getDiscountPercent(original, price) {
  const o = toNumber(original);
  const p = toNumber(price);
  if (!o || p === null || p >= o) return 0;
  return Math.round(((o - p) / o) * 100);
}

/** Stock disponible de una combinación color/talla. */
export function getVariantStock(product, color, size) {
  if (!product) return 0;
  const hasSizes = Array.isArray(product.sizes) && product.sizes.length > 0;
  if (color) {
    if (hasSizes && color.sizes_stock && typeof color.sizes_stock === 'object') {
      return parseInt(color.sizes_stock[size], 10) || 0;
    }
    // Colores sin desglose por talla: se usa el stock total del color.
    return parseInt(color.stock, 10) || 0;
  }
  return parseInt(product.stock, 10) || 0;
}

/** Normaliza un teléfono para wa.me (agrega 51 si es un celular peruano de 9 dígitos). */
export function toWhatsAppPhone(phone, fallback = '51987654321') {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return fallback;
  if (digits.length === 9 && digits.startsWith('9')) return `51${digits}`;
  return digits;
}
