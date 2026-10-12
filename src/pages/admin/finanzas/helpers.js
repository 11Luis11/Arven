// Utilidades (no componentes) compartidas por las pestañas de Finanzas.

// Colores de series para gráficos (tokens del sistema de diseño, validados para daltonismo).
export const CHART_COLORS = {
  ventas: 'var(--color-primary)',
  compras: 'var(--color-warning)',
  factura: 'var(--color-primary)',
  boleta: 'var(--color-warning)',
  notaCredito: 'var(--color-info)',
  notaDebito: 'var(--color-success)',
};

export const limitColor = (pct) => (pct >= 90 ? 'var(--color-danger)' : pct >= 70 ? 'var(--color-warning)' : 'var(--color-success)');

// Etiqueta amigable del tipo de comprobante de venta.
export const docLabel = (type) => (type === 'Sin Datos' ? 'Ticket' : type || '—');
export const docTone = (type) => (type === 'Factura' ? 'primary' : type === 'Boleta' ? 'warning' : 'neutral');

// Construye una fila CSV escapando comillas, comas y saltos de línea.
export function csvRow(values) {
  return values.map(v => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',');
}

export const money2 = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0).toFixed(2);

// Estilo para celdas numéricas
export const num = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
export const numRight = { ...num, textAlign: 'right' };
