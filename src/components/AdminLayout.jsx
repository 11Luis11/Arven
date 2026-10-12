import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingBag, Package, ClipboardList, History,
  Users, Wallet, TrendingUp, Settings, LogOut, Menu, X, Calculator,
  Landmark, ExternalLink
} from 'lucide-react';
import { DataService, subscribeToRealtime } from '../services/dataService';
import { applyFavicon } from '../utils/favicon';
import BrandLogo from './BrandLogo';

const ROLE_LABELS = { admin: 'Administrador', employee: 'Colaborador', viewer: 'Solo lectura' };

const NAV_SECTIONS = [
  {
    title: 'Operación',
    items: [
      { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard, roles: ['admin', 'viewer'] },
      { name: 'Punto de venta', path: '/admin/pos', icon: ShoppingBag, roles: ['admin', 'employee'] },
      { name: 'Caja', path: '/admin/cash', icon: Wallet, roles: ['admin', 'employee'] },
      { name: 'Clientes', path: '/admin/clients', icon: Users, roles: ['admin', 'employee', 'viewer'] },
    ],
  },
  {
    title: 'Catálogo',
    items: [
      { name: 'Productos', path: '/admin/products', icon: Package, roles: ['admin', 'viewer'] },
      { name: 'Inventario', path: '/admin/inventory', icon: ClipboardList, roles: ['admin', 'employee', 'viewer'] },
      { name: 'Costos de fabricación', path: '/admin/calculator', icon: Calculator, roles: ['admin'] },
    ],
  },
  {
    title: 'Análisis',
    items: [
      { name: 'Reportes', path: '/admin/reports', icon: TrendingUp, roles: ['admin', 'viewer'] },
      { name: 'Finanzas y tributación', path: '/admin/finanzas/dashboard', basePath: '/admin/finanzas', icon: Landmark, roles: ['admin', 'viewer'] },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { name: 'Log de acciones', path: '/admin/logs', icon: History, roles: ['admin'] },
      { name: 'Configuración', path: '/admin/config', icon: Settings, roles: ['admin'] },
    ],
  },
];

const ALL_ITEMS = NAV_SECTIONS.flatMap(s => s.items);

function readCurrentUser() {
  try {
    const raw = localStorage.getItem('admin_user');
    if (raw) return JSON.parse(raw);
  } catch { /* JSON corrupto: se usa el valor por defecto */ }
  return { name: 'Usuario', role: 'viewer' };
}

const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || 'A';

