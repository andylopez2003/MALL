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
  pendiente:  { label: 'Confirmar pedido',    siguiente: 'confirmado' },
  confirmado: { label: 'Marcar preparando',   siguiente: 'preparando' },
  preparando: { label: 'En camino',           siguiente: 'en_camino'  },
  en_camino:  { label: 'Marcar entregado',    siguiente: 'entregado'  },
}

function imprimirPedido(pedido) {
  const cupon = pedido.cupones?.find((c) => c.estado === 'activo')
  const items = pedido.detalle_pedidos || []

  const lineasHTML = items.length
    ? items.map((i) => `
        <div class="row">
          <span>${i.cantidad}&times; ${i.nombre_producto}</span>
          <span>Q${Number(i.subtotal || 0).toFixed(2)}</span>
        </div>`).join('')
    : '<div class="row muted"><span>Sin detalle de productos</span></div>'

  const cuponHTML = cupon ? `
    <div class="cupon-box">
      <div class="cupon-title">&#127903;&#65039; CUP&Oacute;N DE DESCUENTO</div>
      <div class="cupon-code">${cupon.codigo}</div>
      <div class="cupon-value">Q${Number(cupon.valor || 0).toFixed(2)} de descuento</div>
      <div class="cupon-info">V&aacute;lido hasta: ${new Date(cupon.fecha_vencimiento || '').toLocaleDateString('es-GT')}</div>
      <div class="cupon-info" style="margin-top:6px">Entregar al cliente junto con el pedido</div>
    </div>` : ''

  const html = `<!DOCTYPE html>
<html><head><title>MALL - Pedido</title><meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; max-width: 360px; margin: 0 auto; padding: 14px; font-size: 13px; color: #1a1a1a; }
  h1 { font-size: 26px; text-align: center; letter-spacing: 3px; font-weight: 900; margin-bottom: 2px; }
  .sub { text-align: center; color: #888; font-size: 11px; margin-bottom: 14px; }
  hr { border: none; border-top: 1px dashed #ccc; margin: 10px 0; }
  .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin: 3px 0; }
  .label { color: #888; white-space: nowrap; }
  .val { text-align: right; font-weight: 600; flex: 1; }
  .items-title { font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; color: #555; }
  .item-row { display: flex; justify-content: space-between; margin: 4px 0; padding-bottom: 4px; border-bottom: 1px dotted #e5e5e5; }
  .total-row { display: flex; justify-content: space-between; font-weight: 900; font-size: 16px; border-top: 2px solid #000; padding-top: 8px; margin-top: 8px; }
  .cupon-box { border: 2px dashed #1D9E75; border-radius: 8px; padding: 14px; margin-top: 14px; text-align: center; }
  .cupon-title { font-size: 11px; color: #1D9E75; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
  .cupon-code { font-family: monospace; font-size: 24px; font-weight: 900; letter-spacing: 4px; color: #1a1a1a; }
  .cupon-value { font-size: 18px; font-weight: 700; color: #1D9E75; margin-top: 6px; }
  .cupon-info { font-size: 11px; color: #888; margin-top: 4px; }
  .footer { text-align: center; font-size: 10px; color: #bbb; margin-top: 14px; }
  @media print { body { padding: 0; } }
</style></head>
<body>
  <h1>MALL</h1>
  <p class="sub">Pedido a domicilio &mdash; ${new Date().toLocaleDateString('es-GT')}</p>
  <hr>
  <div class="row"><span class="label">Cliente:</span><span class="val">${pedido.usuarios?.nombre || '&mdash;'}</span></div>
  <div class="row"><span class="label">Tel&eacute;fono:</span><span class="val">${pedido.telefono_contacto || pedido.usuarios?.telefono || '&mdash;'}</span></div>
  <div class="row"><span class="label">Direcci&oacute;n:</span><span class="val">${pedido.direccion_entrega || '&mdash;'}</span></div>
  <div class="row"><span class="label">Horario:</span><span class="val">${pedido.hora_entrega_asignada || pedido.horario || '&mdash;'}</span></div>
  <hr>
  <div class="items-title">Productos solicitados</div>
  ${lineasHTML}
  <div class="total-row"><span>TOTAL</span><span>Q${Number(pedido.monto_total || 0).toFixed(2)}</span></div>
  ${cuponHTML}
  <div class="footer">MALL &mdash; Gracias por tu pedido &mdash; N&deg; ${pedido.id?.slice(0, 8).toUpperCase()}</div>
</body></html>`

  const w = window.open('', '_blank', 'width=520,height=750')
  if (w) {
    w.document.write(html)
    w.document.close()
    w.focus()
    window.setTimeout(() => { w.print(); w.close() }, 600)
  }
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
    const nuevos = await loadData()

    if (siguiente === 'confirmado') {
      const actualizado = nuevos.find((p) => p.id === pedido.id)
      if (actualizado) imprimirPedido(actualizado)
    }
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
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr auto auto auto',
          gap: '0 10px', padding: '6px 10px',
          background: '#f7f9f7', fontWeight: 700, fontSize: 11,
          color: 'var(--mall-muted)', textTransform: 'uppercase', letterSpacing: 0.5,
          borderBottom: '1px solid #e5e9e6',
        }}>
          <span>Producto</span><span style={{ textAlign: 'right' }}>Cant.</span>
          <span style={{ textAlign: 'right' }}>P/U</span><span style={{ textAlign: 'right' }}>Total</span>
        </div>
        {items.map((item, idx) => (
          <div key={idx} style={{
            display: 'grid', gridTemplateColumns: '1fr auto auto auto',
            gap: '0 10px', padding: '7px 10px', alignItems: 'center',
            borderBottom: idx < items.length - 1 ? '1px solid #f0f2f0' : 'none',
          }}>
            <span style={{ fontWeight: 600 }}>{item.nombre_producto}</span>
            <span style={{ textAlign: 'right', color: 'var(--mall-muted)' }}>×{item.cantidad}</span>
            <span style={{ textAlign: 'right', color: 'var(--mall-muted)' }}>{money(item.precio_unitario)}</span>
            <span style={{ textAlign: 'right', fontWeight: 700 }}>{money(item.subtotal)}</span>
          </div>
        ))}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          padding: '8px 10px', background: '#f0f8f4',
          borderTop: '2px solid #c7e8d8', fontWeight: 800, fontSize: 14,
        }}>
          <span>Total</span><span className="price">{money(montoTotal)}</span>
        </div>
      </div>
    )
  }

  function PedidoCard({ p }) {
    const estadoInfo = ESTADO_LABEL[p.estado] || ESTADO_LABEL.pendiente
    const siguienteInfo = BOTON_SIGUIENTE[p.estado]
    const idxActual = FLUJO.indexOf(p.estado)
    const terminado = p.estado === 'entregado' || p.estado === 'cancelado'
    const cuponActivo = p.cupones?.find((c) => c.estado === 'activo')

    return (
      <div className="card" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <strong style={{ fontSize: 15 }}>{p.usuarios?.nombre || 'Cliente sin nombre'}</strong>
            <div className="muted" style={{ fontSize: 13 }}>{p.telefono_contacto || p.usuarios?.telefono || '—'}</div>
          </div>
          <span style={{ background: estadoInfo.bg, color: estadoInfo.color, borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 800 }}>
            {estadoInfo.label}
          </span>
        </div>

        <div style={{ display: 'grid', gap: 4, fontSize: 13 }}>
          <div><span className="muted">Dirección: </span>{p.direccion_entrega}</div>
          <div><span className="muted">Horario: </span><strong>{p.hora_entrega_asignada || p.horario || '—'}</strong></div>
          {p.genera_cupon && p.estado === 'pendiente'
            ? <div style={{ fontSize: 12, color: 'var(--mall-accent)' }}>🎟️ Generará cupón al confirmar</div>
            : null}
        </div>

        <Factura items={p.detalle_pedidos} montoTotal={p.monto_total} />

        {cuponActivo ? (
          <div style={{ background: '#dff7ed', border: '1.5px dashed var(--mall-main)', borderRadius: 10, padding: '12px 14px', display: 'grid', gap: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--mall-main)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              🎟️ Cupón generado — entregar al cliente
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 900, letterSpacing: 3, color: 'var(--mall-dark)' }}>
              {cuponActivo.codigo}
            </div>
            <div style={{ fontSize: 13 }}>
              Valor: <strong className="price">{money(cuponActivo.valor)}</strong>
              {cuponActivo.fecha_vencimiento
                ? <span className="muted"> · Vence: {new Date(cuponActivo.fecha_vencimiento).toLocaleDateString('es-GT')}</span>
                : null}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
              <button type="button" className="btn-outline" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => copiarCodigo(cuponActivo.codigo)}>
                {copiado === cuponActivo.codigo ? '✓ Copiado' : 'Copiar código'}
              </button>
              <button type="button" className="btn-outline" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => imprimirPedido(p)}>
                Reimprimir
              </button>
              {p.usuarios?.telefono ? (
                <a href={`sms:${p.usuarios.telefono}?body=Tu cupón MALL: ${cuponActivo.codigo} por ${money(cuponActivo.valor)}. Válido hasta ${new Date(cuponActivo.fecha_vencimiento || '').toLocaleDateString('es-GT')}.`}
                  style={{ fontSize: 12, padding: '4px 12px', borderRadius: 8, border: '1.5px solid var(--mall-main)', color: 'var(--mall-main)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                  Enviar SMS
                </a>
              ) : null}
            </div>
          </div>
        ) : null}

        {!terminado ? (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {FLUJO.slice(0, -1).map((e, idx) => (
              <div key={e} style={{ flex: 1, height: 4, borderRadius: 999, background: idx <= idxActual ? 'var(--mall-main)' : '#edf4f1', transition: 'background 0.3s' }} />
            ))}
          </div>
        ) : null}

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
      <PageHeader title="Pedidos de hoy" subtitle="Al confirmar un pedido se imprime la factura y el cupón si aplica." />
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
