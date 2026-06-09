import { useState, useMemo } from 'react'
import { useDB } from '../hooks/useDB'
import { getSemanas } from '../lib/fechas'

const COLORES = ['#378ADD','#1D9E75','#BA7517','#D85A30','#7F77DD','#D4537E','#639922','#E24B4A']

// Genera todas las semanas que existen en los datos de producción
function todasLasSemanas(produccion) {
  if (!produccion.length) return []
  const fechas = produccion.map(r => r.fecha).sort()
  const ini = new Date(fechas[0] + 'T12:00:00')
  const fin = new Date(fechas[fechas.length - 1] + 'T12:00:00')
  const sems = []
  // Encontrar el viernes anterior o igual a ini
  const dow = ini.getDay()
  const diasDesdeViernes = dow === 5 ? 0 : dow === 6 ? 1 : dow + 2
  const primerViernes = new Date(ini)
  primerViernes.setDate(ini.getDate() - diasDesdeViernes)
  let cur = new Date(primerViernes)
  while (cur <= fin) {
    const viernes = new Date(cur)
    const jueves = new Date(cur)
    jueves.setDate(cur.getDate() + 6)
    sems.push({
      ini: viernes.toISOString().split('T')[0],
      fin: jueves.toISOString().split('T')[0],
      label: viernes.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) + ' – ' + jueves.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: '2-digit' }),
    })
    cur.setDate(cur.getDate() + 7)
  }
  return sems
}

