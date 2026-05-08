import { useState } from 'react'
import { useDB } from '../hooks/useDB'

// Calcula número de semana ISO a partir de una fecha string 'YYYY-MM-DD'
function semanaISO(fechaStr) {
  if (!fechaStr) return null
  const date = new Date(fechaStr + 'T12:00:00') // mediodía evita desfase de zona horaria
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
}

export default function Historial() {
  const db = useDB()
  const [filtros, setFiltros] = useState({
    tipo: '',
    estado: '',
    proyecto: '',
    semana: '',
    cuadrilla: '',
  })
  const setF = k => e => setFiltros(f => ({ ...f, [k]: e.target.value }))

  // Opciones dinámicas para semana y cuadrilla
  const semanasUnicas = [...new Set(
    (db.cortes || [])
      .map(c => c.semana ?? semanaISO(c.fecha_corte))
      .filter(Boolean)
  )].sort((a, b) => a - b)

  const cuadrillasUnicas = [...new Set(
    (db.cortes || []).map(c => c.cuadrilla).filter(Boolean)
  )].sort()

  const rows = [...(db.cortes || [])]
    .filter(c => {
      if (filtros.tipo && c.tipo !== filtros.tipo) return false
      if (filtros.estado && c.estado_pago !== filtros.estado) return false
      if (filtros.proyecto && c.proyecto_id !== filtros.proyecto) return false
      if (filtros.cuadrilla && c.cuadrilla !== filtros.cuadrilla) return false
      if (filtros.semana) {
        const sem = c.semana ?? semanaISO(c.fecha_corte)
        if (sem !== Number(filtros.semana)) return false
      }
      return true
    })
    .sort((a, b) => b.fecha_corte?.localeCompare(a.fecha_corte))

  const montoPagado = rows.filter(c => c.estado_pago === 'Pagado').reduce((a, c) => a + Number(c.total), 0)
  const montoPend   = rows.filter(c => c.estado_pago === 'Pendiente').reduce((a, c) => a + Number(c.total), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-medium">Historial de cortes</h2>
          <div className="text-xs text-gray-400">Registro de todos los cortes y su estado de pago</div>
        </div>
      </div>

      {/* ── FILTROS ── */}
      <div className="card mb-4">
        <div className="grid grid-cols-3 gap-3 mb-3">
          {/* Tipo */}
          <div>
            <label className="label">Tipo de corte</label>
            <select className="input" value={filtros.tipo} onChange={setF('tipo')}>
              <option value="">Todos</option>
              <option value="Semanal">Semanal</option>
              <option value="CN">Quincenal CN</option>
            </select>
          </div>

          {/* Estado */}
          <div>
            <label className="label">Estado de pago</label>
            <select className="input" value={filtros.estado} onChange={setF('estado')}>
              <option value="">Todos</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Pagado">Pagado</option>
            </select>
          </div>

          {/* Proyecto */}
          <div>
            <label className="label">Proyecto</label>
            <select className="input" value={filtros.proyecto} onChange={setF('proyecto')}>
              <option value="">Todos</option>
              {db.proyectos.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          {/* ── NUEVO: Semana ── */}
          <div>
            <label className="label">Semana</label>
            <select className="input" value={filtros.semana} onChange={setF('semana')}>
              <option value="">Todas</option>
              {semanasUnicas.map(s => (
                <option key={s} value={s}>Sem. {s}</option>
              ))}
            </select>
          </div>

          {/* ── NUEVO: Cuadrilla ── */}
          <div>
            <label className="label">Cuadrilla</label>
            <select className="input" value={filtros.cuadrilla} onChange={setF('cuadrilla')}>
              <option value="">Todas</option>
              {cuadrillasUnicas.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── MÉTRICAS ── */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="metric">
          <div className="metric-label">Cortes totales</div>
          <div className="metric-value">{rows.length}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Monto pagado</div>
          <div className="metric-value text-green-600">{db.fmt$(montoPagado)}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Monto pendiente</div>
          <div className="metric-value text-amber-600">{db.fmt$(montoPend)}</div>
        </div>
      </div>

      {/* ── TABLA ── */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Período</th>
              <th className="th w-20">Tipo</th>
              <th className="th">Proyecto</th>
              <th className="th w-20">Semana</th>
              <th className="th">Cuadrilla</th>
              <th className="th w-24 text-right">Monto</th>
              <th className="th w-28">Estado pago</th>
              <th className="th w-24">Fecha pago</th>
              <th className="th w-16"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map(r => {
              const pagado = r.estado_pago === 'Pagado'
              const semana = r.semana ?? semanaISO(r.fecha_corte)
              return (
                <tr key={r.id} className={pagado ? 'opacity-60' : ''}>
                  <td className="td text-xs truncate max-w-[120px]">{r.periodo}</td>
                  <td className="td">
                    <span className={`badge ${r.tipo === 'CN' ? 'badge-purple' : 'badge-blue'}`}>
                      {r.tipo}
                    </span>
                  </td>
                  <td className="td text-xs truncate">{r.proyecto_nombre}</td>
                  <td className="td text-xs text-gray-500">
                    {semana ? `Sem. ${semana}` : '—'}
                  </td>
                  <td className="td text-xs truncate">{r.cuadrilla || '—'}</td>
                  <td className="td text-right">{db.fmt$(r.total)}</td>
                  <td className="td">
                    <button
                      className={`pago-pill ${pagado ? 'pago-pill-pagado' : 'pago-pill-pendiente'}`}
                      onClick={() => db.togglePagoCorte(r.id, r.estado_pago)}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                      {r.estado_pago}
                    </button>
                  </td>
                  <td className="td text-xs text-gray-400">{r.fecha_pago || '—'}</td>
                  <td className="td">
                    <button className="btn btn-sm" onClick={() => db.deleteCorte(r.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              )
            }) : (
              <tr>
                <td colSpan={9} className="td text-center text-gray-400 py-10">
                  Sin cortes guardados. Genera y guarda un corte semanal.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
