export default function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="card metric">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      {Icon ? <Icon color="#1D9E75" size={26} /> : null}
    </div>
  )
}
