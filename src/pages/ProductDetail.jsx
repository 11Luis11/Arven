import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MessageCircle, ArrowLeft, Shield, AlertTriangle, ChevronLeft, ChevronRight, Package, RefreshCw, CheckCircle, SearchX } from 'lucide-react';
import { DataService } from '../services/dataService';
import SEO from '../components/SEO';
import ProductCard from '../components/ProductCard';
import { toNumber, formatMoney, getDiscountPercent, getVariantStock, toWhatsAppPhone } from '../utils/pricing';

const DESC_LIMIT = 180;
const WA_GREEN = '#25D366';

const PAGE_CSS = `
.pd-thumb { width: 64px; height: 80px; border-radius: 8px; border: 1px solid var(--border-color); background: #fff; padding: 2px; cursor: pointer; overflow: hidden; flex-shrink: 0; transition: border-color .15s ease, box-shadow .15s ease; }
.pd-thumb img { width: 100%; height: 100%; object-fit: cover; border-radius: 6px; display: block; }
.pd-thumb.is-active { border: 2px solid var(--text-primary); }
.pd-main { flex: 1; min-width: 0; border-radius: 14px; background: #F3F4F6; overflow: hidden; cursor: zoom-in; position: relative; height: 580px; }
.pd-main > img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .12s ease-out; will-change: transform; }
.pd-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 40px; height: 40px; border-radius: 999px; border: none; background: rgba(255,255,255,.92); box-shadow: var(--shadow-sm); display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 3; color: var(--text-primary); }
.pd-dots { position: absolute; bottom: 12px; left: 0; right: 0; display: flex; justify-content: center; gap: 2px; z-index: 3; }
.pd-dot { width: 20px; height: 20px; border: none; background: none; padding: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.pd-dot span { width: 6px; height: 6px; border-radius: 999px; background: rgba(17,24,39,.3); transition: width .2s ease, background .2s ease; }
.pd-dot.is-active span { width: 18px; background: var(--text-primary); }
.pd-label { font-size: 13px; font-weight: 600; margin-bottom: 10px; color: var(--text-primary); display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.pd-label small { font-weight: 400; color: var(--text-secondary); font-size: 13px; }
.pd-swatch { width: 40px; height: 40px; border-radius: 999px; cursor: pointer; position: relative; transition: box-shadow .15s ease, transform .15s ease; padding: 0; }
.pd-swatch.is-active { box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--text-primary); }
.pd-swatch:disabled { cursor: not-allowed; opacity: .45; }
.pd-swatch:disabled::after { content: ''; position: absolute; left: 50%; top: 4px; bottom: 4px; width: 2px; background: #6B7280; transform: translateX(-50%) rotate(45deg); border-radius: 2px; }
.pd-size { min-width: 48px; height: 44px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--border-strong); background: #fff; color: var(--text-primary); cursor: pointer; font-size: 14px; font-weight: 500; font-family: inherit; transition: all .15s ease; }
.pd-size:hover:not(:disabled) { border-color: var(--text-primary); }
.pd-size.is-active { background: var(--text-primary); border-color: var(--text-primary); color: #fff; }
.pd-size:disabled { cursor: not-allowed; color: var(--text-muted); background: var(--bg-subtle); border-color: var(--border-color); text-decoration: line-through; }
.pd-wa { width: 100%; min-height: 54px; padding: 14px 20px; border-radius: 12px; border: none; font-size: 16px; font-weight: 700; font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 10px; color: #fff; background: ${WA_GREEN}; cursor: pointer; box-shadow: 0 8px 20px -8px rgba(37,211,102,.7); transition: background .2s ease, transform .15s ease; }
.pd-wa:hover:not(:disabled) { background: #1EBE5D; }
.pd-wa:active:not(:disabled) { transform: translateY(1px); }
.pd-wa:disabled { background: #CBD5E1; box-shadow: none; cursor: not-allowed; }
.pd-sticky { display: none; }
@media (max-width: 768px) {
  .pd-main { border-radius: 12px; }
  .pd-nav { width: 36px; height: 36px; }
  .pd-thumb { width: 56px; height: 68px; }
  .pd-wrapper-mobile-pad { padding-bottom: 96px !important; }
  .pd-sticky {
    display: flex; align-items: center; gap: 12px;
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
    padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
    background: rgba(255,255,255,.96); backdrop-filter: blur(8px);
    border-top: 1px solid var(--border-color); box-shadow: 0 -6px 20px rgba(0,0,0,.06);
  }
  .pd-sticky .pd-wa { min-height: 48px; font-size: 15px; flex: 1; }
}
`;

