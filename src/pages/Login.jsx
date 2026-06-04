import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.jsx'

export default function Login() {
  const { login, user, authError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(email, password)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={handleSubmit}>
        <div className="brand" style={{ color: '#0F6E56' }}><span className="brand-mark">M</span>MALL Admin</div>
        <p className="page-subtitle">Ingresa con el usuario administrador de Supabase.</p>
        {authError ? <div className="error">{authError}</div> : null}
        {error ? <div className="error">{error}</div> : null}
        <div className="grid">
          <input className="input-field" type="email" placeholder="Correo" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <input className="input-field" type="password" placeholder="Contrasena" value={password} onChange={(event) => setPassword(event.target.value)} required />
          <button className="btn-primary" disabled={loading}><LogIn size={18} /> {loading ? 'Ingresando...' : 'Ingresar'}</button>
        </div>
      </form>
    </div>
  )
}
