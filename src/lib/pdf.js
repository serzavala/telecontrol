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

function addFooter(doc, total) {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  doc.setDrawColor(15, 52, 96)
  doc.setLineWidth(0.5)
  doc.line(12, pageH - 30, pageW - 12, pageH - 30)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(15, 52, 96)
  doc.text('TOTAL A COBRAR:', pageW - 68, pageH - 24)
  doc.setFontSize(12)
  doc.setTextColor(20, 120, 60)
  doc.text(fmt$(total), pageW - 12, pageH - 24, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text('Firma autorizada: ________________________________', 12, pageH - 16)
  doc.text('Fecha: ____________________', 12, pageH - 10)
  doc.text('NOVUS — Innovacion y Futuro', pageW - 12, pageH - 10, { align: 'right' })
}

export function generarPDFSemanal({ rows, periodo, getCuadrilla, getProyecto, getConcepto }) {
  const doc = new jsPDF({ orientation: 'landscape' })
  const hoy = new Date().toLocaleDateString('es-MX')
  const total = rows.reduce((a, r) => a + Number(r.total), 0)
  const startY = addHeader(doc, 'CORTE DE PRODUCCION SEMANAL', 'Pago Izzi-Monstel 2026', [
    { label: 'Fecha de emision', value: hoy },
    { label: 'Periodo', value: periodo || 'Todo el periodo' },
    { label: 'Registros', value: String(rows.length) },
  ])
  const tableData = rows.map(r => {
    const c = getCuadrilla(r.cuadrilla_id)
    const p = getProyecto(r.proyecto_id)
    const cn = getConcepto(r.concepto_id)
    return [r.fecha, c.nombre, `${cn.num || ''}. ${cn.nombre}`, `${p.nombre} - ${p.ciudad}`, `${Number(r.cantidad).toLocaleString('es-MX')} ${cn.unidad || ''}`, fmt$(r.precio_unitario), fmt$(r.total)]
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
  addFooter(doc, total)
  doc.save(`corte-semanal-${hoy.replace(/\//g, '-')}.pdf`)
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
