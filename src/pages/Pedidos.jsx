import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { usePedidos } from '../hooks/usePedidos.jsx'
import { money } from '../utils/business.js'

const FLUJO = ['pendiente', 'confirmado', 'preparando', 'en_camino', 'entregado']

const ESTADO_LABEL = {
  pendiente:  { label: 'Pendiente',  color: '#87510b', bg: '#fff1d7' },
  confirmado: { label: 'Confirmado', color: '#0f6e56', bg: '#dff7ed' },
  preparando: { label: 'Preparando', color: '#1a5fa8', bg: '#dbeafe' },
  en_camino:  { label: 'En camino',  color: '#5b21b6', bg: '#ede9fe' },
  entregado:  { label: 'Entregado',  color: '#166534', bg: '#dcfce7' },
  cancelado:  { label: 'Cancelado',  color: '#6b7280', bg: '#f3f4f6' },
}

const BOTON_SIGUIENTE = {
  pendiente:  { label: 'Confirmar pedido',  siguiente: 'confirmado' },
  confirmado: { label: 'Marcar preparando', siguiente: 'preparando' },
  preparando: { label: 'En camino',         siguiente: 'en_camino'  },
  en_camino:  { label: 'Marcar entregado',  siguiente: 'entregado'  },
}

// ── Imprimir factura + cupones (documento unificado) ─────────────────────
function imprimirFacturaYCupones(pedido) {
  const items = pedido.detalle_pedidos || []
  const lineasHTML = items.length
    ? items.map((i) => `
        <div class="item-row">
          <span class="item-name">${i.cantidad}&times; ${i.nombre_producto}</span>
          <span class="item-price">Q${Number(i.precio_unitario || 0).toFixed(2)}</span>
          <span class="item-sub">Q${Number(i.subtotal || 0).toFixed(2)}</span>
        </div>`).join('')
    : '<div class="muted-row">Sin detalle de productos</div>'

  const cupones = (pedido.cupones || []).filter((c) => c.estado === 'activo')

  const ticketsHTML = cupones.length > 0 ? `
    <div style="page-break-before:always">
      <h2 style="font-size:20px;text-align:center;font-weight:900;letter-spacing:2px;margin:0 0 4px">MALL</h2>
      <p style="text-align:center;color:#888;font-size:11px;margin:0 0 14px">Cupones de descuento &mdash; Pedido ${pedido.id?.slice(0, 8).toUpperCase()} &mdash; ${pedido.usuarios?.nombre || '&mdash;'}</p>
      ${cupones.map((c, idx) => `
        <div class="ticket">
          <div class="ticket-header">&#127903;&#65039; Cup&oacute;n de Descuento MALL</div>
          <div class="ticket-code">${c.codigo}</div>
          <div class="ticket-value">Q${Number(c.valor || 0).toFixed(2)}</div>
          <div class="ticket-info">V&aacute;lido hasta: ${new Date(c.fecha_vencimiento || '').toLocaleDateString('es-GT')}</div>
          <div class="ticket-num">Cup&oacute;n ${idx + 1} de ${cupones.length}</div>
          ${idx < cupones.length - 1 ? '<div class="cut">&mdash;&mdash;&mdash;&mdash; Recortar aqu&iacute; &mdash;&mdash;&mdash;&mdash;</div>' : ''}
        </div>`).join('')}
    </div>` : ''

  const html = `<!DOCTYPE html><html><head><title>MALL - Factura</title><meta charset="UTF-8">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;max-width:400px;margin:0 auto;padding:16px;font-size:13px;color:#1a1a1a}
  h1{font-size:28px;text-align:center;letter-spacing:3px;font-weight:900;margin-bottom:2px}
  .sub{text-align:center;color:#888;font-size:11px;margin-bottom:14px}
  hr{border:none;border-top:1px dashed #ccc;margin:10px 0}
  .row{display:flex;justify-content:space-between;gap:8px;margin:3px 0;font-size:13px}
  .label{color:#888;white-space:nowrap}.val{text-align:right;font-weight:600;flex:1}
  .items-title{font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;color:#555}
  .items-header{display:grid;grid-template-columns:1fr 60px 70px;gap:0 6px;font-size:10px;font-weight:700;color:#888;text-transform:uppercase;padding:4px 0;border-bottom:1px solid #e0e0e0;margin-bottom:4px}
  .item-row{display:grid;grid-template-columns:1fr 60px 70px;gap:0 6px;padding:4px 0;border-bottom:1px dotted #eee;align-items:start;font-size:13px}
  .item-name{font-weight:600}.item-price{text-align:right;color:#888;font-size:12px}.item-sub{text-align:right;font-weight:700}
  .muted-row{color:#888;font-size:12px;padding:6px 0}
  .total-row{display:flex;justify-content:space-between;font-weight:900;font-size:17px;border-top:2px solid #000;padding-top:8px;margin-top:8px}
  .footer{text-align:center;font-size:10px;color:#bbb;margin-top:14px}
  .badge{display:inline-block;background:#1D9E75;color:white;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700}
  .ticket{border:2px dashed #1D9E75;border-radius:10px;padding:16px;text-align:center;margin-bottom:10px}
  .ticket-header{font-size:11px;color:#1D9E75;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px}
  .ticket-code{font-family:monospace;font-size:26px;font-weight:900;letter-spacing:4px;color:#1a1a1a;margin-bottom:6px}
  .ticket-value{font-size:22px;font-weight:900;color:#1D9E75;margin-bottom:4px}
  .ticket-info{font-size:11px;color:#888;margin-bottom:4px}
  .ticket-num{font-size:10px;color:#bbb}
  .cut{font-size:11px;color:#ccc;margin-top:10px;letter-spacing:1px}
  @media print{body{padding:0}}
</style></head>
<body>
  <h1>MALL</h1>
  <p class="sub">Factura de pedido a domicilio &mdash; ${new Date().toLocaleDateString('es-GT')}</p>
  <div style="text-align:center;margin-bottom:12px">
    <span class="badge">N&deg; ${pedido.id?.slice(0, 8).toUpperCase()}</span>
  </div>
  <hr>
  <div class="row"><span class="label">Cliente:</span><span class="val">${pedido.usuarios?.nombre || '&mdash;'}</span></div>
  <div class="row"><span class="label">Tel&eacute;fono:</span><span class="val">${pedido.telefono_contacto || pedido.usuarios?.telefono || '&mdash;'}</span></div>
  <div class="row"><span class="label">Direcci&oacute;n:</span><span class="val">${pedido.direccion_entrega || '&mdash;'}</span></div>
  <div class="row"><span class="label">Horario:</span><span class="val">${pedido.hora_entrega_asignada || pedido.horario || '&mdash;'}</span></div>
  <hr>
  <div class="items-title">Productos solicitados</div>
  <div class="items-header"><span>Producto</span><span style="text-align:right">P/U</span><span style="text-align:right">Subtotal</span></div>
  ${lineasHTML}
  <div class="total-row"><span>TOTAL</span><span>Q${Number(pedido.monto_total || 0).toFixed(2)}</span></div>
  <div class="footer">MALL &mdash; Gracias por tu pedido</div>
  ${ticketsHTML}
</body></html>`

  const w = window.open('', '_blank', 'width=520,height=750')
  if (w) { w.document.write(html); w.document.close(); w.focus(); window.setTimeout(() => { w.print(); w.close() }, 600) }
}

