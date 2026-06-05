import { useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { usePuntos } from '../hooks/usePuntos.jsx'
import { supabase } from '../supabase.js'

export default function CanjearPuntos() {
  const { profile } = useAuth()
  const { canjearPuntos } = usePuntos()
  const [dpi, setDpi] = useState('')
  const [cliente, setCliente] = useState(null)
  const [saldo, setSaldo] = useState(null)
  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function cargarSaldo(clienteId) {
    const { data, error: puntosError } = await supabase
      .from('puntos')
      .select('saldo,total_ganado,total_canjeado')
      .eq('cliente_id', clienteId)
      .maybeSingle()

    if (puntosError) throw puntosError

    if (!data) {
      const { data: nuevoSaldo, error: insertError } = await supabase
        .from('puntos')
        .insert({ cliente_id: clienteId, saldo: 0, total_ganado: 0, total_canjeado: 0 })
        .select('saldo,total_ganado,total_canjeado')
        .single()
      if (insertError) throw insertError
      return nuevoSaldo
    }

    return data
  }

  async function buscar(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setSaldo(null)
    try {
      const { data, error: clienteError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('dpi', dpi.trim())
        .eq('rol', 'cliente')
        .maybeSingle()

      if (clienteError) throw clienteError
      if (!data) {
        setCliente(null)
        setError('Cliente no encontrado.')
        return
      }

      setCliente(data)
      setSaldo(await cargarSaldo(data.id))
    } catch (err) {
      setCliente(null)
      setError(err.message)
    }
  }

  async function guardar(event) {
    event.preventDefault()
    try {
      await canjearPuntos({ clienteId: cliente.id, monto: Number(monto), descripcion, adminId: profile.id })
      setMessage('Canje registrado correctamente.')
      setMonto('')
      setDescripcion('')
      setSaldo(await cargarSaldo(cliente.id))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Navbar>
      <PageHeader title="Canjear puntos" subtitle="Los puntos se canjean por productos fisicos, no descuentan el cobro." />
      {error ? <div className="error">{error}</div> : null}
      {message ? <div className="card" style={{ marginBottom: 16 }}>{message}</div> : null}
      <div className="grid grid-2">
        <form className="card grid" onSubmit={buscar}>
          <input className="input-field" placeholder="DPI del cliente" value={dpi} onChange={(event) => setDpi(event.target.value)} required />
          <button className="btn-primary">Buscar cliente</button>
        </form>
        <form className="card grid" onSubmit={guardar}>
          <h2 className="font-display" style={{ margin: 0 }}>{cliente ? cliente.nombre : 'Cliente'}</h2>

          {saldo ? (
            <div style={{ textAlign: 'center', background: '#f0faf6', borderRadius: 10, padding: '14px 8px', margin: '4px 0' }}>
              <div style={{ fontSize: 11, color: 'var(--mall-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                Puntos disponibles
              </div>
              <div style={{ fontSize: 52, fontWeight: 900, color: 'var(--mall-main)', lineHeight: 1, marginBottom: 6 }}>
                {saldo.saldo ?? 0}
              </div>
              <div style={{ fontSize: 13, color: 'var(--mall-muted)' }}>
                Ganados: <strong>{saldo.total_ganado || 0}</strong> · Canjeados: <strong>{saldo.total_canjeado || 0}</strong>
              </div>
            </div>
          ) : (
            <p className="muted" style={{ textAlign: 'center' }}>Busca un cliente para ver sus puntos.</p>
          )}
          <input className="input-field" type="number" placeholder="Puntos a canjear" value={monto} onChange={(event) => setMonto(event.target.value)} disabled={!cliente} required />
          <textarea className="input-field" placeholder="Productos entregados" value={descripcion} onChange={(event) => setDescripcion(event.target.value)} disabled={!cliente} required />
          <button className="btn-accent" disabled={!cliente}>Registrar canje</button>
        </form>
      </div>
    </Navbar>
  )
}
