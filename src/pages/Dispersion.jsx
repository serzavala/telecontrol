import { useState } from 'react'
import { useIG } from '../hooks/useIG'
import { useDB } from '../hooks/useDB'
import Modal from '../components/Modal'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

export default function Dispersion() {
  const ig = useIG()
  const db = useDB()
  const hoy = new Date()

  // Filtros del historial
  const [filtros, setFiltros] = useState({ semana: '', fecha: '' })
  const setFilt = k => e => setFiltros(f => ({ ...f, [k]: e.target.value }))

  // Modal de nueva dispersión
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cabecera, setCabecera] = useState({ fecha: hoy.toISOString().split('T')[0], semana: '', anio: hoy.getFullYear(), total_dispersar: '', notas: '' })
  const [depositos, setDepositos] = useState([])

  // Modal de detalle (consulta)
  const [detalle, setDetalle] = useState(null)
  const [detalleDeps, setDetalleDeps] = useState([])

  const setC = k => e => setCabecera(c => ({ ...c, [k]: e.target.value }))

  // ── Historial filtrado ──
  const historial = ig.dispersiones.filter(d => {
    if (filtros.semana && d.semana != filtros.semana) return false
    if (filtros.fecha && d.fecha !== filtros.fecha) return false
    return true
  })

  // ── Cálculos del modal nuevo ──
  const totalObjetivo = parseFloat(cabecera.total_dispersar) || 0
  const totalRepartido = depositos.reduce((a, d) => a + d.monto, 0)
  const diferencia = totalObjetivo - totalRepartido
  const cuadra = Math.abs(diferencia) < 0.01 && totalObjetivo > 0 && depositos.length > 0

  // Empleados con datos bancarios para receptor
  const empleadosConCuenta = ig.empleados.filter(e => e.cuenta || e.clabe)

  // Nómina de la semana capturada (para jalar beneficiarios)
  const nominaSemana = cabecera.semana
    ? ig.nomina.filter(n => n.semana == cabecera.semana && n.anio == cabecera.anio)
    : []

  function abrirNueva() {
    setCabecera({ fecha: hoy.toISOString().split('T')[0], semana: '', anio: hoy.getFullYear(), total_dispersar: '', notas: '' })
    setDepositos([])
    setModal(true)
  }

  // ── Manejo de depósitos ──
  function agregarDeposito() {
    setDepositos(ds => [...ds, {
      cuenta_receptora_id: '',
      receptor_nombre: '',
      observaciones: '',
      beneficiarios: [],
      monto: 0,
    }])
  }

  function quitarDeposito(idx) {
    setDepositos(ds => ds.filter((_, i) => i !== idx))
  }

  function setReceptor(idx, empId) {
    const emp = ig.empleados.find(e => e.id === empId)
    setDepositos(ds => ds.map((d, i) => i === idx
      ? { ...d, cuenta_receptora_id: empId, receptor_nombre: emp ? emp.nombre : '' }
      : d))
  }

  function setObservaciones(idx, val) {
    setDepositos(ds => ds.map((d, i) => i === idx ? { ...d, observaciones: val } : d))
  }

  function recalcMonto(benef) {
    return benef.reduce((a, b) => a + (parseFloat(b.monto) || 0), 0)
  }

  // Agregar beneficiario desde nómina
  function agregarBenefNomina(idx, nominaRow) {
    const emp = ig.getEmpleado(nominaRow.empleado_id)
    setDepositos(ds => ds.map((d, i) => {
      if (i !== idx) return d
      const benef = [...d.beneficiarios, {
        empleado_id: nominaRow.empleado_id,
        nombre: emp.nombre,
        monto: Number(nominaRow.neto_pagar),
        origen: 'nomina',
      }]
      return { ...d, beneficiarios: benef, monto: recalcMonto(benef) }
    }))
  }

  // Agregar beneficiario manual
  function agregarBenefManual(idx) {
    setDepositos(ds => ds.map((d, i) => {
      if (i !== idx) return d
      const benef = [...d.beneficiarios, { empleado_id: null, nombre: '', monto: 0, origen: 'manual' }]
      return { ...d, beneficiarios: benef }
    }))
  }

  function setBenefCampo(depIdx, benIdx, campo, val) {
    setDepositos(ds => ds.map((d, i) => {
      if (i !== depIdx) return d
      const benef = d.beneficiarios.map((b, j) => j === benIdx ? { ...b, [campo]: val } : b)
      return { ...d, beneficiarios: benef, monto: recalcMonto(benef) }
    }))
  }

  function quitarBenef(depIdx, benIdx) {
    setDepositos(ds => ds.map((d, i) => {
      if (i !== depIdx) return d
      const benef = d.beneficiarios.filter((_, j) => j !== benIdx)
      return { ...d, beneficiarios: benef, monto: recalcMonto(benef) }
    }))
  }

  // ── Guardar ──
  async function guardar() {
    if (!cuadra) { alert('El total repartido debe cuadrar exactamente con el total a dispersar.'); return }
    if (!cabecera.semana) { alert('Captura el número de semana.'); return }
    // Validar que cada depósito tenga receptor
    for (const d of depositos) {
      if (!d.cuenta_receptora_id) { alert('Cada depósito debe tener una cuenta receptora seleccionada.'); return }
      if (!d.beneficiarios.length) { alert('Cada depósito debe tener al menos un beneficiario.'); return }
    }
    setSaving(true)
    const { error } = await ig.addDispersion(
      {
        fecha: cabecera.fecha,
        semana: parseInt(cabecera.semana),
        anio: parseInt(cabecera.anio),
        total_dispersar: totalObjetivo,
        notas: cabecera.notas || null,
      },
      depositos.map(d => ({
        cuenta_receptora_id: d.cuenta_receptora_id,
        receptor_nombre: d.receptor_nombre,
        monto: d.monto,
        beneficiarios: d.beneficiarios,
        observaciones: d.observaciones || null,
      }))
    )
    setSaving(false)
    if (error) { alert('Error al guardar: ' + error.message); return }
    setModal(false)
    alert('Dispersión guardada correctamente.')
  }

  // ── Detalle / consulta ──
  async function abrirDetalle(d) {
    setDetalle(d)
    const deps = await ig.getDepositos(d.id)
    setDetalleDeps(deps)
  }

  async function eliminar(d) {
    if (!confirm(`¿Eliminar la dispersión de la semana ${d.semana}? Esta acción no se puede deshacer.`)) return
    await ig.deleteDispersion(d.id)
  }

  // ── PDF ──
  function generarPDF(d, deps) {
    const doc = new jsPDF()
    const fechaHoy = new Date().toLocaleDateString('es-MX')
    doc.setFillColor(15, 52, 96)
    doc.rect(0, 0, 210, 18, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text('NOVUS — Innovacion y Futuro', 14, 12)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Dispersion Sem ${d.semana}/${d.anio}`, 196, 12, { align: 'right' })

    doc.setTextColor(40, 40, 40)
    doc.setFontSize(10)
    doc.text(`Fecha: ${d.fecha}`, 14, 26)
    doc.text(`Total dispersado: ${ig.fmt$(d.total_dispersar)}`, 14, 32)
    if (d.notas) doc.text(`Notas: ${d.notas}`, 14, 38)

    let startY = d.notas ? 44 : 38
    deps.forEach((dep, idx) => {
      const benefText = (dep.beneficiarios || []).map(b => `${b.nombre}: ${ig.fmt$(b.monto)}`).join('\n')
      const tableData = [[
        dep.receptor_nombre || '—',
        benefText || '—',
        dep.observaciones || '—',
        ig.fmt$(dep.monto),
      ]]
      doc.autoTable({
        startY: idx === 0 ? startY : doc.lastAutoTable.finalY + 2,
        head: idx === 0 ? [['Cuenta receptora', 'Beneficiarios', 'Observaciones', 'Monto']] : [['Cuenta receptora', 'Beneficiarios', 'Observaciones', 'Monto']],
        body: tableData,
        styles: { fontSize: 9, cellPadding: 3, textColor: [40, 40, 40], valign: 'top' },
        headStyles: { fillColor: [15, 52, 96], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 70 }, 2: { cellWidth: 45 }, 3: { cellWidth: 27, halign: 'right' } },
        margin: { left: 14, right: 14 },
      })
    })

    const finalY = doc.lastAutoTable.finalY + 8
    doc.setFillColor(15, 52, 96)
    doc.rect(14, finalY, 182, 14, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('TOTAL DISPERSADO', 18, finalY + 9)
    doc.setTextColor(245, 166, 35)
    doc.setFontSize(13)
    doc.text(ig.fmt$(d.total_dispersar), 192, finalY + 9, { align: 'right' })

    doc.save(`dispersion-sem${d.semana}-${d.anio}.pdf`)
  }

  return (
    <div>
      <div className="page-header">
        <div><h2>Dispersión de pagos</h2><div className="page-header-sub">Reparto del depósito en cuentas · cuadre exacto</div></div>
        <button className="btn btn-primary" onClick={abrirNueva}>+ Nueva dispersión</button>
      </div>

      {/* Filtros */}
      <div className="card mb-4">
        <div className="form-row c3" style={{ marginBottom: 0 }}>
          <div><label className="label">Filtrar por semana</label><input className="input" type="number" placeholder="Todas" value={filtros.semana} onChange={setFilt('semana')} /></div>
          <div><label className="label">Filtrar por fecha</label><input className="input" type="date" value={filtros.fecha} onChange={setFilt('fecha')} /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => setFiltros({ semana: '', fecha: '' })}>Limpiar filtros</button>
          </div>
        </div>
      </div>

      {/* Historial */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="w-full">
          <thead><tr>
            <th className="th" style={{ width: '90px' }}>Semana</th>
            <th className="th" style={{ width: '110px' }}>Fecha</th>
            <th className="th" style={{ textAlign: 'right', width: '140px' }}>Total dispersado</th>
            <th className="th">Notas</th>
            <th className="th" style={{ width: '210px' }}></th>
          </tr></thead>
          <tbody>
            {historial.length ? historial.map(d => (
              <tr key={d.id}>
                <td className="td" style={{ fontWeight: 500 }}>Sem {d.semana}</td>
                <td className="td" style={{ fontSize: 12 }}>{d.fecha}</td>
                <td className="td" style={{ textAlign: 'right', fontWeight: 500, color: 'var(--tc-text)' }}>{ig.fmt$(d.total_dispersar)}</td>
                <td className="td" style={{ fontSize: 12, color: 'var(--tc-text-muted)' }}>{d.notas || '—'}</td>
                <td className="td">
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => abrirDetalle(d)}>Ver</button>
                    <button className="btn btn-outline btn-sm" onClick={async () => { const deps = await ig.getDepositos(d.id); generarPDF(d, deps) }}>PDF</button>
                    <button className="btn btn-outline btn-sm" style={{ color: '#A82020' }} onClick={() => eliminar(d)}>Eliminar</button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="td" style={{ textAlign: 'center', color: 'var(--tc-text-muted)', padding: '2rem' }}>Sin dispersiones registradas.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Modal nueva dispersión ── */}
      <Modal open={modal} onClose={() => setModal(false)} title="Nueva dispersión">
        <div className="space-y-3">
          <div className="form-row c4" style={{ marginBottom: 0 }}>
            <div><label className="label">Fecha</label><input className="input" type="date" value={cabecera.fecha} onChange={setC('fecha')} /></div>
            <div><label className="label">Semana *</label><input className="input" type="number" min="1" max="53" value={cabecera.semana} onChange={setC('semana')} /></div>
            <div><label className="label">Año</label><input className="input" type="number" value={cabecera.anio} onChange={setC('anio')} /></div>
            <div><label className="label">Total a dispersar *</label><input className="input" type="number" min="0" step="0.01" value={cabecera.total_dispersar} onChange={setC('total_dispersar')} placeholder="0.00" /></div>
          </div>
          <div><label className="label">Notas generales</label><input className="input" value={cabecera.notas} onChange={setC('notas')} placeholder="Depósito del cliente, semana X..." /></div>

          {/* Contador de cuadre */}
          <div style={{ background: cuadra ? '#E6F6EE' : 'var(--tc-bg)', border: `1px solid ${cuadra ? '#2ECC71' : 'var(--tc-border)'}`, borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
              <span style={{ color: 'var(--tc-text-muted)' }}>Total: <strong style={{ color: 'var(--tc-text)' }}>{ig.fmt$(totalObjetivo)}</strong></span>
              <span style={{ color: 'var(--tc-text-muted)' }}>Repartido: <strong style={{ color: 'var(--tc-text)' }}>{ig.fmt$(totalRepartido)}</strong></span>
              <span style={{ color: 'var(--tc-text-muted)' }}>Diferencia: <strong style={{ color: Math.abs(diferencia) < 0.01 ? '#2ECC71' : '#A82020' }}>{ig.fmt$(diferencia)}</strong></span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: cuadra ? '#1A7A45' : '#946200' }}>{cuadra ? '✓ Cuadra' : 'No cuadra'}</span>
          </div>

          {/* Depósitos */}
          {depositos.map((dep, idx) => (
            <div key={idx} style={{ border: '1px solid var(--tc-border)', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tc-text)' }}>Depósito {idx + 1} · {ig.fmt$(dep.monto)}</span>
                <button className="btn btn-outline btn-sm" style={{ color: '#A82020' }} onClick={() => quitarDeposito(idx)}>Quitar depósito</button>
              </div>

              <div className="form-row c2">
                <div>
                  <label className="label">Cuenta receptora (a quién se deposita) *</label>
                  <select className="input" value={dep.cuenta_receptora_id} onChange={e => setReceptor(idx, e.target.value)}>
                    <option value="">Seleccionar empleado...</option>
                    {empleadosConCuenta.map(e => (
                      <option key={e.id} value={e.id}>{e.nombre} — {e.banco || 'sin banco'}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Observaciones</label>
                  <input className="input" value={dep.observaciones} onChange={e => setObservaciones(idx, e.target.value)} placeholder="Ej: +$2,000 gastos extra" />
                </div>
              </div>

              {/* Beneficiarios */}
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--tc-text-muted)', marginBottom: 6 }}>Beneficiarios de este depósito</div>
                {dep.beneficiarios.map((b, bi) => (
                  <div key={bi} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 5 }}>
                    <input className="input" style={{ flex: 2 }} value={b.nombre} placeholder="Nombre" readOnly={b.origen === 'nomina'} onChange={e => setBenefCampo(idx, bi, 'nombre', e.target.value)} />
                    <input className="input" style={{ flex: 1 }} type="number" step="0.01" value={b.monto} placeholder="Monto" onChange={e => setBenefCampo(idx, bi, 'monto', e.target.value)} />
                    <button className="btn btn-outline btn-sm" style={{ color: '#A82020' }} onClick={() => quitarBenef(idx, bi)}>✕</button>
                  </div>
                ))}

                {/* Agregar beneficiario */}
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <select className="input" style={{ flex: 1, minWidth: 180 }} value="" onChange={e => { if (e.target.value) { const row = nominaSemana.find(n => n.id === e.target.value); if (row) agregarBenefNomina(idx, row) } }}>
                    <option value="">+ Agregar de nómina (sem {cabecera.semana || '—'})...</option>
                    {nominaSemana.map(n => {
                      const emp = ig.getEmpleado(n.empleado_id)
                      return <option key={n.id} value={n.id}>{emp.nombre} — {ig.fmt$(n.neto_pagar)}</option>
                    })}
                  </select>
                  <button className="btn btn-outline btn-sm" onClick={() => agregarBenefManual(idx)}>+ Manual</button>
                </div>
              </div>
            </div>
          ))}

          <button className="btn btn-outline" style={{ width: '100%' }} onClick={agregarDeposito}>+ Agregar depósito</button>

          <div className="flex justify-end gap-2 pt-1">
            <button className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={saving || !cuadra}>{saving ? 'Guardando...' : 'Guardar dispersión'}</button>
          </div>
        </div>
      </Modal>

      {/* ── Modal detalle ── */}
      <Modal open={!!detalle} onClose={() => { setDetalle(null); setDetalleDeps([]) }} title={detalle ? `Dispersión — Semana ${detalle.semana}/${detalle.anio}` : ''}>
        {detalle && (
          <div className="space-y-3">
            <div style={{ background: 'var(--tc-bg)', border: '1px solid var(--tc-border)', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 20, fontSize: 13 }}>
              <span style={{ color: 'var(--tc-text-muted)' }}>Fecha: <strong style={{ color: 'var(--tc-text)' }}>{detalle.fecha}</strong></span>
              <span style={{ color: 'var(--tc-text-muted)' }}>Total: <strong style={{ color: 'var(--tc-text)' }}>{ig.fmt$(detalle.total_dispersar)}</strong></span>
            </div>
            {detalle.notas && <div style={{ fontSize: 12, color: 'var(--tc-text-muted)' }}>Notas: {detalle.notas}</div>}

            {detalleDeps.map((dep, i) => (
              <div key={i} style={{ border: '1px solid var(--tc-border)', borderRadius: 8, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, color: 'var(--tc-text)' }}>{dep.receptor_nombre}</span>
                  <span style={{ fontWeight: 600, color: 'var(--tc-text)' }}>{ig.fmt$(dep.monto)}</span>
                </div>
                {(dep.beneficiarios || []).map((b, bi) => (
                  <div key={bi} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--tc-text-muted)', padding: '2px 0' }}>
                    <span>{b.nombre}</span><span>{ig.fmt$(b.monto)}</span>
                  </div>
                ))}
                {dep.observaciones && <div style={{ fontSize: 11, color: 'var(--tc-text-muted)', marginTop: 4, fontStyle: 'italic' }}>{dep.observaciones}</div>}
              </div>
            ))}

            <div className="flex justify-end gap-2 pt-1">
              <button className="btn btn-outline" onClick={() => generarPDF(detalle, detalleDeps)}>Generar PDF</button>
              <button className="btn btn-primary" onClick={() => { setDetalle(null); setDetalleDeps([]) }}>Cerrar</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}