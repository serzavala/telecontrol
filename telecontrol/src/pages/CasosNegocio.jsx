import { useState } from 'react'
import { useDB } from '../hooks/useDB'
import { getInfoCortesCN } from '../lib/fechas'
import Modal from '../components/Modal'

export default function CasosNegocio() {
  const db = useDB()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ quincena: '1', mes: '', cuadrilla_id: '', proyecto_id: '', monto: '', estado: 'Pendiente', notas: '' })
  const [saving, setSaving] = useState(false)
  const info = getInfoCortesCN()
  const cuadsCN = db.cuadrillas.filter(c => c.esquema === 'CN' || c.esquema === 'Ambas')
  const proysCN = db.proyectos.filter(p => p.tipo === 'CN')
  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSave(e) {
    e.preventDefault()
    if (!form.mes || !form.cuadrilla_id || !form.proyecto_id || !form.monto) return
    setSaving(true)
    await db.addRegistroCN({ quincena: form.quincena, mes: form.mes, cuadrilla_id: form.cuadrilla_id, proyecto_id: form.proyecto_id, monto: parseFloat(form.monto), estado: form.estado, notas: form.notas })
    setSaving(false)
    setModal(false)
    setForm({ quincena: '1', mes: '', cuadrilla_id: '', proyecto_id: '', monto: '', estado: 'Pendiente', notas: '' })
  }

  const rows = [...db.registrosCN].sort((a, b) => b.mes.localeCompare(a.mes))

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div><h2 className="text-lg font-medium">Casos de Negocio (CN)</h2><div className="text-xs text-gray-400">Renta quincenal fija — corte días 14 y penúltimo del mes</div></div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Registrar quincena</button>
      </div>

      {info && (
        <div className={`text-sm px-4 py-3 rounded-lg mb-4 border ${
          info.tipo === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-700' :
          info.tipo === 'success' ? 'bg-green-50 border-green-200 text-green-700' :
          'bg-blue-50 border-blue-200 text-blue-700'
        }`}>{info.msg}</div>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th w-36">Quincena</th>
              <th className="th w-36">Cuadrilla</th>
              <th className="th">Proyecto / Ciudad</th>
              <th className="th w-24 text-right">Monto</th>
              <th className="th w-28">Estado pago</th>
              <th className="th w-16"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map(r => {
              const c = db.getCuadrilla(r.cuadrilla_id)
              const p = db.getProyecto(r.proyecto_id)
              const ql = r.quincena === '1' ? '1ª (1–15)' : '2ª (16–fin)'
              const pagado = r.estado === 'Pagado'
              return (
                <tr key={r.id} className={pagado ? 'opacity-60' : ''}>
                  <td className="td text-xs">{r.mes} {ql}</td>
                  <td className="td truncate">{c.nombre}</td>
                  <td className="td truncate text-xs">{p.nombre} / {p.ciudad}</td>
                  <td className="td text-right">{db.fmt$(r.monto)}</td>
                  <td className="td">
                    <button
                      className={`pago-pill ${pagado ? 'pago-pill-pagado' : 'pago-pill-pendiente'}`}
                      onClick={() => db.updateRegistroCNEstado(r.id, pagado ? 'Pendiente' : 'Pagado')}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                      {r.estado}
                    </button>
                  </td>
                  <td className="td"><button className="btn btn-sm" onClick={() => db.deleteRegistroCN(r.id)}>Eliminar</button></td>
                </tr>
              )
            }) : (
              <tr><td colSpan={6} className="td text-center text-gray-400 py-10">Sin registros CN.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Registrar quincena CN">
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Quincena</label>
              <select className="input" value={form.quincena} onChange={setF('quincena')}>
                <option value="1">Primera (1–15)</option>
                <option value="2">Segunda (16–fin)</option>
              </select>
            </div>
            <div><label className="label">Mes / Año</label><input className="input" type="month" value={form.mes} onChange={setF('mes')} required /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Cuadrilla CN</label>
              <select className="input" value={form.cuadrilla_id} onChange={setF('cuadrilla_id')} required>
                <option value="">Seleccionar...</option>
                {cuadsCN.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div><label className="label">Proyecto CN</label>
              <select className="input" value={form.proyecto_id} onChange={setF('proyecto_id')} required>
                <option value="">Seleccionar...</option>
                {proysCN.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Monto quincenal ($)</label><input className="input" type="number" min="0" step="100" value={form.monto} onChange={setF('monto')} required /></div>
            <div><label className="label">Estado</label>
              <select className="input" value={form.estado} onChange={setF('estado')}>
                <option>Pendiente</option><option>Pagado</option>
              </select>
            </div>
          </div>
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
