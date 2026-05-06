import { useState } from 'react'
import { useIG } from '../hooks/useIG'
import { useDB } from '../hooks/useDB'
import Modal from '../components/Modal'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

export default function Empleados() {
  const ig = useIG()
  const db = useDB()
  const emptyForm = { numero: '', nombre: '', puesto: '', cuadrilla_id: '', sueldo_diario: '', tipo_pago: 'Semanal' }
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filtroCuadrilla, setFiltroCuadrilla] = useState('')
  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const sueldoSemanal = (parseFloat(form.sueldo_diario) || 0) * 6
  const sueldoQuincenal = (parseFloat(form.sueldo_diario) || 0) * 14

  if (ig.loading) return <div style={{ padding: '2rem', color: '#6B7A99', fontSize: 14 }}>Cargando empleados...</div>

  function openNew() {
    setEditId(null)
    setForm(emptyForm)
    setModal(true)
  }

  function openEdit(emp) {
    setEditId(emp.id)
    setForm({
      numero: emp.numero || '',
      nombre: emp.nombre || '',
      puesto: emp.puesto || '',
      cuadrilla_id: emp.cuadrilla_id || '',
      sueldo_diario: emp.sueldo_diario || '',
      tipo_pago: emp.tipo_pago || 'Semanal',
    })
    setModal(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.numero || !form.nombre || !form.sueldo_diario) { alert('Completa los campos obligatorios.'); return }
    setSaving(true)
    const data = { ...form, sueldo_diario: parseFloat(form.sueldo_diario), cuadrilla_id: form.cuadrilla_id || null }
    if (editId) {
      const { error } = await ig.updateEmpleado(editId, data)
      if (error) alert('Error al actualizar: ' + error.message)
    } else {
      const { error } = await ig.addEmpleado(data)
      if (error) alert('Error al guardar: ' + error.message)
    }
    setSaving(false)
    setModal(false)
    setForm(emptyForm)
    setEditId(null)
  }

  function exportarPDF() {
    const doc = new jsPDF({ orientation: 'landscape' })
    const hoy = new Date().toLocaleDateString('es-MX')
    doc.setFillColor(15, 52, 96)
    doc.rect(0, 0, 297, 18, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text('NOVUS — Innovacion y Futuro', 14, 12)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Catalogo de Empleados · ' + hoy, 200, 12)
    const tableData = empleadosFiltrados.map(e => {
      const c = e.cuadrilla_id ? db.getCuadrilla(e.cuadrilla_id) : null
      return [e.numero, e.nombre, e.puesto || '-', c ? c.nombre : '-', e.tipo_pago || 'Semanal', ig.fmt$(e.sueldo_diario), ig.fmt$(Number(e.sueldo_diario) * 6), ig.fmt$(Number(e.sueldo_diario) * 14)]
    })
    doc.autoTable({
      startY: 24,
      head: [['N° Emp.', 'Nombre', 'Puesto', 'Cuadrilla', 'Tipo pago', 'S. Diario', 'S. Semanal', 'S. Quincenal']],
      body: tableData,
      styles: { fontSize: 9, cellPadding: 3, textColor: [40, 40, 40] },
      headStyles: { fillColor: [15, 52, 96], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 245, 255] },
      columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 45 }, 2: { cellWidth: 35 }, 3: { cellWidth: 40 }, 4: { cellWidth: 25, halign: 'center' }, 5: { cellWidth: 28, halign: 'right' }, 6: { cellWidth: 28, halign: 'right' }, 7: { cellWidth: 32, halign: 'right' } },
      margin: { left: 14, right: 14 },
    })
    const pageH = doc.internal.pageSize.getHeight()
    doc.setDrawColor(15, 52, 96)
    doc.setLineWidth(0.5)
    doc.line(14, pageH - 14, 283, pageH - 14)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text('Total empleados: ' + empleadosFiltrados.length, 14, pageH - 8)
    doc.text('NOVUS — Innovacion y Futuro', 283, pageH - 8, { align: 'right' })
    doc.save('empleados-' + hoy.replace(/\//g, '-') + '.pdf')
  }

  // Filtrar y agrupar por cuadrilla
  const empleadosFiltrados = filtroCuadrilla
    ? ig.empleados.filter(e => e.cuadrilla_id === filtroCuadrilla)
    : ig.empleados

  // Agrupar por cuadrilla — primero los sin cuadrilla al final
  const cuadrillasConEmpleados = db.cuadrillas.filter(c =>
    empleadosFiltrados.some(e => e.cuadrilla_id === c.id)
  )
  const sinCuadrilla = empleadosFiltrados.filter(e => !e.cuadrilla_id)

  const totalNominaSemanal = empleadosFiltrados
    .filter(e => (e.tipo_pago || 'Semanal') === 'Semanal')
    .reduce((a, e) => a + Number(e.sueldo_diario) * 6, 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Empleados</h2>
          <div className="page-header-sub">Catálogo de personal activo · organizados por cuadrilla</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" style={{ background: '#0F3460', color: '#fff', border: 'none' }} onClick={exportarPDF}>Exportar PDF</button>
          <button className="btn btn-primary" onClick={openNew}>+ Nuevo empleado</button>
        </div>
      </div>

      {/* Filtro por cuadrilla */}
      <div className="card mb-4" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label className="label" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>Filtrar por cuadrilla:</label>
          <select className="input" style={{ maxWidth: 260 }} value={filtroCuadrilla} onChange={e => setFiltroCuadrilla(e.target.value)}>
            <option value="">Todas las cuadrillas</option>
            {db.cuadrillas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, fontSize: 13 }}>
            <span style={{ color: '#6B7A99' }}>Total: <strong style={{ color: '#0F3460' }}>{empleadosFiltrados.length}</strong></span>
            <span style={{ color: '#6B7A99' }}>Nómina semanal est.: <strong style={{ color: '#1A7A45' }}>{ig.fmt$(totalNominaSemanal)}</strong></span>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="w-full">
          <thead>
            <tr>
              <th className="th" style={{ width: '80px' }}>N° Emp.</th>
              <th className="th">Nombre</th>
              <th className="th" style={{ width: '130px' }}>Puesto</th>
              <th className="th" style={{ width: '90px' }}>Tipo pago</th>
              <th className="th" style={{ width: '90px', textAlign: 'right' }}>S. Diario</th>
              <th className="th" style={{ width: '90px', textAlign: 'right' }}>S. Semanal</th>
              <th className="th" style={{ width: '100px', textAlign: 'right' }}>S. Quincenal</th>
              <th className="th" style={{ width: '110px' }}></th>
            </tr>
          </thead>
          <tbody>
            {cuadrillasConEmpleados.length === 0 && sinCuadrilla.length === 0 ? (
              <tr><td colSpan={8} className="td" style={{ textAlign: 'center', color: '#A0AABB', padding: '2rem' }}>Sin empleados registrados.</td></tr>
            ) : (
              <>
                {cuadrillasConEmpleados.map(cuad => {
                  const emps = empleadosFiltrados.filter(e => e.cuadrilla_id === cuad.id)
                  const subtotal = emps.filter(e => (e.tipo_pago||'Semanal')==='Semanal').reduce((a, e) => a + Number(e.sueldo_diario) * 6, 0)
                  return [
                    // Encabezado de cuadrilla
                    <tr key={'header-' + cuad.id} style={{ background: '#0F3460' }}>
                      <td colSpan={8} style={{ padding: '8px 12px', color: '#fff', fontWeight: 500, fontSize: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span>{cuad.nombre} · {emps.length} empleado{emps.length !== 1 ? 's' : ''}</span>
                          <span style={{ color: '#F5A623', fontSize: 12 }}>Nómina semanal: {ig.fmt$(subtotal)}</span>
                        </div>
                      </td>
                    </tr>,
                    // Empleados de la cuadrilla
                    ...emps.map(e => {
                      const tipo = e.tipo_pago || 'Semanal'
                      return (
                        <tr key={e.id}>
                          <td className="td" style={{ color: '#6B7A99', fontSize: 12 }}>{e.numero}</td>
                          <td className="td" style={{ fontWeight: 500 }}>{e.nombre}</td>
                          <td className="td" style={{ fontSize: 12 }}>{e.puesto || '—'}</td>
                          <td className="td"><span className={`badge ${tipo === 'Quincenal' ? 'badge-purple' : 'badge-blue'}`}>{tipo}</span></td>
                          <td className="td" style={{ textAlign: 'right' }}>{ig.fmt$(e.sueldo_diario)}</td>
                          <td className="td" style={{ textAlign: 'right', color: tipo === 'Semanal' ? '#0F3460' : '#A0AABB' }}>{ig.fmt$(Number(e.sueldo_diario) * 6)}</td>
                          <td className="td" style={{ textAlign: 'right', color: tipo === 'Quincenal' ? '#0F3460' : '#A0AABB' }}>{ig.fmt$(Number(e.sueldo_diario) * 14)}</td>
                          <td className="td">
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn btn-outline btn-sm" onClick={() => openEdit(e)}>Editar</button>
                              <button className="btn btn-outline btn-sm" style={{ color: '#A82020' }} onClick={() => { if (confirm('Eliminar empleado?')) ig.deleteEmpleado(e.id) }}>Eliminar</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  ]
                })}

                {/* Sin cuadrilla asignada */}
                {sinCuadrilla.length > 0 && [
                  <tr key="header-sin" style={{ background: '#6B7A99' }}>
                    <td colSpan={8} style={{ padding: '8px 12px', color: '#fff', fontWeight: 500, fontSize: 12 }}>
                      Sin cuadrilla asignada · {sinCuadrilla.length} empleado{sinCuadrilla.length !== 1 ? 's' : ''}
                    </td>
                  </tr>,
                  ...sinCuadrilla.map(e => {
                    const tipo = e.tipo_pago || 'Semanal'
                    return (
                      <tr key={e.id}>
                        <td className="td" style={{ color: '#6B7A99', fontSize: 12 }}>{e.numero}</td>
                        <td className="td" style={{ fontWeight: 500 }}>{e.nombre}</td>
                        <td className="td" style={{ fontSize: 12 }}>{e.puesto || '—'}</td>
                        <td className="td"><span className={`badge ${tipo === 'Quincenal' ? 'badge-purple' : 'badge-blue'}`}>{tipo}</span></td>
                        <td className="td" style={{ textAlign: 'right' }}>{ig.fmt$(e.sueldo_diario)}</td>
                        <td className="td" style={{ textAlign: 'right' }}>{ig.fmt$(Number(e.sueldo_diario) * 6)}</td>
                        <td className="td" style={{ textAlign: 'right' }}>{ig.fmt$(Number(e.sueldo_diario) * 14)}</td>
                        <td className="td">
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-outline btn-sm" onClick={() => openEdit(e)}>Editar</button>
                            <button className="btn btn-outline btn-sm" style={{ color: '#A82020' }} onClick={() => { if (confirm('Eliminar empleado?')) ig.deleteEmpleado(e.id) }}>Eliminar</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ]}
              </>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => { setModal(false); setEditId(null); setForm(emptyForm) }} title={editId ? 'Editar empleado' : 'Nuevo empleado'}>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="form-row c2">
            <div><label className="label">N° Empleado *</label><input className="input" value={form.numero} onChange={setF('numero')} placeholder="EMP-001" required /></div>
            <div><label className="label">Nombre completo *</label><input className="input" value={form.nombre} onChange={setF('nombre')} required /></div>
          </div>
          <div className="form-row c2">
            <div><label className="label">Puesto</label><input className="input" value={form.puesto} onChange={setF('puesto')} placeholder="Técnico fibra" /></div>
            <div><label className="label">Cuadrilla asignada</label>
              <select className="input" value={form.cuadrilla_id} onChange={setF('cuadrilla_id')}>
                <option value="">Sin asignar</option>
                {db.cuadrillas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row c2">
            <div><label className="label">Tipo de pago</label>
              <select className="input" value={form.tipo_pago} onChange={setF('tipo_pago')}>
                <option value="Semanal">Semanal</option>
                <option value="Quincenal">Quincenal (CN)</option>
              </select>
            </div>
            <div><label className="label">Sueldo diario ($) *</label><input className="input" type="number" min="0" step="0.01" value={form.sueldo_diario} onChange={setF('sueldo_diario')} placeholder="500.00" required /></div>
          </div>
          <div className="form-row c2">
            <div><label className="label">Sueldo semanal (6 días)</label><input className="input" readOnly value={sueldoSemanal > 0 ? ig.fmt$(sueldoSemanal) : ''} placeholder="Calculado automático" /></div>
            <div><label className="label">Sueldo quincenal (14 días)</label><input className="input" readOnly value={sueldoQuincenal > 0 ? ig.fmt$(sueldoQuincenal) : ''} placeholder="Calculado automático" /></div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-outline" onClick={() => { setModal(false); setEditId(null); setForm(emptyForm) }}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : editId ? 'Actualizar' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
