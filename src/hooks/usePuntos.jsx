import { supabase } from '../supabase.js'

async function getConfigPuntos() {
  const { data } = await supabase
    .from('configuracion')
    .select('clave, valor')
    .in('clave', ['monto_minimo_puntos', 'puntos_por_100', 'valor_punto'])
  const config = Object.fromEntries((data || []).map((i) => [i.clave, i.valor]))
  return {
    montoMinimo:  Number(config.monto_minimo_puntos || 100),
    puntosPor100: Number(config.puntos_por_100      || 10),
    valorPunto:   Number(config.valor_punto          || 1),
  }
}

export function calcularPuntosConConfig(monto, config) {
  const m = Number(monto || 0)
  if (m < config.montoMinimo) return 0
  return Math.floor(m / 100) * config.puntosPor100
}

export function usePuntos() {
  async function registrarCompra({ clienteId, montoTotal, adminId, puntosUsados = 0 }) {
    const config = await getConfigPuntos()
    const montoBase     = Number(montoTotal || 0)
    // Los puntos se ganan sobre el monto bruto completo (antes del descuento)
    const puntosGanados = calcularPuntosConConfig(montoBase, config)
    const descuento     = Math.min(Number(puntosUsados || 0) * config.valorPunto, montoBase)
    const montoFinal    = montoBase - descuento

    const { data: compra, error } = await supabase
      .from('compras')
      .insert({ cliente_id: clienteId || null, monto_total: montoFinal, puntos_ganados: puntosGanados, admin_id: adminId })
      .select()
      .single()
    if (error) throw error

    // Solo actualizar puntos si hay cliente
    if (clienteId) {
      const { data: saldoActual } = await supabase.from('puntos').select('*').eq('cliente_id', clienteId).maybeSingle()
      const saldoPrevio          = Number(saldoActual?.saldo          || 0)
      const totalGanadoPrev      = Number(saldoActual?.total_ganado   || 0)
      const totalCanjeadoPrev    = Number(saldoActual?.total_canjeado || 0)

      // Saldo = (previo + nuevos ganados) - usados (nunca negativo)
      const totalAntesDePago = saldoPrevio + puntosGanados
      const nuevoSaldo       = Math.max(totalAntesDePago - Number(puntosUsados || 0), 0)

      await supabase.from('puntos').upsert({
        cliente_id:     clienteId,
        saldo:          nuevoSaldo,
        total_ganado:   totalGanadoPrev + puntosGanados,
        total_canjeado: totalCanjeadoPrev + Number(puntosUsados || 0),
      }, { onConflict: 'cliente_id' })

      if (puntosUsados > 0) {
        await supabase.from('movimientos_puntos').insert({
          cliente_id: clienteId, tipo: 'canjeado', monto: puntosUsados,
          descripcion: `Descuento de Q${descuento.toFixed(2)} en compra en tienda`,
          compra_id: compra.id, admin_id: adminId,
        })
      }

      if (puntosGanados > 0) {
        await supabase.from('movimientos_puntos').insert({
          cliente_id: clienteId, tipo: 'ganado', monto: puntosGanados,
          descripcion: `Compra en tienda por Q${montoBase.toFixed(2)}`,
          compra_id: compra.id, admin_id: adminId,
        })
      }
    }

    return { compra, puntosGanados, descuento, montoFinal }
  }

  async function canjearPuntos({ clienteId, monto, descripcion, adminId }) {
    const { data: saldoActual, error: saldoError } = await supabase.from('puntos').select('*').eq('cliente_id', clienteId).maybeSingle()
    if (saldoError) throw saldoError
    if (Number(saldoActual?.saldo || 0) < Number(monto)) throw new Error('Saldo insuficiente.')

    await supabase.from('puntos').update({
      saldo:          Number(saldoActual.saldo)          - Number(monto),
      total_canjeado: Number(saldoActual.total_canjeado || 0) + Number(monto),
    }).eq('cliente_id', clienteId)

    const { error } = await supabase.from('movimientos_puntos').insert({
      cliente_id: clienteId, tipo: 'canjeado', monto, descripcion, admin_id: adminId,
    })
    if (error) throw error
  }

  return { registrarCompra, canjearPuntos, getConfigPuntos, calcularPuntosConConfig }
}
