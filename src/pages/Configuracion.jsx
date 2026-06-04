import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { supabase } from '../supabase.js'

const LABELS = {
  monto_minimo_domicilio: { label: 'Monto mínimo para domicilio', desc: 'Compra mínima para aceptar pedidos a domicilio', unit: 'Q', group: 'Domicilio' },
  monto_cupon_domicilio:  { label: 'Compra mínima para cupón',    desc: 'A partir de qué monto se genera un cupón de descuento', unit: 'Q', group: 'Cupones' },
  valor_cupon_domicilio:  { label: 'Valor del cupón de descuento', desc: 'Cuánto vale el cupón generado por domicilio', unit: 'Q', group: 'Cupones' },
  dias_vencimiento_cupon: { label: 'Días de vigencia del cupón',   desc: 'Cuántos días es válido el cupón después de emitirse', unit: 'días', group: 'Cupones' },
  max_pedidos_manana:     { label: 'Máx. pedidos jornada mañana', desc: 'Límite de pedidos en la jornada 13:00–15:00', unit: 'pedidos', group: 'Horarios' },
  max_pedidos_tarde:      { label: 'Máx. pedidos jornada tarde',  desc: 'Límite de pedidos en la jornada 17:00–19:00', unit: 'pedidos', group: 'Horarios' },
  monto_minimo_puntos:    { label: 'Compra mínima para ganar puntos', desc: 'Monto mínimo de compra en tienda para acumular puntos', unit: 'Q', group: 'Puntos' },
  puntos_por_100:         { label: 'Puntos por cada Q100 de compra', desc: 'Cuántos puntos gana el cliente por cada Q100 gastados', unit: 'puntos', group: 'Puntos' },
  valor_punto:            { label: 'Valor de cada punto',           desc: 'A cuántos quetzales equivale 1 punto al canjear', unit: 'Q', group: 'Puntos' },
}

const GROUP_ORDER = ['Domicilio', 'Cupones', 'Puntos', 'Horarios']

export default function Configuracion() {
  const [items, setItems] = useState([])
  const [editando, setEditando] = useState(null)
  const [valorEdit, setValorEdit] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    const { data } = await supabase.from('configuracion').select('*').order('clave')
    setItems(data || [])
  }

  useEffect(() => { load() }, [])

  function startEdit(item) {
    setEditando(item.clave)
    setValorEdit(String(item.valor))
    setMsg('')
  }

  async function guardar(clave) {
    setSaving(true)
    await supabase.from('configuracion').upsert({ clave, valor: valorEdit }, { onConflict: 'clave' })
    setEditando(null)
    setSaving(false)
    setMsg(`"${LABELS[clave]?.label || clave}" actualizado.`)
    window.setTimeout(() => setMsg(''), 3000)
    load()
  }

  const grouped = GROUP_ORDER.reduce((acc, g) => { acc[g] = []; return acc }, {})
  const otros = []
  items.forEach((item) => {
    const g = LABELS[item.clave]?.group
    if (g && grouped[g]) grouped[g].push(item)
    else if (item.clave !== 'slots_entrega') otros.push(item)
  })

  return (
    <Navbar>
      <PageHeader title="Configuración" subtitle="Administra los valores del sistema: cupones, puntos y horarios." />
      {msg ? <div className="card" style={{ marginBottom: 16, background: '#dff7ed', color: '#0f6e56' }}>{msg}</div> : null}

      {GROUP_ORDER.map((group) => {
        const rows = grouped[group]
        if (!rows || rows.length === 0) return null
        return (
          <section key={group} className="card" style={{ marginBottom: 16 }}>
            <h2 className="font-display" style={{ margin: '0 0 14px', fontSize: 18 }}>{group}</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {rows.map((item) => {
                const meta = LABELS[item.clave] || {}
                const isEditing = editando === item.clave
                return (
                  <div key={item.clave} style={{ display: 'grid', gap: 6, paddingBottom: 12, borderBottom: '1px solid #edf4f1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <strong style={{ fontSize: 14 }}>{meta.label || item.clave}</strong>
                        {meta.desc ? <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{meta.desc}</div> : null}
                      </div>
                      {!isEditing ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--mall-main)' }}>
                            {meta.unit === 'Q' ? 'Q' : ''}{String(item.valor)}{meta.unit && meta.unit !== 'Q' ? ' ' + meta.unit : ''}
                          </span>
                          <button className="btn-outline" style={{ padding: '5px 12px', minHeight: 32, fontSize: 12 }} onClick={() => startEdit(item)}>
                            Editar
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                          <input
                            className="input-field"
                            style={{ width: 90, minHeight: 34, padding: '6px 10px', fontSize: 14 }}
                            value={valorEdit}
                            onChange={(e) => setValorEdit(e.target.value)}
                            autoFocus
                          />
                          <button className="btn-primary" style={{ padding: '5px 12px', minHeight: 34, fontSize: 12 }} onClick={() => guardar(item.clave)} disabled={saving}>
                            {saving ? '...' : 'OK'}
                          </button>
                          <button className="btn-outline" style={{ padding: '5px 10px', minHeight: 34, fontSize: 12 }} onClick={() => setEditando(null)}>✕</button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {otros.length > 0 ? (
        <section className="card" style={{ marginBottom: 16 }}>
          <h2 className="font-display" style={{ margin: '0 0 14px', fontSize: 18 }}>Otros</h2>
          <table className="table">
            <thead><tr><th>Clave</th><th>Valor</th></tr></thead>
            <tbody>{otros.map((i) => <tr key={i.clave}><td style={{ fontSize: 13 }}>{i.clave}</td><td style={{ fontSize: 13 }}>{String(i.valor)}</td></tr>)}</tbody>
          </table>
        </section>
      ) : null}
    </Navbar>
  )
}