function buildImageList(product, color) {
  if (color) {
    const colorImgs = color.images?.length > 0 ? color.images : (color.image_url ? [color.image_url] : []);
    if (colorImgs.length > 0) return colorImgs;
  }
  return product.images?.length > 0 ? product.images.filter(Boolean) : [product.image_url].filter(Boolean);
}

/** Primera talla con stock para el color dado (o la primera talla si no hay ninguna). */
function firstAvailableSize(product, color) {
  const sizes = product.sizes || [];
  if (sizes.length === 0) return '';
  return sizes.find(s => getVariantStock(product, color, s) > 0) || sizes[0];
}

function DetailSkeleton() {
  return (
    <div className="product-detail-wrapper" style={{ padding: '32px 24px', maxWidth: '1200px', margin: '0 auto', width: '100%', minHeight: '80vh' }} aria-busy="true" aria-label="Cargando prenda">
      <div className="skeleton" style={{ height: 14, width: 140, marginBottom: 24 }} />
      <div className="product-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '48px' }}>
        <div className="skeleton product-main-image" style={{ height: 580, borderRadius: 14 }} />
        <div className="product-info-col" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="skeleton" style={{ height: 28, width: '75%' }} />
          <div className="skeleton" style={{ height: 14, width: '30%' }} />
          <div className="skeleton" style={{ height: 30, width: '40%', marginTop: 8 }} />
          <div className="skeleton" style={{ height: 40, width: '60%', marginTop: 16 }} />
          <div className="skeleton" style={{ height: 44, width: '80%' }} />
          <div className="skeleton" style={{ height: 54, width: '100%', marginTop: 8, borderRadius: 12 }} />
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="empty-state" style={{ minHeight: '65vh', justifyContent: 'center', padding: '80px 24px' }}>
      <SEO title="Producto no disponible" />
      <span style={{ width: 72, height: 72, borderRadius: 999, background: 'var(--bg-subtle)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        <SearchX size={32} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
      </span>
      <h3 style={{ fontSize: '22px', fontWeight: 600 }}>No encontramos esta prenda</h3>
      <p style={{ fontSize: '15px', maxWidth: 380, lineHeight: 1.6 }}>
        Es posible que ya no esté disponible o que el enlace haya cambiado. Descubre el resto de la colección.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 }}>
        <Link to="/catalog" className="btn-primary btn-lg">Ver catálogo</Link>
        <Link to="/" className="btn-secondary btn-lg">Ir al inicio</Link>
      </div>
    </div>
  );
}

/**
 * Carga del producto. El detalle se renderiza en <ProductView key={id}> para que
 * toda la selección (color, talla, imagen) se reinicie limpiamente al cambiar de producto.
 */
