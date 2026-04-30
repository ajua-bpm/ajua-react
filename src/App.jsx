import { lazy, Suspense, Component } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 40, fontFamily: 'monospace', background: '#1a1a1a', color: '#fff', minHeight: '100vh' }}>
        <h2 style={{ color: '#ff6b6b' }}>Error de aplicación</h2>
        <pre style={{ color: '#ffa', whiteSpace: 'pre-wrap', fontSize: 13 }}>{this.state.error?.message}</pre>
        <button onClick={() => window.location.reload()} style={{ marginTop: 24, padding: '10px 24px', background: '#2d6a4f', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
          Recargar página
        </button>
      </div>
    );
    return this.props.children;
  }
}
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Login from './modules/auth/Login';
import LoadingSpinner from './components/LoadingSpinner';

const Dashboard          = lazy(() => import('./modules/dashboard/Dashboard'));

// BPM
const TL                 = lazy(() => import('./modules/bpm/TL'));
const DT                 = lazy(() => import('./modules/bpm/DT'));
const AL                 = lazy(() => import('./modules/bpm/AL'));
const BAS                = lazy(() => import('./modules/bpm/BAS'));
const ROD                = lazy(() => import('./modules/bpm/ROD'));
const LIMP               = lazy(() => import('./modules/bpm/LIMP'));
const VYP                = lazy(() => import('./modules/bpm/VYP'));
const Fumigacion         = lazy(() => import('./modules/bpm/Fumigacion'));
const Croquis            = lazy(() => import('./modules/bpm/Croquis'));
const Capacitacion       = lazy(() => import('./modules/bpm/Capacitacion'));
const EmpleadosEnfermos  = lazy(() => import('./modules/bpm/EmpleadosEnfermos'));
const Visitas            = lazy(() => import('./modules/bpm/Visitas'));
const LavadoProducto     = lazy(() => import('./modules/bpm/LavadoProducto'));
const ControlPersonal    = lazy(() => import('./modules/bpm/ControlPersonal'));
const ControlCloro       = lazy(() => import('./modules/bpm/ControlCloro'));
const ControlTemperatura = lazy(() => import('./modules/bpm/ControlTemperatura'));

// Inventario
const StockVivo          = lazy(() => import('./modules/stock/StockVivo'));
const EntradaBodega      = lazy(() => import('./modules/inventario/EntradaBodega'));
const SalidaBodega       = lazy(() => import('./modules/inventario/SalidaBodega'));

// Ventas
const VentasGT           = lazy(() => import('./modules/ventas/VentasGT'));
const VentasInt          = lazy(() => import('./modules/ventas/VentasInt'));
const Walmart            = lazy(() => import('./modules/walmart/Walmart'));

// Proyección Semanal
const ProyeccionSemanal  = lazy(() => import('./modules/proyeccion/ProyeccionSemanal'));

// Finanzas
const GastosUnificado    = lazy(() => import('./modules/gastos/GastosUnificado'));
const AnticiposMX        = lazy(() => import('./modules/finanzas/AnticiposMX'));
const FinanzasModule     = lazy(() => import('./modules/finanzas/Finanzas'));
const CotizadorRapido    = lazy(() => import('./modules/cotizador/CotizadorRapido'));
const CotizadorLista     = lazy(() => import('./modules/cotizador/CotizadorLista'));
const CotizadorNuevo     = lazy(() => import('./modules/cotizador/CotizadorNuevo'));
const CotizadorDetalle   = lazy(() => import('./modules/cotizador/CotizadorDetalle'));

// Precios
const Precios            = lazy(() => import('./modules/precios/Precios'));

// Personal
const Personal           = lazy(() => import('./modules/personal/Personal'));

// Cuentas Proveedores
const CuentasProveedores = lazy(() => import('./modules/cuentasProveedores/CuentasProveedores'));
const Liquidacion        = lazy(() => import('./modules/cuentasProveedores/Liquidacion'));

