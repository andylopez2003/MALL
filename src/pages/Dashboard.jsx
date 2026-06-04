import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bike, Gift, ShoppingBag, Users } from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import { supabase } from '../supabase.js'
import { money, statusBadge, todayRange } from '../utils/business.js'

export default function Dashboard() {
  const [stats, setStats] = useState({ clientes: 0, ventas: 0, pedidos: 0, cupones: 0 })
  const [pedidos, setPedidos] = useState([])

  useEffect(() => {
    async function load() {
      const { start, end } = todayRange()
      const [clientes, compras, pedidosHoy, cupones] = await Promise.all([
        supabase.from('usuarios').select('id', { count: 'exact', head: true }).eq('rol', 'cliente'),
        supabase.from('compras').select('monto_total').gte('created_at', start).lt('created_at', end),
        supabase.from('pedidos').select('*, usuarios(nombre)').gte('created_at', start).lt('created_at', end).order('created_at', { ascending: false }),
        supabase.from('cupones').select('id', { count: 'exact', head: true }).gte('fecha_emision', start).lt('fecha_emision', end),
      ])

      setStats({
        clientes: clientes.count || 0,
        ventas: (compras.data || []).reduce((sum, row) => sum + Number(row.monto_total || 0), 0),
        pedidos: pedidosHoy.data?.length || 0,
        cupones: cupones.count || 0,
      })
      setPedidos(pedidosHoy.data || [])
    }
    load()
  }, [])

  return (
    <Navbar>
      <PageHeader title="Panel de control" subtitle="Resumen operativo de la tienda y acciones rapidas." />
      <div className="grid grid-4">
        <StatCard label="Clientes" value={stats.clientes} icon={Users} />
        <StatCard label="Ventas hoy" value={money(stats.ventas)} icon={ShoppingBag} />
        <StatCard label="Pedidos hoy" value={stats.pedidos} icon={Bike} />
        <StatCard label="Cupones hoy" value={stats.cupones} icon={Gift} />
      </div>
      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <section className="card">
          <h2 className="font-display">Acciones rapidas</h2>
          <div className="actions" style={{ marginTop: 14 }}>
            <Link className="btn-primary" to="/registrar-compra">Registrar compra</Link>
            <Link className="btn-accent" to="/canjear-puntos">Canjear puntos</Link>
            <Link className="btn-outline" to="/canjear-cupon">Canjear cupon</Link>
          </div>
        </section>
        <section className="card">
          <h2 className="font-display">Pedidos recientes</h2>
          {pedidos.length === 0 ? <div className="empty">No hay pedidos hoy.</div> : (
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  {pedidos.slice(0, 5).map((pedido) => (
                    <tr key={pedido.id}>
                      <td>{pedido.usuarios?.nombre || 'Cliente'}</td>
                      <td>{money(pedido.monto_total)}</td>
                      <td><span className={statusBadge(pedido.estado)}>{pedido.estado}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Navbar>
  )
}
