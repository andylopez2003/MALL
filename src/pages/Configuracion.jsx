import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { supabase } from '../supabase.js'

const LABELS = {
  monto_minimo_domicilio: { label: 'Monto mínimo para domicilio',     desc: 'Compra mínima para aceptar pedidos a domicilio', unit: 'Q', group: 'Domicilio' },
  dias_vencimiento_cupon: { label: 'Días de vigencia del cupón',      desc: 'Cuántos días es válido el cupón después de emitirse', unit: 'días', group: 'Cupones' },
  max_pedidos_manana:     { label: 'Máx. pedidos jornada mañana',     desc: 'Límite de pedidos 13:00–15:00', unit: 'pedidos', group: 'Horarios' },
  max_pedidos_tarde:      { label: 'Máx. pedidos jornada tarde',      desc: 'Límite de pedidos 17:00–19:00', unit: 'pedidos', group: 'Horarios' },
  monto_minimo_puntos:    { label: 'Compra mínima para ganar puntos', desc: 'Monto mínimo de compra en tienda para acumular puntos', unit: 'Q', group: 'Puntos' },
  puntos_por_100:         { label: 'Puntos por cada Q100 de compra',  desc: 'Cuántos puntos gana el cliente por cada Q100 gastados en tienda', unit: 'puntos', group: 'Puntos' },
  valor_punto:            { label: 'Valor de cada punto',             desc: 'A cuántos quetzales equivale 1 punto al canjear', unit: 'Q', group: 'Puntos' },
}

const GROUP_ORDER = ['Domicilio', 'Cupones', 'Puntos', 'Horarios']

