import { useState } from 'react'
import { useIG } from '../hooks/useIG'
import { useDB } from '../hooks/useDB'
import Modal from '../components/Modal'

const CATEGORIAS = ['Combustible','Herramientas','Viáticos','Hospedaje','Renta de equipo','Comunicación','Mantenimiento','Otros']
const CATBADGE = { Combustible:'badge-amber', Herramientas:'badge-blue', 'Viáticos':'badge-novus', Hospedaje:'badge-novus', 'Renta de equipo':'badge-gray', Comunicación:'badge-gray', Mantenimiento:'badge-amber', Otros:'badge-gray' }

export default function Gastos() {
  const ig = useIG()
  const db = useDB()
  const hoy = new Date()
  const [filtros, setFiltros] = useState({ semana: '', cuadrilla_id: '', empleado_id: '', categoria: '', asignacion: '' })
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ fecha: '', semana: '', anio: hoy.getFullYear(), categoria: 'Combustible', concepto: '', cuadrilla_id: '', empleado_id: '', monto: '', comprobante: '', comentarios: '' })
  const [saving, setSaving] = useState(false)
  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const setFilt = k => e => setFiltros(f => ({ ...f, [k]: e.target.value }))

  const rows = ig.gastos.filter(r =>
    (!filtros.semana || r.semana == filtros.semana) &&
    (!filtros.cuadrilla_id || r.cuadrilla_id === filtros.cuadrilla_id) &&
    (!filtros.empleado_id || r.empleado_id === filtros.empleado_id) &&
    (!filtros.categoria || r.categoria === filtros.categoria) &&
    (!filtros.asignacion || (filtros.asignacion === 'general' ? !r.empleado_id : !!r.empleado_id))
  )
  const total = rows.reduce((a, r) => a + Number(r.monto), 0)
  const totalGeneral = rows.filter(r => !r.empleado_id).reduce((a, r) => a + Number(r.monto), 0)
  const totalPersonal = rows.filter(r => r.empleado_id).reduce((a, r) => a + Number(r.monto), 0)

  async function handleSave(e) {
    e.preventDefault()
    if (!form.fecha || !form.semana || !form.concepto || !form.monto) { alert('Completa los campos obligatorios.'); return }
    setSaving(true)
    await ig.addGasto({ ...form, semana: parseInt(form.semana), anio: parseInt(form.anio), monto: parseFloat(form.monto), cuadrilla_id: form.cuadrilla_id || null, empleado_id: form.empleado_id || null })
    setSaving(false)
    setModal(false)
    setForm({ fecha: '', semana: '', anio: hoy.getFullYear(), categoria: 'Combustible', concepto: '', cuadrilla_id: '', empleado_id: '', monto: '', comprobante: '', comentarios: '' })
  }

  const empSeleccionado = ig.empleados.find(e => e.id === form.empleado_id)

  return (
    <div>
      <div className="page-header">
        <div><h2>Gastos operativos</h2><div className="page-header-sub">Por cuadrilla y/o empleado — filtros combinados</div></div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Nuevo gasto</button>
      </div>

      <div className="card mb-4">
        <div className="form-row c3" style={{ marginBottom: '8px' }}>
          <div><label className="label">Semana</label><input className="input" type="number" placeholder="Todas" value={filtros.semana} onChange={setFilt('semana')} /></div>
          <div><label className="label">Cuadrilla</label>
            <select className="input" value={filtros.cuadrilla_id} onChange={setFilt('cuadrilla_id')}>
              <option value="">Todas</option>
              {db.cuadrillas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div><label className="label">Empleado</label>
            <select className="input" value={filtros.empleado_id} onChange={setFilt('empleado_id')}>
              <option value="">Todos</option>
              {ig.empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row c2" style={{ marginBottom: 0 }}>
          <div><label className="label">Categoría</label>
            <select className="input" value={filtros.categoria} onChange={setFilt('categoria')}>
              <option value="">Todas</option>
              {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div><label className="label">Asignación</label>
            <select className="input" value={filtros.asignacion} onChange={setFilt('asignacion')}>
              <option value="">Todos</option>
              <option value="general">Solo generales (sin empleado)</option>
              <option value="personal">Solo asignados a empleado</option>
            </select>
          </div>
        </div>
      </div>

      <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
        <div className="metric metric-primary"><div className="metric-label">Total gastos</div><div className="metric-value">{ig.fmt$(total)}</div></div>
        <div className="metric metric-light"><div className="metric-label">Gastos generales</div><div className="metric-value" style={{ color: '#A82020' }}>{ig.fmt$(totalGeneral)}</div><div className="metric-sub">Sin empleado asignado</div></div>
        <div className="metric metric-light"><div className="metric-label">Gastos por empleado</div><div className="metric-value" style={{ color: '#A82020' }}>{ig.fmt$(totalPersonal)}</div><div className="metric-sub">Asignados personalmente</div></div>
        <div className="metric metric-light"><div className="metric-label">Registros</div><div className="metric-value" style={{ color: '#0F3460' }}>{rows.length}</div></div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="w-full">
          <thead><tr>
            <th className="th w-20">Sem.</th>
            <th className="th w-24">Fecha</th>
            <th className="th w-28">Categoría</th>
            <th className="th">Concepto</th>
            <th className="th w-24">Cuadrilla</th>
            <th className="th w-28">Empleado</th>
            <th className="th w-24 text-right">Monto</th>
            <th className="th w-16"></th>
          </tr></thead>
          <tbody>
            {rows.length ? rows.map(r => {
              const c = db.getCuadrilla(r.cuadrilla_id)
              const emp = ig.getEmpleado(r.empleado_id)
              return (
                <tr key={r.id}>
                  <td className="td">Sem {r.semana}</td>
                  <td className="td" style={{ fontSize: 11 }}>{r.fecha}</td>
                  <td className="td"><span className={`badge ${CATBADGE[r.categoria] || 'badge-gray'}`}>{r.categoria}</span></td>
                  <td className="td truncate">{r.concepto}</td>
                  <td className="td" style={{ fontSize: 12 }}>{r.cuadrilla_id ? c.nombre : <span style={{ color: '#A0AABB' }}>—</span>}</td>
                  <td className="td">{r.empleado_id ? <span style={{ fontWeight: 500 }}>{emp.nombre}</span> : <span style={{ color: '#A0AABB', fontSize: 12 }}>— General</span>}</td>
                  <td className="td text-right font-medium" style={{ color: '#A82020' }}>{ig.fmt$(r.monto)}</td>
                  <td className="td"><button className="btn btn-outline btn-sm" onClick={() => ig.deleteGasto(r.id)}>Eliminar</button></td>
                </tr>
              )
            }) : <tr><td colSpan={8} className="td text-center" style={{ color: '#A0AABB', padding: '2rem' }}>Sin gastos registrados.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo gasto operativo">
        <form onSubmit={handleSave} className="space-y-3">
          <div className="form-row c3">
            <div><label className="label">Fecha *</label><input className="input" type="date" value={form.fecha} onChange={setF('fecha')} required /></div>
            <div><label className="label">Semana *</label><input className="input" type="number" value={form.semana} onChange={setF('semana')} required /></div>
            <div><label className="label">Cuadrilla</label>
              <select className="input" value={form.cuadrilla_id} onChange={setF('cuadrilla_id')}>
                <option value="">Sin asignar</option>
                {db.cuadrillas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row c2">
            <div><label className="label">Categoría</label>
              <select className="input" value={form.categoria} onChange={setF('categoria')}>
                {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="label">Concepto *</label><input className="input" value={form.concepto} onChange={setF('concepto')} required /></div>
          </div>
          <div style={{ background: '#F4F6FB', borderRadius: 8, padding: '10px 12px', marginBottom: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#6B7A99', marginBottom: 8 }}>
              Asignar a empleado <span style={{ fontWeight: 400 }}>(opcional — déjalo vacío si es gasto general)</span>
            </div>
            <div className="form-row c2" style={{ marginBottom: 0 }}>
              <div><label className="label">Empleado</label>
                <select className="input" value={form.empleado_id} onChange={setF('empleado_id')}>
                  <option value="">Sin asignar (gasto general)</option>
                  {ig.empleados.map(e => <option key={e.id} value={e.id}>{e.numero} — {e.nombre}</option>)}
                </select>
              </div>
              <div><label className="label">Cuadrilla del empleado</label>
                <input className="input" readOnly value={empSeleccionado ? db.getCuadrilla(empSeleccionado.cuadrilla_id).nombre || '—' : ''} placeholder="Automático" />
              </div>
            </div>
          </div>
          <div className="form-row c2">
            <div><label className="label">Monto ($) *</label><input className="input" type="number" min="0" step="0.01" value={form.monto} onChange={setF('monto')} required /></div>
            <div><label className="label">Comprobante / referencia</label><input className="input" value={form.comprobante} onChange={setF('comprobante')} placeholder="Folio, nota, ticket" /></div>
          </div>
          <div><label className="label">Comentarios</label><textarea className="input" rows={2} value={form.comentarios} onChange={setF('comentarios')} /></div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
