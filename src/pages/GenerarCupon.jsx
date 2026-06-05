import { useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { supabase } from '../supabase.js'
import { money } from '../utils/business.js'

function generarCodigo() {
  return `MALL-${Date.now().toString(36).toUpperCase()}`
}

export default function GenerarCupon() {
  const [valor, setValor] = useState('')
  const [dias, setDias] = useState('14')
  const [dpi, setDpi] = useState('')
  const [cliente, setCliente] = useState(null)
  const [buscandoCliente, setBuscandoCliente] = useState(false)
  const [clienteError, setClienteError] = useState('')

  const [cuponGenerado, setCuponGenerado] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copiado, setCopiado] = useState(false)

  async function buscarCliente(e) {
    e.preventDefault()
    if (!dpi.trim()) return
    setBuscandoCliente(true)
    setClienteError('')
    setCliente(null)

    const { data, error: err } = await supabase
      .from('usuarios')
      .select('id, nombre, dpi, telefono')
      .eq('dpi', dpi.trim())
      .eq('rol', 'cliente')
      .maybeSingle()

    setBuscandoCliente(false)
    if (err || !data) { setClienteError('Cliente no encontrado.'); return }
    setCliente(data)
  }

  async function generar() {
    const val = Number(valor)
    if (!val || val <= 0) { setError('Ingresa un valor válido para el cupón.'); return }

    setLoading(true)
    setError('')
    const codigo = generarCodigo()
    const vence = new Date(Date.now() + Number(dias || 14) * 24 * 60 * 60 * 1000).toISOString()

    const { data, error: err } = await supabase
      .from('cupones')
      .insert({
        codigo,
        cliente_id: cliente?.id || null,
        valor: val,
        estado: 'activo',
        fecha_emision: new Date().toISOString(),
        fecha_vencimiento: vence,
      })
      .select('id, codigo, valor, fecha_vencimiento')
      .single()

    setLoading(false)
    if (err) { setError(err.message); return }
    setCuponGenerado(data)
  }

  function copiar() {
    navigator.clipboard?.writeText(cuponGenerado.codigo).then(() => {
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2000)
    })
  }

  function imprimir() {
    window.print()
  }

  function nuevo() {
    setCuponGenerado(null)
    setValor('')
    setDpi('')
    setCliente(null)
    setCopiado(false)
    setError('')
  }

  return (
    <Navbar>
      <PageHeader title="Generar Cupón" subtitle="Crea cupones de descuento para regalar o asignar a clientes. Se entregan físicamente." />
      {error ? <div className="error">{error}</div> : null}

      {cuponGenerado ? (
        <div className="card grid" style={{ gap: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>🎟️</div>
          <h2 className="font-display" style={{ margin: 0 }}>Cupón generado</h2>
          <div style={{ background: '#f7f9f7', borderRadius: 10, padding: '20px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--mall-muted)', marginBottom: 6, letterSpacing: 1 }}>CÓDIGO</div>
            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: 3, color: 'var(--mall-dark)', fontFamily: 'monospace' }}>
              {cuponGenerado.codigo}
            </div>
            <div className="price" style={{ marginTop: 8, fontSize: 22 }}>{money(cuponGenerado.valor)}</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Vence: {new Date(cuponGenerado.fecha_vencimiento).toLocaleDateString('es-GT')}
            </div>
          </div>
          {cliente ? (
            <div className="muted" style={{ fontSize: 13 }}>
              Asignado a: <strong>{cliente.nombre}</strong> — DPI: {cliente.dpi}
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 13 }}>Sin cliente asignado — válido para cualquier persona que tenga el código</div>
          )}
          <div style={{ display: 'grid', gap: 8 }}>
            <button className="btn-primary" type="button" onClick={copiar}>
              {copiado ? '✓ Copiado' : 'Copiar código'}
            </button>
            <button className="btn-outline" type="button" onClick={imprimir}>
              Imprimir cupón
            </button>
            {cliente?.telefono ? (
              <a
                href={`sms:${cliente.telefono}?body=Tu cupón MALL: ${cuponGenerado.codigo} por ${money(cuponGenerado.valor)}. Válido hasta ${new Date(cuponGenerado.fecha_vencimiento).toLocaleDateString('es-GT')}.`}
                style={{ textAlign: 'center', padding: '10px 16px', borderRadius: 10, border: '1.5px solid var(--mall-main)', color: 'var(--mall-main)', textDecoration: 'none', fontWeight: 700, fontSize: 14 }}
              >
                Enviar por SMS
              </a>
            ) : null}
            <button className="btn-outline" type="button" onClick={nuevo}>
              Generar otro cupón
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-2">
          {/* Configuración del cupón */}
          <div className="card grid">
            <h2 className="font-display" style={{ margin: 0 }}>Configurar cupón</h2>

            <div className="grid" style={{ gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700 }}>Valor del descuento (Q)</label>
              <input
                className="input-field"
                type="number"
                min="1"
                step="1"
                placeholder="Ej: 10"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>

            <div className="grid" style={{ gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700 }}>Días de vigencia</label>
              <input
                className="input-field"
                type="number"
                min="1"
                step="1"
                placeholder="Ej: 14"
                value={dias}
                onChange={(e) => setDias(e.target.value)}
              />
            </div>

            <button
              className="btn-accent"
              type="button"
              disabled={!valor || loading}
              onClick={generar}
              style={{ fontSize: 15 }}
            >
              {loading ? 'Generando...' : '🎟️ Generar cupón'}
            </button>
          </div>

          {/* Asignar a cliente (opcional) */}
          <div className="card grid">
            <h2 className="font-display" style={{ margin: 0 }}>Asignar a cliente <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>(opcional)</span></h2>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>Busca por DPI. Si no asignas cliente, el cupón puede usarlo cualquiera que tenga el código.</p>

            <form onSubmit={buscarCliente} style={{ display: 'flex', gap: 8 }}>
              <input
                className="input-field"
                placeholder="DPI del cliente"
                value={dpi}
                onChange={(e) => { setDpi(e.target.value); setClienteError(''); setCliente(null) }}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn-outline" disabled={buscandoCliente} style={{ flexShrink: 0, padding: '0 14px' }}>
                {buscandoCliente ? '...' : 'Buscar'}
              </button>
            </form>

            {clienteError ? <div className="error" style={{ margin: 0, fontSize: 13 }}>{clienteError}</div> : null}

            {cliente ? (
              <div className="card" style={{ background: '#dff7ed', padding: 12 }}>
                <strong>{cliente.nombre}</strong>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  DPI: {cliente.dpi} {cliente.telefono ? `• Tel: ${cliente.telefono}` : ''}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </Navbar>
  )
}
