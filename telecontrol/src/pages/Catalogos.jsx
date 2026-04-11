import { useState } from 'react'
import { useDB } from '../hooks/useDB'
import Modal from '../components/Modal'

function CatalogoPage({ title, subtitle, columns, rows, renderRow, modalTitle, renderForm, onAdd, onDelete }) {
  const [modal, setModal] = useState(false)
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div><h2 className="text-lg font-medium">{title}</h2>{subtitle && <div className="text-xs text-gray-400">{subtitle}</div>}</div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Nuevo</button>
      </div>
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead><tr>{columns.map((c, i) => <th key={i} className={`th ${c.w || ''}`}>{c.label}</th>)}</tr></thead>
          <tbody>
            {rows.length ? rows.map(r => renderRow(r, onDelete)) :
              <tr><td colSpan={columns.length} className="td text-center text-gray-400 py-10">Sin registros.</td></tr>}
          </tbody>
        </table>
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title={modalTitle}>
        {renderForm(() => setModal(false))}
      </Modal>
    </div>
  )
}

export function Cuadrillas() {
  const db = useDB()
  const [form, setForm] = useState({ nombre: '', responsable: '', esquema: 'Semanal', telefono: '' })
  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleAdd(close) {
    if (!form.nombre) return
    await db.addCuadrilla(form)
    setForm({ nombre: '', responsable: '', esquema: 'Semanal', telefono: '' })
    close()
  }

  const esquemaBadge = { Semanal: 'badge-blue', CN: 'badge-purple', Ambas: 'badge-green' }

  return (
    <CatalogoPage
      title="Cuadrillas" subtitle=""
      columns={[{ label: 'Nombre' }, { label: 'Responsable', w: 'w-36' }, { label: 'Esquema', w: 'w-28' }, { label: 'Teléfono', w: 'w-32' }, { label: '', w: 'w-16' }]}
      rows={db.cuadrillas}
      renderRow={(c, onDelete) => (
        <tr key={c.id}>
          <td className="td font-medium">{c.nombre}</td>
          <td className="td">{c.responsable}</td>
          <td className="td"><span className={`badge ${esquemaBadge[c.esquema] || 'badge-gray'}`}>{c.esquema}</span></td>
          <td className="td text-xs">{c.telefono}</td>
          <td className="td"><button className="btn btn-sm" onClick={() => onDelete(c.id)}>Eliminar</button></td>
        </tr>
      )}
      onDelete={db.deleteCuadrilla}
      modalTitle="Nueva cuadrilla"
      renderForm={(close) => (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Nombre</label><input className="input" value={form.nombre} onChange={setF('nombre')} /></div>
            <div><label className="label">Responsable</label><input className="input" value={form.responsable} onChange={setF('responsable')} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Esquema</label>
              <select className="input" value={form.esquema} onChange={setF('esquema')}>
                <option value="Semanal">Semanal (producción)</option>
                <option value="CN">Casos de Negocio — quincenal</option>
                <option value="Ambas">Ambas</option>
              </select>
            </div>
            <div><label className="label">Teléfono</label><input className="input" value={form.telefono} onChange={setF('telefono')} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn" onClick={close}>Cancelar</button>
            <button className="btn btn-primary" onClick={() => handleAdd(close)}>Guardar</button>
          </div>
        </div>
      )}
    />
  )
}

