import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ResetPassword() {
  const { user, loading, cambiarPassword, signOut } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirma, setConfirma] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirma) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setSaving(true)
    const { error: err } = await cambiarPassword(password)
    setSaving(false)
    if (err) {
      setError(err.message === 'Auth session missing!'
        ? 'El enlace expiró o ya fue usado. Solicita uno nuevo desde el login.'
        : err.message)
      return
    }
    setExito('Contraseña actualizada. Redirigiendo...')
    setTimeout(() => navigate('/dashboard', { replace: true }), 1500)
  }

  async function handleCancelar() {
    await signOut()
    navigate('/login', { replace: true })
  }

  if (loading) {
    return (
      <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'#6B7A99',fontSize:14 }}>
        Cargando...
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
          <h2 className="text-lg font-medium mb-2">Enlace no válido</h2>
          <p className="text-sm text-gray-500 mb-5">
            El enlace de recuperación expiró o ya fue usado. Solicita uno nuevo desde el login.
          </p>
          <button className="btn btn-primary w-full" onClick={() => navigate('/login', { replace: true })}>
            Ir al login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-medium mb-1">Nueva contraseña</h2>
        <div className="text-xs text-gray-400 mb-5">{user.email}</div>

        <label className="block text-xs text-gray-500 mb-1">Nueva contraseña</label>
        <input
          type="password"
          className="input w-full mb-4"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="new-password"
        />

        <label className="block text-xs text-gray-500 mb-1">Confirmar contraseña</label>
        <input
          type="password"
          className="input w-full mb-4"
          value={confirma}
          onChange={e => setConfirma(e.target.value)}
          autoComplete="new-password"
        />

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg mb-4">{error}</div>}
        {exito && <div className="bg-green-50 border border-green-200 text-green-700 text-xs px-3 py-2 rounded-lg mb-4">{exito}</div>}

        <button type="submit" className="btn btn-primary w-full mb-2" disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar contraseña'}
        </button>
        <button type="button" className="btn w-full text-xs text-gray-500" onClick={handleCancelar}>
          Cancelar y salir
        </button>
      </form>
    </div>
  )
}
