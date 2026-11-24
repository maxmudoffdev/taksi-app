import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import FullScreenLoader from './components/FullScreenLoader'
import ProtectedRoute from './components/ProtectedRoute'
import AdminDashboard from './pages/admin/AdminDashboard'
import EmailLoginPage from './pages/auth/EmailLoginPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import DispatcherDashboard from './pages/dispatcher/DispatcherDashboard'
import DriverDashboard from './pages/driver/DriverDashboard'
import HistoryPage from './pages/history/HistoryPage'
import WalletPage from './pages/wallet/WalletPage'
import PassengerDashboard from './pages/passenger/PassengerDashboard'
import StatusPage from './pages/StatusPage'
import { dashboardPath } from './services/auth'
import { useAuthStore } from './store/authStore'
import { useOrderStore } from './store/orderStore'
import { useWalletStore } from './store/walletStore'

function HomeRedirect() {
  const { profile, session, loading } = useAuthStore()
  if (loading) return <FullScreenLoader />
  if (session && profile) return <Navigate to={dashboardPath[profile.role]} replace />
  return <Navigate to="/login" replace />
}

export default function App() {
  const init = useAuthStore((s) => s.init)
  useEffect(() => init(), [init])

  // Tizimga kirganda real-time serverga ulanish, chiqqanda uzish
  const userId = useAuthStore((s) => s.session?.user.id)
  const role = useAuthStore((s) => s.profile?.role)
  const { connect, disconnect } = useOrderStore()
  useEffect(() => {
    if (!userId || !role) return
    connect(role)
    // Haydovchi: balans va ball jonli yangilanishi
    const unbindWallet = role === 'driver' ? useWalletStore.getState().bind() : undefined
    return () => {
      unbindWallet?.()
      useWalletStore.setState({ standing: null, details: null })
      disconnect()
    }
  }, [userId, role, connect, disconnect])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/login/email" element={<EmailLoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/history" element={<ProtectedRoute role={['passenger', 'driver']}><HistoryPage /></ProtectedRoute>} />
        <Route path="/wallet" element={<ProtectedRoute role="driver"><WalletPage /></ProtectedRoute>} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/passenger" element={<ProtectedRoute role="passenger"><PassengerDashboard /></ProtectedRoute>} />
        <Route path="/driver" element={<ProtectedRoute role="driver"><DriverDashboard /></ProtectedRoute>} />
        <Route
          path="/dispatcher"
          element={<ProtectedRoute role={['dispatcher', 'admin']}><DispatcherDashboard /></ProtectedRoute>}
        />
        <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
