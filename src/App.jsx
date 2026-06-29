import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Students from './pages/Students'
import Instructors from './pages/Instructors'
import Syllabi from './pages/Syllabi'
import Schedule from './pages/Schedule'
import Logbook from './pages/Logbook'
import Billing from './pages/Billing'
import GroundSchedule from './pages/GroundSchedule'
import Documents from './pages/Documents'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard"   element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/students"    element={<ProtectedRoute adminOnly><Students /></ProtectedRoute>} />
          <Route path="/instructors" element={<ProtectedRoute adminOnly><Instructors /></ProtectedRoute>} />
          <Route path="/syllabi"     element={<ProtectedRoute><Syllabi /></ProtectedRoute>} />
          <Route path="/schedule"    element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
          <Route path="/logbook"     element={<ProtectedRoute><Logbook /></ProtectedRoute>} />
          <Route path="/billing"     element={<ProtectedRoute><Billing /></ProtectedRoute>} />
          <Route path="/ground-schedule" element={<GroundSchedule />} />
          <Route path="/documents"     element={<ProtectedRoute><Documents /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
