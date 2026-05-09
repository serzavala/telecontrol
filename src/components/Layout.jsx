import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useState, useEffect } from 'react'
import Asistente from './Asistente'

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
  { divider: true },
  { section: 'Ingresos y Gastos' },
  { to: '/resumen-financiero', label: 'Resumen financiero' },
  { to: '/ingresos', label: 'Ingresos' },
  { to: '/gastos', label: 'Gastos' },
  { to: '/nomina', label: 'Nómina' },
  { to: '/prestamos', label: 'Préstamos' },
  { to: '/cierres', label: 'Cierres semanales' },
  { to: '/empleados', label: 'Empleados' },
  { divider: true },
  { section: 'Admin' },
  { to: '/usuarios', label: 'Usuarios' },
  { to: '/auditoria', label: 'Auditoría' },
]

export default function Layout() {
  const { perfil, signOut } = useAuth()
  const navigate = useNavigate()
  const [dark, setDark] = useState(() => localStorage.getItem('tc-tema') === 'oscuro')

  useEffect(() => {
    if (dark) {
      document.documentElement.setAttribute('data-tema', 'oscuro')
      localStorage.setItem('tc-tema', 'oscuro')
    } else {
      document.documentElement.removeAttribute('data-tema')
      localStorage.setItem('tc-tema', 'claro')
    }
  }, [dark])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--tc-bg)' }}>
      <div className="flex-shrink-0 flex flex-col overflow-y-auto" style={{ width: '210px', background: '#0F3460' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#F5A623', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '15px', color: '#0F3460', flexShrink: 0 }}>N</div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#F5A623', letterSpacing: '0.05em' }}>NOVUS</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', marginTop: '1px', letterSpacing: '0.03em' }}>Innovación y Futuro</div>
          </div>
        </div>
        <nav className="flex-1 py-2">
          {navItems.map((item, i) => {
            if (item.divider) return <div key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '6px 0' }} />
            if (item.section) return <div key={i} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', padding: '12px 16px 4px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>{item.section}</div>
            return (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => 'nav-item' + (isActive ? ' nav-item-active' : '')}>
                {item.label}
              </NavLink>
            )
          })}
        </nav>
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {perfil && (
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '2px' }}>
              <div style={{ color: '#fff', fontWeight: 500 }}>{perfil.nombre}</div>
              <div style={{ fontSize: '11px' }}>{perfil.rol}</div>
            </div>
          )}
          {/* Toggle tema oscuro */}
          <button onClick={() => setDark(d => !d)} style={{
            width: '100%', padding: '6px 12px', borderRadius: '7px',
            background: dark ? 'rgba(245,166,35,0.15)' : 'rgba(255,255,255,0.08)',
            border: `1px solid ${dark ? 'rgba(245,166,35,0.4)' : 'rgba(255,255,255,0.15)'}`,
            color: dark ? '#F5A623' : 'rgba(255,255,255,0.7)',
            fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'all .2s',
          }}>
            {dark ? '☀️ Tema claro' : '🌙 Tema oscuro'}
          </button>
          <button onClick={handleSignOut} style={{
            width: '100%', padding: '6px 12px', borderRadius: '7px',
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.7)', fontSize: '12px', cursor: 'pointer',
          }}
            onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.15)'}
            onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.08)'}
          >Cerrar sesión</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ background: 'var(--tc-bg)' }}>
        <div className="p-6"><Outlet /></div>
      </div>
      <Asistente />
    </div>
  )
}