export function Proyectos() {
  const db = useDB()
  const [form, setForm] = useState({ nombre: '', cliente: '', ciudad: '', tipo: 'Semanal', estado: 'Activo' })
  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleAdd(close) {
    if (!form.nombre) return
    await db.addProyecto(form)
    setForm({ nombre: '', cliente: '', ciudad: '', tipo: 'Semanal', estado: 'Activo' })
    close()
  }

  const tipoBadge = { Semanal: 'badge-blue', CN: 'badge-purple', OC: 'badge-gray' }
  const estadoBadge = { Activo: 'badge-green', 'En pausa': 'badge-amber', Terminado: 'badge-red' }

  return (
    <CatalogoPage
      title="Proyectos"
      columns={[{ label: 'Nombre' }, { label: 'Cliente', w: 'w-28' }, { label: 'Ciudad', w: 'w-28' }, { label: 'Tipo', w: 'w-24' }, { label: 'Estado', w: 'w-24' }, { label: '', w: 'w-16' }]}
      rows={db.proyectos}
      renderRow={(p, onDelete) => (
        <tr key={p.id}>
          <td className="td font-medium">{p.nombre}</td>
          <td className="td text-xs">{p.cliente}</td>
          <td className="td text-xs">{p.ciudad}</td>
          <td className="td"><span className={`badge ${tipoBadge[p.tipo] || 'badge-gray'}`}>{p.tipo}</span></td>
          <td className="td"><span className={`badge ${estadoBadge[p.estado] || 'badge-gray'}`}>{p.estado}</span></td>
          <td className="td"><button className="btn btn-sm" onClick={() => onDelete(p.id)}>Eliminar</button></td>
        </tr>
      )}
      onDelete={db.deleteProyecto}
      modalTitle="Nuevo proyecto"
      renderForm={(close) => (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Nombre</label><input className="input" value={form.nombre} onChange={setF('nombre')} /></div>
            <div><label className="label">Cliente</label><input className="input" value={form.cliente} onChange={setF('cliente')} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Ciudad</label><input className="input" value={form.ciudad} onChange={setF('ciudad')} /></div>
            <div><label className="label">Tipo de cobro</label>
              <select className="input" value={form.tipo} onChange={setF('tipo')}>
                <option value="Semanal">Semanal</option>
                <option value="CN">Casos de Negocio (quincenal)</option>
                <option value="OC">Por orden de compra (PYMES)</option>
              </select>
            </div>
          </div>
          <div><label className="label">Estado</label>
            <select className="input" value={form.estado} onChange={setF('estado')}>
              <option>Activo</option><option>En pausa</option><option>Terminado</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn" onClick={close}>Cancelar</button>
            <button className="btn btn-primary" onClick={() => handleAdd(close)}>Guardar</button>
          </div>
        </div>
      )}
    />
  )
}

export function Conceptos() {
  const db = useDB()
  const [form, setForm] = useState({ num: '', nombre: '', unidad: '', precio: '' })
  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleAdd(close) {
    if (!form.nombre || !form.precio) return
    await db.addConcepto({ ...form, precio: parseFloat(form.precio) })
    setForm({ num: '', nombre: '', unidad: '', precio: '' })
    close()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h2 className="text-lg font-medium">Conceptos de cobro</h2><div className="text-xs text-gray-400">Lista de precios Izzi-Monstel 2026</div></div>
        <button className="btn btn-primary" onClick={() => document.getElementById('modal-conc').showModal?.()}>+ Nuevo</button>
      </div>
      <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs px-3 py-2 rounded-lg mb-4">
        Para PYMES se usará orden de compra — se configura cuando arranque ese proyecto.
      </div>
      <CatalogoPage
        title="" subtitle=""
        columns={[{ label: '#', w: 'w-10' }, { label: 'Concepto' }, { label: 'Unidad', w: 'w-36' }, { label: 'Precio unitario', w: 'w-32' }, { label: '', w: 'w-16' }]}
        rows={db.conceptos}
        renderRow={(c, onDelete) => (
          <tr key={c.id}>
            <td className="td text-xs text-gray-400">{c.num}</td>
            <td className="td font-medium">{c.nombre}</td>
            <td className="td text-xs">{c.unidad}</td>
            <td className="td">{db.fmt$(c.precio)}</td>
            <td className="td"><button className="btn btn-sm" onClick={() => onDelete(c.id)}>Eliminar</button></td>
          </tr>
        )}
        onDelete={db.deleteConcepto}
        modalTitle="Nuevo concepto"
        renderForm={(close) => (
          <div className="space-y-3">
            <div><label className="label">Nombre del concepto</label><input className="input" value={form.nombre} onChange={setF('nombre')} placeholder="Ej: Tendido fibra 48H" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Número (#)</label><input className="input" value={form.num} onChange={setF('num')} placeholder="6" /></div>
              <div><label className="label">Unidad</label><input className="input" value={form.unidad} onChange={setF('unidad')} placeholder="Metro lineal acero" /></div>
              <div><label className="label">Precio ($)</label><input className="input" type="number" min="0" step="0.01" value={form.precio} onChange={setF('precio')} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button className="btn" onClick={close}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => handleAdd(close)}>Guardar</button>
            </div>
          </div>
        )}
      />
    </div>
  )
}

export default Cuadrillas
