export function calcularPuntos(monto) {
  return Math.floor(Number(monto || 0) / 100) * 10
}

export function money(value) {
  return `Q${Number(value || 0).toFixed(2)}`
}

export function todayRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

export function dateInputValue(date) {
  return date.toISOString().slice(0, 10)
}

export function groupByDate(rows, dateKey, valueKey) {
  return rows.reduce((acc, row) => {
    const date = String(row[dateKey] || row.created_at || '').slice(0, 10)
    if (!date) return acc
    acc[date] = (acc[date] || 0) + Number(row[valueKey] || 0)
    return acc
  }, {})
}

export function statusBadge(status) {
  const map = {
    pendiente: 'badge-yellow',
    confirmado: 'badge-blue',
    preparando: 'badge-blue',
    en_camino: 'badge-blue',
    entregado: 'badge-green',
    cancelado: 'badge-gray',
    activo: 'badge-green',
    canjeado: 'badge-gray',
    vencido: 'badge-red',
  }
  return map[status] || 'badge-gray'
}
