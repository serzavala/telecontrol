import { useState, useMemo } from 'react'
import { useDB } from '../hooks/useDB'
import { useIG } from '../hooks/useIG'
import Modal from '../components/Modal'
import { generarPDFEsquema } from '../lib/pdf'

const SIN_RAMA = 'Sin rama asignada'

export default function Esquema() {
  const db = useDB()
  const ig = useIG()
  const [verOcultos, setVerOcultos] = useState(false)
  const [cuadModal, setCuadModal] = useState(false)
  const [cuadForm, setCuadForm] = useState({})
  const [empModal, setEmpModal] = useState(false)
  const [empForm, setEmpForm] = useState({})
  const [saving, setSaving] = useState(false)

  const ramas = useMemo(
    () => [...new Set(db.cuadrillas.map(c => (c.rama || '').trim()).filter(Boolean))].sort(),
    [db.cuadrillas]
  )
  const actividades = useMemo(
    () => [...new Set(db.cuadrillas.map(c => (c.actividad || '').trim()).filter(Boolean))].sort(),
    [db.cuadrillas]
  )

  function integrantesDe(cuadId, incluirOcultos) {
    return ig.empleados
      .filter(e => e.cuadrilla_id === cuadId && (incluirOcultos || e.visible_esquema !== false))
      .sort((a, b) => (b.es_lider === true) - (a.es_lider === true) || (a.nombre || '').localeCompare(b.nombre || ''))
  }

  function construir(incluirOcultos) {
    const cuads = db.cuadrillas
      .filter(c => incluirOcultos || c.visible_esquema !== false)
      .sort((a, b) => (a.orden_esquema || 0) - (b.orden_esquema || 0) || (a.nombre || '').localeCompare(b.nombre || ''))
    const mapa = new Map()
    cuads.forEach(c => {
      const rama = (c.rama || '').trim() || SIN_RAMA
      if (!mapa.has(rama)) mapa.set(rama, [])
      mapa.get(rama).push(c)
    })
    return [...mapa.entries()]
      .sort((a, b) => (a[0] === SIN_RAMA) - (b[0] === SIN_RAMA) || a[0].localeCompare(b[0]))
      .map(([rama, cuadrillas]) => ({ rama, cuadrillas }))
  }

  const grupos = useMemo(() => construir(verOcultos), [db.cuadrillas, ig.empleados, verOcultos])

  const cuadrillasOcultas = db.cuadrillas.filter(c => c.visible_esquema === false).length
  const empleadosOcultos = ig.empleados.filter(e => e.visible_esquema === false).length

  if (db.loading || ig.loading) {
    return <div style={{ padding: '2rem', color: 'var(--tc-text-muted)', fontSize: 14 }}>Cargando esquema...</div>
  }

  function openCuad(c) {
    setCuadForm({
      id: c.id,
      nombre: c.nombre,
      rama: c.rama || '',
      actividad: c.actividad || '',
      notas_esquema: c.notas_esquema || '',
      orden_esquema: c.orden_esquema ?? 0,
    })
    setCuadModal(true)
  }

  async function guardarCuad() {
    setSaving(true)
    const { error } = await db.updateCuadrilla(cuadForm.id, {
      rama: cuadForm.rama.trim() || null,
      actividad: cuadForm.actividad.trim() || null,
      notas_esquema: cuadForm.notas_esquema.trim() || null,
      orden_esquema: parseInt(cuadForm.orden_esquema) || 0,
    })
    setSaving(false)
    if (error) { alert('Error al guardar: ' + error.message); return }
    setCuadModal(false)
  }

  function openEmp(e) {
    setEmpForm({ id: e.id, nombre: e.nombre, rol_esquema: e.rol_esquema || '', es_lider: e.es_lider === true })
    setEmpModal(true)
  }

  async function guardarEmp() {
    setSaving(true)
    const { error } = await ig.updateEmpleado(empForm.id, {
      rol_esquema: empForm.rol_esquema.trim() || null,
      es_lider: empForm.es_lider,
    })
    setSaving(false)
    if (error) { alert('Error al guardar: ' + error.message); return }
    setEmpModal(false)
  }

  async function toggleCuad(c) {
    const oculta = c.visible_esquema === false
    if (!oculta && !confirm(`Ocultar "${c.nombre}" del esquema y del PDF?\n\nNo se elimina nada, la puedes volver a mostrar cuando quieras.`)) return
    const { error } = await db.updateCuadrilla(c.id, { visible_esquema: oculta })
    if (error) alert('Error: ' + error.message)
  }

  async function toggleEmp(e) {
    const oculto = e.visible_esquema === false
    const { error } = await ig.updateEmpleado(e.id, { visible_esquema: oculto })
    if (error) alert('Error: ' + error.message)
  }

  function exportar() {
    const visibles = construir(false)
    const grupos = visibles.map(g => ({
      rama: g.rama,
      cuadrillas: g.cuadrillas.map(c => ({
        nombre: c.nombre,
        actividad: c.actividad || '',
        responsable: c.responsable || '',
        notas: c.notas_esquema || '',
        integrantes: integrantesDe(c.id, false).map(e => ({
          nombre: e.nombre,
          rol: e.rol_esquema || e.puesto || '',
          lider: e.es_lider === true,
        })),
      })),
    }))
    const totalCuadrillas = grupos.reduce((a, g) => a + g.cuadrillas.length, 0)
    const totalIntegrantes = grupos.reduce((a, g) => a + g.cuadrillas.reduce((b, c) => b + c.integrantes.length, 0), 0)
    if (!totalCuadrillas) { alert('No hay cuadrillas visibles para exportar.'); return }
    generarPDFEsquema({ grupos, totalCuadrillas, totalIntegrantes })
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Esquema de cuadrillas</h2>
          <div className="page-header-sub">Organizacion operativa por rama, actividad e integrantes</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => setVerOcultos(v => !v)}>
            {verOcultos ? 'Ver solo visibles' : `Ver ocultos (${cuadrillasOcultas + empleadosOcultos})`}
          </button>
          <button className="btn btn-primary" onClick={exportar}>Exportar PDF</button>
        </div>
      </div>

      {verOcultos && (
        <div className="alert-warn mb-4">
          Modo revision: se muestran tambien los registros ocultos (marcados en gris). El PDF nunca los incluye.
        </div>
      )}

      {grupos.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--tc-text-muted)', padding: '2.5rem' }}>
          No hay cuadrillas visibles. Registra cuadrillas en Catalogos o activa "Ver ocultos".
        </div>
      )}

      {grupos.map(g => (
        <div key={g.rama} className="mb-5">
          <div style={{
            background: '#0F3460', color: '#fff', borderRadius: 8,
            padding: '7px 14px', fontSize: 12, fontWeight: 600,
            letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10,
          }}>
            {g.rama}
            <span style={{ float: 'right', opacity: 0.7, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
              {g.cuadrillas.length} cuadrilla{g.cuadrillas.length === 1 ? '' : 's'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 12 }}>
            {g.cuadrillas.map(c => {
              const oculta = c.visible_esquema === false
              const ints = integrantesDe(c.id, verOcultos)
              return (
                <div key={c.id} className="card" style={{ padding: 14, opacity: oculta ? 0.5 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--tc-text)' }}>{c.nombre}</div>
                      <div style={{ fontSize: 11, color: 'var(--tc-text-muted)', marginTop: 2 }}>
                        {c.responsable ? `Responsable: ${c.responsable}` : 'Sin responsable'}
                      </div>
                    </div>
                    {c.actividad
                      ? <span className="badge badge-gold" style={{ flexShrink: 0 }}>{c.actividad}</span>
                      : <span className="badge badge-gray" style={{ flexShrink: 0 }}>Sin actividad</span>}
                  </div>

                    {c.notas_esquema && (
                    <div className="alert-warn" style={{ marginTop: 10, padding: '7px 10px', fontSize: 12 }}>
                      <span style={{ fontWeight: 700, fontSize: 10, letterSpacing: '0.06em' }}>NOTA</span>
                      <div style={{ marginTop: 2 }}>{c.notas_esquema}</div>
                    </div>
                    )}

                  <div style={{ borderTop: '1px solid var(--tc-border)', margin: '10px 0 8px' }} />

                  {ints.length === 0 && (
                    <div style={{ fontSize: 11, color: 'var(--tc-text-faint)', fontStyle: 'italic' }}>
                      Sin integrantes asignados
                    </div>
                  )}

                  {ints.map(e => {
                    const ocultoE = e.visible_esquema === false
                    return (
                      <div key={e.id} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '3px 0', fontSize: 12, opacity: ocultoE ? 0.45 : 1,
                      }}>
                        <span style={{ flex: 1, minWidth: 0, color: 'var(--tc-text)', fontWeight: e.es_lider ? 600 : 400 }}>
                          {e.nombre}
                          {(e.rol_esquema || e.puesto) && (
                            <span style={{ color: 'var(--tc-text-muted)', fontWeight: 400 }}> · {e.rol_esquema || e.puesto}</span>
                          )}
                          {e.es_lider && <span className="badge badge-blue" style={{ marginLeft: 6 }}>Lider</span>}
                        </span>
                        <button className="btn btn-sm btn-outline" onClick={() => openEmp(e)}>Rol</button>
                        <button className="btn btn-sm btn-outline" onClick={() => toggleEmp(e)}
                          style={{ color: ocultoE ? '#1A7A45' : '#A82020' }}>
                          {ocultoE ? 'Mostrar' : 'Quitar'}
                        </button>
                      </div>
                    )
                  })}

                  <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                    <button className="btn btn-sm btn-outline" onClick={() => openCuad(c)}>Editar etiquetas</button>
                    <button className="btn btn-sm btn-outline" onClick={() => toggleCuad(c)}
                      style={{ color: oculta ? '#1A7A45' : '#A82020' }}>
                      {oculta ? 'Mostrar en reporte' : 'Quitar del reporte'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <Modal open={cuadModal} onClose={() => setCuadModal(false)} title={`Etiquetas · ${cuadForm.nombre || ''}`}>
        <div className="space-y-3">
          <div className="form-row c2">
            <div>
              <label className="label">Rama</label>
              <input className="input" list="ramas-lista" value={cuadForm.rama || ''}
                placeholder="Ej: Aerea"
                onChange={e => setCuadForm(f => ({ ...f, rama: e.target.value }))} />
              <datalist id="ramas-lista">{ramas.map(r => <option key={r} value={r} />)}</datalist>
            </div>
            <div>
              <label className="label">Actividad</label>
              <input className="input" list="actividades-lista" value={cuadForm.actividad || ''}
                placeholder="Ej: Tendido de fibra"
                onChange={e => setCuadForm(f => ({ ...f, actividad: e.target.value }))} />
              <datalist id="actividades-lista">{actividades.map(a => <option key={a} value={a} />)}</datalist>
            </div>
          </div>
          <div>
            <label className="label">Nota para el reporte (opcional)</label>
            <input className="input" value={cuadForm.notas_esquema || ''}
              onChange={e => setCuadForm(f => ({ ...f, notas_esquema: e.target.value }))} />
          </div>
          <div style={{ maxWidth: 140 }}>
            <label className="label">Orden</label>
            <input className="input" type="number" value={cuadForm.orden_esquema ?? 0}
              onChange={e => setCuadForm(f => ({ ...f, orden_esquema: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn btn-outline" onClick={() => setCuadModal(false)}>Cancelar</button>
            <button className="btn btn-primary" disabled={saving} onClick={guardarCuad}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={empModal} onClose={() => setEmpModal(false)} title={`Rol · ${empForm.nombre || ''}`}>
        <div className="space-y-3">
          <div>
            <label className="label">Rol dentro de la cuadrilla</label>
            <input className="input" value={empForm.rol_esquema || ''}
              placeholder="Ej: Fusionador"
              onChange={e => setEmpForm(f => ({ ...f, rol_esquema: e.target.value }))} />
            <div style={{ fontSize: 11, color: 'var(--tc-text-muted)', marginTop: 4 }}>
              Si lo dejas vacio se usa el puesto del catalogo de empleados.
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={empForm.es_lider || false}
              onChange={e => setEmpForm(f => ({ ...f, es_lider: e.target.checked }))} />
            Marcar como lider de la cuadrilla
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn btn-outline" onClick={() => setEmpModal(false)}>Cancelar</button>
            <button className="btn btn-primary" disabled={saving} onClick={guardarEmp}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}