export default function Pedidos() {
  const { pedidosHoy, cambiarEstado } = usePedidos()
  const [pedidos, setPedidos] = useState([])
  const [error, setError] = useState('')
  const [cambiando, setCambiando] = useState(null)
  const [copiado, setCopiado] = useState(null)

  async function loadData() {
    try {
      const data = await pedidosHoy()
      setPedidos(data)
      return data
    } catch (err) {
      setError(err.message)
      return []
    }
  }

  useEffect(() => { loadData() }, [])

  async function avanzar(pedido) {
    const siguiente = BOTON_SIGUIENTE[pedido.estado]?.siguiente
    if (!siguiente) return
    setCambiando(pedido.id + siguiente)
    await cambiarEstado(pedido, siguiente)
    setCambiando(null)
    loadData()
  }

  async function cancelar(pedido) {
    if (!window.confirm('¿Cancelar este pedido?')) return
    setCambiando(pedido.id + 'cancelado')
    await cambiarEstado(pedido, 'cancelado')
    setCambiando(null)
    loadData()
  }

  function copiarCodigo(codigo) {
    navigator.clipboard?.writeText(codigo)
    setCopiado(codigo)
    window.setTimeout(() => setCopiado(null), 2000)
  }

  const activos    = pedidos.filter((p) => p.estado !== 'entregado' && p.estado !== 'cancelado')
  const terminados = pedidos.filter((p) => p.estado === 'entregado' || p.estado === 'cancelado')

  function Factura({ items, montoTotal }) {
    if (!items?.length) return null
    return (
      <div style={{ border: '1px solid #e5e9e6', borderRadius: 8, overflow: 'hidden', fontSize: 13 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0 10px', padding: '6px 10px', background: '#f7f9f7', fontWeight: 700, fontSize: 11, color: 'var(--mall-muted)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e5e9e6' }}>
          <span>Producto</span><span style={{ textAlign: 'right' }}>Cant.</span>
          <span style={{ textAlign: 'right' }}>P/U</span><span style={{ textAlign: 'right' }}>Total</span>
        </div>
        {items.map((item, idx) => (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0 10px', padding: '7px 10px', alignItems: 'center', borderBottom: idx < items.length - 1 ? '1px solid #f0f2f0' : 'none' }}>
            <span style={{ fontWeight: 600 }}>{item.nombre_producto}</span>
            <span style={{ textAlign: 'right', color: 'var(--mall-muted)' }}>×{item.cantidad}</span>
            <span style={{ textAlign: 'right', color: 'var(--mall-muted)' }}>{money(item.precio_unitario)}</span>
            <span style={{ textAlign: 'right', fontWeight: 700 }}>{money(item.subtotal)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: '#f0f8f4', borderTop: '2px solid #c7e8d8', fontWeight: 800, fontSize: 14 }}>
          <span>Total</span><span className="price">{money(montoTotal)}</span>
        </div>
      </div>
    )
  }

  function PedidoCard({ p }) {
    const estadoInfo   = ESTADO_LABEL[p.estado] || ESTADO_LABEL.pendiente
    const siguienteInfo = BOTON_SIGUIENTE[p.estado]
    const idxActual    = FLUJO.indexOf(p.estado)
    const terminado    = p.estado === 'entregado' || p.estado === 'cancelado'
    const confirmado   = p.estado !== 'pendiente' && p.estado !== 'cancelado'
    const cuponesActivos = (p.cupones || []).filter((c) => c.estado === 'activo')

    return (
      <div className="card" style={{ display: 'grid', gap: 12 }}>
        {/* Cabecera */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <strong style={{ fontSize: 15 }}>{p.usuarios?.nombre || 'Cliente sin nombre'}</strong>
            <div className="muted" style={{ fontSize: 13 }}>{p.telefono_contacto || p.usuarios?.telefono || '—'}</div>
          </div>
          <span style={{ background: estadoInfo.bg, color: estadoInfo.color, borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 800 }}>
            {estadoInfo.label}
          </span>
        </div>

        {/* Info */}
        <div style={{ display: 'grid', gap: 4, fontSize: 13 }}>
          <div><span className="muted">Dirección: </span>{p.direccion_entrega}</div>
          <div><span className="muted">Horario: </span><strong>{p.hora_entrega_asignada || p.horario || '—'}</strong></div>
          {p.genera_cupon && p.estado === 'pendiente'
            ? <div style={{ fontSize: 12, color: 'var(--mall-accent)' }}>🎟️ Generará cupones al confirmar</div>
            : null}
        </div>

        {/* Factura */}
        <Factura items={p.detalle_pedidos} montoTotal={p.monto_total} />

        {/* Botón unificado de impresión — visible desde que se confirma */}
        {confirmado ? (
          <button type="button" className="btn-outline" style={{ fontSize: 13, width: '100%' }} onClick={() => imprimirFacturaYCupones(p)}>
            🖨️ Imprimir factura{cuponesActivos.length > 0 ? ` + ${cuponesActivos.length} cupón${cuponesActivos.length > 1 ? 'es' : ''}` : ''}
          </button>
        ) : null}

        {/* Cupones generados — mostrar códigos */}
        {cuponesActivos.length > 0 ? (
          <div style={{ background: '#dff7ed', border: '1.5px dashed var(--mall-main)', borderRadius: 10, padding: '12px 14px', display: 'grid', gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--mall-main)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              🎟️ {cuponesActivos.length === 1 ? 'Cupón generado' : `${cuponesActivos.length} cupones generados`} — entregar al cliente
            </div>
            {cuponesActivos.map((c, idx) => (
              <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 900, letterSpacing: 3, color: 'var(--mall-dark)', flex: 1 }}>
                  {c.codigo}
                </span>
                <span className="price" style={{ fontSize: 14, fontWeight: 700 }}>{money(c.valor)}</span>
                <button type="button" className="btn-outline" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => copiarCodigo(c.codigo)}>
                  {copiado === c.codigo ? '✓' : 'Copiar'}
                </button>
                {p.usuarios?.telefono ? (
                  <a href={`sms:${p.usuarios.telefono}?body=Cupón ${idx + 1}/${cuponesActivos.length} MALL: ${c.codigo} por ${money(c.valor)}. Vence: ${new Date(c.fecha_vencimiento || '').toLocaleDateString('es-GT')}.`}
                    style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--mall-main)', color: 'var(--mall-main)', textDecoration: 'none' }}>
                    SMS
                  </a>
                ) : null}
              </div>
            ))}
            {cuponesActivos[0]?.fecha_vencimiento ? (
              <div className="muted" style={{ fontSize: 11 }}>
                Vencen: {new Date(cuponesActivos[0].fecha_vencimiento).toLocaleDateString('es-GT')}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Barra de progreso */}
        {!terminado ? (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {FLUJO.slice(0, -1).map((e, idx) => (
              <div key={e} style={{ flex: 1, height: 4, borderRadius: 999, background: idx <= idxActual ? 'var(--mall-main)' : '#edf4f1', transition: 'background 0.3s' }} />
            ))}
          </div>
        ) : null}

        {/* Botones de acción */}
        {!terminado ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {siguienteInfo ? (
              <button type="button" className="btn-primary" style={{ flex: 1, minWidth: 160, fontSize: 14 }} disabled={!!cambiando} onClick={() => avanzar(p)}>
                {cambiando === p.id + siguienteInfo.siguiente ? 'Guardando...' : siguienteInfo.label}
              </button>
            ) : null}
            <button type="button" className="btn-danger" style={{ padding: '0 16px', fontSize: 13 }} disabled={!!cambiando} onClick={() => cancelar(p)}>
              Cancelar
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <Navbar>
      <PageHeader title="Pedidos de hoy" subtitle="Confirma pedidos y usa los botones de impresión para la factura y cupones." />
      {error ? <div className="error">{error}</div> : null}

      {activos.length === 0 && terminados.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📦</div>
          <strong>No hay pedidos hoy</strong>
        </div>
      ) : null}

      {activos.length > 0 ? (
        <div style={{ display: 'grid', gap: 14, marginBottom: 24 }}>
          <h2 className="font-display" style={{ margin: 0, fontSize: 18 }}>Activos ({activos.length})</h2>
          {activos.map((p) => <PedidoCard key={p.id} p={p} />)}
        </div>
      ) : null}

      {terminados.length > 0 ? (
        <div style={{ display: 'grid', gap: 14 }}>
          <h2 className="font-display" style={{ margin: 0, fontSize: 18, color: 'var(--mall-muted)' }}>Completados ({terminados.length})</h2>
          {terminados.map((p) => <PedidoCard key={p.id} p={p} />)}
        </div>
      ) : null}
    </Navbar>
  )
}
