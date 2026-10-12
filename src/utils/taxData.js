import { DataService } from '../services/dataService';
import { DEFAULT_TAX_CONFIG, IGV_RATE, splitIGV, monthLabel, parseLocalDate, toLocalISODate, estimateRentaPayment, estimateRusFee } from './taxRegimes';

const PURCHASES_KEY = 'arven_tax_purchases';

// Convierte a número de forma segura (Supabase puede devolver `numeric` como string).
export const toNum = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

// Las ventas anuladas no cuentan para ningún cálculo tributario.
export const isActiveSale = (s) => s && s.status !== 'voided';

// --- Configuración tributaria (vive embebida en la config general de la tienda) ---
export function getTaxConfig(config) {
  return { ...DEFAULT_TAX_CONFIG, ...(config?.taxConfig || {}) };
}

export async function saveTaxConfig(config, taxConfigPatch) {
  const updated = { ...getTaxConfig(config), ...taxConfigPatch };
  await DataService.saveConfig({ ...config, taxConfig: updated });
  return updated;
}

// --- Compras (facturas/boletas de proveedores) ---
// Se guardan en localStorage: en un ERP real irían a la base de datos junto a las ventas,
// pero para no tocar el esquema de Supabase existente del sistema, el módulo de Finanzas
// gestiona sus propios registros de compras de forma local y reactiva.
export function getPurchases() {
  try {
    const raw = localStorage.getItem(PURCHASES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.error('Error leyendo compras tributarias:', e);
    return [];
  }
}

function persistPurchases(list) {
  // Puede lanzar (cuota llena / modo privado): el llamador debe capturarlo y avisar al usuario.
  localStorage.setItem(PURCHASES_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('arven-tax-purchases-updated'));
  return list;
}

export function savePurchase(purchase) {
  const list = getPurchases();
  const amount = toNum(purchase.total);
  // Si el monto ingresado NO incluye IGV, el total del comprobante es base + 18%.
  const { base, igv, total } = purchase.excludesIGV
    ? { base: amount, igv: amount * IGV_RATE, total: amount * (1 + IGV_RATE) }
    : splitIGV(amount);
  const record = {
    id: purchase.id || 'pur-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    docType: purchase.docType || 'Factura',
    series: purchase.series || '',
    providerName: (purchase.providerName || '').trim(),
    providerRuc: purchase.providerRuc || '',
    date: purchase.date || toLocalISODate(),
    total,
    base,
    igv,
    category: purchase.category || 'General',
    status: purchase.status || 'Aceptado',
    createdAt: purchase.createdAt || new Date().toISOString(),
  };
  const idx = list.findIndex(p => p.id === record.id);
  if (idx >= 0) list[idx] = record; else list.unshift(record);
  return persistPurchases(list);
}

export function deletePurchase(id) {
  const list = getPurchases().filter(p => p.id !== id);
  return persistPurchases(list);
}

export function subscribeToPurchases(cb) {
  window.addEventListener('arven-tax-purchases-updated', cb);
  // Sincroniza también entre pestañas del navegador.
  const onStorage = (e) => { if (e.key === PURCHASES_KEY) cb(); };
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener('arven-tax-purchases-updated', cb);
    window.removeEventListener('storage', onStorage);
  };
}

// --- Agregaciones ---
export function filterByMonth(items, dateField, month, year) {
  return items.filter(it => {
    const d = parseLocalDate(it[dateField]);
    return d.getMonth() === month && d.getFullYear() === year;
  });
}

export function sumSales(sales) {
  return sales.reduce((acc, s) => acc + (isActiveSale(s) ? toNum(s.total_amount) : 0), 0);
}

export function sumPurchases(purchases) {
  return purchases.reduce((acc, p) => acc + toNum(p.total), 0);
}

export function sumPurchasesIGV(purchases) {
  return purchases.reduce((acc, p) => acc + toNum(p.igv), 0);
}

// Ingresos acumulados en el año (para control de límites de régimen)
export function yearToDateIncome(sales, year) {
  return sumSales(sales.filter(s => new Date(s.created_at).getFullYear() === year));
}

// Serie mensual Ventas vs Compras para un año dado (12 puntos)
export function monthlySeries(sales, purchases, year) {
  const active = sales.filter(isActiveSale);
  return Array.from({ length: 12 }, (_, m) => ({
    label: monthLabel(m),
    ventas: sumSales(filterByMonth(active, 'created_at', m, year)),
    compras: sumPurchases(filterByMonth(purchases, 'date', m, year)),
  }));
}

// Resumen tributario mensual (12 filas) según el régimen.
// IGV incluido en precio: base = total / 1.18. El Nuevo RUS no paga IGV ni Renta: solo cuota fija.
export function monthlyTaxRows(sales, purchases, year, regime) {
  const active = sales.filter(isActiveSale);
  return Array.from({ length: 12 }, (_, m) => {
    const salesTotal = sumSales(filterByMonth(active, 'created_at', m, year));
    const { base, igv: igvVentas } = splitIGV(salesTotal);
    const igvCompras = sumPurchasesIGV(filterByMonth(purchases, 'date', m, year));
    const saldo = igvVentas - igvCompras;
    const igvPagar = regime.hasIGV ? Math.max(0, saldo) : 0;
    const renta = regime.hasRenta ? estimateRentaPayment(regime.id, base) : 0;
    const rus = !regime.hasIGV ? estimateRusFee(salesTotal) : 0;
    return { m, salesTotal, base, igvVentas, igvCompras, saldo, igvPagar, renta, rus, total: igvPagar + renta + rus };
  });
}

export function documentDistribution(sales) {
  const buckets = { Factura: 0, Boleta: 0, 'Nota de crédito': 0, 'Nota de débito': 0 };
  sales.forEach(s => {
    if (!isActiveSale(s)) return;
    const amount = toNum(s.total_amount);
    if (s.document_type === 'Factura') buckets.Factura += amount;
    else if (s.document_type === 'Boleta' || s.document_type === 'Sin Datos') buckets.Boleta += amount;
  });
  return buckets;
}
