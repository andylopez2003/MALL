import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { supabase } from '../supabase.js'
import { money, statusBadge } from '../utils/business.js'

export default function Ofertas() {
  const [productos, setProductos] = useState([])
  const [ofertas, setOfertas] = useState([])
  const [form, setForm] = useState({ producto_id: '', precio_oferta: '', porcentaje_descuento: '', fecha_inicio: '', fecha_fin: '', activa: true })

  async function load() {
    const [prod, off] = await Promise.all([
      supabase.from('productos').select('id,nombre,precio').eq('activo', true).order('nombre'),
      supabase.from('ofertas').select('*, productos(nombre, precio)').order('fecha_inicio', { ascending: false }),
    ])
    setProductos(prod.data || [])
    setOfertas(off.data || [])
  }
  useEffect(() => { load() }, [])

  async function save(event) {
    event.preventDefault()
    await supabase.from('ofertas').insert({ ...form, precio_oferta: Number(form.precio_oferta), porcentaje_descuento: Number(form.porcentaje_descuento || 0) })
    setForm({ producto_id: '', precio_oferta: '', porcentaje_descuento: '', fecha_inicio: '', fecha_fin: '', activa: true })
    load()
  }

  return (
    <Navbar>
      <PageHeader title="Ofertas" subtitle="Precios especiales por fecha para productos del catalogo." />
      <div className="grid grid-2">
        <form className="card grid" onSubmit={save}>
          <select className="input-field" value={form.producto_id} onChange={(e) => setForm({ ...form, producto_id: e.target.value })} required>
            <option value="">Seleccionar producto</option>
            {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre} - {money(p.precio)}</option>)}
          </select>
          <input className="input-field" type="number" step="0.01" placeholder="Precio oferta" value={form.precio_oferta} onChange={(e) => setForm({ ...form, precio_oferta: e.target.value })} required />
          <input className="input-field" type="number" placeholder="% descuento" value={form.porcentaje_descuento} onChange={(e) => setForm({ ...form, porcentaje_descuento: e.target.value })} />
          <input className="input-field" type="date" value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} required />
          <input className="input-field" type="date" value={form.fecha_fin} onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })} required />
          <button className="btn-primary">Crear oferta</button>
        </form>
        <section className="card table-wrap">
          <table className="table">
            <thead><tr><th>Producto</th><th>Oferta</th><th>Vigencia</th><th>Estado</th></tr></thead>
            <tbody>{ofertas.map((o) => <tr key={o.id}><td>{o.productos?.nombre}</td><td>{money(o.precio_oferta)}</td><td>{o.fecha_inicio} al {o.fecha_fin}</td><td><span className={statusBadge(o.activa ? 'activo' : 'vencido')}>{o.activa ? 'activa' : 'inactiva'}</span></td></tr>)}</tbody>
          </table>
        </section>
      </div>
    </Navbar>
  )
}
