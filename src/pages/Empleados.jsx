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

    // Header NOVUS
    doc.setFillColor(15, 52, 96)
    doc.rect(0, 0, 297, 18, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text('NOVUS — Innovación y Futuro', 14, 12)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Catálogo de Empleados · ${hoy}`, 200, 12)

    const tableData = ig.empleados.map(e => {
      const c = e.cuadrilla_id ? db.getCuadrilla(e.cuadrilla_id) : null
      return [
        e.numero,
        e.nombre,
        e.puesto || '—',
        c ? c.nombre : '—',
        e.tipo_pago || 'Semanal',
        ig.fmt$(e.sueldo_diario),
        ig.fmt$(Number(e.sueldo_diario) * 6),
        ig.fmt$(Number(e.sueldo_diario) * 14),
      ]
    })

    doc.autoTable({
      startY: 24,
      head: [['N° Emp.', 'Nombre', 'Puesto', 'Cuadrilla', 'Tipo pago', 'S. Diario', 'S. Semanal', 'S. Quincenal']],
      body: tableData,
      styles: { fontSize: 9, cellPadding: 3, textColor: [40, 40, 40] },
      headStyles: { fillColor: [15, 52, 96], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 245, 255] },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 45 },
        2: { cellWidth: 35 },
        3: { cellWidth: 40 },
        4: { cellWidth: 25, halign: 'center' },
        5: { cellWidth: 28, halign: 'right' },
        6: { cellWidth: 28, halign: 'right' },
        7: { cellWidth: 32, halign: 'right' },
      },
      margin: { left: 14, right: 14 },
    })

    // Footer
    const pageH = doc.internal.pageSize.getHeight()
    doc.setDrawColor(15, 52, 96)
    doc.setLineWidth(0.5)
    doc.line(14, pageH - 14, 283, pageH - 14)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(`Total empleados: ${ig.empleados.length}`, 14, pageH - 8)
    doc.text('NOVUS — Innovación y Futuro', 283, pageH - 8, { align: 'right' })

    doc.save(`empleados-${hoy.replace(/\//g, '-')}.pdf`)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Empleados</h2>
          <div className="page-header-sub">Catálogo de personal activo</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" style={{ background: '#0F3460', color: '#fff', border: 'none' }} onClick={exportarPDF}>
            Exportar PDF
          </button>
          <button className="btn btn-primary" onClick={openNew}>+ Nuevo empleado</button>
        </div>
      </div>

      <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
        <div className="metric metric-primary">
          <div className="metric-label">Total empleados</div>
          <div className="metric-value">{ig.empleados.length}</div>
        </div>
        <div className="metric metric-light">
          <div className="metric-label">Semanales</div>
          <div className="metric-value" style={{ color: '#0F3460' }}>{ig.empleados.filter(e => (e.tipo_pago || 'Semanal') === 'Semanal').length}</div>
        </div>
        <div className="metric metric-light">
          <div className="metric-label">Quincenales (CN)</div>
          <div className="metric-value" style={{ color: '#4A3DB5' }}>{ig.empleados.filter(e => e.tipo_pago === 'Quincenal').length}</div>
        </div>
        <div className="metric metric-gold">
          <div className="metric-label">Nómina semanal est.</div>
          <div className="metric-value">{ig.fmt$(ig.empleados.filter(e => (e.tipo_pago||'Semanal')==='Semanal').reduce((a, e) => a + Number(e.sueldo_diario) * 6, 0))}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="w-full">
          <thead>
            <tr>
              <th className="th" style={{ width: '90px' }}>N° Emp.</th>
              <th className="th">Nombre</th>
              <th className="th" style={{ width: '120px' }}>Puesto</th>
              <th className="th" style={{ width: '120px' }}>Cuadrilla</th>
              <th className="th" style={{ width: '100px' }}>Tipo pago</th>
              <th className="th" style={{ width: '95px', textAlign: 'right' }}>S. Diario</th>
              <th className="th" style={{ width: '95px', textAlign: 'right' }}>S. Semanal</th>
              <th className="th" style={{ width: '100px', textAlign: 'right' }}>S. Quincenal</th>
              <th className="th" style={{ width: '110px' }}></th>
            </tr>
          </thead>
          <tbody>
            {ig.empleados.length ? ig.empleados.map(e => {
              const c = e.cuadrilla_id ? db.getCuadrilla(e.cuadrilla_id) : null
              const tipo = e.tipo_pago || 'Semanal'
              return (
                <tr key={e.id}>
                  <td className="td" style={{ color: '#6B7A99' }}>{e.numero}</td>
                  <td className="td" style={{ fontWeight: 500 }}>{e.nombre}</td>
                  <td className="td">{e.puesto || '—'}</td>
                  <td className="td">{c ? <span className="badge badge-novus">{c.nombre}</span> : <span style={{ color: '#A0AABB', fontSize: 12 }}>—</span>}</td>
                  <td className="td"><span className={`badge ${tipo === 'Quincenal' ? 'badge-purple' : 'badge-blue'}`}>{tipo}</span></td>
                  <td className="td" style={{ textAlign: 'right' }}>{ig.fmt$(e.sueldo_diario)}</td>
                  <td className="td" style={{ textAlign: 'right', color: tipo === 'Semanal' ? '#0F3460' : '#A0AABB' }}>{ig.fmt$(Number(e.sueldo_diario) * 6)}</td>
                  <td className="td" style={{ textAlign: 'right', color: tipo === 'Quincenal' ? '#0F3460' : '#A0AABB' }}>{ig.fmt$(Number(e.sueldo_diario) * 14)}</td>
                  <td className="td">
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => openEdit(e)}>Editar</button>
                      <button className="btn btn-outline btn-sm" style={{ color: '#A82020' }} onClick={() => { if(confirm('¿Eliminar empleado?')) ig.deleteEmpleado(e.id) }}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              )
            }) : (
              <tr>
                <td colSpan={9} className="td" style={{ textAlign: 'center', color: '#A0AABB', padding: '2rem' }}>
                  Sin empleados registrados. Agrega el primero.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => { setModal(false); setEditId(null); setForm(emptyForm) }} title={editId ? 'Editar empleado' : 'Nuevo empleado'}>
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
              <label className="label">Tipo de pago</label>
              <select className="input" value={form.tipo_pago} onChange={setF('tipo_pago')}>
                <option value="Semanal">Semanal</option>
                <option value="Quincenal">Quincenal (CN)</option>
              </select>
            </div>
            <div>
              <label className="label">Sueldo diario ($) *</label>
              <input className="input" type="number" min="0" step="0.01" value={form.sueldo_diario} onChange={setF('sueldo_diario')} placeholder="500.00" required />
            </div>
          </div>
          <div className="form-row c2">
            <div>
              <label className="label">Sueldo semanal (6 días)</label>
              <input className="input" readOnly value={sueldoSemanal > 0 ? ig.fmt$(sueldoSemanal) : ''} placeholder="Calculado automático" />
            </div>
            <div>
              <label className="label">Sueldo quincenal (14 días)</label>
              <input className="input" readOnly value={sueldoQuincenal > 0 ? ig.fmt$(sueldoQuincenal) : ''} placeholder="Calculado automático" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-outline" onClick={() => { setModal(false); setEditId(null); setForm(emptyForm) }}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : editId ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}