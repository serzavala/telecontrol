import { useState } from 'react'
import { useIG } from '../hooks/useIG'
import { useDB } from '../hooks/useDB'
import Modal from '../components/Modal'

const CATEGORIAS = ['Combustible','Herramientas','Viáticos','Hospedaje','Renta de equipo','Comunicación','Mantenimiento','Otros']
const CATBADGE = { Combustible:'badge-amber', Herramientas:'badge-blue', 'Viáticos':'badge-novus', Hospedaje:'badge-novus', 'Renta de equipo':'badge-gray', Comunicación:'badge-gray', Mantenimiento:'badge-amber', Otros:'badge-gray' }

const FORM_INICIAL = () => ({ fecha: '', semana: '', anio: new Date().getFullYear(), categoria: 'Combustible', concepto: '', cuadrilla_id: '', empleado_id: '', monto: '', comprobante: '', comentarios: '', prestado_por: 'empresa', prestado_por_empleado_id: '' })

export default function Gastos() {
  const ig = useIG()
  const db = useDB()
  const [filtros, setFiltros] = useState({ semana: '', cuadrilla_id: '', empleado_id: '', categoria: '', asignacion: '' })
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL())
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
  const pendientesReembolso = rows.filter(r => r.prestado_por === 'empleado' && !r.reembolsado)
  const totalPendiente = pendientesReembolso.reduce((a, r) => a + Number(r.monto), 0)
  const Prestado = ({ r }) => r.prestado_por !== 'empleado' ? null : (
    <div style={{ fontSize: 11, marginTop: 2, color: r.reembolsado ? '#1A7A45' : '#946200' }}>
      {r.reembolsado ? '✓ Reembolsado a ' : '⏳ Debe reembolsarse a '}<strong>{ig.getEmpleado(r.prestado_por_empleado_id).nombre}</strong>
      {r.reembolsado && r.reembolso_fecha ? ` · ${r.reembolso_fecha}` : ''}
    </div>
  )

  async function handleSave(e) {
    e.preventDefault()
    if (!form.fecha || !form.semana || !form.concepto || !form.monto) { alert('Completa los campos obligatorios.'); return }
    if (form.prestado_por === 'empleado' && !form.prestado_por_empleado_id) { alert('Indica quién prestó el dinero.'); return }
    setSaving(true)
    await ig.addGasto({
      ...form,
      semana: parseInt(form.semana), anio: parseInt(form.anio), monto: parseFloat(form.monto),
      cuadrilla_id: form.cuadrilla_id || null,
      empleado_id: form.empleado_id || null,
      prestado_por: form.prestado_por,
      prestado_por_empleado_id: form.prestado_por === 'empleado' ? form.prestado_por_empleado_id : null,
      reembolsado: false,
    })
    setSaving(false)
    setModal(false)
    setForm(FORM_INICIAL())
  }

  return (
    <div>
      {/* ── HEADER ── */}
      <div className="page-header">
        <div>
          <h2>Gastos operativos</h2>
          <div className="page-header-sub">Por cuadrilla y/o empleado — filtros combinados</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Nuevo gasto</button>
      </div>

      {/* ── FILTROS ── */}
      <div className="card mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="label">Semana</label>
            <input className="input" type="number" placeholder="Todas" value={filtros.semana} onChange={setFilt('semana')} />
          </div>
          <div>
            <label className="label">Cuadrilla</label>
            <select className="input" value={filtros.cuadrilla_id} onChange={setFilt('cuadrilla_id')}>
              <option value="">Todas</option>
              {db.cuadrillas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Empleado</label>
            <select className="input" value={filtros.empleado_id} onChange={setFilt('empleado_id')}>
              <option value="">Todos</option>
              {ig.empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Categoría</label>
            <select className="input" value={filtros.categoria} onChange={setFilt('categoria')}>
              <option value="">Todas</option>
              {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Asignación</label>
            <select className="input" value={filtros.asignacion} onChange={setFilt('asignacion')}>
              <option value="">Todos</option>
              <option value="general">Solo generales</option>
              <option value="personal">Solo por empleado</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── MÉTRICAS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="metric metric-primary col-span-2 sm:col-span-1">
          <div className="metric-label">Total gastos</div>
          <div className="metric-value">{ig.fmt$(total)}</div>
        </div>
        <div className="metric metric-light">
          <div className="metric-label">Generales</div>
          <div className="metric-value" style={{ color: '#A82020' }}>{ig.fmt$(totalGeneral)}</div>
          <div className="metric-sub">Sin empleado</div>
        </div>
        <div className="metric metric-light">
          <div className="metric-label">Por empleado</div>
          <div className="metric-value" style={{ color: '#A82020' }}>{ig.fmt$(totalPersonal)}</div>
          <div className="metric-sub">Personales</div>
        </div>
        <div className={`metric ${totalPendiente > 0 ? 'metric-gold' : 'metric-light'}`}>
          <div className="metric-label">Por reembolsar</div>
          <div className="metric-value" style={totalPendiente > 0 ? {} : { color: '#0F3460' }}>{ig.fmt$(totalPendiente)}</div>
          <div className="metric-sub">{pendientesReembolso.length} gasto{pendientesReembolso.length !== 1 ? 's' : ''} · {rows.length} registros</div>
        </div>
      </div>

      {/* ── TABLA (desktop) ── */}
      <div className="card hidden sm:block" style={{ padding: 0, overflow: 'hidden' }}>
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
                  <td className="td"><div className="truncate">{r.concepto}</div><Prestado r={r} /></td>
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

      {/* ── TARJETAS (móvil) ── */}
      <div className="flex flex-col gap-3 sm:hidden">
        {rows.length ? rows.map(r => {
          const c = db.getCuadrilla(r.cuadrilla_id)
          const emp = ig.getEmpleado(r.empleado_id)
          return (
            <div key={r.id} className="card" style={{ padding: '14px 16px' }}>
              <div className="flex items-center justify-between mb-2">
                <span className={`badge ${CATBADGE[r.categoria] || 'badge-gray'}`}>{r.categoria}</span>
                <span className="font-semibold text-base" style={{ color: '#A82020' }}>{ig.fmt$(r.monto)}</span>
              </div>
              <div className="font-medium text-sm mb-2" style={{ color: 'var(--tc-text)' }}>{r.concepto}<Prestado r={r} /></div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs" style={{ color: '#6B7A99' }}>
                <div><span className="font-medium">Semana:</span> {r.semana}</div>
                <div><span className="font-medium">Fecha:</span> {r.fecha}</div>
                <div><span className="font-medium">Cuadrilla:</span> {r.cuadrilla_id ? c.nombre : '—'}</div>
                <div><span className="font-medium">Empleado:</span> {r.empleado_id ? emp.nombre : 'General'}</div>
                {r.comprobante && <div className="col-span-2"><span className="font-medium">Ref:</span> {r.comprobante}</div>}
                {r.comentarios && <div className="col-span-2"><span className="font-medium">Notas:</span> {r.comentarios}</div>}
              </div>
              <div className="flex justify-end mt-3">
                <button className="btn btn-outline btn-sm" onClick={() => ig.deleteGasto(r.id)}>Eliminar</button>
              </div>
            </div>
          )
        }) : (
          <div className="card text-center py-10" style={{ color: '#A0AABB' }}>Sin gastos registrados.</div>
        )}
      </div>

      {/* ── MODAL ── */}
      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo gasto operativo">
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">Fecha *</label><input className="input" type="date" value={form.fecha} onChange={setF('fecha')} required /></div>
            <div><label className="label">Semana *</label><input className="input" type="number" value={form.semana} onChange={setF('semana')} required /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">Categoría</label>
              <select className="input" value={form.categoria} onChange={setF('categoria')}>
                {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="label">Concepto *</label><input className="input" value={form.concepto} onChange={setF('concepto')} required /></div>
          </div>

          {/* ¿A quién corresponde? */}
          <div style={{ background: 'var(--tc-bg)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--tc-text-muted)', marginBottom: 8 }}>
              ¿A quién corresponde el gasto? <span style={{ fontWeight: 400 }}>(opcional, solo para filtros y reportes)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="label">Empleado</label>
                <select className="input" value={form.empleado_id}
                  onChange={e => { const emp = ig.empleados.find(x => x.id === e.target.value); setForm(f => ({ ...f, empleado_id: e.target.value, cuadrilla_id: emp?.cuadrilla_id || f.cuadrilla_id })) }}>
                  <option value="">Sin asignar (gasto general)</option>
                  {ig.empleados.map(e => <option key={e.id} value={e.id}>{e.numero} — {e.nombre}</option>)}
                </select>
              </div>
              <div><label className="label">Cuadrilla {form.empleado_id && <span style={{ fontWeight: 400, color: 'var(--tc-text-muted)' }}>(auto, editable)</span>}</label>
                <select className="input" value={form.cuadrilla_id} onChange={setF('cuadrilla_id')}>
                  <option value="">Sin asignar</option>
                  {db.cuadrillas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ¿Con qué dinero se pagó? */}
          <div style={{ background: form.prestado_por === 'empleado' ? 'rgba(245,166,35,0.12)' : 'var(--tc-bg)', border: form.prestado_por === 'empleado' ? '1px solid #F5A623' : '1px solid transparent', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--tc-text-muted)', marginBottom: 8 }}>
              ¿Con qué dinero se pagó? *
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="label">Prestado por</label>
                <select className="input" value={form.prestado_por} onChange={e => setForm(f => ({ ...f, prestado_por: e.target.value, prestado_por_empleado_id: e.target.value === 'empresa' ? '' : f.prestado_por_empleado_id }))}>
                  <option value="empresa">Empresa (caja / cuenta)</option>
                  <option value="empleado">Un socio o empleado lo puso de su bolsa</option>
                </select>
              </div>
              {form.prestado_por === 'empleado' && (
                <div><label className="label">¿Quién prestó? *</label>
                  <select className="input" value={form.prestado_por_empleado_id} onChange={setF('prestado_por_empleado_id')} required>
                    <option value="">Seleccionar...</option>
                    {ig.empleados.map(e => <option key={e.id} value={e.id}>{e.numero} — {e.nombre}</option>)}
                  </select>
                </div>
              )}
            </div>
            {form.prestado_por === 'empleado' && form.prestado_por_empleado_id && (
              <div style={{ fontSize: 12, color: '#946200', marginTop: 8 }}>
                Se le reembolsará completo a <strong>{ig.getEmpleado(form.prestado_por_empleado_id).nombre}</strong> en su siguiente nómina, con la nota correspondiente.
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
