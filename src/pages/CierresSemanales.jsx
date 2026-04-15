import { useState } from 'react'
import { useIG } from '../hooks/useIG'
import Modal from '../components/Modal'

export default function CierresSemanales() {
  const ig = useIG()
  const hoy = new Date()
  const [modal, setModal] = useState(false)
  const [verModal, setVerModal] = useState(null)
  const [form, setForm] = useState({ semana: '', anio: hoy.getFullYear(), genPDF: true, cerrar: false })
  const [saving, setSaving] = useState(false)

  const totalCobrado = ig.cierres.reduce((a, c) => a + Number(c.total_ingresos), 0)
  const totalEgresos = ig.cierres.reduce((a, c) => a + Number(c.total_nomina) + Number(c.total_gastos), 0)
  const totalUtilidad = ig.cierres.reduce((a, c) => a + Number(c.utilidad_neta), 0)

  function calcularSemana() {
    const sem = parseInt(form.semana)
    const anio = parseInt(form.anio)
    if (!sem || !anio) return null
    const ing = ig.ingresos.filter(r => r.semana === sem && r.anio === anio)
    const gas = ig.gastos.filter(r => r.semana === sem && r.anio === anio)
    const nom = ig.nomina.filter(r => r.semana === sem && r.anio === anio)
    const totalIngresos = ing.reduce((a, r) => a + Number(r.monto), 0)
    const totalGastos = gas.reduce((a, r) => a + Number(r.monto), 0)
    const totalNomina = nom.reduce((a, r) => a + Number(r.neto_pagar), 0)
    const totalAnticipos = nom.reduce((a, r) => a + Number(r.anticipo_operativo), 0)
    const totalDescuentos = nom.reduce((a, r) => a + Number(r.descuento_prestamo), 0)
    const utilidad = totalIngresos - totalNomina - totalGastos
    return { totalIngresos, totalGastos, totalNomina, totalAnticipos, totalDescuentos, utilidad, numEmpleados: nom.length, numCuadrillas: [...new Set(nom.map(r => r.cuadrilla_id).filter(Boolean))].length }
  }

  async function handleGuardar(e) {
    e.preventDefault()
    const calc = calcularSemana()
    if (!calc) { alert('Ingresa semana y año.'); return }
    setSaving(true)
    await ig.addCierre({
      semana: parseInt(form.semana), anio: parseInt(form.anio),
      periodo_label: `Semana ${form.semana} — ${form.anio}`,
      total_ingresos: calc.totalIngresos,
      total_nomina: calc.totalNomina,
      total_gastos: calc.totalGastos,
      total_anticipos: calc.totalAnticipos,
      total_descuentos: calc.totalDescuentos,
      utilidad_neta: calc.utilidad,
      num_empleados: calc.numEmpleados,
      num_cuadrillas: calc.numCuadrillas,
      estado: form.cerrar ? 'Cerrado' : 'Abierto',
      fecha_cierre: form.cerrar ? hoy.toISOString().split('T')[0] : null,
    })
    setSaving(false)
    setModal(false)
  }

  const calc = calcularSemana()

  return (
    <div>
      <div className="page-header">
        <div><h2>Cierres semanales</h2><div className="page-header-sub">Nómina + gastos guardados por semana · PDF con logo NOVUS</div></div>
        <button className="btn btn-gold" onClick={() => setModal(true)}>+ Generar cierre</button>
      </div>

      <div style={{ background: '#E8F0FB', borderLeft: '3px solid #378ADD', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#1A4FA0', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>Cada cierre consolida nómina + gastos de la semana, calcula la utilidad neta y genera PDF con logo NOVUS.</span>
      </div>

      <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
        <div className="metric metric-light"><div className="metric-label">Cierres guardados</div><div className="metric-value" style={{ color: '#0F3460' }}>{ig.cierres.length}</div></div>
        <div className="metric metric-light"><div className="metric-label">Total cobrado</div><div className="metric-value" style={{ color: '#1A7A45' }}>{ig.fmt$(totalCobrado)}</div><div className="metric-sub">Histórico</div></div>
        <div className="metric metric-light"><div className="metric-label">Total egresos</div><div className="metric-value" style={{ color: '#A82020' }}>{ig.fmt$(totalEgresos)}</div><div className="metric-sub">Histórico</div></div>
        <div className="metric metric-gold"><div className="metric-label">Utilidad acumulada</div><div className="metric-value">{ig.fmt$(totalUtilidad)}</div><div className="metric-sub">{totalCobrado > 0 ? Math.round(totalUtilidad / totalCobrado * 100) : 0}% margen</div></div>
      </div>

      {ig.cierres.length ? ig.cierres.map(c => (
        <div key={c.id} onClick={() => setVerModal(c)}
          style={{ background: '#fff', border: '1px solid #E8ECF4', borderLeft: `4px solid ${c.estado === 'Cerrado' ? '#2ECC71' : '#F5A623'}`, borderRadius: 12, padding: '1rem', marginBottom: 8, cursor: 'pointer', transition: 'all .15s' }}
          onMouseEnter={e => e.currentTarget.style.background = '#F8FAFF'}
          onMouseLeave={e => e.currentTarget.style.background = '#fff'}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#0F3460' }}>{c.periodo_label}</div>
              <div style={{ fontSize: 12, color: '#6B7A99', marginTop: 2 }}>
                {c.num_empleados} empleados · {c.num_cuadrillas} cuadrillas · {c.fecha_cierre ? `Cerrado: ${c.fecha_cierre}` : 'Abierto'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`badge ${c.estado === 'Cerrado' ? 'badge-green' : 'badge-amber'}`}>{c.estado}</span>
              <button className="btn btn-sm" style={{ background: '#0F3460', color: '#fff', border: 'none' }}
                onClick={ev => { ev.stopPropagation(); alert(`Generaría PDF — ${c.periodo_label}`) }}>PDF</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 10, background: '#F8FAFF', borderRadius: 6, padding: '8px 12px' }}>
            {[
              { label: 'Ingresos', val: ig.fmt$(c.total_ingresos), color: '#1A7A45' },
              { label: 'Nómina', val: ig.fmt$(c.total_nomina), color: '#A82020' },
              { label: 'Gastos', val: ig.fmt$(c.total_gastos), color: '#A82020' },
              { label: 'Utilidad', val: ig.fmt$(c.utilidad_neta), color: c.utilidad_neta >= 0 ? '#0F3460' : '#A82020' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ fontSize: 12 }}>
                <div style={{ color: '#6B7A99', marginBottom: 2 }}>{label}</div>
                <div style={{ fontWeight: 500, color }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      )) : <div className="card" style={{ textAlign: 'center', color: '#A0AABB', padding: '2rem' }}>Sin cierres guardados aún. Genera el primero.</div>}

      {/* Modal generar cierre */}
      <Modal open={modal} onClose={() => setModal(false)} title="Generar cierre semanal">
        <form onSubmit={handleGuardar} className="space-y-3">
          <div style={{ background: '#FFF3DC', borderLeft: '3px solid #F5A623', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#946200' }}>
            Asegúrate de que todos los gastos y nóminas de la semana estén capturados antes de cerrar.
          </div>
          <div className="form-row c2">
            <div><label className="label">Semana *</label><input className="input" type="number" value={form.semana} onChange={e => setForm(f => ({ ...f, semana: e.target.value }))} required /></div>
            <div><label className="label">Año</label><input className="input" type="number" value={form.anio} onChange={e => setForm(f => ({ ...f, anio: e.target.value }))} /></div>
          </div>

          {calc && (
            <div style={{ border: '1px solid #E8ECF4', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', background: '#F4F6FB', fontSize: 12, fontWeight: 500, color: '#6B7A99' }}>Resumen a guardar</div>
              <div style={{ padding: '10px 12px' }}>
                {[
                  { label: 'Ingresos totales', val: ig.fmt$(calc.totalIngresos), color: '#1A7A45' },
                  { label: 'Nómina (neto)', val: ig.fmt$(calc.totalNomina), color: '#A82020' },
                  { label: 'Gastos operativos', val: ig.fmt$(calc.totalGastos), color: '#A82020' },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #F0F3FA', fontSize: 13 }}>
                    <span style={{ color: '#6B7A99' }}>{label}</span><span style={{ color }}>{val}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 4px', fontSize: 15, fontWeight: 500, borderTop: '1px solid #E8ECF4', marginTop: 4 }}>
                  <span>Utilidad neta</span>
                  <span style={{ color: calc.utilidad >= 0 ? '#0F3460' : '#A82020' }}>{ig.fmt$(calc.utilidad)}</span>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', border: '1px solid #E8ECF4', borderRadius: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.genPDF} onChange={e => setForm(f => ({ ...f, genPDF: e.target.checked }))} style={{ width: 'auto' }} />
              <div><div style={{ fontSize: 13, fontWeight: 500 }}>Generar PDF</div><div style={{ fontSize: 11, color: '#6B7A99' }}>Descarga con logo NOVUS</div></div>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', border: '1px solid #E8ECF4', borderRadius: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.cerrar} onChange={e => setForm(f => ({ ...f, cerrar: e.target.checked }))} style={{ width: 'auto' }} />
              <div><div style={{ fontSize: 13, fontWeight: 500 }}>Marcar como cerrado</div><div style={{ fontSize: 11, color: '#6B7A99' }}>No se modificará después</div></div>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cierre'}</button>
          </div>
        </form>
      </Modal>

      {/* Modal ver cierre */}
      {verModal && (
        <Modal open={!!verModal} onClose={() => setVerModal(null)} title={verModal.periodo_label}>
          <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
            <div className="metric metric-primary"><div className="metric-label">Ingresos</div><div className="metric-value">{ig.fmt$(verModal.total_ingresos)}</div></div>
            <div className="metric metric-gold"><div className="metric-label">Utilidad neta</div><div className="metric-value">{ig.fmt$(verModal.utilidad_neta)}</div></div>
          </div>
          {[
            { label: 'Nómina total', val: ig.fmt$(verModal.total_nomina) },
            { label: 'Gastos operativos', val: ig.fmt$(verModal.total_gastos) },
            { label: 'Empleados pagados', val: verModal.num_empleados },
            { label: 'Cuadrillas activas', val: verModal.num_cuadrillas },
            { label: 'Margen de utilidad', val: verModal.total_ingresos > 0 ? Math.round(verModal.utilidad_neta / verModal.total_ingresos * 100) + '%' : '—' },
            { label: 'Estado', val: verModal.estado },
          ].map(({ label, val }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F0F3FA', fontSize: 13 }}>
              <span style={{ color: '#6B7A99' }}>{label}</span><span style={{ fontWeight: 500 }}>{val}</span>
            </div>
          ))}
          <div className="flex justify-end gap-2 mt-4">
            <button className="btn btn-outline" onClick={() => setVerModal(null)}>Cerrar</button>
            <button className="btn" style={{ background: '#0F3460', color: '#fff', border: 'none' }} onClick={() => alert(`PDF — ${verModal.periodo_label}`)}>Descargar PDF</button>
            {verModal.estado === 'Abierto' && <button className="btn btn-gold" onClick={() => { ig.updateCierreEstado(verModal.id, 'Cerrado'); setVerModal(null) }}>Marcar cerrado</button>}
          </div>
        </Modal>
      )}
    </div>
  )
}