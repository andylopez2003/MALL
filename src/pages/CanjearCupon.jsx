import { useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { useCupones } from '../hooks/useCupones.jsx'
import { money } from '../utils/business.js'

export default function CanjearCupon() {
  const { profile } = useAuth()
  const { validarYCanjear } = useCupones()
  const [codigo, setCodigo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [cupon, setCupon] = useState(null)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setError('')
    setCupon(null)
    try {
      const data = await validarYCanjear({ codigo, adminId: profile.id, descripcion })
      setCupon(data)
      setCodigo('')
      setDescripcion('')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Navbar>
      <PageHeader title="Canjear cupon" subtitle="Valida cupones de domicilio y evita doble canje." />
      {error ? <div className="error">{error}</div> : null}
      <form className="card grid" onSubmit={submit} style={{ maxWidth: 620 }}>
        <input className="input-field" placeholder="Codigo del cupon" value={codigo} onChange={(event) => setCodigo(event.target.value)} required />
        <textarea className="input-field" placeholder="Productos entregados al cliente" value={descripcion} onChange={(event) => setDescripcion(event.target.value)} required />
        <button className="btn-primary">Validar y canjear</button>
      </form>
      {cupon ? <div className="card" style={{ marginTop: 16 }}>Cupon canjeado por {money(cupon.valor)}.</div> : null}
    </Navbar>
  )
}
