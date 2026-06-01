import { useState } from 'react'
import { useDB } from '../hooks/useDB'
import { generarPDFSemanal } from '../lib/pdf'

const IVA_RATE = 0.16

export default function CorteSemanal() {
  const db = useDB()
  const [filtros, setFiltros] = useState({ inicio: '', fin: '', proyecto_id: '' })
  const [calculado, setCalculado] = useState(false)
  const [saving, setSaving] = useState(false)

  const [cifraOficial, setCifraOficial] = useState('')
  const [anticipo, setAnticipo] = useState('')
  const [comentarios, setComentarios] = useState('')
  const [documento, setDocumento] = useState(null)

  const setF = k => e => setFiltros(f => ({ ...f, [k]: e.target.value }))

  const rows = db.produccion.filter(r => {
    const enPeriodo = (!filtros.inicio || !filtros.fin) || (r.fecha >= filtros.inicio && r.fecha <= filtros.fin)
    const enProy = !filtros.proyecto_id || r.proyecto_id === filtros.proyecto_id
    return enPeriodo && enProy
  })

  const total = rows.reduce((a, r) => a + Number(r.total), 0)
  const cuadsUniq = [...new Set(rows.map(r => r.cuadrilla_id))]

  const oficial = parseFloat(cifraOficial) || 0
  const antic = parseFloat(anticipo) || 0
  const miEstimadoNeto = total - antic
  const diferencia = oficial - miEstimadoNeto
  const iva = oficial * IVA_RATE
  const totalFacturar = oficial + iva

  async function guardarCorte() {
    if (!filtros.inicio || !filtros.fin) { alert('Selecciona el período primero.'); return }
    if (!rows.length) { alert('No hay registros en ese período.'); return }
    if (!oficial) { alert('Captura la cifra oficial del cliente.'); return }
    const proy = filtros.proyecto_id ? db.getProyecto(filtros.proyecto_id).nombre : 'Todos'
    const periodo = `${filtros.inicio} al ${filtros.fin}`
    const yaExiste = db.cortes.find(c => c.tipo === 'Semanal' && c.periodo === periodo && c.proyecto_nombre === proy)
    if (yaExiste) { alert('Ya existe un corte guardado para este período.'); return }

    setSaving(true)

    let documento_url = null
    if (documento) {
      const { url, error: upErr } = await db.subirDocumentoCorte(documento)
      if (upErr) {
        setSaving(false)
        alert('Error al subir el documento: ' + upErr.message)
        return
      }
      documento_url = url
    }

    const { error } = await db.addCorte({
      tipo: 'Semanal',
      periodo,
      proyecto_nombre: proy,
      proyecto_id: filtros.proyecto_id || null,
      total,
      cifra_oficial: oficial,
      anticipo: antic,
      iva,
      total_facturar: totalFacturar,
      comentarios_facturacion: comentarios || null,
      documento_url,
      estado_pago: 'Pendiente',
      fecha_corte: new Date().toISOString().split('T')[0],
    })

    setSaving(false)
    if (error) { alert('Error al guardar: ' + error.message); return }
    alert('Corte guardado. Visible en Historial de cortes.')
    setCifraOficial(''); setAnticipo(''); setComentarios(''); setDocumento(null)
  }

  function generarPDF() {
    if (!rows.length) { alert('No hay registros para generar el PDF.'); return }
    const periodo = filtros.inicio && filtros.fin ? `${filtros.inicio} al ${filtros.fin}` : 'Todo el período'
    generarPDFSemanal({ rows, periodo, getCuadrilla: db.getCuadrilla, getProyecto: db.getProyecto, getConcepto: db.getConcepto })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div><h2 className="text-lg font-medium">Corte semanal</h2><div className="text-xs text-gray-400">Pago Izzi-Monstel 2026</div></div>
        <button className="btn btn-primary" onClick={generarPDF}>Generar PDF</button>
      </div>

      <div className="card mb-4">
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div><label className="label">Inicio del período</label><input className="input" type="date" value={filtros.inicio} onChange={setF('inicio')} /></div>
          <div><label className="label">Fin del período</label><input className="input" type="date" value={filtros.fin} onChange={setF('fin')} /></div>
          <div><label className="label">Proyecto</label>
            <select className="input" value={filtros.proyecto_id} onChange={setF('proyecto_id')}>
              <option value="">Todos</option>
              {db.proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={() => setCalculado(true)}>Calcular corte</button>
          <button className="btn btn-success" onClick={guardarCorte} disabled={saving}>{saving ? 'Guardando...' : 'Guardar corte'}</button>
        </div>
      </div>

      {calculado && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="metric"><div className="metric-label">Registros</div><div className="metric-value">{rows.length}</div></div>
            <div className="metric"><div className="metric-label">Cuadrillas</div><div className="metric-value">{cuadsUniq.length}</div></div>
            <div className="metric"><div className="metric-label">Mi estimado</div><div className="metric-value">{db.fmt$(total)}</div></div>
          </div>

          <div className="card mb-4">
            <div className="text-sm font-medium mb-3">Facturación de la semana</div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="label">Anticipo (ya cobrado) — resta a mi estimado</label>
                <input className="input" type="number" min="0" step="0.01" value={anticipo} onChange={e => setAnticipo(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label className="label">Total cliente (subtotal) *</label>
                <input className="input" type="number" min="0" step="0.01" value={cifraOficial} onChange={e => setCifraOficial(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label className="label">Documento del cliente (Excel o captura)</label>
                <input className="input" type="file" accept=".xlsx,.xls,.csv,image/*" onChange={e => setDocumento(e.target.files[0] || null)} />
              </div>
            </div>
            <div className="mb-3">
              <label className="label">Comentarios (concepto del anticipo, notas, etc.)</label>
              <textarea className="input" rows={2} value={comentarios} onChange={e => setComentarios(e.target.value)} />
            </div>

            <div className="rounded-lg p-4 text-sm space-y-2" style={{ background: 'var(--tc-bg)', border: '1px solid var(--tc-border)' }}>
              <div className="flex justify-between"><span style={{ color: 'var(--tc-text-muted)' }}>Mi estimado registrado</span><span style={{ color: 'var(--tc-text)' }}>{db.fmt$(total)}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--tc-text-muted)' }}>Anticipo (ya cobrado)</span><span style={{ color: '#E24B4A' }}>-{db.fmt$(antic)}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--tc-text-muted)' }}>Mi estimado neto</span><span style={{ color: 'var(--tc-text)' }}>{db.fmt$(miEstimadoNeto)}</span></div>
              <div className="flex justify-between pt-2" style={{ borderTop: '1px solid var(--tc-border)' }}><span style={{ color: 'var(--tc-text-muted)' }}>Total cliente (subtotal)</span><span style={{ color: 'var(--tc-text)' }}>{db.fmt$(oficial)}</span></div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--tc-text-muted)' }}>Diferencia (cliente - mi neto)</span>
                <span style={{ color: diferencia >= 0 ? '#2ECC71' : '#E24B4A' }}>
                  {diferencia >= 0 ? '+' : ''}{db.fmt$(diferencia)}
                </span>
              </div>
              <div className="flex justify-between pt-2" style={{ borderTop: '1px solid var(--tc-border)' }}><span style={{ color: 'var(--tc-text-muted)' }}>Subtotal a facturar</span><span style={{ color: 'var(--tc-text)' }}>{db.fmt$(oficial)}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--tc-text-muted)' }}>IVA (16%)</span><span style={{ color: 'var(--tc-text)' }}>{db.fmt$(iva)}</span></div>
              <div className="flex justify-between pt-2 font-semibold text-base" style={{ borderTop: '1px solid var(--tc-border)' }}><span style={{ color: 'var(--tc-text)' }}>Total a facturar</span><span style={{ color: 'var(--tc-text)' }}>{db.fmt$(totalFacturar)}</span></div>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead><tr>
                <th className="th w-24">Fecha</th><th className="th w-32">Cuadrilla</th>
                <th className="th">Concepto</th><th className="th w-28">Proyecto</th>
                <th className="th w-24">Cantidad</th><th className="th w-20 text-right">P.Unit.</th>
                <th className="th w-20 text-right">Total</th>
              </tr></thead>
              <tbody>
                {rows.length ? rows.map(r => {
                  const c = db.getCuadrilla(r.cuadrilla_id), p = db.getProyecto(r.proyecto_id), cn = db.getConcepto(r.concepto_id)
                  return <tr key={r.id}><td className="td text-xs">{r.fecha}</td><td className="td truncate">{c.nombre}</td><td className="td text-xs">{cn.nombre}</td><td className="td text-xs truncate">{p.nombre}</td><td className="td text-xs">{Number(r.cantidad).toLocaleString('es-MX')} {cn.unidad?.split(' ')[0]}</td><td className="td text-right">{db.fmt$(r.precio_unitario)}</td><td className="td text-right font-medium">{db.fmt$(r.total)}</td></tr>
                }) : <tr><td colSpan={7} className="td text-center text-gray-400 py-8">Sin registros en ese período.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
