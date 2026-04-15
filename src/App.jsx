import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import Graficas from './pages/Graficas'
import Produccion from './pages/Produccion'
import CasosNegocio from './pages/CasosNegocio'
import Cuadrillas from './pages/Cuadrillas'
import Proyectos from './pages/Proyectos'
import Conceptos from './pages/Conceptos'
import CorteSemanal from './pages/CorteSemanal'
import CorteCN from './pages/CorteCN'
import Historial from './pages/Historial'
import Usuarios from './pages/Usuarios'
import ResumenFinanciero from './pages/ResumenFinanciero'
import Ingresos from './pages/Ingresos'
import Gastos from './pages/Gastos'
import NominaPage from './pages/Nomina'
import Prestamos from './pages/Prestamos'
import CierresSemanales from './pages/CierresSemanales'
import Empleados from './pages/Empleados'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'#6B7A99',fontSize:14 }}>Cargando...</div>
  return user ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="graficas" element={<Graficas />} />
        <Route path="produccion" element={<Produccion />} />
        <Route path="cn" element={<CasosNegocio />} />
        <Route path="cuadrillas" element={<Cuadrillas />} />
        <Route path="proyectos" element={<Proyectos />} />
        <Route path="conceptos" element={<Conceptos />} />
        <Route path="corte-semanal" element={<CorteSemanal />} />
        <Route path="corte-cn" element={<CorteCN />} />
        <Route path="historial" element={<Historial />} />
        <Route path="usuarios" element={<Usuarios />} />
        <Route path="resumen-financiero" element={<ResumenFinanciero />} />
        <Route path="ingresos" element={<Ingresos />} />
        <Route path="gastos" element={<Gastos />} />
        <Route path="nomina" element={<NominaPage />} />
        <Route path="prestamos" element={<Prestamos />} />
        <Route path="cierres" element={<CierresSemanales />} />
        <Route path="empleados" element={<Empleados />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
