import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { section: 'Producción' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/graficas', label: 'Gráficas' },
  { to: '/produccion', label: 'Producción semanal' },
  { to: '/cn', label: 'Casos de Negocio (CN)' },
  { section: 'Cortes' },
  { to: '/corte-semanal', label: 'Corte semanal' },
  { to: '/corte-cn', label: 'Corte quincenal CN' },
  { to: '/historial', label: 'Historial de cortes' },
  { section: 'Catálogos' },
  { to: '/cuadrillas', label: 'Cuadrillas' },
  { to: '/proyectos', label: 'Proyectos' },
  { to: '/conceptos', label: 'Conceptos' },
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
    <div className="flex h-screen overflow-hidden" style={{ background: '#F4F6FB' }}>
      {/* Sidebar */}
      <div className="flex-shrink-0 flex flex-col overflow-y-auto" style={{ width: '210px', background: '#0F3460' }}>
        {/* Brand */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#F5A623', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '15px', color: '#0F3460', flexShrink: 0 }}>N</div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff' }}>TeleControl</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginTop: '1px' }}>NOVUS — Innovación y Futuro</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2">
          {navItems.map((item, i) =>
            item.section ? (
              <div key={i} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', padding: '12px 16px 4px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>
                {item.section}
              </div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => 'nav-item' + (isActive ? ' nav-item-active' : '')}
              >
                {item.label}
              </NavLink>
            )
          )}
        </nav>

        {/* User + logout */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {perfil && (
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>
              <div style={{ color: '#fff', fontWeight: 500 }}>{perfil.nombre}</div>
              <div style={{ fontSize: '11px' }}>{perfil.rol}</div>
            </div>
          )}
          <button
            onClick={handleSignOut}
            style={{ width: '100%', padding: '6px 12px', borderRadius: '7px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', fontSize: '12px', cursor: 'pointer', transition: 'all .15s' }}
            onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.15)'}
            onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.08)'}
          >
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
