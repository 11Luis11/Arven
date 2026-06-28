import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingBag, Menu, X, Search } from 'lucide-react';
import { DataService, subscribeToRealtime } from './services/dataService';
import { applyFavicon } from './utils/favicon';

// Storefront Pages
import Storefront from './pages/Storefront';
import Catalog from './pages/Catalog';
import ProductDetail from './pages/ProductDetail';
import CartDrawer from './components/CartDrawer';

// Admin Pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './components/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import POS from './pages/admin/POS';
import Products from './pages/admin/Products';
import Inventory from './pages/admin/Inventory';
import Customers from './pages/admin/Customers';
import CashRegister from './pages/admin/CashRegister';
import Reports from './pages/admin/Reports';
import Config from './pages/admin/Config';
import Logs from './pages/admin/Logs';

// Componente para proteger rutas administrativas
function ProtectedRoute({ children }) {
  const isLoggedIn = localStorage.getItem('admin_logged_in') === 'true';
  return isLoggedIn ? children : <Navigate to="/admin" replace />;
}

// Layout Público (Navbar y Footer Compartido)
function StorefrontLayout({ onOpenCart }) {
  const [config, setConfig] = useState(null);
  const [cartCount, setCartCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navSearch, setNavSearch] = useState('');
  
  const location = useLocation();
  const navigate = useNavigate();

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (navSearch.trim()) {
      navigate(`/catalog?search=${encodeURIComponent(navSearch.trim())}`);
      setNavSearch('');
    }
  };

  const loadNavData = async () => {
    const cfg = await DataService.getConfig();
    setConfig(cfg);
    if (cfg.storeFaviconUrl) applyFavicon(cfg.storeFaviconUrl); // asegura que el favicon personalizado se vea en cualquier página/pestaña

    try {
      const cart = localStorage.getItem('carrillo_cart');
      if (cart) {
        const items = JSON.parse(cart);
        setCartCount(items.reduce((sum, item) => sum + item.quantity, 0));
      } else {
        setCartCount(0);
      }
    } catch (e) {
      setCartCount(0);
    }
  };

  useEffect(() => {
    loadNavData();

    // Suscribirse a cambios en tiempo real
    const unsubscribe = subscribeToRealtime(() => {
      loadNavData();
    });

    const handleCartUpdate = () => {
      loadNavData();
    };
    window.addEventListener('cart_updated', handleCartUpdate);

    return () => {
      unsubscribe();
      window.removeEventListener('cart_updated', handleCartUpdate);
    };
  }, []);

  // Cerrar menú móvil al cambiar de ruta
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  if (!config) return null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
      {/* NAVBAR */}
      <nav style={{
        backgroundColor: 'rgba(248, 247, 244, 0.8)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--border-color)',
        position: 'sticky',
        top: 0,
        zIndex: 500,
        height: '70px',
        display: 'flex',
        alignItems: 'center'
      }}>
        <div style={{
          maxWidth: '1200px',
          width: '100%',
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center' }}>
            {config.storeLogoUrl ? (
              <img
                src={config.storeLogoUrl}
                alt={config.storeName}
                style={{ maxHeight: '52px', maxWidth: '220px', objectFit: 'contain' }}
              />
            ) : (
              <span style={{
                fontSize: '18px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-primary)'
              }}>
                {config.storeName}
              </span>
            )}
          </Link>

          {/* Buscador Estilo Falabella (Centrado y Amplio) */}
          <form onSubmit={handleSearchSubmit} style={{
            flex: '1',
            maxWidth: '420px',
            margin: '0 24px',
            position: 'relative'
          }} className="nav-search-bar">
            <input 
              type="text" 
              placeholder="¿Qué polo estás buscando hoy?" 
              value={navSearch}
              onChange={e => setNavSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: '0px',
                border: '1px solid var(--border-color)',
                fontSize: '13px',
                outline: 'none',
                backgroundColor: '#FFF',
                letterSpacing: '0.02em',
                transition: 'border-color 0.2s ease'
              }}
              onFocus={e => e.target.style.borderColor = 'var(--text-primary)'}
              onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
            />
            <Search size={14} style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-secondary)'
            }} />
          </form>

          {/* Menú Desktop */}
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }} className="desktop-menu">
            <Link to="/catalog" style={{ fontSize: '13px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Catálogo
            </Link>
            <Link to="/catalog?category=polos-oversize" style={{ fontSize: '13px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Oversize
            </Link>
            <Link to="/catalog?category=polos-basicos" style={{ fontSize: '13px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Básicos
            </Link>

          </div>

          {/* Iconos de Acción */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              onClick={onOpenCart}
              className="accessible-touch"
              aria-label="Abrir carrito de compras"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--text-primary)'
              }}
            >
              <ShoppingBag size={20} strokeWidth={1.5} />
              {cartCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  backgroundColor: 'var(--color-primary)',
                  color: '#FFFFFF',
                  fontSize: '9px',
                  fontWeight: 700,
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {cartCount}
                </span>
              )}
            </button>

            {/* Hamburguesa Móvil */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="accessible-touch mobile-menu-btn"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                display: 'none' // Manejado por CSS responsivo o inline
              }}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Menú Móvil Expandido */}
      {mobileMenuOpen && (
        <div style={{
          position: 'fixed',
          top: '70px',
          left: 0,
          right: 0,
          backgroundColor: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-color)',
          zIndex: 499,
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: '0 10px 15px rgba(0,0,0,0.05)'
        }}>
          <Link to="/catalog">Catálogo Completo</Link>
          <Link to="/catalog?category=polos-oversize">Polos Oversize</Link>
          <Link to="/catalog?category=polos-basicos">Polos Básicos</Link>

        </div>
      )}

      {/* Rutas Contenido */}
      <div style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Storefront onOpenCart={onOpenCart} />} />
          <Route path="/catalog" element={<Catalog onOpenCart={onOpenCart} />} />
          <Route path="/product/:id" element={<ProductDetail onOpenCart={onOpenCart} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {/* Inyección de CSS responsivo simple en línea */}
      <style>{`
        @media (max-width: 768px) {
          .desktop-menu {
            display: none !important;
          }
          .mobile-menu-btn {
            display: inline-flex !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function App() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  useEffect(() => {
    const checkLogin = () => {
      setIsAdminLoggedIn(localStorage.getItem('admin_logged_in') === 'true');
    };
    checkLogin();
    window.addEventListener('storage', checkLogin);
    return () => window.removeEventListener('storage', checkLogin);
  }, []);

  const handleAdminLogin = () => {
    setIsAdminLoggedIn(true);
  };

  return (
    <BrowserRouter>
      <Routes>
        
        {/* Rutas del Panel Administrativo (POS, Inventario, Caja, etc.) */}
        <Route 
          path="/admin" 
          element={
            isAdminLoggedIn 
              ? <Navigate to="/admin/dashboard" replace /> 
              : <AdminLogin onLogin={handleAdminLogin} />
          } 
        />
        
        <Route 
          path="/admin/*" 
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Routes>
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="pos" element={<POS />} />
                  <Route path="products" element={<Products />} />
                  <Route path="inventory" element={<Inventory />} />
                  <Route path="clients" element={<Customers />} />
                  <Route path="cash" element={<CashRegister />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="logs" element={<Logs />} />
                  <Route path="config" element={<Config />} />
                  <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
                </Routes>
              </AdminLayout>
            </ProtectedRoute>
          } 
        />

        {/* Rutas Públicas (Storefront) */}
        <Route path="/*" element={<StorefrontLayout onOpenCart={() => setIsCartOpen(true)} />} />

      </Routes>

      {/* Lateral Cart Drawer */}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </BrowserRouter>
  );
}
