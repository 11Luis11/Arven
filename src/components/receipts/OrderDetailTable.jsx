import { Pencil, Minus } from 'lucide-react';
import { buildReceipt, money } from '../../utils/receipt';

// Detalle del pedido POR UNIDAD (misma lógica que el comprobante impreso)
// actions (opcional): { onRemoveUnit(lineId), onEditLine(lineId), editingLineId } -> columna de acciones por unidad
export default function OrderDetailTable({ items, total, discount = 0, maxHeight, actions, showTotals = true, compact = false }) {
  const receipt = buildReceipt({ items, total_amount: total, discount_amount: discount });

  if (receipt.unitCount === 0) {
    return <div className="empty-state" style={{ padding: 24 }}>Aún no hay productos en el pedido.</div>;
  }

  return (
    <div className={`order-detail ${compact ? 'is-compact' : ''}`}>
      <div className="table-wrap" style={{ maxHeight, overflowY: maxHeight ? 'auto' : undefined }}>
        <table className="data-table order-detail-table">
          <thead>
            <tr>
              {!compact && <th style={{ width: 36, textAlign: 'center' }}>#</th>}
              {!compact && <th>SKU</th>}
              <th>{compact ? 'Producto / SKU' : 'Producto'}</th>
              <th>Color</th>
              <th style={{ textAlign: 'center' }}>Talla</th>
              <th style={{ textAlign: 'center' }}>U.M.</th>
              <th style={{ textAlign: 'right' }}>P. normal</th>
              <th style={{ textAlign: 'right' }}>Descuento</th>
              <th style={{ textAlign: 'right' }}>P. a pagar</th>
              {actions && <th style={{ width: 56 }} aria-label="Acciones" />}
            </tr>
          </thead>
          <tbody>
            {receipt.units.map(u => (
              <tr key={u.n} className={actions?.editingLineId && actions.editingLineId === u.lineId ? 'is-editing' : ''}>
                {!compact && <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{u.n}</td>}
                {!compact && <td style={{ fontFamily: 'Consolas, monospace', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{u.sku || '—'}</td>}
                <td>
                  <div style={{ fontWeight: 600 }}>{u.name}</div>
                  {compact && <div style={{ fontFamily: 'Consolas, monospace', fontSize: 11, color: 'var(--text-muted)' }}>{u.sku || '—'}</div>}
                </td>
                <td>{u.color || '—'}</td>
                <td style={{ textAlign: 'center' }}>{u.size || 'Única'}</td>
                <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{u.um}</td>
                <td className="tabular" style={{ textAlign: 'right', color: u.discount > 0 ? 'var(--text-muted)' : undefined, textDecoration: u.discount > 0 ? 'line-through' : 'none' }}>
                  S/ {money(u.listPrice)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {u.discount > 0 ? (
                    <div style={{ lineHeight: 1.25 }}>
                      <div className="tabular" style={{ color: 'var(--color-danger)', fontWeight: 700 }}>- S/ {money(u.discount)}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{u.discountLabel}</div>
                    </div>
                  ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </td>
                <td className="tabular" style={{ textAlign: 'right', fontWeight: 700 }}>S/ {money(u.price)}</td>
                {actions && (
                  <td style={{ textAlign: 'right', padding: '4px 6px' }}>
                    <div style={{ display: 'inline-flex', gap: 2 }}>
                      <button type="button" className="btn-ghost btn-icon btn-sm" title="Descuento extra para esta prenda" aria-label="Descuento extra" onClick={() => actions.onEditLine(u.lineId)}>
                        <Pencil size={14} />
                      </button>
                      <button type="button" className="btn-ghost btn-icon btn-sm" title="Quitar una unidad" aria-label="Quitar una unidad" onClick={() => actions.onRemoveUnit(u.lineId)} style={{ color: 'var(--color-danger)' }}>
                        <Minus size={15} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showTotals && <div className="order-detail-totals">
        <div className="order-detail-normal">
          {receipt.unitCount} unidad{receipt.unitCount === 1 ? '' : 'es'} · Precio normal <strong className="tabular">S/ {money(receipt.listTotal)}</strong>
          {receipt.totalSavings > 0.004 && <> · <span style={{ color: 'var(--color-success)' }}>Ahorro <strong className="tabular" style={{ color: 'inherit' }}>S/ {money(receipt.totalSavings)}</strong></span></>}
        </div>
        <div className="order-detail-pay">
          <span>Precio a pagar</span>
          <strong className="tabular">S/ {money(receipt.total)}</strong>
        </div>
      </div>}
      <style>{`
        .order-detail { display: flex; flex-direction: column; gap: 10px; }
        .order-detail-table td, .order-detail-table th { padding: 8px 10px; font-size: 12.5px; white-space: nowrap; }
        .order-detail-table th { font-size: 11px; }
        .order-detail-table tr.is-editing td { background: var(--color-warning-soft); }
        .order-detail.is-compact .order-detail-table td, .order-detail.is-compact .order-detail-table th { padding: 7px 7px; font-size: 12px; }
        .order-detail.is-compact .order-detail-table th { font-size: 10.5px; letter-spacing: .02em; }
        .order-detail.is-compact .btn-icon.btn-sm { width: 26px; height: 26px; min-height: 26px; }
        .order-detail-table thead th { position: sticky; top: 0; z-index: 1; }
        .order-detail-totals { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; text-align: right; }
        .order-detail-normal { font-size: 13px; color: var(--text-secondary); }
        .order-detail-normal strong { color: var(--text-primary); }
        .order-detail-pay { display: flex; align-items: baseline; gap: 12px; }
        .order-detail-pay span { font-size: 14px; font-weight: 600; color: var(--text-secondary); }
        .order-detail-pay strong { font-size: 26px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.01em; }
      `}</style>
    </div>
  );
}
