import { useNavigate } from 'react-router-dom'
import { useDB } from '../hooks/useDB'
import { getInfoCortesCN } from '../lib/fechas'

export default function Dashboard() {
  const { cuadrillas, produccion, registrosCN, cortes, fmt$, getCuadrilla, getProyecto, loading } = useDB()
  const navigate = useNavigate()
  const hoy = new Date()
  const info = getInfoCortesCN()

  const totalProd = (cortes || [])
  .filter(c => c.tipo === 'Semanal' && c.estado_pago === 'Pendiente')
  .reduce((a, c) => a + Number(c.total), 0)
  const totalCN = registrosCN.filter(r => r.estado === 'Pendiente').reduce((a, r) => a + Number(r.monto), 0)
  const pendientes = (cortes || []).filter(c => c.estado_pago === 'Pendiente').slice(0, 5)

  const d = hoy.getDate()
  const ult = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
  const pen = ult - 1
  const dw = hoy.getDay()
  const diasViernes = dw <= 5 ? (5 - dw) : (7 - dw + 5)

  const proximosCortes = []
  if (d === 14 || d === pen) proximosCortes.push({ label: 'Corte CN hoy', info: 'Genera el PDF', urgente: true, tipo: 'CN', to: '/corte-cn' })
  else if (d < 14) proximosCortes.push({ label: '1ª quincena CN', info: `Faltan ${14 - d} día${14 - d > 1 ? 's' : ''}`, urgente: (14 - d) <= 3, tipo: 'CN' })
  else if (d > 15 && d < pen) { const ds = pen - d; proximosCortes.push({ label: '2ª quincena CN', info: `Faltan ${ds} día${ds > 1 ? 's' : ''}`, urgente: ds <= 3, tipo: 'CN' }) }
  proximosCortes.push({ label: 'Corte semanal', info: diasViernes === 0 ? 'Hoy (viernes)' : `Faltan ${diasViernes} día${diasViernes > 1 ? 's' : ''}`, urgente: diasViernes === 0, tipo: 'Sem' })

  if (loading) return <div className="text-gray-400 py-12 text-center">Cargando...</div>

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-lg font-medium">Dashboard</h2>
          <div className="text-xs text-gray-400 mt-0.5">
            {hoy.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      {info && (d === 14 || d === pen) && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-700 text-sm px-4 py-3 rounded-lg mb-4">
          <span>{info.msg}</span>
          <button onClick={() => navigate('/corte-cn')} className="btn btn-sm ml-auto whitespace-nowrap">Ir al corte</button>
        </div>
      )}
      {info && d !== 14 && d !== pen && (d < 14 ? (14 - d) <= 3 : (pen - d) <= 3) && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm px-4 py-3 rounded-lg mb-4">{info.msg}</div>
      )}

      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="metric"><div className="metric-label">Cuadrillas</div><div className="metric-value">{cuadrillas.length}</div><div className="metric-sub">Registradas</div></div>
        <div className="metric"><div className="metric-label">Semanal pendiente</div><div className="metric-value">{fmt$(totalProd)}</div><div className="metric-sub">Sin cobrar</div></div>
        <div className="metric"><div className="metric-label">CN pendiente</div><div className="metric-value">{fmt$(totalCN)}</div><div className="metric-sub">Sin cobrar</div></div>
        <div className="metric"><div className="metric-label">Total por cobrar</div><div className="metric-value">{fmt$(totalProd + totalCN)}</div><div className="metric-sub">Ambos esquemas</div></div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <div className="text-sm font-medium mb-3">Próximos cortes</div>
          {proximosCortes.map((p, i) => (
            <div key={i} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0 text-sm">
              <span className="text-gray-700">{p.label}</span>
              <span className={`badge ${p.urgente ? 'badge-red' : p.tipo === 'CN' ? 'badge-purple' : 'badge-blue'}`}>{p.info}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="text-sm font-medium mb-3">Cortes pendientes de pago</div>
          {pendientes.length ? (
            <table className="w-full">
              <thead><tr><th className="th">Período</th><th className="th">Tipo</th><th className="th text-right">Monto</th></tr></thead>
              <tbody>
                {pendientes.map(c => (
                  <tr key={c.id}>
                    <td className="td text-xs truncate max-w-[120px]">{c.periodo}</td>
                    <td className="td"><span className={`badge ${c.tipo === 'CN' ? 'badge-purple' : 'badge-blue'}`}>{c.tipo}</span></td>
                    <td className="td text-right">{fmt$(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-xs text-gray-400 py-6 text-center">Sin cortes pendientes</div>
          )}
        </div>
      </div>
    </div>
  )
}
