import jsPDF from 'jspdf'
import 'jspdf-autotable'

const fmt$ = (n) => '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const LINE = '='.repeat(50)

export function generarPDFSemanal({ rows, periodo, getCuadrilla, getProyecto, getConcepto }) {
  const doc = new jsPDF()
  const hoy = new Date().toLocaleDateString('es-MX')
  const total = rows.reduce((a, r) => a + Number(r.total), 0)

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('CORTE DE PRODUCCIÓN SEMANAL', 14, 20)
  doc.setFontSize(11)
  doc.text('Pago Izzi-Monstel 2026', 14, 28)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Fecha de emisión: ${hoy}`, 14, 36)
  doc.text(`Período: ${periodo}`, 14, 42)

  const tableData = rows.map(r => {
    const c = getCuadrilla(r.cuadrilla_id)
    const p = getProyecto(r.proyecto_id)
    const cn = getConcepto(r.concepto_id)
    return [
      r.fecha,
      c.nombre,
      `${cn.num || ''}. ${cn.nombre}`,
      `${p.nombre} — ${p.ciudad}`,
      `${Number(r.cantidad).toLocaleString('es-MX')} ${cn.unidad}`,
      fmt$(r.precio_unitario),
      fmt$(r.total)
    ]
  })

  doc.autoTable({
    startY: 50,
    head: [['Fecha', 'Cuadrilla', 'Concepto', 'Proyecto', 'Cantidad', 'P.Unit.', 'Total']],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 30, 30] },
    columnStyles: { 5: { halign: 'right' }, 6: { halign: 'right' } },
    foot: [['', '', '', '', '', 'TOTAL:', fmt$(total)]],
    footStyles: { fontStyle: 'bold', fillColor: [240, 240, 240] }
  })

  doc.save(`corte-semanal-${hoy.replace(/\//g, '-')}.pdf`)
}

export function generarPDFCN({ rows, periodoLabel, diaCobro, getCuadrilla, getProyecto }) {
  const doc = new jsPDF()
  const hoy = new Date().toLocaleDateString('es-MX')
  const total = rows.reduce((a, r) => a + Number(r.monto), 0)

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('CORTE QUINCENAL — CASOS DE NEGOCIO (CN)', 14, 20)
  doc.setFontSize(11)
  doc.text('Izzi-Monstel 2026', 14, 28)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Fecha de emisión: ${hoy}`, 14, 36)
  doc.text(`Quincena: ${periodoLabel}`, 14, 42)
  doc.text(`Fecha de cobro: Día ${diaCobro} del mes`, 14, 48)

  const tableData = rows.map(r => {
    const c = getCuadrilla(r.cuadrilla_id)
    const p = getProyecto(r.proyecto_id)
    return [c.nombre, `${p.nombre} — ${p.ciudad}`, periodoLabel, fmt$(r.monto), r.estado]
  })

  doc.autoTable({
    startY: 56,
    head: [['Cuadrilla', 'Proyecto', 'Período', 'Monto', 'Estado']],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 30, 30] },
    columnStyles: { 3: { halign: 'right' } },
    foot: [['', '', 'TOTAL:', fmt$(total), '']],
    footStyles: { fontStyle: 'bold', fillColor: [240, 240, 240] }
  })

  const finalY = doc.lastAutoTable.finalY + 20
  doc.setFontSize(9)
  doc.text('Firma autorizada: ____________________', 14, finalY)
  doc.text(`Fecha: ____________________`, 14, finalY + 8)

  doc.save(`corte-cn-${periodoLabel.replace(/\s/g, '-')}.pdf`)
}
