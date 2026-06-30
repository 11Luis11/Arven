import { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingBag, Menu, X, Search } from 'lucide-react';
import { DataService, subscribeToRealtime } from './services/dataService';
import { applyFavicon } from './utils/favicon';

// Storefront Pages (cargados inmediatamente — son lo primero que ve el público)
import Storefront from './pages/Storefront';
import Catalog from './pages/Catalog';
import ProductDetail from './pages/ProductDetail';

// Admin Pages (cargados bajo demanda con lazy — solo cuando el admin navega ahí)
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const POS = lazy(() => import('./pages/admin/POS'));
const Products = lazy(() => import('./pages/admin/Products'));
const Inventory = lazy(() => import('./pages/admin/Inventory'));
const Customers = lazy(() => import('./pages/admin/Customers'));
const CashRegister = lazy(() => import('./pages/admin/CashRegister'));
const Reports = lazy(() => import('./pages/admin/Reports'));
const Config = lazy(() => import('./pages/admin/Config'));
const Logs = lazy(() => import('./pages/admin/Logs'));

// Fallback de carga para secciones lazy
function LazyFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-secondary)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid var(--border-color)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ fontSize: '14px' }}>Cargando módulo...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// Componente para proteger rutas administrativas
function ProtectedRoute({ children }) {
  const isLoggedIn = localStorage.getItem('admin_logged_in') === 'true';
  return isLoggedIn ? children : <Navigate to="/admin" replace />;
}

// Layout Público (Navbar y Footer Compartido)
function StorefrontLayout({ onOpenCart }) {
  const [config, setConfig] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
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
    const [cfg, cats, prods] = await Promise.all([
      DataService.getConfig(),
      DataService.getCategories(),
      DataService.getProducts()
    ]);
    setConfig(cfg);
    setCategories(cats.filter(c => c.active));
    setProducts(prods.filter(p => p.active));
    if (cfg.storeFaviconUrl) applyFavicon(cfg.storeFaviconUrl); // asegura que el favicon personalizado se vea en cualquier página/pestaña
  };

  useEffect(() => {
    loadNavData();

    // Suscribirse a cambios en tiempo real
    const unsubscribe = subscribeToRealtime(() => {
      loadNavData();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Cerrar menú móvil al cambiar de ruta
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  if (!config) return null;

  // Filtrar recomendaciones de búsqueda dinámicas
  const searchSuggestions = navSearch.trim()
    ? products.filter(p => 
        p.name.toLowerCase().includes(navSearch.toLowerCase()) || 
        p.sku.toLowerCase().includes(navSearch.toLowerCase())
      ).slice(0, 5)
    : [];

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
              onBlur={() => setTimeout(() => setNavSearch(''), 200)}
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
            />
            <Search size={14} style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-secondary)'
            }} />
            {/* Sugerencias de búsqueda en tiempo real */}
            {searchSuggestions.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: '#FFF',
                border: '1px solid var(--border-color)',
                borderTop: 'none',
                boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column'
              }}>
                {searchSuggestions.map(p => (
                  <Link
                    key={p.id}
                    to={`/product/${p.id}`}
                    onClick={() => setNavSearch('')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      borderBottom: '1px solid #F1F1F1',
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseOver={e => e.currentTarget.style.backgroundColor = '#F8F9FA'}
                    onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <img src={p.image_url} alt="" style={{ width: '36px', height: '44px', objectFit: 'cover', border: '1px solid #F0F0F0' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>S/. {(p.offer_price || p.price).toFixed(2)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </form>

          {/* Menú Desktop — Categorías Dinámicas */}
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }} className="desktop-menu">
            <Link to="/catalog" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              Ver Todo
            </Link>
            {categories.map(cat => (
              <Link
                key={cat.id}
                to={`/catalog?category=${cat.slug}`}
                style={{ fontSize: '12px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', whiteSpace: 'nowrap', transition: 'color 0.15s ease' }}
                onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
              >
                {cat.name}
              </Link>
            ))}
          </div>

          {/* Iconos de Acción */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Hamburguesa Móvil */}

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
          <Link to="/catalog" style={{ fontWeight: 600, fontSize: '14px' }}>Ver Todo</Link>
          {categories.map(cat => (
            <Link key={cat.id} to={`/catalog?category=${cat.slug}`} style={{ fontWeight: 500, fontSize: '14px', color: 'var(--text-secondary)' }}>
              {cat.name}
            </Link>
          ))}

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
          .nav-search-bar {
            display: none !important;
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
            <Suspense fallback={<LazyFallback />}>
              {isAdminLoggedIn 
                ? <Navigate to="/admin/dashboard" replace /> 
                : <AdminLogin onLogin={handleAdminLogin} />
              }
            </Suspense>
          } 
        />
        
        <Route 
          path="/admin/*" 
          element={
            <ProtectedRoute>
              <Suspense fallback={<LazyFallback />}>
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
              </Suspense>
            </ProtectedRoute>
          } 
        />

        {/* Rutas Públicas (Storefront) */}
        <Route path="/*" element={<StorefrontLayout onOpenCart={() => {}} />} />

      </Routes>
    </BrowserRouter>
  );
}
