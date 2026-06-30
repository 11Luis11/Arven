import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShoppingBag, ArrowLeft, Shield, AlertTriangle, Star } from 'lucide-react';
import { DataService } from '../services/dataService';
import SEO from '../components/SEO';

export default function ProductDetail({ onOpenCart }) {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [recommended, setRecommended] = useState([]);
  const [activeImage, setActiveImage] = useState('');
  const [selectedSize, setSelectedSize] = useState('M');
  const [selectedColor, setSelectedColor] = useState(null);
  const [loading, setLoading] = useState(true);

  // Zoom reference variables
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

        if (found.colors && found.colors.length > 0) {
          setSelectedColor(found.colors[0]);
        } else {
          setSelectedColor(null);
        }

        if (found.sizes && found.sizes.length > 0) {
          setSelectedSize(found.sizes[0]);
        } else {
          setSelectedSize('M');
        }

        // Filtrar recomendados de la misma categoría, excluyendo el actual
        const similar = prods
          .filter(p => p.category_id === found.category_id && p.id !== found.id && p.active)
          .slice(0, 4);
        setRecommended(similar);
      }
      setLoading(false);
    };
    fetchProduct();
  }, [id]);

  const getSelectedCombinationStock = () => {
    if (!product) return 0;
    if (selectedColor) {
      if (selectedColor.sizes_stock && selectedColor.sizes_stock[selectedSize] !== undefined) {
        return selectedColor.sizes_stock[selectedSize];
      }
      return selectedColor.stock || 0;
    }
    return product.stock || 0;
  };

  const addToCart = (prod = product) => {
    if (!prod) return;
    try {
      const cartRaw = localStorage.getItem('carrillo_cart');
      const cart = cartRaw ? JSON.parse(cartRaw) : [];
      
      const targetSize = prod.id === product.id ? selectedSize : (prod.sizes?.[0] || 'M');
      const targetColor = prod.id === product.id ? selectedColor : (prod.colors?.[0] || null);

      const cartItemUniqueId = `${prod.id}-${targetSize}-${targetColor ? targetColor.hex : 'no-color'}`;
      
      const index = cart.findIndex(item => item.cartItemId === cartItemUniqueId);
      
      const cartItem = { 
        ...prod,
        cartItemId: cartItemUniqueId,
        selectedSize: targetSize,
        selectedColor: targetColor,
        name: `${prod.name} ${targetColor ? targetColor.name.toUpperCase() : ''} (${targetSize})`
      };

      if (index !== -1) {
        cart[index].quantity += 1;
      } else {
        cart.push({ ...cartItem, quantity: 1 });
      }
      
      localStorage.setItem('carrillo_cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cart_updated'));
      onOpenCart();
    } catch (e) {
      console.error(e);
    }
  };

  // Lupa / Hover Zoom
  const handleMouseMove = (e) => {
    if (!zoomImageRef.current || !imageContainerRef.current) return;
    
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
        <p style={{ color: 'var(--text-secondary)' }}>Cargando polo premium...</p>
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

  const price = product.offer_price || product.price;
  const imageList = product.images && product.images.length > 0 ? product.images : [product.image_url];

  return (
    <div style={{ padding: '40px 24px', maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto', width: '100%', minHeight: '80vh' }}>
      <SEO title={product.name} description={product.description} ogImage={activeImage} />

      <Link 
        to="/catalog" 
        style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '8px', 
          fontSize: '13px', 
          color: 'var(--text-secondary)',
          marginBottom: '32px'
        }}
      >
        <ArrowLeft size={16} /> Volver al catálogo
      </Link>

      {/* Grid Principal Detalle */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        gap: '48px',
        alignItems: 'start',
        marginBottom: '80px'
      }}>
        
        {/* GALERÍA DE IMÁGENES + ZOOM HOVER */}
        <div style={{ display: 'flex', gap: '16px' }}>
          {/* Miniaturas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {imageList.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setActiveImage(img)}
                style={{
                  width: '60px',
                  height: '80px',
                  border: activeImage === img ? '1.5px solid var(--text-primary)' : '1px solid var(--border-color)',
                  backgroundColor: '#FFF',
                  padding: '2px',
                  cursor: 'pointer',
                  overflow: 'hidden'
                }}
              >
                <img src={img} alt="Miniatura" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </button>
            ))}
          </div>

          {/* Imagen Principal con Zoom */}
          <div 
            ref={imageContainerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
              flex: 1,
              border: '1px solid var(--border-color)',
              backgroundColor: '#FFF',
              overflow: 'hidden',
              cursor: 'zoom-in',
              position: 'relative',
              height: '520px'
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
                transition: 'transform 0.1s ease-out',
                willChange: 'transform'
              }}
            />
          </div>
        </div>

        {/* Ficha e Información */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <span style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Colección Carrillo
            </span>
            <h1 style={{ fontSize: '28px', fontWeight: 500, marginTop: '8px', marginBottom: '12px' }}>{product.name}</h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>SKU: {product.sku}</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px', fontWeight: 600 }}>
              S/. {price.toFixed(2)}
            </span>
            {product.offer_price && (
              <span style={{ fontSize: '16px', textDecoration: 'line-through', color: 'var(--text-secondary)' }}>
                S/. {product.price.toFixed(2)}
              </span>
            )}
          </div>
          
          {(() => {
            const tiers = product.wholesale_tiers && product.wholesale_tiers.length > 0
              ? [...product.wholesale_tiers].sort((a, b) => a.min_qty - b.min_qty)
              : product.wholesale_price
                ? [{ min_qty: product.wholesale_min_qty || 6, price: product.wholesale_price }]
                : [];
            if (tiers.length === 0) return null;

            return (
              <div style={{ marginTop: '4px' }}>
                <div style={{
                  display: 'flex',
                  gap: '0px',
                  flexWrap: 'wrap',
                  border: '1px solid #E0E7FF',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  {tiers.map((tier, idx) => {
                    const nextTier = tiers[idx + 1];
                    const rangeLabel = nextTier
                      ? `${tier.min_qty}-${nextTier.min_qty - 1} Piezas`
                      : `${tier.min_qty}+ Piezas`;

                    return (
                      <div
                        key={idx}
                        style={{
                          flex: '1 1 0',
                          minWidth: '100px',
                          padding: '14px 12px',
                          textAlign: 'center',
                          backgroundColor: idx === 0 ? '#EEF2FF' : idx === 1 ? '#E8EDFF' : '#E0E5FF',
                          borderRight: idx < tiers.length - 1 ? '1px solid #D0D5FF' : 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}
                      >
                        <span style={{
                          fontSize: '18px',
                          fontWeight: 700,
                          color: '#1E1B4B',
                          letterSpacing: '-0.02em'
                        }}>
                          S/. {parseFloat(tier.price).toFixed(2)}
                        </span>
                        <span style={{
                          fontSize: '11px',
                          color: '#6366F1',
                          fontWeight: 500,
                          letterSpacing: '0.02em'
                        }}>
                          {rangeLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '8px',
                  fontSize: '11px',
                  color: '#6366F1',
                  fontWeight: 600,
                  letterSpacing: '0.04em'
                }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', backgroundColor: '#6366F1', color: '#FFF', borderRadius: '50%', fontSize: '10px', fontWeight: 700 }}>%</span>
                  PRECIOS AL POR MAYOR DISPONIBLES
                </div>
              </div>
            );
          })()}

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Descripción</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, fontWeight: 300 }}>
              {product.description}
            </p>
          </div>

          {/* Colores */}
          {product.colors && product.colors.length > 0 && (
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '12px' }}>Seleccionar Color: <span style={{ fontWeight: 'normal', color: 'var(--text-secondary)' }}>{selectedColor ? selectedColor.name : ''}</span></h3>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {product.colors.map((c) => {
                  const isSelected = selectedColor?.hex === c.hex;
                  return (
                    <button
                      key={c.hex}
                      onClick={() => setSelectedColor(c)}
                      title={c.name}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: c.hex,
                        border: isSelected ? '2px solid var(--text-primary)' : '1px solid var(--border-color)',
                        boxShadow: isSelected ? '0 0 0 2px #FFF, 0 0 0 4px var(--text-primary)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
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
              <h3 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '12px' }}>Seleccionar Talla</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    style={{
                      width: '44px',
                      height: '44px',
                      border: '1px solid var(--border-color)',
                      background: selectedSize === size ? 'var(--text-primary)' : '#FFF',
                      color: selectedSize === size ? '#FFF' : 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 500,
                      transition: 'var(--transition-fast)'
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(() => {
            const combStock = getSelectedCombinationStock();
            if (combStock <= 5 && combStock > 0) {
              return (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FEF3C7',
                  padding: '12px 16px',
                  fontSize: '13px',
                  color: '#B45309',
                  marginTop: '8px'
                }}>
                  <AlertTriangle size={16} />
                  <span>¡Solo quedan {combStock} unidades de esta combinación color/talla!</span>
                </div>
              );
            } else if (combStock === 0) {
              return (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#FFF5F5',
                  border: '1px solid #FED7D7',
                  padding: '12px 16px',
                  fontSize: '13px',
                  color: '#C53030',
                  marginTop: '8px'
                }}>
                  <AlertTriangle size={16} />
                  <span>Esta combinación color/talla no tiene stock disponible en este momento.</span>
                </div>
              );
            } else {
              return (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Stock disponible: <strong>{combStock}</strong> unidades.
                </div>
              );
            }
          })()}

          <div style={{ marginTop: '12px' }}>
            <button
              onClick={() => addToCart()}
              disabled={getSelectedCombinationStock() === 0}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '15px',
                borderRadius: '0px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}
            >
              <ShoppingBag size={18} />
              {getSelectedCombinationStock() === 0 ? 'AGOTADO' : 'AÑADIR AL CARRITO'}
            </button>
          </div>

          <div style={{
            padding: '16px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            fontSize: '13px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={16} style={{ color: 'var(--color-primary)' }} />
              <span>Garantía de cambios rápidos.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={16} style={{ color: 'var(--color-primary)' }} />
              <span>Algodón premium de gramaje pesado.</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN RECOMENDADOS */}
      {recommended.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '60px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 500, marginBottom: '32px', textAlign: 'center' }}>
            También te podría gustar
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '24px'
          }}>
            {recommended.map(prod => (
              <div key={prod.id} className="hover-subtle" style={{ border: '1px solid var(--border-color)', backgroundColor: '#FFF', display: 'flex', flexDirection: 'column' }}>
                <Link to={`/product/${prod.id}`} style={{ display: 'block', height: '280px', overflow: 'hidden' }}>
                  <img src={prod.image_url} alt={prod.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </Link>
                <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>{prod.name}</h3>
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>S/. {(prod.offer_price || prod.price).toFixed(2)}</span>
                  </div>
                  <button 
                    onClick={() => addToCart(prod)}
                    className="btn-primary"
                    disabled={prod.stock === 0}
                    style={{ width: '100%', fontSize: '12px', padding: '8px', marginTop: '12px', borderRadius: '0px' }}
                  >
                    Agregar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
