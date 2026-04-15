import { useState } from 'react'
import { useIG } from '../hooks/useIG'
import { useDB } from '../hooks/useDB'
import Modal from '../components/Modal'

export default function Ingresos() {
  const ig = useIG()
  const db = useDB()
  const hoy = new Date()
  const [filtros, setFiltros] = useState({ semana: '', anio: hoy.getFullYear(), cuadrilla_id: '', proyecto_id: '' })
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ semana: '', anio: hoy.getFullYear(), cuadrilla_id: '', proyecto_id: '', cliente: '', fecha: '', monto: '', observaciones: '' })
  const [saving, setSaving] = useState(false)
  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const setFilt = k => e => setFiltros(f => ({ ...f, [k]: e.target.value }))

  const rows = ig.ingresos.filter(r =>
    (!filtros.semana || r.semana == filtros.semana) &&
    (!filtros.anio || r.anio == filtros.anio) &&
    (!filtros.cuadrilla_id || r.cuadrilla_id === filtros.cuadrilla_id) &&
    (!filtros.proyecto_id || r.proyecto_id === filtros.proyecto_id)
  )
  const total = rows.reduce((a, r) => a + Number(r.monto), 0)

  async function handleSave(e) {
    e.preventDefault()
    if (!form.fecha || !form.monto || !form.semana) { alert('Completa los campos obligatorios.'); return }
    setSaving(true)
    await ig.addIngreso({ ...form, semana: parseInt(form.semana), anio: parseInt(form.anio), monto: parseFloat(form.monto), cuadrilla_id: form.cuadrilla_id || null, proyecto_id: form.proyecto_id || null })
    setSaving(false)
    setModal(false)
    setForm({ semana: '', anio: hoy.getFullYear(), cuadrilla_id: '', proyecto_id: '', cliente: '', fecha: '', monto: '', observaciones: '' })
  }

  return (
    <div>
      <div className="page-header">
        <div><h2>Ingresos</h2><div className="page-header-sub">Registro de ingresos por semana y cuadrilla</div></div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Nuevo ingreso</button>
      </div>

      <div className="card mb-4">
        <div className="form-row c4" style={{ marginBottom: 0 }}>
          <div><label className="label">Semana</label><input className="input" type="number" placeholder="Todas" value={filtros.semana} onChange={setFilt('semana')} /></div>
          <div><label className="label">Año</label><input className="input" type="number" value={filtros.anio} onChange={setFilt('anio')} /></div>
          <div><label className="label">Cuadrilla</label>
            <select className="input" value={filtros.cuadrilla_id} onChange={setFilt('cuadrilla_id')}>
              <option value="">Todas</option>
              {db.cuadrillas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div><label className="label">Proyecto</label>
            <select className="input" value={filtros.proyecto_id} onChange={setFilt('proyecto_id')}>
              <option value="">Todos</option>
              {db.proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
        <div className="metric metric-light"><div className="metric-label">Registros</div><div className="metric-value" style={{ color: '#0F3460' }}>{rows.length}</div></div>
        <div className="metric metric-light"><div className="metric-label">Cuadrillas</div><div className="metric-value" style={{ color: '#0F3460' }}>{[...new Set(rows.map(r => r.cuadrilla_id).filter(Boolean))].length}</div></div>
        <div className="metric metric-primary"><div className="metric-label">Total ingresos</div><div className="metric-value">{ig.fmt$(total)}</div></div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="w-full">
          <thead><tr>
            <th className="th w-20">Semana</th>
            <th className="th w-28">Cuadrilla</th>
            <th className="th">Proyecto</th>
            <th className="th w-24">Cliente</th>
            <th className="th w-24">Fecha</th>
            <th className="th w-28 text-right">Monto</th>
            <th className="th w-16"></th>
          </tr></thead>
          <tbody>
            {rows.length ? rows.map(r => {
              const c = db.getCuadrilla(r.cuadrilla_id)
              const p = db.getProyecto(r.proyecto_id)
              return (
                <tr key={r.id}>
                  <td className="td">Sem {r.semana}</td>
                  <td className="td">{r.cuadrilla_id ? c.nombre : <span style={{ color: '#A0AABB' }}>—</span>}</td>
                  <td className="td truncate">{r.proyecto_id ? p.nombre : <span style={{ color: '#A0AABB' }}>—</span>}</td>
                  <td className="td">{r.cliente || <span style={{ color: '#A0AABB' }}>—</span>}</td>
                  <td className="td" style={{ fontSize: 12 }}>{r.fecha}</td>
                  <td className="td text-right font-medium" style={{ color: '#1A7A45' }}>{ig.fmt$(r.monto)}</td>
                  <td className="td"><button className="btn btn-outline btn-sm" onClick={() => ig.deleteIngreso(r.id)}>Eliminar</button></td>
                </tr>
              )
            }) : <tr><td colSpan={7} className="td text-center" style={{ color: '#A0AABB', padding: '2rem' }}>Sin ingresos registrados.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo ingreso">
        <form onSubmit={handleSave} className="space-y-3">
          <div className="form-row c3">
            <div><label className="label">Semana *</label><input className="input" type="number" value={form.semana} onChange={setF('semana')} required /></div>
            <div><label className="label">Año</label><input className="input" type="number" value={form.anio} onChange={setF('anio')} /></div>
            <div><label className="label">Fecha *</label><input className="input" type="date" value={form.fecha} onChange={setF('fecha')} required /></div>
          </div>
          <div className="form-row c2">
            <div><label className="label">Cuadrilla</label>
              <select className="input" value={form.cuadrilla_id} onChange={setF('cuadrilla_id')}>
                <option value="">Sin asignar</option>
                {db.cuadrillas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div><label className="label">Proyecto</label>
              <select className="input" value={form.proyecto_id} onChange={setF('proyecto_id')}>
                <option value="">Sin asignar</option>
                {db.proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row c2">
            <div><label className="label">Cliente</label><input className="input" value={form.cliente} onChange={setF('cliente')} placeholder="IZZI" /></div>
            <div><label className="label">Monto ($) *</label><input className="input" type="number" min="0" step="0.01" value={form.monto} onChange={setF('monto')} required /></div>
          </div>
          <div><label className="label">Observaciones</label><textarea className="input" rows={2} value={form.observaciones} onChange={setF('observaciones')} /></div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