function deltaBadge(pct) {
  if (pct === null || isNaN(pct)) return <span className="text-xs text-gray-400">—</span>
  const color = pct >= 0 ? '#16a34a' : '#dc2626'
  const bg = pct >= 0 ? '#dcfce7' : '#fee2e2'
  const arrow = pct >= 0 ? '▲' : '▼'
  return (
    <span style={{ background: bg, color, fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 99 }}>
      {arrow} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

function MiniBar({ pct, color }) {
  const p = Math.min(Math.max(pct, 0), 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--tc-border)', borderRadius: 99 }}>
        <div style={{ width: `${p}%`, height: '100%', background: color || '#378ADD', borderRadius: 99, transition: 'width .3s' }} />
      </div>
      <span style={{ fontSize: 11, color: 'var(--tc-text-muted)', width: 34, textAlign: 'right' }}>{Math.round(p)}%</span>
    </div>
  )
}

export default function Rendimiento() {
  const db = useDB()
  const [periodoActual, setPeriodoActual] = useState('4') // '1','4','8','12' semanas
  const [refHistorico, setRefHistorico] = useState('todo') // 'todo','sem_ant','mes_ant','4sem','8sem'
  const [filtroCuad, setFiltroCuad] = useState('')
  const [filtroConc, setFiltroConc] = useState('')

  const fmt$ = db.fmt$
  const cuadsSem = db.cuadrillas.filter(c => c.esquema === 'Semanal' || c.esquema === 'Ambas')

  // Semanas del período actual (las más recientes)
  const semsActual = useMemo(() => getSemanas(Number(periodoActual)), [periodoActual])
  const iniActual = semsActual[0]?.ini
  const finActual = semsActual[semsActual.length - 1]?.fin

  // Todas las semanas históricas
  const todasSems = useMemo(() => todasLasSemanas(db.produccion), [db.produccion])

  // Semanas de referencia según el filtro
  const semsRef = useMemo(() => {
    if (!todasSems.length) return []
    // Excluir semanas que solapan con el período actual
    const semsAntes = todasSems.filter(s => s.fin < iniActual)
    if (!semsAntes.length) return []

    if (refHistorico === 'todo') return semsAntes
    if (refHistorico === 'sem_ant') return semsAntes.slice(-1)
    if (refHistorico === 'mes_ant') return semsAntes.slice(-4)
    if (refHistorico === '4sem') return semsAntes.slice(-4)
    if (refHistorico === '8sem') return semsAntes.slice(-8)
    return semsAntes
  }, [todasSems, iniActual, refHistorico])

  // Datos filtrados por cuadrilla y concepto
  const prodFiltrada = useMemo(() =>
    db.produccion.filter(r =>
      (!filtroCuad || r.cuadrilla_id === filtroCuad) &&
      (!filtroConc || r.concepto_id === filtroConc)
    ), [db.produccion, filtroCuad, filtroConc])

  // Total por semana (período actual)
  const datosActual = useMemo(() =>
    semsActual.map(s => {
      const rows = prodFiltrada.filter(r => r.fecha >= s.ini && r.fecha <= s.fin)
      const diasUnicos = new Set(rows.map(r => r.fecha)).size
      const total = rows.reduce((a, r) => a + Number(r.total), 0)
      return { ...s, total, dias: diasUnicos, promDia: diasUnicos ? total / diasUnicos : 0, regs: rows.length }
    }), [semsActual, prodFiltrada])

  // Promedios históricos de referencia
  const histRef = useMemo(() => {
    if (!semsRef.length) return { promSemanal: 0, promDiario: 0, totalSems: 0 }
    const datos = semsRef.map(s => {
      const rows = prodFiltrada.filter(r => r.fecha >= s.ini && r.fecha <= s.fin)
      const dias = new Set(rows.map(r => r.fecha)).size
      const total = rows.reduce((a, r) => a + Number(r.total), 0)
      return { total, dias }
    }).filter(d => d.total > 0) // excluir semanas vacías
    if (!datos.length) return { promSemanal: 0, promDiario: 0, totalSems: 0 }
    const promSemanal = datos.reduce((a, d) => a + d.total, 0) / datos.length
    const totalDias = datos.reduce((a, d) => a + d.dias, 0)
    const totalPesos = datos.reduce((a, d) => a + d.total, 0)
    const promDiario = totalDias ? totalPesos / totalDias : 0
    return { promSemanal, promDiario, totalSems: datos.length }
  }, [semsRef, prodFiltrada])

  // KPIs generales del período actual
  const totalActual = datosActual.reduce((a, d) => a + d.total, 0)
  const semsConDatos = datosActual.filter(d => d.total > 0)
  const promActual = semsConDatos.length ? totalActual / semsConDatos.length : 0
  const deltaProm = histRef.promSemanal ? ((promActual - histRef.promSemanal) / histRef.promSemanal) * 100 : null
  const maxSem = datosActual.reduce((a, d) => d.total > a.total ? d : a, { total: 0, label: '—' })
  const minSem = semsConDatos.length ? semsConDatos.reduce((a, d) => d.total < a.total ? d : a, semsConDatos[0]) : null

  // Tendencia: compara últimas 2 semanas con datos
  const ultimas2 = semsConDatos.slice(-2)
  const tendencia = ultimas2.length === 2
    ? ((ultimas2[1].total - ultimas2[0].total) / ultimas2[0].total) * 100
    : null

  // Rendimiento por cuadrilla
  const rendCuadrilla = useMemo(() => {
    const cuads = filtroCuad ? cuadsSem.filter(c => c.id === filtroCuad) : cuadsSem
    return cuads.map((c, i) => {
      const rowsAct = db.produccion.filter(r =>
        r.cuadrilla_id === c.id && r.fecha >= iniActual && r.fecha <= finActual &&
        (!filtroConc || r.concepto_id === filtroConc)
      )
      const totalAct = rowsAct.reduce((a, r) => a + Number(r.total), 0)
      const diasAct = new Set(rowsAct.map(r => r.fecha)).size

      // histórico de referencia para esta cuadrilla
      const rowsHist = semsRef.flatMap(s =>
        db.produccion.filter(r =>
          r.cuadrilla_id === c.id && r.fecha >= s.ini && r.fecha <= s.fin &&
          (!filtroConc || r.concepto_id === filtroConc)
        )
      )
      const semsHistConDatos = semsRef.filter(s => {
        const t = rowsHist.filter(r => r.fecha >= s.ini && r.fecha <= s.fin).reduce((a, r) => a + Number(r.total), 0)
        return t > 0
      })
      const totalHist = rowsHist.reduce((a, r) => a + Number(r.total), 0)
      const promHistSem = semsHistConDatos.length ? totalHist / semsHistConDatos.length : 0
      const promActSem = semsConDatos.length ? totalAct / semsConDatos.length : 0
      const delta = promHistSem ? ((promActSem - promHistSem) / promHistSem) * 100 : null

      return { id: c.id, nombre: c.nombre, color: COLORES[i % COLORES.length], totalAct, dias: diasAct, promActSem, promHistSem, delta }
    }).filter(r => r.totalAct > 0 || semsRef.length > 0)
      .sort((a, b) => b.totalAct - a.totalAct)
  }, [db.produccion, cuadsSem, iniActual, finActual, semsRef, filtroCuad, filtroConc, semsConDatos.length])

  const totalCuads = rendCuadrilla.reduce((a, r) => a + r.totalAct, 0) || 1

  // Rendimiento por concepto
  const rendConcepto = useMemo(() => {
    const concs = filtroConc ? db.conceptos.filter(c => c.id === filtroConc) : db.conceptos
    return concs.map(c => {
      const rowsAct = db.produccion.filter(r =>
        r.concepto_id === c.id && r.fecha >= iniActual && r.fecha <= finActual &&
        (!filtroCuad || r.cuadrilla_id === filtroCuad)
      )
      if (!rowsAct.length) return null
      const totalAct = rowsAct.reduce((a, r) => a + Number(r.total), 0)
      const cantAct = rowsAct.reduce((a, r) => a + Number(r.cantidad), 0)
      const promUnitAct = cantAct ? totalAct / cantAct : 0

      const rowsHist = semsRef.flatMap(s =>
        db.produccion.filter(r =>
          r.concepto_id === c.id && r.fecha >= s.ini && r.fecha <= s.fin &&
          (!filtroCuad || r.cuadrilla_id === filtroCuad)
        )
      )
      const semsHistConDatos = semsRef.filter(s => {
        const t = rowsHist.filter(r => r.fecha >= s.ini && r.fecha <= s.fin).reduce((a, r) => a + Number(r.total), 0)
        return t > 0
      })
      const totalHist = rowsHist.reduce((a, r) => a + Number(r.total), 0)
      const promHistSem = semsHistConDatos.length ? totalHist / semsHistConDatos.length : 0
      const promActSem = semsConDatos.length ? totalAct / semsConDatos.length : 0
      const delta = promHistSem ? ((promActSem - promHistSem) / promHistSem) * 100 : null

      return { id: c.id, nombre: c.nombre, unidad: c.unidad, totalAct, cantAct, promUnitAct, promActSem, promHistSem, delta }
    }).filter(Boolean).sort((a, b) => b.totalAct - a.totalAct)
  }, [db.produccion, db.conceptos, iniActual, finActual, semsRef, filtroCuad, filtroConc, semsConDatos.length])

  const totalConcs = rendConcepto.reduce((a, r) => a + r.totalAct, 0) || 1

  if (db.loading) return <div className="text-gray-400 py-12 text-center">Cargando...</div>

  const labelTendencia = tendencia === null ? null : tendencia >= 0
    ? <span style={{ color: '#16a34a', fontWeight: 700 }}>▲ Al alza {tendencia.toFixed(1)}% vs sem anterior</span>
    : <span style={{ color: '#dc2626', fontWeight: 700 }}>▼ A la baja {Math.abs(tendencia).toFixed(1)}% vs sem anterior</span>

  const labelRef = {
    todo: `todo el historial (${histRef.totalSems} sem)`,
    sem_ant: 'semana anterior',
    mes_ant: 'últimas 4 sem (mes)',
    '4sem': 'últimas 4 semanas',
    '8sem': 'últimas 8 semanas',
  }[refHistorico]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-medium">Rendimiento</h2>
          <div className="text-xs text-gray-400">Análisis de tendencia vs histórico</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card mb-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Filtros</div>
        <div className="flex flex-wrap gap-3">
          {/* Período actual */}
          <div>
            <div className="text-xs text-gray-400 mb-1">Período a analizar</div>
            <div className="flex gap-1">
              {[['1','1 sem'],['4','4 sem'],['8','8 sem'],['12','12 sem']].map(([v, l]) => (
                <button key={v} onClick={() => setPeriodoActual(v)}
                  className={`btn btn-sm ${periodoActual === v ? 'btn-primary' : ''}`}>{l}</button>
              ))}
            </div>
          </div>
          {/* Referencia histórica */}
          <div>
            <div className="text-xs text-gray-400 mb-1">Comparar contra</div>
            <select className="input text-xs py-1" value={refHistorico} onChange={e => setRefHistorico(e.target.value)}>
              <option value="todo">Todo el historial</option>
              <option value="sem_ant">Semana anterior</option>
              <option value="mes_ant">Mes anterior (4 sem)</option>
              <option value="4sem">Últimas 4 semanas</option>
              <option value="8sem">Últimas 8 semanas</option>
            </select>
          </div>
          {/* Cuadrilla */}
          <div>
            <div className="text-xs text-gray-400 mb-1">Cuadrilla</div>
            <select className="input text-xs py-1 w-44" value={filtroCuad} onChange={e => setFiltroCuad(e.target.value)}>
              <option value="">Todas</option>
              {cuadsSem.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          {/* Concepto */}
          <div>
            <div className="text-xs text-gray-400 mb-1">Concepto</div>
            <select className="input text-xs py-1 w-44" value={filtroConc} onChange={e => setFiltroConc(e.target.value)}>
              <option value="">Todos</option>
              {db.conceptos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
        </div>
        {semsRef.length > 0 && (
          <div className="text-xs text-gray-400 mt-2">
            Referencia: <span className="font-medium" style={{ color: 'var(--tc-text)' }}>{labelRef}</span>
            {' · '}Promedio histórico semanal: <span className="font-medium" style={{ color: 'var(--tc-text)' }}>{fmt$(histRef.promSemanal)}</span>
            {' · '}Promedio histórico diario: <span className="font-medium" style={{ color: 'var(--tc-text)' }}>{fmt$(histRef.promDiario)}</span>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="metric">
          <div className="metric-label">Tendencia</div>
          <div className="metric-value" style={{ fontSize: 16 }}>{labelTendencia ?? <span className="text-gray-400 text-sm">Sin datos suficientes</span>}</div>
          <div className="metric-sub">Últimas 2 semanas con producción</div>
        </div>
        <div className="metric">
          <div className="metric-label">Promedio semanal actual</div>
          <div className="metric-value">{fmt$(promActual)}</div>
          <div className="metric-sub flex items-center gap-1">
            vs histórico {deltaBadge(deltaProm)}
          </div>
        </div>
        <div className="metric">
          <div className="metric-label">Mejor semana del período</div>
          <div className="metric-value">{fmt$(maxSem.total)}</div>
          <div className="metric-sub">{maxSem.label}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Semana más baja</div>
          <div className="metric-value">{minSem ? fmt$(minSem.total) : '—'}</div>
          <div className="metric-sub">{minSem?.label ?? '—'}</div>
        </div>
      </div>

      {/* Tabla semana a semana */}
      <div className="card mb-4">
        <div className="text-sm font-medium mb-3">Detalle semanal vs referencia histórica</div>
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Semana</th>
              <th className="th text-right">Días activos</th>
              <th className="th text-right">Total</th>
              <th className="th text-right">Prom. diario</th>
              <th className="th text-right">Ref. histórica</th>
              <th className="th text-right">Δ vs histórico</th>
            </tr>
          </thead>
          <tbody>
            {datosActual.map((d, i) => {
              const delta = histRef.promSemanal ? ((d.total - histRef.promSemanal) / histRef.promSemanal) * 100 : null
              return (
                <tr key={i}>
                  <td className="td text-xs">{d.label}</td>
                  <td className="td text-right">{d.dias || <span className="text-gray-400">—</span>}</td>
                  <td className="td text-right font-medium">{d.total ? fmt$(d.total) : <span className="text-gray-400">—</span>}</td>
                  <td className="td text-right text-xs">{d.promDia ? fmt$(d.promDia) : <span className="text-gray-400">—</span>}</td>
                  <td className="td text-right text-xs text-gray-400">{histRef.promSemanal ? fmt$(histRef.promSemanal) : '—'}</td>
                  <td className="td text-right">{d.total ? deltaBadge(delta) : <span className="text-xs text-gray-400">Sin datos</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Rendimiento por cuadrilla */}
      <div className="card mb-4">
        <div className="text-sm font-medium mb-3">Rendimiento por cuadrilla</div>
        {rendCuadrilla.length === 0
          ? <div className="text-gray-400 text-sm py-4 text-center">Sin datos en el período.</div>
          : <table className="w-full">
            <thead>
              <tr>
                <th className="th">Cuadrilla</th>
                <th className="th text-right">Total período</th>
                <th className="th text-right">Prom. semanal</th>
                <th className="th text-right">Ref. histórica</th>
                <th className="th text-right">Δ</th>
                <th className="th">% del total</th>
              </tr>
            </thead>
            <tbody>
              {rendCuadrilla.map(r => (
                <tr key={r.id}>
                  <td className="td">
                    <span className="w-2 h-2 rounded-full inline-block mr-2" style={{ background: r.color }} />
                    {r.nombre}
                  </td>
                  <td className="td text-right font-medium">{fmt$(r.totalAct)}</td>
                  <td className="td text-right text-xs">{fmt$(r.promActSem)}</td>
                  <td className="td text-right text-xs text-gray-400">{r.promHistSem ? fmt$(r.promHistSem) : '—'}</td>
                  <td className="td text-right">{deltaBadge(r.delta)}</td>
                  <td className="td" style={{ minWidth: 120 }}>
                    <MiniBar pct={(r.totalAct / totalCuads) * 100} color={r.color} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      </div>

      {/* Rendimiento por concepto */}
      <div className="card">
        <div className="text-sm font-medium mb-3">Rendimiento por concepto</div>
        {rendConcepto.length === 0
          ? <div className="text-gray-400 text-sm py-4 text-center">Sin datos en el período.</div>
          : <table className="w-full">
            <thead>
              <tr>
                <th className="th">Concepto</th>
                <th className="th text-right">Cantidad</th>
                <th className="th text-right">Total período</th>
                <th className="th text-right">Prom. unit.</th>
                <th className="th text-right">Prom. sem.</th>
                <th className="th text-right">Ref. histórica</th>
                <th className="th text-right">Δ</th>
                <th className="th">% del total</th>
              </tr>
            </thead>
            <tbody>
              {rendConcepto.map((r, i) => (
                <tr key={r.id}>
                  <td className="td text-xs">{r.nombre}</td>
                  <td className="td text-right text-xs">{Number(r.cantAct).toLocaleString('es-MX', { maximumFractionDigits: 1 })} {r.unidad}</td>
                  <td className="td text-right font-medium">{fmt$(r.totalAct)}</td>
                  <td className="td text-right text-xs">{fmt$(r.promUnitAct)}</td>
                  <td className="td text-right text-xs">{fmt$(r.promActSem)}</td>
                  <td className="td text-right text-xs text-gray-400">{r.promHistSem ? fmt$(r.promHistSem) : '—'}</td>
                  <td className="td text-right">{deltaBadge(r.delta)}</td>
                  <td className="td" style={{ minWidth: 120 }}>
                    <MiniBar pct={(r.totalAct / totalConcs) * 100} color={COLORES[i % COLORES.length]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      </div>
    </div>
  )
}
