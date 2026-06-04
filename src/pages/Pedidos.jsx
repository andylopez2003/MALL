import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { usePedidos } from '../hooks/usePedidos.jsx'
import { money, statusBadge } from '../utils/business.js'

const estados = ['pendiente', 'confirmado', 'preparando', 'en_camino', 'entregado', 'cancelado']

export default function Pedidos() {
  const { pedidosHoy, cambiarEstado } = usePedidos()
  const [pedidos, setPedidos] = useState([])
  const [error, setError] = useState('')

  async function load() {
    try { setPedidos(await pedidosHoy()) } catch (err) { setError(err.message) }
  }
  useEffect(() => { load() }, [])

  async function update(id, estado) {
    await cambiarEstado(id, estado)
    load()
  }

  return (
    <Navbar>
      <PageHeader title="Pedidos" subtitle="Gestion de pedidos a domicilio de hoy." />
      {error ? <div className="error">{error}</div> : null}
      <section className="card table-wrap">
        <table className="table">
          <thead><tr><th>Cliente</th><th>Telefono</th><th>Direccion</th><th>Horario</th><th>Monto</th><th>Estado</th><th>Cambiar</th></tr></thead>
          <tbody>{pedidos.map((p) => <tr key={p.id}><td>{p.usuarios?.nombre || 'Cliente'}</td><td>{p.telefono_contacto || p.usuarios?.telefono}</td><td>{p.direccion_entrega}</td><td>{p.hora_entrega_asignada || p.horario}</td><td>{money(p.monto_total)}</td><td><span className={statusBadge(p.estado)}>{p.estado}</span></td><td><select className="input-field" value={p.estado} onChange={(e) => update(p.id, e.target.value)}>{estados.map((e) => <option key={e}>{e}</option>)}</select></td></tr>)}</tbody>
        </table>
      </section>
    </Navbar>
  )
}
