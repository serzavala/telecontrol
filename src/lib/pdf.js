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
    const tableEndY = doc.lastAutoTable.finalY + 6
    const boxX = 12
    const boxW = pageW - 24
    const rowH = 6.5
    const boxH = 42
    const boxY = tableEndY

    // Fondo y borde
    doc.setFillColor(240, 245, 255)
    doc.setDrawColor(15, 52, 96)
    doc.setLineWidth(0.4)
    doc.roundedRect(boxX, boxY, boxW, boxH, 2, 2, 'FD')

    // Título
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(15, 52, 96)
    doc.text('RESUMEN DE FACTURACIÓN', boxX + 4, boxY + 5.5)
    doc.setLineWidth(0.3)
    doc.line(boxX + 4, boxY + 7, boxX + boxW - 4, boxY + 7)

    const colL  = boxX + 4
    const valL  = boxX + boxW / 2 - 4
    const colR  = boxX + boxW / 2 + 4
    const valR  = boxX + boxW - 4
    let y = boxY + 7 + rowH

    const leftRows = [
      ['Mi estimado registrado', fmt$(total)],
      ['Anticipo (ya cobrado)',  `-${fmt$(antic)}`],
      ['Mi estimado neto',       fmt$(total - antic)],
      ['Diferencia (cliente - neto)', (diferencia >= 0 ? '+' : '') + fmt$(diferencia)],
    ]
    const rightRows = [
      ['Total cliente (subtotal)', fmt$(oficial)],
      ['IVA (16%)',                fmt$(iva)],
      ['TOTAL A FACTURAR',        fmt$(totalFact)],
    ]

    leftRows.forEach(([label, val], i) => {
      const bold = i === leftRows.length - 1
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(60, 60, 60)
      doc.text(label, colL, y + i * rowH)
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      const color = bold ? (diferencia >= 0 ? [20, 140, 60] : [180, 30, 30]) : [60, 60, 60]
      doc.setTextColor(...color)
      doc.text(val, valL, y + i * rowH, { align: 'right' })
    })

    rightRows.forEach(([label, val], i) => {
      const bold = i === rightRows.length - 1
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      doc.setFontSize(bold ? 8.5 : 7.5)
      doc.setTextColor(bold ? 15 : 60, bold ? 52 : 60, bold ? 96 : 60)
      doc.text(label, colR, y + i * rowH)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(bold ? 20 : 60, bold ? 120 : 60, bold ? 60 : 60)
      doc.text(val, valR, y + i * rowH, { align: 'right' })
    })

    if (comentarios) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(7)
      doc.setTextColor(100, 100, 100)
      doc.text(`Notas: ${comentarios}`, colL, boxY + boxH - 3)
    }

    // Footer debajo del recuadro
    addFooter(doc, totalFact, boxY + boxH + 4)
  } else {
    addFooter(doc, total)
  }

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
