import { useState } from 'react'
import { useDB } from '../hooks/useDB'
import { getInfoCortesCN, getPeriodoCN } from '../lib/fechas'
import { generarPDFCN } from '../lib/pdf'

export default function CorteCN() {
  const db = useDB()
  const hoy = new Date()
  const [params, setParams] = useState({ quincena: '1', mes: hoy.getMonth() + 1, anio: hoy.getFullYear() })
  const [calculado, setCalculado] = useState(false)
  const info = getInfoCortesCN()
  const setP = k => e => setParams(p => ({ ...p, [k]: e.target.value }))

  const mesStr = `${params.anio}-${String(params.mes).padStart(2, '0')}`
  const rows = db.registrosCN.filter(r => r.quincena === params.quincena && r.mes === mesStr)
  const total = rows.reduce((a, r) => a + Number(r.monto), 0)
  const periodoLabel = getPeriodoCN(params.quincena, parseInt(params.mes), parseInt(params.anio))
  const diaCobro = params.quincena === '1' ? 15 : new Date(params.anio, params.mes, 0).getDate()

  function generarPDF() {
    if (!rows.length) { alert('No hay registros CN para esta quincena.'); return }
    generarPDFCN({ rows, periodoLabel, diaCobro, getCuadrilla: db.getCuadrilla, getProyecto: db.getProyecto })
  }

  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const anioActual = hoy.getFullYear()

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div><h2 className="text-lg font-medium">Corte quincenal CN</h2><div className="text-xs text-gray-400">Casos de Negocio — días 15 y último de cada mes</div></div>
        <button className="btn btn-primary" onClick={generarPDF}>Generar PDF</button>
      </div>

      {info && (
        <div className={`text-sm px-4 py-3 rounded-lg mb-4 border ${
          info.tipo === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-700' :
          info.tipo === 'success' ? 'bg-green-50 border-green-200 text-green-700' :
          'bg-blue-50 border-blue-200 text-blue-700'
        }`}>{info.msg}</div>
      )}

      <div className="card mb-4">
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div><label className="label">Quincena</label>
            <select className="input" value={params.quincena} onChange={setP('quincena')}>
              <option value="1">Primera (1–15)</option>
              <option value="2">Segunda (16–fin)</option>
            </select>
          </div>
          <div><label className="label">Mes</label>
            <select className="input" value={params.mes} onChange={setP('mes')}>
              {meses.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div><label className="label">Año</label>
            <select className="input" value={params.anio} onChange={setP('anio')}>
              {[anioActual - 1, anioActual, anioActual + 1].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
        <button className="btn" onClick={() => setCalculado(true)}>Calcular quincena</button>
      </div>

      {calculado && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="metric"><div className="metric-label">Cuadrillas CN</div><div className="metric-value">{[...new Set(rows.map(r => r.cuadrilla_id))].length}</div></div>
            <div className="metric"><div className="metric-label">Registros</div><div className="metric-value">{rows.length}</div></div>
            <div className="metric"><div className="metric-label">Total quincena</div><div className="metric-value">{db.fmt$(total)}</div></div>
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead><tr>
                <th className="th w-36">Cuadrilla</th><th className="th">Proyecto</th>
                <th className="th w-28">Ciudad</th><th className="th w-36">Período</th>
                <th className="th w-24 text-right">Monto</th>
              </tr></thead>
              <tbody>
                {rows.length ? rows.map(r => {
                  const c = db.getCuadrilla(r.cuadrilla_id), p = db.getProyecto(r.proyecto_id)
                  return <tr key={r.id}><td className="td">{c.nombre}</td><td className="td">{p.nombre}</td><td className="td text-xs">{p.ciudad}</td><td className="td text-xs">{periodoLabel}</td><td className="td text-right font-medium">{db.fmt$(r.monto)}</td></tr>
                }) : <tr><td colSpan={5} className="td text-center text-gray-400 py-8">Sin registros CN para esta quincena.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
