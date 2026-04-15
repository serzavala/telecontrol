import { useState } from 'react'
import { useIG } from '../hooks/useIG'
import { useDB } from '../hooks/useDB'
import Modal from '../components/Modal'

export default function Empleados() {
  const ig = useIG()
  const db = useDB()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ numero: '', nombre: '', puesto: '', cuadrilla_id: '', sueldo_diario: '' })
  const [saving, setSaving] = useState(false)
  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const sueldoSemanal = (parseFloat(form.sueldo_diario) || 0) * 6

  if (ig.loading) {
    return <div style={{ padding: '2rem', color: '#6B7A99', fontSize: 14 }}>Cargando empleados...</div>
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.numero || !form.nombre || !form.sueldo_diario) { alert('Completa los campos obligatorios.'); return }
    setSaving(true)
    const { error } = await ig.addEmpleado({ ...form, sueldo_diario: parseFloat(form.sueldo_diario), cuadrilla_id: form.cuadrilla_id || null })
    if (error) alert('Error: ' + error.message)
    setSaving(false)
    setModal(false)
    setForm({ numero: '', nombre: '', puesto: '', cuadrilla_id: '', sueldo_diario: '' })
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Empleados</h2>
          <div className="page-header-sub">Catálogo de personal activo</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Nuevo empleado</button>
      </div>

      <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
        <div className="metric metric-primary">
          <div className="metric-label">Total empleados</div>
          <div className="metric-value">{ig.empleados.length}</div>
        </div>
        <div className="metric metric-light">
          <div className="metric-label">Sueldo diario promedio</div>
          <div className="metric-value">
            {ig.fmt$(ig.empleados.length ? ig.empleados.reduce((a, e) => a + Number(e.sueldo_diario), 0) / ig.empleados.length : 0)}
          </div>
        </div>
        <div className="metric metric-gold">
          <div className="metric-label">Nómina semanal estimada</div>
          <div className="metric-value">
            {ig.fmt$(ig.empleados.reduce((a, e) => a + Number(e.sueldo_diario) * 6, 0))}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="w-full">
          <thead>
            <tr>
              <th className="th" style={{ width: '90px' }}>N° Emp.</th>
              <th className="th">Nombre</th>
              <th className="th" style={{ width: '130px' }}>Puesto</th>
              <th className="th" style={{ width: '130px' }}>Cuadrilla</th>
              <th className="th" style={{ width: '100px', textAlign: 'right' }}>S. Diario</th>
              <th className="th" style={{ width: '110px', textAlign: 'right' }}>S. Semanal</th>
              <th className="th" style={{ width: '80px' }}></th>
            </tr>
          </thead>
          <tbody>
            {ig.empleados.length ? ig.empleados.map(e => {
              const c = e.cuadrilla_id ? db.getCuadrilla(e.cuadrilla_id) : null
              return (
                <tr key={e.id}>
                  <td className="td" style={{ color: '#6B7A99' }}>{e.numero}</td>
                  <td className="td" style={{ fontWeight: 500 }}>{e.nombre}</td>
                  <td className="td">{e.puesto || '—'}</td>
                  <td className="td">
                    {c ? <span className="badge badge-novus">{c.nombre}</span> : <span style={{ color: '#A0AABB', fontSize: 12 }}>—</span>}
                  </td>
                  <td className="td" style={{ textAlign: 'right' }}>{ig.fmt$(e.sueldo_diario)}</td>
                  <td className="td" style={{ textAlign: 'right', fontWeight: 500, color: '#0F3460' }}>{ig.fmt$(Number(e.sueldo_diario) * 6)}</td>
                  <td className="td">
                    <button className="btn btn-outline btn-sm" onClick={() => ig.deleteEmpleado(e.id)}>Eliminar</button>
                  </td>
                </tr>
              )
            }) : (
              <tr>
                <td colSpan={7} className="td" style={{ textAlign: 'center', color: '#A0AABB', padding: '2rem' }}>
                  Sin empleados registrados. Agrega el primero.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo empleado">
        <form onSubmit={handleSave} className="space-y-3">
          <div className="form-row c2">
            <div>
              <label className="label">N° Empleado *</label>
              <input className="input" value={form.numero} onChange={setF('numero')} placeholder="EMP-001" required />
            </div>
            <div>
              <label className="label">Nombre completo *</label>
              <input className="input" value={form.nombre} onChange={setF('nombre')} required />
            </div>
          </div>
          <div className="form-row c2">
            <div>
              <label className="label">Puesto</label>
              <input className="input" value={form.puesto} onChange={setF('puesto')} placeholder="Técnico fibra" />
            </div>
            <div>
              <label className="label">Cuadrilla asignada</label>
              <select className="input" value={form.cuadrilla_id} onChange={setF('cuadrilla_id')}>
                <option value="">Sin asignar</option>
                {db.cuadrillas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row c2">
            <div>
              <label className="label">Sueldo diario ($) *</label>
              <input className="input" type="number" min="0" step="10" value={form.sueldo_diario} onChange={setF('sueldo_diario')} required />
            </div>
            <div>
              <label className="label">Sueldo semanal (automático)</label>
              <input className="input" readOnly value={sueldoSemanal > 0 ? ig.fmt$(sueldoSemanal) : ''} placeholder="Se calcula solo" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
