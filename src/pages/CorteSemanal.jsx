import { useState } from 'react'
import { useDB } from '../hooks/useDB'
import { useODN, CONCEPTO_POTENCIA } from '../hooks/useODN'
import { generarPDFSemanal } from '../lib/pdf'
import { getSemana, getSemanaISO } from '../lib/fechas'

const IVA_RATE = 0.16
// A partir de esta fecha lo facturable sale solo de ODNs; la tabla "produccion" queda como avance real por cuadrilla
const CORTE_ODN_DESDE = '2026-08-28'

export default function CorteSemanal() {
  const db = useDB()
  const odn = useODN()
  const [filtros, setFiltros] = useState({ inicio: '', fin: '', proyecto_id: '' })
  const [calculado, setCalculado] = useState(false)
  const [saving, setSaving] = useState(false)

  const [cifraOficial, setCifraOficial] = useState('')
  const [anticipo, setAnticipo] = useState('')
  const [comentarios, setComentarios] = useState('')
  const [documento, setDocumento] = useState(null)

  const setF = k => e => setFiltros(f => ({ ...f, [k]: e.target.value }))
  const semanaRapida = (offset) => { const s = getSemana(offset); setFiltros(f => ({ ...f, inicio: s.ini, fin: s.fin })); setCalculado(true) }
  const enPeriodo = (fecha) => (!filtros.inicio || !filtros.fin) || (fecha >= filtros.inicio && fecha <= filtros.fin)

  // ── Producción anterior (tabla produccion) ──
  const rowsTodas = db.produccion.filter(r => enPeriodo(r.fecha) && (!filtros.proyecto_id || r.proyecto_id === filtros.proyecto_id))
  const rows = rowsTodas.filter(r => r.fecha < CORTE_ODN_DESDE)          // facturable (antes del esquema ODN)
  const rowsReal = rowsTodas.filter(r => r.fecha >= CORTE_ODN_DESDE)     // avance real por cuadrilla (no facturable)
  const totalProd = rows.reduce((a, r) => a + Number(r.total), 0)
  const totalProdReal = rowsReal.reduce((a, r) => a + Number(r.total), 0)

  // ── Nuevo esquema: ODNs ──
  const odnEnProy = (o) => !filtros.proyecto_id || o.proyecto_id === filtros.proyecto_id
  // 1) Etapas cerradas en el período → se cobran completas (o parciales)
  const cobrosPer = odn.cobros.filter(c => enPeriodo(c.fecha) && odnEnProy(odn.getODN(c.odn_id)))
  // 2) Conceptos "por avance" (fusiones, otros) avanzados en el período
  const avancesPer = odn.avances.filter(a => enPeriodo(a.fecha) && odnEnProy(odn.getODN(a.odn_id)))
  const avancesFact = avancesPer.filter(a => odn.getConcepto(a.concepto_id).cobro_por === 'Avance')
  // Avance real de etapas "al terminar" que aún no tienen cobro (si la etapa ya se cobró, su avance ya está en el cobro)
  const avancesNoFact = avancesPer.filter(a => odn.getConcepto(a.concepto_id).cobro_por !== 'Avance' && !odn.cobroEtapa(a.odn_id, odn.getConcepto(a.concepto_id).etapa))

  // Filas de cobro por concepto, con la forma que usa el PDF (fecha, cuadrilla, concepto, proyecto, cantidad, precio, total)
  const filasCobros = cobrosPer.flatMap(c => {
    const o = odn.getODN(c.odn_id)
    if (c.tipo === 'Parcial') {
      const r = odn.resumenEtapa(c.odn_id, c.etapa)
      return r.items.filter(i => i.concepto.cobro_por === 'Terminada' && i.avanzado > 0).map(i => ({
        id: `${c.id}-${i.concepto.id}`, fecha: c.fecha, cuadrilla_id: null, concepto_id: i.concepto.id, proyecto_id: o.proyecto_id,
        cantidad: i.avanzado, precio_unitario: i.precio, total: i.importeAvanzado, etiqueta: `${o.nombre} · ${c.etapa} (parcial${c.motivo ? ': ' + c.motivo : ''})`,
      }))
    }
    return odn.alcancesDe(c.odn_id).map(a => ({ a, con: odn.getConcepto(a.concepto_id) }))
      .filter(({ con }) => con.etapa === c.etapa && con.cobro_por === 'Terminada')
      .map(({ a, con }) => ({
        id: `${c.id}-${con.id}`, fecha: c.fecha, cuadrilla_id: null, concepto_id: con.id, proyecto_id: o.proyecto_id,
        cantidad: Number(a.cantidad), precio_unitario: Number(con.precio), total: Number(a.cantidad) * Number(con.precio), etiqueta: `${o.nombre} · ${c.etapa}`,
      }))
  })
  const filasAvanceFact = avancesFact.map(a => { const o = odn.getODN(a.odn_id); return ({ ...a, etiqueta: `${o.nombre} · ${odn.getConcepto(a.concepto_id).etapa} (por avance)` }) })
  const filasODN = [...filasCobros, ...filasAvanceFact]
  const totalODN = filasODN.reduce((s, r) => s + Number(r.total), 0)
  const totalRealODN = avancesPer.reduce((s, a) => s + Number(a.total), 0)
  const totalNoFact = avancesNoFact.reduce((s, a) => s + Number(a.total), 0)

  // ── Totales ──
  const total = totalProd + totalODN
  const cuadsUniq = [...new Set([...rowsTodas.map(r => r.cuadrilla_id), ...avancesPer.map(a => a.cuadrilla_id)].filter(Boolean))]
  const filasPDF = [...rows, ...filasODN]

  const oficial = parseFloat(cifraOficial) || 0
  const antic = parseFloat(anticipo) || 0
  const miEstimadoNeto = total - antic
  const diferencia = oficial - miEstimadoNeto
  const iva = oficial * IVA_RATE
  const totalFacturar = oficial + iva
  const semLabel = filtros.fin ? `Sem ${getSemanaISO(filtros.fin)}` : ''

  async function guardarCorte() {
    if (!filtros.inicio || !filtros.fin) { alert('Selecciona el período primero.'); return }
    if (!filasPDF.length) { alert('No hay registros en ese período.'); return }
    if (!oficial) { alert('Captura la cifra oficial del cliente.'); return }
    const proy = filtros.proyecto_id ? db.getProyecto(filtros.proyecto_id).nombre : 'Todos'
    const periodo = `${filtros.inicio} al ${filtros.fin}`
    const yaExiste = db.cortes.find(c => c.tipo === 'Semanal' && c.periodo === periodo && c.proyecto_nombre === proy)
    if (yaExiste) { alert('Ya existe un corte guardado para este período.'); return }

    setSaving(true)
    let documento_url = null
    if (documento) {
      const { url, error: upErr } = await db.subirDocumentoCorte(documento)
      if (upErr) { setSaving(false); alert('Error al subir el documento: ' + upErr.message); return }
      documento_url = url
    }
    const { error } = await db.addCorte({
      tipo: 'Semanal', periodo, proyecto_nombre: proy, proyecto_id: filtros.proyecto_id || null,
      total, cifra_oficial: oficial, anticipo: antic, iva, total_facturar: totalFacturar,
      comentarios_facturacion: comentarios || null, documento_url, estado_pago: 'Pendiente',
      fecha_corte: new Date().toISOString().split('T')[0],
    })
    setSaving(false)
    if (error) { alert('Error al guardar: ' + error.message); return }
    alert('Corte guardado. Visible en Historial de cortes.')
    setCifraOficial(''); setAnticipo(''); setComentarios(''); setDocumento(null)
  }

  function generarPDF() {
    if (!filasPDF.length) { alert('No hay registros para generar el PDF.'); return }
    const periodo = filtros.inicio && filtros.fin ? `${filtros.inicio} al ${filtros.fin}` : 'Todo el período'
    generarPDFSemanal({
      rows: filasPDF, periodo,
      getCuadrilla: (id) => id ? db.getCuadrilla(id) : { nombre: 'ODN' },
      getProyecto: db.getProyecto,
      getConcepto: db.getConcepto,
      corte: { cifra_oficial: cifraOficial, anticipo, iva, total_facturar: totalFacturar, comentarios_facturacion: comentarios },
    })
  }

  const Fila = ({ r, extra }) => {
    const c = r.cuadrilla_id ? db.getCuadrilla(r.cuadrilla_id) : null, p = db.getProyecto(r.proyecto_id), cn = db.getConcepto(r.concepto_id)
    return (
      <tr>
        <td className="td text-xs">{r.fecha}</td>
        <td className="td truncate text-xs">{extra || (c ? c.nombre : '—')}</td>
        <td className="td text-xs">{cn.nombre}</td>
        <td className="td text-xs truncate">{p.nombre}</td>
        <td className="td text-xs">{Number(r.cantidad).toLocaleString('es-MX')} {cn.unidad?.split(' ')[0]}</td>
        <td className="td text-right">{db.fmt$(r.precio_unitario)}</td>
        <td className="td text-right font-medium">{db.fmt$(r.total)}</td>
      </tr>
    )
  }
  const Cabecera = () => (
    <thead><tr>
      <th className="th w-24">Fecha</th><th className="th w-40">Cuadrilla / ODN</th>
      <th className="th">Concepto</th><th className="th w-28">Proyecto</th>
      <th className="th w-24">Cantidad</th><th className="th w-20 text-right">P.Unit.</th>
      <th className="th w-20 text-right">Total</th>
    </tr></thead>
  )

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
        <div className="flex gap-2 flex-wrap items-center">
          <button className="btn btn-outline btn-sm" onClick={() => semanaRapida(-1)}>‹ Semana anterior</button>
          <button className="btn btn-outline btn-sm" onClick={() => semanaRapida(0)}>Semana actual</button>
          <span style={{ fontSize: 12, color: 'var(--tc-text-muted)', marginRight: 'auto' }}>{semLabel}</span>
          <button className="btn" onClick={() => setCalculado(true)}>Calcular corte</button>
          <button className="btn btn-success" onClick={guardarCorte} disabled={saving}>{saving ? 'Guardando...' : 'Guardar corte'}</button>
        </div>
      </div>

      {calculado && (
        <>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="metric"><div className="metric-label">Registros</div><div className="metric-value">{filasPDF.length}</div><div className="metric-sub">{rows.length} producción · {filasODN.length} ODN</div></div>
            <div className="metric"><div className="metric-label">Cuadrillas</div><div className="metric-value">{cuadsUniq.length}</div></div>
            <div className="metric metric-primary"><div className="metric-label">Mi estimado (facturable)</div><div className="metric-value">{db.fmt$(total)}</div><div className="metric-sub">{db.fmt$(totalProd)} prod. + {db.fmt$(totalODN)} ODN</div></div>
            <div className="metric metric-gold"><div className="metric-label">Avance real (no todo se cobra)</div><div className="metric-value">{db.fmt$(totalRealODN + totalProdReal)}</div><div className="metric-sub">{db.fmt$(totalRealODN)} ODN · {db.fmt$(totalProdReal)} bitácora cuadrillas</div></div>
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
                <span style={{ color: diferencia >= 0 ? '#2ECC71' : '#E24B4A' }}>{diferencia >= 0 ? '+' : ''}{db.fmt$(diferencia)}</span>
              </div>
              <div className="flex justify-between pt-2" style={{ borderTop: '1px solid var(--tc-border)' }}><span style={{ color: 'var(--tc-text-muted)' }}>Subtotal a facturar</span><span style={{ color: 'var(--tc-text)' }}>{db.fmt$(oficial)}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--tc-text-muted)' }}>IVA (16%)</span><span style={{ color: 'var(--tc-text)' }}>{db.fmt$(iva)}</span></div>
              <div className="flex justify-between pt-2 font-semibold text-base" style={{ borderTop: '1px solid var(--tc-border)' }}><span style={{ color: 'var(--tc-text)' }}>Total a facturar</span><span style={{ color: 'var(--tc-text)' }}>{db.fmt$(totalFacturar)}</span></div>
            </div>
          </div>

          {/* ODNs: facturable */}
          <div className="card p-0 overflow-hidden mb-4">
            <div style={{ padding: '8px 12px', background: '#0F3460', color: '#fff', fontSize: 12, fontWeight: 500, display: 'flex', justifyContent: 'space-between' }}>
              <span>ODNs — facturable en el período (etapas cerradas y conceptos por avance)</span><span style={{ color: '#F5A623' }}>{db.fmt$(totalODN)}</span>
            </div>
            <table className="w-full">
              <Cabecera />
              <tbody>
                {filasODN.length ? filasODN.map(r => <Fila key={r.id} r={r} extra={r.etiqueta} />)
                  : <tr><td colSpan={7} className="td text-center text-gray-400 py-6">Sin etapas cerradas ni avances facturables en el período.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* ODNs: avance real no facturable aún */}
          {avancesNoFact.length > 0 && (
            <div className="card p-0 overflow-hidden mb-4">
              <div style={{ padding: '8px 12px', background: 'rgba(245,166,35,0.15)', color: '#946200', fontSize: 12, fontWeight: 500, display: 'flex', justifyContent: 'space-between' }}>
                <span>ODNs — avance real del período en etapas aún no cerradas (se cobrará al cerrar)</span><span>{db.fmt$(totalNoFact)}</span>
              </div>
              <table className="w-full">
                <Cabecera />
                <tbody>
                  {avancesNoFact.map(a => <Fila key={a.id} r={a} extra={`${odn.getODN(a.odn_id).nombre} · ${a.cuadrilla_id ? db.getCuadrilla(a.cuadrilla_id).nombre : '—'}`} />)}
                </tbody>
              </table>
            </div>
          )}

          {/* Bitácora de cuadrillas desde el esquema ODN: avance real, no facturable */}
          {rowsReal.length > 0 && (
            <div className="card p-0 overflow-hidden mb-4">
              <div style={{ padding: '8px 12px', background: 'rgba(245,166,35,0.15)', color: '#946200', fontSize: 12, fontWeight: 500, display: 'flex', justifyContent: 'space-between' }}>
                <span>Bitácora de cuadrillas (Producción semanal) — avance real, NO se suma al corte desde el {CORTE_ODN_DESDE}</span><span>{db.fmt$(totalProdReal)}</span>
              </div>
              <table className="w-full">
                <Cabecera />
                <tbody>{rowsReal.map(r => <Fila key={r.id} r={r} />)}</tbody>
              </table>
            </div>
          )}

          {/* Producción facturable anterior al esquema ODN */}
          {rows.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div style={{ padding: '8px 12px', background: 'var(--tc-bg)', color: 'var(--tc-text-muted)', fontSize: 12, fontWeight: 500, display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--tc-border)' }}>
                <span>Producción facturable por cantidad (antes del {CORTE_ODN_DESDE})</span><span>{db.fmt$(totalProd)}</span>
              </div>
              <table className="w-full">
                <Cabecera />
                <tbody>{rows.map(r => <Fila key={r.id} r={r} />)}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
