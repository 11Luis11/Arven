import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MessageSquare, ArrowLeft, Shield, AlertTriangle, ChevronLeft, ChevronRight, Package, RefreshCw } from 'lucide-react';
import { DataService } from '../services/dataService';
import SEO from '../components/SEO';

export default function ProductDetail({ onOpenCart }) {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [config, setConfig] = useState(null);
  const [recommended, setRecommended] = useState([]);
  const [activeImage, setActiveImage] = useState('');
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [selectedSize, setSelectedSize] = useState('M');
  const [selectedColor, setSelectedColor] = useState(null);
  const [loading, setLoading] = useState(true);

  const imageContainerRef = useRef(null);
  const zoomImageRef = useRef(null);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      const prods = await DataService.getProducts();
      const found = prods.find(p => p.id === id);

      if (found) {
        setProduct(found);
        const imgList = found.images && found.images.length > 0 ? found.images : [found.image_url];
        setActiveImage(imgList[0]);
        setActiveImageIdx(0);

        if (found.colors && found.colors.length > 0) {
          setSelectedColor(found.colors[0]);
          if (found.colors[0].image_url) setActiveImage(found.colors[0].image_url);
        } else {
          setSelectedColor(null);
        }

        if (found.sizes && found.sizes.length > 0) {
          setSelectedSize(found.sizes[0]);
        } else {
          setSelectedSize('M');
        }

        const similar = prods
          .filter(p => p.category_id === found.category_id && p.id !== found.id && p.active)
          .slice(0, 3);
        setRecommended(similar);
      }
      const cfg = await DataService.getConfig();
      setConfig(cfg);
      setLoading(false);
    };
    fetchProduct();
  }, [id]);

  const getSelectedCombinationStock = () => {
    if (!product) return 0;
    if (selectedColor) {
      if (product.sizes && product.sizes.length > 0) {
        if (selectedColor.sizes_stock) return selectedColor.sizes_stock[selectedSize] || 0;
        return 0;
      }
      return selectedColor.stock || 0;
    }
    return product.stock || 0;
  };

  const buyViaWhatsApp = () => {
    if (!product) return;
    const phone = config?.footer?.whatsapp || '';
    const cleanPhone = phone.replace(/\D/g, '');
    const activePrice = product.offer_price || product.price;
    const message = `Hola, me gustaría comprar este polo:\n🛍️ *Polo:* ${product.name}\n🎨 *Color:* ${selectedColor ? selectedColor.name : 'No especificado'}\n📏 *Talla:* ${selectedSize}\n💰 *Precio:* S/. ${activePrice.toFixed(2)}\n\n¿Tienen stock disponible para coordinar la entrega?`;
    const url = `https://wa.me/${cleanPhone || '51987654321'}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Zoom hover (solo desktop)
  const handleMouseMove = (e) => {
    if (!zoomImageRef.current || !imageContainerRef.current) return;
    if (window.innerWidth <= 768) return;
    const container = imageContainerRef.current;
    const img = zoomImageRef.current;
    const { left, top, width, height } = container.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    window.requestAnimationFrame(() => {
      img.style.transformOrigin = `${x}% ${y}%`;
      img.style.transform = 'scale(1.8)';
    });
  };

  const handleMouseLeave = () => {
    if (zoomImageRef.current) {
      window.requestAnimationFrame(() => {
        zoomImageRef.current.style.transform = 'scale(1)';
        zoomImageRef.current.style.transformOrigin = 'center center';
      });
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 24px', minHeight: '60vh' }}>
        <div style={{ width: '32px', height: '32px', border: '2px solid var(--border-color)', borderTopColor: 'var(--text-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Cargando prenda...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 24px', minHeight: '60vh' }}>
        <h2 style={{ marginBottom: '16px' }}>Producto no encontrado</h2>
        <Link to="/catalog" className="btn-primary" style={{ borderRadius: '0px' }}>
          Volver al catálogo
        </Link>
      </div>
    );
  }

  const sizePrices = (product.wholesale_tiers || []).find(t => t.type === 'size_prices')?.data || {};
  const sizeData = sizePrices[selectedSize];

  const price = (sizeData?.offer_price && sizeData.offer_price !== '')
    ? parseFloat(sizeData.offer_price)
    : ((sizeData?.price && sizeData.price !== '')
      ? parseFloat(sizeData.price)
      : (product.offer_price || product.price));

  const originalPrice = (sizeData?.offer_price && sizeData.offer_price !== '' && sizeData?.price && sizeData.price !== '')
    ? parseFloat(sizeData.price)
    : ((product.offer_price && (!sizeData?.price || sizeData.price === '')) ? product.price : null);

  const imageList = product.images && product.images.length > 0 ? product.images : [product.image_url];

  // Navegación mobile de imágenes
  const goNextImg = () => {
    const next = (activeImageIdx + 1) % imageList.length;
    setActiveImageIdx(next);
    setActiveImage(imageList[next]);
  };
  const goPrevImg = () => {
    const prev = (activeImageIdx - 1 + imageList.length) % imageList.length;
    setActiveImageIdx(prev);
    setActiveImage(imageList[prev]);
  };

  return (
    <div
      className="product-detail-wrapper"
      style={{ padding: '32px 24px', maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto', width: '100%', minHeight: '80vh' }}
    >
      <SEO title={product.name} description={product.description} ogImage={activeImage} />

      <Link
        to="/catalog"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px',
          color: 'var(--text-secondary)',
          marginBottom: '24px'
        }}
      >
        <ArrowLeft size={15} /> Volver al catálogo
      </Link>

      {/* Grid principal */}
      <div
        className="product-detail-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: '48px',
          alignItems: 'start',
          marginBottom: '80px'
        }}
      >
        {/* COLUMNA IZQUIERDA: Galería */}
        <div
          className="product-gallery-col"
          style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'sticky', top: '90px', alignSelf: 'start' }}
        >
          <div className="product-gallery-inner" style={{ display: 'flex', gap: '14px' }}>
            {/* Miniaturas verticales */}
            <div className="product-thumbnails" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {imageList.map((img, idx) => (
                <button
                  key={idx}
                  className="product-thumbnail-btn"
                  onClick={() => { setActiveImage(img); setActiveImageIdx(idx); }}
                  style={{
                    width: '58px',
                    height: '72px',
                    border: activeImage === img ? '2px solid var(--text-primary)' : '1px solid var(--border-color)',
                    backgroundColor: '#FFF',
                    padding: '2px',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    flexShrink: 0,
                    transition: 'border-color 0.15s ease'
                  }}
                >
                  <img src={img} alt={`Vista ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>

            {/* Imagen principal con zoom y navegación mobile */}
            <div
              ref={imageContainerRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="product-main-image"
              style={{
                flex: 1,
                border: '1px solid var(--border-color)',
                backgroundColor: '#FAFAFA',
                overflow: 'hidden',
                cursor: 'zoom-in',
                position: 'relative',
                height: '540px'
              }}
            >
              <img
                ref={zoomImageRef}
                src={activeImage}
                alt={product.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  transition: 'transform 0.12s ease-out',
                  willChange: 'transform'
                }}
              />
              {/* Flechas solo si hay múltiples imágenes */}
              {imageList.length > 1 && (
                <>
                  <button
                    onClick={goPrevImg}
                    style={{
                      position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)',
                      background: 'rgba(255,255,255,0.85)', border: 'none', width: '32px', height: '32px',
                      borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', zIndex: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                    }}
                    aria-label="Imagen anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={goNextImg}
                    style={{
                      position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                      background: 'rgba(255,255,255,0.85)', border: 'none', width: '32px', height: '32px',
                      borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', zIndex: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                    }}
                    aria-label="Imagen siguiente"
                  >
                    <ChevronRight size={16} />
                  </button>
                  {/* Indicadores puntitos */}
                  <div style={{ position: 'absolute', bottom: '10px', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '6px', zIndex: 3 }}>
                    {imageList.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setActiveImage(imageList[idx]); setActiveImageIdx(idx); }}
                        style={{
                          width: '6px', height: '6px', borderRadius: '50%', border: 'none', padding: 0,
                          backgroundColor: activeImageIdx === idx ? 'var(--text-primary)' : 'rgba(0,0,0,0.25)',
                          cursor: 'pointer', transition: 'background 0.15s ease'
                        }}
                        aria-label={`Imagen ${idx + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Descripción debajo de la galería */}
          <div className="product-description-block" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '18px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-primary)' }}>Descripción</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, fontWeight: 300, whiteSpace: 'pre-wrap' }}>
              {product.description}
            </p>
          </div>
        </div>

        {/* COLUMNA DERECHA: Ficha del producto */}
        <div className="product-info-col" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <span style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Colección Carrillo
            </span>
            <h1 className="product-title" style={{ fontSize: '26px', fontWeight: 500, marginTop: '6px', marginBottom: '8px', lineHeight: 1.2 }}>{product.name}</h1>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>SKU: {product.sku}</p>
          </div>

          {/* Precio */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <span className="product-price-big" style={{ fontSize: '24px', fontWeight: 700 }}>
              S/. {price.toFixed(2)}
            </span>
            {originalPrice && (
              <span style={{ fontSize: '15px', textDecoration: 'line-through', color: 'var(--text-secondary)' }}>
                S/. {originalPrice.toFixed(2)}
              </span>
            )}
            {originalPrice && (
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#FFF', backgroundColor: 'var(--color-secondary)', padding: '2px 8px' }}>
                -{Math.round(((originalPrice - price) / originalPrice) * 100)}%
              </span>
            )}
          </div>

          {/* Tabla precios mayorista por talla */}
          {(() => {
            const selectedSizeData = sizePrices[selectedSize];
            const tiers = selectedSizeData?.wholesale_tiers || [];
            if (tiers.length === 0) return null;
            return (
              <div>
                <div style={{ display: 'flex', gap: '0px', flexWrap: 'wrap', border: '1px solid #E0E7FF', borderRadius: '4px', overflow: 'hidden' }}>
                  {tiers.map((tier, idx) => {
                    const nextTier = tiers[idx + 1];
                    const rangeLabel = nextTier ? `${tier.min_qty}-${nextTier.min_qty - 1} Pzs` : `${tier.min_qty}+ Pzs`;
                    return (
                      <div key={idx} style={{
                        flex: '1 1 0', minWidth: '80px', padding: '12px 10px', textAlign: 'center',
                        backgroundColor: idx === 0 ? '#EEF2FF' : idx === 1 ? '#E8EDFF' : '#E0E5FF',
                        borderRight: idx < tiers.length - 1 ? '1px solid #D0D5FF' : 'none',
                        display: 'flex', flexDirection: 'column', gap: '3px'
                      }}>
                        <span style={{ fontSize: '16px', fontWeight: 700, color: '#1E1B4B', letterSpacing: '-0.02em' }}>
                          S/. {parseFloat(tier.price).toFixed(2)}
                        </span>
                        <span style={{ fontSize: '10px', color: '#6366F1', fontWeight: 500 }}>{rangeLabel}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '6px', fontSize: '11px', color: '#6366F1', fontWeight: 600 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '15px', height: '15px', backgroundColor: '#6366F1', color: '#FFF', borderRadius: '50%', fontSize: '9px', fontWeight: 700 }}>%</span>
                  PRECIOS AL POR MAYOR EN TALLA {selectedSize}
                </div>
              </div>
            );
          })()}

          {/* Promos simples */}
          {(() => {
            const simplePromos = (product.wholesale_tiers || []).find(t => t.type === 'simple_promos')?.data || [];
            if (simplePromos.length === 0) return null;
            return (
              <div style={{ padding: '14px 16px', backgroundColor: '#FFF0F3', border: '1px solid #FFCCD5', color: '#C9184A', fontWeight: 600, fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#FF4D6D', fontWeight: 700 }}>🔥 Promoción Especial</span>
                {simplePromos.map((promo, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Lleva {promo.qty} polos por solo:</span>
                    <strong>S/. {parseFloat(promo.price).toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Colores */}
          {product.colors && product.colors.length > 0 && (
            <div>
              <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Color: <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{selectedColor ? selectedColor.name : ''}</span>
              </h3>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {product.colors.map((c) => {
                  const isSelected = selectedColor?.hex?.toLowerCase() === c.hex?.toLowerCase();
                  return (
                    <button
                      key={c.hex}
                      onClick={() => { setSelectedColor(c); if (c.image_url) setActiveImage(c.image_url); }}
                      title={c.name}
                      style={{
                        width: '36px', height: '36px', borderRadius: '50%', backgroundColor: c.hex,
                        border: isSelected ? '2px solid var(--text-primary)' : '1px solid var(--border-color)',
                        boxShadow: isSelected ? '0 0 0 2px #FFF, 0 0 0 4px var(--text-primary)' : 'none',
                        cursor: 'pointer', transition: 'all 0.15s ease'
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Tallas */}
          {product.sizes && product.sizes.length > 0 && (
            <div>
              <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Talla</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className="product-size-btn"
                    style={{
                      width: '44px', height: '44px',
                      border: selectedSize === size ? '2px solid var(--text-primary)' : '1px solid var(--border-color)',
                      background: selectedSize === size ? 'var(--text-primary)' : '#FFF',
                      color: selectedSize === size ? '#FFF' : 'var(--text-primary)',
                      cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stock indicator */}
          {(() => {
            const combStock = getSelectedCombinationStock();
            if (combStock <= 5 && combStock > 0) {
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#FFFBEB', border: '1px solid #FEF3C7', padding: '10px 14px', fontSize: '13px', color: '#B45309' }}>
                  <AlertTriangle size={15} />
                  <span>¡Solo quedan {combStock} unidades!</span>
                </div>
              );
            } else if (combStock === 0) {
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#FFF5F5', border: '1px solid #FED7D7', padding: '10px 14px', fontSize: '13px', color: '#C53030' }}>
                  <AlertTriangle size={15} />
                  <span>Sin stock en esta combinación.</span>
                </div>
              );
            } else {
              return (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Stock: <strong style={{ color: 'var(--text-primary)' }}>{combStock} unidades</strong>
                </div>
              );
            }
          })()}

          {/* Botón principal WhatsApp */}
          <button
            onClick={buyViaWhatsApp}
            disabled={getSelectedCombinationStock() === 0}
            style={{
              width: '100%', padding: '15px',
              fontSize: '14px', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              backgroundColor: getSelectedCombinationStock() === 0 ? '#CBD5E1' : '#25D366',
              border: 'none', color: '#FFF', cursor: getSelectedCombinationStock() === 0 ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s ease, transform 0.15s ease',
              letterSpacing: '0.03em'
            }}
            onMouseOver={e => { if (getSelectedCombinationStock() > 0) e.currentTarget.style.backgroundColor = '#1ebe5d'; }}
            onMouseOut={e => { if (getSelectedCombinationStock() > 0) e.currentTarget.style.backgroundColor = '#25D366'; }}
          >
            <MessageSquare size={18} />
            {getSelectedCombinationStock() === 0 ? 'AGOTADO' : 'PEDIR POR WHATSAPP'}
          </button>

          {/* Beneficios iconos minimalistas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[
              { icon: <Shield size={15} strokeWidth={1.5} />, text: 'Cambios garantizados' },
              { icon: <Package size={15} strokeWidth={1.5} />, text: 'Envío a todo el país' },
              { icon: <RefreshCw size={15} strokeWidth={1.5} />, text: 'Sin costo adicional' },
              { icon: <Shield size={15} strokeWidth={1.5} />, text: 'Algodón premium' },
            ].map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', border: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--text-primary)', flexShrink: 0 }}>{b.icon}</span>
                {b.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recomendados */}
      {recommended.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '48px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 500, marginBottom: '28px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            También te podría gustar
          </h2>
          <div
            className="recommended-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}
          >
            {recommended.map(prod => (
              <div key={prod.id} className="hover-subtle" style={{ border: '1px solid var(--border-color)', backgroundColor: '#FFF', display: 'flex', flexDirection: 'column' }}>
                <Link
                  to={`/product/${prod.id}`}
                  className="recommended-img"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '340px', overflow: 'hidden', backgroundColor: '#F8F8F8' }}
                >
                  <img
                    src={prod.image_url}
                    alt={prod.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.6s ease' }}
                    onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                  />
                </Link>
                <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '13px', fontWeight: 500, marginBottom: '5px', lineHeight: 1.3 }}>{prod.name}</h3>
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>S/. {(prod.offer_price || prod.price).toFixed(2)}</span>
                  </div>
                  <Link
                    to={`/product/${prod.id}`}
                    className="btn-primary"
                    style={{ width: '100%', fontSize: '12px', padding: '9px', marginTop: '10px', borderRadius: '0px', textAlign: 'center', display: 'block', textDecoration: 'none', color: '#FFF' }}
                  >
                    Ver Detalle
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
