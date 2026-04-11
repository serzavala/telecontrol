import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [modo, setModo] = useState('login') // 'login' | 'registro'
  const [form, setForm] = useState({ nombre: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    if (modo === 'login') {
      const { error } = await signIn(form.email, form.password)
      if (error) setError('Correo o contraseña incorrectos.')
      else navigate('/dashboard')
    } else {
      if (!form.nombre) { setError('Ingresa tu nombre.'); setLoading(false); return }
      const { error } = await signUp(form.email, form.password, form.nombre)
      if (error) setError(error.message)
      else { setModo('login'); setError('Cuenta creada. Ya puedes iniciar sesión.') }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-2xl font-medium text-gray-900">TeleControl</div>
          <div className="text-sm text-gray-500 mt-1">Control de producción de cuadrillas</div>
        </div>

        <div className="card">
          <div className="flex mb-6 border border-gray-200 rounded-lg overflow-hidden">
            {['login', 'registro'].map(m => (
              <button
                key={m}
                onClick={() => { setModo(m); setError('') }}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  modo === m ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {m === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {modo === 'registro' && (
              <div>
                <label className="label">Nombre completo</label>
                <input className="input" type="text" value={form.nombre} onChange={set('nombre')} placeholder="Tu nombre" />
              </div>
            )}
            <div>
              <label className="label">Correo electrónico</label>
              <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="correo@empresa.com" required />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input className="input" type="password" value={form.password} onChange={set('password')} placeholder="••••••••" required minLength={6} />
            </div>

            {error && (
              <div className={`text-xs px-3 py-2 rounded-lg ${
                error.includes('creada') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
              }`}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center mt-2">
              {loading ? 'Cargando...' : modo === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
