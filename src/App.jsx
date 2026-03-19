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

// Inventario
import StockVivo from './modules/stock/StockVivo';
import EntradaBodega from './modules/inventario/EntradaBodega';
import SalidaBodega from './modules/inventario/SalidaBodega';
import Proveedores from './modules/inventario/Proveedores';

// Ventas
import VentasGT from './modules/ventas/VentasGT';
import VentasInt from './modules/ventas/VentasInt';
import GastosSemanales from './modules/ventas/GastosSemanales';
import Walmart from './modules/walmart/Walmart';

// Finanzas
import Gastos from './modules/gastos/Gastos';
import AnticiposMX from './modules/finanzas/AnticiposMX';
import CotizadorRapido from './modules/cotizador/CotizadorRapido';
import Cotizador from './modules/cotizador/Cotizador';

// Personal
import Personal from './modules/personal/Personal';

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

          {/* BPM Personal */}
          <Route path="bpm/lavado-prod"        element={<LavadoProducto />} />
          <Route path="bpm/capacitacion"       element={<Capacitacion />} />
          <Route path="bpm/enfermos"           element={<EmpleadosEnfermos />} />
          <Route path="bpm/visitas"            element={<Visitas />} />

          {/* Inventario */}
          <Route path="stock"                  element={<StockVivo />} />
          <Route path="inventario/entrada"     element={<EntradaBodega />} />
          <Route path="inventario/salida"      element={<SalidaBodega />} />
          <Route path="inventario/proveedores" element={<Proveedores />} />

          {/* Ventas */}
          <Route path="ventas/gt"              element={<VentasGT />} />
          <Route path="ventas/int"             element={<VentasInt />} />
          <Route path="gastos/semanales"          element={<GastosSemanales />} />
          <Route path="walmart"                element={<Walmart />} />

          {/* Finanzas */}
          <Route path="gastos"                 element={<Gastos />} />
          <Route path="anticipos"              element={<AnticiposMX />} />
          <Route path="cotizador/rapido"       element={<CotizadorRapido />} />
          <Route path="cotizador"              element={<Cotizador />} />

          {/* Personal */}
          <Route path="personal"               element={<Personal />} />

          {/* Sistema */}
          <Route path="guatecompras"           element={<Guatecompras />} />
          <Route path="reportes"               element={<Reportes />} />
          <Route path="admin"                  element={<Admin />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
