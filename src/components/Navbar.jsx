import { NavLink } from 'react-router-dom'
import { BarChart3, Bike, Boxes, ClipboardList, Gift, Home, LogOut, Map, Percent, QrCode, Settings, Users, WalletCards } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.jsx'

const links = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/registrar-compra', label: 'Compra', icon: ClipboardList },
  { to: '/canjear-puntos', label: 'Puntos', icon: WalletCards },
  { to: '/canjear-cupon', label: 'Cupon', icon: QrCode },
  { to: '/productos', label: 'Productos', icon: Boxes },
  { to: '/ofertas', label: 'Ofertas', icon: Percent },
  { to: '/pedidos', label: 'Pedidos', icon: Bike },
  { to: '/mapa', label: 'Mapa', icon: Map },
  { to: '/reportes', label: 'Reportes', icon: BarChart3 },
  { to: '/configuracion', label: 'Config', icon: Settings },
]

export default function Navbar({ children }) {
  const { logout } = useAuth()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">M</span>MALL</div>
        <nav className="nav-list">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
        <button className="logout" onClick={logout}><LogOut size={16} /> Salir</button>
      </aside>
      <main className="content">{children}</main>
      <nav className="bottom-nav">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon size={20} /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
