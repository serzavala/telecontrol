import { useState } from 'react'
import { useDB } from '../hooks/useDB'
import { generarPDFSemanal } from '../lib/pdf'

export default function CorteSemanal() {
  const db = useDB()
  const [filtros, setFiltros] = useState({ inicio: '', fin: '', proyecto_id: '' })
  const [calculado, setCalculado] = useState(false)
  const [saving, setSaving] = useState(false)
  const setF = k => e => setFiltros(f => ({ ...f, [k]: e.target.value }))

  const rows = db.produccion.filter(r => {
    const enPeriodo = (!filtros.inicio || !filtros.fin) || (r.fecha >= filtros.inicio && r.fecha <= filtros.fin)
    const enProy = !filtros.proyecto_id || r.proyecto_id === filtros.proyecto_id
    return enPeriodo && enProy
  })

  const total = rows.reduce((a, r) => a + Number(r.total), 0)
  const cuadsUniq = [...new Set(rows.map(r => r.cuadrilla_id))]

  async function guardarCorte() {
    if (!filtros.inicio || !filtros.fin) { alert('Selecciona el período primero.'); return }
    if (!rows.length) { alert('No hay registros en ese período.'); return }
    const proy = filtros.proyecto_id ? db.getProyecto(filtros.proyecto_id).nombre : 'Todos'
    const periodo = `${filtros.inicio} al ${filtros.fin}`
    const yaExiste = db.cortes.find(c => c.tipo === 'Semanal' && c.periodo === periodo && c.proyecto_nombre === proy)
    if (yaExiste) { alert('Ya existe un corte guardado para este período.'); return }
    setSaving(true)
    await db.addCorte({ tipo: 'Semanal', periodo, proyecto_nombre: proy, proyecto_id: filtros.proyecto_id || null, total, estado_pago: 'Pendiente', fecha_corte: new Date().toISOString().split('T')[0] })
    setSaving(false)
    alert('Corte guardado. Visible en Historial de cortes.')
  }

  function generarPDF() {
    if (!rows.length) { alert('No hay registros para generar el PDF.'); return }
    const periodo = filtros.inicio && filtros.fin ? `${filtros.inicio} al ${filtros.fin}` : 'Todo el período'
    generarPDFSemanal({ rows, periodo, getCuadrilla: db.getCuadrilla, getProyecto: db.getProyecto, getConcepto: db.getConcepto })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div><h2 className="text-lg font-medium">Corte semanal</h2><div className="text-xs text-gray-400">Pago Izzi-Monstel 2026</div></div>
        <button className="btn btn-primary" onClick={generarPDF}>Generar PDF</button>
      </div>

      <div className="card mb-4">
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div><label className="label">Inicio del período</label><input className="input" type="date" value={filtros.inicio} onChange={setF('inicio')} /></div>
          <div><label className="label">Fin del período</label><input className="input" type="date" value={filtros.fin} onChange={setF('fin')} /></div>
          <div><label className="label">Proyecto</label>
            <select className="input" value={filtros.proyecto_id} onChange={setF('proyecto_id')}>
              <option value="">Todos</option>
              {db.proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={() => setCalculado(true)}>Calcular corte</button>
          <button className="btn btn-success" onClick={guardarCorte} disabled={saving}>{saving ? 'Guardando...' : 'Guardar corte'}</button>
        </div>
      </div>

      {calculado && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="metric"><div className="metric-label">Registros</div><div className="metric-value">{rows.length}</div></div>
            <div className="metric"><div className="metric-label">Cuadrillas</div><div className="metric-value">{cuadsUniq.length}</div></div>
            <div className="metric"><div className="metric-label">Total a cobrar</div><div className="metric-value">{db.fmt$(total)}</div></div>
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead><tr>
                <th className="th w-24">Fecha</th><th className="th w-32">Cuadrilla</th>
                <th className="th">Concepto</th><th className="th w-28">Proyecto</th>
                <th className="th w-24">Cantidad</th><th className="th w-20 text-right">P.Unit.</th>
                <th className="th w-20 text-right">Total</th>
              </tr></thead>
              <tbody>
                {rows.length ? rows.map(r => {
                  const c = db.getCuadrilla(r.cuadrilla_id), p = db.getProyecto(r.proyecto_id), cn = db.getConcepto(r.concepto_id)
                  return <tr key={r.id}><td className="td text-xs">{r.fecha}</td><td className="td truncate">{c.nombre}</td><td className="td text-xs">{cn.nombre}</td><td className="td text-xs truncate">{p.nombre}</td><td className="td text-xs">{Number(r.cantidad).toLocaleString('es-MX')} {cn.unidad?.split(' ')[0]}</td><td className="td text-right">{db.fmt$(r.precio_unitario)}</td><td className="td text-right font-medium">{db.fmt$(r.total)}</td></tr>
                }) : <tr><td colSpan={7} className="td text-center text-gray-400 py-8">Sin registros en ese período.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
