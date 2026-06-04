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

  const activos   = pedidos.filter((p) => p.estado !== 'entregado' && p.estado !== 'cancelado')
  const terminados = pedidos.filter((p) => p.estado === 'entregado' || p.estado === 'cancelado')

  function PedidoCard({ p }) {
    const estadoInfo = ESTADO_LABEL[p.estado] || ESTADO_LABEL.pendiente
    const siguienteInfo = BOTON_SIGUIENTE[p.estado]
    const idxActual = FLUJO.indexOf(p.estado)
    const terminado = p.estado === 'entregado' || p.estado === 'cancelado'

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
          <div><span className="muted">Total: </span><strong className="price" style={{ fontSize: 15 }}>{money(p.monto_total)}</strong></div>
          {p.genera_cupon ? <div style={{ fontSize: 12, color: 'var(--mall-accent)' }}>🎟️ Genera cupón al entregar</div> : null}
        </div>

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
      <PageHeader title="Pedidos de hoy" subtitle="Gestiona los pedidos a domicilio. El cupón se genera al marcar como entregado." />
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
