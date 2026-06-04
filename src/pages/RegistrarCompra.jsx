import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { calcularPuntosConConfig, usePuntos } from '../hooks/usePuntos.jsx'
import { supabase } from '../supabase.js'
import { money } from '../utils/business.js'

export default function RegistrarCompra() {
  const { profile } = useAuth()
  const { registrarCompra, getConfigPuntos } = usePuntos()

  const [dpi, setDpi] = useState('')
  const [cliente, setCliente] = useState(null)
  const [saldoPrevio, setSaldoPrevio] = useState(0)
  const [monto, setMonto] = useState('')
  const [config, setConfig] = useState({ montoMinimo: 100, puntosPor100: 10, valorPunto: 1 })

  const [ventanaAbierta, setVentanaAbierta] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { getConfigPuntos().then(setConfig).catch(() => {}) }, [])

  async function buscar(event) {
    event.preventDefault()
    setError('')
    setCliente(null)
    setSaldoPrevio(0)
    setMonto('')
    setMessage('')
    setVentanaAbierta(false)

    const { data, error: fetchError } = await supabase
      .from('usuarios')
      .select('*, puntos(*)')
      .eq('dpi', dpi.trim())
      .maybeSingle()

    if (fetchError) { setError(fetchError.message); return }
    if (!data) { setError('No se encontró cliente con ese DPI.'); return }
    setCliente(data)
    setSaldoPrevio(Number(data.puntos?.[0]?.saldo || 0))
  }

  const montoNum = Number(monto || 0)

  // Puntos que gana con esta compra
  const puntosNuevos = calcularPuntosConConfig(montoNum, config)

  // Total de puntos disponibles para descuento = previos + los que gana ahora
  const puntosDisponibles = saldoPrevio + puntosNuevos

  // Valor del descuento en quetzales
  const descuento = Math.min(puntosDisponibles * config.valorPunto, montoNum)
  const montoConDescuento = montoNum - descuento

  // El descuento está disponible si hay algún punto (previo o nuevo)
  const puedeDescontar = puntosDisponibles > 0

  function abrirVentana() {
    setError('')
    setMessage('')
    if (!cliente) { setError('Primero busca un cliente.'); return }
    if (!montoNum || montoNum <= 0) { setError('Ingresa un monto válido.'); return }
    setVentanaAbierta(true)
  }

  async function registrar(usarDescuento) {
    setVentanaAbierta(false)
    setLoading(true)
    setError('')
    try {
      // Si usa descuento: se gastan todos los puntos disponibles
      const puntosUsados = usarDescuento ? puntosDisponibles : 0

      const result = await registrarCompra({
        clienteId: cliente.id,
        montoTotal: montoNum,
        adminId: profile.id,
        puntosUsados,
      })

      const partes = []
      if (usarDescuento && result.descuento > 0) {
        partes.push(`Descuento de ${money(result.descuento)} aplicado (${puntosUsados} puntos).`)
        partes.push(`Total cobrado: ${money(result.montoFinal)}.`)
        if (result.puntosGanados > 0) partes.push(`Ganó ${result.puntosGanados} puntos nuevos.`)
      } else {
        partes.push(`Compra de ${money(montoNum)} registrada.`)
        if (result.puntosGanados > 0) partes.push(`Ganó ${result.puntosGanados} puntos → saldo total: ${saldoPrevio + result.puntosGanados} puntos.`)
      }

      setMessage(partes.join(' '))
      setSaldoPrevio((prev) => Math.max(prev - puntosUsados, 0) + result.puntosGanados)
      setMonto('')
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
        subtitle={`${config.puntosPor100} pts por Q100 • 1 pt = Q${config.valorPunto} • Requiere DPI`}
      />

      {error ? <div className="error">{error}</div> : null}
      {message ? <div className="card" style={{ marginBottom: 16, background: '#dff7ed', color: '#0f6e56' }}>{message}</div> : null}

      <div className="grid grid-2">
        {/* Buscar cliente */}
        <form className="card grid" onSubmit={buscar}>
          <h2 className="font-display">Buscar cliente</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Requiere DPI del cliente.</p>
          <input
            className="input-field"
            placeholder="DPI del cliente"
            value={dpi}
            onChange={(e) => setDpi(e.target.value)}
            required
          />
          <button type="submit" className="btn-primary">Buscar</button>
        </form>

        {/* Registrar compra */}
        <div className="card grid">
          <h2 className="font-display">Compra en tienda</h2>

          {cliente ? (
            <div className="card" style={{ background: '#f0faf6', padding: 12 }}>
              <strong>{cliente.nombre}</strong>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                Puntos previos: <strong>{saldoPrevio}</strong>
                {saldoPrevio > 0 ? ` = ${money(saldoPrevio * config.valorPunto)}` : ''}
              </div>
            </div>
          ) : (
            <p className="muted">Busca un cliente para continuar.</p>
          )}

          <input
            className="input-field"
            type="number"
            min="0"
            step="0.01"
            placeholder="Monto total de la compra (Q)"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            disabled={!cliente}
          />

          {montoNum > 0 && cliente ? (
            <div className="card" style={{ background: '#f7f9f7', padding: 10, fontSize: 13 }}>
              {puntosNuevos > 0
                ? <span>Esta compra genera <strong>{puntosNuevos} puntos</strong> = <strong>{money(puntosNuevos * config.valorPunto)}</strong></span>
                : <span className="muted">Compra menor a {money(config.montoMinimo)} — no genera puntos.</span>}
              {saldoPrevio > 0 ? (
                <div style={{ marginTop: 4 }}>
                  Puntos previos: <strong>{saldoPrevio}</strong> — Total disponible: <strong>{puntosDisponibles} pts = {money(puntosDisponibles * config.valorPunto)}</strong>
                </div>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            className="btn-accent"
            disabled={!cliente || !montoNum || loading}
            style={{ fontSize: 15 }}
            onClick={abrirVentana}
          >
            {loading ? 'Registrando...' : 'Pagar'}
          </button>
        </div>
      </div>

      {/* Ventana de elección */}
      {ventanaAbierta ? (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15,31,26,.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setVentanaAbierta(false) }}
        >
          <div className="card" style={{ width: '100%', maxWidth: 420, display: 'grid', gap: 16 }}>
            <div>
              <h2 className="font-display" style={{ margin: '0 0 6px', fontSize: 22 }}>
                Compra: {money(montoNum)}
              </h2>
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>
                {cliente?.nombre}
              </p>
              {puntosDisponibles > 0 ? (
                <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--mall-dark)' }}>
                  Puntos disponibles: <strong>{puntosDisponibles}</strong> = <strong>{money(puntosDisponibles * config.valorPunto)}</strong> de descuento
                  {puntosNuevos > 0 ? ` (${saldoPrevio} previos + ${puntosNuevos} de esta compra)` : ''}
                </p>
              ) : null}
            </div>

            {/* Opción 1: descuento ahora */}
            <button
              type="button"
              className="btn-accent"
              onClick={() => registrar(true)}
              disabled={!puedeDescontar}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                padding: '16px 18px', gap: 6, textAlign: 'left',
                opacity: puedeDescontar ? 1 : 0.45,
              }}
            >
              <strong style={{ fontSize: 16 }}>Hacer descuento en esta compra</strong>
              <span style={{ fontSize: 13, fontWeight: 400 }}>
                {puedeDescontar
                  ? `−${money(descuento)} → cobrar ${money(montoConDescuento)}`
                  : 'Sin puntos disponibles para descuento'}
              </span>
            </button>

            {/* Opción 2: acumular */}
            <button
              type="button"
              className="btn-primary"
              onClick={() => registrar(false)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                padding: '16px 18px', gap: 6, textAlign: 'left',
              }}
            >
              <strong style={{ fontSize: 16 }}>Acumular a la cuenta</strong>
              <span style={{ fontSize: 13, fontWeight: 400 }}>
                Cobrar {money(montoNum)} completo
                {puntosNuevos > 0 ? ` → gana ${puntosNuevos} puntos (total: ${saldoPrevio + puntosNuevos} pts)` : ''}
              </span>
            </button>

            <button
              type="button"
              className="btn-outline"
              onClick={() => setVentanaAbierta(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </Navbar>
  )
}
