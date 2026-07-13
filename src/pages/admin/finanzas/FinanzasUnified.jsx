import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Receipt, FileText, TrendingUp, ShieldCheck, 
  FileBarChart, BookOpen, Sliders 
} from 'lucide-react';

// Lazy load components
const TaxDashboard = lazy(() => import('./TaxDashboard'));
const TaxSales = lazy(() => import('./TaxSales'));
const TaxPurchases = lazy(() => import('./TaxPurchases'));
const TaxIGV = lazy(() => import('./TaxIGV'));
const TaxRegime = lazy(() => import('./TaxRegime'));
const TaxDeclaration = lazy(() => import('../TaxDeclaration'));
const TaxPurchaseRegistry = lazy(() => import('./TaxPurchaseRegistry'));
const TaxSalesRegistry = lazy(() => import('./TaxSalesRegistry'));
const TaxSunatReports = lazy(() => import('./TaxSunatReports'));
const TaxConfigPage = lazy(() => import('./TaxConfigPage'));

// Fallback loading component
function TabFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh', color: 'var(--text-secondary)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '24px', height: '24px', border: '2.5px solid var(--border-color)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin-tab 0.8s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ fontSize: '12px' }}>Cargando pestaña...</p>
      </div>
      <style>{`@keyframes spin-tab { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function FinanzasUnified() {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { name: 'Dashboard Tributario', path: 'dashboard', icon: LayoutDashboard },
    { name: 'Ventas (Facturas y Boletas)', path: 'ventas', icon: Receipt },
    { name: 'Compras (Facturas y Boletas)', path: 'compras', icon: FileText },
    { name: 'IGV e Impuestos', path: 'igv', icon: TrendingUp },
    { name: 'Régimen Tributario', path: 'regime', icon: ShieldCheck },
    { name: 'Declaraciones', path: 'declaraciones', icon: FileBarChart },
    { name: 'Registro de Compras', path: 'registro-compras', icon: BookOpen },
    { name: 'Registro de Ventas', path: 'registro-ventas', icon: BookOpen },
    { name: 'Reportes SUNAT', path: 'reportes-sunat', icon: FileBarChart },
    { name: 'Configuración Tributaria', path: 'configuracion', icon: Sliders },
  ];

  const currentTab = location.pathname.split('/').pop();

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      
      {/* BARRA DE PESTAÑAS HORIZONTAL */}
      <div style={{ 
        borderBottom: '1px solid var(--border-color)', 
        backgroundColor: 'var(--bg-card)',
        margin: '-24px -24px 0 -24px',
        padding: '20px 24px 0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 95,
        boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
        display: 'flex',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }} className="tabs-container">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.path || (tab.path === 'declaraciones' && currentTab === 'declaraciones');
          
          return (
            <button
              key={tab.path}
              onClick={() => navigate(`/admin/finanzas/${tab.path}`)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 18px',
                border: 'none',
                borderBottom: isActive ? '3px solid var(--text-primary)' : '3px solid transparent',
                backgroundColor: 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                marginRight: '8px'
              }}
            >
              <Icon size={14} strokeWidth={isActive ? 2 : 1.5} />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* Ocultar barra de scroll en Webkit */}
      <style>{`
        .tabs-container::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {/* CONTENIDO DE LA PESTAÑA ACTIVA */}
      <div style={{ marginTop: '20px' }}>
        <Suspense fallback={<TabFallback />}>
          <Routes>
            <Route path="dashboard" element={<TaxDashboard />} />
            <Route path="ventas" element={<TaxSales />} />
            <Route path="compras" element={<TaxPurchases />} />
            <Route path="igv" element={<TaxIGV />} />
            <Route path="regime" element={<TaxRegime />} />
            <Route path="declaraciones" element={<TaxDeclaration />} />
            <Route path="registro-compras" element={<TaxPurchaseRegistry />} />
            <Route path="registro-ventas" element={<TaxSalesRegistry />} />
            <Route path="reportes-sunat" element={<TaxSunatReports />} />
            <Route path="configuracion" element={<TaxConfigPage />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
        </Suspense>
      </div>

    </div>
  );
}