export default function ProductDetail() {
  const { id } = useParams();
  const [data, setData] = useState({ id: null, product: null, config: null, recommended: [] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [prods, cfg] = await Promise.all([DataService.getProducts(), DataService.getConfig()]);
      if (cancelled) return;
      // Productos inactivos no deben ser accesibles desde la tienda pública.
      const found = prods.find(p => p.id === id && p.active) || null;
      let recommended = [];
      if (found) {
        recommended = prods.filter(p => p.active && p.id !== found.id && p.category_id === found.category_id).slice(0, 3);
        if (recommended.length < 3) {
          const used = new Set([found.id, ...recommended.map(p => p.id)]);
          recommended = [...recommended, ...prods.filter(p => p.active && !used.has(p.id)).slice(0, 3 - recommended.length)];
        }
      }
      setData({ id, product: found, config: cfg, recommended });
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => { window.scrollTo(0, 0); }, [id]);

  if (data.id !== id) return <DetailSkeleton />;
  if (!data.product) return <NotFound />;
  return <ProductView key={data.product.id} product={data.product} config={data.config} recommended={data.recommended} />;
}

function ProductView({ product, config, recommended }) {
  const colors = product.colors || [];
  const sizes = product.sizes || [];

  const [colorIdx, setColorIdx] = useState(() => {
    const idx = colors.findIndex(c => (parseInt(c.stock, 10) || 0) > 0);
    return idx >= 0 ? idx : 0;
  });
  const selectedColor = colors[colorIdx] || null;
  const [selectedSize, setSelectedSize] = useState(() => firstAvailableSize(product, colors[colorIdx] || null));
  const [imageIdx, setImageIdx] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);

  const imageContainerRef = useRef(null);
  const zoomImageRef = useRef(null);
  const touchStartX = useRef(null);

  const imageList = buildImageList(product, selectedColor);
  const currentIdx = imageList.length ? imageIdx % imageList.length : 0;
  const activeImage = imageList[currentIdx] || '';

  // --- Precio (por talla si existe configuración específica) ---
  const sizePrices = (product.wholesale_tiers || []).find(t => t.type === 'size_prices')?.data || {};
  const sizeData = sizePrices[selectedSize];
  const sizeOffer = toNumber(sizeData?.offer_price);
  const sizePrice = toNumber(sizeData?.price);
  const productOffer = toNumber(product.offer_price);
  const productPrice = toNumber(product.price) ?? 0;

  const price = sizeOffer ?? sizePrice ?? productOffer ?? productPrice;
  const originalCandidate = (sizeOffer !== null && sizePrice !== null)
    ? sizePrice
    : ((productOffer !== null && sizePrice === null) ? productPrice : null);
  const discount = getDiscountPercent(originalCandidate, price);
  const originalPrice = discount > 0 ? originalCandidate : null;

  const wholesaleTiers = sizeData?.wholesale_tiers || [];
  const simplePromos = (product.wholesale_tiers || []).find(t => t.type === 'simple_promos')?.data || [];

  const combStock = getVariantStock(product, selectedColor, selectedSize);
  const soldOut = combStock <= 0;
  const sizeStock = (size) => getVariantStock(product, selectedColor, size);
  // Sin colores no hay desglose por talla: no se pueden deshabilitar tallas individualmente.
  const canCheckSizeStock = !!selectedColor;

  const selectColor = (idx) => {
    const c = colors[idx];
    setColorIdx(idx);
    setImageIdx(0);
    if (sizes.length > 0 && getVariantStock(product, c, selectedSize) <= 0) {
      setSelectedSize(firstAvailableSize(product, c));
    }
  };

  const buildWhatsAppUrl = (inquiry = false) => {
    const phone = toWhatsAppPhone(config?.footer?.whatsapp);
    const lines = inquiry
      ? [
          'Hola, quisiera consultar la disponibilidad de este polo:',
          `🛍️ *Polo:* ${product.name}`,
          `🎨 *Color:* ${selectedColor ? selectedColor.name : 'No especificado'}`,
          `📏 *Talla:* ${selectedSize || 'Única'}`,
        ]
      : [
          'Hola, me gustaría comprar este polo:',
          `🛍️ *Polo:* ${product.name}`,
          `🎨 *Color:* ${selectedColor ? selectedColor.name : 'No especificado'}`,
          `📏 *Talla:* ${selectedSize || 'Única'}`,
          `💰 *Precio:* ${formatMoney(price)}`,
          '',
          '¿Tienen stock disponible para coordinar la entrega?',
        ];
    if (typeof window !== 'undefined') lines.push('', window.location.href);
    return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`;
  };

  const buyViaWhatsApp = () => {
    if (soldOut) return;
    window.open(buildWhatsAppUrl(false), '_blank', 'noopener,noreferrer');
  };

  // Zoom hover (solo desktop con puntero fino)
  const handleMouseMove = (e) => {
    if (!zoomImageRef.current || !imageContainerRef.current) return;
    if (window.innerWidth <= 768) return;
    const img = zoomImageRef.current;
    const { left, top, width, height } = imageContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    window.requestAnimationFrame(() => {
      img.style.transformOrigin = `${x}% ${y}%`;
      img.style.transform = 'scale(1.8)';
    });
  };

  const handleMouseLeave = () => {
    const img = zoomImageRef.current;
    if (!img) return;
    window.requestAnimationFrame(() => {
      img.style.transform = 'scale(1)';
      img.style.transformOrigin = 'center center';
    });
  };

  const goImg = (delta) => {
    if (imageList.length < 2) return;
    setImageIdx((currentIdx + delta + imageList.length) % imageList.length);
  };
  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) goImg(dx < 0 ? 1 : -1);
    touchStartX.current = null;
  };

  const description = product.description || '';
  const isLongDesc = description.length > DESC_LIMIT;
  const displayDesc = isLongDesc && !descExpanded ? description.slice(0, DESC_LIMIT).trimEnd() + '…' : description;

  return (
    <div
      className="product-detail-wrapper pd-wrapper-mobile-pad"
      style={{ padding: '28px 24px 64px', maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto', width: '100%', minHeight: '80vh' }}
    >
      <SEO title={product.name} description={description.slice(0, 160) || undefined} ogImage={activeImage.startsWith('dbmedia-') ? undefined : activeImage} ogType="product" />
      <style href="product-detail-styles" precedence="default">{PAGE_CSS}</style>

      <Link to="/catalog" className="btn-ghost btn-sm" style={{ marginBottom: '20px', marginLeft: '-8px', paddingLeft: 8 }}>
        <ArrowLeft size={16} /> Volver al catálogo
      </Link>

      <div
        className="product-detail-grid"
        style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '48px', alignItems: 'start', marginBottom: '72px' }}
      >
        {/* GALERÍA */}
        <div className="product-gallery-col" style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'sticky', top: '90px', alignSelf: 'start', minWidth: 0 }}>
          <div className="product-gallery-inner" style={{ display: 'flex', gap: '12px' }}>
            {imageList.length > 1 && (
              <div className="product-thumbnails" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {imageList.map((img, idx) => (
                  <button
                    type="button"
                    key={`${img}-${idx}`}
                    className={`pd-thumb product-thumbnail-btn${idx === currentIdx ? ' is-active' : ''}`}
                    onClick={() => setImageIdx(idx)}
                    aria-label={`Ver imagen ${idx + 1}`}
                    aria-current={idx === currentIdx}
                  >
                    <img src={img} alt="" loading="lazy" decoding="async" />
                  </button>
                ))}
              </div>
            )}

            <div
              ref={imageContainerRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              className="pd-main product-main-image"
            >
              {activeImage && (
                <img ref={zoomImageRef} src={activeImage} alt={product.name} fetchPriority="high" decoding="async" />
              )}
              {soldOut && (
                <span className="badge" style={{ position: 'absolute', top: 12, left: 12, zIndex: 3, background: 'rgba(17,24,39,.88)', color: '#fff' }}>Agotado</span>
              )}
              {!soldOut && discount > 0 && (
                <span className="badge" style={{ position: 'absolute', top: 12, left: 12, zIndex: 3, background: 'var(--color-secondary)', color: '#fff' }}>Oferta -{discount}%</span>
              )}
              {imageList.length > 1 && (
                <>
                  <button type="button" className="pd-nav" style={{ left: 10 }} onClick={() => goImg(-1)} aria-label="Imagen anterior">
                    <ChevronLeft size={18} />
                  </button>
                  <button type="button" className="pd-nav" style={{ right: 10 }} onClick={() => goImg(1)} aria-label="Imagen siguiente">
                    <ChevronRight size={18} />
                  </button>
                  <div className="pd-dots">
                    {imageList.map((_, idx) => (
                      <button type="button" key={idx} className={`pd-dot${idx === currentIdx ? ' is-active' : ''}`} onClick={() => setImageIdx(idx)} aria-label={`Imagen ${idx + 1}`}>
                        <span />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* FICHA */}
        <div className="product-info-col" style={{ display: 'flex', flexDirection: 'column', gap: '22px', minWidth: 0 }}>
          <div>
            <span style={{ fontSize: '12px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Colección Carrillo
            </span>
            <h1 className="product-title" style={{ fontSize: '28px', fontWeight: 600, marginTop: '6px', marginBottom: '6px', lineHeight: 1.2, letterSpacing: '-0.01em' }}>{product.name}</h1>
            {product.sku && <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>SKU: {product.sku}</p>}
          </div>

          {/* Precio */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 12px', fontVariantNumeric: 'tabular-nums' }}>
            <span className="product-price-big" style={{ fontSize: '28px', fontWeight: 700, color: originalPrice ? 'var(--color-secondary)' : 'var(--text-primary)' }}>
              {formatMoney(price)}
            </span>
            {originalPrice && (
              <>
                <span style={{ fontSize: '17px', textDecoration: 'line-through', color: 'var(--text-muted)' }}>{formatMoney(originalPrice)}</span>
                <span className="badge" style={{ background: 'var(--color-secondary)', color: '#fff' }}>-{discount}%</span>
              </>
            )}
          </div>

          {/* Precios mayoristas por talla */}
          {wholesaleTiers.length > 0 && (
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', border: '1px solid #E0E7FF', borderRadius: '10px', overflow: 'hidden' }}>
                {wholesaleTiers.map((tier, idx) => {
                  const nextTier = wholesaleTiers[idx + 1];
                  const rangeLabel = nextTier ? `${tier.min_qty}-${nextTier.min_qty - 1} pzs` : `${tier.min_qty}+ pzs`;
                  return (
                    <div key={idx} style={{
                      flex: '1 1 0', minWidth: '84px', padding: '12px 10px', textAlign: 'center',
                      backgroundColor: idx === 0 ? '#EEF2FF' : idx === 1 ? '#E8EDFF' : '#E0E5FF',
                      borderRight: idx < wholesaleTiers.length - 1 ? '1px solid #D0D5FF' : 'none',
                      display: 'flex', flexDirection: 'column', gap: '3px'
                    }}>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: '#1E1B4B', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(tier.price)}</span>
                      <span style={{ fontSize: '11px', color: '#4F46E5', fontWeight: 500 }}>{rangeLabel}</span>
                    </div>
                  );
                })}
              </div>
              <p style={{ marginTop: '6px', fontSize: '12px', color: '#4F46E5', fontWeight: 600 }}>
                Precios por mayor en talla {selectedSize}
              </p>
            </div>
          )}

          {/* Promociones por volumen */}
          {simplePromos.length > 0 && (
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', background: '#fff' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-subtle)' }}>
                <span style={{ width: 20, height: 20, borderRadius: 999, background: 'var(--text-primary)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>%</span>
                <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Promoción por volumen</span>
              </div>
              {simplePromos.map((promo, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '11px 14px', borderBottom: idx < simplePromos.length - 1 ? '1px solid var(--border-color)' : 'none', fontSize: '14px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Lleva {promo.qty} polos por solo</span>
                  <strong style={{ fontWeight: 700, fontSize: '15px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatMoney(promo.price)}</strong>
                </div>
              ))}
            </div>
          )}

          {/* Colores */}
          {colors.length > 0 && (
            <div>
              <div className="pd-label">
                <span>Color: <small>{selectedColor?.name || ''}</small></span>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', padding: '4px' }} role="radiogroup" aria-label="Color">
                {colors.map((c, idx) => {
                  const colorOut = (parseInt(c.stock, 10) || 0) <= 0;
                  return (
                    <button
                      type="button"
                      key={`${c.hex}-${idx}`}
                      role="radio"
                      aria-checked={idx === colorIdx}
                      aria-label={`${c.name}${colorOut ? ' (agotado)' : ''}`}
                      title={`${c.name}${colorOut ? ' — agotado' : ''}`}
                      disabled={colorOut}
                      onClick={() => selectColor(idx)}
                      className={`pd-swatch${idx === colorIdx ? ' is-active' : ''}`}
                      style={{ backgroundColor: c.hex, border: '1px solid rgba(0,0,0,.15)' }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Tallas */}
          {sizes.length > 0 && (
            <div>
              <div className="pd-label"><span>Talla: <small>{selectedSize}</small></span></div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} role="radiogroup" aria-label="Talla">
                {sizes.map((size) => {
                  const out = canCheckSizeStock && sizeStock(size) <= 0;
                  return (
                    <button
                      type="button"
                      key={size}
                      role="radio"
                      aria-checked={selectedSize === size}
                      aria-label={`Talla ${size}${out ? ' (agotada)' : ''}`}
                      disabled={out}
                      onClick={() => setSelectedSize(size)}
                      className={`pd-size product-size-btn${selectedSize === size ? ' is-active' : ''}`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stock */}
          {soldOut ? (
            <div className="alert alert-danger" style={{ alignItems: 'center' }}>
              <AlertTriangle size={16} />
              <span>Sin stock en esta combinación. Prueba otro color o talla.</span>
            </div>
          ) : combStock <= 5 ? (
            <div className="alert alert-warning" style={{ alignItems: 'center' }}>
              <AlertTriangle size={16} />
              <span>¡Solo quedan {combStock} {combStock === 1 ? 'unidad' : 'unidades'}!</span>
            </div>
          ) : (
            <div style={{ fontSize: '14px', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
              <CheckCircle size={16} /> En stock ({combStock} unidades)
            </div>
          )}

          {/* CTA WhatsApp */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button type="button" className="pd-wa" onClick={buyViaWhatsApp} disabled={soldOut}>
              <MessageCircle size={20} />
              {soldOut ? 'Agotado' : 'Pedir por WhatsApp'}
            </button>
            {soldOut ? (
              <a href={buildWhatsAppUrl(true)} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ width: '100%', minHeight: 46, borderRadius: 12 }}>
                Consultar disponibilidad por WhatsApp
              </a>
            ) : (
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                Te respondemos por WhatsApp para confirmar stock, pago y envío.
              </p>
            )}
          </div>

          {/* Beneficios */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
            {[
              { Icon: Shield, text: 'Cambios garantizados' },
              { Icon: Package, text: 'Envío a todo el país' },
              { Icon: RefreshCw, text: 'Sin costo adicional' },
              { Icon: CheckCircle, text: 'Algodón premium' },
            ].map(({ Icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-subtle)', fontSize: '13px', color: 'var(--text-secondary)', minWidth: 0 }}>
                <Icon size={16} strokeWidth={1.6} style={{ color: 'var(--text-primary)', flexShrink: 0 }} />
                <span>{text}</span>
              </div>
            ))}
          </div>

          {/* Descripción */}
          {description && (
            <div className="product-description-block" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '18px' }}>
              <h2 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-primary)' }}>Descripción</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{displayDesc}</p>
              {isLongDesc && (
                <button
                  type="button"
                  onClick={() => setDescExpanded(v => !v)}
                  style={{ background: 'none', border: 'none', padding: '6px 0', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {descExpanded ? 'Ver menos' : 'Ver más'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recomendados */}
      {recommended.length > 0 && (
        <section style={{ borderTop: '1px solid var(--border-color)', paddingTop: '48px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '24px', textAlign: 'center' }}>También te podría gustar</h2>
          <div className="recommended-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {recommended.map(prod => <ProductCard key={prod.id} product={prod} />)}
          </div>
        </section>
      )}

      {/* Barra fija de compra en móvil */}
      <div className="pd-sticky">
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, minWidth: 0 }}>
          <span style={{ fontSize: '17px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: originalPrice ? 'var(--color-secondary)' : 'var(--text-primary)' }}>{formatMoney(price)}</span>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {[selectedColor?.name, selectedSize && `Talla ${selectedSize}`].filter(Boolean).join(' · ')}
          </span>
        </div>
        <button type="button" className="pd-wa" onClick={buyViaWhatsApp} disabled={soldOut}>
          <MessageCircle size={18} />
          {soldOut ? 'Agotado' : 'Pedir por WhatsApp'}
        </button>
      </div>
    </div>
  );
}
