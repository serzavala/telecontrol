import { useState } from 'react'
import { useIG } from '../hooks/useIG'
import { useDB } from '../hooks/useDB'

export default function ResumenFinanciero() {
  const ig = useIG()
  const db = useDB()
  const hoy = new Date()
  const [filtros, setFiltros] = useState({ semana: '', anio: hoy.getFullYear(), cuadrilla_id: '' })
  const [tabMov, setTabMov] = useState('todos')
  const setFilt = k => e => setFiltros(f => ({ ...f, [k]: e.target.value }))

  const ingresosFilt = ig.ingresos.filter(r =>
    (!filtros.semana || r.semana == filtros.semana) &&
    (!filtros.anio || r.anio == filtros.anio) &&
    (!filtros.cuadrilla_id || r.cuadrilla_id === filtros.cuadrilla_id)
  )
  const gastosFilt = ig.gastos.filter(r =>
    (!filtros.semana || r.semana == filtros.semana) &&
    (!filtros.anio || r.anio == filtros.anio) &&
    (!filtros.cuadrilla_id || r.cuadrilla_id === filtros.cuadrilla_id)
  )
  const nominaFilt = ig.nomina.filter(r =>
    (!filtros.semana || r.semana == filtros.semana) &&
    (!filtros.anio || r.anio == filtros.anio) &&
    (!filtros.cuadrilla_id || r.cuadrilla_id === filtros.cuadrilla_id)
  )

  const totalIngresos = ingresosFilt.reduce((a, r) => a + Number(r.monto), 0)
  const totalGastos = gastosFilt.reduce((a, r) => a + Number(r.monto), 0)
  const totalNomina = nominaFilt.reduce((a, r) => a + Number(r.neto_pagar), 0)
  const utilidad = totalIngresos - totalGastos - totalNomina
  const margen = totalIngresos > 0 ? Math.round(utilidad / totalIngresos * 100) : 0

  // Movimientos combinados para la tabla
  const movimientos = [
    ...ingresosFilt.map(r => ({ fecha: r.fecha, tipo: 'Ingreso', concepto: db.getProyecto(r.proyecto_id).nombre || '—', cuadrilla: db.getCuadrilla(r.cuadrilla_id).nombre, monto: r.monto, signo: 1 })),
    ...gastosFilt.map(r => ({ fecha: r.fecha, tipo: 'Gasto', concepto: r.concepto, cuadrilla: db.getCuadrilla(r.cuadrilla_id).nombre, monto: r.monto, signo: -1 })),
    ...nominaFilt.map(r => ({ fecha: r.fecha_pago || '', tipo: 'Nómina', concepto: ig.getEmpleado(r.empleado_id).nombre, cuadrilla: db.getCuadrilla(r.cuadrilla_id).nombre, monto: r.neto_pagar, signo: -1 })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha))

  const movFiltrados = tabMov === 'todos' ? movimientos : movimientos.filter(m => m.tipo.toLowerCase() === tabMov)

  // Desglose por cuadrilla
  const cuadrillasActivas = [...new Set([...ingresosFilt.map(r => r.cuadrilla_id), ...nominaFilt.map(r => r.cuadrilla_id)].filter(Boolean))]

  // Categorías de gasto
  const catGastos = [...new Set(gastosFilt.map(r => r.categoria))]

  return (
    <div>
      <div className="page-header">
        <div><h2>Resumen financiero</h2><div className="page-header-sub">Ingresos · Nómina · Gastos · Utilidad neta</div></div>
      </div>

      <div className="card mb-4">
        <div className="form-row c3" style={{ marginBottom: 0 }}>
          <div><label className="label">Semana</label><input className="input" type="number" placeholder="Todas" value={filtros.semana} onChange={setFilt('semana')} /></div>
          <div><label className="label">Año</label><input className="input" type="number" value={filtros.anio} onChange={setFilt('anio')} /></div>
          <div><label className="label">Cuadrilla</label>
            <select className="input" value={filtros.cuadrilla_id} onChange={setFilt('cuadrilla_id')}>
              <option value="">Todas</option>
              {db.cuadrillas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
        <div className="metric metric-light"><div className="metric-label">Total ingresos</div><div className="metric-value" style={{ color: '#1A7A45' }}>{ig.fmt$(totalIngresos)}</div><div className="metric-sub">Producción + CN</div></div>
        <div className="metric metric-light"><div className="metric-label">Total nómina</div><div className="metric-value" style={{ color: '#A82020' }}>{ig.fmt$(totalNomina)}</div><div className="metric-sub">Neto pagado</div></div>
        <div className="metric metric-light"><div className="metric-label">Total gastos</div><div className="metric-value" style={{ color: '#946200' }}>{ig.fmt$(totalGastos)}</div><div className="metric-sub">Operativos</div></div>
        <div className={`metric ${utilidad >= 0 ? 'metric-primary' : 'metric-light'}`}>
          <div className="metric-label">Utilidad neta</div>
          <div className="metric-value" style={{ color: utilidad >= 0 ? undefined : '#A82020' }}>{ig.fmt$(utilidad)}</div>
          <div className="metric-sub">{margen}% margen</div>
        </div>
      </div>

      {/* Movimientos */}
      <div className="card">
        <div className="card-title">Movimientos del período</div>
        <div className="tab-bar">
          {['todos','ingreso','gasto','nómina'].map(t => (
            <div key={t} className={`tab ${tabMov === t ? 'tab-active' : ''}`} onClick={() => setTabMov(t)} style={{ textTransform: 'capitalize' }}>{t}</div>
          ))}
        </div>
        <table className="w-full">
          <thead><tr>
            <th className="th w-24">Fecha</th>
            <th className="th w-24">Tipo</th>
            <th className="th">Concepto / Proyecto</th>
            <th className="th w-28">Cuadrilla</th>
            <th className="th w-28 text-right">Monto</th>
          </tr></thead>
          <tbody>
            {movFiltrados.length ? movFiltrados.slice(0, 30).map((m, i) => (
              <tr key={i}>
                <td className="td" style={{ fontSize: 11 }}>{m.fecha || '—'}</td>
                <td className="td">
                  <span className={`badge ${m.tipo === 'Ingreso' ? 'badge-green' : m.tipo === 'Gasto' ? 'badge-amber' : 'badge-red'}`}>{m.tipo}</span>
                </td>
                <td className="td truncate">{m.concepto}</td>
                <td className="td" style={{ fontSize: 12 }}>{m.cuadrilla || '—'}</td>
                <td className="td text-right font-medium" style={{ color: m.signo > 0 ? '#1A7A45' : '#A82020' }}>{m.signo > 0 ? '+' : '-'}{ig.fmt$(m.monto)}</td>
              </tr>
            )) : <tr><td colSpan={5} className="td text-center" style={{ color: '#A0AABB', padding: '2rem' }}>Sin movimientos en este período.</td></tr>}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Desglose por cuadrilla */}
        <div className="card">
          <div className="card-title">Desglose por cuadrilla</div>
          <table className="w-full">
            <thead><tr>
              <th className="th">Cuadrilla</th>
              <th className="th w-24 text-right">Ingreso</th>
              <th className="th w-24 text-right">Egreso</th>
              <th className="th w-24 text-right">Utilidad</th>
            </tr></thead>
            <tbody>
              {cuadrillasActivas.length ? cuadrillasActivas.map(cid => {
                const c = db.getCuadrilla(cid)
                const ing = ingresosFilt.filter(r => r.cuadrilla_id === cid).reduce((a, r) => a + Number(r.monto), 0)
                const nom = nominaFilt.filter(r => r.cuadrilla_id === cid).reduce((a, r) => a + Number(r.neto_pagar), 0)
                const gas = gastosFilt.filter(r => r.cuadrilla_id === cid).reduce((a, r) => a + Number(r.monto), 0)
                const util = ing - nom - gas
                return (
                  <tr key={cid}>
                    <td className="td font-medium">{c.nombre}</td>
                    <td className="td text-right" style={{ color: '#1A7A45' }}>{ig.fmt$(ing)}</td>
                    <td className="td text-right" style={{ color: '#A82020' }}>{ig.fmt$(nom + gas)}</td>
                    <td className="td text-right font-medium" style={{ color: util >= 0 ? '#0F3460' : '#A82020' }}>{ig.fmt$(util)}</td>
                  </tr>
                )
              }) : <tr><td colSpan={4} className="td text-center" style={{ color: '#A0AABB' }}>Sin datos</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Gastos por categoría */}
        <div className="card">
          <div className="card-title">Gastos por categoría</div>
          <table className="w-full">
            <thead><tr>
              <th className="th">Categoría</th>
              <th className="th w-24 text-right">Monto</th>
              <th className="th w-16 text-right">%</th>
            </tr></thead>
            <tbody>
              {catGastos.length ? catGastos.map(cat => {
                const subtotal = gastosFilt.filter(r => r.categoria === cat).reduce((a, r) => a + Number(r.monto), 0)
                const pct = totalGastos > 0 ? Math.round(subtotal / totalGastos * 100) : 0
                return (
                  <tr key={cat}>
                    <td className="td">{cat}</td>
                    <td className="td text-right" style={{ color: '#A82020' }}>{ig.fmt$(subtotal)}</td>
                    <td className="td text-right"><span className="badge badge-amber">{pct}%</span></td>
                  </tr>
                )
              }) : <tr><td colSpan={3} className="td text-center" style={{ color: '#A0AABB' }}>Sin gastos</td></tr>}
              {totalNomina > 0 && (
                <tr>
                  <td className="td">Nómina</td>
                  <td className="td text-right" style={{ color: '#A82020' }}>{ig.fmt$(totalNomina)}</td>
                  <td className="td text-right"><span className="badge badge-red">{totalGastos + totalNomina > 0 ? Math.round(totalNomina / (totalGastos + totalNomina) * 100) : 0}%</span></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