export default function AdminLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [config, setConfig] = useState(null);
  const [cashStatus, setCashStatus] = useState('closed');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser] = useState(readCurrentUser);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [cfg, register] = await Promise.all([DataService.getConfig(), DataService.getCashRegister()]);
      if (!alive) return;
      setConfig(cfg);
      setCashStatus(register.status);
      if (cfg.storeFaviconUrl) applyFavicon(cfg.storeFaviconUrl);
    };
    load();
    const unsubscribe = subscribeToRealtime(load);
    const onConfig = (e) => { if (alive && e.detail) setConfig(e.detail); };
    window.addEventListener('store-config-updated', onConfig);
    return () => { alive = false; unsubscribe(); window.removeEventListener('store-config-updated', onConfig); };
  }, []);

  // Cerrar cajón móvil al cambiar de ruta (ajuste durante el render, sin efecto extra)
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setMobileMenuOpen(false);
  }

  // Redirigir si el rol no tiene acceso a la ruta actual
  useEffect(() => {
    const item = ALL_ITEMS.find(i => (i.basePath ? location.pathname.startsWith(i.basePath) : i.path === location.pathname));
    if (item && !item.roles.includes(currentUser.role)) {
      navigate(currentUser.role === 'employee' ? '/admin/pos' : '/admin/dashboard', { replace: true });
    }
  }, [location.pathname, currentUser.role, navigate]);

  const sections = useMemo(() => NAV_SECTIONS
    .map(s => ({ ...s, items: s.items.filter(i => i.roles.includes(currentUser.role)) }))
    .filter(s => s.items.length > 0), [currentUser.role]);

  // Limpia el estado local y vuelve al login (sin volver a llamar a Supabase)
  const loggingOutRef = useRef(false);
  const finishLogout = useCallback(() => {
    localStorage.removeItem('admin_logged_in');
    localStorage.removeItem('admin_user');
    // Avisar a App para que actualice su estado (evita el bucle de redirecciones)
    window.dispatchEvent(new Event('admin-auth-change'));
    navigate('/admin', { replace: true });
  }, [navigate]);

  // Cierra la sesión UNA sola vez. Supabase emite "SIGNED_OUT" en cada signOut
  // (incluso sin sesión): antes el listener volvía a cerrar sesión y entraba en bucle.
  const handleLogout = useCallback(async () => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    try { await DataService.signOut(); } catch { /* sin conexión: igual se cierra localmente */ }
    finishLogout();
  }, [finishLogout]);

  // La sesión real la valida Supabase: si expiró, se cerró en otro lado o el
  // usuario fue desactivado, se sale del panel.
  useEffect(() => {
    let alive = true;
    DataService.getSessionProfile().then(profile => {
      if (!alive) return;
      if (!profile) { handleLogout(); return; }
      localStorage.setItem('admin_user', JSON.stringify({ id: profile.id, name: profile.name, email: profile.email, role: profile.role }));
    }).catch(() => { /* sin conexión: se mantiene la sesión local */ });
    const unsubscribe = DataService.onAuthChange(event => {
      // Sesión cerrada desde otra pestaña o expirada: solo limpiar, sin volver a llamar a signOut
      if (event === 'SIGNED_OUT' && !loggingOutRef.current) {
        loggingOutRef.current = true;
        finishLogout();
      }
    });
    return () => { alive = false; unsubscribe(); };
  }, [handleLogout, finishLogout]);

  const isItemActive = (item) => (item.basePath ? location.pathname.startsWith(item.basePath) : location.pathname === item.path);
  const pageTitle = ALL_ITEMS.find(isItemActive)?.name || 'Panel administrativo';

  if (!config) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  const cashOpen = cashStatus === 'open';

  return (
    <div className="admin-root" style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {mobileMenuOpen && <div className="admin-backdrop" onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />}

      <aside className={`admin-sidebar ${mobileMenuOpen ? 'open' : ''}`} aria-label="Navegación principal">
        <div className="admin-brand">
          <Link to="/admin/dashboard" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, minWidth: 0, width: '100%' }}>
            {(config.storeLogoUrl || config.storeLogoDarkUrl) ? (
              <BrandLogo config={config} bg="dark" maxHeight={84} maxWidth={208} />
            ) : (
              <>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--color-primary)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                  {initials(config.storeName)}
                </span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {config.storeName}
                </span>
              </>
            )}
          </Link>
          <button onClick={() => setMobileMenuOpen(false)} className="sidebar-close-btn" aria-label="Cerrar menú">
            <X size={20} />
          </button>
        </div>

        <nav style={{ flex: 1, padding: '4px 12px 16px', overflowY: 'auto' }}>
          {sections.map(section => (
            <div key={section.title} style={{ marginTop: 14 }}>
              <p className="admin-nav-section">{section.title}</p>
              {section.items.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink key={item.path} to={item.path} className={`admin-nav-link ${isItemActive(item) ? 'active' : ''}`}>
                    <Icon size={18} strokeWidth={1.75} />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Link to="/" target="_blank" rel="noopener noreferrer" className="admin-nav-link">
            <ExternalLink size={18} strokeWidth={1.75} />
            <span>Ver tienda</span>
          </Link>
          <button onClick={handleLogout} className="admin-nav-link admin-logout">
            <LogOut size={18} strokeWidth={1.75} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <div className="admin-main-container">
        <header className="admin-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button onClick={() => setMobileMenuOpen(true)} className="admin-hamburger-btn btn-ghost btn-icon" aria-label="Abrir menú">
              <Menu size={22} />
            </button>
            <h2 style={{ fontSize: 17, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pageTitle}</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link
              to="/admin/cash"
              className={`badge ${cashOpen ? 'badge-success' : 'badge-danger'}`}
              title={cashOpen ? 'La caja está abierta' : 'La caja está cerrada'}
              style={{ padding: '4px 10px' }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor' }} />
              Caja {cashOpen ? 'abierta' : 'cerrada'}
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="admin-avatar">{initials(currentUser.name)}</span>
              <div className="operator-label" style={{ lineHeight: 1.25 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{currentUser.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{ROLE_LABELS[currentUser.role] || currentUser.role}</div>
              </div>
            </div>
          </div>
        </header>

        <main className="admin-content-area">
          {children}
        </main>
      </div>

      <style>{`
        .admin-sidebar {
          width: 256px; background: #0F172A; color: #CBD5E1;
          display: flex; flex-direction: column;
          position: fixed; top: 0; left: 0; bottom: 0; height: 100vh; z-index: 1000;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .admin-nav-section {
          font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
          color: #64748B; padding: 6px 12px;
        }
        .admin-nav-link {
          display: flex; align-items: center; gap: 12px; width: 100%;
          padding: 9px 12px; margin: 1px 0; border-radius: 8px; border: none; background: transparent;
          color: #CBD5E1; font-size: 14px; font-weight: 500; cursor: pointer; text-align: left;
          transition: background-color .15s ease, color .15s ease;
        }
        .admin-nav-link:hover { background: rgba(255,255,255,0.06); color: #fff; }
        .admin-nav-link.active { background: var(--color-primary); color: #fff; box-shadow: 0 4px 12px -4px rgba(79,70,229,.6); }
        .admin-logout { color: #FCA5A5; }
        .admin-logout:hover { background: rgba(239,68,68,0.12); color: #FECACA; }
        .admin-brand { position: relative; display: flex; align-items: center; justify-content: center; padding: 26px 24px 22px; border-bottom: 1px solid rgba(255,255,255,0.08); min-height: 120px; }
        .sidebar-close-btn { display: none; position: absolute; top: 10px; right: 10px; background: none; border: none; color: #fff; cursor: pointer; padding: 6px; border-radius: 8px; }
        .admin-main-container { flex: 1; display: flex; flex-direction: column; min-width: 0; margin-left: 256px; }
        .admin-topbar {
          height: 64px; background: rgba(255,255,255,0.9); backdrop-filter: blur(10px);
          border-bottom: 1px solid var(--border-color);
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 0 28px; position: sticky; top: 0; z-index: 90;
        }
        .admin-avatar {
          width: 36px; height: 36px; border-radius: 50%; background: var(--color-primary-soft); color: var(--color-primary);
          display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0;
        }
        .admin-content-area { padding: 28px; flex: 1; width: 100%; max-width: 1600px; margin: 0 auto; }
        .admin-hamburger-btn { display: none !important; }
        .admin-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.45); z-index: 999; animation: fadeIn .2s ease both; }

        @media (max-width: 991px) {
          .admin-sidebar { transform: translateX(-100%); }
          .admin-sidebar.open { transform: translateX(0); box-shadow: 10px 0 30px rgba(0,0,0,0.25); }
          .admin-main-container { margin-left: 0; }
          .admin-hamburger-btn { display: inline-flex !important; }
          .sidebar-close-btn { display: inline-flex; }
          .admin-topbar { padding: 0 16px; }
          .admin-content-area { padding: 16px; }
        }
        @media (max-width: 600px) {
          .operator-label { display: none; }
        }
        @media print {
          .admin-sidebar, .admin-topbar, .admin-backdrop { display: none !important; }
          .admin-main-container { margin-left: 0 !important; }
          .admin-content-area { padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}
