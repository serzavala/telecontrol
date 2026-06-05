import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { LOGO_NOVUS } from './logo'

const fmt$ = (n) => '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function addHeader(doc, titulo, subtitulo, detalles) {
  const pageW = doc.internal.pageSize.getWidth()
  try { doc.addImage(LOGO_NOVUS, 'PNG', 12, 8, 28, 28) } catch (e) {}
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(15, 52, 96)
  doc.text('NOVUS', 44, 17)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(80, 80, 80)
  doc.text('Innovacion y Futuro', 44, 22)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(15, 52, 96)
  doc.text(titulo, pageW - 12, 14, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.text(subtitulo, pageW - 12, 20, { align: 'right' })
  doc.setDrawColor(15, 52, 96)
  doc.setLineWidth(0.8)
  doc.line(12, 38, pageW - 12, 38)
  doc.setFontSize(8.5)
  doc.setTextColor(60, 60, 60)
  let y = 44
  detalles.forEach(({ label, value }) => {
    doc.setFont('helvetica', 'bold')
    doc.text(label + ':', 12, y)
    doc.setFont('helvetica', 'normal')
    doc.text(value, 50, y)
    y += 5.5
  })
  return y + 3
}

function addFooter(doc, total, startY) {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const y = startY || pageH - 30
  doc.setDrawColor(15, 52, 96)
  doc.setLineWidth(0.5)
  doc.line(12, y, pageW - 12, y)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(15, 52, 96)
  doc.text('TOTAL A COBRAR:', pageW - 68, y + 6)
  doc.setFontSize(12)
  doc.setTextColor(20, 120, 60)
  doc.text(fmt$(total), pageW - 12, y + 6, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text('Firma autorizada: ________________________________', 12, y + 14)
  doc.text('Fecha: ____________________', 12, y + 20)
  doc.text('NOVUS — Innovacion y Futuro', pageW - 12, y + 20, { align: 'right' })
}

export function generarPDFSemanal({ rows, periodo, getCuadrilla, getProyecto, getConcepto, corte }) {
  const doc = new jsPDF({ orientation: 'landscape' })
  const hoy = new Date().toLocaleDateString('es-MX')
  const totalProduccion = rows.reduce((a, r) => a + Number(r.total), 0)

  // Si viene de historial usamos los datos guardados, si no los calculamos en vivo
  const oficial    = corte ? Number(corte.cifra_oficial   || 0) : 0
  const antic      = corte ? Number(corte.anticipo        || 0) : 0
  const iva        = corte ? Number(corte.iva             || 0) : oficial * 0.16
  const totalFact  = corte ? Number(corte.total_facturar  || 0) : oficial + iva
  const diferencia = oficial - (totalProduccion - antic)
  const comentarios = corte?.comentarios_facturacion || ''

  const startY = addHeader(doc, 'CORTE DE PRODUCCION SEMANAL', 'Pago Izzi-Monstel 2026', [
    { label: 'Fecha de emision',  value: hoy },
    { label: 'Periodo',           value: periodo || 'Todo el periodo' },
    { label: 'Registros',         value: String(rows.length) },
  ])

  // Tabla de producción
  const tableData = rows.map(r => {
    const c  = getCuadrilla(r.cuadrilla_id)
    const p  = getProyecto(r.proyecto_id)
    const cn = getConcepto(r.concepto_id)
    return [r.fecha, c.nombre, `${cn.num || ''}. ${cn.nombre}`, `${p.nombre} - ${p.ciudad}`,
            `${Number(r.cantidad).toLocaleString('es-MX')} ${cn.unidad || ''}`,
            fmt$(r.precio_unitario), fmt$(r.total)]
  })

  doc.autoTable({
    startY,
    head: [['Fecha', 'Cuadrilla', 'Concepto', 'Proyecto / Ciudad', 'Cantidad', 'P. Unit.', 'Total']],
    body: tableData,
    styles: { fontSize: 8.5, cellPadding: 3, font: 'helvetica', textColor: [40, 40, 40] },
    headStyles: { fillColor: [15, 52, 96], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5, halign: 'center' },
    alternateRowStyles: { fillColor: [240, 245, 255] },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 35 },
      2: { cellWidth: 58 },
      3: { cellWidth: 55 },
      4: { cellWidth: 35, halign: 'center' },
      5: { cellWidth: 24, halign: 'right' },
      6: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 12, right: 12 },
    tableLineColor: [200, 210, 230],
    tableLineWidth: 0.3,
  })

  // Bloque de facturación (solo si hay cifra oficial)
 if (oficial > 0) {
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()

    // Footer en página de producción con mi estimado
    addFooter(doc, total)

    // ── PÁGINA 2: Resumen de facturación ──
    doc.addPage()

    // Encabezado igual al de la primera página
    addHeader(doc, 'RESUMEN DE FACTURACIÓN', `Período: ${periodo || 'Todo el período'}`, [
      { label: 'Proyecto', value: doc.internal.pages[1] ? (periodo || '') : '' },
    ])

    const cx = pageW / 2
    let y = 60

    // Función helper para una fila del resumen
    function filaResumen(label, valor, color, tamLabel, tamValor, negrita) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(tamLabel || 10)
      doc.setTextColor(100, 100, 100)
      doc.text(label, cx - 10, y, { align: 'right' })
      doc.setFont('helvetica', negrita ? 'bold' : 'normal')
      doc.setFontSize(tamValor || 12)
      doc.setTextColor(...(color || [40, 40, 40]))
      doc.text(valor, cx + 10, y)
      y += negrita ? 14 : 10
    }

    // ── Bloque izquierdo: mi estimado ──
    const boxPad = 16
    const boxW = pageW - 32

    // Recuadro MI ESTIMADO
    doc.setFillColor(245, 248, 255)
    doc.setDrawColor(180, 200, 230)
    doc.setLineWidth(0.5)
    doc.roundedRect(16, y - 6, boxW, 52, 3, 3, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(100, 120, 160)
    doc.text('MI ESTIMADO', 16 + boxPad, y + 2)
    y += 10

    filaResumen('Producción registrada', fmt$(total), [40, 40, 40], 10, 12)
    filaResumen('Anticipo ya cobrado', `-${fmt$(antic)}`, [200, 50, 50], 10, 12)

    // Línea separadora
    doc.setDrawColor(180, 200, 230)
    doc.setLineWidth(0.4)
    doc.line(16 + boxPad, y - 2, pageW - 16 - boxPad, y - 2)

    filaResumen('Mi estimado neto', fmt$(total - antic), [15, 52, 96], 10, 13, true)

    y += 10

    // Recuadro CLIENTE
    doc.setFillColor(245, 255, 248)
    doc.setDrawColor(150, 210, 180)
    doc.setLineWidth(0.5)
    doc.roundedRect(16, y - 6, boxW, 42, 3, 3, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(80, 150, 110)
    doc.text('CIFRAS DEL CLIENTE', 16 + boxPad, y + 2)
    y += 10

    filaResumen('Total cliente (subtotal)', fmt$(oficial), [40, 40, 40], 10, 12)
    filaResumen('IVA (16%)', fmt$(iva), [40, 40, 40], 10, 12)

    doc.setDrawColor(150, 210, 180)
    doc.setLineWidth(0.4)
    doc.line(16 + boxPad, y - 2, pageW - 16 - boxPad, y - 2)

    filaResumen('Total a facturar', fmt$(totalFact), [20, 120, 60], 11, 15, true)

    y += 10

    // Recuadro DIFERENCIA
    const difPos = diferencia >= 0
    doc.setFillColor(difPos ? 245 : 255, difPos ? 255 : 245, difPos ? 248 : 245)
    doc.setDrawColor(difPos ? 150 : 210, difPos ? 210 : 150, difPos ? 180 : 150)
    doc.setLineWidth(0.5)
    doc.roundedRect(16, y - 6, boxW, 28, 3, 3, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(difPos ? 80 : 180, difPos ? 150 : 60, difPos ? 110 : 60)
    doc.text('DIFERENCIA (cliente − mi estimado neto)', 16 + boxPad, y + 2)
    y += 10

    filaResumen(
      difPos ? 'A favor' : 'En contra',
      (diferencia >= 0 ? '+' : '') + fmt$(diferencia),
      difPos ? [20, 140, 70] : [180, 40, 40],
      11, 15, true
    )

    // Notas
    if (comentarios) {
      y += 6
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8.5)
      doc.setTextColor(120, 120, 120)
      doc.text(`Notas: ${comentarios}`, 16 + boxPad, y)
    }

    // Footer normal en página 2
    addFooter(doc, totalFact)
  } else {
    addFooter(doc, total)
  }

    // Footer deb

  doc.save(`corte-semanal-${periodo?.replace(/\//g, '-') || hoy.replace(/\//g, '-')}.pdf`)

  addFooter(doc, oficial > 0 ? totalFact : totalProduccion)
  doc.save(`corte-semanal-${periodo?.replace(/\//g, '-') || hoy.replace(/\//g, '-')}.pdf`)
}

