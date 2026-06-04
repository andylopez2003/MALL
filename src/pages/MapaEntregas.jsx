import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import Navbar from '../components/Navbar.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { supabase } from '../supabase.js'
import { money, statusBadge, todayRange } from '../utils/business.js'

const colors = { pendiente: '#EF9F27', confirmado: '#2F80ED', preparando: '#2F80ED', en_camino: '#2F80ED', entregado: '#1D9E75', cancelado: '#8a9792' }

export default function MapaEntregas() {
  const [pedidos, setPedidos] = useState([])
  const [filtro, setFiltro] = useState('todos')
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { start, end } = todayRange()
      const { data, error: fetchError } = await supabase
        .from('pedidos')
        .select('*, usuarios(nombre, telefono)')
        .gte('created_at', start)
        .lt('created_at', end)
        .order('hora_entrega_asignada')
      if (fetchError) {
        setError(fetchError.message)
        return
      }
      setPedidos(await addCoordinates(data || []))
    }
    load()
  }, [])

  async function addCoordinates(rows) {
    const resolved = []
    for (const pedido of rows) {
      if (pedido.latitud && pedido.longitud) {
        resolved.push(pedido)
        continue
      }
      try {
        const query = `${pedido.direccion_entrega}, Guatemala`
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`)
        const [result] = await response.json()
        resolved.push(result ? { ...pedido, latitud: Number(result.lat), longitud: Number(result.lon) } : pedido)
      } catch {
        resolved.push(pedido)
      }
    }
    return resolved
  }

  const filtered = useMemo(() => pedidos.filter((pedido) => {
    const hour = Number(String(pedido.hora_entrega_asignada || pedido.horario || '').slice(0, 2))
    if (filtro === '13-15') return hour >= 13 && hour < 15
    if (filtro === '17-19') return hour >= 17 && hour < 19
    return true
  }), [pedidos, filtro])

  return (
    <Navbar>
      <PageHeader title="Mapa de entregas" subtitle="Pedidos de hoy ubicados por direccion y coloreados por estado." />
      {error ? <div className="error">{error}</div> : null}
      <div className="toolbar">
        {['todos', '13-15', '17-19'].map((value) => <button key={value} className={filtro === value ? 'btn-primary' : 'btn-outline'} onClick={() => setFiltro(value)}>{value === 'todos' ? 'Todos' : value + 'h'}</button>)}
      </div>
      <div className="map-box">
        <MapContainer center={[14.6349, -90.5069]} zoom={12} style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {filtered.filter((p) => p.latitud && p.longitud).map((pedido) => (
            <CircleMarker key={pedido.id} center={[Number(pedido.latitud), Number(pedido.longitud)]} radius={10} pathOptions={{ color: colors[pedido.estado] || '#8a9792', fillOpacity: 0.9 }}>
              <Popup>
                <strong>{pedido.usuarios?.nombre || 'Cliente'}</strong><br />
                Tel: {pedido.telefono_contacto || pedido.usuarios?.telefono || 'N/D'}<br />
                {pedido.direccion_entrega}<br />
                {money(pedido.monto_total)} - {pedido.hora_entrega_asignada || pedido.horario}<br />
                <span className={statusBadge(pedido.estado)}>{pedido.estado}</span>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      {filtered.some((p) => !p.latitud || !p.longitud) ? <p className="muted" style={{ marginTop: 10 }}>Algunos pedidos no tienen coordenadas y no pudieron geocodificarse.</p> : null}
    </Navbar>
  )
}
