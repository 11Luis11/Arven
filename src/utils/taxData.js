import { DataService } from '../services/dataService';
import { DEFAULT_TAX_CONFIG, splitIGV, monthLabel } from './taxRegimes';

const PURCHASES_KEY = 'arven_tax_purchases';

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
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error leyendo compras tributarias:', e);
    return [];
  }
}

function persistPurchases(list) {
  localStorage.setItem(PURCHASES_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('arven-tax-purchases-updated'));
  return list;
}

export function savePurchase(purchase) {
  const list = getPurchases();
  const { base, igv } = splitIGV(Number(purchase.total) || 0);
  const record = {
    id: purchase.id || 'pur-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    docType: purchase.docType || 'Factura',
    series: purchase.series || '',
    providerName: purchase.providerName || '',
    providerRuc: purchase.providerRuc || '',
    date: purchase.date || new Date().toISOString().slice(0, 10),
    total: Number(purchase.total) || 0,
    base: purchase.excludesIGV ? Number(purchase.total) || 0 : base,
    igv: purchase.excludesIGV ? (Number(purchase.total) || 0) * 0.18 : igv,
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
  return () => window.removeEventListener('arven-tax-purchases-updated', cb);
}

// --- Agregaciones ---
export function filterByMonth(items, dateField, month, year) {
  return items.filter(it => {
    const d = new Date(it[dateField]);
    return d.getMonth() === month && d.getFullYear() === year;
  });
}

export function sumSales(sales) {
  return sales.reduce((acc, s) => acc + (s.total_amount || 0), 0);
}

export function sumPurchases(purchases) {
  return purchases.reduce((acc, p) => acc + (p.total || 0), 0);
}

// Ingresos acumulados en el año (para control de límites de régimen)
export function yearToDateIncome(sales, year) {
  return sales
    .filter(s => s.status !== 'voided' && new Date(s.created_at).getFullYear() === year)
    .reduce((acc, s) => acc + (s.total_amount || 0), 0);
}

// Serie mensual Ventas vs Compras para un año dado (12 puntos)
export function monthlySeries(sales, purchases, year) {
  return Array.from({ length: 12 }, (_, m) => {
    const monthSales = filterByMonth(sales.filter(s => s.status !== 'voided'), 'created_at', m, year);
    const monthPurchases = filterByMonth(purchases, 'date', m, year);
    return {
      label: monthLabel(m),
      ventas: sumSales(monthSales),
      compras: sumPurchases(monthPurchases),
    };
  });
}

export function documentDistribution(sales) {
  const buckets = { Factura: 0, Boleta: 0, 'Nota de crédito': 0, 'Nota de débito': 0 };
  sales.forEach(s => {
    if (s.document_type === 'Factura') buckets.Factura += s.total_amount;
    else if (s.document_type === 'Boleta' || s.document_type === 'Sin Datos') buckets.Boleta += s.total_amount;
  });
  return buckets;
}
