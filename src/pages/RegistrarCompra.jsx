import { useEffect, useRef, useState } from 'react'
import { Minus, Plus, Search, Trash2, X } from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { calcularPuntosConConfig, usePuntos } from '../hooks/usePuntos.jsx'
import { supabase } from '../supabase.js'
import { money } from '../utils/business.js'

function imprimirTicketTienda({ clienteNombre, clienteDPI, lineas, montoTotal, descuento, puntosUsados, puntosGanados, montoFinal, esCF }) {
  const lineasHTML = lineas.map((l) => `
    <div class="item-row">
      <span class="item-name">${l.cantidad}&times; ${l.nombre}</span>
      <span class="item-price">Q${Number(l.precio || 0).toFixed(2)}</span>
      <span class="item-sub">Q${Number(l.subtotal || 0).toFixed(2)}</span>
    </div>`).join('')

  const html = `<!DOCTYPE html><html><head><title>MALL - Compra</title><meta charset="UTF-8">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;max-width:360px;margin:0 auto;padding:14px;font-size:13px;color:#1a1a1a}
  h1{font-size:26px;text-align:center;letter-spacing:3px;font-weight:900;margin-bottom:2px}
  .sub{text-align:center;color:#888;font-size:11px;margin-bottom:14px}
  hr{border:none;border-top:1px dashed #ccc;margin:10px 0}
  .row{display:flex;justify-content:space-between;gap:8px;margin:3px 0;font-size:13px}
  .label{color:#888}.val{text-align:right;font-weight:600;flex:1}
  .items-title{font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;color:#555}
  .items-header{display:grid;grid-template-columns:1fr 55px 65px;gap:0 6px;font-size:10px;font-weight:700;color:#888;text-transform:uppercase;padding:4px 0;border-bottom:1px solid #e0e0e0;margin-bottom:4px}
  .item-row{display:grid;grid-template-columns:1fr 55px 65px;gap:0 6px;padding:4px 0;border-bottom:1px dotted #eee;font-size:13px}
  .item-name{font-weight:600}.item-price{text-align:right;color:#888;font-size:12px}.item-sub{text-align:right;font-weight:700}
  .total-row{display:flex;justify-content:space-between;font-weight:900;font-size:16px;border-top:2px solid #000;padding-top:8px;margin-top:8px}
  .descuento-row{display:flex;justify-content:space-between;font-size:13px;color:#1D9E75;font-weight:700;margin-top:4px}
  .puntos-row{text-align:center;margin-top:10px;padding:8px;background:#f0faf6;border-radius:6px;font-size:12px;color:#1D9E75;font-weight:700}
  .footer{text-align:center;font-size:10px;color:#bbb;margin-top:12px}
  @media print{body{padding:0}}
</style></head>
<body>
  <h1>MALL</h1>
  <p class="sub">Compra en tienda &mdash; ${new Date().toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
  <hr>
  <div class="row"><span class="label">Cliente:</span><span class="val">${esCF ? 'Cliente Final (C/F)' : (clienteNombre || '&mdash;')}</span></div>
  ${clienteDPI ? `<div class="row"><span class="label">DPI:</span><span class="val">${clienteDPI}</span></div>` : ''}
  <hr>
  <div class="items-title">Productos</div>
  <div class="items-header"><span>Producto</span><span style="text-align:right">P/U</span><span style="text-align:right">Subtotal</span></div>
  ${lineasHTML}
  <div class="total-row"><span>SUBTOTAL</span><span>Q${Number(montoTotal || 0).toFixed(2)}</span></div>
  ${descuento > 0 ? `<div class="descuento-row"><span>Descuento puntos (${puntosUsados} pts)</span><span>&minus;Q${Number(descuento || 0).toFixed(2)}</span></div>
  <div class="total-row" style="font-size:18px"><span>TOTAL COBRADO</span><span>Q${Number(montoFinal || 0).toFixed(2)}</span></div>` : ''}
  ${puntosGanados > 0 ? `<div class="puntos-row">&#11088; Gana ${puntosGanados} puntos en esta compra</div>` : ''}
  <div class="footer">MALL &mdash; Gracias por tu compra</div>
</body></html>`

  const w = window.open('', '_blank', 'width=480,height=680')
  if (w) { w.document.write(html); w.document.close(); w.focus(); window.setTimeout(() => { w.print(); w.close() }, 600) }
}

export default function RegistrarCompra() {
  const { profile } = useAuth()
  const { registrarCompra, getConfigPuntos } = usePuntos()

  // ── Cliente ──
  const [dpi, setDpi] = useState('')
  const [cliente, setCliente] = useState(null)
  const [saldoPrevio, setSaldoPrevio] = useState(0)
  const [config, setConfig] = useState({ montoMinimo: 100, puntosPor100: 10, valorPunto: 1 })
  const [buscandoCliente, setBuscandoCliente] = useState(false)
  const [esCF, setEsCF] = useState(false) // cliente final

  // ── Nuevo cliente ──
  const [mostrarFormCliente, setMostrarFormCliente] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoTelefono, setNuevoTelefono] = useState('')
  const [guardandoCliente, setGuardandoCliente] = useState(false)

  // ── Productos ──
  const [productoQuery, setProductoQuery] = useState('')
  const [encontrados, setEncontrados] = useState([])
  const [cantidadInput, setCantidadInput] = useState('1')
  const [productoSel, setProductoSel] = useState(null)
  const [lineas, setLineas] = useState([])
  const productoRef = useRef(null)

  // ── Pago ──
  const [ventanaAbierta, setVentanaAbierta] = useState(false)
  const [puntosAUsar, setPuntosAUsar] = useState(0)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { getConfigPuntos().then(setConfig).catch(() => {}) }, [])

  function resetCliente() {
    setCliente(null)
    setSaldoPrevio(0)
    setEsCF(false)
    setMostrarFormCliente(false)
    setNuevoNombre('')
    setNuevoTelefono('')
  }

  // ── Buscar cliente por DPI ──
  async function buscarCliente(e) {
    e.preventDefault()
    const dpiTrim = dpi.trim()
    if (!dpiTrim) return
    setBuscandoCliente(true)
    setError('')
    resetCliente()
    setLineas([])
    setMessage('')

    const { data: usuarioData, error: userErr } = await supabase
      .from('usuarios').select('id, nombre, dpi, telefono').eq('dpi', dpiTrim).eq('rol', 'cliente').maybeSingle()

    if (userErr) { setError(userErr.message); setBuscandoCliente(false); return }

    if (!usuarioData) {
      setError(`No se encontró cliente con DPI ${dpiTrim}.`)
      setMostrarFormCliente(true)
      setBuscandoCliente(false)
      return
    }

    // Cargar puntos por separado (evita problemas de RLS en joins)
    const { data: puntosData } = await supabase.from('puntos').select('saldo').eq('cliente_id', usuarioData.id).maybeSingle()
    setCliente(usuarioData)
    setSaldoPrevio(Number(puntosData?.saldo || 0))
    setBuscandoCliente(false)
  }

  // ── Activar venta C/F ──
  function activarCF() {
    resetCliente()
    setDpi('')
    setEsCF(true)
    setLineas([])
    setMessage('')
    setError('')
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
      .select('id, nombre, dpi, telefono').single()

    if (err) { setError(err.message); setGuardandoCliente(false); return }

    await supabase.from('puntos').insert({ cliente_id: creado.id, saldo: 0, total_ganado: 0, total_canjeado: 0 })
    setCliente(creado)
    setSaldoPrevio(0)
    setMostrarFormCliente(false)
    setNuevoNombre('')
    setNuevoTelefono('')
    setGuardandoCliente(false)
  }

  // ── Buscar productos ──
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
      const idx = prev.findIndex((l) => l.producto_id === productoSel.id)
      if (idx >= 0) {
        const n = [...prev]
        n[idx] = { ...n[idx], cantidad: n[idx].cantidad + qty, subtotal: (n[idx].cantidad + qty) * Number(productoSel.precio) }
        return n
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
      const n = [...prev]
      const qty = n[idx].cantidad + delta
      if (qty <= 0) return prev.filter((_, i) => i !== idx)
      n[idx] = { ...n[idx], cantidad: qty, subtotal: qty * n[idx].precio }
      return n
    })
  }

  const montoTotal      = lineas.reduce((s, l) => s + l.subtotal, 0)
  const puntosNuevos    = esCF ? 0 : calcularPuntosConConfig(montoTotal, config)
  const totalDisponible = saldoPrevio + puntosNuevos   // total puntos que puede usar
  const descuento       = Math.min(puntosAUsar * config.valorPunto, montoTotal)
  const montoFinal      = montoTotal - descuento

  function abrirVentana() {
    setError('')
    setMessage('')
    if (!esCF && !cliente) { setError('Primero busca un cliente o activa venta C/F.'); return }
    if (lineas.length === 0) { setError('Agrega al menos un producto.'); return }
    setPuntosAUsar(0)
    setVentanaAbierta(true)
  }

  async function registrar() {
    setVentanaAbierta(false)
    setLoading(true)
    setError('')
    try {
      const result = await registrarCompra({
        clienteId:   esCF ? null : cliente?.id,
        montoTotal,
        adminId:     profile.id,
        puntosUsados: puntosAUsar,
      })

      // Imprimir ticket antes de limpiar el estado
      imprimirTicketTienda({
        clienteNombre: cliente?.nombre,
        clienteDPI:    cliente?.dpi,
        esCF,
        lineas:        [...lineas],
        montoTotal,
        descuento:     result.descuento,
        puntosUsados:  puntosAUsar,
        puntosGanados: result.puntosGanados,
        montoFinal:    result.montoFinal,
      })

      const partes = []
      if (esCF) {
        partes.push(`Venta C/F de ${money(montoTotal)} registrada.`)
      } else {
        if (puntosAUsar > 0) {
          partes.push(`Descuento de ${money(result.descuento)} aplicado (${puntosAUsar} pts).`)
          partes.push(`Total cobrado: ${money(result.montoFinal)}.`)
        } else {
          partes.push(`Compra de ${money(montoTotal)} registrada.`)
        }
        if (result.puntosGanados > 0) partes.push(`Ganó ${result.puntosGanados} pts.`)
      }

      setMessage(partes.join(' '))

      if (cliente) {
        const { data: nuevo } = await supabase.from('puntos').select('saldo').eq('cliente_id', cliente.id).maybeSingle()
        setSaldoPrevio(Number(nuevo?.saldo || 0))
      }

      setLineas([])
      setProductoQuery('')
      setPuntosAUsar(0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const tieneCliente = esCF || !!cliente

  return (
    <Navbar>
      <PageHeader
        title="Registrar compra"
        subtitle={`${config.puntosPor100} pts por Q100 · 1 pt = Q${config.valorPunto} · DPI opcional`}
      />

      {error ? <div className="error">{error}</div> : null}
      {message ? <div className="card" style={{ marginBottom: 16, background: '#dff7ed', color: '#0f6e56' }}>{message}</div> : null}

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        {/* ── Panel cliente ── */}
        <div className="card grid" style={{ gap: 10 }}>
          <h2 className="font-display" style={{ margin: 0 }}>Cliente</h2>

          {!esCF ? (
            <>
              <form onSubmit={buscarCliente} style={{ display: 'flex', gap: 8 }}>
                <input className="input-field" placeholder="DPI del cliente (opcional)" value={dpi}
                  onChange={(e) => { setDpi(e.target.value); setMostrarFormCliente(false); setCliente(null) }} style={{ flex: 1 }} />
                <button type="submit" className="btn-primary" disabled={buscandoCliente} style={{ flexShrink: 0, padding: '0 14px' }}>
                  <Search size={16} />
                </button>
              </form>

              <button type="button" className="btn-outline" style={{ fontSize: 13 }} onClick={activarCF}>
                Venta C/F — sin cliente registrado
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f7f9f7', borderRadius: 8, padding: '10px 14px' }}>
              <div>
                <strong style={{ fontSize: 14 }}>Venta C/F</strong>
                <div className="muted" style={{ fontSize: 12 }}>Sin puntos ni descuentos</div>
              </div>
              <button type="button" className="btn-outline" style={{ fontSize: 12, padding: '4px 10px' }} onClick={resetCliente}>Cancelar</button>
            </div>
          )}

          {buscandoCliente ? <p className="muted" style={{ fontSize: 13 }}>Buscando...</p> : null}

          {cliente ? (
            <div style={{ background: '#f0faf6', borderRadius: 10, padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{cliente.nombre}</div>
              <div className="muted" style={{ fontSize: 12 }}>DPI: {cliente.dpi}{cliente.telefono ? ` · Tel: ${cliente.telefono}` : ''}</div>
              <div style={{ textAlign: 'center', marginTop: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--mall-muted)', letterSpacing: 1, textTransform: 'uppercase' }}>Puntos disponibles</div>
                <div style={{ fontSize: 44, fontWeight: 900, color: 'var(--mall-main)', lineHeight: 1.1 }}>{saldoPrevio}</div>
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
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Escribe el código SKU o nombre del producto.</p>

          <div style={{ position: 'relative' }}>
            <input className="input-field" placeholder="SKU o nombre (ej: GR-042 o Arroz)" value={productoQuery}
              onChange={(e) => { setProductoQuery(e.target.value); buscarProducto(e.target.value); setProductoSel(null) }}
              disabled={!tieneCliente} />
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
            <label style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>Cant.:</label>
            <button type="button" className="btn-outline" style={{ padding: '6px 10px', minHeight: 36 }} onClick={() => setCantidadInput(String(Math.max(1, Number(cantidadInput) - 1)))}><Minus size={14} /></button>
            <input ref={productoRef} className="input-field" type="number" min="1" value={cantidadInput}
              onChange={(e) => setCantidadInput(e.target.value)} style={{ width: 70, textAlign: 'center' }} />
            <button type="button" className="btn-outline" style={{ padding: '6px 10px', minHeight: 36 }} onClick={() => setCantidadInput(String(Number(cantidadInput) + 1))}><Plus size={14} /></button>
            <button type="button" className="btn-accent" disabled={!productoSel || !tieneCliente} onClick={agregarLinea} style={{ flex: 1 }}>
              Agregar
            </button>
          </div>
        </div>
      </div>

      {/* ── Factura ── */}
      {lineas.length > 0 ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 className="font-display" style={{ margin: '0 0 12px' }}>Factura</h2>
          <div style={{ border: '1px solid #e5e9e6', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: '0 10px', padding: '6px 10px', background: '#f7f9f7', fontWeight: 700, fontSize: 11, color: 'var(--mall-muted)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e5e9e6' }}>
              <span>Producto</span><span style={{ textAlign: 'right' }}>P/U</span>
              <span style={{ textAlign: 'center' }}>Cant.</span><span style={{ textAlign: 'right' }}>Subtotal</span><span />
            </div>
            {lineas.map((l, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: '0 10px', padding: '8px 10px', alignItems: 'center', borderBottom: idx < lineas.length - 1 ? '1px solid #f0f2f0' : 'none' }}>
                <div>
                  {l.sku ? <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 800, background: '#1a1a1a', color: '#fff', borderRadius: 3, padding: '1px 5px', marginRight: 5 }}>{l.sku}</span> : null}
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{l.nombre}</span>
                </div>
                <span style={{ textAlign: 'right', color: 'var(--mall-muted)', fontSize: 13 }}>{money(l.precio)}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button type="button" onClick={() => cambiarCantidad(idx, -1)} style={{ background: 'none', border: '1px solid #ccc', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>−</button>
                  <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{l.cantidad}</span>
                  <button type="button" onClick={() => cambiarCantidad(idx, 1)} style={{ background: 'none', border: '1px solid #ccc', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>+</button>
                </div>
                <span style={{ textAlign: 'right', fontWeight: 700 }}>{money(l.subtotal)}</span>
                <button type="button" onClick={() => setLineas((prev) => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d94b4b', padding: 2 }}><Trash2 size={15} /></button>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 10px', background: '#f0f8f4', borderTop: '2px solid #c7e8d8', fontWeight: 900, fontSize: 15 }}>
              <span>TOTAL</span><span className="price">{money(montoTotal)}</span>
            </div>
          </div>

          {!esCF && montoTotal > 0 && cliente ? (
            <div style={{ marginTop: 10, padding: '10px 12px', background: '#f7f9f7', borderRadius: 8, fontSize: 13 }}>
              {puntosNuevos > 0
                ? <span>Esta compra genera <strong style={{ color: 'var(--mall-main)' }}>{puntosNuevos} pts</strong>.</span>
                : <span className="muted">Menor a {money(config.montoMinimo)} — no genera puntos.</span>}
              {saldoPrevio > 0 ? <span> Puntos en cuenta: <strong>{saldoPrevio}</strong>. Total disponible: <strong>{totalDisponible} pts = {money(totalDisponible * config.valorPunto)}</strong>.</span> : null}
            </div>
          ) : null}

          <button type="button" className="btn-accent" disabled={!tieneCliente || lineas.length === 0 || loading}
            style={{ width: '100%', marginTop: 12, fontSize: 16 }} onClick={abrirVentana}>
            {loading ? 'Registrando...' : `Cobrar ${money(montoTotal)}`}
          </button>
        </div>
      ) : null}

      {/* ── Modal de pago ── */}
      {ventanaAbierta ? (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,31,26,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setVentanaAbierta(false) }}>
          <div className="card" style={{ width: '100%', maxWidth: 460, display: 'grid', gap: 16 }}>
            <div>
              <h2 className="font-display" style={{ margin: '0 0 4px', fontSize: 20 }}>
                {esCF ? 'Venta C/F' : cliente?.nombre} — {money(montoTotal)}
              </h2>
              {puntosNuevos > 0 && !esCF ? (
                <div style={{ fontSize: 13, color: 'var(--mall-main)', marginTop: 4, fontWeight: 600 }}>
                  🌟 Esta compra genera {puntosNuevos} puntos nuevos
                </div>
              ) : null}
            </div>

            {/* Sección de puntos — solo si hay cliente con puntos */}
            {!esCF && totalDisponible > 0 ? (
              <div style={{ background: '#f0faf6', borderRadius: 10, padding: '14px 16px', display: 'grid', gap: 10 }}>
                <div style={{ fontSize: 13 }}>
                  <strong>Puntos disponibles: {totalDisponible}</strong>
                  {saldoPrevio > 0 && puntosNuevos > 0
                    ? <span className="muted"> ({saldoPrevio} en cuenta + {puntosNuevos} nuevos)</span>
                    : saldoPrevio > 0
                    ? <span className="muted"> (en cuenta)</span>
                    : <span className="muted"> (nuevos de esta compra)</span>}
                  <div className="muted" style={{ marginTop: 2 }}>= {money(totalDisponible * config.valorPunto)} de descuento disponible</div>
                </div>

                <div>
                  <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 6 }}>
                    ¿Cuántos puntos quieres canjear ahora?
                  </label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button type="button" className="btn-outline" style={{ padding: '6px 10px', minHeight: 34 }}
                      onClick={() => setPuntosAUsar(Math.max(0, puntosAUsar - 1))}><Minus size={13} /></button>
                    <input className="input-field" type="number" min="0" max={totalDisponible} value={puntosAUsar}
                      onChange={(e) => setPuntosAUsar(Math.min(totalDisponible, Math.max(0, Number(e.target.value || 0))))}
                      style={{ width: 80, textAlign: 'center' }} />
                    <button type="button" className="btn-outline" style={{ padding: '6px 10px', minHeight: 34 }}
                      onClick={() => setPuntosAUsar(Math.min(totalDisponible, puntosAUsar + 1))}><Plus size={13} /></button>
                    <button type="button" className="btn-outline" style={{ fontSize: 12, padding: '0 12px', minHeight: 34 }}
                      onClick={() => setPuntosAUsar(totalDisponible)}>Usar todos</button>
                    <button type="button" className="btn-outline" style={{ fontSize: 12, padding: '0 12px', minHeight: 34 }}
                      onClick={() => setPuntosAUsar(0)}>Ninguno</button>
                  </div>
                  {puntosAUsar > 0 ? (
                    <div style={{ marginTop: 8, fontSize: 13, color: 'var(--mall-main)', fontWeight: 600 }}>
                      Descuento: −{money(descuento)} → Cobrar: <strong>{money(montoFinal)}</strong>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Botón de cobro */}
            <button type="button" className="btn-accent" onClick={registrar}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '14px 18px', gap: 4, textAlign: 'left' }}>
              <strong style={{ fontSize: 16 }}>
                {puntosAUsar > 0 ? `Cobrar ${money(montoFinal)}` : `Cobrar ${money(montoTotal)}`}
              </strong>
              <span style={{ fontSize: 13, fontWeight: 400 }}>
                {esCF
                  ? 'Venta cliente final, sin puntos'
                  : puntosAUsar > 0
                  ? `${puntosAUsar} pts canjeados · descuento ${money(descuento)}${puntosNuevos > 0 ? ` · gana ${puntosNuevos} pts nuevos` : ''}`
                  : puntosNuevos > 0
                  ? `Acumular ${puntosNuevos} puntos nuevos`
                  : 'Sin puntos aplicados'}
              </span>
            </button>

            <button type="button" className="btn-outline" onClick={() => setVentanaAbierta(false)}>Cancelar</button>
          </div>
        </div>
      ) : null}
    </Navbar>
  )
}
