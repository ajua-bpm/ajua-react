import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Login from './modules/auth/Login';
import Dashboard from './modules/dashboard/Dashboard';
import TL from './modules/bpm/TL';
import DT from './modules/bpm/DT';
import AL from './modules/bpm/AL';
import BAS from './modules/bpm/BAS';
import ROD from './modules/bpm/ROD';
import LIMP from './modules/bpm/LIMP';
import VYP from './modules/bpm/VYP';
import Gastos from './modules/gastos/Gastos';
import AnticiposMX from './modules/finanzas/AnticiposMX';
import StockVivo from './modules/stock/StockVivo';
import Walmart from './modules/walmart/Walmart';
import Guatecompras from './modules/guatecompras/Guatecompras';
import Reportes from './modules/reportes/Reportes';
import Admin from './modules/admin/Admin';
import LoadingSpinner from './components/LoadingSpinner';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if(loading) return <LoadingSpinner/>;
  if(!user) return <Navigate to="/login" replace/>;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login/>}/>
        <Route path="/" element={
          <RequireAuth>
            <Layout/>
          </RequireAuth>
        }>
          <Route index element={<Navigate to="/dashboard" replace/>}/>
          <Route path="dashboard"    element={<Dashboard/>}/>
          <Route path="bpm/tl"       element={<TL/>}/>
          <Route path="bpm/dt"       element={<DT/>}/>
          <Route path="bpm/al"       element={<AL/>}/>
          <Route path="bpm/bas"      element={<BAS/>}/>
          <Route path="bpm/rod"      element={<ROD/>}/>
          <Route path="bpm/limp"     element={<LIMP/>}/>
          <Route path="bpm/vyp"      element={<VYP/>}/>
          <Route path="gastos"       element={<Gastos/>}/>
          <Route path="anticipos"    element={<AnticiposMX/>}/>
          <Route path="stock"        element={<StockVivo/>}/>
          <Route path="walmart"      element={<Walmart/>}/>
          <Route path="guatecompras" element={<Guatecompras/>}/>
          <Route path="reportes"     element={<Reportes/>}/>
          <Route path="admin"        element={<Admin/>}/>
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
      </Routes>
    </BrowserRouter>
  );
}
