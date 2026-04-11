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
  const [exito, setExito] = useState('')
  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  useEffect(() => { loadUsuarios() }, [])

  async function loadUsuarios() {
    const { data } = await supabase.from('perfiles').select('*').order('nombre')
    setUsuarios(data || [])
  }

  async function handleAdd(e) {
    e.preventDefault()
    e.stopPropagation()
    setError('')
    setExito('')
    if (!form.nombre || !form.email || !form.password) {
      setError('Completa todos los campos.')
      return
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    setSaving(true)
    try {
      const { data, error: signUpError } = await supabase.auth.admin
        ? await supabase.functions.invoke('create-user', {
            body: { email: form.email, password: form.password, nombre: form.nombre, rol: form.rol }
          })
        : { data: null, error: { message: 'No disponible' } }

      if (signUpError) throw signUpError

      setExito(`Usuario ${form.email} creado correctamente.`)
      setForm({ nombre: '', email: '', password: '', rol: 'Capturista' })
      loadUsuarios()
    } catch (err) {
      setError('Para crear usuarios adicionales, hazlo desde Supabase → Authentication → Users y luego actualiza su rol aquí.')
    }
    setSaving(false)
  }

  async function updateRol(id, rol) {
    await supabase.from('perfiles').update({ rol }).eq('id', id)
    loadUsuarios()
  }

  const rolBadge = { Administrador: 'badge-blue', Capturista: 'badge-green', Consulta: 'badge-gray' }
  const esAdmin = perfil?.rol === 'Administrador'

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-medium">Usuarios</h2>
          <div className="text-xs text-gray-400">Gestión de acceso a la aplicación</div>
        </div>
        {esAdmin && <button className="btn btn-primary" onClick={() => { setModal(true); setError(''); setExito('') }}>+ Nuevo usuario</button>}
      </div>

      {esAdmin && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs px-4 py-3 rounded-lg mb-4">
          Para crear nuevos usuarios ve a <strong>supabase.com → Authentication → Users → Add user</strong>, 
          crea el usuario ahí y aquí podrás cambiar su rol.
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Nombre</th>
              <th className="th w-48">ID / Email</th>
              <th className="th w-36">Rol</th>
              <th className="th w-28">Registrado</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.length ? usuarios.map(u => (
              <tr key={u.id}>
                <td className="td font-medium">{u.nombre || '(sin nombre)'}</td>
                <td className="td text-xs text-gray-400 truncate">{u.id.slice(0, 16)}...</td>
                <td className="td">
                  {esAdmin ? (
                    <select
                      className="input py-1 text-xs"
                      value={u.rol}
                      onChange={e => updateRol(u.id, e.target.value)}
                    >
                      <option>Administrador</option>
                      <option>Capturista</option>
                      <option>Consulta</option>
                    </select>
                  ) : (
                    <span className={`badge ${rolBadge[u.rol] || 'badge-gray'}`}>{u.rol}</span>
                  )}
                </td>
                <td className="td text-xs text-gray-400">
                  {new Date(u.created_at).toLocaleDateString('es-MX')}
                </td>
              </tr>
            )) : (
              <tr><td colSpan={4} className="td text-center text-gray-400 py-10">Sin usuarios registrados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}