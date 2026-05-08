import { useState } from 'react'
import { useDB } from '../hooks/useDB'
import { getSemana, fmtSemanaLabel, getSemanaISO, getOffsetDesdeSemana } from '../lib/fechas'
import Modal from '../components/Modal'

export default function Produccion() {
  const db = useDB()
  const [offset, setOffset] = useState(0)
  const [inputSemana, setInputSemana] = useState('')
  const [filtros, setFiltros] = useState({ cuadrilla: '', proyecto: '', concepto: '' })
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ fecha: '', cuadrilla_id: '', concepto_id: '', proyecto_id: '', cantidad: '', precio_unitario: '', notas: '' })
  const [saving, setSaving] = useState(false)

  const sem = getSemana(offset)
  const numSemana = getSemanaISO(sem.fin) // semana ISO del jueves de corte
  const cuadsSem = db.cuadrillas.filter(c => c.esquema === 'Semanal' || c.esquema === 'Ambas')
  const proysSem = db.proyectos.filter(p => p.tipo === 'Semanal')

  const rows = db.produccion
    .filter(r =>
      r.fecha >= sem.ini && r.fecha <= sem.fin &&
      (!filtros.cuadrilla || r.cuadrilla_id === filtros.cuadrilla) &&
      (!filtros.proyecto || r.proyecto_id === filtros.proyecto) &&
      (!filtros.concepto || r.concepto_id === filtros.concepto)
    )
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  const total = rows.reduce((a, r) => a + Number(r.total), 0)

  function setF(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })) }

  function handleConcSelect(e) {
    const id = e.target.value
    const conc = db.conceptos.find(c => c.id === id)
    setForm(f => ({ ...f, concepto_id: id, precio_unitario: conc ? conc.precio : '' }))
  }

  function handleIrASemana(e) {
    e.preventDefault()
    const num = parseInt(inputSemana)
    if (!num || num < 1 || num > 53) return
    setOffset(getOffsetDesdeSemana(num))
    setInputSemana('')
  }

  const totalCalc = (parseFloat(form.cantidad) || 0) * (parseFloat(form.precio_unitario) || 0)

  async function handleSave(e) {
    e.preventDefault()
    if (!form.fecha || !form.cuadrilla_id || !form.concepto_id || !form.proyecto_id || !form.cantidad || !form.precio_unitario) return
    setSaving(true)
    await db.addProduccion({
      fecha: form.fecha,
      cuadrilla_id: form.cuadrilla_id,
      concepto_id: form.concepto_id,
      proyecto_id: form.proyecto_id,
      cantidad: parseFloat(form.cantidad),
      precio_unitario: parseFloat(form.precio_unitario),
      total: totalCalc,
      notas: form.notas,
    })
    setSaving(false)
    setModal(false)
    setForm({ fecha: '', cuadrilla_id: '', concepto_id: '', proyecto_id: '', cantidad: '', precio_unitario: '', notas: '' })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-medium">Producción semanal</h2>
          <div className="text-xs text-gray-400">Registro diario de avances</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Nuevo avance</button>
      </div>

      {/* Navegador de semana */}
      <div className="card mb-4">
        <div className="flex items-center gap-3 mb-3">
          <button className="btn btn-sm" onClick={() => setOffset(o => o - 1)}>← Anterior</button>
          <div className="flex-1 text-center">
            <span className="font-medium text-sm">{fmtSemanaLabel(sem)}</span>
            <span className="ml-2 text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              Semana {numSemana}
            </span>
          </div>
          <button className="btn btn-sm" onClick={() => setOffset(o => o + 1)}>Siguiente →</button>
          <button className="btn btn-sm text-gray-400" onClick={() => setOffset(0)}>Hoy</button>
        </div>

        {/* Ir a semana por número */}
        <form onSubmit={handleIrASemana} className="flex items-center gap-2 mb-3">
          <label className="label mb-0 whitespace-nowrap text-xs">Ir a semana:</label>
          <input
            className="input w-20 text-center"
            type="number"
            min="1"
            max="53"
            placeholder="# sem"
            value={inputSemana}
            onChange={e => setInputSemana(e.target.value)}
          />
          <button type="submit" className="btn btn-sm">Ir</button>
        </form>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Cuadrilla</label>
            <select className="input" value={filtros.cuadrilla} onChange={e => setFiltros(f => ({ ...f, cuadrilla: e.target.value }))}>
              <option value="">Todas</option>
              {db.cuadrillas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Proyecto</label>
            <select className="input" value={filtros.proyecto} onChange={e => setFiltros(f => ({ ...f, proyecto: e.target.value }))}>
              <option value="">Todos</option>
              {db.proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Concepto</label>
            <select className="input" value={filtros.concepto} onChange={e => setFiltros(f => ({ ...f, concepto: e.target.value }))}>
              <option value="">Todos</option>
              {db.conceptos.map(c => <option key={c.id} value={c.id}>{c.num}. {c.nombre}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="metric"><div className="metric-label">Registros</div><div className="metric-value">{rows.length}</div></div>
        <div className="metric"><div className="metric-label">Cuadrillas activas</div><div className="metric-value">{[...new Set(rows.map(r => r.cuadrilla_id))].length}</div></div>
        <div className="metric"><div className="metric-label">Total semana</div><div className="metric-value">{db.fmt$(total)}</div></div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th w-24">Fecha</th>
              <th className="th w-32">Cuadrilla</th>
              <th className="th">Concepto</th>
              <th className="th w-28">Proyecto</th>
              <th className="th w-24">Cantidad</th>
              <th className="th w-20 text-right">Total</th>
              <th className="th w-16"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map(r => {
              const c = db.getCuadrilla(r.cuadrilla_id)
              const p = db.getProyecto(r.proyecto_id)
              const cn = db.getConcepto(r.concepto_id)
              return (
                <tr key={r.id}>
                  <td className="td text-xs">{r.fecha}</td>
                  <td className="td truncate">{c.nombre}</td>
                  <td className="td"><span className="inline-block text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded mr-1">{cn.num}</span>{cn.nombre}</td>
                  <td className="td truncate text-xs">{p.nombre}</td>
                  <td className="td text-xs">{Number(r.cantidad).toLocaleString('es-MX')} {cn.unidad?.split(' ')[0]}</td>
                  <td className="td text-right">{db.fmt$(r.total)}</td>
                  <td className="td"><button className="btn btn-sm" onClick={() => db.deleteProduccion(r.id)}>Eliminar</button></td>
                </tr>
              )
            }) : (
              <tr><td colSpan={7} className="td text-center text-gray-400 py-10">Sin registros esta semana.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo avance de producción">
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Fecha</label><input className="input" type="date" value={form.fecha} onChange={setF('fecha')} required /></div>
            <div><label className="label">Cuadrilla</label>
              <select className="input" value={form.cuadrilla_id} onChange={setF('cuadrilla_id')} required>
                <option value="">Seleccionar...</option>
                {cuadsSem.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Concepto</label>
              <select className="input" value={form.concepto_id} onChange={handleConcSelect} required>
                <option value="">Seleccionar...</option>
                {db.conceptos.map(c => <option key={c.id} value={c.id}>{c.num}. {c.nombre} — {db.fmt$(c.precio)}</option>)}
              </select>
            </div>
            <div><label className="label">Proyecto</label>
              <select className="input" value={form.proyecto_id} onChange={setF('proyecto_id')} required>
                <option value="">Seleccionar...</option>
                {proysSem.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Cantidad</label><input className="input" type="number" min="0" step="1" value={form.cantidad} onChange={setF('cantidad')} required /></div>
            <div><label className="label">Precio unitario</label><input className="input" type="number" min="0" step="0.01" value={form.precio_unitario} onChange={setF('precio_unitario')} required /></div>
          </div>
          <div><label className="label">Total calculado</label><input className="input bg-gray-50" readOnly value={totalCalc > 0 ? db.fmt$(totalCalc) : ''} /></div>
          <div><label className="label">Notas</label><textarea className="input" rows={2} value={form.notas} onChange={setF('notas')} /></div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
