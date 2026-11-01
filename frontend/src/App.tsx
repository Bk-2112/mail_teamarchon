import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import LoginPage from './pages/LoginPage'
import InboxPage from './pages/InboxPage'
import ThreadPage from './pages/ThreadPage'
import AdminPage from './pages/AdminPage'
import Layout from './components/Layout'

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = useAuthStore((state) => state.token)
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return children
}

export default function App() {
  const token = useAuthStore((state) => state.token)

  return (
    <BrowserRouter>
      <Routes>
        {/* Unauthenticated Route */}
        <Route path="/login" element={token ? <Navigate to="/inbox" replace /> : <LoginPage />} />

        {/* Authenticated Routes wrapped in Layout */}
        <Route path="/inbox" element={<RequireAuth><Layout><InboxPage /></Layout></RequireAuth>} />
        <Route path="/sent" element={<RequireAuth><Layout><InboxPage /></Layout></RequireAuth>} />
        <Route path="/drafts" element={<RequireAuth><Layout><InboxPage /></Layout></RequireAuth>} />
        <Route path="/trash" element={<RequireAuth><Layout><InboxPage /></Layout></RequireAuth>} />
        <Route path="/thread/:id" element={<RequireAuth><Layout><ThreadPage /></Layout></RequireAuth>} />
        <Route path="/admin" element={<RequireAuth><Layout><AdminPage /></Layout></RequireAuth>} />

        {/* Root Fallback */}
        <Route path="/" element={<Navigate to={token ? "/inbox" : "/login"} replace />} />
        <Route path="*" element={<Navigate to={token ? "/inbox" : "/login"} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