// CxC — Cuentas Clientes
const CuentasClientes    = lazy(() => import('./modules/cuentasClientes/CuentasClientes'));

// Equipo
const Pendientes         = lazy(() => import('./modules/pendientes/Pendientes'));

// Sistema
const Guatecompras       = lazy(() => import('./modules/guatecompras/Guatecompras'));
const Reportes           = lazy(() => import('./modules/reportes/Reportes'));
const Admin              = lazy(() => import('./modules/admin/Admin'));

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin(user)) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"              element={<Dashboard />} />

          {/* BPM Transporte */}
          <Route path="bpm/tl"                 element={<TL />} />
          <Route path="bpm/dt"                 element={<DT />} />

          {/* BPM Bodega */}
          <Route path="bpm/al"                 element={<AL />} />
          <Route path="bpm/bas"                element={<BAS />} />
          <Route path="bpm/rod"                element={<ROD />} />
          <Route path="bpm/limp"               element={<LIMP />} />
          <Route path="bpm/vyp"                element={<VYP />} />
          <Route path="bpm/fumigacion"         element={<Fumigacion />} />
          <Route path="bpm/croquis"            element={<Croquis />} />

          {/* BPM Higiene */}
          <Route path="bpm/lavado-prod"        element={<LavadoProducto />} />
          <Route path="bpm/capacitacion"       element={<Capacitacion />} />
          <Route path="bpm/enfermos"           element={<EmpleadosEnfermos />} />
          <Route path="bpm/visitas"            element={<Visitas />} />
          <Route path="bpm/control-personal"   element={<ControlPersonal />} />
          <Route path="bpm/cloro"             element={<ControlCloro />} />
          <Route path="bpm/temperatura"       element={<ControlTemperatura />} />

          {/* Inventario */}
          <Route path="stock"                  element={<StockVivo />} />
          <Route path="recepcion"              element={<Navigate to="/inventario/entrada" replace />} />
          <Route path="inventario/entrada"     element={<EntradaBodega />} />
          <Route path="inventario/salida"      element={<SalidaBodega />} />
          <Route path="inventario/proveedores" element={<Navigate to="/admin" replace />} />

          {/* Ventas */}
          <Route path="ventas/gt"              element={<VentasGT />} />
          <Route path="ventas/int"             element={<VentasInt />} />
          <Route path="walmart"                element={<Walmart />} />

          {/* Finanzas */}
          <Route path="proyeccion-semanal"     element={<ProyeccionSemanal />} />
          <Route path="finanzas"               element={<FinanzasModule />} />
          <Route path="gastos"                 element={<GastosUnificado />} />
          <Route path="gastos/semanales"       element={<Navigate to="/gastos" replace />} />
          <Route path="maquila"                element={<Navigate to="/gastos" replace />} />
          <Route path="anticipos"              element={<AnticiposMX />} />
          <Route path="cotizador/rapido"       element={<CotizadorRapido />} />
          <Route path="cotizador"              element={<CotizadorLista />} />
          <Route path="cotizador/nuevo"        element={<CotizadorNuevo />} />
          <Route path="cotizador/:id"          element={<CotizadorDetalle />} />
          <Route path="precios"                element={<Precios />} />

          {/* Cuentas Proveedores */}
          <Route path="cuentas-proveedores"                          element={<CuentasProveedores />} />
          <Route path="cuentas-proveedores/liquidacion/:recepcionId" element={<Liquidacion />} />

          {/* Cuentas Clientes CxC */}
          <Route path="cuentas-clientes"       element={<CuentasClientes />} />

          {/* Equipo */}
          <Route path="pendientes"             element={<Pendientes />} />

          {/* Personal */}
          <Route path="personal"               element={<Personal />} />

          {/* Sistema */}
          <Route path="guatecompras"           element={<Guatecompras />} />
          <Route path="reportes"               element={<Reportes />} />
          <Route path="admin"                  element={<RequireAdmin><Admin /></RequireAdmin>} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
