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
  const [saldo, setSaldo] = useState(0)
  const [monto, setMonto] = useState('')
  const [config, setConfig] = useState({ montoMinimo: 100, puntosPor100: 10, valorPunto: 1 })

  const [showEleccion, setShowEleccion] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { getConfigPuntos().then(setConfig).catch(() => {}) }, [])

  async function buscar(event) {
    event.preventDefault()
    setError('')
    setCliente(null)
    setSaldo(0)
    setMonto('')
    setMessage('')
    setShowEleccion(false)

    const { data, error: fetchError } = await supabase
      .from('usuarios')
      .select('*, puntos(*)')
      .eq('dpi', dpi.trim())
      .maybeSingle()

    if (fetchError) { setError(fetchError.message); return }
    if (!data) { setError('No se encontró cliente con ese DPI.'); return }
    setCliente(data)
    setSaldo(Number(data.puntos?.[0]?.saldo || 0))
  }

  const montoNum = Number(monto || 0)
  const maxDescuento = saldo * config.valorPunto
  const puntosGanarSinCanjear = calcularPuntosConConfig(montoNum, config)
  const montoConDescuento = Math.max(montoNum - maxDescuento, 0)
  const puntosGanarConCanjear = calcularPuntosConConfig(montoConDescuento, config)

  function clickPagar(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!montoNum || montoNum <= 0) { setError('Ingresa un monto válido.'); return }
    setShowEleccion(true)
  }

  async function registrar(canjear) {
    setShowEleccion(false)
    setLoading(true)
    setError('')
    try {
      const puntosUsados = canjear ? saldo : 0
      const result = await registrarCompra({
        clienteId: cliente.id,
        montoTotal: montoNum,
        adminId: profile.id,
        puntosUsados,
      })

      const partes = [`Compra registrada por ${money(montoNum)}.`]
      if (canjear && result.descuento > 0) {
        partes.push(`Se canjearon ${saldo} puntos → descuento de ${money(result.descuento)}.`)
        partes.push(`Total cobrado: ${money(result.montoFinal)}.`)
      }
      if (result.puntosGanados > 0) partes.push(`Ganó ${result.puntosGanados} puntos nuevos.`)
      else partes.push('No alcanzó el mínimo para ganar puntos.')

      setMessage(partes.join(' '))
      setSaldo((prev) => Math.max(prev - puntosUsados, 0) + result.puntosGanados)
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
        subtitle={`${config.puntosPor100} puntos por cada Q100 • 1 punto = Q${config.valorPunto} • Requiere DPI`}
      />

      {error ? <div className="error">{error}</div> : null}
      {message ? <div className="card" style={{ marginBottom: 16, background: '#dff7ed', color: '#0f6e56' }}>{message}</div> : null}

      <div className="grid grid-2">
        {/* Buscar cliente */}
        <form className="card grid" onSubmit={buscar}>
          <h2 className="font-display">Buscar cliente</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>La acumulación de puntos requiere DPI del cliente.</p>
          <input className="input-field" placeholder="DPI del cliente" value={dpi} onChange={(e) => setDpi(e.target.value)} required />
          <button className="btn-primary">Buscar</button>
        </form>

        {/* Compra */}
        <form className="card grid" onSubmit={clickPagar}>
          <h2 className="font-display">Compra en tienda</h2>

          {cliente ? (
            <div className="card" style={{ background: '#f0faf6', padding: 12 }}>
              <strong>{cliente.nombre}</strong>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                Puntos acumulados: <strong>{saldo}</strong>
                {saldo > 0 ? <span> = <strong>{money(saldo * config.valorPunto)}</strong> de descuento disponible</span> : null}
              </div>
            </div>
          ) : (
            <p className="muted">Busca un cliente para continuar.</p>
          )}

          <input
            className="input-field"
            type="number" min="0" step="0.01"
            placeholder="Monto total de la compra (Q)"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            disabled={!cliente}
            required
          />

          {montoNum > 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              {puntosGanarSinCanjear > 0
                ? `Ganará ${puntosGanarSinCanjear} punto${puntosGanarSinCanjear !== 1 ? 's' : ''} con esta compra.`
                : `Compra menor a ${money(config.montoMinimo)} — no acumula puntos.`}
            </p>
          ) : null}

          <button className="btn-accent" disabled={!cliente || loading} style={{ fontSize: 15 }}>
            {loading ? 'Registrando...' : 'Pagar'}
          </button>
        </form>
      </div>

      {/* Ventana de elección */}
      {showEleccion ? (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,31,26,.6)',
          display: 'grid', placeItems: 'center', zIndex: 1000, padding: 16,
        }}>
          <div className="card" style={{ width: 'min(400px,100%)', display: 'grid', gap: 14 }}>
            <div>
              <h2 className="font-display" style={{ margin: '0 0 4px', fontSize: 20 }}>
                Compra: {money(montoNum)}
              </h2>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                {cliente?.nombre} • {saldo} puntos acumulados
                {saldo > 0 ? ` (${money(saldo * config.valorPunto)} disponibles)` : ''}
              </p>
            </div>

            <button
              className="btn-accent"
              type="button"
              onClick={() => registrar(true)}
              disabled={saldo === 0}
              style={{ padding: '16px', textAlign: 'left', flexDirection: 'column', alignItems: 'flex-start', gap: 4, fontSize: 15 }}
            >
              <strong>Hacer descuento en esta compra</strong>
              {saldo > 0
                ? <span style={{ fontSize: 12, fontWeight: 400, opacity: .85 }}>
                    −{money(Math.min(maxDescuento, montoNum))} de descuento → cobrar {money(montoConDescuento)}
                  </span>
                : <span style={{ fontSize: 12, fontWeight: 400, opacity: .7 }}>El cliente no tiene puntos acumulados</span>}
            </button>

            <button
              className="btn-primary"
              type="button"
              onClick={() => registrar(false)}
              style={{ padding: '16px', textAlign: 'left', flexDirection: 'column', alignItems: 'flex-start', gap: 4, fontSize: 15 }}
            >
              <strong>Acumular a la cuenta</strong>
              <span style={{ fontSize: 12, fontWeight: 400, opacity: .85 }}>
                Cobrar {money(montoNum)} completo
                {puntosGanarSinCanjear > 0 ? ` • gana ${puntosGanarSinCanjear} puntos nuevos` : ''}
              </span>
            </button>

            <button className="btn-outline" type="button" onClick={() => setShowEleccion(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </Navbar>
  )
}
