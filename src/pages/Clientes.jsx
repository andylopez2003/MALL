import { useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { supabase } from '../supabase.js'

const emptyForm = { nombre: '', email: '', telefono: '', dpi: '', direccion: '', rol: 'cliente' }

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    const { data, error: fetchError } = await supabase.from('usuarios').select('*').eq('rol', 'cliente').order('nombre')
    if (fetchError) setError(fetchError.message)
    setClientes(data || [])
  }

  useEffect(() => { load() }, [])

  async function save(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    const dpi = form.dpi.trim()
    if (!dpi) {
      setError('El DPI es obligatorio y debe ser unico.')
      return
    }

    const payload = {
      ...form,
      nombre: form.nombre.trim(),
      email: form.email.trim() || null,
      telefono: form.telefono.trim() || null,
      dpi,
      direccion: form.direccion.trim() || null,
      rol: 'cliente',
      onboarding_completo: false,
    }

    const { data: cliente, error: upsertError } = await supabase
      .from('usuarios')
      .upsert(payload, { onConflict: 'dpi' })
      .select()
      .single()

    if (upsertError) {
      if (upsertError.message.includes('usuarios_email_key')) {
        setError('El correo ya existe en otro cliente. Para este sistema el DPI sera la llave unica; ejecuta el ajuste SQL para quitar el email como unico o deja el correo vacio.')
      } else {
        setError(upsertError.message)
      }
      return
    }

    const { error: puntosError } = await supabase
      .from('puntos')
      .upsert({
        cliente_id: cliente.id,
        saldo: 0,
        total_ganado: 0,
        total_canjeado: 0,
      }, { onConflict: 'cliente_id', ignoreDuplicates: true })

    if (puntosError) setError(puntosError.message)
    else {
      setForm(emptyForm)
      setMessage('Cliente guardado y cuenta de puntos creada.')
      load()
    }
  }

  const filtered = clientes.filter((cliente) => [cliente.nombre, cliente.email, cliente.telefono, cliente.dpi].join(' ').toLowerCase().includes(query.toLowerCase()))

  return (
    <Navbar>
      <PageHeader title="Clientes" subtitle="Registro manual para compras fisicas, puntos y fusion por DPI." />
      {error ? <div className="error">{error}</div> : null}
      {message ? <div className="card" style={{ marginBottom: 16 }}>{message}</div> : null}
      <div className="grid grid-2">
        <form className="card grid" onSubmit={save}>
          <h2 className="font-display">Nuevo cliente</h2>
          {[
            { key: 'nombre', label: 'Nombre completo' },
            { key: 'email', label: 'Correo electrónico' },
            { key: 'telefono', label: 'Teléfono' },
            { key: 'dpi', label: 'DPI (Documento de Identificación)' },
            { key: 'direccion', label: 'Dirección' }
          ].map(({ key, label }) => (
            <input 
              key={key} 
              className="input-field" 
              placeholder={label} 
              value={form[key]} 
              onChange={(event) => setForm({ ...form, [key]: event.target.value })} 
              required={key === 'nombre' || key === 'dpi'} 
            />
          ))}
          <button className="btn-primary"><Plus size={18} /> Guardar cliente</button>
        </form>
        <section className="card">
          <div className="toolbar">
            <Search size={18} />
            <input className="input-field" placeholder="Buscar por nombre, DPI o telefono" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Nombre</th><th>DPI</th><th>Telefono</th><th>Email</th></tr></thead>
              <tbody>
                {filtered.map((cliente) => <tr key={cliente.id}><td>{cliente.nombre}</td><td>{cliente.dpi}</td><td>{cliente.telefono}</td><td>{cliente.email}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Navbar>
  )
}
