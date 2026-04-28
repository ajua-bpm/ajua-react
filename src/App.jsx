import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Login from './modules/auth/Login';
import Dashboard from './modules/dashboard/Dashboard';
import LoadingSpinner from './components/LoadingSpinner';

// BPM
import TL from './modules/bpm/TL';
import DT from './modules/bpm/DT';
import AL from './modules/bpm/AL';
import BAS from './modules/bpm/BAS';
import ROD from './modules/bpm/ROD';
import LIMP from './modules/bpm/LIMP';
import VYP from './modules/bpm/VYP';
import Fumigacion from './modules/bpm/Fumigacion';
import Croquis from './modules/bpm/Croquis';
import Capacitacion from './modules/bpm/Capacitacion';
import EmpleadosEnfermos from './modules/bpm/EmpleadosEnfermos';
import Visitas from './modules/bpm/Visitas';
import LavadoProducto from './modules/bpm/LavadoProducto';
import ControlPersonal from './modules/bpm/ControlPersonal';
import ControlCloro from './modules/bpm/ControlCloro';
import ControlTemperatura from './modules/bpm/ControlTemperatura';

// Inventario
import StockVivo from './modules/stock/StockVivo';
import EntradaBodega from './modules/inventario/EntradaBodega';
import SalidaBodega from './modules/inventario/SalidaBodega';

// Ventas
import VentasGT from './modules/ventas/VentasGT';
import VentasInt from './modules/ventas/VentasInt';
import Walmart from './modules/walmart/Walmart';

// Proyección Semanal
import ProyeccionSemanal from './modules/proyeccion/ProyeccionSemanal';

// Finanzas
import GastosUnificado from './modules/gastos/GastosUnificado';
import AnticiposMX from './modules/finanzas/AnticiposMX';
import FinanzasModule from './modules/finanzas/Finanzas';
import CotizadorRapido from './modules/cotizador/CotizadorRapido';
import CotizadorLista   from './modules/cotizador/CotizadorLista';
import CotizadorNuevo   from './modules/cotizador/CotizadorNuevo';
import CotizadorDetalle from './modules/cotizador/CotizadorDetalle';

// Precios
import Precios from './modules/precios/Precios';

// Personal
import Personal from './modules/personal/Personal';

// Finanzas — Cuentas Proveedores
import CuentasProveedores from './modules/cuentasProveedores/CuentasProveedores';
import Liquidacion        from './modules/cuentasProveedores/Liquidacion';

// CxC — Cuentas Clientes
import CuentasClientes from './modules/cuentasClientes/CuentasClientes';

// Equipo
import Pendientes from './modules/pendientes/Pendientes';

// Sistema
import Guatecompras from './modules/guatecompras/Guatecompras';
import Reportes from './modules/reportes/Reportes';
import Admin from './modules/admin/Admin';

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
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
