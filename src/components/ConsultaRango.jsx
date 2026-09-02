import { useState, useMemo } from 'react'
import { generarPDFRango } from '../lib/pdf'

function fechaLocal(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function etiqueta(f) {
  if (!f) return ''
  return new Date(f + 'T12:00:00').toLocaleDateString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function ConsultaRango({ db }) {
  const hoyStr = fechaLocal(new Date())
  const [desde, setDesde] = useState(hoyStr)
  const [hasta, setHasta] = useState(hoyStr)

  const fmt$ = db.fmt$

  function atajo(tipo) {
    const hoy = new Date()
    if (tipo === 'hoy') { setDesde(fechaLocal(hoy)); setHasta(fechaLocal(hoy)); return }
    if (tipo === 'ayer') {
      const a = new Date(hoy); a.setDate(hoy.getDate() - 1)
      setDesde(fechaLocal(a)); setHasta(fechaLocal(a)); return
    }
    if (tipo === '7dias') {
      const a = new Date(hoy); a.setDate(hoy.getDate() - 6)
      setDesde(fechaLocal(a)); setHasta(fechaLocal(hoy)); return
    }
    if (tipo === 'semana') {
      // Semana en curso: viernes a jueves
      const dow = hoy.getDay()
      const atras = (dow - 5 + 7) % 7
      const viernes = new Date(hoy); viernes.setDate(hoy.getDate() - atras)
      const jueves = new Date(viernes); jueves.setDate(viernes.getDate() + 6)
      setDesde(fechaLocal(viernes)); setHasta(fechaLocal(jueves))
    }
  }

  // Normaliza por si invierte las fechas
  const ini = desde <= hasta ? desde : hasta
  const fin = desde <= hasta ? hasta : desde

  const resultado = useMemo(() => {
    const rows = db.produccion.filter(r => r.fecha >= ini && r.fecha <= fin)
    const total = rows.reduce((a, r) => a + Number(r.total), 0)
    const dias = new Set(rows.map(r => r.fecha)).size

    const mapa = new Map()
    rows.forEach(r => {
      const c = db.getCuadrilla(r.cuadrilla_id)
      if (!mapa.has(r.cuadrilla_id)) {
        mapa.set(r.cuadrilla_id, { id: r.cuadrilla_id, nombre: c.nombre, total: 0, dias: new Set(), conceptos: new Map() })
      }
      const g = mapa.get(r.cuadrilla_id)
      g.total += Number(r.total)
      g.dias.add(r.fecha)

      const cn = db.getConcepto(r.concepto_id)
      if (!g.conceptos.has(r.concepto_id)) {
        g.conceptos.set(r.concepto_id, { id: r.concepto_id, nombre: cn.nombre, unidad: cn.unidad, cantidad: 0, total: 0 })
      }
      const k = g.conceptos.get(r.concepto_id)
      k.cantidad += Number(r.cantidad)
      k.total += Number(r.total)
    })

    const grupos = [...mapa.values()]
      .map(g => ({
        ...g,
        dias: g.dias.size,
        conceptos: [...g.conceptos.values()]
          .map(c => ({ ...c, promUnit: c.cantidad ? c.total / c.cantidad : 0 }))
          .sort((a, b) => b.total - a.total),
      }))
      .sort((a, b) => b.total - a.total)

    return { grupos, total, dias, registros: rows.length, promDia: dias ? total / dias : 0 }
  }, [db.produccion, ini, fin])

  function exportar() {
    if (!resultado.registros) { alert('No hay produccion registrada en ese periodo.'); return }
    generarPDFRango({
      grupos: resultado.grupos,
      desdeLabel: ini,
      hastaLabel: fin,
      total: resultado.total,
      dias: resultado.dias,
      registros: resultado.registros,
    })
  }

  const unSoloDia = ini === fin

  return (
    <div className="card mb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">Consulta por fecha</span>
        <button className="btn btn-sm btn-primary" onClick={exportar}>Exportar PDF</button>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div>
          <div className="text-xs text-gray-400 mb-1">Desde</div>
          <input className="input text-xs py-1" type="date" value={desde} onChange={e => setDesde(e.target.value)} />
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-1">Hasta</div>
          <input className="input text-xs py-1" type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
        </div>
        <div className="flex gap-1">
          <button className="btn btn-sm btn-outline" onClick={() => atajo('hoy')}>Hoy</button>
          <button className="btn btn-sm btn-outline" onClick={() => atajo('ayer')}>Ayer</button>
          <button className="btn btn-sm btn-outline" onClick={() => atajo('7dias')}>Últimos 7 días</button>
          <button className="btn btn-sm btn-outline" onClick={() => atajo('semana')}>Semana en curso</button>
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--tc-text-muted)', marginBottom: 12 }}>
        {unSoloDia ? etiqueta(ini) : `${etiqueta(ini)}  —  ${etiqueta(fin)}`}
      </div>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <div className="metric metric-primary">
          <div className="metric-label">Producción</div>
          <div className="metric-value">{fmt$(resultado.total)}</div>
          <div className="metric-sub">{unSoloDia ? 'Del día' : 'Del período'}</div>
        </div>
        <div className="metric metric-light">
          <div className="metric-label">Días con producción</div>
          <div className="metric-value">{resultado.dias}</div>
          <div className="metric-sub">{resultado.registros} registros</div>
        </div>
        <div className="metric metric-light">
          <div className="metric-label">Promedio diario</div>
          <div className="metric-value">{fmt$(resultado.promDia)}</div>
          <div className="metric-sub">Por día activo</div>
        </div>
        <div className="metric metric-light">
          <div className="metric-label">Cuadrillas activas</div>
          <div className="metric-value">{resultado.grupos.length}</div>
          <div className="metric-sub">Con registros</div>
        </div>
      </div>

      {resultado.registros === 0 ? (
        <div className="text-gray-400 text-sm py-6 text-center">
          Sin producción registrada en {unSoloDia ? 'esa fecha' : 'ese período'}.
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Cuadrilla / Concepto</th>
              <th className="th text-right">Cantidad</th>
              <th className="th">Unidad</th>
              <th className="th text-right">P. unitario</th>
              <th className="th text-right">Importe</th>
            </tr>
          </thead>
          <tbody>
            {resultado.grupos.map(g => [
              <tr key={g.id} style={{ background: 'var(--tc-hover)' }}>
                <td className="td font-medium" style={{ color: '#0F3460' }}>
                  {g.nombre}
                  <span style={{ color: 'var(--tc-text-muted)', fontWeight: 400, fontSize: 11, marginLeft: 6 }}>
                    {g.dias} día{g.dias === 1 ? '' : 's'}
                  </span>
                </td>
                <td className="td" colSpan={3} />
                <td className="td text-right font-medium">{fmt$(g.total)}</td>
              </tr>,
              ...g.conceptos.map(c => (
                <tr key={`${g.id}-${c.id}`}>
                  <td className="td text-xs" style={{ paddingLeft: 26, color: 'var(--tc-text-muted)' }}>{c.nombre}</td>
                  <td className="td text-right text-xs">{Number(c.cantidad).toLocaleString('es-MX', { maximumFractionDigits: 2 })}</td>
                  <td className="td text-xs">{c.unidad}</td>
                  <td className="td text-right text-xs">{fmt$(c.promUnit)}</td>
                  <td className="td text-right text-xs">{fmt$(c.total)}</td>
                </tr>
              )),
            ])}
          </tbody>
        </table>
      )}
    </div>
  )
}