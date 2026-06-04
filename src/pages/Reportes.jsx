import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Navbar from '../components/Navbar.jsx'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import { supabase } from '../supabase.js'
import { dateInputValue, groupByDate, money } from '../utils/business.js'

const MAIN = '#1D9E75'
const ACCENT = '#EF9F27'

function getRange(period, customStart, customEnd) {
  const now = new Date()
  let start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (period === 'semana') start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
  if (period === 'mes') start = new Date(now.getFullYear(), now.getMonth(), 1)
  if (period === 'custom') start = new Date(customStart)
  const end = period === 'custom' ? new Date(customEnd) : new Date(now.getFullYear(), now.getMonth(), now.getDate())
  end.setHours(23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

export default function Reportes() {
  const [period, setPeriod] = useState('hoy')
  const [customStart, setCustomStart] = useState(dateInputValue(new Date()))
  const [customEnd, setCustomEnd] = useState(dateInputValue(new Date()))
  const [data, setData] = useState({ compras: [], pedidos: [], movimientos: [], cupones: [], detalles: [] })

  const range = useMemo(() => getRange(period, customStart, customEnd), [period, customStart, customEnd])

  useEffect(() => {
    async function load() {
      const [compras, pedidos, movimientos, cupones, detalles] = await Promise.all([
        supabase.from('compras').select('*, usuarios(nombre)').gte('created_at', range.start).lte('created_at', range.end),
        supabase.from('pedidos').select('*, usuarios(nombre)').gte('created_at', range.start).lte('created_at', range.end),
        supabase.from('movimientos_puntos').select('*').gte('created_at', range.start).lte('created_at', range.end),
        supabase.from('cupones').select('*').gte('fecha_emision', range.start).lte('fecha_emision', range.end),
        supabase.from('detalle_pedidos').select('*, pedidos!inner(created_at, cliente_id, usuarios(nombre)), productos(imagen_url)').gte('pedidos.created_at', range.start).lte('pedidos.created_at', range.end),
      ])
      setData({ compras: compras.data || [], pedidos: pedidos.data || [], movimientos: movimientos.data || [], cupones: cupones.data || [], detalles: detalles.data || [] })
    }
    load()
  }, [range])

  const ventasTienda = data.compras.reduce((s, r) => s + Number(r.monto_total || 0), 0)
  const ventasDomicilio = data.pedidos.reduce((s, r) => s + Number(r.monto_total || 0), 0)
  const puntosEntregados = data.movimientos.filter((m) => m.tipo === 'ganado').reduce((s, r) => s + Number(r.monto || 0), 0)

  const ventasPorDia = useMemo(() => {
    const tienda = groupByDate(data.compras, 'created_at', 'monto_total')
    const domicilio = groupByDate(data.pedidos, 'created_at', 'monto_total')
    return [...new Set([...Object.keys(tienda), ...Object.keys(domicilio)])].sort().map((fecha) => ({ fecha, tienda: tienda[fecha] || 0, domicilio: domicilio[fecha] || 0 }))
  }, [data])

  const puntosPorDia = useMemo(() => {
    const ganados = groupByDate(data.movimientos.filter((m) => m.tipo === 'ganado'), 'created_at', 'monto')
    const canjeados = groupByDate(data.movimientos.filter((m) => m.tipo === 'canjeado'), 'created_at', 'monto')
    return [...new Set([...Object.keys(ganados), ...Object.keys(canjeados)])].sort().map((fecha) => ({ fecha, ganados: ganados[fecha] || 0, canjeados: canjeados[fecha] || 0 }))
  }, [data])

  const cupones = [
    { name: 'Activos', value: data.cupones.filter((c) => c.estado === 'activo' && new Date(c.fecha_vencimiento) >= new Date()).length, color: MAIN },
    { name: 'Canjeados', value: data.cupones.filter((c) => c.estado === 'canjeado').length, color: '#8a9792' },
    { name: 'Vencidos', value: data.cupones.filter((c) => c.estado === 'vencido' || (c.estado === 'activo' && new Date(c.fecha_vencimiento) < new Date())).length, color: '#d94b4b' },
  ]

  const productos = Object.values(data.detalles.reduce((acc, d) => {
    const key = d.producto_id || d.nombre_producto
    acc[key] ||= { nombre: d.nombre_producto, imagen: d.productos?.imagen_url, cantidad: 0, ingresos: 0 }
    acc[key].cantidad += Number(d.cantidad || 0)
    acc[key].ingresos += Number(d.subtotal || 0)
    return acc
  }, {})).sort((a, b) => b.cantidad - a.cantidad).slice(0, 10)

  const clientes = Object.values([...data.compras, ...data.pedidos].reduce((acc, row) => {
    const key = row.cliente_id
    acc[key] ||= { nombre: row.usuarios?.nombre || 'Cliente', compras: 0, total: 0 }
    acc[key].compras += 1
    acc[key].total += Number(row.monto_total || 0)
    return acc
  }, {})).sort((a, b) => b.total - a.total).slice(0, 10)

  return (
    <Navbar>
      <PageHeader title="Reportes" subtitle="Ventas, puntos, cupones y rendimiento por periodo." />
      <div className="toolbar">
        {[['hoy', 'Hoy'], ['semana', 'Esta semana'], ['mes', 'Este mes'], ['custom', 'Rango personalizado']].map(([value, label]) => <button key={value} className={period === value ? 'btn-primary' : 'btn-outline'} onClick={() => setPeriod(value)}>{label}</button>)}
        {period === 'custom' ? <><input className="input-field" type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} /><input className="input-field" type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} /></> : null}
      </div>
      <div className="grid grid-4">
        <StatCard label="Ventas tienda" value={money(ventasTienda)} />
        <StatCard label="Ventas domicilio" value={money(ventasDomicilio)} />
        <StatCard label="Puntos entregados" value={puntosEntregados} />
        <StatCard label="Cupones generados" value={data.cupones.length} />
      </div>
      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <section className="card"><h2 className="font-display">Ventas por dia</h2><div className="chart-box"><ResponsiveContainer><BarChart data={ventasPorDia}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="fecha" /><YAxis /><Tooltip formatter={(v) => money(v)} /><Bar dataKey="tienda" fill={MAIN} /><Bar dataKey="domicilio" fill={ACCENT} /></BarChart></ResponsiveContainer></div></section>
        <section className="card"><h2 className="font-display">Puntos</h2><div className="chart-box"><ResponsiveContainer><LineChart data={puntosPorDia}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="fecha" /><YAxis /><Tooltip /><Line dataKey="ganados" stroke={MAIN} strokeWidth={3} /><Line dataKey="canjeados" stroke={ACCENT} strokeWidth={3} /></LineChart></ResponsiveContainer></div></section>
        <section className="card"><h2 className="font-display">Cupones</h2><div className="chart-box"><ResponsiveContainer><PieChart><Pie data={cupones} dataKey="value" nameKey="name" outerRadius={100} label>{cupones.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></section>
        <section className="card table-wrap"><h2 className="font-display">Top clientes</h2><table className="table"><thead><tr><th>Nombre</th><th>Compras</th><th>Total</th></tr></thead><tbody>{clientes.map((c) => <tr key={c.nombre}><td>{c.nombre}</td><td>{c.compras}</td><td>{money(c.total)}</td></tr>)}</tbody></table></section>
      </div>
      <section className="card table-wrap" style={{ marginTop: 16 }}>
        <h2 className="font-display">Top productos pedidos</h2>
        <table className="table"><thead><tr><th></th><th>Producto</th><th>Cantidad</th><th>Ingresos</th></tr></thead><tbody>{productos.map((p) => <tr key={p.nombre}><td>{p.imagen ? <img className="product-img" src={p.imagen} /> : null}</td><td>{p.nombre}</td><td>{p.cantidad}</td><td>{money(p.ingresos)}</td></tr>)}</tbody></table>
      </section>
    </Navbar>
  )
}
