import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { section: 'Principal' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/graficas', label: 'Gráficas' },
  { section: 'Registro' },
  { to: '/produccion', label: 'Producción semanal' },
  { to: '/cn', label: 'Casos de Negocio (CN)' },
  { section: 'Catálogos' },
  { to: '/cuadrillas', label: 'Cuadrillas' },
  { to: '/proyectos', label: 'Proyectos' },
  { to: '/conceptos', label: 'Conceptos' },
  { section: 'Cortes' },
  { to: '/corte-semanal', label: 'Corte semanal' },
  { to: '/corte-cn', label: 'Corte quincenal CN' },
  { to: '/historial', label: 'Historial de cortes' },
  { section: 'Admin' },
  { to: '/usuarios', label: 'Usuarios' },
]

export default function Layout() {
  const { perfil, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <div className="w-52 flex-shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col overflow-y-auto">
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="font-medium text-gray-900">TeleControl</div>
          {perfil && <div className="text-xs text-gray-400 mt-0.5">{perfil.nombre} · {perfil.rol}</div>}
        </div>

        <nav className="flex-1 py-2">
          {navItems.map((item, i) =>
            item.section ? (
              <div key={i} className="px-4 pt-3 pb-1 text-xs text-gray-400 uppercase tracking-wide">
                {item.section}
              </div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  'nav-item ' + (isActive ? 'nav-item-active' : '')
                }
              >
                {item.label}
              </NavLink>
            )
          )}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <button onClick={handleSignOut} className="btn btn-sm w-full text-gray-500">
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
