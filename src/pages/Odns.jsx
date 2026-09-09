import { useState } from 'react'
import { useODN, CONCEPTO_DROP, CONCEPTO_NAP, CONCEPTO_POTENCIA } from '../hooks/useODN'
import { useDB } from '../hooks/useDB'
import Modal from '../components/Modal'
import { getSemana, getSemanaISO, getOffsetDesdeSemana, fmtSemanaLabel } from '../lib/fechas'

const semActual = getSemana(0)
const SEM_ACTUAL = getSemanaISO(semActual.fin)
const ANIO_ACTUAL = new Date(semActual.fin + 'T12:00:00').getFullYear()

const hoyStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const ETAPA_COLOR = { 'Construcción': '#0F3460', 'Fusiones': '#946200', 'Potencias': '#1A7A45', 'Otros': '#6B7A99' }
const ESTADO_BADGE = { 'Sin iniciar': 'badge-gray', 'En proceso': 'badge-blue', 'Parcial': 'badge-amber', 'Cobrada': 'badge-green', 'General': 'badge-novus' }
const ETIQUETA_ESTADO = (r) => r.estado === 'Parcial' && r.valorPagado > 0 ? 'Pago parcial' : r.estado
const pct = (n) => `${Math.round(n)}%`

function Barra({ valor, color }) {
  return (
    <div style={{ height: 6, background: 'var(--tc-border)', borderRadius: 3, width: '100%' }}>
      <div style={{ height: '100%', width: `${Math.min(100, valor)}%`, background: color, borderRadius: 3, transition: 'width .3s' }} />
    </div>
  )
}

