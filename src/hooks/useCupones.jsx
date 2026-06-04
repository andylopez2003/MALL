import { supabase } from '../supabase.js'

export function useCupones() {
  async function validarYCanjear({ codigo, adminId, descripcion }) {
    const { data: cupon, error } = await supabase.from('cupones').select('*').eq('codigo', codigo.trim()).maybeSingle()
    if (error) throw error
    if (!cupon) throw new Error('Cupon no encontrado.')
    if (cupon.estado !== 'activo') throw new Error(`Este cupon ya esta ${cupon.estado}.`)
    if (new Date(cupon.fecha_vencimiento) < new Date()) {
      await supabase.from('cupones').update({ estado: 'vencido' }).eq('id', cupon.id)
      throw new Error('Este cupon esta vencido.')
    }

    const { data, error: updateError } = await supabase
      .from('cupones')
      .update({
        estado: 'canjeado',
        fecha_canje: new Date().toISOString(),
        admin_canje_id: adminId,
        descripcion_canje: descripcion,
      })
      .eq('id', cupon.id)
      .eq('estado', 'activo')
      .select()
      .single()
    if (updateError) throw updateError
    return data
  }

  return { validarYCanjear }
}
