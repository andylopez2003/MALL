import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Clientes from './pages/Clientes.jsx'
import RegistrarCompra from './pages/RegistrarCompra.jsx'
import CanjearPuntos from './pages/CanjearPuntos.jsx'
import CanjearCupon from './pages/CanjearCupon.jsx'
import Productos from './pages/Productos.jsx'
import Ofertas from './pages/Ofertas.jsx'
import Pedidos from './pages/Pedidos.jsx'
import Configuracion from './pages/Configuracion.jsx'
import MapaEntregas from './pages/MapaEntregas.jsx'
import Reportes from './pages/Reportes.jsx'

function ProtectedRoute({ children }) {
  const { user, loading, authError } = useAuth()

  if (loading) return <div className="screen-center">Cargando sesion...</div>
  if (authError) return <Navigate to="/login" replace />
  if (!user) return <Navigate to="/login" replace />

  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
        <Route path="/registrar-compra" element={<ProtectedRoute><RegistrarCompra /></ProtectedRoute>} />
        <Route path="/canjear-puntos" element={<ProtectedRoute><CanjearPuntos /></ProtectedRoute>} />
        <Route path="/canjear-cupon" element={<ProtectedRoute><CanjearCupon /></ProtectedRoute>} />
        <Route path="/productos" element={<ProtectedRoute><Productos /></ProtectedRoute>} />
        <Route path="/ofertas" element={<ProtectedRoute><Ofertas /></ProtectedRoute>} />
        <Route path="/pedidos" element={<ProtectedRoute><Pedidos /></ProtectedRoute>} />
        <Route path="/configuracion" element={<ProtectedRoute><Configuracion /></ProtectedRoute>} />
        <Route path="/mapa" element={<ProtectedRoute><MapaEntregas /></ProtectedRoute>} />
        <Route path="/reportes" element={<ProtectedRoute><Reportes /></ProtectedRoute>} />
      </Routes>
    </AuthProvider>
  )
}
