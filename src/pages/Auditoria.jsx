import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const OP_BADGE = {
  INSERT: { cls: 'badge-green', label: 'Creación' },
  UPDATE: { cls: 'badge-amber', label: 'Edición' },
  DELETE: { cls: 'badge-red', label: 'Eliminación' },
}

const TABLAS = ['produccion','registros_cn','cortes','nomina','gastos','ingresos','empleados','prestamos','cuadrillas','proyectos','conceptos','cierres_semanales']

export default function Auditoria() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtros, setFiltros] = useState({ tabla: '', operacion: '', usuario: '', fecha: '' })
  const [detalle, setDetalle] = useState(null)
  const setF = k => e => setFiltros(f => ({ ...f, [k]: e.target.value }))

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('auditoria')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    setLogs(data || [])
    setLoading(false)
  }

  const rows = logs.filter(r =>
    (!filtros.tabla || r.tabla === filtros.tabla) &&
    (!filtros.operacion || r.operacion === filtros.operacion) &&
    (!filtros.usuario || (r.usuario_email || '').toLowerCase().includes(filtros.usuario.toLowerCase())) &&
    (!filtros.fecha || r.created_at.startsWith(filtros.fecha))
  )

  const usuarios = [...new Set(logs.map(r => r.usuario_email).filter(Boolean))]

  function fmtFecha(ts) {
    if (!ts) return '—'
    const d = new Date(ts)
    return d.toLocaleDateString('es-MX') + ' ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  }

  function getDiff(antes, despues) {
    if (!antes || !despues) return null
    const cambios = {}
    Object.keys(despues).forEach(k => {
      if (JSON.stringify(antes[k]) !== JSON.stringify(despues[k])) {
        cambios[k] = { antes: antes[k], despues: despues[k] }
      }
    })
    return Object.keys(cambios).length ? cambios : null
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Auditoría</h2>
          <div className="page-header-sub">Historial completo de cambios en todos los módulos</div>
        </div>
        <button className="btn btn-outline" onClick={cargar}>Actualizar</button>
      </div>

      <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
        <div className="metric metric-primary"><div className="metric-label">Total registros</div><div className="metric-value">{logs.length}</div></div>
        <div className="metric metric-light"><div className="metric-label">Creaciones</div><div className="metric-value" style={{ color: '#1A7A45' }}>{logs.filter(r => r.operacion === 'INSERT').length}</div></div>
        <div className="metric metric-light"><div className="metric-label">Ediciones</div><div className="metric-value" style={{ color: '#946200' }}>{logs.filter(r => r.operacion === 'UPDATE').length}</div></div>
        <div className="metric metric-light"><div className="metric-label">Eliminaciones</div><div className="metric-value" style={{ color: '#A82020' }}>{logs.filter(r => r.operacion === 'DELETE').length}</div></div>
      </div>

      <div className="card mb-4">
        <div className="form-row c4" style={{ marginBottom: 0 }}>
          <div><label className="label">Módulo / Tabla</label>
            <select className="input" value={filtros.tabla} onChange={setF('tabla')}>
              <option value="">Todos</option>
              {TABLAS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div><label className="label">Operación</label>
            <select className="input" value={filtros.operacion} onChange={setF('operacion')}>
              <option value="">Todas</option>
              <option value="INSERT">Creación</option>
              <option value="UPDATE">Edición</option>
              <option value="DELETE">Eliminación</option>
            </select>
          </div>
          <div><label className="label">Usuario</label>
            <select className="input" value={filtros.usuario} onChange={setF('usuario')}>
              <option value="">Todos</option>
              {usuarios.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div><label className="label">Fecha</label>
            <input className="input" type="date" value={filtros.fecha} onChange={setF('fecha')} />
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', color: '#6B7A99', textAlign: 'center' }}>Cargando historial...</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="w-full">
            <thead><tr>
              <th className="th" style={{ width: '130px' }}>Fecha y hora</th>
              <th className="th" style={{ width: '90px' }}>Operación</th>
              <th className="th" style={{ width: '130px' }}>Módulo</th>
              <th className="th" style={{ width: '180px' }}>Usuario</th>
              <th className="th">Detalle</th>
              <th className="th" style={{ width: '70px' }}></th>
            </tr></thead>
            <tbody>
              {rows.length ? rows.map(r => {
                const op = OP_BADGE[r.operacion] || { cls: 'badge-gray', label: r.operacion }
                const diff = getDiff(r.datos_anteriores, r.datos_nuevos)
                const numCambios = diff ? Object.keys(diff).length : 0
                return (
                  <tr key={r.id}>
                    <td className="td" style={{ fontSize: 11 }}>{fmtFecha(r.created_at)}</td>
                    <td className="td"><span className={`badge ${op.cls}`}>{op.label}</span></td>
                    <td className="td" style={{ fontSize: 12 }}>{r.tabla}</td>
                    <td className="td" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.usuario_email || '—'}</td>
                    <td className="td" style={{ fontSize: 12, color: '#6B7A99' }}>
                      {r.operacion === 'INSERT' && 'Nuevo registro creado'}
                      {r.operacion === 'DELETE' && 'Registro eliminado'}
                      {r.operacion === 'UPDATE' && (diff ? `${numCambios} campo${numCambios > 1 ? 's' : ''} modificado${numCambios > 1 ? 's' : ''}` : 'Sin cambios detectados')}
                    </td>
                    <td className="td">
                      <button className="btn btn-outline btn-sm" onClick={() => setDetalle(r)}>Ver</button>
                    </td>
                  </tr>
                )
              }) : (
                <tr><td colSpan={6} className="td" style={{ textAlign: 'center', color: '#A0AABB', padding: '2rem' }}>Sin registros de auditoría.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal detalle */}
      {detalle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,52,96,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 40 }}
          onClick={e => { if (e.target === e.currentTarget) setDetalle(null) }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '1.5rem', width: 600, maxWidth: '95%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: 16, fontWeight: 500, color: '#0F3460' }}>Detalle del cambio</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setDetalle(null)}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12, fontSize: 13 }}>
              {[
                { label: 'Fecha', val: fmtFecha(detalle.created_at) },
                { label: 'Operación', val: OP_BADGE[detalle.operacion]?.label },
                { label: 'Módulo', val: detalle.tabla },
                { label: 'Usuario', val: detalle.usuario_email || '—' },
              ].map(({ label, val }) => (
                <div key={label} style={{ background: '#F4F6FB', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 11, color: '#6B7A99', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontWeight: 500, color: '#0F3460' }}>{val}</div>
                </div>
              ))}
            </div>

            {detalle.operacion === 'UPDATE' && (() => {
              const diff = getDiff(detalle.datos_anteriores, detalle.datos_nuevos)
              return diff ? (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#6B7A99', marginBottom: 8 }}>Campos modificados</div>
                  {Object.entries(diff).map(([campo, { antes, despues }]) => (
                    <div key={campo} style={{ border: '1px solid #E8ECF4', borderRadius: 8, padding: '8px 12px', marginBottom: 6, fontSize: 13 }}>
                      <div style={{ fontWeight: 500, color: '#0F3460', marginBottom: 4 }}>{campo}</div>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ flex: 1, background: '#FEEAEA', borderRadius: 6, padding: '4px 8px' }}>
                          <div style={{ fontSize: 10, color: '#A82020', marginBottom: 2 }}>ANTES</div>
                          <div style={{ color: '#A82020' }}>{String(antes ?? '—')}</div>
                        </div>
                        <div style={{ flex: 1, background: '#E6F6EE', borderRadius: 6, padding: '4px 8px' }}>
                          <div style={{ fontSize: 10, color: '#1A7A45', marginBottom: 2 }}>DESPUÉS</div>
                          <div style={{ color: '#1A7A45' }}>{String(despues ?? '—')}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <div style={{ color: '#A0AABB', fontSize: 13 }}>Sin diferencias detectadas.</div>
            })()}

            {detalle.operacion === 'INSERT' && detalle.datos_nuevos && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#6B7A99', marginBottom: 8 }}>Datos del registro creado</div>
                <div style={{ background: '#F4F6FB', borderRadius: 8, padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>
                  {JSON.stringify(detalle.datos_nuevos, null, 2)}
                </div>
              </div>
            )}

            {detalle.operacion === 'DELETE' && detalle.datos_anteriores && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#6B7A99', marginBottom: 8 }}>Datos del registro eliminado</div>
                <div style={{ background: '#FEEAEA', borderRadius: 8, padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>
                  {JSON.stringify(detalle.datos_anteriores, null, 2)}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="btn btn-outline" onClick={() => setDetalle(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
