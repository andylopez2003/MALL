import { useEffect, useMemo, useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import { supabase } from '../supabase.js'
import { dateInputValue, money } from '../utils/business.js'

function getRange(period, customStart, customEnd) {
  const now = new Date()
  let start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (period === 'semana') start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
  if (period === 'mes')    start = new Date(now.getFullYear(), now.getMonth(), 1)
  if (period === 'custom') start = new Date(customStart)
  const end = period === 'custom' ? new Date(customEnd) : new Date(now.getFullYear(), now.getMonth(), now.getDate())
  end.setHours(23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

function fmtFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-GT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function Badge({ text, type }) {
  const colors = {
    pendiente: { bg: '#fff1d7', color: '#87510b' },
    confirmado: { bg: '#dbeafe', color: '#1a5fa8' },
    preparando: { bg: '#dbeafe', color: '#1a5fa8' },
    en_camino:  { bg: '#ede9fe', color: '#5b21b6' },
    entregado:  { bg: '#dcfce7', color: '#166534' },
    cancelado:  { bg: '#f3f4f6', color: '#6b7280' },
    ganado:     { bg: '#dff7ed', color: '#0f6e56' },
    canjeado:   { bg: '#fff1d7', color: '#87510b' },
  }
  const c = colors[text] || { bg: '#f0f0f0', color: '#555' }
  return <span style={{ background: c.bg, color: c.color, borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{text}</span>
}

export default function Reportes() {
  const [period, setPeriod] = useState('hoy')
  const [customStart, setCustomStart] = useState(dateInputValue(new Date()))
  const [customEnd, setCustomEnd] = useState(dateInputValue(new Date()))
  const [tab, setTab] = useState('compras')
  const [filtroCupon, setFiltroCupon] = useState('todos')
  const [origenCupon, setOrigenCupon] = useState('todos')
  const [data, setData] = useState({ compras: [], pedidos: [], movimientos: [], productos: [], cupones: [] })
  const [loading, setLoading] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [facturaAbierta, setFacturaAbierta] = useState(null)

  const range = useMemo(() => getRange(period, customStart, customEnd), [period, customStart, customEnd])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setBusqueda('')
      const [compras, pedidos, movimientos, detalles, cuponesRes] = await Promise.all([
        supabase.from('compras').select('*, usuarios(nombre, dpi, telefono)').gte('created_at', range.start).lte('created_at', range.end).order('created_at', { ascending: false }),
        supabase.from('pedidos').select('*, usuarios(nombre, dpi, telefono), detalle_pedidos(nombre_producto, cantidad, precio_unitario, subtotal)').gte('created_at', range.start).lte('created_at', range.end).order('created_at', { ascending: false }),
        supabase.from('movimientos_puntos').select('*, usuarios(nombre, dpi)').gte('created_at', range.start).lte('created_at', range.end).order('created_at', { ascending: false }),
        supabase.from('detalle_pedidos').select('nombre_producto, cantidad, precio_unitario, subtotal, pedidos!inner(created_at)').gte('pedidos.created_at', range.start).lte('pedidos.created_at', range.end),
        supabase.from('cupones').select('*, usuarios(nombre, dpi, telefono)').gte('fecha_emision', range.start).lte('fecha_emision', range.end).order('fecha_emision', { ascending: false }),
      ])

      const productosAgrupados = Object.values((detalles.data || []).reduce((acc, d) => {
        const k = d.nombre_producto
        acc[k] ||= { nombre: k, cantidad: 0, ingresos: 0 }
        acc[k].cantidad += Number(d.cantidad || 0)
        acc[k].ingresos += Number(d.subtotal || 0)
        return acc
      }, {})).sort((a, b) => b.cantidad - a.cantidad)

      // Obtener monto_total de los pedidos relacionados a cupones (sin depender de FK join)
      const cuponesData = cuponesRes.data || []
      const pedidoIds = [...new Set(cuponesData.filter((c) => c.pedido_id).map((c) => c.pedido_id))]
      let pedidoMontos = {}
      if (pedidoIds.length > 0) {
        const { data: montosData } = await supabase.from('pedidos').select('id, monto_total').in('id', pedidoIds)
        if (montosData) pedidoMontos = Object.fromEntries(montosData.map((p) => [p.id, p.monto_total]))
      }
      const cupones = cuponesData.map((c) => ({ ...c, pedido_monto: c.pedido_id ? pedidoMontos[c.pedido_id] ?? null : null }))

      setData({
        compras: compras.data || [],
        pedidos: pedidos.data || [],
        movimientos: movimientos.data || [],
        productos: productosAgrupados,
        cupones,
      })
      setLoading(false)
    }
    load()
  }, [range])

  const totalTienda     = data.compras.reduce((s, r) => s + Number(r.monto_total || 0), 0)
  const totalDomicilio  = data.pedidos.filter(p => p.estado !== 'cancelado').reduce((s, r) => s + Number(r.monto_total || 0), 0)
  const totalPuntos     = data.movimientos.filter(m => m.tipo === 'ganado').reduce((s, r) => s + Number(r.monto || 0), 0)

  const q = busqueda.toLowerCase()

  const comprasFiltradas = data.compras.filter(c =>
    !q || c.usuarios?.nombre?.toLowerCase().includes(q) || c.usuarios?.dpi?.includes(q) || c.usuarios?.telefono?.includes(q)
  )

  const pedidosFiltrados = data.pedidos.filter(p =>
    !q || p.usuarios?.nombre?.toLowerCase().includes(q) || p.usuarios?.telefono?.includes(q) || p.telefono_contacto?.includes(q) || p.usuarios?.dpi?.includes(q) || p.id.slice(0, 8).toLowerCase().includes(q)
  )

  const movimientosFiltrados = data.movimientos.filter(m =>
    !q || m.usuarios?.nombre?.toLowerCase().includes(q) || m.usuarios?.dpi?.includes(q)
  )

  const productosFiltrados = data.productos.filter(p =>
    !q || p.nombre.toLowerCase().includes(q)
  )

  const cuponesVisisbles = data.cupones.filter((c) => {
    const matchQ = !q || c.codigo?.includes(q.toUpperCase()) || c.usuarios?.nombre?.toLowerCase().includes(q) || c.usuarios?.dpi?.includes(q) || c.usuarios?.telefono?.includes(q) || (c.pedido_id && c.pedido_id.slice(0, 8).toLowerCase().includes(q))
    const matchFiltro = filtroCupon === 'todos' || c.estado === filtroCupon
    const matchOrigen = origenCupon === 'todos' || (origenCupon === 'domicilio' ? !!c.pedido_id : !c.pedido_id)
    return matchQ && matchFiltro && matchOrigen
  })

  const TABS = [
    { id: 'compras',   label: `Compras tienda (${data.compras.length})` },
    { id: 'pedidos',   label: `Pedidos domicilio (${data.pedidos.length})` },
    { id: 'puntos',    label: `Movimientos puntos (${data.movimientos.length})` },
    { id: 'productos', label: `Productos vendidos (${data.productos.length})` },
    { id: 'cupones',   label: `Cupones (${data.cupones.length})` },
  ]

  return (
    <Navbar>
      <PageHeader title="Reportes" subtitle="Ventas, pedidos, puntos y productos por periodo." />

      {/* Filtro de periodo */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {[['hoy', 'Hoy'], ['semana', 'Semana'], ['mes', 'Mes'], ['custom', 'Rango']].map(([v, l]) => (
          <button key={v} className={period === v ? 'btn-primary' : 'btn-outline'} onClick={() => setPeriod(v)} style={{ fontSize: 13 }}>{l}</button>
        ))}
        {period === 'custom' ? (
          <>
            <input className="input-field" type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ maxWidth: 150 }} />
            <input className="input-field" type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={{ maxWidth: 150 }} />
          </>
        ) : null}
      </div>

      {/* Stats */}
      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <StatCard label="Ventas tienda" value={money(totalTienda)} />
        <StatCard label="Ventas domicilio" value={money(totalDomicilio)} />
        <StatCard label="Puntos entregados" value={totalPuntos} />
        <StatCard label="Total general" value={money(totalTienda + totalDomicilio)} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {TABS.map(t => (
          <button key={t.id} className={tab === t.id ? 'btn-primary' : 'btn-outline'} onClick={() => { setTab(t.id); setBusqueda('') }} style={{ fontSize: 12 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Buscador + filtro estado cupones */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input
          className="input-field"
          placeholder={
            tab === 'compras'   ? 'Buscar por nombre, DPI o teléfono...' :
            tab === 'pedidos'   ? 'Buscar por nombre, DPI, teléfono o N° pedido...' :
            tab === 'cupones'   ? 'Buscar por código, nombre, DPI, teléfono o N° pedido...' :
            tab === 'productos' ? 'Buscar producto...' :
            'Buscar por nombre o DPI...'
          }
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ maxWidth: 340 }}
        />
        {tab === 'cupones' ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[['todos','Todos'],['activo','Activos'],['canjeado','Canjeados'],['vencido','Vencidos']].map(([v, l]) => (
                <button key={v} className={filtroCupon === v ? 'btn-primary' : 'btn-outline'} style={{ fontSize: 12 }} onClick={() => setFiltroCupon(v)}>{l}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[['todos','Todos'],['domicilio','Solo domicilios'],['manual','Solo manuales']].map(([v, l]) => (
                <button key={v} className={origenCupon === v ? 'btn-accent' : 'btn-outline'} style={{ fontSize: 12 }} onClick={() => setOrigenCupon(v)}>{l}</button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {loading ? <div className="card muted" style={{ textAlign: 'center', padding: 24 }}>Cargando datos...</div> : null}

      {/* Tabla Compras */}
      {!loading && tab === 'compras' ? (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>DPI</th>
                <th>Teléfono</th>
                <th style={{ textAlign: 'right' }}>Monto</th>
                <th style={{ textAlign: 'right' }}>Puntos</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {comprasFiltradas.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--mall-muted)', padding: 20 }}>Sin registros</td></tr>
              ) : comprasFiltradas.map((c) => (
                <>
                  <tr key={c.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmtFecha(c.created_at)}</td>
                    <td><strong>{c.usuarios?.nombre || 'C/F'}</strong></td>
                    <td style={{ fontSize: 12, color: 'var(--mall-muted)' }}>{c.usuarios?.dpi || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--mall-muted)' }}>{c.usuarios?.telefono || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(c.monto_total)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--mall-main)', fontWeight: 600 }}>{c.puntos_ganados || 0}</td>
                    <td>
                      <button
                        type="button"
                        style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--mall-line)', background: facturaAbierta === c.id ? '#dff7ed' : 'white', cursor: 'pointer', color: 'var(--mall-main)', fontWeight: 700, whiteSpace: 'nowrap' }}
                        onClick={() => setFacturaAbierta(facturaAbierta === c.id ? null : c.id)}
                      >
                        {facturaAbierta === c.id ? '▲ Ocultar' : '📄 Ver'}
                      </button>
                    </td>
                  </tr>
                  {facturaAbierta === c.id ? (
                    <tr key={c.id + '_det'}>
                      <td colSpan={7} style={{ padding: '0 0 10px 0', background: '#f8fdf9' }}>
                        <div style={{ padding: '10px 14px', borderTop: '2px solid var(--mall-main)' }}>
                          <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--mall-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Compra en tienda</div>
                          <div style={{ display: 'grid', gap: 4, fontSize: 13 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span className="muted">Cliente</span>
                              <strong>{c.usuarios?.nombre || 'Cliente Final (C/F)'}</strong>
                            </div>
                            {c.usuarios?.dpi ? <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="muted">DPI</span><span>{c.usuarios.dpi}</span></div> : null}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, paddingTop: 6, borderTop: '1px solid #e0e0e0' }}>
                              <span>Total cobrado</span>
                              <span className="price">{money(c.monto_total)}</span>
                            </div>
                            {Number(c.puntos_ganados || 0) > 0 ? (
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--mall-main)', fontSize: 12 }}>
                                <span>Puntos ganados</span><span>+{c.puntos_ganados} pts</span>
                              </div>
                            ) : null}
                            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                              Los productos no se guardan por compra en tienda — solo el total.
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </>
              ))}
            </tbody>
            {comprasFiltradas.length > 0 ? (
              <tfoot>
                <tr style={{ fontWeight: 900, background: '#f0faf6' }}>
                  <td colSpan={4} style={{ textAlign: 'right' }}>Total:</td>
                  <td style={{ textAlign: 'right' }}>{money(comprasFiltradas.reduce((s, c) => s + Number(c.monto_total || 0), 0))}</td>
                  <td style={{ textAlign: 'right' }}>{comprasFiltradas.reduce((s, c) => s + Number(c.puntos_ganados || 0), 0)}</td>
                  <td />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      ) : null}

      {/* Tabla Pedidos */}
      {!loading && tab === 'pedidos' ? (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>N° Pedido</th>
                <th>Cliente</th>
                <th>Teléfono</th>
                <th>Dirección</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pedidosFiltrados.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--mall-muted)', padding: 20 }}>Sin registros</td></tr>
              ) : pedidosFiltrados.map((p) => (
                <>
                  <tr key={p.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmtFecha(p.created_at)}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>{p.id.slice(0, 8).toUpperCase()}</td>
                    <td><strong>{p.usuarios?.nombre || '—'}</strong></td>
                    <td style={{ fontSize: 12, color: 'var(--mall-muted)' }}>{p.telefono_contacto || p.usuarios?.telefono || '—'}</td>
                    <td style={{ fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.direccion_entrega || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(p.monto_total)}</td>
                    <td><Badge text={p.estado} /></td>
                    <td>
                      <button
                        type="button"
                        style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--mall-line)', background: facturaAbierta === p.id ? '#dff7ed' : 'white', cursor: 'pointer', color: 'var(--mall-main)', fontWeight: 700, whiteSpace: 'nowrap' }}
                        onClick={() => setFacturaAbierta(facturaAbierta === p.id ? null : p.id)}
                      >
                        {facturaAbierta === p.id ? '▲ Ocultar' : '📄 Ver'}
                      </button>
                    </td>
                  </tr>
                  {facturaAbierta === p.id ? (
                    <tr key={p.id + '_det'}>
                      <td colSpan={8} style={{ padding: '0 0 10px 0', background: '#f8fdf9' }}>
                        <div style={{ padding: '10px 14px', borderTop: '2px solid var(--mall-main)' }}>
                          <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--mall-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                            Factura — {p.usuarios?.nombre || 'Cliente'} — {p.horario || p.hora_entrega_asignada || ''}
                          </div>
                          {(p.detalle_pedidos || []).length === 0 ? (
                            <div className="muted" style={{ fontSize: 13 }}>Sin detalle de productos</div>
                          ) : (
                            <div style={{ display: 'grid', gap: 4 }}>
                              {(p.detalle_pedidos || []).map((d, i) => (
                                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0 12px', fontSize: 13, padding: '4px 0', borderBottom: '1px dotted #e0e0e0' }}>
                                  <span>{d.nombre_producto} <span style={{ color: 'var(--mall-muted)' }}>×{d.cantidad}</span></span>
                                  <span style={{ color: 'var(--mall-muted)' }}>{money(d.precio_unitario)} c/u</span>
                                  <span style={{ fontWeight: 700 }}>{money(d.subtotal)}</span>
                                </div>
                              ))}
                              <div style={{ display: 'flex', justifyContent: 'flex-end', fontWeight: 900, fontSize: 14, paddingTop: 6, borderTop: '2px solid #c7e8d8' }}>
                                <span className="price">{money(p.monto_total)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </>
              ))}
            </tbody>
            {pedidosFiltrados.length > 0 ? (
              <tfoot>
                <tr style={{ fontWeight: 900, background: '#f0faf6' }}>
                  <td colSpan={5} style={{ textAlign: 'right' }}>Total (no cancelados):</td>
                  <td style={{ textAlign: 'right' }}>{money(pedidosFiltrados.filter(p => p.estado !== 'cancelado').reduce((s, p) => s + Number(p.monto_total || 0), 0))}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      ) : null}

      {/* Tabla Puntos */}
      {!loading && tab === 'puntos' ? (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>DPI</th>
                <th>Tipo</th>
                <th style={{ textAlign: 'right' }}>Puntos</th>
                <th>Descripción</th>
              </tr>
            </thead>
            <tbody>
              {movimientosFiltrados.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--mall-muted)', padding: 20 }}>Sin registros</td></tr>
              ) : movimientosFiltrados.map((m) => (
                <tr key={m.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmtFecha(m.created_at)}</td>
                  <td><strong>{m.usuarios?.nombre || '—'}</strong></td>
                  <td style={{ fontSize: 12, color: 'var(--mall-muted)' }}>{m.usuarios?.dpi || '—'}</td>
                  <td><Badge text={m.tipo} /></td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: m.tipo === 'ganado' ? 'var(--mall-main)' : 'var(--mall-accent)' }}>
                    {m.tipo === 'ganado' ? '+' : '−'}{m.monto}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--mall-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.descripcion || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Tabla Cupones */}
      {!loading && tab === 'cupones' ? (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha emisión</th>
                <th>Código</th>
                <th style={{ textAlign: 'right' }}>Valor cupón</th>
                <th>Cliente</th>
                <th>Teléfono</th>
                <th>DPI</th>
                <th>N° Pedido</th>
                <th style={{ textAlign: 'right' }}>Gasto pedido</th>
                <th>Estado</th>
                <th>Vence</th>
              </tr>
            </thead>
            <tbody>
              {cuponesVisisbles.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--mall-muted)', padding: 20 }}>Sin registros</td></tr>
              ) : cuponesVisisbles.map((c) => (
                <tr key={c.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmtFecha(c.fecha_emision)}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>{c.codigo}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(c.valor)}</td>
                  <td><strong>{c.usuarios?.nombre || '—'}</strong></td>
                  <td style={{ fontSize: 12, color: 'var(--mall-muted)' }}>{c.usuarios?.telefono || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--mall-muted)' }}>{c.usuarios?.dpi || '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>
                    {c.pedido_id ? c.pedido_id.slice(0, 8).toUpperCase() : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    {c.pedido_monto != null ? money(c.pedido_monto) : '—'}
                  </td>
                  <td><Badge text={c.estado} /></td>
                  <td style={{ fontSize: 12, color: 'var(--mall-muted)' }}>{c.fecha_vencimiento ? new Date(c.fecha_vencimiento).toLocaleDateString('es-GT') : '—'}</td>
                </tr>
              ))}
            </tbody>
            {cuponesVisisbles.length > 0 ? (
              <tfoot>
                <tr style={{ fontWeight: 900, background: '#f0faf6' }}>
                  <td colSpan={2}>Total</td>
                  <td style={{ textAlign: 'right' }}>{money(cuponesVisisbles.reduce((s, c) => s + Number(c.valor || 0), 0))}</td>
                  <td colSpan={7} style={{ fontSize: 12, color: 'var(--mall-muted)' }}>
                    Activos: {cuponesVisisbles.filter(c => c.estado === 'activo').length} · Canjeados: {cuponesVisisbles.filter(c => c.estado === 'canjeado').length}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      ) : null}

      {/* Tabla Productos */}
      {!loading && tab === 'productos' ? (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Producto</th>
                <th style={{ textAlign: 'right' }}>Unidades vendidas</th>
                <th style={{ textAlign: 'right' }}>Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {productosFiltrados.length === 0 ? (
                <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--mall-muted)', padding: 20 }}>Sin datos de productos para este periodo</td></tr>
              ) : productosFiltrados.map((p) => (
                <tr key={p.nombre}>
                  <td><strong>{p.nombre}</strong></td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{p.cantidad}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(p.ingresos)}</td>
                </tr>
              ))}
            </tbody>
            {productosFiltrados.length > 0 ? (
              <tfoot>
                <tr style={{ fontWeight: 900, background: '#f0faf6' }}>
                  <td>Total</td>
                  <td style={{ textAlign: 'right' }}>{productosFiltrados.reduce((s, p) => s + p.cantidad, 0)}</td>
                  <td style={{ textAlign: 'right' }}>{money(productosFiltrados.reduce((s, p) => s + p.ingresos, 0))}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      ) : null}
    </Navbar>
  )
}
