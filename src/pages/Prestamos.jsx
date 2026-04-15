import { useState } from 'react'
import { useIG } from '../hooks/useIG'
import Modal from '../components/Modal'

export default function Prestamos() {
  const ig = useIG()
  const [tab, setTab] = useState('personal')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ tipo: 'Personal', empleado_id: '', fecha: '', monto_original: '', descuento_semanal: '', concepto: '', notas: '' })
  const [saving, setSaving] = useState(false)
  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const personales = ig.prestamos.filter(p => p.tipo === 'Personal')
  const operativos = ig.prestamos.filter(p => p.tipo === 'Operativo')
  const activos = personales.filter(p => p.estado === 'Activo')
  const totalSaldo = activos.reduce((a, p) => a + Number(p.saldo), 0)
  const semanasEst = form.monto_original && form.descuento_semanal ? Math.ceil(parseFloat(form.monto_original) / parseFloat(form.descuento_semanal)) : 0

  async function handleSave(e) {
    e.preventDefault()
    if (!form.empleado_id || !form.fecha || !form.monto_original) { alert('Completa los campos obligatorios.'); return }
    setSaving(true)
    await ig.addPrestamo({ ...form, monto_original: parseFloat(form.monto_original), descuento_semanal: parseFloat(form.descuento_semanal) || 0, empleado_id: form.empleado_id })
    setSaving(false)
    setModal(false)
    setForm({ tipo: 'Personal', empleado_id: '', fecha: '', monto_original: '', descuento_semanal: '', concepto: '', notas: '' })
  }

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
            <th className="th w-32">Empleado</th>
            <th className="th w-24">Fecha</th>
            <th className="th">Concepto</th>
            <th className="th w-28 text-right">Monto original</th>
            <th className="th w-24 text-right">Pagado</th>
            <th className="th w-24 text-right">Saldo</th>
            <th className="th w-28 text-right">Desc. semanal</th>
            <th className="th w-24">Estado</th>
          </tr></thead>
          <tbody>
            {(tab === 'personal' ? personales : operativos).length ? (tab === 'personal' ? personales : operativos).map(p => {
              const emp = ig.getEmpleado(p.empleado_id)
              return (
                <tr key={p.id}>
                  <td className="td font-medium">{emp.nombre}</td>
                  <td className="td" style={{ fontSize: 11 }}>{p.fecha}</td>
                  <td className="td truncate">{p.concepto || '—'}</td>
                  <td className="td text-right">{ig.fmt$(p.monto_original)}</td>
                  <td className="td text-right" style={{ color: '#1A7A45' }}>{ig.fmt$(p.monto_pagado)}</td>
                  <td className="td text-right font-medium" style={{ color: p.saldo > 0 ? '#A82020' : '#1A7A45' }}>{ig.fmt$(p.saldo)}</td>
                  <td className="td text-right" style={{ fontSize: 12, color: '#6B7A99' }}>{p.descuento_semanal > 0 ? ig.fmt$(p.descuento_semanal) + '/sem' : '—'}</td>
                  <td className="td"><span className={`badge ${p.estado === 'Liquidado' ? 'badge-green' : 'badge-amber'}`}>{p.estado}</span></td>
                </tr>
              )
            }) : <tr><td colSpan={8} className="td text-center" style={{ color: '#A0AABB', padding: '2rem' }}>Sin {tab === 'personal' ? 'préstamos' : 'anticipos'} registrados.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo préstamo / anticipo">
        <form onSubmit={handleSave} className="space-y-3">
          <div className="form-row c2">
            <div><label className="label">Tipo</label>
              <select className="input" value={form.tipo} onChange={setF('tipo')}>
                <option value="Personal">Préstamo personal</option>
                <option value="Operativo">Anticipo operativo (refacción, combustible, etc.)</option>
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
              Con ese descuento semanal se liquidaría en aproximadamente <strong>{semanasEst} semana{semanasEst !== 1 ? 's' : ''}</strong>.
            </div>
          )}
          <div><label className="label">Notas</label><textarea className="input" rows={2} value={form.notas} onChange={setF('notas')} /></div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

