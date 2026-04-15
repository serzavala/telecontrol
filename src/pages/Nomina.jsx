import { useState } from 'react'
import { useIG } from '../hooks/useIG'
import { useDB } from '../hooks/useDB'
import Modal from '../components/Modal'

export default function NominaPage() {
  const ig = useIG()
  const db = useDB()
  const hoy = new Date()
  const [filtros, setFiltros] = useState({ semana: '', anio: hoy.getFullYear(), cuadrilla_id: '' })
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ semana: '', anio: hoy.getFullYear(), cuadrilla_id: '', empleado_id: '', dias_trabajados: '6', sueldo_diario: '', viaticos: '0', anticipo_operativo: '0', descuento_prestamo: '0', fecha_pago: '' })
  const [saving, setSaving] = useState(false)
  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const setFilt = k => e => setFiltros(f => ({ ...f, [k]: e.target.value }))

  const rows = ig.nomina.filter(r =>
    (!filtros.semana || r.semana == filtros.semana) &&
    (!filtros.anio || r.anio == filtros.anio) &&
    (!filtros.cuadrilla_id || r.cuadrilla_id === filtros.cuadrilla_id)
  )

  const totalSueldos = rows.reduce((a, r) => a + Number(r.sueldo_semana), 0)
  const totalViaticos = rows.reduce((a, r) => a + Number(r.viaticos), 0)
  const totalDescuentos = rows.reduce((a, r) => a + Number(r.descuento_prestamo), 0)
  const totalNeto = rows.reduce((a, r) => a + Number(r.neto_pagar), 0)

  const gastosSemana = ig.gastos.filter(r => (!filtros.semana || r.semana == filtros.semana) && (!filtros.anio || r.anio == filtros.anio))
  const totalGastos = gastosSemana.reduce((a, r) => a + Number(r.monto), 0)

  // Calcular neto al seleccionar empleado
  const empSel = ig.empleados.find(e => e.id === form.empleado_id)
  const sueldoDiario = empSel ? Number(empSel.sueldo_diario) : parseFloat(form.sueldo_diario) || 0
  const sueldoSemana = sueldoDiario * (parseFloat(form.dias_trabajados) || 0)
  const neto = sueldoSemana + (parseFloat(form.viaticos) || 0) + (parseFloat(form.anticipo_operativo) || 0) - (parseFloat(form.descuento_prestamo) || 0)

  function handleEmpChange(e) {
    const id = e.target.value
    const emp = ig.empleados.find(x => x.id === id)
    setForm(f => ({ ...f, empleado_id: id, sueldo_diario: emp ? emp.sueldo_diario : '', cuadrilla_id: emp?.cuadrilla_id || f.cuadrilla_id }))
  }

  // Agrupar por cuadrilla
  const cuadrillasEnRows = [...new Set(rows.map(r => r.cuadrilla_id))]

  async function handleSave(e) {
    e.preventDefault()
    if (!form.semana || !form.empleado_id || !form.dias_trabajados) { alert('Completa los campos obligatorios.'); return }
    setSaving(true)
    await ig.addNomina({
      semana: parseInt(form.semana), anio: parseInt(form.anio),
      cuadrilla_id: form.cuadrilla_id || null,
      empleado_id: form.empleado_id,
      dias_trabajados: parseFloat(form.dias_trabajados),
      sueldo_diario: sueldoDiario,
      sueldo_semana: sueldoSemana,
      viaticos: parseFloat(form.viaticos) || 0,
      anticipo_operativo: parseFloat(form.anticipo_operativo) || 0,
      descuento_prestamo: parseFloat(form.descuento_prestamo) || 0,
      neto_pagar: neto,
      fecha_pago: form.fecha_pago || null,
    })
    setSaving(false)
    setModal(false)
    setForm({ semana: '', anio: hoy.getFullYear(), cuadrilla_id: '', empleado_id: '', dias_trabajados: '6', sueldo_diario: '', viaticos: '0', anticipo_operativo: '0', descuento_prestamo: '0', fecha_pago: '' })
  }

  return (
    <div>
      <div className="page-header">
        <div><h2>Nómina semanal</h2><div className="page-header-sub">Pagos por semana organizados por cuadrilla</div></div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Registrar pago</button>
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

      <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(5,minmax(0,1fr))' }}>
        <div className="metric metric-light"><div className="metric-label">Empleados</div><div className="metric-value" style={{ color: '#0F3460' }}>{rows.length}</div></div>
        <div className="metric metric-light"><div className="metric-label">Total sueldos</div><div className="metric-value" style={{ color: '#A82020' }}>{ig.fmt$(totalSueldos)}</div></div>
        <div className="metric metric-light"><div className="metric-label">Total viáticos</div><div className="metric-value" style={{ color: '#946200' }}>{ig.fmt$(totalViaticos)}</div></div>
        <div className="metric metric-gold"><div className="metric-label">Desc. préstamos</div><div className="metric-value">{ig.fmt$(totalDescuentos)}</div></div>
        <div className="metric metric-primary"><div className="metric-label">Neto a pagar</div><div className="metric-value">{ig.fmt$(totalNeto)}</div></div>
      </div>

      {/* Tabla agrupada por cuadrilla */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="w-full">
          <thead><tr>
            <th className="th w-20">N° Emp.</th>
            <th className="th w-28">Nombre</th>
            <th className="th w-14 text-center">Días</th>
            <th className="th w-22 text-right">S.Diario</th>
            <th className="th w-24 text-right">Sueldo</th>
            <th className="th w-22 text-right">Viáticos</th>
            <th className="th w-24 text-right">Anticipo op.</th>
            <th className="th w-24 text-right">Desc. prest.</th>
            <th className="th w-24 text-right">Neto</th>
            <th className="th w-16"></th>
          </tr></thead>
          <tbody>
            {cuadrillasEnRows.length ? cuadrillasEnRows.map(cid => {
              const c = db.getCuadrilla(cid)
              const empleadosCuad = rows.filter(r => r.cuadrilla_id === cid)
              const subtotalNeto = empleadosCuad.reduce((a, r) => a + Number(r.neto_pagar), 0)
              return [
                <tr key={`header-${cid}`} style={{ background: '#F0F4FF' }}>
                  <td colSpan={10} style={{ padding: '8px 12px', fontWeight: 500, fontSize: 12 }}>
                    <span className="badge badge-novus" style={{ marginRight: 8 }}>{c.nombre}</span>
                    {empleadosCuad.length} empleado{empleadosCuad.length !== 1 ? 's' : ''} · Sem {filtros.semana || '—'}
                  </td>
                </tr>,
                ...empleadosCuad.map(r => {
                  const emp = ig.getEmpleado(r.empleado_id)
                  return (
                    <tr key={r.id}>
                      <td className="td" style={{ color: '#6B7A99', fontSize: 11 }}>{emp.numero}</td>
                      <td className="td font-medium">{emp.nombre}</td>
                      <td className="td text-center">{r.dias_trabajados}</td>
                      <td className="td text-right" style={{ fontSize: 11 }}>{ig.fmt$(r.sueldo_diario)}</td>
                      <td className="td text-right">{ig.fmt$(r.sueldo_semana)}</td>
                      <td className="td text-right">{ig.fmt$(r.viaticos)}</td>
                      <td className="td text-right" style={{ color: '#1A4FA0' }}>{r.anticipo_operativo > 0 ? ig.fmt$(r.anticipo_operativo) : <span style={{ color: '#A0AABB' }}>—</span>}</td>
                      <td className="td text-right" style={{ color: '#A82020' }}>{r.descuento_prestamo > 0 ? `-${ig.fmt$(r.descuento_prestamo)}` : <span style={{ color: '#A0AABB' }}>—</span>}</td>
                      <td className="td text-right font-medium" style={{ color: '#0F3460' }}>{ig.fmt$(r.neto_pagar)}</td>
                      <td className="td"><button className="btn btn-outline btn-sm" onClick={() => ig.deleteNomina(r.id)}>Eliminar</button></td>
                    </tr>
                  )
                }),
                <tr key={`total-${cid}`} style={{ background: '#F8FAFF' }}>
                  <td colSpan={8} style={{ padding: '6px 12px', fontSize: 12, color: '#6B7A99', fontWeight: 500 }}>Subtotal {c.nombre}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 500, color: '#0F3460' }}>{ig.fmt$(subtotalNeto)}</td>
                  <td></td>
                </tr>
              ]
            }) : <tr><td colSpan={10} className="td text-center" style={{ color: '#A0AABB', padding: '2rem' }}>Sin registros de nómina.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Resumen total semana */}
      {rows.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E8ECF4', borderRadius: 12, padding: '1rem 1.25rem', marginTop: '1rem' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#0F3460', marginBottom: 10 }}>
            Resumen total — Semana {filtros.semana || '—'}, {filtros.anio}
          </div>
          {[
            { label: 'Total sueldos', val: ig.fmt$(totalSueldos), color: '#A82020' },
            { label: 'Total viáticos', val: ig.fmt$(totalViaticos), color: '#A82020' },
            { label: 'Anticipos operativos', val: ig.fmt$(rows.reduce((a,r)=>a+Number(r.anticipo_operativo),0)), color: '#1A4FA0' },
            { label: 'Descuentos préstamos', val: '+' + ig.fmt$(totalDescuentos), color: '#1A7A45' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F0F3FA', fontSize: 13 }}>
              <span style={{ color: '#6B7A99' }}>{label}</span>
              <span style={{ color }}>{val}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #E8ECF4', marginTop: 6, paddingTop: 4 }} />
          <div style={{ fontSize: 12, fontWeight: 500, color: '#6B7A99', margin: '8px 0 6px' }}>Gastos fijos y variables de la semana</div>
          {ig.gastos.filter(r => (!filtros.semana || r.semana == filtros.semana) && (!filtros.anio || r.anio == filtros.anio)).length === 0
            ? <div style={{ fontSize: 12, color: '#A0AABB', marginBottom: 8 }}>Sin gastos registrados esta semana.</div>
            : [...new Set(gastosSemana.map(r => r.categoria))].map(cat => {
                const subtotal = gastosSemana.filter(r => r.categoria === cat).reduce((a, r) => a + Number(r.monto), 0)
                return (
                  <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F0F3FA', fontSize: 13 }}>
                    <span style={{ color: '#6B7A99' }}>{cat}</span>
                    <span style={{ color: '#A82020' }}>{ig.fmt$(subtotal)}</span>
                  </div>
                )
              })
          }
          <div style={{ borderTop: '1px solid #E8ECF4', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 500 }}>
            <span style={{ color: '#2D3A5A' }}>Total egresos de la semana</span>
            <span style={{ color: '#A82020' }}>{ig.fmt$(totalNeto + totalGastos)}</span>
          </div>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Registrar pago de nómina">
        <form onSubmit={handleSave} className="space-y-3">
          <div className="form-row c3">
            <div><label className="label">Semana *</label><input className="input" type="number" value={form.semana} onChange={setF('semana')} required /></div>
            <div><label className="label">Año</label><input className="input" type="number" value={form.anio} onChange={setF('anio')} /></div>
            <div><label className="label">Fecha de pago</label><input className="input" type="date" value={form.fecha_pago} onChange={setF('fecha_pago')} /></div>
          </div>
          <div className="form-row c2">
            <div><label className="label">Empleado *</label>
              <select className="input" value={form.empleado_id} onChange={handleEmpChange} required>
                <option value="">Seleccionar...</option>
                {ig.empleados.map(e => <option key={e.id} value={e.id}>{e.numero} — {e.nombre}</option>)}
              </select>
            </div>
            <div><label className="label">Cuadrilla (automático)</label>
              <input className="input" readOnly value={form.cuadrilla_id ? db.getCuadrilla(form.cuadrilla_id).nombre || '' : ''} placeholder="Se llena al seleccionar empleado" />
            </div>
          </div>
          <div className="form-row c3">
            <div><label className="label">Días trabajados *</label><input className="input" type="number" min="0" max="7" step="0.5" value={form.dias_trabajados} onChange={setF('dias_trabajados')} required /></div>
            <div><label className="label">Sueldo diario (auto)</label><input className="input" readOnly value={sueldoDiario > 0 ? ig.fmt$(sueldoDiario) : ''} placeholder="Automático" /></div>
            <div><label className="label">Sueldo semana (auto)</label><input className="input" readOnly value={sueldoSemana > 0 ? ig.fmt$(sueldoSemana) : ''} placeholder="Calculado" /></div>
          </div>
          <div className="form-row c2">
            <div><label className="label">Viáticos ($)</label><input className="input" type="number" min="0" step="100" value={form.viaticos} onChange={setF('viaticos')} /></div>
            <div><label className="label">Anticipo operativo ($)</label><input className="input" type="number" min="0" step="100" value={form.anticipo_operativo} onChange={setF('anticipo_operativo')} /></div>
          </div>
          {/* Préstamo activo */}
          <div style={{ background: '#F4F6FB', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#6B7A99', marginBottom: 6 }}>Descuento de préstamo personal</div>
            {form.empleado_id && ig.prestamos.filter(p => p.empleado_id === form.empleado_id && p.estado === 'Activo').length > 0 ? (
              ig.prestamos.filter(p => p.empleado_id === form.empleado_id && p.estado === 'Activo').map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontSize: 12 }}>Saldo pendiente: <strong style={{ color: '#A82020' }}>{ig.fmt$(p.saldo)}</strong></span>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <label className="label">Descuento esta semana ($)</label>
                    <input className="input" type="number" min="0" max={p.saldo} value={form.descuento_prestamo} onChange={setF('descuento_prestamo')} />
                  </div>
                  <span style={{ fontSize: 12 }}>Saldo después: <strong style={{ color: '#946200' }}>{ig.fmt$(Math.max(0, Number(p.saldo) - (parseFloat(form.descuento_prestamo) || 0)))}</strong></span>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 12, color: '#A0AABB' }}>{form.empleado_id ? 'Sin préstamos activos.' : 'Selecciona un empleado primero.'}</div>
            )}
          </div>
          <div style={{ background: '#fff', border: '1px solid #E8ECF4', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}><span style={{ color: '#6B7A99' }}>Sueldo + viáticos</span><span>{ig.fmt$(sueldoSemana + (parseFloat(form.viaticos) || 0))}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}><span style={{ color: '#6B7A99' }}>+ Anticipo operativo</span><span style={{ color: '#1A4FA0' }}>+{ig.fmt$(parseFloat(form.anticipo_operativo) || 0)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}><span style={{ color: '#6B7A99' }}>- Descuento préstamo</span><span style={{ color: '#A82020' }}>-{ig.fmt$(parseFloat(form.descuento_prestamo) || 0)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 500, borderTop: '1px solid #E8ECF4', paddingTop: 6 }}>
              <span>Neto a pagar</span>
              <span style={{ color: '#0F3460' }}>{ig.fmt$(neto)}</span>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

