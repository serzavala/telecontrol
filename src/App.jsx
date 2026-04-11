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

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Cargando...</div>
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
