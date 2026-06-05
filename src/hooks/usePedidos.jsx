import { supabase } from '../supabase.js'
import { todayRange } from '../utils/business.js'

export function usePedidos() {
  async function pedidosHoy() {
    const { start, end } = todayRange()
    const { data, error } = await supabase
      .from('pedidos')
      .select('*, usuarios(nombre, telefono), cupones!pedido_id(id, codigo, valor, estado, fecha_vencimiento), detalle_pedidos(nombre_producto, cantidad, precio_unitario, subtotal)')
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

    // ── Al CONFIRMAR: generar N cupones según floor(total/umbral) ──────────
    if (nuevoEstado === 'confirmado' && pedido.genera_cupon && pedido.cliente_id) {
      const { data: configData } = await supabase
        .from('configuracion')
        .select('clave, valor')
        .in('clave', ['valor_cupon_domicilio', 'dias_vencimiento_cupon', 'monto_cupon_domicilio'])
      const config = Object.fromEntries((configData || []).map((i) => [i.clave, i.valor]))

      const umbral     = Number(config.monto_cupon_domicilio  || 150)
      const valorCupon = Number(config.valor_cupon_domicilio  || 10)
      const dias       = Number(config.dias_vencimiento_cupon || 14)
      const vence      = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString()

      // Número de cupones = cuántas veces el total supera el umbral
      const numCupones = Math.floor(Number(pedido.monto_total || 0) / umbral)

      for (let i = 0; i < numCupones; i++) {
        const codigo = `MALL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
        await supabase.from('cupones').insert({
          codigo,
          cliente_id: pedido.cliente_id,
          pedido_id:  pedido.id,
          valor:      valorCupon,
          estado:     'activo',
          fecha_emision: new Date().toISOString(),
          fecha_vencimiento: vence,
        })
      }

      await supabase.from('pedidos').update({ genera_cupon: false }).eq('id', pedido.id)
    }

    // ── Si se CANCELA: restaurar todos los cupones canjeados de este pedido ──
    // Busca cupones que fueron canjeados aproximadamente al momento de crear el pedido
    if (nuevoEstado === 'cancelado') {
      const createdAt = pedido.created_at
      if (createdAt) {
        const desde = new Date(new Date(createdAt).getTime() - 60000).toISOString()
        const hasta = new Date(new Date(createdAt).getTime() + 60000).toISOString()
        await supabase
          .from('cupones')
          .update({ estado: 'activo', fecha_canje: null })
          .gte('fecha_canje', desde)
          .lte('fecha_canje', hasta)
          .eq('estado', 'canjeado')
      }
    }
  }

  return { pedidosHoy, cambiarEstado }
}
