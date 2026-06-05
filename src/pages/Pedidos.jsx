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

export default function Pedidos() {
  const { pedidosHoy, cambiarEstado } = usePedidos()
  const [pedidos, setPedidos] = useState([])
  const [error, setError] = useState('')
  const [cambiando, setCambiando] = useState(null)
  const [copiado, setCopiado] = useState(null)

  async function load() {
    try { setPedidos(await pedidosHoy()) } catch (err) { setError(err.message) }
  }

  useEffect(() => { load() }, [])

  async function avanzar(pedido) {
    const siguiente = BOTON_SIGUIENTE[pedido.estado]?.siguiente
    if (!siguiente) return
    setCambiando(pedido.id + siguiente)
    await cambiarEstado(pedido, siguiente)
    setCambiando(null)
    load()
  }

  async function cancelar(pedido) {
    if (!window.confirm('¿Cancelar este pedido?')) return
    setCambiando(pedido.id + 'cancelado')
    await cambiarEstado(pedido, 'cancelado')
    setCambiando(null)
    load()
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
        {/* Encabezado */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto auto auto',
          gap: '0 10px',
          padding: '6px 10px',
          background: '#f7f9f7',
          fontWeight: 700,
          fontSize: 11,
          color: 'var(--mall-muted)',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          borderBottom: '1px solid #e5e9e6',
        }}>
          <span>Producto</span>
          <span style={{ textAlign: 'right' }}>Cant.</span>
          <span style={{ textAlign: 'right' }}>P/U</span>
          <span style={{ textAlign: 'right' }}>Total</span>
        </div>
        {/* Filas de productos */}
        {items.map((item, idx) => (
          <div key={idx} style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto auto',
            gap: '0 10px',
            padding: '7px 10px',
            borderBottom: idx < items.length - 1 ? '1px solid #f0f2f0' : 'none',
            alignItems: 'center',
          }}>
            <span style={{ fontWeight: 600 }}>{item.nombre_producto}</span>
            <span style={{ textAlign: 'right', color: 'var(--mall-muted)' }}>×{item.cantidad}</span>
            <span style={{ textAlign: 'right', color: 'var(--mall-muted)' }}>{money(item.precio_unitario)}</span>
            <span style={{ textAlign: 'right', fontWeight: 700 }}>{money(item.subtotal)}</span>
          </div>
        ))}
        {/* Total */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '8px 10px',
          background: '#f0f8f4',
          borderTop: '2px solid #c7e8d8',
          fontWeight: 800,
          fontSize: 14,
        }}>
          <span>Total</span>
          <span className="price">{money(montoTotal)}</span>
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
            ? <div style={{ fontSize: 12, color: 'var(--mall-accent)' }}>🎟️ Generará cupón al confirmar</div>
            : null}
        </div>

        {/* Factura de productos */}
        <Factura items={p.detalle_pedidos} montoTotal={p.monto_total} />

        {/* Cupón generado — mostrar para imprimir / enviar */}
        {cuponActivo ? (
          <div style={{
            background: '#dff7ed',
            border: '1.5px dashed var(--mall-main)',
            borderRadius: 10,
            padding: '12px 14px',
            display: 'grid',
            gap: 6,
          }}>
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
              <button
                type="button"
                className="btn-outline"
                style={{ fontSize: 12, padding: '4px 12px' }}
                onClick={() => copiarCodigo(cuponActivo.codigo)}
              >
                {copiado === cuponActivo.codigo ? '✓ Copiado' : 'Copiar código'}
              </button>
              {p.usuarios?.telefono ? (
                <a
                  href={`sms:${p.usuarios.telefono}?body=Tu cupón MALL: ${cuponActivo.codigo} por ${money(cuponActivo.valor)}. Válido hasta ${new Date(cuponActivo.fecha_vencimiento || '').toLocaleDateString('es-GT')}.`}
                  style={{ fontSize: 12, padding: '4px 12px', borderRadius: 8, border: '1.5px solid var(--mall-main)', color: 'var(--mall-main)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                >
                  Enviar SMS
                </a>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Barra de progreso del estado */}
        {!terminado ? (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {FLUJO.slice(0, -1).map((e, idx) => (
              <div key={e} style={{
                flex: 1, height: 4, borderRadius: 999,
                background: idx <= idxActual ? 'var(--mall-main)' : '#edf4f1',
                transition: 'background 0.3s',
              }} />
            ))}
          </div>
        ) : null}

        {/* Botones de acción */}
        {!terminado ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {siguienteInfo ? (
              <button
                type="button"
                className="btn-primary"
                style={{ flex: 1, minWidth: 160, fontSize: 14 }}
                disabled={!!cambiando}
                onClick={() => avanzar(p)}
              >
                {cambiando === p.id + siguienteInfo.siguiente ? 'Guardando...' : siguienteInfo.label}
              </button>
            ) : null}
            <button
              type="button"
              className="btn-danger"
              style={{ padding: '0 16px', fontSize: 13 }}
              disabled={!!cambiando}
              onClick={() => cancelar(p)}
            >
              Cancelar
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <Navbar>
      <PageHeader title="Pedidos de hoy" subtitle="Gestiona los pedidos a domicilio. El cupón se genera al confirmar el pedido." />
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