export default function Odns() {
  const odn = useODN()
  const db = useDB()
  const [filtros, setFiltros] = useState({ rama: '', estado: '', q: '' })
  const [sem, setSem] = useState({ semana: SEM_ACTUAL, anio: ANIO_ACTUAL })
  const semRango = getSemana(getOffsetDesdeSemana(sem.semana))
  const moverSem = (d) => { const s = getSemana(getOffsetDesdeSemana(sem.semana) + d); setSem({ semana: getSemanaISO(s.fin), anio: new Date(s.fin + 'T12:00:00').getFullYear() }) }
  const rs = odn.resumenSemana(sem.semana, sem.anio)
  const enRama = (a) => !filtros.rama || odn.getODN(a.odn_id).rama === filtros.rama
  const semReal = rs.avances.filter(enRama).reduce((x, a) => x + Number(a.total), 0)
  const semCobros = rs.cobros.filter(enRama).reduce((x, c) => x + Number(c.importe), 0)
  const semPorAvance = rs.avancesPorAvance.filter(enRama).reduce((x, a) => x + Number(a.total), 0)
  const semDrop = rs.avances.filter(enRama).filter(a => a.concepto_id === CONCEPTO_DROP).reduce((x, a) => x + Number(a.cantidad), 0)
  const semNaps = rs.avances.filter(enRama).filter(a => a.concepto_id === CONCEPTO_NAP).reduce((x, a) => x + Number(a.cantidad), 0)
  const semPot = rs.avances.filter(enRama).filter(a => a.concepto_id === CONCEPTO_POTENCIA).reduce((x, a) => x + Number(a.cantidad), 0)
  const semFus = rs.avances.filter(enRama).filter(a => odn.getConcepto(a.concepto_id).etapa === 'Fusiones').reduce((x, a) => x + Number(a.cantidad), 0)
  const [avanceModal, setAvanceModal] = useState(null)     // odn seleccionada
  const [detalle, setDetalle] = useState(null)
  const [nuevoModal, setNuevoModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [av, setAv] = useState({ modo: 'drop', nap_ids: [], concepto_id: '', cantidad: '', porcentaje: '', cuadrilla_id: '', fecha: hoyStr(), notas: '', motivo: '' })
  const [nuevo, setNuevo] = useState({ rama: '', tipo: 'ODN', nombre: '', proyecto_id: '', naps: '', alcances: {} })
  const setA = k => e => setAv(f => ({ ...f, [k]: e.target.value }))
  const setN = k => e => setNuevo(f => ({ ...f, [k]: e.target.value }))

  const lista = odn.odns
    .map(o => ({ o, r: odn.resumenODN(o.id) }))
    .filter(({ o, r }) =>
      (!filtros.rama || o.rama === filtros.rama) &&
      (!filtros.estado || r.estado === filtros.estado) &&
      (!filtros.q || `${o.nombre} ${o.nomenclatura || ''} ${o.colonia || ''}`.toLowerCase().includes(filtros.q.toLowerCase()))
    )
  const tot = lista.reduce((s, { r }) => ({ valor: s.valor + r.valorTotal, avanzado: s.avanzado + r.valorAvanzado, cobrado: s.cobrado + r.valorCobrado }), { valor: 0, avanzado: 0, cobrado: 0 })

  function openAvance(o) {
    const r = odn.resumenODN(o.id)
    const modo = r.naps.length ? (r.napsDrop < r.naps.length ? 'drop' : r.napsInstaladas < r.naps.length ? 'naps' : 'potencias') : 'concepto'
    setAv({ modo, nap_ids: [], concepto_id: '', cantidad: '', porcentaje: '', cuadrilla_id: '', fecha: hoyStr(), notas: '', motivo: '' })
    setAvanceModal(o)
  }

  async function guardarAvance() {
    if (!av.fecha) { alert('Indica la fecha.'); return }
    setSaving(true)
    let res
    if (av.modo === 'drop') res = await odn.registrarDrop({ odn_id: avanceModal.id, nap_ids: av.nap_ids, cuadrilla_id: av.cuadrilla_id, fecha: av.fecha, notas: av.notas })
    else if (av.modo === 'naps') res = await odn.registrarNaps({ odn_id: avanceModal.id, nap_ids: av.nap_ids, cuadrilla_id: av.cuadrilla_id, fecha: av.fecha, notas: av.notas })
    else if (av.modo === 'potencias') res = await odn.registrarMedicion({ odn_id: avanceModal.id, nap_ids: av.nap_ids, cuadrilla_id: av.cuadrilla_id, fecha: av.fecha, notas: av.notas })
    else res = await odn.registrarAvance({ odn_id: avanceModal.id, concepto_id: av.concepto_id, cuadrilla_id: av.cuadrilla_id, fecha: av.fecha, cantidad: av.cantidad, porcentaje: av.porcentaje !== '' ? av.porcentaje : null, notas: av.notas })
    setSaving(false)
    if (res.error) { alert('Error: ' + res.error.message); return }
    const msg = res.cierre?.cerrada ? `\n\n✓ Etapa cerrada: pasa a cobro por ${odn.fmt$(res.cierre.importe)} en la semana de la fecha.` : ''
    alert('Avance registrado.' + msg)
    setAvanceModal(null)
  }

  async function liberar() {
    if (!av.motivo) { alert('Indica el motivo de la liberación parcial.'); return }
    if (!confirm('Se generará un cobro parcial de potencias con los NAPs medidos hasta hoy. ¿Continuar?')) return
    setSaving(true)
    const res = await odn.liberarParcial({ odn_id: avanceModal.id, etapa: 'Potencias', fecha: av.fecha, motivo: av.motivo })
    setSaving(false)
    if (res.error) { alert('Error: ' + res.error.message); return }
    alert(`Cobro parcial generado por ${odn.fmt$(res.importe)}.`)
    setAvanceModal(null)
  }

  async function guardarNuevo() {
    if (!nuevo.rama || !nuevo.nombre) { alert('Rama y nombre son obligatorios.'); return }
    setSaving(true)
    const { error, id } = await odn.addODN({ rama: nuevo.rama.trim(), tipo: nuevo.tipo, nombre: nuevo.nombre.trim().toUpperCase(), proyecto_id: nuevo.proyecto_id || null })
    if (error) { setSaving(false); alert('Error: ' + error.message); return }
    // NAPs pegados: una línea por NAP → "NAP01 150 105" (nombre, drop, metros lineales)
    const filas = nuevo.naps.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const p = l.split(/[\s,;\t]+/)
      return { nombre: p[0].toUpperCase(), drop_m: p.length > 2 ? parseFloat(p[1]) : null, metros_lineales: parseFloat(p[p.length - 1]) }
    }).filter(n => n.nombre && !isNaN(n.metros_lineales))
    if (filas.length) { const r = await odn.addNaps(id, filas); if (r.error) alert('ODN creada, pero error al cargar NAPs: ' + r.error.message) }
    for (const [cid, cant] of Object.entries(nuevo.alcances)) if (parseFloat(cant) > 0) await odn.setAlcance(id, cid, parseFloat(cant))
    setSaving(false)
    setNuevoModal(false)
    setNuevo({ rama: '', tipo: 'ODN', nombre: '', proyecto_id: '', naps: '', alcances: {} })
  }

  const conceptosManuales = odn.conceptos.filter(c => ![CONCEPTO_DROP, CONCEPTO_NAP, CONCEPTO_POTENCIA].includes(c.id))

  return (
    <div>
      <div className="page-header">
        <div><h2>ODNs y avance por etapa</h2><div className="page-header-sub">Construcción · Fusiones · Potencias — el cobro se genera al cerrar cada etapa</div></div>
        <button className="btn btn-primary" onClick={() => setNuevoModal(true)}>+ Nueva ODN / CE</button>
      </div>

      <div className="card mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><label className="label">Rama</label>
            <select className="input" value={filtros.rama} onChange={e => setFiltros(f => ({ ...f, rama: e.target.value }))}>
              <option value="">Todas</option>
              {odn.ramas.map(r => <option key={r} value={r}>Rama {r}</option>)}
            </select>
          </div>
          <div><label className="label">Estado</label>
            <select className="input" value={filtros.estado} onChange={e => setFiltros(f => ({ ...f, estado: e.target.value }))}>
              <option value="">Todos</option>
              {Object.keys(ESTADO_BADGE).map(e => <option key={e}>{e}</option>)}
            </select>
          </div>
          <div><label className="label">Buscar</label><input className="input" placeholder="ODN, nomenclatura, colonia" value={filtros.q} onChange={e => setFiltros(f => ({ ...f, q: e.target.value }))} /></div>
        </div>
      </div>

      {/* ── Semana ── */}
      <div className="card mb-4" style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => moverSem(-1)}>‹</button>
          <div style={{ fontWeight: 500 }}>Semana {sem.semana} <span style={{ fontWeight: 400, color: 'var(--tc-text-muted)', fontSize: 12 }}>· {fmtSemanaLabel(semRango)}</span></div>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => moverSem(1)}>›</button>
          {sem.semana !== SEM_ACTUAL && <button type="button" className="btn btn-gold btn-sm" onClick={() => setSem({ semana: SEM_ACTUAL, anio: ANIO_ACTUAL })}>Semana actual</button>}
          {(semCobros + semPorAvance) > 0 && (rs.todoPagado
            ? <button type="button" className="btn btn-outline btn-sm" style={{ color: '#1A7A45', borderColor: '#1A7A45' }} onClick={async () => { if (confirm(`¿Quitar la marca de pagado a la semana ${sem.semana}?`)) { const r = await odn.marcarSemanaPagada(sem.semana, sem.anio, false); if (r.error) alert(r.error.message) } }}>✓ Semana pagada (deshacer)</button>
            : <button type="button" className="btn btn-sm" style={{ background: '#1A7A45', color: '#fff', border: 'none' }} onClick={async () => { if (confirm(`Se marcará como PAGADO por el cliente todo lo pasado a cobro en la semana ${sem.semana} (${odn.fmt$(semCobros + semPorAvance)}). ¿Continuar?`)) { const r = await odn.marcarSemanaPagada(sem.semana, sem.anio, true); if (r.error) alert(r.error.message) } }}>Marcar semana {sem.semana} como pagada</button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--tc-text-muted)' }}>
            {semDrop.toLocaleString('es-MX')} m drop · {semNaps} NAPs · {semFus} fusiones · {semPot} potencias{filtros.rama ? ` · rama ${filtros.rama}` : ''}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="metric metric-gold"><div className="metric-label">Producido esta semana (real)</div><div className="metric-value">{odn.fmt$(semReal)}</div><div className="metric-sub">Todo lo avanzado, se cobre o no</div></div>
        <div className="metric metric-primary"><div className="metric-label">A cobro esta semana</div><div className="metric-value">{odn.fmt$(semCobros + semPorAvance)}</div><div className="metric-sub">{odn.fmt$(semCobros)} etapas cerradas · {odn.fmt$(semPorAvance)} por avance{rs.pagado > 0 && <> · <span style={{ color: '#7ED4A0' }}>pagado {odn.fmt$(rs.pagado)}</span></>}</div></div>
        <div className="metric metric-light"><div className="metric-label">Avanzado sin pasar a cobro</div><div className="metric-value" style={{ color: '#946200' }}>{odn.fmt$(Math.max(0, tot.avanzado - tot.cobrado))}</div><div className="metric-sub">Acumulado en ODNs sin cerrar</div></div>
        <div className="metric metric-light"><div className="metric-label">Alcance total</div><div className="metric-value" style={{ color: 'var(--tc-text)' }}>{odn.fmt$(tot.valor)}</div><div className="metric-sub">{lista.length} elementos · {tot.valor ? pct(tot.avanzado / tot.valor * 100) : '—'} avanzado · {odn.fmt$(tot.cobrado)} a cobro acumulado</div></div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="w-full">
          <thead><tr>
            <th className="th" style={{ width: 110 }}>Elemento</th>
            <th className="th" style={{ width: 90, textAlign: 'center' }}>NAPs</th>
            <th className="th" style={{ width: 90, textAlign: 'right' }}>ML</th>
            <th className="th">Construcción</th>
            <th className="th">Fusiones</th>
            <th className="th">Potencias</th>
            <th className="th" style={{ width: 110, textAlign: 'right' }}>Valor</th>
            <th className="th" style={{ width: 90 }}>Estado</th>
            <th className="th" style={{ width: 150 }}></th>
          </tr></thead>
          <tbody>
            {odn.loading ? <tr><td colSpan={9} className="td" style={{ textAlign: 'center', padding: '2rem', color: '#A0AABB' }}>Cargando...</td></tr>
            : lista.length ? lista.map(({ o, r }) => {
              const et = (nombre) => r.etapas.find(e => e.etapa === nombre)
              const celda = (nombre) => {
                const e = et(nombre)
                if (!e) return <span style={{ color: '#A0AABB', fontSize: 11 }}>—</span>
                const pago = odn.estadoPagoEtapa(o.id, nombre)
                const colorPago = pago === 'pagado' ? '#1A7A45' : pago === 'pendiente' ? '#946200' : 'var(--tc-text-muted)'
                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                      <span style={{ color: colorPago, fontWeight: pago ? 500 : 400 }}>
                        {e.cobro
                          ? (pago === 'pagado' ? `✓ Pagado sem ${e.cobro.semana}` : `⏳ A cobro sem ${e.cobro.semana} · pend. pago`) + (e.cobro.tipo === 'Parcial' ? ' (parcial)' : '')
                          : pago ? `${pct(e.pct)} · ${pago === 'pagado' ? '✓ pagado' : '⏳ pend. pago'}` : e.terminada ? 'Terminada' : pct(e.pct)}
                      </span>
                      <span style={{ color: 'var(--tc-text-muted)' }}>{odn.fmt$(e.importeAlcance)}</span>
                    </div>
                    <Barra valor={e.pct} color={ETAPA_COLOR[nombre]} />
                  </div>
                )
              }
              return (
                <tr key={o.id}>
                  <td className="td"><div style={{ fontWeight: 500 }}>{o.nombre}</div><div style={{ fontSize: 11, color: 'var(--tc-text-muted)' }}>Rama {o.rama} · {o.tipo}{o.colonia ? ` · ${o.colonia}` : ''}</div></td>
                  <td className="td" style={{ textAlign: 'center', fontSize: 11 }}>{r.naps.length ? <>
                    <div>drop <strong>{r.napsDrop}</strong>/{r.naps.length}</div>
                    <div>nap <strong>{r.napsInstaladas}</strong>/{r.naps.length}</div>
                    <div style={{ color: 'var(--tc-text-muted)' }}>med {r.napsMedidas}/{r.naps.length}</div>
                  </> : '—'}</td>
                  <td className="td" style={{ textAlign: 'right', fontSize: 12 }}>{r.naps.length ? r.mlTotal.toLocaleString('es-MX') : '—'}</td>
                  <td className="td">{celda('Construcción')}</td>
                  <td className="td">{celda('Fusiones')}</td>
                  <td className="td">{celda('Potencias')}</td>
                  <td className="td" style={{ textAlign: 'right' }}><div style={{ fontWeight: 500 }}>{odn.fmt$(r.valorTotal)}</div><div style={{ fontSize: 10, color: '#946200' }}>a cobro {odn.fmt$(r.valorCobrado)}</div>{r.valorPagado > 0 && <div style={{ fontSize: 10, color: '#1A7A45' }}>pagado {odn.fmt$(r.valorPagado)}</div>}</td>
                  <td className="td"><span className={`badge ${ESTADO_BADGE[r.estado]}`}>{ETIQUETA_ESTADO(r)}</span></td>
                  <td className="td">
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => openAvance(o)}>+ Avance</button>
                      <button className="btn btn-outline btn-sm" onClick={() => setDetalle(o)}>Detalle</button>
                    </div>
                  </td>
                </tr>
              )
            }) : <tr><td colSpan={9} className="td" style={{ textAlign: 'center', padding: '2rem', color: '#A0AABB' }}>Sin ODNs registradas.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* ── Modal registrar avance ── */}
      <Modal open={!!avanceModal} onClose={() => setAvanceModal(null)} title={avanceModal ? `Registrar avance — ${avanceModal.nombre} (Rama ${avanceModal.rama})` : ''}>
        {avanceModal && (() => {
          const r = odn.resumenODN(avanceModal.id)
          const pendDrop = r.naps.filter(n => !n.drop_tendido)
          const pendNap = r.naps.filter(n => !n.nap_instalada)
          const pendMed = r.naps.filter(n => !n.medida)
          const potEtapa = r.etapas.find(e => e.etapa === 'Potencias')
          const general = odn.esGeneral(avanceModal.id)
          const idsAlcance = odn.alcancesDe(avanceModal.id).map(a => a.concepto_id)
          const conceptosDisp = odn.conceptos
            .filter(c => general || idsAlcance.includes(c.id) || c.etapa === 'Otros')
            .filter(c => general || ![CONCEPTO_DROP, CONCEPTO_NAP, CONCEPTO_POTENCIA].includes(c.id) || !r.naps.length)
            .map(c => odn.resumenConcepto(avanceModal.id, c.id))
          const cSel = conceptosDisp.find(x => x.concepto.id === av.concepto_id)
          const toggle = (id, on) => setAv(f => ({ ...f, nap_ids: on ? [...new Set([...f.nap_ids, id])] : f.nap_ids.filter(x => x !== id) }))
          const listaNaps = av.modo === 'drop' ? pendDrop : av.modo === 'naps' ? pendNap : pendMed
          const mlSel = listaNaps.filter(n => av.nap_ids.includes(n.id)).reduce((s, n) => s + Number(n.metros_lineales), 0)
          return (
            <div className="space-y-3">
              <div className="form-row c3">
                <div><label className="label">Tipo de avance</label>
                  <select className="input" value={av.modo} onChange={e => setAv(f => ({ ...f, modo: e.target.value, nap_ids: [], concepto_id: '' }))}>
                    {r.naps.length > 0 && <option value="drop">Drop tendido (metros por NAP)</option>}
                    {r.naps.length > 0 && <option value="naps">NAP instalado (piezas)</option>}
                    {r.naps.length > 0 && <option value="potencias">Potencias (NAPs medidos)</option>}
                    {conceptosDisp.length > 0 && <option value="concepto">Fusiones / tendido / otro</option>}
                  </select>
                </div>
                <div><label className="label">Cuadrilla</label>
                  <select className="input" value={av.cuadrilla_id} onChange={setA('cuadrilla_id')}>
                    <option value="">Sin asignar</option>
                    {db.cuadrillas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div><label className="label">Fecha *</label><input className="input" type="date" value={av.fecha} onChange={setA('fecha')} /></div>
              </div>

              {(av.modo === 'drop' || av.modo === 'naps' || av.modo === 'potencias') && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label className="label" style={{ marginBottom: 0 }}>{av.modo === 'drop' ? 'NAPs con drop tendido hoy' : av.modo === 'naps' ? 'NAPs instalados hoy' : 'NAPs medidos hoy'} · {listaNaps.length} pendientes</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setAv(f => ({ ...f, nap_ids: listaNaps.map(n => n.id) }))}>Todos</button>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setAv(f => ({ ...f, nap_ids: [] }))}>Ninguno</button>
                    </div>
                  </div>
                  {listaNaps.length ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 4, maxHeight: 260, overflowY: 'auto', border: '1px solid var(--tc-border)', borderRadius: 8, padding: 8 }}>
                      {listaNaps.map(n => (
                        <label key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', padding: '4px 6px', borderRadius: 6, background: av.nap_ids.includes(n.id) ? 'rgba(15,52,96,0.08)' : 'transparent' }}>
                          <input type="checkbox" style={{ width: 'auto' }} checked={av.nap_ids.includes(n.id)} onChange={e => toggle(n.id, e.target.checked)} />
                          <span style={{ fontWeight: 500 }}>{n.nombre}</span>
                          <span style={{ color: 'var(--tc-text-muted)', marginLeft: 'auto' }}>{Number(n.metros_lineales)} m{n.drop_m ? ` · D${n.drop_m}` : ''}</span>
                        </label>
                      ))}
                    </div>
                  ) : <div style={{ fontSize: 12, color: '#1A7A45', padding: '8px 0' }}>✓ Todos los NAPs ya tienen {av.modo === 'drop' ? 'drop tendido' : av.modo === 'naps' ? 'NAP instalado' : 'medición'}.</div>}
                  <div style={{ fontSize: 12, color: 'var(--tc-text-muted)', marginTop: 6 }}>
                    Seleccionados: <strong style={{ color: 'var(--tc-text)' }}>{av.nap_ids.length}</strong> NAPs{av.modo === 'drop' && <> · <strong style={{ color: 'var(--tc-text)' }}>{mlSel.toLocaleString('es-MX')}</strong> m lineales</>}
                    {av.nap_ids.length > 0 && av.nap_ids.length === listaNaps.length && (
                      (av.modo === 'drop' && pendNap.length === 0) || (av.modo === 'naps' && pendDrop.length === 0) || av.modo === 'potencias'
                        ? <span style={{ color: '#946200', marginLeft: 8 }}>→ con esto se cierra la etapa y pasa a cobro</span>
                        : <span style={{ color: 'var(--tc-text-muted)', marginLeft: 8 }}>→ {av.modo === 'drop' ? 'drop completo; faltan NAPs por instalar' : 'NAPs completos; falta drop por tender'} para cerrar</span>
                    )}
                  </div>
                </div>
              )}

              {av.modo === 'potencias' && potEtapa && !potEtapa.cobro && pendMed.length > 0 && r.napsMedidas > 0 && (
                <div style={{ background: 'rgba(245,166,35,0.12)', border: '1px solid #F5A623', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#946200', marginBottom: 6 }}>Liberar potencias a cobro parcial (sin terminar)</div>
                  <div style={{ fontSize: 12, marginBottom: 6 }}>Se cobrarían <strong>{r.napsMedidas}</strong> NAPs medidos = <strong>{odn.fmt$(r.napsMedidas * odn.getConcepto(CONCEPTO_POTENCIA).precio)}</strong>. Los NAPs pendientes no se cobran.</div>
                  <div className="form-row c2" style={{ alignItems: 'flex-end' }}>
                    <div><label className="label">Motivo *</label><input className="input" placeholder="Sin permiso de acceso" value={av.motivo} onChange={setA('motivo')} /></div>
                    <button type="button" className="btn btn-gold" onClick={liberar} disabled={saving}>Liberar parcial</button>
                  </div>
                </div>
              )}

              {av.modo === 'concepto' && (
                <div className="space-y-3">
                  <div><label className="label">Concepto</label>
                    <select className="input" value={av.concepto_id} onChange={setA('concepto_id')}>
                      <option value="">Seleccionar...</option>
                      {conceptosDisp.map(x => <option key={x.concepto.id} value={x.concepto.id}>{x.concepto.nombre}{x.alcance > 0 ? ` — ${x.avanzado.toLocaleString('es-MX')} / ${x.alcance.toLocaleString('es-MX')} ${x.concepto.unidad} (${pct(x.pct)})` : ` — ${x.avanzado.toLocaleString('es-MX')} ${x.concepto.unidad} registrados (sin alcance)`}</option>)}
                    </select>
                  </div>
                  {cSel && (
                    <div className="form-row c2">
                      <div><label className="label">Cantidad ({cSel.concepto.unidad}){cSel.alcance > 0 ? ` · restan ${cSel.restante.toLocaleString('es-MX')}` : ''}</label><input className="input" type="number" min="0" step="1" value={av.cantidad} onChange={e => setAv(f => ({ ...f, cantidad: e.target.value, porcentaje: '' }))} /></div>
                      {cSel.alcance > 0 && <div><label className="label">…o porcentaje de esta vez (%)</label><input className="input" type="number" min="0" max="100" step="1" value={av.porcentaje} onChange={e => setAv(f => ({ ...f, porcentaje: e.target.value, cantidad: '' }))} /></div>}
                    </div>
                  )}
                  {cSel && <div style={{ fontSize: 12, color: 'var(--tc-text-muted)' }}>{odn.seCobraPorAvance(avanceModal.id, cSel.concepto.id) ? 'Se cobra en la semana de la fecha por lo registrado.' : 'Este concepto se cobra al llegar al 100% del alcance.'} Importe de este avance: <strong style={{ color: 'var(--tc-text)' }}>{odn.fmt$((av.porcentaje !== '' ? cSel.alcance * Number(av.porcentaje) / 100 : Number(av.cantidad || 0)) * cSel.precio)}</strong></div>}
                </div>
              )}

              <div><label className="label">Notas</label><input className="input" value={av.notas} onChange={setA('notas')} /></div>
              <div className="flex justify-end gap-2 pt-1">
                <button className="btn btn-outline" onClick={() => setAvanceModal(null)}>Cancelar</button>
                <button className="btn btn-primary" onClick={guardarAvance} disabled={saving || ((av.modo !== 'concepto') ? !av.nap_ids.length : !av.concepto_id || (!av.cantidad && !av.porcentaje))}>{saving ? 'Guardando...' : 'Registrar avance'}</button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* ── Modal detalle ── */}
      <Modal open={!!detalle} onClose={() => setDetalle(null)} title={detalle ? `${detalle.nombre} — Rama ${detalle.rama}${detalle.nomenclatura ? ` · ${detalle.nomenclatura}` : ''}` : ''}>
        {detalle && (() => {
          const r = odn.resumenODN(detalle.id)
          const avs = odn.avancesDe(detalle.id)
          return (
            <div className="space-y-3">
              {(detalle.direccion || detalle.colonia || detalle.hp) && <div style={{ fontSize: 12, color: 'var(--tc-text-muted)' }}>{[detalle.direccion, detalle.colonia, detalle.ubicacion, detalle.hp ? `${detalle.hp} HP` : null].filter(Boolean).join(' · ')}</div>}
              <div className="grid grid-cols-3 gap-2">
                {r.etapas.map(e => (
                  <div key={e.etapa} style={{ background: 'var(--tc-bg)', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 11, color: ETAPA_COLOR[e.etapa], fontWeight: 500 }}>{e.etapa}</div>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{pct(e.pct)}</div>
                    <div style={{ fontSize: 11, color: 'var(--tc-text-muted)' }}>{odn.fmt$(e.importeAvanzado)} / {odn.fmt$(e.importeAlcance)}</div>
                    {e.cobro && <div style={{ fontSize: 11, color: e.cobro.pagado ? '#1A7A45' : '#946200', marginTop: 2 }}>{e.cobro.pagado ? `✓ Pagado ${e.cobro.pagado_fecha || ''}` : `⏳ A cobro sem ${e.cobro.semana}/${e.cobro.anio}, pendiente de pago`} · {odn.fmt$(e.cobro.importe)}{e.cobro.tipo === 'Parcial' ? ` (parcial: ${e.cobro.motivo || 's/motivo'})` : ''}</div>}
                    {e.items.map(i => <div key={i.concepto.id} style={{ fontSize: 10, color: 'var(--tc-text-muted)' }}>{i.concepto.nombre}: {i.avanzado.toLocaleString('es-MX')}/{i.alcance.toLocaleString('es-MX')} {i.concepto.unidad}</div>)}
                  </div>
                ))}
              </div>
              {r.naps.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--tc-text-muted)', marginBottom: 4 }}>NAPs — drop {r.napsDrop}/{r.naps.length} · instalados {r.napsInstaladas}/{r.naps.length} · medidos {r.napsMedidas}/{r.naps.length} · {r.mlTotal.toLocaleString('es-MX')} m</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
                    {r.naps.map(n => (
                      <div key={n.id} style={{ fontSize: 11, padding: '4px 6px', borderRadius: 6, background: n.medida ? 'rgba(26,122,69,0.12)' : n.construida ? 'rgba(15,52,96,0.08)' : 'var(--tc-bg)', border: '1px solid var(--tc-border)' }}>
                        <span style={{ fontWeight: 500 }}>{n.nombre}</span> <span style={{ color: 'var(--tc-text-muted)' }}>{Number(n.metros_lineales)} m</span>
                        <div style={{ fontSize: 10, display: 'flex', gap: 5 }}>
                          <span style={{ color: n.drop_tendido ? '#0F3460' : '#A0AABB' }}>{n.drop_tendido ? '✓' : '○'} drop</span>
                          <span style={{ color: n.nap_instalada ? '#0F3460' : '#A0AABB' }}>{n.nap_instalada ? '✓' : '○'} nap</span>
                          <span style={{ color: n.medida ? '#1A7A45' : '#A0AABB' }}>{n.medida ? '✓' : '○'} med</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--tc-text-muted)', marginBottom: 4 }}>Avances registrados ({avs.length})</div>
                {avs.length ? avs.map(a => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--tc-border)' }}>
                    <span>{a.fecha} · sem {a.semana} · {odn.getConcepto(a.concepto_id).nombre} · <strong>{Number(a.cantidad).toLocaleString('es-MX')}</strong> {odn.getConcepto(a.concepto_id).unidad}{a.cuadrilla_id ? ` · ${db.getCuadrilla(a.cuadrilla_id).nombre}` : ''}{a.notas ? ` · ${a.notas}` : ''}</span>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ color: '#1A7A45' }}>{odn.fmt$(a.total)}</span>
                      {<button className="btn btn-outline btn-sm" style={{ color: '#A82020' }} onClick={async () => { if (confirm('¿Eliminar este avance? Se revertirán los NAPs y el cobro si aplica.')) { const res = await odn.eliminarAvance(a.id); if (res.error) alert(res.error.message) } }}>✕</button>}
                    </span>
                  </div>
                )) : <div style={{ fontSize: 12, color: '#A0AABB' }}>Sin avances registrados (la carga inicial no genera avances).</div>}
              </div>
              <div className="flex justify-end"><button className="btn btn-outline" onClick={() => setDetalle(null)}>Cerrar</button></div>
            </div>
          )
        })()}
      </Modal>

      {/* ── Modal nueva ODN / CE ── */}
      <Modal open={nuevoModal} onClose={() => setNuevoModal(false)} title="Nueva ODN / CE">
        <div className="space-y-3">
          <div className="form-row c3">
            <div><label className="label">Rama *</label><input className="input" placeholder="13" value={nuevo.rama} onChange={setN('rama')} /></div>
            <div><label className="label">Tipo</label>
              <select className="input" value={nuevo.tipo} onChange={setN('tipo')}><option value="ODN">ODN</option><option value="CE">CE / ED (cierre de empalme)</option><option value="HUB">HUB</option><option value="TRAMO">Tramo de fibra</option><option value="GENERAL">General (renta, ISDP…)</option></select>
            </div>
            <div><label className="label">Nombre *</label><input className="input" placeholder={nuevo.tipo === 'CE' ? 'CE01' : 'ODN30'} value={nuevo.nombre} onChange={setN('nombre')} /></div>
          </div>
          <div><label className="label">Proyecto</label>
            <select className="input" value={nuevo.proyecto_id} onChange={setN('proyecto_id')}>
              <option value="">Sin proyecto</option>
              {db.proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          {nuevo.tipo === 'ODN' && (
            <div><label className="label">NAPs (una línea por NAP: nombre, drop, metros lineales) — opcional</label>
              <textarea className="input" rows={5} placeholder={'NAP01 150 105\nNAP02 100 71\nNAP03 50 22'} value={nuevo.naps} onChange={setN('naps')} style={{ fontFamily: 'monospace', fontSize: 12 }} />
              <div style={{ fontSize: 11, color: 'var(--tc-text-muted)' }}>El alcance de drop, NAP y potencia se calcula solo a partir de los NAPs.</div>
            </div>
          )}
          <div>
            <label className="label">Alcance de otros conceptos (fusiones, tendidos, hilado) — opcional</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {conceptosManuales.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ flex: 1 }}>{c.nombre} <span style={{ color: 'var(--tc-text-muted)' }}>({c.unidad})</span></span>
                  <input className="input" type="number" min="0" style={{ width: 100 }} value={nuevo.alcances[c.id] || ''} onChange={e => setNuevo(f => ({ ...f, alcances: { ...f.alcances, [c.id]: e.target.value } }))} />
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn btn-outline" onClick={() => setNuevoModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardarNuevo} disabled={saving}>{saving ? 'Guardando...' : 'Crear'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
