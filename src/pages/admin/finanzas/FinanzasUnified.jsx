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

// Fallback de carga de pestañas
function TabFallback() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', minHeight: '40vh', color: 'var(--text-secondary)', fontSize: '13px' }}>
      <div className="spinner" />
      Cargando pestaña...
    </div>
  );
}

const TABS = [
  { name: 'Dashboard', path: 'dashboard', icon: LayoutDashboard },
  { name: 'Ventas', path: 'ventas', icon: Receipt },
  { name: 'Compras', path: 'compras', icon: FileText },
  { name: 'IGV e Impuestos', path: 'igv', icon: TrendingUp },
  { name: 'Régimen', path: 'regime', icon: ShieldCheck },
  { name: 'Declaraciones', path: 'declaraciones', icon: FileBarChart },
  { name: 'Registro de Compras', path: 'registro-compras', icon: BookOpen },
  { name: 'Registro de Ventas', path: 'registro-ventas', icon: BookOpen },
  { name: 'Reportes SUNAT', path: 'reportes-sunat', icon: FileBarChart },
  { name: 'Configuración', path: 'configuracion', icon: Sliders },
];

export default function FinanzasUnified() {
  const navigate = useNavigate();
  const location = useLocation();

  const currentTab = location.pathname.replace(/\/+$/, '').split('/').pop();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {/* Barra de pestañas (sticky, con scroll horizontal propio en móvil) */}
      <div style={{ position: 'sticky', top: 0, zIndex: 95, background: 'var(--bg-primary)', paddingBottom: '12px' }}>
        <nav className="tabs" role="tablist" aria-label="Secciones de Finanzas" style={{ border: '1px solid var(--border-color)' }}>
          {TABS.map(({ name, path, icon: Icon }) => {
            const isActive = currentTab === path;
            return (
              <button
                key={path}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={isActive ? 'tab active' : 'tab'}
                onClick={() => navigate(`/admin/finanzas/${path}`)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontWeight: isActive ? 600 : 500 }}
              >
                <Icon size={15} strokeWidth={isActive ? 2.1 : 1.7} />
                {name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Contenido de la pestaña activa */}
      <div style={{ marginTop: '8px', minWidth: 0 }}>
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
