import { useState } from 'react'
import { useIG } from '../hooks/useIG'
import Modal from '../components/Modal'
import { supabase } from '../lib/supabase'

export default function Prestamos() {
  const ig = useIG()
  const [tab, setTab] = useState('personal')
  const [modal, setModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [detalleModal, setDetalleModal] = useState(null)
  const [pagoModal, setPagoModal] = useState(null)
  const [prestamoActual, setPrestamoActual] = useState(null)
  const [historial, setHistorial] = useState([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)
  const [form, setForm] = useState({ tipo: 'Personal', empleado_id: '', fecha: '', monto_original: '', descuento_semanal: '', concepto: '', notas: '' })
  const [editForm, setEditForm] = useState({})
  const [pagoForm, setPagoForm] = useState({ monto: '', fecha: new Date().toISOString().split('T')[0], notas: '' })
  const [saving, setSaving] = useState(false)
  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const setEF = k => e => setEditForm(f => ({ ...f, [k]: e.target.value }))
  const setPF = k => e => setPagoForm(f => ({ ...f, [k]: e.target.value }))

  const personales = ig.prestamos.filter(p => p.tipo === 'Personal')
  const operativos = ig.prestamos.filter(p => p.tipo === 'Operativo')
  const activos = personales.filter(p => p.estado === 'Activo')
  const totalSaldo = activos.reduce((a, p) => a + Number(p.saldo), 0)
  const semanasEst = form.monto_original && form.descuento_semanal
    ? Math.ceil(parseFloat(form.monto_original) / parseFloat(form.descuento_semanal)) : 0

  async function handleSave(e) {
    e.preventDefault()
    if (!form.empleado_id || !form.fecha || !form.monto_original) { alert('Completa los campos obligatorios.'); return }
    setSaving(true)
    await ig.addPrestamo({ ...form, monto_original: parseFloat(form.monto_original), descuento_semanal: parseFloat(form.descuento_semanal) || 0 })
    setSaving(false)
    setModal(false)
    setForm({ tipo: 'Personal', empleado_id: '', fecha: '', monto_original: '', descuento_semanal: '', concepto: '', notas: '' })
  }

  function openEdit(p) {
    setPrestamoActual(p)
    setEditForm({
      concepto: p.concepto || '',
      descuento_semanal: p.descuento_semanal || '',
      estado: p.estado || 'Activo',
      notas: p.notas || '',
    })
    setEditModal(true)
  }

  async function handleEdit() {
    if (!prestamoActual) return
    setSaving(true)
    const update = {
      concepto: editForm.concepto,
      descuento_semanal: parseFloat(editForm.descuento_semanal) || 0,
      notas: editForm.notas,
      estado: editForm.estado,
    }
    // Si se cancela, marcar saldo en 0
    if (editForm.estado === 'Cancelado') {
      update.saldo = 0
    }
    // Si se marca pagado manualmente
    if (editForm.estado === 'Liquidado') {
      update.saldo = 0
      update.monto_pagado = prestamoActual.monto_original
    }
    const { error } = await supabase.from('prestamos').update(update).eq('id', prestamoActual.id)
    if (!error) ig.reload()
    setSaving(false)
    setEditModal(false)
  }

  function openPago(p) {
    setPrestamoActual(p)
    setPagoForm({ monto: p.descuento_semanal || '', fecha: new Date().toISOString().split('T')[0], notas: '' })
    setPagoModal(p)
  }

  async function handlePago() {
    if (!pagoForm.monto || parseFloat(pagoForm.monto) <= 0) { alert('Ingresa el monto del pago.'); return }
    setSaving(true)
    const monto = parseFloat(pagoForm.monto)
    const nuevoSaldo = Math.max(0, Number(prestamoActual.saldo) - monto)
    const nuevoPagado = Number(prestamoActual.monto_pagado) + monto
    const nuevoEstado = nuevoSaldo === 0 ? 'Liquidado' : 'Activo'
    await supabase.from('prestamos').update({
      saldo: nuevoSaldo,
      monto_pagado: nuevoPagado,
      estado: nuevoEstado,
    }).eq('id', prestamoActual.id)
    ig.reload()
    setSaving(false)
    setPagoModal(null)
  }

  async function openDetalle(p) {
    setDetalleModal(p)
    setLoadingHistorial(true)
    // Buscar en auditoría los cambios de este préstamo
    const { data } = await supabase
      .from('auditoria')
      .select('*')
      .eq('tabla', 'prestamos')
      .eq('registro_id', p.id)
      .order('created_at', { ascending: false })
    setHistorial(data || [])
    setLoadingHistorial(false)
  }

  function fmtFecha(ts) {
    if (!ts) return '—'
    return new Date(ts).toLocaleDateString('es-MX') + ' ' + new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  }

  const estadoBadge = {
    Activo: 'badge-amber',
    Liquidado: 'badge-green',
    Cancelado: 'badge-red',
  }

  const listaActual = tab === 'personal' ? personales : operativos

  return (
    <div>
      <div className="page-header">
        <div><h2>Préstamos</h2><div className="page-header-sub">Préstamos personales y anticipos operativos</div></div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Nuevo préstamo</button>
      </div>

      <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
        <div className="metric metric-light"><div className="metric-label">Préstamos activos</div><div className="metric-value" style={{ color: '#0F3460' }}>{activos.length}</div><div className="metric-sub">Personales</div></div>
        <div className="metric metric-primary"><div className="metric-label">Saldo total</div><div className="metric-value">{ig.fmt$(totalSaldo)}</div><div className="metric-sub">Por recuperar</div></div>
        <div className="metric metric-light"><div className="metric-label">Anticipos activos</div><div className="metric-value" style={{ color: '#0F3460' }}>{operativos.filter(p => p.estado === 'Activo').length}</div><div className="metric-sub">Operativos</div></div>
        <div className="metric metric-gold"><div className="metric-label">Anticipos pendientes</div><div className="metric-value">{ig.fmt$(operativos.filter(p => p.estado === 'Activo').reduce((a, p) => a + Number(p.saldo), 0))}</div></div>
      </div>

      <div className="tab-bar">
        <div className={`tab ${tab === 'personal' ? 'tab-active' : ''}`} onClick={() => setTab('personal')}>Préstamos personales</div>
        <div className={`tab ${tab === 'operativo' ? 'tab-active' : ''}`} onClick={() => setTab('operativo')}>Anticipos operativos</div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="w-full">
          <thead><tr>
            <th className="th" style={{ width: '130px' }}>Empleado</th>
            <th className="th" style={{ width: '85px' }}>Fecha</th>
            <th className="th">Concepto</th>
            <th className="th" style={{ width: '95px', textAlign: 'right' }}>Monto original</th>
            <th className="th" style={{ width: '85px', textAlign: 'right' }}>Pagado</th>
            <th className="th" style={{ width: '85px', textAlign: 'right' }}>Saldo</th>
            <th className="th" style={{ width: '90px', textAlign: 'right' }}>Desc./sem</th>
            <th className="th" style={{ width: '80px' }}>Estado</th>
            <th className="th" style={{ width: '150px' }}></th>
          </tr></thead>
          <tbody>
            {listaActual.length ? listaActual.map(p => {
              const emp = ig.getEmpleado(p.empleado_id)
              const pct = p.monto_original > 0 ? Math.round((p.monto_pagado / p.monto_original) * 100) : 0
              return (
                <tr key={p.id}>
                  <td className="td" style={{ fontWeight: 500 }}>{emp.nombre}</td>
                  <td className="td" style={{ fontSize: 11 }}>{p.fecha}</td>
                  <td className="td" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <div>{p.concepto || '—'}</div>
                    {/* Barra de progreso */}
                    {p.estado === 'Activo' && (
                      <div style={{ marginTop: 4, height: 4, background: '#E8ECF4', borderRadius: 2, width: '100%' }}>
                        <div style={{ height: '100%', background: '#0F3460', borderRadius: 2, width: pct + '%', transition: 'width .3s' }} />
                      </div>
                    )}
                  </td>
                  <td className="td" style={{ textAlign: 'right' }}>{ig.fmt$(p.monto_original)}</td>
                  <td className="td" style={{ textAlign: 'right', color: '#1A7A45' }}>{ig.fmt$(p.monto_pagado)}</td>
                  <td className="td" style={{ textAlign: 'right', fontWeight: 500, color: p.saldo > 0 ? '#A82020' : '#1A7A45' }}>{ig.fmt$(p.saldo)}</td>
                  <td className="td" style={{ textAlign: 'right', fontSize: 12, color: '#6B7A99' }}>{p.descuento_semanal > 0 ? ig.fmt$(p.descuento_semanal) : '—'}</td>
                  <td className="td"><span className={`badge ${estadoBadge[p.estado] || 'badge-gray'}`}>{p.estado}</span></td>
                  <td className="td">
                    <div style={{ display: 'flex', gap: 3 }}>
                      {p.estado === 'Activo' && (
                        <button className="btn btn-sm" style={{ background: '#E6F6EE', color: '#1A7A45', border: 'none', fontSize: 11 }} onClick={() => openPago(p)}>Pago</button>
                      )}
                      <button className="btn btn-outline btn-sm" onClick={() => openEdit(p)}>Editar</button>
                      <button className="btn btn-outline btn-sm" onClick={() => openDetalle(p)}>Historial</button>
                    </div>
                  </td>
                </tr>
              )
            }) : (
              <tr><td colSpan={9} className="td" style={{ textAlign: 'center', color: '#A0AABB', padding: '2rem' }}>
                Sin {tab === 'personal' ? 'préstamos' : 'anticipos'} registrados.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal nuevo préstamo */}
      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo préstamo / anticipo">
        <form onSubmit={handleSave} className="space-y-3">
          <div className="form-row c2">
            <div><label className="label">Tipo</label>
              <select className="input" value={form.tipo} onChange={setF('tipo')}>
                <option value="Personal">Préstamo personal</option>
                <option value="Operativo">Anticipo operativo</option>
              </select>
            </div>
            <div><label className="label">Fecha *</label><input className="input" type="date" value={form.fecha} onChange={setF('fecha')} required /></div>
          </div>
          <div className="form-row c2">
            <div><label className="label">Empleado *</label>
              <select className="input" value={form.empleado_id} onChange={setF('empleado_id')} required>
                <option value="">Seleccionar...</option>
                {ig.empleados.map(e => <option key={e.id} value={e.id}>{e.numero} — {e.nombre}</option>)}
              </select>
            </div>
            <div><label className="label">Concepto / motivo</label><input className="input" value={form.concepto} onChange={setF('concepto')} placeholder="Urgencia médica / Refacción motor" /></div>
          </div>
          <div className="form-row c2">
            <div><label className="label">Monto ($) *</label><input className="input" type="number" min="0" step="100" value={form.monto_original} onChange={setF('monto_original')} required /></div>
            <div><label className="label">Descuento semanal sugerido ($)</label><input className="input" type="number" min="0" step="100" value={form.descuento_semanal} onChange={setF('descuento_semanal')} /></div>
          </div>
          {semanasEst > 0 && (
            <div style={{ background: '#E8F0FB', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#1A4FA0' }}>
              Se liquidaría en aproximadamente <strong>{semanasEst} semana{semanasEst !== 1 ? 's' : ''}</strong>.
            </div>
          )}
          <div><label className="label">Notas</label><textarea className="input" rows={2} value={form.notas} onChange={setF('notas')} /></div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>

      {/* Modal editar préstamo */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Editar préstamo">
        {prestamoActual && (
          <div className="space-y-3">
            <div style={{ background: '#F4F6FB', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}>
              <div style={{ fontWeight: 500, color: '#0F3460', marginBottom: 4 }}>{ig.getEmpleado(prestamoActual.empleado_id).nombre}</div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#6B7A99' }}>
                <span>Original: <strong>{ig.fmt$(prestamoActual.monto_original)}</strong></span>
                <span>Pagado: <strong style={{ color: '#1A7A45' }}>{ig.fmt$(prestamoActual.monto_pagado)}</strong></span>
                <span>Saldo: <strong style={{ color: '#A82020' }}>{ig.fmt$(prestamoActual.saldo)}</strong></span>
              </div>
            </div>
            <div className="form-row c2">
              <div><label className="label">Concepto</label><input className="input" value={editForm.concepto || ''} onChange={setEF('concepto')} /></div>
              <div><label className="label">Descuento semanal ($)</label><input className="input" type="number" min="0" step="100" value={editForm.descuento_semanal || ''} onChange={setEF('descuento_semanal')} /></div>
            </div>
            <div><label className="label">Estado</label>
              <select className="input" value={editForm.estado || 'Activo'} onChange={setEF('estado')}>
                <option value="Activo">Activo — en proceso de pago</option>
                <option value="Liquidado">Liquidado — completamente pagado</option>
                <option value="Cancelado">Cancelado — se condona el saldo</option>
              </select>
            </div>
            {(editForm.estado === 'Liquidado' || editForm.estado === 'Cancelado') && (
              <div style={{ background: editForm.estado === 'Cancelado' ? '#FEEAEA' : '#E6F6EE', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: editForm.estado === 'Cancelado' ? '#A82020' : '#1A7A45' }}>
                {editForm.estado === 'Cancelado'
                  ? 'El saldo pendiente se condonará y el préstamo quedará cancelado.'
                  : 'El préstamo se marcará como completamente pagado.'}
              </div>
            )}
            <div><label className="label">Notas</label><textarea className="input" rows={2} value={editForm.notas || ''} onChange={setEF('notas')} /></div>
            <div className="flex justify-end gap-2 pt-1">
              <button className="btn btn-outline" onClick={() => setEditModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleEdit} disabled={saving}>{saving ? 'Guardando...' : 'Actualizar'}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal registrar pago */}
      <Modal open={!!pagoModal} onClose={() => setPagoModal(null)} title="Registrar pago">
        {pagoModal && (
          <div className="space-y-3">
            <div style={{ background: '#F4F6FB', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}>
              <div style={{ fontWeight: 500, color: '#0F3460', marginBottom: 4 }}>{ig.getEmpleado(pagoModal.empleado_id).nombre}</div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#6B7A99' }}>
                <span>Saldo actual: <strong style={{ color: '#A82020' }}>{ig.fmt$(pagoModal.saldo)}</strong></span>
                <span>Desc. sugerido: <strong>{ig.fmt$(pagoModal.descuento_semanal)}</strong></span>
              </div>
            </div>
            <div className="form-row c2">
              <div><label className="label">Monto del pago ($) *</label><input className="input" type="number" min="0" max={pagoModal.saldo} step="0.01" value={pagoForm.monto} onChange={setPF('monto')} autoFocus /></div>
              <div><label className="label">Fecha del pago</label><input className="input" type="date" value={pagoForm.fecha} onChange={setPF('fecha')} /></div>
            </div>
            {pagoForm.monto > 0 && (
              <div style={{ background: '#E6F6EE', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#1A7A45' }}>
                Saldo después del pago: <strong>{ig.fmt$(Math.max(0, Number(pagoModal.saldo) - parseFloat(pagoForm.monto || 0)))}</strong>
                {parseFloat(pagoForm.monto) >= pagoModal.saldo && <span style={{ marginLeft: 8, fontWeight: 600 }}>✓ Quedará liquidado</span>}
              </div>
            )}
            <div><label className="label">Notas</label><textarea className="input" rows={2} value={pagoForm.notas} onChange={setPF('notas')} /></div>
            <div className="flex justify-end gap-2 pt-1">
              <button className="btn btn-outline" onClick={() => setPagoModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handlePago} disabled={saving}>{saving ? 'Guardando...' : 'Registrar pago'}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal historial */}
      {detalleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,52,96,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 40 }}
          onClick={e => { if (e.target === e.currentTarget) setDetalleModal(null) }}>
          <div style={{ background: 'var(--tc-surface, #fff)', borderRadius: 14, padding: '1.5rem', width: 580, maxWidth: '95%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 500, color: '#0F3460' }}>Historial de cambios</h3>
                <div style={{ fontSize: 12, color: '#6B7A99' }}>{ig.getEmpleado(detalleModal.empleado_id).nombre} · {detalleModal.concepto || 'Sin concepto'}</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setDetalleModal(null)}>✕</button>
            </div>

            {/* Resumen del préstamo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'Monto original', val: ig.fmt$(detalleModal.monto_original), color: '#0F3460' },
                { label: 'Total pagado', val: ig.fmt$(detalleModal.monto_pagado), color: '#1A7A45' },
                { label: 'Saldo pendiente', val: ig.fmt$(detalleModal.saldo), color: detalleModal.saldo > 0 ? '#A82020' : '#1A7A45' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ background: '#F4F6FB', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 11, color: '#6B7A99', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontWeight: 500, color, fontSize: 15 }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Historial de auditoría */}
            <div style={{ fontSize: 12, fontWeight: 500, color: '#6B7A99', marginBottom: 8 }}>
              Historial de modificaciones ({historial.length})
            </div>
            {loadingHistorial ? (
              <div style={{ textAlign: 'center', color: '#A0AABB', padding: '1rem' }}>Cargando historial...</div>
            ) : historial.length ? historial.map((h, i) => {
              const opColor = { INSERT: '#1A7A45', UPDATE: '#946200', DELETE: '#A82020' }
              const opLabel = { INSERT: 'Creado', UPDATE: 'Modificado', DELETE: 'Eliminado' }
              return (
                <div key={i} style={{ border: '1px solid #E8ECF4', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: opColor[h.operacion] }}>{opLabel[h.operacion]}</span>
                    <span style={{ fontSize: 11, color: '#6B7A99' }}>{fmtFecha(h.created_at)} · {h.usuario_email || '—'}</span>
                  </div>
                  {h.operacion === 'UPDATE' && h.datos_anteriores && h.datos_nuevos && (() => {
                    const campos = ['saldo', 'monto_pagado', 'estado', 'concepto', 'descuento_semanal', 'notas']
                    const cambios = campos.filter(k => JSON.stringify(h.datos_anteriores[k]) !== JSON.stringify(h.datos_nuevos[k]))
                    return cambios.length ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {cambios.map(k => (
                          <div key={k} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                            <span style={{ color: '#6B7A99', minWidth: 110 }}>{k}:</span>
                            <span style={{ color: '#A82020', textDecoration: 'line-through' }}>{String(h.datos_anteriores[k] ?? '—')}</span>
                            <span style={{ color: '#1A7A45' }}>→ {String(h.datos_nuevos[k] ?? '—')}</span>
                          </div>
                        ))}
                      </div>
                    ) : <span style={{ fontSize: 12, color: '#A0AABB' }}>Sin cambios detectados</span>
                  })()}
                  {h.operacion === 'INSERT' && (
                    <div style={{ fontSize: 12, color: '#6B7A99' }}>Préstamo registrado por {h.usuario_email}</div>
                  )}
                </div>
              )
            }) : (
              <div style={{ textAlign: 'center', color: '#A0AABB', padding: '1rem', fontSize: 13 }}>
                Sin historial de cambios registrado.
              </div>
            )}

            <div className="flex justify-end mt-4">
              <button className="btn btn-outline" onClick={() => setDetalleModal(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
