import { useState, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Search } from 'lucide-react';
import { DataService, subscribeToRealtime } from './services/dataService';
import { applyFavicon } from './utils/favicon';
import Toaster from './components/Toaster';
import BrandLogo from './components/BrandLogo';

// Home cargado de inmediato (es lo primero que ve el público)
import Storefront from './pages/Storefront';
import Footer from './components/Footer';

// Resto de páginas bajo demanda
const Catalog = lazy(() => import('./pages/Catalog'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
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
const CostCalculator = lazy(() => import('./pages/admin/CostCalculator'));
const FinanzasUnified = lazy(() => import('./pages/admin/finanzas/FinanzasUnified'));

function LazyFallback({ label = 'Cargando…' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', color: 'var(--text-secondary)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div className="spinner" />
        <p style={{ fontSize: 14 }}>{label}</p>
      </div>
    </div>
  );
}

const isLoggedIn = () => localStorage.getItem('admin_logged_in') === 'true';

function ProtectedRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/admin" replace />;
}

const formatPrice = (p) => {
  const n = parseFloat(p.offer_price) || parseFloat(p.price) || 0;
  return `S/. ${n.toFixed(2)}`;
};

// Layout público: barra de navegación + footer
function StorefrontLayout() {
  const [config, setConfig] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navSearch, setNavSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const blurTimer = useRef(null);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [cfg, cats, prods] = await Promise.all([
        DataService.getConfig(),
        DataService.getCategories(),
        DataService.getProducts()
      ]);
      if (!alive) return;
      setConfig(cfg);
      setCategories(cats.filter(c => c.active));
      setProducts(prods.filter(p => p.active));
      if (cfg.storeFaviconUrl) applyFavicon(cfg.storeFaviconUrl);
    };
    load();
    const unsubscribe = subscribeToRealtime(load);
    const onConfig = (e) => { if (alive && e.detail) setConfig(e.detail); };
    window.addEventListener('store-config-updated', onConfig);
    return () => { alive = false; unsubscribe(); window.removeEventListener('store-config-updated', onConfig); };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Cerrar menú móvil al cambiar de ruta (ajuste durante el render) y subir al inicio
  const routeKey = location.pathname + location.search;
  const [lastRouteKey, setLastRouteKey] = useState(routeKey);
  if (lastRouteKey !== routeKey) {
    setLastRouteKey(routeKey);
    setMobileMenuOpen(false);
    setShowSuggestions(false);
  }
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [routeKey]);

  // Bloquear scroll del fondo con el menú móvil abierto
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  const searchSuggestions = useMemo(() => {
    const q = navSearch.trim().toLowerCase();
    if (!q) return [];
    return products.filter(p =>
      (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)
    ).slice(0, 6);
  }, [navSearch, products]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const q = navSearch.trim();
    if (!q) return;
    navigate(`/catalog?search=${encodeURIComponent(q)}`);
    setNavSearch('');
    setShowSuggestions(false);
  };

  if (!config) {
    return (
      <div className="storefront-root" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  const currentCategory = new URLSearchParams(location.search).get('category');
  const linkStyle = (active) => ({
    fontSize: 13, fontWeight: active ? 600 : 500, letterSpacing: '0.04em', textTransform: 'uppercase',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)', whiteSpace: 'nowrap',
    padding: '6px 2px', borderBottom: `2px solid ${active ? 'var(--text-primary)' : 'transparent'}`,
    transition: 'color .15s ease, border-color .15s ease',
  });
  const mobileLinks = [
    { id: 'all', name: 'Ver todo', to: '/catalog' },
    ...categories.map(c => ({ id: c.id, name: c.name, to: `/catalog?category=${c.slug}` })),
  ];

  return (
    <div className="storefront-root" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#FAFAF8', overflowX: 'hidden', width: '100%' }}>
      <a href="#contenido" className="sr-only">Saltar al contenido</a>

      <nav className="nav-height" style={{
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'saturate(180%) blur(14px)',
        WebkitBackdropFilter: 'saturate(180%) blur(14px)',
        borderBottom: '1px solid var(--border-color)',
        boxShadow: scrolled ? '0 4px 20px -8px rgba(0,0,0,0.12)' : 'none',
        position: 'sticky', top: 0, zIndex: 500, height: 72,
        display: 'flex', alignItems: 'center', transition: 'box-shadow .2s ease',
      }}>
        <div style={{ maxWidth: 1240, width: '100%', margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link to="/" aria-label={`${config.storeName} — inicio`} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {(config.storeLogoUrl || config.storeLogoDarkUrl) ? (
              <BrandLogo config={config} bg="light" maxHeight={48} maxWidth={200} />
            ) : (
              <span className="nav-logo-text" style={{ fontSize: 19, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {config.storeName}
              </span>
            )}
          </Link>

          <form onSubmit={handleSearchSubmit} role="search" className="nav-search-bar" style={{ flex: 1, maxWidth: 440, position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              type="search"
              className="nav-search-input"
              aria-label="Buscar productos"
              placeholder="¿Qué polo estás buscando hoy?"
              value={navSearch}
              onChange={e => { setNavSearch(e.target.value); setShowSuggestions(true); }}
              onFocus={() => { clearTimeout(blurTimer.current); setShowSuggestions(true); }}
              onBlur={() => { blurTimer.current = setTimeout(() => setShowSuggestions(false), 150); }}
              onKeyDown={e => { if (e.key === 'Escape') setShowSuggestions(false); }}
            />
            {showSuggestions && navSearch.trim() && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, backgroundColor: '#FFF',
                border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
                zIndex: 1000, overflow: 'hidden', animation: 'slideUp .18s ease both',
              }}>
                {searchSuggestions.length === 0 ? (
                  <p style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                    Sin resultados para «{navSearch.trim()}»
                  </p>
                ) : searchSuggestions.map(p => (
                  <Link
                    key={p.id}
                    to={`/product/${p.id}`}
                    className="nav-suggestion"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => { setNavSearch(''); setShowSuggestions(false); }}
                  >
                    <img src={p.image_url} alt="" loading="lazy" style={{ width: 40, height: 48, objectFit: 'cover', borderRadius: 6, background: 'var(--bg-subtle)' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{formatPrice(p)}</span>
                    </div>
                  </Link>
                ))}
                {searchSuggestions.length > 0 && (
                  <button type="submit" onMouseDown={e => e.preventDefault()} style={{ width: '100%', padding: '11px 14px', background: 'var(--bg-subtle)', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                    Ver todos los resultados →
                  </button>
                )}
              </div>
            )}
          </form>

          <div className="desktop-menu" style={{ display: 'flex', gap: 22, alignItems: 'center', marginLeft: 'auto', overflowX: 'auto', scrollbarWidth: 'none' }}>
            <Link to="/catalog" style={linkStyle(location.pathname === '/catalog' && !currentCategory)}>
              Ver todo
            </Link>
            {categories.map(cat => (
              <Link key={cat.id} to={`/catalog?category=${cat.slug}`} style={linkStyle(currentCategory === cat.slug)}>
                {cat.name}
              </Link>
            ))}
          </div>

          <button
            onClick={() => setMobileMenuOpen(o => !o)}
            className="accessible-touch mobile-menu-btn"
            aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={mobileMenuOpen}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', display: 'none', marginLeft: 'auto', borderRadius: 'var(--radius)' }}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="animate-fade" style={{
          position: 'fixed', top: 60, left: 0, right: 0, bottom: 0, backgroundColor: '#fff',
          zIndex: 499, display: 'flex', flexDirection: 'column', overflowY: 'auto',
        }}>
          <div style={{ padding: 16, borderBottom: '1px solid var(--border-color)' }}>
            <form onSubmit={handleSearchSubmit} role="search" style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="search"
                className="nav-search-input"
                aria-label="Buscar productos"
                placeholder="¿Qué polo estás buscando?"
                value={navSearch}
                onChange={e => setNavSearch(e.target.value)}
                style={{ height: 46, fontSize: 16 }}
              />
            </form>
          </div>
          <div style={{ padding: '8px 0' }}>
            {mobileLinks.map(item => (
              <Link key={item.id} to={item.to} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', fontWeight: 500, fontSize: 16, borderBottom: '1px solid var(--bg-subtle)' }}>
                {item.name}<span style={{ color: 'var(--text-muted)' }}>›</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <main id="contenido" style={{ flex: 1 }}>
        <Suspense fallback={<LazyFallback />}>
          <Routes>
            <Route path="/" element={<Storefront />} />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      <Footer config={config} />

      <style>{`
        .nav-search-input {
          width: 100%; height: 42px; padding: 0 14px 0 40px; border-radius: var(--radius-pill);
          border: 1px solid var(--border-color); font-size: 14px; outline: none;
          background-color: var(--bg-subtle); transition: border-color .15s, background-color .15s;
        }
        .nav-search-input:focus { background-color: #fff; border-color: var(--text-primary); }
        .nav-suggestion {
          display: flex; align-items: center; gap: 12px; padding: 10px 14px;
          border-bottom: 1px solid var(--bg-subtle); transition: background-color .12s;
        }
        .nav-suggestion:hover { background-color: var(--bg-hover); }
        .desktop-menu::-webkit-scrollbar { display: none; }
        @media (max-width: 768px) {
          .desktop-menu { display: none !important; }
          .mobile-menu-btn { display: inline-flex !important; }
          .nav-search-bar { display: none !important; }
          .nav-height { height: 60px !important; }
        }
      `}</style>
    </div>
  );
}

function AdminArea() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<LazyFallback label="Cargando panel…" />}>
        <AdminLayout>
          <Suspense fallback={<LazyFallback label="Cargando módulo…" />}>
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
              <Route path="calculator" element={<CostCalculator />} />
              <Route path="declarations" element={<Navigate to="/admin/finanzas/declaraciones" replace />} />
              <Route path="finanzas/*" element={<FinanzasUnified />} />
              <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
            </Routes>
          </Suspense>
        </AdminLayout>
      </Suspense>
    </ProtectedRoute>
  );
}

export default function App() {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(isLoggedIn);

  useEffect(() => {
    const sync = () => setIsAdminLoggedIn(isLoggedIn());
    window.addEventListener('storage', sync);
    window.addEventListener('admin-auth-change', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('admin-auth-change', sync);
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/admin"
          element={
            <Suspense fallback={<LazyFallback />}>
              {isAdminLoggedIn
                ? <Navigate to="/admin/dashboard" replace />
                : <AdminLogin onLogin={() => setIsAdminLoggedIn(true)} />}
            </Suspense>
          }
        />
        <Route path="/admin/*" element={<AdminArea />} />
        <Route path="/*" element={<StorefrontLayout />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}
