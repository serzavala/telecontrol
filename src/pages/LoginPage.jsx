import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const { signIn, enviarRecuperacion } = useAuth()
  const navigate = useNavigate()
  const [modo, setModo] = useState('login')
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  function cambiarModo(nuevo) {
    setModo(nuevo)
    setError('')
    setExito('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(form.email, form.password)
    if (error) setError('Correo o contraseña incorrectos.')
    else navigate('/dashboard')
    setLoading(false)
  }

  async function handleRecuperar(e) {
    e.preventDefault()
    setError('')
    setExito('')
    if (!form.email) {
      setError('Escribe tu correo electrónico.')
      return
    }
    setLoading(true)
    const { error } = await enviarRecuperacion(form.email)
    setLoading(false)
    if (error) setError('No se pudo enviar el correo. Intenta de nuevo en unos minutos.')
    else setExito('Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-2xl font-medium text-gray-900">TeleControl</div>
          <div className="text-sm text-gray-500 mt-1">Control de producción de cuadrillas</div>
        </div>

        <div className="card">
          {modo === 'login' ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="label">Correo electrónico</label>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="correo@empresa.com"
                  required
                />
              </div>
              <div>
                <label className="label">Contraseña</label>
                <input
                  className="input"
                  type="password"
                  value={form.password}
                  onChange={set('password')}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>

              {error && (
                <div className="text-xs px-3 py-2 rounded-lg bg-red-50 text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full justify-center mt-2"
              >
                {loading ? 'Cargando...' : 'Iniciar sesión'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() => cambiarModo('recuperar')}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRecuperar} className="space-y-3">
              <div className="text-sm font-medium text-gray-900">Recuperar contraseña</div>
              <div className="text-xs text-gray-500">
                Te enviaremos un enlace para crear una nueva contraseña.
              </div>

              <div>
                <label className="label">Correo electrónico</label>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="correo@empresa.com"
                  required
                />
              </div>

              {error && (
                <div className="text-xs px-3 py-2 rounded-lg bg-red-50 text-red-600">
                  {error}
                </div>
              )}
              {exito && (
                <div className="text-xs px-3 py-2 rounded-lg bg-green-50 text-green-700">
                  {exito}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full justify-center mt-2"
              >
                {loading ? 'Enviando...' : 'Enviar enlace'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  className="text-xs text-gray-500 hover:underline"
                  onClick={() => cambiarModo('login')}
                >
                  Volver al inicio de sesión
                </button>
              </div>
            </form>
          )}

          <div className="mt-4 pt-4 border-t border-gray-100 text-center text-xs text-gray-400">
            ¿No tienes acceso? Contacta al administrador.
          </div>
        </div>
      </div>
    </div>
  )
}
