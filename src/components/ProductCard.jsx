import { Link } from 'react-router-dom';
import { getCardPricing, formatMoney } from '../utils/pricing';

// Estilos de la tarjeta. React 19 deduplica <style href precedence> aunque se
// renderice muchas veces, así que se inyecta una sola vez en <head>.
const CARD_CSS = `
.pc-card {
  display: flex; flex-direction: column; min-width: 0;
  background: var(--bg-card); border: 1px solid var(--border-color);
  border-radius: 12px; overflow: hidden; position: relative;
  transition: box-shadow .25s ease, transform .25s ease, border-color .25s ease;
}
.pc-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); border-color: var(--border-strong); }
.pc-media {
  display: block; position: relative; aspect-ratio: 3 / 4; overflow: hidden;
  background: #F3F4F6;
}
.pc-media img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .6s cubic-bezier(.16,1,.3,1); }
.pc-card:hover .pc-media img { transform: scale(1.04); }
.pc-card.is-soldout .pc-media img { filter: grayscale(.6); opacity: .7; }
.pc-badges { position: absolute; top: 10px; left: 10px; display: flex; flex-direction: column; gap: 6px; z-index: 2; align-items: flex-start; }
.pc-badge {
  font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase;
  padding: 4px 9px; border-radius: 999px; line-height: 1.2;
}
.pc-badge-offer { background: var(--color-secondary); color: #fff; }
.pc-badge-soldout { background: rgba(17,24,39,.88); color: #fff; }
.pc-body { padding: 14px; display: flex; flex-direction: column; gap: 10px; flex: 1; }
.pc-name {
  font-size: 14px; font-weight: 500; line-height: 1.35; color: var(--text-primary);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  min-height: 2.7em;
}
.pc-prices { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 8px; font-variant-numeric: tabular-nums; }
.pc-price { font-size: 16px; font-weight: 600; color: var(--text-primary); }
.pc-price.is-offer { color: var(--color-secondary); }
.pc-old { font-size: 13px; color: var(--text-muted); text-decoration: line-through; }
.pc-cta { margin-top: auto; width: 100%; min-height: 38px; border-radius: 8px !important; text-decoration: none; }
@media (max-width: 768px) {
  .pc-body { padding: 10px; gap: 8px; }
  .pc-name { font-size: 13px; }
  .pc-price { font-size: 15px; }
  .pc-old { font-size: 12px; }
}
`;

/**
 * Tarjeta de producto de la tienda pública.
 * @param {object} props.product
 * @param {boolean} [props.priority] - Carga la imagen sin lazy (tarjetas sobre el pliegue).
 * @param {string} [props.ctaLabel]
 */
export default function ProductCard({ product, priority = false, ctaLabel = 'Ver producto' }) {
  const { price, original, discount } = getCardPricing(product);
  const soldOut = (parseInt(product.stock, 10) || 0) <= 0;
  const href = `/product/${product.id}`;

  return (
    <article className={`pc-card${soldOut ? ' is-soldout' : ''}`}>
      <style href="pc-card-styles" precedence="default">{CARD_CSS}</style>

      <Link to={href} className="pc-media" aria-label={product.name}>
        <div className="pc-badges">
          {soldOut && <span className="pc-badge pc-badge-soldout">Agotado</span>}
          {!soldOut && discount > 0 && <span className="pc-badge pc-badge-offer">Oferta -{discount}%</span>}
        </div>
        {product.image_url && (
          <img
            src={product.image_url}
            alt={product.name}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            width="600"
            height="800"
          />
        )}
      </Link>

      <div className="pc-body">
        <Link to={href} className="pc-name" style={{ color: 'inherit' }}>{product.name}</Link>
        <div className="pc-prices">
          <span className={`pc-price${original ? ' is-offer' : ''}`}>{formatMoney(price)}</span>
          {original && <span className="pc-old">{formatMoney(original)}</span>}
        </div>
        <Link
          to={href}
          className={`${soldOut ? 'btn-secondary' : 'btn-primary'} btn-sm pc-cta`}
        >
          {soldOut ? 'Ver detalles' : ctaLabel}
        </Link>
      </div>
    </article>
  );
}

/** Esqueleto de carga con las mismas proporciones que ProductCard. */
export function ProductCardSkeleton() {
  return (
    <div className="pc-card" aria-hidden="true">
      <style href="pc-card-styles" precedence="default">{CARD_CSS}</style>
      <div className="skeleton" style={{ aspectRatio: '3 / 4', borderRadius: 0 }} />
      <div className="pc-body">
        <div className="skeleton" style={{ height: 14, width: '80%' }} />
        <div className="skeleton" style={{ height: 14, width: '45%' }} />
        <div className="skeleton" style={{ height: 32, width: '100%', marginTop: 4 }} />
      </div>
    </div>
  );
}
