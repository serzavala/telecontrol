import { useState } from 'react'
import { useIG } from '../hooks/useIG'
import { useDB } from '../hooks/useDB'
import Modal from '../components/Modal'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

export default function NominaPage() {
  const ig = useIG()
  const db = useDB()
  const hoy = new Date()
  const [filtros, setFiltros] = useState({ semana: '', anio: hoy.getFullYear(), cuadrilla_id: '' })
  const [modal, setModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [form, setForm] = useState({ semana: '', anio: hoy.getFullYear(), cuadrilla_id: '', empleado_id: '', dias_trabajados: '6', sueldo_diario: '', viaticos: '0', anticipo_operativo: '0', descuento_prestamo: '0', fecha_pago: '' })
  const [saving, setSaving] = useState(false)
  const [autoModal, setAutoModal] = useState(false)
  const [autoForm, setAutoForm] = useState({ semana: '', anio: hoy.getFullYear(), cuadrillas: [], viaticos_modo: 'empleado', viaticos_general: '0' })
  const [autoSaving, setAutoSaving] = useState(false)
  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const setEF = k => e => setEditForm(f => ({ ...f, [k]: e.target.value }))
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

  const empSel = ig.empleados.find(e => e.id === form.empleado_id)
  const sueldoDiario = empSel ? Number(empSel.sueldo_diario) : parseFloat(form.sueldo_diario) || 0
  const sueldoSemana = sueldoDiario * (parseFloat(form.dias_trabajados) || 0)
  const neto = sueldoSemana + (parseFloat(form.viaticos) || 0) + (parseFloat(form.anticipo_operativo) || 0) - (parseFloat(form.descuento_prestamo) || 0)

  // Neto calculado para edición
  const editNeto = editRow
    ? (Number(editRow.sueldo_diario) * (parseFloat(editForm.dias_trabajados) || 0)) +
      (parseFloat(editForm.viaticos) || 0) +
      (parseFloat(editForm.anticipo_operativo) || 0) -
      (parseFloat(editForm.descuento_prestamo) || 0)
    : 0

  function handleEmpChange(e) {
    const id = e.target.value
    const emp = ig.empleados.find(x => x.id === id)
    setForm(f => ({ ...f, empleado_id: id, sueldo_diario: emp ? emp.sueldo_diario : '', cuadrilla_id: emp?.cuadrilla_id || f.cuadrilla_id }))
  }

  function openEdit(r) {
    setEditRow(r)
    setEditForm({
      dias_trabajados: r.dias_trabajados,
      viaticos: r.viaticos,
      anticipo_operativo: r.anticipo_operativo,
      descuento_prestamo: r.descuento_prestamo,
      fecha_pago: r.fecha_pago || '',
    })
    setEditModal(true)
  }

  async function handleEdit(e) {
    e.preventDefault()
    setSaving(true)
    const { supabase } = await import('../lib/supabase')
    const nuevaSueldoSemana = Number(editRow.sueldo_diario) * parseFloat(editForm.dias_trabajados)
    await supabase.from('nomina').update({
      dias_trabajados: parseFloat(editForm.dias_trabajados),
      sueldo_semana: nuevaSueldoSemana,
      viaticos: parseFloat(editForm.viaticos) || 0,
      anticipo_operativo: parseFloat(editForm.anticipo_operativo) || 0,
      descuento_prestamo: parseFloat(editForm.descuento_prestamo) || 0,
      neto_pagar: editNeto,
      fecha_pago: editForm.fecha_pago || null,
    }).eq('id', editRow.id)
    ig.reload()
    setSaving(false)
    setEditModal(false)
  }

  const cuadrillasEnRows = [...new Set(rows.map(r => r.cuadrilla_id))]

  function exportarPDF() {
    if (!rows.length) { alert('No hay registros para exportar. Aplica un filtro de semana primero.'); return }
    const doc = new jsPDF({ orientation: 'landscape' })
    const fechaHoy = new Date().toLocaleDateString('es-MX')
    const semLabel = filtros.semana ? `Semana ${filtros.semana} — ${filtros.anio}` : `Año ${filtros.anio}`
    doc.setFillColor(15, 52, 96)
    doc.rect(0, 0, 297, 18, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text('NOVUS — Innovacion y Futuro', 14, 12)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Nomina ${semLabel} · Emitido: ${fechaHoy}`, 180, 12)
    let startY = 24
    cuadrillasEnRows.forEach((cid, idx) => {
      const c = db.getCuadrilla(cid)
      const empleadosCuad = rows.filter(r => r.cuadrilla_id === cid)
      const subtotalNeto = empleadosCuad.reduce((a, r) => a + Number(r.neto_pagar), 0)
      if (idx > 0) startY += 6
      doc.setFillColor(230, 236, 250)
      doc.rect(14, startY - 4, 269, 8, 'F')
      doc.setTextColor(15, 52, 96)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text(c.nombre + ` — ${empleadosCuad.length} empleado(s)`, 16, startY + 1)
      const tableData = empleadosCuad.map(r => {
        const emp = ig.getEmpleado(r.empleado_id)
        return [emp.numero || '—', emp.nombre || '—', String(r.dias_trabajados), ig.fmt$(r.sueldo_diario), ig.fmt$(r.sueldo_semana), ig.fmt$(r.viaticos), r.anticipo_operativo > 0 ? ig.fmt$(r.anticipo_operativo) : '—', r.descuento_prestamo > 0 ? `-${ig.fmt$(r.descuento_prestamo)}` : '—', ig.fmt$(r.neto_pagar)]
      })
      tableData.push(['', 'SUBTOTAL', '', '', '', '', '', '', ig.fmt$(subtotalNeto)])
      doc.autoTable({
        startY: startY + 5,
        head: [['N° Emp.', 'Nombre', 'Dias', 'S.Diario', 'Sueldo', 'Viaticos', 'Anticipo', 'Desc.Prest.', 'Neto']],
        body: tableData,
        styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [40, 40, 40] },
        headStyles: { fillColor: [15, 52, 96], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
        alternateRowStyles: { fillColor: [245, 248, 255] },
        didParseCell: (data) => { if (data.row.index === tableData.length - 1) { data.cell.styles.fillColor = [230, 236, 250]; data.cell.styles.fontStyle = 'bold'; data.cell.styles.textColor = [15, 52, 96] } },
        columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 50 }, 2: { cellWidth: 14, halign: 'center' }, 3: { cellWidth: 24, halign: 'right' }, 4: { cellWidth: 28, halign: 'right' }, 5: { cellWidth: 24, halign: 'right' }, 6: { cellWidth: 24, halign: 'right' }, 7: { cellWidth: 26, halign: 'right' }, 8: { cellWidth: 30, halign: 'right', fontStyle: 'bold' } },
        margin: { left: 14, right: 14 },
      })
      startY = doc.lastAutoTable.finalY + 4
    })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    let yTotal = startY + 6
    if (yTotal + 30 > pageH - 10) { doc.addPage(); yTotal = 20 }
    doc.setFillColor(15, 52, 96)
    doc.rect(14, yTotal, pageW - 28, 18, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(`${rows.length} empleados · ${semLabel}`, 18, yTotal + 7)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('TOTAL NOMINA:', pageW - 65, yTotal + 7)
    doc.setFontSize(14)
    doc.setTextColor(245, 166, 35)
    doc.text(ig.fmt$(totalNeto), pageW - 15, yTotal + 13, { align: 'right' })
    doc.save(`nomina-sem${filtros.semana || 'todas'}-${filtros.anio}.pdf`)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.semana || !form.empleado_id || !form.dias_trabajados) { alert('Completa los campos obligatorios.'); return }
    // Verificar duplicado
    const existe = ig.nomina.find(r => r.empleado_id === form.empleado_id && r.semana == form.semana && r.anio == form.anio)
    if (existe) { alert('Ya existe un registro de nómina para este empleado en esta semana.'); return }
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

  async function generarNominaAutomatica() {
    if (!autoForm.semana) { alert('Selecciona la semana.'); return }
    if (!autoForm.cuadrillas.length) { alert('Selecciona al menos una cuadrilla.'); return }

    // Verificar duplicados — empleados que ya tienen nómina esta semana
    const nominaExistente = ig.nomina.filter(n =>
      n.semana === parseInt(autoForm.semana) && n.anio === parseInt(autoForm.anio)
    )
    const idsConNomina = new Set(nominaExistente.map(n => n.empleado_id))

    const empleadosSeleccionados = ig.empleados.filter(e =>
      autoForm.cuadrillas.includes(e.cuadrilla_id) && !idsConNomina.has(e.id)
    )

    if (empleadosSeleccionados.length === 0) {
      alert(`Todos los empleados ya tienen nómina registrada para la semana ${autoForm.semana}.`)
      setAutoSaving(false)
      return
    }

    const omitidos = ig.empleados.filter(e => autoForm.cuadrillas.includes(e.cuadrilla_id) && idsConNomina.has(e.id)).length

    if (!confirm(`Se crearán ${empleadosSeleccionados.length} registros de nómina.${omitidos > 0 ? ` ${omitidos} empleados omitidos (ya tienen nómina esta semana).` : ''}\n\n¿Continuar?`)) return

    setAutoSaving(true)
    let exitosos = 0
    for (const e of empleadosSeleccionados) {
      const diasTrabajados = 6
      const sd = Number(e.sueldo_diario)
      const ss = sd * diasTrabajados
      const viaticos = autoForm.viaticos_modo === 'empleado'
        ? Number(e.viaticos_default || 0)
        : autoForm.viaticos_modo === 'general'
          ? parseFloat(autoForm.viaticos_general || 0)
          : 0
      const { error } = await ig.addNomina({
        semana: parseInt(autoForm.semana),
        anio: parseInt(autoForm.anio),
        cuadrilla_id: e.cuadrilla_id,
        empleado_id: e.id,
        dias_trabajados: diasTrabajados,
        sueldo_diario: sd,
        sueldo_semana: ss,
        viaticos,
        anticipo_operativo: 0,
        descuento_prestamo: 0,
        neto_pagar: ss + viaticos,
        fecha_pago: null,
      })
      if (!error) exitosos++
    }
    setAutoSaving(false)
    setAutoModal(false)
    setAutoForm({ semana: '', anio: hoy.getFullYear(), cuadrillas: [], viaticos_modo: 'empleado', viaticos_general: '0' })
    alert(`Nómina generada: ${exitosos} registros creados correctamente.`)
  }

  return (
    <div>
      <div className="page-header">
        <div><h2>Nómina semanal</h2><div className="page-header-sub">Pagos por semana organizados por cuadrilla</div></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-gold" onClick={() => setAutoModal(true)}>⚡ Generar nómina</button>
          <button className="btn" style={{ background: '#0F3460', color: '#fff', border: 'none' }} onClick={exportarPDF}>Exportar PDF</button>
          <button className="btn btn-primary" onClick={() => setModal(true)}>+ Registrar pago</button>
        </div>
      </div>

      <div style={{ background: '#0F3460', color: '#fff', borderRadius: 10, padding: '8px 18px', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
        <span style={{ color: '#F5A623', fontSize: 22, fontWeight: 700 }}>
          {Math.ceil((new Date() - new Date(new Date().getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000))}
        </span>
        <span>Semana actual del año · {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
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

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="w-full">
          <thead><tr>
            <th className="th" style={{ width: '75px' }}>N° Emp.</th>
            <th className="th">Nombre</th>
            <th className="th" style={{ width: '50px', textAlign: 'center' }}>Días</th>
            <th className="th" style={{ width: '80px', textAlign: 'right' }}>S.Diario</th>
            <th className="th" style={{ width: '85px', textAlign: 'right' }}>Sueldo</th>
            <th className="th" style={{ width: '80px', textAlign: 'right' }}>Viáticos</th>
            <th className="th" style={{ width: '85px', textAlign: 'right' }}>Anticipo</th>
            <th className="th" style={{ width: '85px', textAlign: 'right' }}>Desc. prest.</th>
            <th className="th" style={{ width: '90px', textAlign: 'right' }}>Neto</th>
            <th className="th" style={{ width: '110px' }}></th>
          </tr></thead>
          <tbody>
            {cuadrillasEnRows.length ? cuadrillasEnRows.map(cid => {
              const c = db.getCuadrilla(cid)
              const empleadosCuad = rows.filter(r => r.cuadrilla_id === cid)
              const subtotalNeto = empleadosCuad.reduce((a, r) => a + Number(r.neto_pagar), 0)
              return [
                <tr key={`header-${cid}`} style={{ background: '#0F3460' }}>
                  <td colSpan={10} style={{ padding: '8px 12px', fontWeight: 500, fontSize: 12, color: '#fff' }}>
                    <span style={{ marginRight: 8 }}>{c.nombre}</span>
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 400 }}>{empleadosCuad.length} empleado{empleadosCuad.length !== 1 ? 's' : ''} · Sem {filtros.semana || '—'}</span>
                    <span style={{ float: 'right', color: '#F5A623' }}>Subtotal: {ig.fmt$(subtotalNeto)}</span>
                  </td>
                </tr>,
                ...empleadosCuad.map(r => {
                  const emp = ig.getEmpleado(r.empleado_id)
                  return (
                    <tr key={r.id}>
                      <td className="td" style={{ color: '#6B7A99', fontSize: 11 }}>{emp.numero}</td>
                      <td className="td" style={{ fontWeight: 500 }}>{emp.nombre}</td>
                      <td className="td" style={{ textAlign: 'center' }}>{r.dias_trabajados}</td>
                      <td className="td" style={{ textAlign: 'right', fontSize: 11 }}>{ig.fmt$(r.sueldo_diario)}</td>
                      <td className="td" style={{ textAlign: 'right' }}>{ig.fmt$(r.sueldo_semana)}</td>
                      <td className="td" style={{ textAlign: 'right' }}>{ig.fmt$(r.viaticos)}</td>
                      <td className="td" style={{ textAlign: 'right', color: '#1A4FA0' }}>{r.anticipo_operativo > 0 ? ig.fmt$(r.anticipo_operativo) : <span style={{ color: '#A0AABB' }}>—</span>}</td>
                      <td className="td" style={{ textAlign: 'right', color: '#A82020' }}>{r.descuento_prestamo > 0 ? `-${ig.fmt$(r.descuento_prestamo)}` : <span style={{ color: '#A0AABB' }}>—</span>}</td>
                      <td className="td" style={{ textAlign: 'right', fontWeight: 500, color: '#0F3460' }}>{ig.fmt$(r.neto_pagar)}</td>
                      <td className="td">
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(r)}>Editar</button>
                          <button className="btn btn-outline btn-sm" style={{ color: '#A82020' }} onClick={() => { if (confirm('¿Eliminar este registro?')) ig.deleteNomina(r.id) }}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  )
                }),
              ]
            }) : <tr><td colSpan={10} className="td" style={{ textAlign: 'center', color: '#A0AABB', padding: '2rem' }}>Sin registros de nómina.</td></tr>}
          </tbody>
        </table>
      </div>

      {rows.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E8ECF4', borderRadius: 12, padding: '1rem 1.25rem', marginTop: '1rem' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#0F3460', marginBottom: 10 }}>Resumen total — Semana {filtros.semana || '—'}, {filtros.anio}</div>
          {[
            { label: 'Total sueldos', val: ig.fmt$(totalSueldos), color: '#A82020' },
            { label: 'Total viáticos', val: ig.fmt$(totalViaticos), color: '#A82020' },
            { label: 'Anticipos operativos', val: ig.fmt$(rows.reduce((a,r)=>a+Number(r.anticipo_operativo),0)), color: '#1A4FA0' },
            { label: 'Descuentos préstamos', val: '+' + ig.fmt$(totalDescuentos), color: '#1A7A45' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F0F3FA', fontSize: 13 }}>
              <span style={{ color: '#6B7A99' }}>{label}</span><span style={{ color }}>{val}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #E8ECF4', marginTop: 6, paddingTop: 4 }} />
          <div style={{ fontSize: 12, fontWeight: 500, color: '#6B7A99', margin: '8px 0 6px' }}>Gastos fijos y variables de la semana</div>
          {gastosSemana.length === 0
            ? <div style={{ fontSize: 12, color: '#A0AABB', marginBottom: 8 }}>Sin gastos registrados esta semana.</div>
            : [...new Set(gastosSemana.map(r => r.categoria))].map(cat => {
                const subtotal = gastosSemana.filter(r => r.categoria === cat).reduce((a, r) => a + Number(r.monto), 0)
                return (
                  <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F0F3FA', fontSize: 13 }}>
                    <span style={{ color: '#6B7A99' }}>{cat}</span><span style={{ color: '#A82020' }}>{ig.fmt$(subtotal)}</span>
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

      {/* Modal registro individual */}
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
            <div><label className="label">Días trabajados *</label><input className="input" type="number" min="0" max="14" step="0.5" value={form.dias_trabajados} onChange={setF('dias_trabajados')} required /></div>
            <div><label className="label">Sueldo diario (auto)</label><input className="input" readOnly value={sueldoDiario > 0 ? ig.fmt$(sueldoDiario) : ''} placeholder="Automático" /></div>
            <div><label className="label">Sueldo semana (auto)</label><input className="input" readOnly value={sueldoSemana > 0 ? ig.fmt$(sueldoSemana) : ''} placeholder="Calculado" /></div>
          </div>
          <div className="form-row c2">
            <div><label className="label">Viáticos ($)</label><input className="input" type="number" min="0" step="100" value={form.viaticos} onChange={setF('viaticos')} /></div>
            <div><label className="label">Anticipo operativo ($)</label><input className="input" type="number" min="0" step="100" value={form.anticipo_operativo} onChange={setF('anticipo_operativo')} /></div>
          </div>
          <div style={{ background: '#F4F6FB', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#6B7A99', marginBottom: 6 }}>Descuento de préstamo personal</div>
            {form.empleado_id && ig.prestamos.filter(p => p.empleado_id === form.empleado_id && p.estado === 'Activo').length > 0 ? (
              ig.prestamos.filter(p => p.empleado_id === form.empleado_id && p.estado === 'Activo').map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12 }}>Saldo: <strong style={{ color: '#A82020' }}>{ig.fmt$(p.saldo)}</strong></span>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <label className="label">Descuento esta semana ($)</label>
                    <input className="input" type="number" min="0" max={p.saldo} value={form.descuento_prestamo} onChange={setF('descuento_prestamo')} />
                  </div>
                  <span style={{ fontSize: 12 }}>Saldo después: <strong style={{ color: '#946200' }}>{ig.fmt$(Math.max(0, Number(p.saldo) - (parseFloat(form.descuento_prestamo) || 0)))}</strong></span>
                </div>
              ))
            ) : <div style={{ fontSize: 12, color: '#A0AABB' }}>{form.empleado_id ? 'Sin préstamos activos.' : 'Selecciona un empleado primero.'}</div>}
          </div>
          <div style={{ background: '#fff', border: '1px solid #E8ECF4', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}><span style={{ color: '#6B7A99' }}>Sueldo + viáticos</span><span>{ig.fmt$(sueldoSemana + (parseFloat(form.viaticos) || 0))}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}><span style={{ color: '#6B7A99' }}>+ Anticipo operativo</span><span style={{ color: '#1A4FA0' }}>+{ig.fmt$(parseFloat(form.anticipo_operativo) || 0)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}><span style={{ color: '#6B7A99' }}>- Descuento préstamo</span><span style={{ color: '#A82020' }}>-{ig.fmt$(parseFloat(form.descuento_prestamo) || 0)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 500, borderTop: '1px solid #E8ECF4', paddingTop: 6 }}>
              <span>Neto a pagar</span><span style={{ color: '#0F3460' }}>{ig.fmt$(neto)}</span>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>

      {/* Modal editar registro */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Editar registro de nómina">
        {editRow && (
          <form onSubmit={handleEdit} className="space-y-3">
            <div style={{ background: '#F4F6FB', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}>
              <div style={{ fontWeight: 500, color: '#0F3460' }}>{ig.getEmpleado(editRow.empleado_id).nombre}</div>
              <div style={{ fontSize: 12, color: '#6B7A99' }}>Sem {editRow.semana} · S.Diario: {ig.fmt$(editRow.sueldo_diario)}</div>
            </div>
            <div className="form-row c2">
              <div><label className="label">Días trabajados</label><input className="input" type="number" min="0" max="14" step="0.5" value={editForm.dias_trabajados} onChange={setEF('dias_trabajados')} /></div>
              <div><label className="label">Sueldo semana (auto)</label><input className="input" readOnly value={ig.fmt$(Number(editRow.sueldo_diario) * (parseFloat(editForm.dias_trabajados) || 0))} /></div>
            </div>
            <div className="form-row c2">
              <div><label className="label">Viáticos ($)</label><input className="input" type="number" min="0" step="100" value={editForm.viaticos} onChange={setEF('viaticos')} /></div>
              <div><label className="label">Anticipo operativo ($)</label><input className="input" type="number" min="0" step="100" value={editForm.anticipo_operativo} onChange={setEF('anticipo_operativo')} /></div>
            </div>
            <div className="form-row c2">
              <div><label className="label">Descuento préstamo ($)</label><input className="input" type="number" min="0" step="100" value={editForm.descuento_prestamo} onChange={setEF('descuento_prestamo')} /></div>
              <div><label className="label">Fecha de pago</label><input className="input" type="date" value={editForm.fecha_pago} onChange={setEF('fecha_pago')} /></div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #E8ECF4', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 500 }}>
                <span>Neto a pagar</span><span style={{ color: '#0F3460' }}>{ig.fmt$(editNeto)}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn btn-outline" onClick={() => setEditModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Actualizar'}</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal generación automática */}
      <Modal open={autoModal} onClose={() => setAutoModal(false)} title="Generar nómina automática">
        <div className="space-y-3">
          <div style={{ background: '#E8F0FB', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#1A4FA0' }}>
            Se generarán 6 días para todos los empleados de las cuadrillas seleccionadas. Si ya existe nómina para algún empleado en esa semana se omitirá automáticamente.
          </div>
          <div className="form-row c2">
            <div><label className="label">Semana # *</label>
              <input className="input" type="number" min="1" max="52" placeholder="19" value={autoForm.semana}
                onChange={e => setAutoForm(f => ({ ...f, semana: e.target.value }))} />
            </div>
            <div><label className="label">Año</label>
              <input className="input" type="number" value={autoForm.anio}
                onChange={e => setAutoForm(f => ({ ...f, anio: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Cuadrillas a incluir *</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              {db.cuadrillas.map(c => (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" style={{ width: 'auto' }}
                    checked={autoForm.cuadrillas.includes(c.id)}
                    onChange={e => setAutoForm(f => ({
                      ...f,
                      cuadrillas: e.target.checked ? [...f.cuadrillas, c.id] : f.cuadrillas.filter(id => id !== c.id)
                    }))} />
                  {c.nombre} ({ig.empleados.filter(e => e.cuadrilla_id === c.id).length} empleados)
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Viáticos</label>
            <select className="input" value={autoForm.viaticos_modo} onChange={e => setAutoForm(f => ({ ...f, viaticos_modo: e.target.value }))}>
              <option value="empleado">Usar viático configurado por empleado</option>
              <option value="general">Mismo monto para todos</option>
              <option value="cero">Sin viáticos (agregar después)</option>
            </select>
          </div>
          {autoForm.viaticos_modo === 'general' && (
            <div><label className="label">Monto viáticos ($) para todos</label>
              <input className="input" type="number" min="0" step="100" value={autoForm.viaticos_general}
                onChange={e => setAutoForm(f => ({ ...f, viaticos_general: e.target.value }))} />
            </div>
          )}
          <div style={{ background: '#F4F6FB', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#6B7A99' }}>
            Empleados a registrar: <strong style={{ color: '#0F3460' }}>
              {ig.empleados.filter(e => autoForm.cuadrillas.includes(e.cuadrilla_id)).length}
            </strong>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn btn-outline" onClick={() => setAutoModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={generarNominaAutomatica} disabled={autoSaving}>
              {autoSaving ? 'Generando...' : 'Generar nómina'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