export function generarPDFCN({ rows, periodoLabel, diaCobro, getCuadrilla, getProyecto }) {
  const doc = new jsPDF({ orientation: 'landscape' })
  const hoy = new Date().toLocaleDateString('es-MX')
  const total = rows.reduce((a, r) => a + Number(r.monto), 0)
  const startY = addHeader(doc, 'CORTE QUINCENAL CN', 'Casos de Negocio — Izzi-Monstel 2026', [
    { label: 'Fecha de emision', value: hoy },
    { label: 'Quincena', value: periodoLabel },
    { label: 'Fecha de cobro', value: `Dia ${diaCobro} del mes` },
  ])
  const tableData = rows.map(r => {
    const c = getCuadrilla(r.cuadrilla_id)
    const p = getProyecto(r.proyecto_id)
    return [c.nombre, `${p.nombre} - ${p.ciudad}`, periodoLabel, fmt$(r.monto), r.estado]
  })
  doc.autoTable({
    startY,
    head: [['Cuadrilla', 'Proyecto / Ciudad', 'Periodo', 'Monto', 'Estado']],
    body: tableData,
    styles: { fontSize: 9, cellPadding: 3.5, font: 'helvetica', textColor: [40, 40, 40] },
    headStyles: { fillColor: [15, 52, 96], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: [240, 245, 255] },
    columnStyles: {
  0: { cellWidth: 55 },
  1: { cellWidth: 85 },
  2: { cellWidth: 55 },
  3: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
  4: { cellWidth: 25, halign: 'center' },
},
    margin: { left: 12, right: 12 },
    tableLineColor: [200, 210, 230],
    tableLineWidth: 0,
  })
  addFooter(doc, total)
  doc.save(`corte-cn-${periodoLabel.replace(/\s/g, '-')}.pdf`)
}
