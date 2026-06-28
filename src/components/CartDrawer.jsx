import { useState, useEffect } from 'react';
import { X, Minus, Plus, Trash2, ShoppingBag, CreditCard } from 'lucide-react';
import { DataService } from '../services/dataService';

export default function CartDrawer({ isOpen, onClose }) {
  const [cart, setCart] = useState([]);
  const [coupon, setCoupon] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountError, setDiscountError] = useState('');
  const [discountSuccess, setDiscountSuccess] = useState('');
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  // Cargar carrito desde localStorage
  const loadCart = () => {
    try {
      const items = localStorage.getItem('carrillo_cart');
      if (items) setCart(JSON.parse(items));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadCart();
    
    // Escuchar eventos globales de actualización de carrito
    const handleCartUpdate = () => {
      loadCart();
    };
    window.addEventListener('cart_updated', handleCartUpdate);
    return () => window.removeEventListener('cart_updated', handleCartUpdate);
  }, []);

  // Guardar carrito
  const saveCart = (newCart) => {
    setCart(newCart);
    localStorage.setItem('carrillo_cart', JSON.stringify(newCart));
    window.dispatchEvent(new Event('cart_updated'));
  };

  const updateQuantity = (productId, change) => {
    const newCart = cart.map(item => {
      if (item.id === productId) {
        const newQty = item.quantity + change;
        return { ...item, quantity: Math.max(1, newQty) };
      }
      return item;
    });
    saveCart(newCart);
  };

  const removeItem = (productId) => {
    const newCart = cart.filter(item => item.id !== productId);
    saveCart(newCart);
  };

  // Validar cupón
  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    setDiscountError('');
    setDiscountSuccess('');
    
    const config = await DataService.getConfig();
    const found = config.cupons?.find(c => c.code.toUpperCase() === coupon.trim().toUpperCase() && c.active);
    
    if (found) {
      setDiscountPercent(found.discountPercent);
      setDiscountSuccess(`¡Cupón aplicado! Descuento del ${found.discountPercent}%`);
    } else {
      setDiscountPercent(0);
      setDiscountError('Cupón inválido o expirado.');
    }
  };

  // Calcular totales
  const subtotal = cart.reduce((sum, item) => {
    const isWholesale = item.wholesale_price && item.quantity >= (item.wholesale_min_qty || 6);
    const price = isWholesale ? item.wholesale_price : (item.offer_price || item.price);
    return sum + (price * item.quantity);
  }, 0);
  
  const discountAmount = (subtotal * discountPercent) / 100;
  const total = subtotal - discountAmount;

  // Checkout Simulado
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    try {
      // Registrar la compra en la base de datos como venta online
      await DataService.createSale({
        customer_name: 'Cliente Online',
        total_amount: total,
        discount_amount: discountAmount,
        payment_method: 'Tarjeta de Crédito',
        type: 'online',
        items: cart.map(item => ({
          product_id: item.id,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.offer_price || item.price
        }))
      });

      // Limpiar carrito
      saveCart([]);
      setDiscountPercent(0);
      setCoupon('');
      setCheckoutSuccess(true);
      
      // Lanzar confeti si está disponible
      window.dispatchEvent(new CustomEvent('sale_completed_animation'));

      setTimeout(() => {
        setCheckoutSuccess(false);
        onClose();
      }, 3000);
    } catch (error) {
      console.error('Error durante el checkout:', error);
    }
  };

  // Controlar escape key para cerrar drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="animate-fade" 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div 
        role="dialog"
        aria-modal="true"
        aria-label="Carrito de compras"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '480px',
          height: '100%',
          backgroundColor: 'var(--bg-card)',
          boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      >
        {/* Encabezado */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShoppingBag size={20} strokeWidth={1.5} />
            <h2 style={{ fontSize: '18px', fontWeight: 500 }}>Tu Carrito ({cart.reduce((s, i) => s + i.quantity, 0)})</h2>
          </div>
          <button 
            className="accessible-touch"
            onClick={onClose}
            aria-label="Cerrar carrito"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-primary)',
            }}
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Contenido principal */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {checkoutSuccess ? (
            <div style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: '16px'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(26, 26, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary)'
              }}>
                <ShoppingBag size={32} strokeWidth={1.5} />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 500 }}>¡Compra Confirmada!</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '280px' }}>
                Tu pedido ha sido procesado de forma simulada. ¡Gracias por confiar en Carrillo Store!
              </p>
            </div>
          ) : cart.length === 0 ? (
            <div style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              color: 'var(--text-secondary)',
              gap: '16px'
            }}>
              <ShoppingBag size={48} strokeWidth={1} style={{ opacity: 0.5 }} />
              <p style={{ fontSize: '15px' }}>Tu carrito está vacío.</p>
              <button 
                onClick={onClose}
                className="btn-primary"
                style={{ fontSize: '14px', padding: '10px 20px' }}
              >
                Volver a la tienda
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {cart.map((item) => {
                const price = item.offer_price || item.price;
                return (
                  <div 
                    key={item.id}
                    style={{
                      display: 'flex',
                      gap: '16px',
                      paddingBottom: '20px',
                      borderBottom: '1px solid var(--border-color)'
                    }}
                  >
                    <img 
                      src={item.image_url} 
                      alt={item.name}
                      style={{
                        width: '80px',
                        height: '100px',
                        objectFit: 'cover',
                        backgroundColor: '#eee'
                      }}
                    />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>{item.name}</h4>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>SKU: {item.sku}</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 600 }}>
                              S/. {((item.wholesale_price && item.quantity >= (item.wholesale_min_qty || 6)) ? item.wholesale_price : (item.offer_price || item.price)).toFixed(2)}
                            </span>
                            {(item.offer_price || (item.wholesale_price && item.quantity >= (item.wholesale_min_qty || 6))) && (
                              <span style={{ fontSize: '12px', textDecoration: 'line-through', color: 'var(--text-secondary)' }}>
                                S/. {item.price.toFixed(2)}
                              </span>
                            )}
                          </div>
                          {item.wholesale_price && item.quantity >= (item.wholesale_min_qty || 6) && (
                            <span style={{ fontSize: '10px', color: 'var(--color-primary)', fontWeight: 600 }}>
                              ★ Tarifa por mayor aplicada
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          border: '1px solid var(--border-color)',
                          borderRadius: '0px'
                        }}>
                          <button 
                            className="accessible-touch"
                            onClick={() => updateQuantity(item.id, -1)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
                            aria-label="Disminuir cantidad"
                          >
                            <Minus size={12} />
                          </button>
                          <span style={{ fontSize: '13px', width: '24px', textAlign: 'center' }}>{item.quantity}</span>
                          <button 
                            className="accessible-touch"
                            onClick={() => updateQuantity(item.id, 1)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
                            aria-label="Aumentar cantidad"
                          >
                            <Plus size={12} />
                          </button>
                        </div>

                        <button 
                          onClick={() => removeItem(item.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '12px'
                          }}
                          aria-label="Eliminar producto"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Panel inferior de totales */}
        {cart.length > 0 && !checkoutSuccess && (
          <div style={{
            padding: '24px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: '#FAFAFA'
          }}>
            {/* Cupones */}
            <form onSubmit={handleApplyCoupon} style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <input 
                type="text"
                placeholder="Código de descuento"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: '1px solid var(--border-color)',
                  outline: 'none',
                  fontSize: '13px',
                  backgroundColor: '#fff'
                }}
              />
              <button 
                type="submit"
                style={{
                  padding: '8px 16px',
                  background: 'var(--text-primary)',
                  color: '#fff',
                  border: 'none',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                Aplicar
              </button>
            </form>
            {discountError && <p style={{ color: 'var(--color-secondary)', fontSize: '12px', marginTop: '-12px', marginBottom: '12px' }}>{discountError}</p>}
            {discountSuccess && <p style={{ color: 'green', fontSize: '12px', marginTop: '-12px', marginBottom: '12px' }}>{discountSuccess}</p>}

            {/* Resumen */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-secondary)' }}>
                <span>Subtotal</span>
                <span>S/. {subtotal.toFixed(2)}</span>
              </div>
              {discountPercent > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'green' }}>
                  <span>Descuento ({discountPercent}%)</span>
                  <span>- S/. {discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontSize: '16px', 
                fontWeight: 600,
                color: 'var(--text-primary)',
                paddingTop: '8px',
                borderTop: '1px solid var(--border-color)'
              }}>
                <span>Total</span>
                <span>S/. {total.toFixed(2)}</span>
              </div>
            </div>

            {/* Botón de pago */}
            <button 
              onClick={handleCheckout}
              className="btn-primary"
              style={{ width: '100%', display: 'flex', gap: '8px', padding: '14px' }}
            >
              <CreditCard size={16} />
              Proceder al Pago
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
