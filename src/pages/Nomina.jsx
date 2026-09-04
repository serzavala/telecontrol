import { useState } from 'react'
import { useIG } from '../hooks/useIG'
import { useDB } from '../hooks/useDB'
import Modal from '../components/Modal'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { getSemana, getSemanaISO, getOffsetDesdeSemana, fmtSemanaLabel } from '../lib/fechas'

// Semana actual según el calendario propio (viernes a jueves, numerada por el jueves de corte)
const semActual = getSemana(0)
const SEM_ACTUAL = getSemanaISO(semActual.fin)
const ANIO_ACTUAL = new Date(semActual.fin + 'T12:00:00').getFullYear()

const FORM_INICIAL = (anio) => ({ semana: String(SEM_ACTUAL), anio, prestamo_id: '', cuadrilla_id: '', empleado_id: '', dias_trabajados: '6', sueldo_diario: '', viaticos: '0', anticipo_operativo: '0', descuento_prestamo: '0', fecha_pago: '' })
const AUTO_INICIAL = (anio) => ({ semana: String(SEM_ACTUAL), anio, seleccionados: [], viaticos_modo: 'empleado', viaticos_general: '0', fecha_pago: '' })

export default function NominaPage() {
  const ig = useIG()
  const db = useDB()
  const hoy = new Date()
  const [filtros, setFiltros] = useState({ semana: String(SEM_ACTUAL), anio: ANIO_ACTUAL, cuadrillas: [] })
  const [modal, setModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [form, setForm] = useState(FORM_INICIAL(ANIO_ACTUAL))
  const [saving, setSaving] = useState(false)
  const [autoModal, setAutoModal] = useState(false)
  const [autoForm, setAutoForm] = useState(AUTO_INICIAL(ANIO_ACTUAL))
  const [autoSaving, setAutoSaving] = useState(false)
  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const setEF = k => e => setEditForm(f => ({ ...f, [k]: e.target.value }))
  const setFilt = k => e => setFiltros(f => ({ ...f, [k]: e.target.value }))

  // ── Navegación de semana (viernes–jueves) ──
  const semFiltroNum = parseInt(filtros.semana)
  const semFiltroRango = semFiltroNum ? getSemana(getOffsetDesdeSemana(semFiltroNum)) : null
  function moverSemana(delta) {
    const base = semFiltroNum || SEM_ACTUAL
    const off = getOffsetDesdeSemana(base) + delta
    const s = getSemana(off)
    setFiltros(f => ({ ...f, semana: String(getSemanaISO(s.fin)), anio: new Date(s.fin + 'T12:00:00').getFullYear() }))
  }
  function irSemanaActual() { setFiltros(f => ({ ...f, semana: String(SEM_ACTUAL), anio: ANIO_ACTUAL })) }

  // ── Préstamo personal activo de un empleado (el más antiguo primero) ──
  function prestamoActivoDe(empleadoId) {
    return ig.prestamos
      .filter(p => p.empleado_id === empleadoId && p.estado === 'Activo' && (p.tipo || 'Personal') === 'Personal')
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))[0] || null
  }
  const descuentoSugerido = p => p ? Math.min(Number(p.saldo), Number(p.descuento_semanal) || Number(p.saldo)) : 0

  // ── Generación automática: la base es SIEMPRE la lista de empleados activos ──
  const normNombre = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')
  const autoSemana = parseInt(autoForm.semana), autoAnio = parseInt(autoForm.anio)
  const idsConNomina = new Set(
    ig.nomina.filter(n => Number(n.semana) === autoSemana && Number(n.anio) === autoAnio).map(n => n.empleado_id)
  )
  const nombresRepetidos = (() => {
    const c = {}
    ig.empleados.forEach(e => { const k = normNombre(e.nombre); c[k] = (c[k] || 0) + 1 })
    return new Set(Object.keys(c).filter(k => c[k] > 1))
  })()
  const gruposAuto = [
    ...db.cuadrillas.map(c => ({ id: c.id, nombre: c.nombre, emps: ig.empleados.filter(e => e.cuadrilla_id === c.id) })),
    { id: 'sin', nombre: 'Sin cuadrilla', emps: ig.empleados.filter(e => !db.cuadrillas.some(c => c.id === e.cuadrilla_id)) },
  ].filter(g => g.emps.length)
  const toggleSel = (ids, on) => setAutoForm(f => ({
    ...f,
    seleccionados: on ? [...new Set([...f.seleccionados, ...ids])] : f.seleccionados.filter(id => !ids.includes(id)),
  }))
  function openAuto() {
    setAutoForm({ ...AUTO_INICIAL(ANIO_ACTUAL), seleccionados: ig.empleados.map(e => e.id) })
    setAutoModal(true)
  }
  const porGenerar = [...new Set(autoForm.seleccionados)]
    .map(id => ig.empleados.find(e => e.id === id))
    .filter(e => e && !idsConNomina.has(e.id))
  const reembolsoAutoTotal = porGenerar.reduce((a, e) => a + ig.getReembolsosPendientes(e.id).reduce((x, i) => x + i.monto, 0), 0)
  const descuentoAutoTotal = porGenerar.reduce((a, e) => a + descuentoSugerido(prestamoActivoDe(e.id)), 0)

  // ── Filtros y totales de la tabla ──
  const rows = ig.nomina.filter(r =>
    (!filtros.semana || r.semana == filtros.semana) &&
    (!filtros.anio || r.anio == filtros.anio) &&
    (!filtros.cuadrillas.length || filtros.cuadrillas.includes(r.cuadrilla_id))
  )
  const totalSueldos = rows.reduce((a, r) => a + Number(r.sueldo_semana), 0)
  const totalViaticos = rows.reduce((a, r) => a + Number(r.viaticos), 0)
  const totalAnticipos = rows.reduce((a, r) => a + Number(r.anticipo_operativo), 0)
  const totalDescuentos = rows.reduce((a, r) => a + Number(r.descuento_prestamo), 0)
  const totalReembolsos = rows.reduce((a, r) => a + Number(r.reembolso_gastos || 0), 0)
  const totalNeto = rows.reduce((a, r) => a + Number(r.neto_pagar), 0)

  const gastosSemana = ig.gastos.filter(r => (!filtros.semana || r.semana == filtros.semana) && (!filtros.anio || r.anio == filtros.anio))
  const totalGastos = gastosSemana.reduce((a, r) => a + Number(r.monto), 0)

  // ── Registro individual ──
  const empSel = ig.empleados.find(e => e.id === form.empleado_id)
  const sueldoDiario = empSel ? Number(empSel.sueldo_diario) : parseFloat(form.sueldo_diario) || 0
  const sueldoSemana = sueldoDiario * (parseFloat(form.dias_trabajados) || 0)
  const reembolsosForm = ig.getReembolsosPendientes(form.empleado_id)
  const reembolsoForm = reembolsosForm.reduce((a, i) => a + i.monto, 0)
  const neto = sueldoSemana + (parseFloat(form.viaticos) || 0) + (parseFloat(form.anticipo_operativo) || 0) + reembolsoForm - (parseFloat(form.descuento_prestamo) || 0)

  // ── Edición ──
  const editNeto = editRow
    ? (Number(editRow.sueldo_diario) * (parseFloat(editForm.dias_trabajados) || 0)) +
      (parseFloat(editForm.viaticos) || 0) +
      (parseFloat(editForm.anticipo_operativo) || 0) +
      Number(editRow.reembolso_gastos || 0) -
      (parseFloat(editForm.descuento_prestamo) || 0)
    : 0

  function handleEmpChange(e) {
    const id = e.target.value
    const emp = ig.empleados.find(x => x.id === id)
    const p = prestamoActivoDe(id)
    setForm(f => ({ ...f, empleado_id: id, sueldo_diario: emp ? emp.sueldo_diario : '', cuadrilla_id: emp?.cuadrilla_id || f.cuadrilla_id, prestamo_id: p?.id || '', descuento_prestamo: String(descuentoSugerido(p)) }))
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
    const nuevoDesc = parseFloat(editForm.descuento_prestamo) || 0
    const delta = nuevoDesc - Number(editRow.descuento_prestamo || 0)
    if (editRow.prestamo_id && delta !== 0) {
      if (delta > 0) await ig.aplicarDescuento(editRow.prestamo_id, delta)
      else await ig.revertirDescuento(editRow.prestamo_id, -delta)
    }
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
        return [
          emp.numero || '—', emp.nombre || '—', String(r.dias_trabajados), ig.fmt$(r.sueldo_diario), ig.fmt$(r.sueldo_semana), ig.fmt$(r.viaticos),
          r.anticipo_operativo > 0 ? ig.fmt$(r.anticipo_operativo) : '—',
          r.reembolso_gastos > 0 ? ig.fmt$(r.reembolso_gastos) : '—',
          r.descuento_prestamo > 0 ? `-${ig.fmt$(r.descuento_prestamo)}` : '—',
          ig.fmt$(r.neto_pagar),
        ]
      })
      tableData.push(['', 'SUBTOTAL', '', '', '', '', '', '', '', ig.fmt$(subtotalNeto)])
      doc.autoTable({
        startY: startY + 5,
        head: [['N° Emp.', 'Nombre', 'Dias', 'S.Diario', 'Sueldo', 'Viaticos', 'Anticipo', 'Reembolso', 'Desc.Prest.', 'Neto']],
        body: tableData,
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [40, 40, 40] },
        headStyles: { fillColor: [15, 52, 96], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: [245, 248, 255] },
        didParseCell: (data) => { if (data.row.index === tableData.length - 1) { data.cell.styles.fillColor = [230, 236, 250]; data.cell.styles.fontStyle = 'bold'; data.cell.styles.textColor = [15, 52, 96] } },
        columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 48 }, 2: { cellWidth: 13, halign: 'center' }, 3: { cellWidth: 23, halign: 'right' }, 4: { cellWidth: 26, halign: 'right' }, 5: { cellWidth: 23, halign: 'right' }, 6: { cellWidth: 23, halign: 'right' }, 7: { cellWidth: 24, halign: 'right' }, 8: { cellWidth: 25, halign: 'right' }, 9: { cellWidth: 28, halign: 'right', fontStyle: 'bold' } },
        margin: { left: 14, right: 14 },
      })
      startY = doc.lastAutoTable.finalY + 4
      // Notas de reembolso debajo de la tabla de la cuadrilla
      const conNotas = empleadosCuad.filter(r => r.notas)
      if (conNotas.length) {
        doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(148, 98, 0)
        conNotas.forEach(r => {
          const lines = doc.splitTextToSize(`${ig.getEmpleado(r.empleado_id).nombre}: ${r.notas}`, 265)
          doc.text(lines, 16, startY)
          startY += lines.length * 3.5
        })
        startY += 2
      }
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
    doc.text(`${rows.length} empleados · ${semLabel}${totalReembolsos > 0 ? ` · Incluye ${ig.fmt$(totalReembolsos)} de reembolsos` : ''}`, 18, yTotal + 7)
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
    const existe = ig.nomina.find(r => r.empleado_id === form.empleado_id && r.semana == form.semana && r.anio == form.anio)
    if (existe) { alert('Ya existe un registro de nómina para este empleado en esta semana.'); return }
    const descForm = parseFloat(form.descuento_prestamo) || 0
    if (descForm > 0 && !form.prestamo_id) { alert('Este empleado no tiene préstamo activo al cual aplicar el descuento.'); return }
    setSaving(true)
    const { error, id } = await ig.addNomina({
      semana: parseInt(form.semana), anio: parseInt(form.anio),
      cuadrilla_id: form.cuadrilla_id || null,
      empleado_id: form.empleado_id,
      dias_trabajados: parseFloat(form.dias_trabajados),
      sueldo_diario: sueldoDiario,
      sueldo_semana: sueldoSemana,
      viaticos: parseFloat(form.viaticos) || 0,
      anticipo_operativo: parseFloat(form.anticipo_operativo) || 0,
      descuento_prestamo: descForm,
      prestamo_id: descForm > 0 ? (form.prestamo_id || null) : null,
      reembolso_gastos: reembolsoForm,
      notas: ig.notaReembolso(reembolsosForm),
      neto_pagar: neto,
      fecha_pago: form.fecha_pago || null,
    })
    if (!error && id && reembolsosForm.length) await ig.marcarReembolsados(reembolsosForm, id, form.fecha_pago || null)
    if (!error && id && descForm > 0 && form.prestamo_id) await ig.aplicarDescuento(form.prestamo_id, descForm)
    setSaving(false)
    if (error) { alert('Error al guardar: ' + error.message); return }
    setModal(false)
    setForm(FORM_INICIAL(ANIO_ACTUAL))
  }

  async function generarNominaAutomatica() {
    if (!autoForm.semana) { alert('Selecciona la semana.'); return }
    const omitidos = [...new Set(autoForm.seleccionados)].filter(id => idsConNomina.has(id)).length
    if (!porGenerar.length) {
      alert(`No hay empleados por generar para la semana ${autoForm.semana}. ${omitidos ? `${omitidos} ya tienen nómina.` : 'Selecciona al menos uno.'}`)
      return
    }
    if (!confirm(`Se crearán ${porGenerar.length} registros de nómina.${omitidos ? ` ${omitidos} omitidos (ya tienen nómina esta semana).` : ''}${reembolsoAutoTotal > 0 ? `\nIncluye ${ig.fmt$(reembolsoAutoTotal)} en reembolsos de dinero prestado.` : ''}${descuentoAutoTotal > 0 ? `\nSe descontarán ${ig.fmt$(descuentoAutoTotal)} de préstamos activos (los saldos se actualizan solos).` : ''}\n\n¿Continuar?`)) return

    setAutoSaving(true)
    const diasTrabajados = 6
    const reembolsosPorEmp = {}
    const descuentosPorEmp = {}
    const filas = porGenerar.map(e => {
      const sd = Number(e.sueldo_diario)
      const ss = sd * diasTrabajados
      const viaticos = autoForm.viaticos_modo === 'empleado'
        ? Number(e.viaticos_default || 0)
        : autoForm.viaticos_modo === 'general' ? parseFloat(autoForm.viaticos_general || 0) : 0
      const items = ig.getReembolsosPendientes(e.id)
      const reembolso = items.reduce((a, i) => a + i.monto, 0)
      if (items.length) reembolsosPorEmp[e.id] = items
      const prest = prestamoActivoDe(e.id)
      const desc = descuentoSugerido(prest)
      if (prest && desc > 0) descuentosPorEmp[e.id] = { prestamo_id: prest.id, monto: desc }
      return {
        semana: autoSemana, anio: autoAnio,
        cuadrilla_id: e.cuadrilla_id || null,
        empleado_id: e.id,
        dias_trabajados: diasTrabajados,
        sueldo_diario: sd, sueldo_semana: ss, viaticos,
        anticipo_operativo: 0,
        descuento_prestamo: desc,
        prestamo_id: desc > 0 ? prest.id : null,
        reembolso_gastos: reembolso,
        notas: ig.notaReembolso(items),
        neto_pagar: ss + viaticos + reembolso - desc,
        fecha_pago: autoForm.fecha_pago || null,
      }
    })
    const { error, data } = await ig.addNominaLote(filas)
    if (!error) {
      for (const row of data) {
        const items = reembolsosPorEmp[row.empleado_id]
        if (items) await ig.marcarReembolsados(items, row.id, autoForm.fecha_pago || null)
        const d = descuentosPorEmp[row.empleado_id]
        if (d) await ig.aplicarDescuento(d.prestamo_id, d.monto)
      }
    }
    setAutoSaving(false)
    if (error) { alert('Error al generar nómina: ' + error.message); return }
    setAutoModal(false)
    alert(`Nómina generada: ${filas.length} registros creados.`)
  }

  return (
    <div>
      <div className="page-header">
        <div><h2>Nómina semanal</h2><div className="page-header-sub">Pagos por semana organizados por cuadrilla</div></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-gold" onClick={openAuto}>⚡ Generar nómina</button>
          <button className="btn" style={{ background: '#0F3460', color: '#fff', border: 'none' }} onClick={exportarPDF}>Exportar PDF</button>
          <button className="btn btn-primary" onClick={() => setModal(true)}>+ Registrar pago</button>
        </div>
      </div>

      <div style={{ background: '#0F3460', color: '#fff', borderRadius: 10, padding: '8px 18px', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
        <span style={{ color: '#F5A623', fontSize: 22, fontWeight: 700 }}>{SEM_ACTUAL}</span>
        <span>Semana actual (vie–jue) · {fmtSemanaLabel(semActual)} · hoy {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      </div>

      <div className="card mb-4">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <button type="button" className="btn btn-outline" onClick={() => moverSemana(-1)}>‹ Anterior</button>
          <div style={{ width: 90 }}><label className="label">Semana</label><input className="input" type="number" min="1" max="53" placeholder="Todas" value={filtros.semana} onChange={setFilt('semana')} /></div>
          <div style={{ width: 100 }}><label className="label">Año</label><input className="input" type="number" value={filtros.anio} onChange={setFilt('anio')} /></div>
          <button type="button" className="btn btn-outline" onClick={() => moverSemana(1)}>Siguiente ›</button>
          <button type="button" className={`btn ${semFiltroNum === SEM_ACTUAL ? 'btn-outline' : 'btn-gold'}`} onClick={irSemanaActual} disabled={semFiltroNum === SEM_ACTUAL}>Semana actual</button>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--tc-text-muted)' }}>
            {semFiltroRango ? `Sem ${semFiltroNum}: ${fmtSemanaLabel(semFiltroRango)}` : 'Mostrando todas las semanas'}
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label className="label" style={{ marginBottom: 0 }}>Cuadrillas (selecciona una o varias)</label>
            {filtros.cuadrillas.length > 0 && (
              <button className="btn btn-outline btn-sm" onClick={() => setFiltros(f => ({ ...f, cuadrillas: [] }))}>Ver todas</button>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {db.cuadrillas.map(c => (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--tc-text)' }}>
                <input type="checkbox" style={{ width: 'auto' }}
                  checked={filtros.cuadrillas.includes(c.id)}
                  onChange={e => setFiltros(f => ({
                    ...f,
                    cuadrillas: e.target.checked ? [...f.cuadrillas, c.id] : f.cuadrillas.filter(id => id !== c.id)
                  }))} />
                {c.nombre}
              </label>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--tc-text-muted)', marginTop: 8 }}>
            {filtros.cuadrillas.length === 0
              ? 'Mostrando todas las cuadrillas'
              : `${filtros.cuadrillas.length} cuadrilla${filtros.cuadrillas.length !== 1 ? 's' : ''} seleccionada${filtros.cuadrillas.length !== 1 ? 's' : ''}`}
          </div>
        </div>
      </div>

      <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(5,minmax(0,1fr))' }}>
        <div className="metric metric-light"><div className="metric-label">Empleados</div><div className="metric-value" style={{ color: 'var(--tc-text)' }}>{rows.length}</div></div>
        <div className="metric metric-light"><div className="metric-label">Total sueldos</div><div className="metric-value" style={{ color: '#A82020' }}>{ig.fmt$(totalSueldos)}</div></div>
        <div className="metric metric-light"><div className="metric-label">Total viáticos</div><div className="metric-value" style={{ color: '#946200' }}>{ig.fmt$(totalViaticos)}</div></div>
        <div className="metric metric-gold"><div className="metric-label">Desc. préstamos</div><div className="metric-value">{ig.fmt$(totalDescuentos)}</div></div>
        <div className="metric metric-primary"><div className="metric-label">Neto a pagar</div><div className="metric-value">{ig.fmt$(totalNeto)}</div>{totalReembolsos > 0 && <div className="metric-sub">Incluye {ig.fmt$(totalReembolsos)} reembolsos</div>}</div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="w-full">
          <thead><tr>
            <th className="th" style={{ width: '70px' }}>N° Emp.</th>
            <th className="th">Nombre</th>
            <th className="th" style={{ width: '45px', textAlign: 'center' }}>Días</th>
            <th className="th" style={{ width: '75px', textAlign: 'right' }}>S.Diario</th>
            <th className="th" style={{ width: '85px', textAlign: 'right' }}>Sueldo</th>
            <th className="th" style={{ width: '75px', textAlign: 'right' }}>Viáticos</th>
            <th className="th" style={{ width: '80px', textAlign: 'right' }}>Anticipo</th>
            <th className="th" style={{ width: '85px', textAlign: 'right' }}>Reembolso</th>
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
                  <td colSpan={11} style={{ padding: '8px 12px', fontWeight: 500, fontSize: 12, color: '#fff' }}>
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
                      <td className="td" style={{ fontWeight: 500 }}>
                        {emp.nombre}
                        {r.notas && <div style={{ fontSize: 11, fontWeight: 400, color: '#946200', marginTop: 2 }}>{r.notas}</div>}
                      </td>
                      <td className="td" style={{ textAlign: 'center' }}>{r.dias_trabajados}</td>
                      <td className="td" style={{ textAlign: 'right', fontSize: 11 }}>{ig.fmt$(r.sueldo_diario)}</td>
                      <td className="td" style={{ textAlign: 'right' }}>{ig.fmt$(r.sueldo_semana)}</td>
                      <td className="td" style={{ textAlign: 'right' }}>{ig.fmt$(r.viaticos)}</td>
                      <td className="td" style={{ textAlign: 'right', color: '#1A4FA0' }}>{r.anticipo_operativo > 0 ? ig.fmt$(r.anticipo_operativo) : <span style={{ color: '#A0AABB' }}>—</span>}</td>
                      <td className="td" style={{ textAlign: 'right', color: '#946200' }}>{r.reembolso_gastos > 0 ? `+${ig.fmt$(r.reembolso_gastos)}` : <span style={{ color: '#A0AABB' }}>—</span>}</td>
                      <td className="td" style={{ textAlign: 'right', color: '#A82020' }}>{r.descuento_prestamo > 0 ? `-${ig.fmt$(r.descuento_prestamo)}` : <span style={{ color: '#A0AABB' }}>—</span>}</td>
                      <td className="td" style={{ textAlign: 'right', fontWeight: 500, color: 'var(--tc-text)' }}>{ig.fmt$(r.neto_pagar)}</td>
                      <td className="td">
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(r)}>Editar</button>
                          <button className="btn btn-outline btn-sm" style={{ color: '#A82020' }} onClick={() => { if (confirm(`¿Eliminar este registro?${r.reembolso_gastos > 0 ? ' Los reembolsos incluidos volverán a quedar pendientes.' : ''}`)) ig.deleteNomina(r.id) }}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  )
                }),
              ]
            }) : <tr><td colSpan={11} className="td" style={{ textAlign: 'center', color: '#A0AABB', padding: '2rem' }}>Sin registros de nómina.</td></tr>}
          </tbody>
        </table>
      </div>

      {rows.length > 0 && (
        <div style={{ background: 'var(--tc-surface)', border: '1px solid var(--tc-border)', borderRadius: 12, padding: '1rem 1.25rem', marginTop: '1rem' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--tc-text)', marginBottom: 10 }}>Resumen total — Semana {filtros.semana || '—'}, {filtros.anio}</div>
          {[
            { label: 'Total sueldos', val: ig.fmt$(totalSueldos), color: '#A82020' },
            { label: 'Total viáticos', val: ig.fmt$(totalViaticos), color: '#A82020' },
            { label: 'Anticipos operativos', val: ig.fmt$(totalAnticipos), color: '#1A4FA0' },
            { label: 'Reembolsos de dinero prestado (ya contados en gastos)', val: ig.fmt$(totalReembolsos), color: '#946200' },
            { label: 'Descuentos préstamos', val: '+' + ig.fmt$(totalDescuentos), color: '#1A7A45' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--tc-border)', fontSize: 13 }}>
              <span style={{ color: 'var(--tc-text-muted)' }}>{label}</span><span style={{ color }}>{val}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--tc-border)', marginTop: 6, paddingTop: 4 }} />
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--tc-text-muted)', margin: '8px 0 6px' }}>Gastos fijos y variables de la semana</div>
          {gastosSemana.length === 0
            ? <div style={{ fontSize: 12, color: '#A0AABB', marginBottom: 8 }}>Sin gastos registrados esta semana.</div>
            : [...new Set(gastosSemana.map(r => r.categoria))].map(cat => {
                const subtotal = gastosSemana.filter(r => r.categoria === cat).reduce((a, r) => a + Number(r.monto), 0)
                return (
                  <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--tc-border)', fontSize: 13 }}>
                    <span style={{ color: 'var(--tc-text-muted)' }}>{cat}</span><span style={{ color: '#A82020' }}>{ig.fmt$(subtotal)}</span>
                  </div>
                )
              })
          }
          <div style={{ borderTop: '1px solid var(--tc-border)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 500 }}>
            <span style={{ color: 'var(--tc-text)' }}>Total egresos de la semana</span>
            <span style={{ color: '#A82020' }}>{ig.fmt$(totalNeto - totalReembolsos + totalGastos)}</span>
          </div>
          {totalReembolsos > 0 && <div style={{ fontSize: 11, color: 'var(--tc-text-muted)', marginTop: 4 }}>Los reembolsos se restan del neto para no contarlos dos veces (ya están dentro de gastos).</div>}
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
          <div style={{ background: 'var(--tc-bg)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--tc-text-muted)', marginBottom: 6 }}>Descuento de préstamo personal <span style={{ fontWeight: 400 }}>— el saldo se actualiza solo al guardar</span></div>
            {form.empleado_id && ig.prestamos.filter(p => p.empleado_id === form.empleado_id && p.estado === 'Activo').length > 0 ? (
              ig.prestamos.filter(p => p.empleado_id === form.empleado_id && p.estado === 'Activo').map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12 }}>Saldo: <strong style={{ color: '#A82020' }}>{ig.fmt$(p.saldo)}</strong></span>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <label className="label">Descuento esta semana ($) · sugerido {ig.fmt$(p.descuento_semanal)}</label>
                    <input className="input" type="number" min="0" max={p.saldo} value={form.prestamo_id === p.id ? form.descuento_prestamo : '0'} disabled={form.prestamo_id !== p.id} onChange={setF('descuento_prestamo')} />
                  </div>
                  <span style={{ fontSize: 12 }}>Saldo después: <strong style={{ color: '#946200' }}>{ig.fmt$(Math.max(0, Number(p.saldo) - (parseFloat(form.descuento_prestamo) || 0)))}</strong></span>
                </div>
              ))
            ) : <div style={{ fontSize: 12, color: '#A0AABB' }}>{form.empleado_id ? 'Sin préstamos activos.' : 'Selecciona un empleado primero.'}</div>}
          </div>

          {reembolsosForm.length > 0 && (
            <div style={{ background: 'rgba(245,166,35,0.12)', border: '1px solid #F5A623', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#946200', marginBottom: 6 }}>Reembolsos pendientes (dinero que prestó) — se agregan automáticamente</div>
              {reembolsosForm.map(i => (
                <div key={i.tipo + i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
                  <span style={{ color: 'var(--tc-text)' }}>{i.descripcion} · {i.fecha}</span>
                  <span style={{ color: '#946200', fontWeight: 500 }}>+{ig.fmt$(i.monto)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 500, borderTop: '1px solid #F5A623', marginTop: 6, paddingTop: 6 }}>
                <span>Total reembolso</span><span style={{ color: '#946200' }}>+{ig.fmt$(reembolsoForm)}</span>
              </div>
            </div>
          )}

          <div style={{ background: 'var(--tc-surface)', border: '1px solid var(--tc-border)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}><span style={{ color: 'var(--tc-text-muted)' }}>Sueldo + viáticos</span><span>{ig.fmt$(sueldoSemana + (parseFloat(form.viaticos) || 0))}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}><span style={{ color: 'var(--tc-text-muted)' }}>+ Anticipo operativo</span><span style={{ color: '#1A4FA0' }}>+{ig.fmt$(parseFloat(form.anticipo_operativo) || 0)}</span></div>
            {reembolsoForm > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}><span style={{ color: 'var(--tc-text-muted)' }}>+ Reembolso gastos</span><span style={{ color: '#946200' }}>+{ig.fmt$(reembolsoForm)}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}><span style={{ color: 'var(--tc-text-muted)' }}>- Descuento préstamo</span><span style={{ color: '#A82020' }}>-{ig.fmt$(parseFloat(form.descuento_prestamo) || 0)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 500, borderTop: '1px solid var(--tc-border)', paddingTop: 6 }}>
              <span>Neto a pagar</span><span style={{ color: 'var(--tc-text)' }}>{ig.fmt$(neto)}</span>
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
            <div style={{ background: 'var(--tc-bg)', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}>
              <div style={{ fontWeight: 500, color: 'var(--tc-text)' }}>{ig.getEmpleado(editRow.empleado_id).nombre}</div>
              <div style={{ fontSize: 12, color: 'var(--tc-text-muted)' }}>Sem {editRow.semana} · S.Diario: {ig.fmt$(editRow.sueldo_diario)}</div>
              {editRow.prestamo_id && <div style={{ fontSize: 12, color: '#A82020', marginTop: 4 }}>Al cambiar el descuento se ajusta el saldo del préstamo automáticamente.</div>}
              {editRow.reembolso_gastos > 0 && <div style={{ fontSize: 12, color: '#946200', marginTop: 4 }}>Reembolso incluido: <strong>+{ig.fmt$(editRow.reembolso_gastos)}</strong> (fijo; para cambiarlo elimina el registro y vuelve a generarlo)</div>}
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
            <div style={{ background: 'var(--tc-surface)', border: '1px solid var(--tc-border)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 500 }}>
                <span>Neto a pagar</span><span style={{ color: 'var(--tc-text)' }}>{ig.fmt$(editNeto)}</span>
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
            Base: lista de empleados activos. Se generan 6 días por persona seleccionada. Quien ya tenga nómina en esa semana aparece deshabilitado. Los reembolsos de dinero prestado y los descuentos de préstamos activos se aplican automáticamente.
          </div>
          <div className="form-row c3">
            <div><label className="label">Semana # *</label>
              <input className="input" type="number" min="1" max="53" placeholder="36" value={autoForm.semana}
                onChange={e => setAutoForm(f => ({ ...f, semana: e.target.value }))} />
            </div>
            <div><label className="label">Año</label>
              <input className="input" type="number" value={autoForm.anio}
                onChange={e => setAutoForm(f => ({ ...f, anio: e.target.value }))} />
            </div>
            <div><label className="label">Fecha de pago</label>
              <input className="input" type="date" value={autoForm.fecha_pago}
                onChange={e => setAutoForm(f => ({ ...f, fecha_pago: e.target.value }))} />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label className="label" style={{ marginBottom: 0 }}>Empleados a incluir *</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => toggleSel(ig.empleados.map(e => e.id), true)}>Todos</button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => toggleSel(ig.empleados.map(e => e.id), false)}>Ninguno</button>
              </div>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--tc-border)', borderRadius: 8 }}>
              {gruposAuto.map(g => {
                const ids = g.emps.map(e => e.id)
                const marcados = ids.filter(id => autoForm.seleccionados.includes(id)).length
                return (
                  <div key={g.id}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#0F3460', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                      <input type="checkbox" style={{ width: 'auto' }}
                        checked={marcados === ids.length}
                        ref={el => { if (el) el.indeterminate = marcados > 0 && marcados < ids.length }}
                        onChange={e => toggleSel(ids, e.target.checked)} />
                      {g.nombre} <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 400 }}>· {marcados}/{ids.length}</span>
                    </label>
                    {g.emps.map(e => {
                      const yaTiene = idsConNomina.has(e.id)
                      const repetido = nombresRepetidos.has(normNombre(e.nombre))
                      const reemb = ig.getReembolsosPendientes(e.id).reduce((a, i) => a + i.monto, 0)
                      const desc = descuentoSugerido(prestamoActivoDe(e.id))
                      return (
                        <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px 5px 24px', fontSize: 13, cursor: yaTiene ? 'default' : 'pointer', color: yaTiene ? 'var(--tc-text-muted)' : 'var(--tc-text)', background: repetido && !yaTiene ? 'rgba(245,166,35,0.12)' : 'transparent', borderBottom: '1px solid var(--tc-border)' }}>
                          <input type="checkbox" style={{ width: 'auto' }} disabled={yaTiene}
                            checked={!yaTiene && autoForm.seleccionados.includes(e.id)}
                            onChange={ev => toggleSel([e.id], ev.target.checked)} />
                          <span style={{ color: 'var(--tc-text-muted)', fontSize: 11, minWidth: 34 }}>{e.numero}</span>
                          <span style={{ flex: 1 }}>{e.nombre}</span>
                          <span style={{ fontSize: 11, color: 'var(--tc-text-muted)' }}>{ig.fmt$(e.sueldo_diario)}/día</span>
                          {reemb > 0 && !yaTiene && <span className="badge badge-amber" style={{ fontSize: 10 }}>+{ig.fmt$(reemb)} reembolso</span>}
                          {desc > 0 && !yaTiene && <span className="badge badge-red" style={{ fontSize: 10 }}>-{ig.fmt$(desc)} préstamo</span>}
                          {yaTiene && <span className="badge badge-green" style={{ fontSize: 10 }}>Ya tiene nómina</span>}
                          {repetido && !yaTiene && <span className="badge badge-amber" style={{ fontSize: 10 }}>Nombre repetido</span>}
                        </label>
                      )
                    })}
                  </div>
                )
              })}
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
          <div style={{ background: 'var(--tc-bg)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--tc-text-muted)' }}>
            Se generarán: <strong style={{ color: 'var(--tc-text)' }}>{porGenerar.length}</strong> registros
            {reembolsoAutoTotal > 0 && <> · <span style={{ color: '#946200' }}>incluye {ig.fmt$(reembolsoAutoTotal)} en reembolsos</span></>}
            {descuentoAutoTotal > 0 && <> · <span style={{ color: '#A82020' }}>descuenta {ig.fmt$(descuentoAutoTotal)} de préstamos</span></>}
            {autoForm.semana && idsConNomina.size > 0 && <> · <span style={{ color: '#1A7A45' }}>{idsConNomina.size} ya tienen nómina en la semana {autoForm.semana}</span></>}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn btn-outline" onClick={() => setAutoModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={generarNominaAutomatica} disabled={autoSaving || !porGenerar.length}>
              {autoSaving ? 'Generando...' : `Generar nómina (${porGenerar.length})`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
