import { useEffect, useRef, useState } from 'react'
import { Minus, Plus, Search, Trash2, X } from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { calcularPuntosConConfig, usePuntos } from '../hooks/usePuntos.jsx'
import { supabase } from '../supabase.js'
import { money } from '../utils/business.js'

export default function RegistrarCompra() {
  const { profile } = useAuth()
  const { registrarCompra, getConfigPuntos } = usePuntos()

  // ── Cliente ──
  const [dpi, setDpi] = useState('')
  const [cliente, setCliente] = useState(null)
  const [saldoPrevio, setSaldoPrevio] = useState(0)
  const [config, setConfig] = useState({ montoMinimo: 100, puntosPor100: 10, valorPunto: 1 })
  const [buscandoCliente, setBuscandoCliente] = useState(false)

  // ── Agregar nuevo cliente ──
  const [mostrarFormCliente, setMostrarFormCliente] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoTelefono, setNuevoTelefono] = useState('')
  const [guardandoCliente, setGuardandoCliente] = useState(false)

  // ── Productos / Factura ──
  const [productoQuery, setProductoQuery] = useState('')
  const [encontrados, setEncontrados] = useState([])
  const [cantidadInput, setCantidadInput] = useState('1')
  const [productoSel, setProductoSel] = useState(null)
  const [lineas, setLineas] = useState([])
  const productoRef = useRef(null)

  // ── Pago ──
  const [ventanaAbierta, setVentanaAbierta] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { getConfigPuntos().then(setConfig).catch(() => {}) }, [])

  // ── Buscar cliente por DPI ──
  async function buscarCliente(e) {
    e.preventDefault()
    if (!dpi.trim()) return
    setBuscandoCliente(true)
    setError('')
    setCliente(null)
    setSaldoPrevio(0)
    setMostrarFormCliente(false)
    setLineas([])
    setMessage('')

    const { data, error: fetchError } = await supabase
      .from('usuarios')
      .select('*, puntos(*)')
      .eq('dpi', dpi.trim())
      .eq('rol', 'cliente')
      .maybeSingle()

    setBuscandoCliente(false)
    if (fetchError) { setError(fetchError.message); return }
    if (!data) {
      setError(`No se encontró cliente con DPI ${dpi.trim()}.`)
      setMostrarFormCliente(true)
      return
    }
    setCliente(data)
    setSaldoPrevio(Number(data.puntos?.[0]?.saldo || 0))
  }

  // ── Guardar nuevo cliente ──
  async function guardarNuevoCliente() {
    if (!nuevoNombre.trim()) { setError('Ingresa el nombre del cliente.'); return }
    if (!window.confirm(`¿Confirmas agregar a "${nuevoNombre.trim()}" con DPI ${dpi.trim()}?`)) return

    setGuardandoCliente(true)
    setError('')
    const { data: creado, error: err } = await supabase
      .from('usuarios')
      .insert({ nombre: nuevoNombre.trim(), dpi: dpi.trim(), telefono: nuevoTelefono.trim() || null, rol: 'cliente', onboarding_completo: true })
      .select('*, puntos(*)')
      .single()

    if (err) { setError(err.message); setGuardandoCliente(false); return }

    await supabase.from('puntos').insert({ cliente_id: creado.id, saldo: 0, total_ganado: 0, total_canjeado: 0 })
    setCliente({ ...creado, puntos: [{ saldo: 0, total_ganado: 0, total_canjeado: 0 }] })
    setSaldoPrevio(0)
    setMostrarFormCliente(false)
    setNuevoNombre('')
    setNuevoTelefono('')
    setGuardandoCliente(false)
  }

  // ── Buscar productos por SKU o nombre ──
  async function buscarProducto(q) {
    if (!q.trim()) { setEncontrados([]); return }
    const [bysku, byname] = await Promise.all([
      supabase.from('productos').select('id, nombre, sku, precio').eq('activo', true).ilike('sku', `${q.toUpperCase()}%`).limit(4),
      supabase.from('productos').select('id, nombre, sku, precio').eq('activo', true).ilike('nombre', `%${q}%`).limit(4),
    ])
    const all = [...(bysku.data || []), ...(byname.data || [])]
    const unique = all.filter((p, i) => all.findIndex((x) => x.id === p.id) === i).slice(0, 6)
    setEncontrados(unique)
  }

  function seleccionarProducto(p) {
    setProductoSel(p)
    setProductoQuery(p.sku ? `${p.sku} – ${p.nombre}` : p.nombre)
    setEncontrados([])
    setCantidadInput('1')
    productoRef.current?.focus()
  }

  function agregarLinea() {
    if (!productoSel) { setError('Selecciona un producto.'); return }
    const qty = Number(cantidadInput)
    if (!qty || qty <= 0) { setError('Ingresa una cantidad válida.'); return }

    setLineas((prev) => {
      const existente = prev.findIndex((l) => l.producto_id === productoSel.id)
      if (existente >= 0) {
        const nuevo = [...prev]
        nuevo[existente] = { ...nuevo[existente], cantidad: nuevo[existente].cantidad + qty, subtotal: (nuevo[existente].cantidad + qty) * Number(productoSel.precio) }
        return nuevo
      }
      return [...prev, { producto_id: productoSel.id, nombre: productoSel.nombre, sku: productoSel.sku, precio: Number(productoSel.precio), cantidad: qty, subtotal: qty * Number(productoSel.precio) }]
    })

    setProductoSel(null)
    setProductoQuery('')
    setEncontrados([])
    setCantidadInput('1')
    setError('')
  }

  function cambiarCantidad(idx, delta) {
    setLineas((prev) => {
      const nuevo = [...prev]
      const qty = nuevo[idx].cantidad + delta
      if (qty <= 0) return prev.filter((_, i) => i !== idx)
      nuevo[idx] = { ...nuevo[idx], cantidad: qty, subtotal: qty * nuevo[idx].precio }
      return nuevo
    })
  }

  function quitarLinea(idx) {
    setLineas((prev) => prev.filter((_, i) => i !== idx))
  }

  const montoTotal = lineas.reduce((s, l) => s + l.subtotal, 0)
  const puntosNuevos = calcularPuntosConConfig(montoTotal, config)
  const puntosDisponibles = saldoPrevio + puntosNuevos
  const descuento = Math.min(puntosDisponibles * config.valorPunto, montoTotal)
  const montoConDescuento = montoTotal - descuento

  function abrirVentana() {
    setError('')
    setMessage('')
    if (!cliente) { setError('Primero busca un cliente.'); return }
    if (lineas.length === 0) { setError('Agrega al menos un producto.'); return }
    setVentanaAbierta(true)
  }

  async function registrar(usarDescuento) {
    setVentanaAbierta(false)
    setLoading(true)
    setError('')
    try {
      const puntosUsados = usarDescuento ? puntosDisponibles : 0
      const result = await registrarCompra({ clienteId: cliente.id, montoTotal, adminId: profile.id, puntosUsados })

      const partes = []
      if (usarDescuento && result.descuento > 0) {
        partes.push(`Descuento de ${money(result.descuento)} aplicado (${puntosUsados} puntos).`)
        partes.push(`Total cobrado: ${money(result.montoFinal)}.`)
        if (result.puntosGanados > 0) partes.push(`Ganó ${result.puntosGanados} puntos nuevos.`)
      } else {
        partes.push(`Compra de ${money(montoTotal)} registrada.`)
        if (result.puntosGanados > 0) partes.push(`Ganó ${result.puntosGanados} puntos → saldo: ${Math.max(saldoPrevio - 0, 0) + result.puntosGanados} puntos.`)
      }

      setMessage(partes.join(' '))
      setSaldoPrevio(Math.max(saldoPrevio - (usarDescuento ? puntosDisponibles : 0), 0) + result.puntosGanados)
      setLineas([])
      setProductoQuery('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Navbar>
      <PageHeader
        title="Registrar compra"
        subtitle={`${config.puntosPor100} pts por Q100 · 1 pt = Q${config.valorPunto} · Busca por DPI o SKU`}
      />

      {error ? <div className="error">{error}</div> : null}
      {message ? <div className="card" style={{ marginBottom: 16, background: '#dff7ed', color: '#0f6e56' }}>{message}</div> : null}

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        {/* ── Buscar cliente ── */}
        <div className="card grid" style={{ gap: 10 }}>
          <h2 className="font-display" style={{ margin: 0 }}>Cliente</h2>
          <form onSubmit={buscarCliente} style={{ display: 'flex', gap: 8 }}>
            <input
              className="input-field"
              placeholder="DPI del cliente"
              value={dpi}
              onChange={(e) => { setDpi(e.target.value); setMostrarFormCliente(false); setCliente(null) }}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn-primary" disabled={buscandoCliente} style={{ flexShrink: 0, padding: '0 14px' }}>
              <Search size={16} />
            </button>
          </form>

          {buscandoCliente ? <p className="muted" style={{ fontSize: 13 }}>Buscando...</p> : null}

          {cliente ? (
            <div style={{ background: '#f0faf6', borderRadius: 10, padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{cliente.nombre}</div>
              <div className="muted" style={{ fontSize: 13 }}>DPI: {cliente.dpi} {cliente.telefono ? `· Tel: ${cliente.telefono}` : ''}</div>
              <div style={{ textAlign: 'center', marginTop: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--mall-muted)', letterSpacing: 1, textTransform: 'uppercase' }}>Puntos disponibles</div>
                <div style={{ fontSize: 40, fontWeight: 900, color: 'var(--mall-main)', lineHeight: 1.1 }}>{saldoPrevio}</div>
                <div className="muted" style={{ fontSize: 12 }}>= {money(saldoPrevio * config.valorPunto)} de descuento</div>
              </div>
            </div>
          ) : null}

          {mostrarFormCliente ? (
            <div style={{ background: '#fff8e7', border: '1.5px solid var(--mall-accent)', borderRadius: 10, padding: 14, display: 'grid', gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Cliente no encontrado. ¿Agregar nuevo?</div>
              <input className="input-field" placeholder="Nombre completo *" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} />
              <input className="input-field" placeholder="Teléfono (opcional)" value={nuevoTelefono} onChange={(e) => setNuevoTelefono(e.target.value)} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn-accent" disabled={guardandoCliente} onClick={guardarNuevoCliente} style={{ flex: 1 }}>
                  {guardandoCliente ? 'Guardando...' : 'Confirmar y agregar'}
                </button>
                <button type="button" className="btn-outline" onClick={() => setMostrarFormCliente(false)} style={{ padding: '0 12px' }}><X size={15} /></button>
              </div>
            </div>
          ) : null}
        </div>

        {/* ── Agregar productos ── */}
        <div className="card grid" style={{ gap: 10 }}>
          <h2 className="font-display" style={{ margin: 0 }}>Agregar producto</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Escribe el código SKU (ej: GR-042) o el nombre del producto.</p>

          <div style={{ position: 'relative' }}>
            <input
              className="input-field"
              placeholder="SKU o nombre del producto"
              value={productoQuery}
              onChange={(e) => { setProductoQuery(e.target.value); buscarProducto(e.target.value); setProductoSel(null) }}
              disabled={!cliente}
              style={{ fontFamily: productoSel ? 'monospace' : 'inherit' }}
            />
            {encontrados.length > 0 ? (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1.5px solid var(--mall-line)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.12)', zIndex: 100, overflow: 'hidden', marginTop: 4 }}>
                {encontrados.map((p) => (
                  <button key={p.id} type="button" onClick={() => seleccionarProducto(p)}
                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', textAlign: 'left', gap: 8 }}>
                    <div>
                      {p.sku ? <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 800, background: '#1a1a1a', color: '#fff', borderRadius: 3, padding: '1px 5px', marginRight: 6 }}>{p.sku}</span> : null}
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{p.nombre}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: 'var(--mall-main)', whiteSpace: 'nowrap' }}>{money(p.precio)}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {productoSel ? (
            <div style={{ background: '#f0faf6', borderRadius: 8, padding: '10px 12px', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><strong>{productoSel.nombre}</strong> · {money(productoSel.precio)} c/u</span>
              <button type="button" onClick={() => { setProductoSel(null); setProductoQuery('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--mall-muted)' }}><X size={14} /></button>
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>Cantidad:</label>
            <button type="button" className="btn-outline" style={{ padding: '6px 10px', minHeight: 36 }} onClick={() => setCantidadInput(String(Math.max(1, Number(cantidadInput) - 1)))}><Minus size={14} /></button>
            <input
              ref={productoRef}
              className="input-field"
              type="number"
              min="1"
              value={cantidadInput}
              onChange={(e) => setCantidadInput(e.target.value)}
              style={{ width: 70, textAlign: 'center' }}
            />
            <button type="button" className="btn-outline" style={{ padding: '6px 10px', minHeight: 36 }} onClick={() => setCantidadInput(String(Number(cantidadInput) + 1))}><Plus size={14} /></button>
            <button type="button" className="btn-accent" disabled={!productoSel || !cliente} onClick={agregarLinea} style={{ flex: 1 }}>
              Agregar
            </button>
          </div>
        </div>
      </div>

      {/* ── Factura / listado de productos ── */}
      {lineas.length > 0 ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 className="font-display" style={{ margin: '0 0 12px' }}>Factura</h2>
          <div style={{ border: '1px solid #e5e9e6', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: '0 10px', padding: '6px 10px', background: '#f7f9f7', fontWeight: 700, fontSize: 11, color: 'var(--mall-muted)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e5e9e6' }}>
              <span>Producto</span>
              <span style={{ textAlign: 'right' }}>P/U</span>
              <span style={{ textAlign: 'center' }}>Cant.</span>
              <span style={{ textAlign: 'right' }}>Subtotal</span>
              <span />
            </div>
            {lineas.map((l, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: '0 10px', padding: '8px 10px', alignItems: 'center', borderBottom: idx < lineas.length - 1 ? '1px solid #f0f2f0' : 'none' }}>
                <div>
                  {l.sku ? <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 800, background: '#1a1a1a', color: '#fff', borderRadius: 3, padding: '1px 5px', marginRight: 5 }}>{l.sku}</span> : null}
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{l.nombre}</span>
                </div>
                <span style={{ textAlign: 'right', color: 'var(--mall-muted)', fontSize: 13 }}>{money(l.precio)}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button type="button" onClick={() => cambiarCantidad(idx, -1)} style={{ background: 'none', border: '1px solid #ccc', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{l.cantidad}</span>
                  <button type="button" onClick={() => cambiarCantidad(idx, 1)} style={{ background: 'none', border: '1px solid #ccc', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
                <span style={{ textAlign: 'right', fontWeight: 700 }}>{money(l.subtotal)}</span>
                <button type="button" onClick={() => quitarLinea(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d94b4b', padding: 2 }}><Trash2 size={15} /></button>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 10px', background: '#f0f8f4', borderTop: '2px solid #c7e8d8', fontWeight: 900, fontSize: 15 }}>
              <span>TOTAL</span><span className="price">{money(montoTotal)}</span>
            </div>
          </div>

          {montoTotal > 0 && cliente ? (
            <div style={{ marginTop: 10, padding: '10px 12px', background: '#f7f9f7', borderRadius: 8, fontSize: 13, color: 'var(--mall-muted)' }}>
              {puntosNuevos > 0
                ? <span>Esta compra genera <strong style={{ color: 'var(--mall-main)' }}>{puntosNuevos} pts</strong> = {money(puntosNuevos * config.valorPunto)} adicionales.</span>
                : <span>Compra menor a {money(config.montoMinimo)} — no genera puntos.</span>}
              {saldoPrevio > 0 ? <span> Puntos actuales: <strong>{saldoPrevio}</strong> · Total disponible: <strong>{puntosDisponibles} pts</strong></span> : null}
            </div>
          ) : null}

          <button type="button" className="btn-accent" disabled={!cliente || lineas.length === 0 || loading} style={{ width: '100%', marginTop: 12, fontSize: 16 }} onClick={abrirVentana}>
            {loading ? 'Registrando...' : `Cobrar ${money(montoTotal)}`}
          </button>
        </div>
      ) : null}

      {/* ── Modal de pago ── */}
      {ventanaAbierta ? (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,31,26,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setVentanaAbierta(false) }}>
          <div className="card" style={{ width: '100%', maxWidth: 440, display: 'grid', gap: 16 }}>
            <div>
              <h2 className="font-display" style={{ margin: '0 0 4px', fontSize: 20 }}>Total: {money(montoTotal)}</h2>
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>{cliente?.nombre}</p>
              {puntosDisponibles > 0 ? (
                <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--mall-dark)' }}>
                  Puntos disponibles: <strong>{puntosDisponibles}</strong> = <strong>{money(puntosDisponibles * config.valorPunto)}</strong> de descuento
                  {puntosNuevos > 0 ? ` (${saldoPrevio} previos + ${puntosNuevos} de esta compra)` : ''}
                </p>
              ) : null}
            </div>

            <button type="button" className="btn-accent" onClick={() => registrar(true)} disabled={puntosDisponibles === 0}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '14px 18px', gap: 4, textAlign: 'left', opacity: puntosDisponibles > 0 ? 1 : 0.4 }}>
              <strong style={{ fontSize: 15 }}>Aplicar descuento de puntos</strong>
              <span style={{ fontSize: 13, fontWeight: 400 }}>
                {puntosDisponibles > 0 ? `−${money(descuento)} → cobrar ${money(montoConDescuento)}` : 'Sin puntos disponibles'}
              </span>
            </button>

            <button type="button" className="btn-primary" onClick={() => registrar(false)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '14px 18px', gap: 4, textAlign: 'left' }}>
              <strong style={{ fontSize: 15 }}>Cobrar monto completo</strong>
              <span style={{ fontSize: 13, fontWeight: 400 }}>
                Cobrar {money(montoTotal)}{puntosNuevos > 0 ? ` → gana ${puntosNuevos} puntos` : ''}
              </span>
            </button>

            <button type="button" className="btn-outline" onClick={() => setVentanaAbierta(false)}>Cancelar</button>
          </div>
        </div>
      ) : null}
    </Navbar>
  )
}
