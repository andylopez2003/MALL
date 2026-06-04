import { supabase } from '../supabase.js'
import { todayRange } from '../utils/business.js'

export function usePedidos() {
  async function pedidosHoy() {
    const { start, end } = todayRange()
    const { data, error } = await supabase
      .from('pedidos')
      .select('*, usuarios(nombre, telefono)')
      .gte('created_at', start)
      .lt('created_at', end)
      .order('hora_entrega_asignada', { ascending: true })
    if (error) throw error
    return data || []
  }

  async function cambiarEstado(pedido, nuevoEstado) {
    const { error } = await supabase
      .from('pedidos')
      .update({ estado: nuevoEstado })
      .eq('id', pedido.id)
    if (error) throw error

    // ── Si el pedido se CANCELA ──────────────────────────────────────────
    // El cupón que el cliente usó vuelve a estar disponible en su cuenta
    if (nuevoEstado === 'cancelado' && pedido.cupon_canjeado_id) {
      await supabase
        .from('cupones')
        .update({ estado: 'activo' })
        .eq('id', pedido.cupon_canjeado_id)
        .eq('estado', 'en_uso')
    }

    // ── Si el pedido se marca como ENTREGADO ─────────────────────────────
    if (nuevoEstado === 'entregado') {
      // 1. El cupón que usó el cliente queda definitivamente canjeado (eliminado de su cuenta)
      if (pedido.cupon_canjeado_id) {
        await supabase
          .from('cupones')
          .update({ estado: 'canjeado', fecha_canje: new Date().toISOString() })
          .eq('id', pedido.cupon_canjeado_id)
          .eq('estado', 'en_uso')
      }

      // 2. Si el pedido calificó para generar un cupón nuevo (por superar el monto mínimo),
      //    se crea ahora para que el cliente lo use en su próxima compra
      if (pedido.genera_cupon && pedido.cliente_id) {
        const { data: configData } = await supabase
          .from('configuracion')
          .select('clave, valor')
          .in('clave', ['valor_cupon_domicilio', 'dias_vencimiento_cupon'])
        const config = Object.fromEntries((configData || []).map((i) => [i.clave, i.valor]))
        const valor = Number(config.valor_cupon_domicilio || 10)
        const dias  = Number(config.dias_vencimiento_cupon || 14)
        const codigo = `MALL-${Date.now().toString(36).toUpperCase()}`
        const vence  = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString()

        await supabase.from('cupones').insert({
          codigo,
          cliente_id: pedido.cliente_id,
          pedido_id: pedido.id,
          valor,
          estado: 'activo',
          fecha_emision: new Date().toISOString(),
          fecha_vencimiento: vence,
        })

        // Marcar para no generar doble si se vuelve a llamar
        await supabase.from('pedidos').update({ genera_cupon: false }).eq('id', pedido.id)
      }
    }
  }

  return { pedidosHoy, cambiarEstado }
}