// ── Editor de niveles (tabla de umbrales) ──────────────────────────────────
function NivelesEditor({ title, desc, clave, placeholder1, placeholder2, label1, label2, initialValue, onSave }) {
  const parseNiveles = (v) => {
    try {
      const arr = typeof v === 'string' ? JSON.parse(v) : v
      if (Array.isArray(arr) && arr.length > 0) {
        return arr.map((entry) => Array.isArray(entry) ? { monto: entry[0], valor: entry[1] } : entry)
      }
    } catch (_) {}
    return []
  }

  const [niveles, setNiveles] = useState(() => parseNiveles(initialValue))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  function agregar() {
    setNiveles((prev) => [...prev, { monto: '', valor: '' }])
  }

  function quitar(idx) {
    setNiveles((prev) => prev.filter((_, i) => i !== idx))
  }

  function cambiar(idx, campo, val) {
    setNiveles((prev) => prev.map((n, i) => i === idx ? { ...n, [campo]: val } : n))
  }

  async function guardar() {
    const clean = niveles
      .filter((n) => n.monto !== '' && n.valor !== '')
      .map((n) => [Number(n.monto), Number(n.valor)])
      .sort((a, b) => a[0] - b[0])

    if (clean.length === 0) { setMsg('Agrega al menos un nivel.'); return }

    setSaving(true)
    await supabase.from('configuracion').upsert({ clave, valor: JSON.stringify(clean) }, { onConflict: 'clave' })
    setSaving(false)
    setMsg('Guardado.')
    onSave?.()
    window.setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div style={{ border: '1.5px solid var(--mall-line)', borderRadius: 10, padding: '14px 16px', display: 'grid', gap: 12 }}>
      <div>
        <strong style={{ fontSize: 14 }}>{title}</strong>
        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{desc}</div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {/* Cabecera */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, fontSize: 12, fontWeight: 700, color: 'var(--mall-muted)', padding: '0 4px' }}>
          <span>{label1}</span><span>{label2}</span><span />
        </div>

        {niveles.map((n, idx) => (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
            <input className="input-field" type="number" min="0" placeholder={placeholder1} value={n.monto}
              onChange={(e) => cambiar(idx, 'monto', e.target.value)} style={{ minHeight: 34, padding: '6px 10px' }} />
            <input className="input-field" type="number" min="0" placeholder={placeholder2} value={n.valor}
              onChange={(e) => cambiar(idx, 'valor', e.target.value)} style={{ minHeight: 34, padding: '6px 10px' }} />
            <button type="button" onClick={() => quitar(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d94b4b', padding: 4 }}><Trash2 size={16} /></button>
          </div>
        ))}

        <button type="button" className="btn-outline" style={{ fontSize: 12, padding: '6px 12px', justifyContent: 'center' }} onClick={agregar}>
          <Plus size={14} /> Agregar nivel
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" className="btn-primary" style={{ fontSize: 13, padding: '6px 16px' }} onClick={guardar} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar niveles'}
        </button>
        {msg ? <span style={{ fontSize: 13, color: 'var(--mall-main)' }}>{msg}</span> : null}
      </div>
    </div>
  )
}

// ── Vista previa escala de puntos ──────────────────────────────────────────
function EscalaPuntos({ montoMinimo, puntosPor100 }) {
  const min = Number(montoMinimo || 100)
  const pts = Number(puntosPor100 || 10)
  const filas = [1, 2, 3, 4, 5].map((n) => ({ monto: min * n, puntos: pts * n }))
  return (
    <div style={{ border: '1px solid #e5e9e6', borderRadius: 8, overflow: 'hidden', fontSize: 13 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, background: '#f7f9f7', padding: '6px 14px', fontWeight: 700, fontSize: 11, color: 'var(--mall-muted)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e5e9e6' }}>
        <span>Compra desde</span><span style={{ textAlign: 'right' }}>Puntos que gana</span>
      </div>
      {filas.map((f) => (
        <div key={f.monto} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '7px 14px', borderBottom: '1px solid #f0f2f0' }}>
          <span>Q{f.monto}</span>
          <span style={{ textAlign: 'right', fontWeight: 700, color: 'var(--mall-main)' }}>{f.puntos} puntos</span>
        </div>
      ))}
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────
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
    else if (!['slots_entrega', 'monto_cupon_domicilio', 'valor_cupon_domicilio', 'umbrales_cupones_domicilio'].includes(item.clave)) otros.push(item)
  })

  const getVal = (clave, def = '') => {
    const item = items.find((i) => i.clave === clave)
    return item ? item.valor : def
  }

  return (
    <Navbar>
      <PageHeader title="Configuración" subtitle="Ajusta cupones, puntos, horarios y niveles del sistema." />
      {msg ? <div className="card" style={{ marginBottom: 16, background: '#dff7ed', color: '#0f6e56' }}>{msg}</div> : null}

      {GROUP_ORDER.map((group) => {
        const rows = grouped[group]
        const hasRows = rows && rows.length > 0

        return (
          <section key={group} className="card" style={{ marginBottom: 16 }}>
            <h2 className="font-display" style={{ margin: '0 0 14px', fontSize: 18 }}>{group}</h2>
            <div style={{ display: 'grid', gap: 14 }}>

              {/* Campos numéricos simples */}
              {hasRows ? rows.map((item) => {
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
                          <button className="btn-outline" style={{ padding: '5px 12px', minHeight: 32, fontSize: 12 }} onClick={() => startEdit(item)}>Editar</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                          <input className="input-field" style={{ width: 90, minHeight: 34, padding: '6px 10px', fontSize: 14 }} value={valorEdit} onChange={(e) => setValorEdit(e.target.value)} autoFocus />
                          <button className="btn-primary" style={{ padding: '5px 12px', minHeight: 34, fontSize: 12 }} onClick={() => guardar(item.clave)} disabled={saving}>{saving ? '...' : 'OK'}</button>
                          <button className="btn-outline" style={{ padding: '5px 10px', minHeight: 34, fontSize: 12 }} onClick={() => setEditando(null)}>✕</button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              }) : null}

              {/* Escala de puntos (preview) */}
              {group === 'Puntos' ? (
                <div style={{ paddingBottom: 4 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Escala de puntos (basada en configuración)</div>
                  <EscalaPuntos montoMinimo={getVal('monto_minimo_puntos', 100)} puntosPor100={getVal('puntos_por_100', 10)} />
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    La escala se calcula automáticamente: por cada Q{String(getVal('monto_minimo_puntos', 100))} o fracción de Q100 el cliente gana {String(getVal('puntos_por_100', 10))} puntos adicionales.
                  </div>
                </div>
              ) : null}

              {/* Editor de niveles de cupones */}
              {group === 'Cupones' ? (
                <NivelesEditor
                  title="Niveles de cupones por domicilio"
                  desc="Define a partir de qué monto se genera cada cupón. Ej: Q150→Q10, Q300→Q20, Q450→Q30. Se aplica el nivel más alto alcanzado."
                  clave="umbrales_cupones_domicilio"
                  label1="Compra desde (Q)"
                  label2="Valor del cupón (Q)"
                  placeholder1="Ej: 150"
                  placeholder2="Ej: 10"
                  initialValue={getVal('umbrales_cupones_domicilio', '[[150,10],[300,20],[450,30]]')}
                  onSave={load}
                />
              ) : null}
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
