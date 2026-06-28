import { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, ShoppingBag, Package, ClipboardList, 
  Users, Wallet, TrendingUp, Settings, LogOut, Circle, Menu, X 
} from 'lucide-react';
import { DataService, subscribeToRealtime } from '../services/dataService';
import { applyFavicon } from '../utils/favicon';

export default function AdminLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [config, setConfig] = useState(null);
  const [cashStatus, setCashStatus] = useState('closed');
  
  // Responsive sidebar toggles
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const loadData = async () => {
    const cfg = await DataService.getConfig();
    setConfig(cfg);
    if (cfg.storeFaviconUrl) applyFavicon(cfg.storeFaviconUrl); // asegura que el favicon personalizado se vea en cualquier página/pestaña del panel

    const register = await DataService.getCashRegister();
    setCashStatus(register.status);
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToRealtime(() => {
      loadData();
    });
    return () => unsubscribe();
  }, []);

  // Cerrar cajón de navegación móvil al cambiar de ruta
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('admin_logged_in');
    navigate('/admin');
  };

  const loggedInUserRaw = localStorage.getItem('admin_user');
  const currentUser = loggedInUserRaw ? JSON.parse(loggedInUserRaw) : { name: 'Admin Principal', role: 'admin' };

  const allNavItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard, roles: ['admin', 'viewer'] },
    { name: 'POS (Ventas)', path: '/admin/pos', icon: ShoppingBag, roles: ['admin', 'employee'] },
    { name: 'Productos', path: '/admin/products', icon: Package, roles: ['admin', 'viewer'] },
    { name: 'Inventario', path: '/admin/inventory', icon: ClipboardList, roles: ['admin', 'employee', 'viewer'] },
    { name: 'Clientes', path: '/admin/clients', icon: Users, roles: ['admin', 'employee', 'viewer'] },
    { name: 'Caja', path: '/admin/cash', icon: Wallet, roles: ['admin', 'employee'] },
    { name: 'Reportes', path: '/admin/reports', icon: TrendingUp, roles: ['admin', 'viewer'] },
    { name: 'Log de Acciones', path: '/admin/logs', icon: ClipboardList, roles: ['admin'] },
    { name: 'Configuración', path: '/admin/config', icon: Settings, roles: ['admin'] },
  ];

  const navItems = allNavItems.filter(item => item.roles.includes(currentUser.role));

  useEffect(() => {
    const currentPath = location.pathname;
    const isRestricted = allNavItems.some(item => item.path === currentPath && !item.roles.includes(currentUser.role));
    if (isRestricted) {
      if (currentUser.role === 'employee') {
        navigate('/admin/pos');
      } else if (currentUser.role === 'viewer') {
        navigate('/admin/dashboard');
      }
    }
  }, [location.pathname, currentUser.role]);

  if (!config) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-primary)', flexDirection: 'row' }}>
      
      {/* SIDEBAR (Escritorio y Cajón Móvil) */}
      <aside 
        className={`admin-sidebar ${mobileMenuOpen ? 'open' : ''}`}
        style={{
          width: '260px',
          backgroundColor: '#111111',
          color: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid #222',
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          height: '100vh',
          zIndex: 1000,
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Encabezado Sidebar */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #222',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#FFF' }}>
            {config.storeLogoUrl ? (
              <img
                src={config.storeLogoUrl}
                alt={config.storeName}
                style={{
                  maxHeight: '44px',
                  maxWidth: '190px',
                  objectFit: 'contain',
                  // Contorno blanco alrededor del dibujo (no invierte el color del logo):
                  // se logra apilando varias "drop-shadow" sin difuminado en distintas
                  // direcciones, lo que dibuja un borde blanco de ~1.5px alrededor de
                  // cualquier zona opaca (las letras negras). Así se distinguen sobre
                  // el fondo negro del sidebar sin perder el color original del logo.
                  filter: [
                    'drop-shadow(1.5px 0 0 #fff)',
                    'drop-shadow(-1.5px 0 0 #fff)',
                    'drop-shadow(0 1.5px 0 #fff)',
                    'drop-shadow(0 -1.5px 0 #fff)',
                    'drop-shadow(1.5px 1.5px 0 #fff)',
                    'drop-shadow(-1.5px -1.5px 0 #fff)',
                    'drop-shadow(1.5px -1.5px 0 #fff)',
                    'drop-shadow(-1.5px 1.5px 0 #fff)',
                  ].join(' '),
                }}
                onError={e => { e.target.style.filter = 'none'; }}
              />
            ) : (
              <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {config.storeName}
              </span>
            )}
          </Link>
          {/* Botón cerrar móvil */}
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="sidebar-close-btn"
            style={{
              background: 'none',
              border: 'none',
              color: '#FFF',
              cursor: 'pointer',
              display: 'none'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Links */}
        <nav style={{ flex: 1, padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <NavLink 
                key={item.path}
                to={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  color: isActive ? '#FFFFFF' : '#999999',
                  backgroundColor: isActive ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                  fontSize: '14px',
                  fontWeight: 500,
                  transition: 'var(--transition-fast)',
                }}
              >
                <Icon size={16} strokeWidth={1.5} />
                {item.name}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer Sidebar */}
        <div style={{
          padding: '20px 24px',
          borderTop: '1px solid #222',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <Circle size={8} fill={cashStatus === 'open' ? 'green' : 'red'} stroke="none" />
            <span style={{ color: '#888' }}>
              Caja: {cashStatus === 'open' ? 'Abierta' : 'Cerrada'}
            </span>
          </div>

          <button 
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              background: 'none',
              border: 'none',
              color: '#FF4D6D',
              fontSize: '13px',
              cursor: 'pointer',
              padding: '6px 0',
              textAlign: 'left'
            }}
          >
            <LogOut size={16} strokeWidth={1.5} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Contenedor del contenido principal */}
      <div className="admin-main-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, marginLeft: '260px' }}>
        {/* Header Superior */}
        <header style={{
          height: '70px',
          backgroundColor: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          position: 'sticky',
          top: 0,
          zIndex: 90
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Botón menú hamburguesa (móvil) */}
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="admin-hamburger-btn"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Menu size={24} />
            </button>
            <h2 style={{ fontSize: '16px', fontWeight: 500 }}>
              {navItems.find(item => item.path === location.pathname)?.name || 'Panel Administrativo'}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="operator-label" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Operador:</span>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>
              {currentUser.name} ({currentUser.role === 'admin' ? 'Admin' : currentUser.role === 'employee' ? 'Colaborador' : 'Lectura'})
            </span>
          </div>
        </header>

        {/* Zona de Trabajo */}
        <div className="admin-content-area" style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
          {children}
        </div>
      </div>

      {/* Inyección de estilos responsivos CSS específicos */}
      <style>{`
        /* Desktop */
        @media (min-width: 992px) {
          .admin-sidebar {
            transform: translateX(0) !important;
          }
        }
        
        /* Mobile / Tablet */
        @media (max-width: 991px) {
          .admin-sidebar {
            transform: translateX(-100%);
          }
          .admin-sidebar.open {
            transform: translateX(0);
            box-shadow: 10px 0 30px rgba(0,0,0,0.25);
          }
          .admin-main-container {
            margin-left: 0 !important;
          }
          .admin-hamburger-btn {
            display: inline-flex !important;
          }
          .sidebar-close-btn {
            display: inline-flex !important;
          }
          .operator-label {
            display: none !important;
          }
          .admin-content-area {
            padding: 16px !important;
          }
        }
      `}</style>

    </div>
  );
}
