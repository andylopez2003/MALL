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

    // ── Al CONFIRMAR: generar cupón si el pedido califica ────────────────
    // El cupón se genera aquí para que el admin lo pueda entregar físicamente
    if (nuevoEstado === 'confirmado' && pedido.genera_cupon && pedido.cliente_id) {
      const { data: configData } = await supabase
        .from('configuracion')
        .select('clave, valor')
        .in('clave', ['valor_cupon_domicilio', 'dias_vencimiento_cupon'])
      const config = Object.fromEntries((configData || []).map((i) => [i.clave, i.valor]))
      const valor = Number(config.valor_cupon_domicilio  || 10)
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
      await supabase.from('pedidos').update({ genera_cupon: false }).eq('id', pedido.id)
    }

    // ── Si se CANCELA: restaurar el cupón que el cliente usó ─────────────
    if (nuevoEstado === 'cancelado' && pedido.cupon_canjeado_id) {
      await supabase
        .from('cupones')
        .update({ estado: 'activo', fecha_canje: null })
        .eq('id', pedido.cupon_canjeado_id)
    }
  }

  return { pedidosHoy, cambiarEstado }
}
