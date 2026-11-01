import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  Inbox,
  Send,
  FileText,
  Trash2,
  Edit3,
  Search,
  LogOut,
  Mail,
  Shield,
  ShieldAlert,
  ChevronDown
} from 'lucide-react'
import ComposeModal from './ComposeModal'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, mailboxes, activeMailboxId, setActiveMailbox, logout } = useAuthStore()

  const [composeOpen, setComposeOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const activeMailbox = mailboxes.find((m) => m.id === activeMailboxId) || mailboxes[0]
  const isAdmin = user?.roles?.includes('admin')

  const navItems = [
    { label: 'Inbox', path: '/inbox', icon: Inbox },
    { label: 'Sent', path: '/sent', icon: Send },
    { label: 'Drafts', path: '/drafts', icon: FileText },
    { label: 'Trash', path: '/trash', icon: Trash2 },
    ...(isAdmin ? [{ label: 'Admin Panel', path: '/admin', icon: Shield }] : [])
  ]

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  return (
    <div className="app-container">
      {/* ─── Sidebar ────────────────────────────────────────────────────── */}
      <aside className="sidebar">
        {/* Brand */}
        <div className="sidebar-logo">
          <img src="https://portal.teamarchon.in/favicon.png" alt="Archon" />
          <span>ARCHON <span>MAIL</span></span>
        </div>

        {/* Compose Button */}
        <button
          className="compose-btn"
          id="btn-compose"
          onClick={() => setComposeOpen(true)}
        >
          <Edit3 size={18} />
          <span>New Message</span>
        </button>

        {/* Nav Items */}
        <nav className="nav-menu">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <button
                key={item.path}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <div className="nav-item-left">
                  <Icon size={18} />
                  <span>{item.label}</span>
                </div>
              </button>
            )
          })}
        </nav>

        {/* Mailbox Selector */}
        <div className="mailbox-selector">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={12} />
              <span>{isAdmin ? 'All Inboxes' : 'Active Mailbox'}</span>
            </div>
            {isAdmin && (
              <span style={{ color: 'var(--accent-red)', fontSize: '9px', background: 'rgba(211, 47, 47, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                ADMIN
              </span>
            )}
          </div>
          {mailboxes.length > 0 ? (
            <select
              value={activeMailbox?.id}
              onChange={(e) => setActiveMailbox(e.target.value)}
            >
              {mailboxes.map((box) => (
                <option key={box.id} value={box.id}>
                  {box.email}
                </option>
              ))}
            </select>
          ) : (
            <div style={{ fontSize: '12px', color: '#666' }}>No mailbox linked</div>
          )}
        </div>

        {/* Footer */}
        <div style={{ fontSize: '10px', color: '#444', textAlign: 'center', marginTop: '16px', letterSpacing: '0.5px' }}>
          TEAM ARCHON MAIL v3.0
        </div>
      </aside>

      {/* ─── Main Wrapper ───────────────────────────────────────────────── */}
      <div className="main-wrapper">
        {/* Topbar */}
        <header className="topbar">
          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="search-bar">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search emails by sender or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>

          {/* User Profile */}
          <div className="user-profile">
            <div className="user-info">
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: isAdmin ? 'rgba(211, 47, 47, 0.2)' : '#222',
                  border: `1px solid ${isAdmin ? 'var(--accent-red)' : '#333'}`,
                  color: isAdmin ? '#ff6b6b' : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '13px'
                }}
              >
                {(user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="user-details">
                <span className="user-name">{user?.displayName || user?.email || 'User'}</span>
                <span className="user-role">
                  {isAdmin ? 'Administrator' : 'Member'}
                </span>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={logout}
              title="Sign Out"
              style={{
                background: '#1a1a1a',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                padding: '8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className="content-area">
          {children}
        </main>
      </div>

      {/* Compose Modal */}
      {composeOpen && (
        <ComposeModal
          mailbox={activeMailbox}
          onClose={() => setComposeOpen(false)}
        />
      )}
    </div>
  )
}
