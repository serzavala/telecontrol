import { useState } from 'react'
import { useDB } from '../hooks/useDB'
import { generarPDFSemanal, generarPDFCN } from '../lib/pdf'
import Modal from '../components/Modal'

function semanaISO(fechaStr) {
  if (!fechaStr) return null
  const date = new Date(fechaStr + 'T12:00:00')
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
}

export default function Historial() {
  const db = useDB()
  const [filtros, setFiltros] = useState({ tipo: '', estado: '', proyecto: '', semana: '', cuadrilla: '' })
  const [detalle, setDetalle] = useState(null)   // corte seleccionado
  const setF = k => e => setFiltros(f => ({ ...f, [k]: e.target.value }))

  const semanasUnicas = [...new Set(
    (db.cortes || []).map(c => c.semana ?? semanaISO(c.fecha_corte)).filter(Boolean)
  )].sort((a, b) => a - b)

  const cuadrillasUnicas = [...new Set(
    (db.cortes || []).map(c => c.cuadrilla).filter(Boolean)
  )].sort()

  const rows = [...(db.cortes || [])]
    .filter(c => {
      if (filtros.tipo && c.tipo !== filtros.tipo) return false
      if (filtros.estado && c.estado_pago !== filtros.estado) return false
      if (filtros.proyecto && c.proyecto_id !== filtros.proyecto) return false
      if (filtros.cuadrilla && c.cuadrilla !== filtros.cuadrilla) return false
      if (filtros.semana) {
        const sem = c.semana ?? semanaISO(c.fecha_corte)
        if (sem !== Number(filtros.semana)) return false
      }
      return true
    })
    .sort((a, b) => b.fecha_corte?.localeCompare(a.fecha_corte))

  const montoPagado = rows.filter(c => c.estado_pago === 'Pagado').reduce((a, c) => a + Number(c.total), 0)
  const montoPend   = rows.filter(c => c.estado_pago === 'Pendiente').reduce((a, c) => a + Number(c.total), 0)

  // Regenerar PDF desde historial
  function verPDF(corte) {
    if (corte.tipo === 'Semanal') {
      // Filtramos los registros de producción del período guardado
      const [ini, fin] = (corte.periodo || '').split(' al ').map(s => s.trim())
      const rowsProd = db.produccion.filter(r => {
        const enPeriodo = !ini || !fin || (r.fecha >= ini && r.fecha <= fin)
        const enProy = !corte.proyecto_id || r.proyecto_id === corte.proyecto_id
        return enPeriodo && enProy
      })
      if (!rowsProd.length) {
        alert('No se encontraron registros de producción para este período. El PDF puede haber sido generado con datos que ya no existen.')
        return
      }
      generarPDFSemanal({
        rows: rowsProd,
        periodo: corte.periodo,
        getCuadrilla: db.getCuadrilla,
        getProyecto: db.getProyecto,
        getConcepto: db.getConcepto,
        corte,
      })
    } else {
      // CN — reconstruimos los params del período
      const rowsCN = db.registrosCN.filter(r => {
        // El período CN se guarda como "1ª quincena Junio 2026" — usamos proyecto_id y periodo
        return !corte.proyecto_id || r.proyecto_id === corte.proyecto_id
      })
      generarPDFCN({
        rows: rowsCN,
        periodoLabel: corte.periodo,
        diaCobro: '—',
        getCuadrilla: db.getCuadrilla,
        getProyecto: db.getProyecto,
      })
    }
  }

  const fmt$ = db.fmt$

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-medium">Historial de cortes</h2>
          <div className="text-xs text-gray-400">Registro de todos los cortes y su estado de pago</div>
        </div>
      </div>

      {/* FILTROS */}
      <div className="card mb-4">
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div><label className="label">Tipo de corte</label>
            <select className="input" value={filtros.tipo} onChange={setF('tipo')}>
              <option value="">Todos</option><option value="Semanal">Semanal</option><option value="CN">Quincenal CN</option>
            </select>
          </div>
          <div><label className="label">Estado de pago</label>
            <select className="input" value={filtros.estado} onChange={setF('estado')}>
              <option value="">Todos</option><option value="Pendiente">Pendiente</option><option value="Pagado">Pagado</option>
            </select>
          </div>
          <div><label className="label">Proyecto</label>
            <select className="input" value={filtros.proyecto} onChange={setF('proyecto')}>
              <option value="">Todos</option>
              {db.proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div><label className="label">Semana</label>
            <select className="input" value={filtros.semana} onChange={setF('semana')}>
              <option value="">Todas</option>
              {semanasUnicas.map(s => <option key={s} value={s}>Sem. {s}</option>)}
            </select>
          </div>
          <div><label className="label">Cuadrilla</label>
            <select className="input" value={filtros.cuadrilla} onChange={setF('cuadrilla')}>
              <option value="">Todas</option>
              {cuadrillasUnicas.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* MÉTRICAS */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="metric"><div className="metric-label">Cortes totales</div><div className="metric-value">{rows.length}</div></div>
        <div className="metric"><div className="metric-label">Monto pagado</div><div className="metric-value text-green-600">{fmt$(montoPagado)}</div></div>
        <div className="metric"><div className="metric-label">Monto pendiente</div><div className="metric-value text-amber-600">{fmt$(montoPend)}</div></div>
      </div>

      {/* TABLA */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Período</th>
              <th className="th w-20">Tipo</th>
              <th className="th">Proyecto</th>
              <th className="th w-20">Semana</th>
              <th className="th">Cuadrilla</th>
              <th className="th w-24 text-right">Monto</th>
              <th className="th w-28">Estado pago</th>
              <th className="th w-24">Fecha pago</th>
              <th className="th w-24"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map(r => {
              const pagado = r.estado_pago === 'Pagado'
              const semana = r.semana ?? semanaISO(r.fecha_corte)
              return (
                <tr
                  key={r.id}
                  className={`cursor-pointer hover:bg-blue-50 transition-colors ${pagado ? 'opacity-60' : ''}`}
                  onClick={() => setDetalle(r)}
                >
                  <td className="td text-xs truncate max-w-[120px]">{r.periodo}</td>
                  <td className="td"><span className={`badge ${r.tipo === 'CN' ? 'badge-purple' : 'badge-blue'}`}>{r.tipo}</span></td>
                  <td className="td text-xs truncate">{r.proyecto_nombre}</td>
                  <td className="td text-xs text-gray-500">{semana ? `Sem. ${semana}` : '—'}</td>
                  <td className="td text-xs truncate">{r.cuadrilla || '—'}</td>
                  <td className="td text-right">{fmt$(r.total)}</td>
                  <td className="td" onClick={e => e.stopPropagation()}>
                    <button
                      className={`pago-pill ${pagado ? 'pago-pill-pagado' : 'pago-pill-pendiente'}`}
                      onClick={() => db.togglePagoCorte(r.id, r.estado_pago)}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                      {r.estado_pago}
                    </button>
                  </td>
                  <td className="td text-xs text-gray-400">{r.fecha_pago || '—'}</td>
                  <td className="td" onClick={e => e.stopPropagation()}>
                    <button className="btn btn-sm" onClick={() => db.deleteCorte(r.id)}>Eliminar</button>
                  </td>
                </tr>
              )
            }) : (
              <tr><td colSpan={9} className="td text-center text-gray-400 py-10">Sin cortes guardados. Genera y guarda un corte semanal.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DETALLE */}
      <Modal open={!!detalle} onClose={() => setDetalle(null)} title={`Corte — ${detalle?.periodo || ''}`}>
        {detalle && (
          <div className="space-y-4">
            {/* Info general */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="label">Proyecto</span><div className="font-medium">{detalle.proyecto_nombre}</div></div>
              <div><span className="label">Tipo</span><div><span className={`badge ${detalle.tipo === 'CN' ? 'badge-purple' : 'badge-blue'}`}>{detalle.tipo}</span></div></div>
              <div><span className="label">Fecha de corte</span><div>{detalle.fecha_corte}</div></div>
              <div><span className="label">Estado de pago</span>
                <div><button
                  className={`pago-pill ${detalle.estado_pago === 'Pagado' ? 'pago-pill-pagado' : 'pago-pill-pendiente'}`}
                  onClick={() => { db.togglePagoCorte(detalle.id, detalle.estado_pago); setDetalle(null) }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                  {detalle.estado_pago}
                </button></div>
              </div>
              {detalle.fecha_pago && <div><span className="label">Fecha de pago</span><div>{detalle.fecha_pago}</div></div>}
            </div>

            {/* Facturación */}
            <div className="rounded-lg p-4 text-sm space-y-2" style={{ background: 'var(--tc-bg)', border: '1px solid var(--tc-border)' }}>
              <div className="font-medium mb-2" style={{ color: 'var(--tc-text)' }}>Facturación</div>
              <div className="flex justify-between"><span style={{ color: 'var(--tc-text-muted)' }}>Mi estimado registrado</span><span>{fmt$(detalle.total)}</span></div>
              {detalle.anticipo > 0 && <div className="flex justify-between"><span style={{ color: 'var(--tc-text-muted)' }}>Anticipo cobrado</span><span style={{ color: '#E24B4A' }}>-{fmt$(detalle.anticipo)}</span></div>}
              {detalle.cifra_oficial > 0 && <>
                <div className="flex justify-between pt-2" style={{ borderTop: '1px solid var(--tc-border)' }}>
                  <span style={{ color: 'var(--tc-text-muted)' }}>Total cliente (subtotal)</span><span>{fmt$(detalle.cifra_oficial)}</span>
                </div>
                <div className="flex justify-between"><span style={{ color: 'var(--tc-text-muted)' }}>IVA (16%)</span><span>{fmt$(detalle.iva)}</span></div>
                <div className="flex justify-between font-semibold pt-2" style={{ borderTop: '1px solid var(--tc-border)' }}>
                  <span>Total a facturar</span><span style={{ color: '#2ECC71' }}>{fmt$(detalle.total_facturar)}</span>
                </div>
              </>}
              {detalle.comentarios_facturacion && (
                <div className="pt-2 text-xs" style={{ color: 'var(--tc-text-muted)', borderTop: '1px solid var(--tc-border)' }}>
                  <span className="font-medium">Notas: </span>{detalle.comentarios_facturacion}
                </div>
              )}
            </div>

            {/* Documento adjunto */}
            {detalle.documento_url && (
              <div className="text-sm">
                <span className="label">Documento del cliente</span>
                <a href={detalle.documento_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm mt-1 inline-block">
                  Ver documento ↗
                </a>
              </div>
            )}

            {/* Acciones */}
            <div className="flex justify-between pt-2">
              <button className="btn btn-outline btn-sm" style={{ color: '#A82020' }} onClick={() => { db.deleteCorte(detalle.id); setDetalle(null) }}>
                Eliminar corte
              </button>
              <button className="btn btn-primary" onClick={() => verPDF(detalle)}>
                Descargar PDF
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}