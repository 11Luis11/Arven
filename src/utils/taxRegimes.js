// ==========================================
// FINANZAS Y TRIBUTACIÓN — Motor de reglas tributarias (Perú)
// ==========================================
// Centraliza la lógica de regímenes tributarios, IGV y formateo
// para que todos los sub-módulos de Finanzas y Tributación
// se comporten de forma consistente y "inteligente" según el
// régimen elegido por la empresa.

export const IGV_RATE = 0.18;

export const CURRENCIES = [
  { code: 'PEN', symbol: 'S/', name: 'Sol Peruano' },
  { code: 'USD', symbol: '$', name: 'Dólar Americano' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
];

export const TAXPAYER_TYPES = [
  { id: 'natural', label: 'Persona Natural', hint: 'RUC inicia en 10' },
  { id: 'juridica', label: 'Persona Jurídica', hint: 'RUC inicia en 20' },
];

// Definición de regímenes tributarios peruanos con sus reglas.
export const TAX_REGIMES = {
  RUS: {
    id: 'RUS',
    name: 'Nuevo RUS',
    fullName: 'Nuevo Régimen Único Simplificado',
    description: 'Pensado para negocios muy pequeños. Se paga una cuota única mensual según categoría de ingresos. No permite emitir facturas (solo boletas) y no genera crédito fiscal de IGV.',
    annualLimit: 96000,
    hasIGV: false,
    hasCreditoFiscal: false,
    hasRenta: false,
    emitsFacturas: false,
    color: '#F59E0B',
    categories: [
      { id: 1, maxMonthly: 5000, fee: 20 },
      { id: 2, maxMonthly: 8000, fee: 50 },
    ],
  },
  RER: {
    id: 'RER',
    name: 'RER',
    fullName: 'Régimen Especial de Renta',
    description: 'Para pequeñas y medianas empresas con ingresos moderados. Paga IGV (18%) y una cuota fija de 1.5% de los ingresos netos mensuales por Impuesto a la Renta.',
    annualLimit: 525000,
    hasIGV: true,
    hasCreditoFiscal: true,
    hasRenta: true,
    rentaType: 'fixed',
    rentaRate: 0.015,
    emitsFacturas: true,
    color: '#0EA5E9',
  },
  RMT: {
    id: 'RMT',
    name: 'RMT',
    fullName: 'Régimen MYPE Tributario',
    description: 'Para micro y pequeñas empresas. Paga IGV (18%) y pagos a cuenta de Renta (1% mensual hasta 300 UIT de ingresos anuales, o coeficiente si se supera). Regularización anual con tasas progresivas 10%/29.5%.',
    annualLimit: 1700000,
    hasIGV: true,
    hasCreditoFiscal: true,
    hasRenta: true,
    rentaType: 'progressive',
    rentaRate: 0.01,
    emitsFacturas: true,
    color: '#16A34A',
  },
  GENERAL: {
    id: 'GENERAL',
    name: 'Régimen General',
    fullName: 'Régimen General del Impuesto a la Renta',
    description: 'Sin límite de ingresos. Paga IGV (18%) y pagos a cuenta mensuales de Renta (1.5% o coeficiente), con regularización anual a una tasa de 29.5%.',
    annualLimit: Infinity,
    hasIGV: true,
    hasCreditoFiscal: true,
    hasRenta: true,
    rentaType: 'coefficient',
    rentaRate: 0.015,
    emitsFacturas: true,
    color: '#6D28D9',
  },
};

export const REGIME_LIST = Object.values(TAX_REGIMES);

export function getRegime(regimeId) {
  return TAX_REGIMES[regimeId] || TAX_REGIMES.RMT;
}

// Config tributaria por defecto (se guarda embebida dentro de la config general de la tienda)
export const DEFAULT_TAX_CONFIG = {
  configured: false,
  companyName: '',
  ruc: '',
  country: 'Perú',
  currency: 'PEN',
  taxpayerType: 'juridica',
  regime: 'RMT',
  regimeStartDate: new Date().toISOString().slice(0, 10),
  declarationDay: 15, // día del mes en que suele vencer la declaración (referencial, según último dígito RUC)
};

// --- Cálculos de IGV ---
// Dado un total que YA incluye IGV (como se registra en ventas/POS), separa base imponible e IGV.
export function splitIGV(totalWithTax) {
  const base = totalWithTax / (1 + IGV_RATE);
  const igv = totalWithTax - base;
  return { base, igv, total: totalWithTax };
}

export function formatMoney(value, currencyCode = 'PEN') {
  const symbol = (CURRENCIES.find(c => c.code === currencyCode) || CURRENCIES[0]).symbol;
  const n = Number(value) || 0;
  const formatted = n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${symbol} ${formatted}`;
}

export function monthLabel(index) {
  return ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'][index];
}

export function monthRangeLabel(month, year) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  return `${fmt(first)} - ${fmt(last)}`;
}

// Calcula el pago a cuenta de Renta estimado según régimen e ingresos del mes/acumulado.
export function estimateRentaPayment(regimeId, monthlyNetIncome) {
  const regime = getRegime(regimeId);
  if (!regime.hasRenta) return 0;
  if (regime.rentaType === 'fixed') return monthlyNetIncome * regime.rentaRate;
  if (regime.rentaType === 'progressive') return monthlyNetIncome * (regime.rentaRate || 0.01);
  if (regime.rentaType === 'coefficient') return monthlyNetIncome * (regime.rentaRate || 0.015);
  return 0;
}

// Determina la cuota fija de un contribuyente RUS según sus ingresos mensuales.
export function estimateRusFee(monthlyIncome) {
  const cat = TAX_REGIMES.RUS.categories.find(c => monthlyIncome <= c.maxMonthly);
  return cat ? cat.fee : TAX_REGIMES.RUS.categories[TAX_REGIMES.RUS.categories.length - 1].fee;
}

// Próxima fecha de vencimiento aproximada (siguiente mes, día configurado)
export function nextDueDate(day = 15) {
  const now = new Date();
  let due = new Date(now.getFullYear(), now.getMonth() + 1, day);
  return due;
}

export function daysUntil(date) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  return Math.round((d - now) / 86400000);
}
