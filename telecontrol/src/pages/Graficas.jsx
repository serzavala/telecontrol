import { useState, useEffect, useRef } from 'react'
import { Chart, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import { useDB } from '../hooks/useDB'
import { getSemanas } from '../lib/fechas'

Chart.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const COLORES = ['#378ADD','#1D9E75','#BA7517','#D85A30','#7F77DD','#D4537E','#639922','#E24B4A']

export default function Graficas() {
  const db = useDB()
  const [n, setN] = useState(4)
  const [cuadFiltro, setCuadFiltro] = useState('')
  const chartSemRef = useRef(null)
  const chartCuadRef = useRef(null)
  const chartSemInst = useRef(null)
  const chartCuadInst = useRef(null)

  const sems = getSemanas(n)
  const cuadsSem = db.cuadrillas.filter(c => c.esquema === 'Semanal' || c.esquema === 'Ambas')
  const cuadsVis = cuadFiltro ? cuadsSem.filter(c => c.id === cuadFiltro) : cuadsSem

  const totalesPorSemana = sems.map(s =>
    db.produccion
      .filter(r => r.fecha >= s.ini && r.fecha <= s.fin && (!cuadFiltro || r.cuadrilla_id === cuadFiltro))
      .reduce((a, r) => a + Number(r.total), 0)
  )

  const granTotal = totalesPorSemana.reduce((a, v) => a + v, 0)
  const maxVal = Math.max(...totalesPorSemana, 0)
  const maxIdx = totalesPorSemana.indexOf(maxVal)
  const promedio = granTotal / n

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const textColor = isDark ? '#9c9a92' : '#73726c'

  useEffect(() => {
    if (!chartSemRef.current) return
    if (chartSemInst.current) chartSemInst.current.destroy()
    chartSemInst.current = new Chart(chartSemRef.current, {
      type: 'bar',
      data: {
        labels: sems.map(s => s.label),
        datasets: [{
          data: totalesPorSemana,
          backgroundColor: totalesPorSemana.map((_, i) => i === maxIdx ? '#1D9E75' : '#378ADD'),
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => '$' + Number(ctx.raw).toLocaleString('es-MX') } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: textColor, font: { size: 11 } } },
          y: { grid: { color: gridColor }, border: { display: false }, ticks: { color: textColor, font: { size: 11 }, callback: v => '$' + Number(v).toLocaleString('es-MX') } }
        }
      }
    })
  }, [n, cuadFiltro, db.produccion.length])

  useEffect(() => {
    if (!chartCuadRef.current) return
    if (chartCuadInst.current) chartCuadInst.current.destroy()
    const datasets = cuadsVis.map((c, i) => ({
      label: c.nombre,
      data: sems.map(s => db.produccion.filter(r => r.cuadrilla_id === c.id && r.fecha >= s.ini && r.fecha <= s.fin).reduce((a, r) => a + Number(r.total), 0)),
      backgroundColor: COLORES[i % COLORES.length],
      borderRadius: 4,
      borderSkipped: false,
    }))
    chartCuadInst.current = new Chart(chartCuadRef.current, {
      type: 'bar',
      data: { labels: sems.map(s => s.label), datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': $' + Number(ctx.raw).toLocaleString('es-MX') } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: textColor, font: { size: 11 } } },
          y: { grid: { color: gridColor }, border: { display: false }, ticks: { color: textColor, font: { size: 11 }, callback: v => '$' + Number(v).toLocaleString('es-MX') } }
        }
      }
    })
  }, [n, cuadFiltro, db.produccion.length])

  const fmt$ = db.fmt$

  // Tabla resumen por cuadrilla
  const periodoInicio = sems[0]?.ini
  const periodoFin = sems[sems.length - 1]?.fin
  const resumen = cuadsVis.map((c, i) => {
    const rows = db.produccion.filter(r => r.cuadrilla_id === c.id && r.fecha >= periodoInicio && r.fecha <= periodoFin)
    const tot = rows.reduce((a, r) => a + Number(r.total), 0)
    return { cuad: c.nombre, regs: rows.length, tot, color: COLORES[i % COLORES.length] }
  }).sort((a, b) => b.tot - a.tot)
  const totalGlobal = resumen.reduce((a, r) => a + r.tot, 0) || 1

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div><h2 className="text-lg font-medium">Gráficas de producción</h2><div className="text-xs text-gray-400">Análisis visual por semana</div></div>
      </div>

      {/* Selector de período */}
      <div className="flex gap-2 mb-4">
        {[4, 8, 12].map(v => (
          <button key={v} onClick={() => setN(v)} className={`btn btn-sm ${n === v ? 'btn-primary' : ''}`}>{v} semanas</button>
        ))}
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="metric"><div className="metric-label">Total período</div><div className="metric-value">{fmt$(granTotal)}</div><div className="metric-sub">Últimas {n} semanas</div></div>
        <div className="metric"><div className="metric-label">Mejor semana</div><div className="metric-value">{fmt$(maxVal)}</div><div className="metric-sub">{maxIdx >= 0 ? sems[maxIdx]?.label : '—'}</div></div>
        <div className="metric"><div className="metric-label">Promedio semanal</div><div className="metric-value">{fmt$(promedio)}</div><div className="metric-sub">Por semana</div></div>
      </div>

      {/* Gráfica 1 */}
      <div className="card mb-4">
        <div className="text-sm font-medium mb-3">Total de producción por semana</div>
        <div className="h-56"><canvas ref={chartSemRef} /></div>
      </div>

      {/* Gráfica 2 */}
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Comparativa por cuadrilla</span>
          <select className="input w-44 text-xs py-1" value={cuadFiltro} onChange={e => setCuadFiltro(e.target.value)}>
            <option value="">Todas las cuadrillas</option>
            {cuadsSem.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="h-56"><canvas ref={chartCuadRef} /></div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
          {cuadsVis.map((c, i) => (
            <div key={c.id} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ background: COLORES[i % COLORES.length] }} />
              {c.nombre}
            </div>
          ))}
        </div>
      </div>

      {/* Tabla resumen */}
      <div className="card">
        <div className="text-sm font-medium mb-3">Resumen por cuadrilla en el período</div>
        <table className="w-full">
          <thead><tr>
            <th className="th">Cuadrilla</th>
            <th className="th w-20 text-right">Registros</th>
            <th className="th w-28 text-right">Total</th>
            <th className="th w-40">% del total</th>
          </tr></thead>
          <tbody>
            {resumen.length ? resumen.map(r => {
              const pct = Math.round(r.tot / totalGlobal * 100)
              return (
                <tr key={r.cuad}>
                  <td className="td">
                    <span className="w-2 h-2 rounded-full inline-block mr-2" style={{ background: r.color }} />
                    {r.cuad}
                  </td>
                  <td className="td text-right">{r.regs}</td>
                  <td className="td text-right">{fmt$(r.tot)}</td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.color }} />
                      </div>
                      <span className="text-xs text-gray-400 w-7 text-right">{pct}%</span>
                    </div>
                  </td>
                </tr>
              )
            }) : <tr><td colSpan={4} className="td text-center text-gray-400 py-8">Sin datos en el período.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
