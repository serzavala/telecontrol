import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Modal from '../components/Modal'

export default function Usuarios() {
  const { perfil } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'Capturista' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  useEffect(() => { loadUsuarios() }, [])

  async function loadUsuarios() {
    const { data } = await supabase.from('perfiles').select('*').order('nombre')
    setUsuarios(data || [])
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (!form.nombre || !form.email || !form.password) { setError('Completa todos los campos.'); return }
    setSaving(true)
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { nombre: form.nombre } }
    })
    if (error) { setError(error.message); setSaving(false); return }
    // Actualizar rol
    setTimeout(async () => {
      await supabase.from('perfiles').update({ rol: form.rol }).eq('id', (await supabase.from('perfiles').select('id').eq('nombre', form.nombre).single()).data?.id)
      loadUsuarios()
    }, 1000)
    setSaving(false)
    setModal(false)
    setForm({ nombre: '', email: '', password: '', rol: 'Capturista' })
  }

  const rolBadge = { Administrador: 'badge-blue', Capturista: 'badge-green', Consulta: 'badge-gray' }
  const esAdmin = perfil?.rol === 'Administrador'

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div><h2 className="text-lg font-medium">Usuarios</h2><div className="text-xs text-gray-400">Gestión de acceso a la aplicación</div></div>
        {esAdmin && <button className="btn btn-primary" onClick={() => setModal(true)}>+ Nuevo usuario</button>}
      </div>

      {!esAdmin && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm px-4 py-3 rounded-lg mb-4">
          Solo los administradores pueden gestionar usuarios.
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead><tr>
            <th className="th">Nombre</th>
            <th className="th w-48">Email</th>
            <th className="th w-28">Rol</th>
            <th className="th w-24">Registrado</th>
          </tr></thead>
          <tbody>
            {usuarios.length ? usuarios.map(u => (
              <tr key={u.id}>
                <td className="td font-medium">{u.nombre}</td>
                <td className="td text-xs text-gray-500">{u.id}</td>
                <td className="td"><span className={`badge ${rolBadge[u.rol] || 'badge-gray'}`}>{u.rol}</span></td>
                <td className="td text-xs text-gray-400">{new Date(u.created_at).toLocaleDateString('es-MX')}</td>
              </tr>
            )) : <tr><td colSpan={4} className="td text-center text-gray-400 py-10">Sin usuarios registrados.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo usuario">
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Nombre completo</label><input className="input" value={form.nombre} onChange={setF('nombre')} required /></div>
            <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={setF('email')} required /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Contraseña</label><input className="input" type="password" value={form.password} onChange={setF('password')} minLength={6} required /></div>
            <div><label className="label">Rol</label>
              <select className="input" value={form.rol} onChange={setF('rol')}>
                <option>Administrador</option><option>Capturista</option><option>Consulta</option>
              </select>
            </div>
          </div>
          {error && <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creando...' : 'Crear usuario'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
