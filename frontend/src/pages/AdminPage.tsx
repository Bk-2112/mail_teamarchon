import React, { useEffect, useState } from 'react'
import {
  Shield,
  Mail,
  Users,
  Plus,
  Trash2,
  Key,
  CheckCircle,
  AlertTriangle,
  Loader2,
  UserCheck,
  Server,
  FolderPlus,
  Layers,
  UserPlus,
  Lock,
  ChevronRight,
  X
} from 'lucide-react'
import apiClient from '../api/client'
import { Mailbox, User as UserType, GroupRecord, GroupDetail } from '../types'

export default function AdminPage() {
  const [tab, setTab] = useState<'mailboxes' | 'users' | 'groups' | 'direct'>('mailboxes')
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([])
  const [users, setUsers] = useState<UserType[]>([])
  const [groups, setGroups] = useState<GroupRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // ─── Modal States ─────────────────────────────────────────────────────────

  // Add mailbox modal
  const [addMailboxModalOpen, setAddMailboxModalOpen] = useState(false)
  const [newMailboxEmail, setNewMailboxEmail] = useState('')
  const [newMailboxDisplayName, setNewMailboxDisplayName] = useState('')
  const [newMailboxPassword, setNewMailboxPassword] = useState('')

  // Add user modal
  const [addUserModalOpen, setAddUserModalOpen] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserDisplayName, setNewUserDisplayName] = useState('')
  const [newUserRole, setNewUserRole] = useState<'member' | 'admin'>('member')

  // Reset password modal
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [targetUser, setTargetUser] = useState<UserType | null>(null)
  const [newResetPassword, setNewResetPassword] = useState('')

  // Add group modal
  const [addGroupModalOpen, setAddGroupModalOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDesc, setNewGroupDesc] = useState('')

  // Manage group modal
  const [manageGroupModalOpen, setManageGroupModalOpen] = useState(false)
  const [selectedGroupDetail, setSelectedGroupDetail] = useState<GroupDetail | null>(null)
  const [groupLoading, setGroupLoading] = useState(false)
  const [addMemberUserId, setAddMemberUserId] = useState('')
  const [addMailboxId, setAddMailboxId] = useState('')

  // Direct assign modal
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedMailboxId, setSelectedMailboxId] = useState('')
  const [selectedRole, setSelectedRole] = useState('member')

  const [submitting, setSubmitting] = useState(false)

  // ─── Data Fetching ────────────────────────────────────────────────────────

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [boxRes, userRes, groupRes] = await Promise.all([
        apiClient.get('/admin/mailboxes'),
        apiClient.get('/admin/users'),
        apiClient.get('/admin/groups')
      ])
      setMailboxes(boxRes.data || [])
      setUsers(userRes.data || [])
      setGroups(groupRes.data || [])
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch administration data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const notifySuccess = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 4000)
  }

  // ─── Mailbox Handlers ─────────────────────────────────────────────────────

  const handleCreateMailbox = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMailboxEmail.trim() || !newMailboxPassword.trim()) return

    setSubmitting(true)
    setError(null)
    try {
      await apiClient.post('/admin/mailboxes', {
        email: newMailboxEmail.trim(),
        displayName: newMailboxDisplayName.trim() || undefined,
        encryptedPassword: newMailboxPassword,
        imapHost: '127.0.0.1',
        imapPort: 993,
        imapSsl: true,
        smtpHost: '127.0.0.1',
        smtpPort: 465,
        smtpSsl: true,
        isActive: true
      })
      notifySuccess(`Mailbox ${newMailboxEmail} provisioned successfully.`)
      setAddMailboxModalOpen(false)
      setNewMailboxEmail('')
      setNewMailboxDisplayName('')
      setNewMailboxPassword('')
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to provision mailbox.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteMailbox = async (id: string, email: string) => {
    if (!confirm(`Are you sure you want to delete mailbox ${email}?`)) return

    try {
      await apiClient.delete(`/admin/mailboxes/${id}`)
      notifySuccess(`Mailbox ${email} deleted.`)
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete mailbox.')
    }
  }

  // ─── User Handlers ────────────────────────────────────────────────────────

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUserEmail.trim() || !newUserPassword.trim()) return

    setSubmitting(true)
    setError(null)
    try {
      await apiClient.post('/admin/users', {
        email: newUserEmail.trim(),
        password: newUserPassword,
        displayName: newUserDisplayName.trim() || undefined,
        role: newUserRole
      })
      notifySuccess(`User ${newUserEmail} created with salted credentials.`)
      setAddUserModalOpen(false)
      setNewUserEmail('')
      setNewUserPassword('')
      setNewUserDisplayName('')
      setNewUserRole('member')
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create user.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetUser || !newResetPassword.trim()) return

    setSubmitting(true)
    setError(null)
    try {
      await apiClient.post(`/admin/users/${targetUser.id}/password`, {
        password: newResetPassword
      })
      notifySuccess(`Password reset for ${targetUser.email}.`)
      setResetModalOpen(false)
      setTargetUser(null)
      setNewResetPassword('')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteUser = async (user: UserType) => {
    if (!confirm(`Delete user ${user.email}? This will revoke their access to all mailboxes.`)) return

    try {
      await apiClient.delete(`/admin/users/${user.id}`)
      notifySuccess(`User ${user.email} removed.`)
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete user.')
    }
  }

  // ─── Group Handlers ───────────────────────────────────────────────────────

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGroupName.trim()) return

    setSubmitting(true)
    setError(null)
    try {
      await apiClient.post('/admin/groups', {
        name: newGroupName.trim(),
        description: newGroupDesc.trim() || undefined
      })
      notifySuccess(`Group ${newGroupName} created.`)
      setAddGroupModalOpen(false)
      setNewGroupName('')
      setNewGroupDesc('')
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create group.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteGroup = async (group: GroupRecord) => {
    if (!confirm(`Delete group "${group.name}"? Members will lose group-assigned mailbox access.`)) return

    try {
      await apiClient.delete(`/admin/groups/${group.id}`)
      notifySuccess(`Group "${group.name}" removed.`)
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete group.')
    }
  }

  const openManageGroup = async (groupId: string) => {
    setGroupLoading(true)
    setManageGroupModalOpen(true)
    try {
      const res = await apiClient.get(`/admin/groups/${groupId}`)
      setSelectedGroupDetail(res.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load group details.')
      setManageGroupModalOpen(false)
    } finally {
      setGroupLoading(false)
    }
  }

  const handleAddMemberToGroup = async () => {
    if (!selectedGroupDetail || !addMemberUserId) return
    try {
      await apiClient.post(`/admin/groups/${selectedGroupDetail.group.id}/members`, {
        userId: addMemberUserId,
        role: 'member'
      })
      setAddMemberUserId('')
      openManageGroup(selectedGroupDetail.group.id)
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add member to group.')
    }
  }

  const handleRemoveMemberFromGroup = async (userId: string) => {
    if (!selectedGroupDetail) return
    try {
      await apiClient.delete(`/admin/groups/${selectedGroupDetail.group.id}/members/${userId}`)
      openManageGroup(selectedGroupDetail.group.id)
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove member.')
    }
  }

  const handleAddMailboxToGroup = async () => {
    if (!selectedGroupDetail || !addMailboxId) return
    try {
      await apiClient.post(`/admin/groups/${selectedGroupDetail.group.id}/mailboxes`, {
        mailboxId: addMailboxId
      })
      setAddMailboxId('')
      openManageGroup(selectedGroupDetail.group.id)
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add mailbox to group.')
    }
  }

  const handleRemoveMailboxFromGroup = async (mailboxId: string) => {
    if (!selectedGroupDetail) return
    try {
      await apiClient.delete(`/admin/groups/${selectedGroupDetail.group.id}/mailboxes/${mailboxId}`)
      openManageGroup(selectedGroupDetail.group.id)
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove mailbox.')
    }
  }

  // ─── Direct Assign Handlers ───────────────────────────────────────────────

  const handleAssignDirect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUserId || !selectedMailboxId) return

    setSubmitting(true)
    try {
      await apiClient.post('/admin/assign', {
        userId: selectedUserId,
        mailboxId: selectedMailboxId,
        role: selectedRole
      })
      notifySuccess('Direct mailbox access assigned.')
      setAssignModalOpen(false)
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to assign mailbox.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{ background: 'rgba(211, 47, 47, 0.15)', padding: '8px', borderRadius: '8px', color: 'var(--accent-red)' }}>
              <Shield size={24} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>
              Administration <span style={{ color: 'var(--accent-red)' }}>Control</span>
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
            Provision organizational mailboxes, manage credentials, and configure group distribution lists.
          </p>
        </div>

        {/* Tab Action Buttons */}
        <div>
          {tab === 'mailboxes' && (
            <button
              onClick={() => setAddMailboxModalOpen(true)}
              style={{
                background: 'var(--accent-red)',
                color: '#fff',
                padding: '10px 18px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Plus size={16} />
              <span>Create Mailbox</span>
            </button>
          )}

          {tab === 'users' && (
            <button
              onClick={() => setAddUserModalOpen(true)}
              style={{
                background: 'var(--accent-red)',
                color: '#fff',
                padding: '10px 18px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <UserPlus size={16} />
              <span>Create User</span>
            </button>
          )}

          {tab === 'groups' && (
            <button
              onClick={() => setAddGroupModalOpen(true)}
              style={{
                background: 'var(--accent-red)',
                color: '#fff',
                padding: '10px 18px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <FolderPlus size={16} />
              <span>Create Group</span>
            </button>
          )}

          {tab === 'direct' && (
            <button
              onClick={() => setAssignModalOpen(true)}
              style={{
                background: 'var(--accent-red)',
                color: '#fff',
                padding: '10px 18px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Key size={16} />
              <span>Grant Direct Access</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Feedback Alerts ──────────────────────────────────────────────── */}
      {successMsg && (
        <div style={{ background: 'rgba(46, 125, 50, 0.15)', border: '1px solid rgba(46, 125, 50, 0.4)', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', color: '#81c784', fontSize: '13px', marginBottom: '20px' }}>
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(211, 47, 47, 0.15)', border: '1px solid rgba(211, 47, 47, 0.4)', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff6b6b', fontSize: '13px', marginBottom: '20px' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* ─── Stats Banner ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>
            Total Inboxes
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800 }}>{mailboxes.length}</div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>
            Registered Users
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800 }}>{users.length}</div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>
            Active Groups
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent-red)' }}>{groups.length}</div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>
            Mail Engine
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#4caf50', marginTop: '6px' }}>Stalwart v1.0.1</div>
        </div>
      </div>

      {/* ─── Navigation Tabs ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px' }}>
        <button
          onClick={() => setTab('mailboxes')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: tab === 'mailboxes' ? '2px solid var(--accent-red)' : '2px solid transparent',
            color: tab === 'mailboxes' ? '#fff' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Mail size={16} />
          <span>Mailboxes ({mailboxes.length})</span>
        </button>

        <button
          onClick={() => setTab('users')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: tab === 'users' ? '2px solid var(--accent-red)' : '2px solid transparent',
            color: tab === 'users' ? '#fff' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Users size={16} />
          <span>Users & Passwords ({users.length})</span>
        </button>

        <button
          onClick={() => setTab('groups')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: tab === 'groups' ? '2px solid var(--accent-red)' : '2px solid transparent',
            color: tab === 'groups' ? '#fff' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Layers size={16} />
          <span>Groups & Teams ({groups.length})</span>
        </button>

        <button
          onClick={() => setTab('direct')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: tab === 'direct' ? '2px solid var(--accent-red)' : '2px solid transparent',
            color: tab === 'direct' ? '#fff' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Key size={16} />
          <span>Direct Access</span>
        </button>
      </div>

      {/* ─── Tab 1: Mailboxes ─────────────────────────────────────────────── */}
      {tab === 'mailboxes' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', background: '#0a0a0a', color: 'var(--text-muted)' }}>
                <th style={{ padding: '14px 20px' }}>Email Address</th>
                <th style={{ padding: '14px 20px' }}>Display Name</th>
                <th style={{ padding: '14px 20px' }}>IMAP (Inbound)</th>
                <th style={{ padding: '14px 20px' }}>SMTP (Outbound)</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Loader2 size={24} className="spin" style={{ margin: '0 auto 8px' }} />
                    Loading mailboxes...
                  </td>
                </tr>
              ) : mailboxes.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No organization inboxes provisioned yet.
                  </td>
                </tr>
              ) : (
                mailboxes.map((box) => (
                  <tr key={box.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <td style={{ padding: '16px 20px', fontWeight: 600 }}>{box.email}</td>
                    <td style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>{box.displayName || '—'}</td>
                    <td style={{ padding: '16px 20px', color: '#aaa' }}>{box.imapHost}:{box.imapPort} (SSL)</td>
                    <td style={{ padding: '16px 20px', color: '#aaa' }}>{box.smtpHost}:{box.smtpPort} (SSL)</td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleDeleteMailbox(box.id, box.email)}
                        style={{ color: '#ff6b6b', padding: '6px', borderRadius: '4px' }}
                        title="Delete Mailbox"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Tab 2: Users & Credentials ───────────────────────────────────── */}
      {tab === 'users' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', background: '#0a0a0a', color: 'var(--text-muted)' }}>
                <th style={{ padding: '14px 20px' }}>User</th>
                <th style={{ padding: '14px 20px' }}>Email Address</th>
                <th style={{ padding: '14px 20px' }}>Role</th>
                <th style={{ padding: '14px 20px' }}>Status</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Loader2 size={24} className="spin" style={{ margin: '0 auto 8px' }} />
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No users registered yet.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isUserAdmin = u.roles?.includes('admin')
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: isUserAdmin ? 'rgba(211, 47, 47, 0.2)' : '#222',
                              border: `1px solid ${isUserAdmin ? 'var(--accent-red)' : '#333'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '12px',
                              color: isUserAdmin ? '#ff6b6b' : '#fff'
                            }}
                          >
                            {(u.displayName || u.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{u.displayName || u.email.split('@')[0]}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Created {new Date(u.createdAt).toLocaleDateString()}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', color: '#fff' }}>{u.email}</td>
                      <td style={{ padding: '16px 20px' }}>
                        <span
                          style={{
                            background: isUserAdmin ? 'rgba(211, 47, 47, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                            color: isUserAdmin ? '#ff6b6b' : '#aaa',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700
                          }}
                        >
                          {isUserAdmin ? 'ADMIN' : 'MEMBER'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{ color: '#4caf50', fontSize: '12px' }}>● Active</span>
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          <button
                            onClick={() => {
                              setTargetUser(u)
                              setResetModalOpen(true)
                            }}
                            style={{
                              background: '#1a1a1a',
                              border: '1px solid #333',
                              color: '#ddd',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                            title="Reset Password"
                          >
                            <Key size={14} />
                            <span>Password</span>
                          </button>
                          {u.email !== 'admin@teamarchon.in' && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              style={{ color: '#ff6b6b', padding: '6px' }}
                              title="Delete Account"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Tab 3: Groups & Teams ────────────────────────────────────────── */}
      {tab === 'groups' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {loading ? (
            <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 size={24} className="spin" style={{ margin: '0 auto 8px' }} />
              Loading mail groups...
            </div>
          ) : groups.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              No distribution groups created yet. Click "Create Group" to bundle mailboxes and users.
            </div>
          ) : (
            groups.map((group) => (
              <div
                key={group.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Layers size={18} style={{ color: 'var(--accent-red)' }} />
                      <h3 style={{ fontSize: '17px', margin: 0, fontWeight: 700 }}>{group.name}</h3>
                    </div>
                    <button
                      onClick={() => handleDeleteGroup(group)}
                      style={{ color: '#ff6b6b', padding: '4px' }}
                      title="Delete Group"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 16px 0', lineHeight: 1.4 }}>
                    {group.description || 'No description provided.'}
                  </p>

                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#aaa', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Users size={14} />
                      <span>{group.memberCount} Members</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={14} />
                      <span>{group.mailboxCount} Mailboxes</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => openManageGroup(group.id)}
                  style={{
                    background: '#1a1a1a',
                    border: '1px solid #2a2a2a',
                    color: '#fff',
                    padding: '10px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    width: '100%'
                  }}
                >
                  <span>Manage Group</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── Tab 4: Direct Access ─────────────────────────────────────────── */}
      {tab === 'direct' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Direct User-to-Mailbox Access</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
            Explicitly assign individual users to mailboxes outside of group distribution lists.
          </p>
          <button
            onClick={() => setAssignModalOpen(true)}
            style={{
              background: 'var(--accent-red)',
              color: '#fff',
              padding: '10px 18px',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '13px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Key size={16} />
            <span>Grant Direct Access</span>
          </button>
        </div>
      )}

      {/* ─── Modal 1: Create Mailbox ──────────────────────────────────────── */}
      {addMailboxModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div style={{ background: '#121212', border: '1px solid var(--border-color)', borderRadius: '14px', width: '100%', maxWidth: '480px', padding: '28px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>Provision New Mailbox</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
              Creates an organization inbox routing via local Stalwart loopback.
            </p>
            <form onSubmit={handleCreateMailbox} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="support@teamarchon.in"
                  value={newMailboxEmail}
                  onChange={(e) => setNewMailboxEmail(e.target.value)}
                  style={{ width: '100%', background: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Display Name</label>
                <input
                  type="text"
                  placeholder="Team Archon Support"
                  value={newMailboxDisplayName}
                  onChange={(e) => setNewMailboxDisplayName(e.target.value)}
                  style={{ width: '100%', background: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Mailbox Password (Stalwart)</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={newMailboxPassword}
                  onChange={(e) => setNewMailboxPassword(e.target.value)}
                  style={{ width: '100%', background: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setAddMailboxModalOpen(false)}
                  style={{ padding: '10px 16px', background: '#1a1a1a', color: '#aaa', borderRadius: '8px', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: '10px 18px', background: 'var(--accent-red)', color: '#fff', borderRadius: '8px', fontWeight: 700, fontSize: '13px' }}
                >
                  {submitting ? 'Provisioning...' : 'Provision Mailbox'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal 2: Create User (Credentials) ───────────────────────────── */}
      {addUserModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div style={{ background: '#121212', border: '1px solid var(--border-color)', borderRadius: '14px', width: '100%', maxWidth: '480px', padding: '28px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>Create User Account</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
              Credentials are cryptographically salted and hashed with PBKDF2 before storage.
            </p>
            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Login Email</label>
                <input
                  type="email"
                  required
                  placeholder="employee@teamarchon.in"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  style={{ width: '100%', background: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Full Name / Display Name</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={newUserDisplayName}
                  onChange={(e) => setNewUserDisplayName(e.target.value)}
                  style={{ width: '100%', background: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Initial Password</label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  style={{ width: '100%', background: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Role</label>
                <select
                  value={newUserRole}
                  onChange={(e: any) => setNewUserRole(e.target.value)}
                  style={{ width: '100%', background: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '13px' }}
                >
                  <option value="member">Member (Access assigned mailboxes/groups)</option>
                  <option value="admin">Administrator (Company-wide access & Admin Panel)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setAddUserModalOpen(false)}
                  style={{ padding: '10px 16px', background: '#1a1a1a', color: '#aaa', borderRadius: '8px', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: '10px 18px', background: 'var(--accent-red)', color: '#fff', borderRadius: '8px', fontWeight: 700, fontSize: '13px' }}
                >
                  {submitting ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal 3: Reset Password ──────────────────────────────────────── */}
      {resetModalOpen && targetUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div style={{ background: '#121212', border: '1px solid var(--border-color)', borderRadius: '14px', width: '100%', maxWidth: '440px', padding: '28px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>Reset Password</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '18px' }}>
              Setting new salted password for <strong style={{ color: '#fff' }}>{targetUser.email}</strong>.
            </p>
            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>New Password</label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  value={newResetPassword}
                  onChange={(e) => setNewResetPassword(e.target.value)}
                  style={{ width: '100%', background: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setResetModalOpen(false)}
                  style={{ padding: '10px 16px', background: '#1a1a1a', color: '#aaa', borderRadius: '8px', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: '10px 18px', background: 'var(--accent-red)', color: '#fff', borderRadius: '8px', fontWeight: 700, fontSize: '13px' }}
                >
                  {submitting ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal 4: Create Group ────────────────────────────────────────── */}
      {addGroupModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div style={{ background: '#121212', border: '1px solid var(--border-color)', borderRadius: '14px', width: '100%', maxWidth: '480px', padding: '28px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>Create Distribution Group</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
              Bundle users into a group to grant collective access to organization mailboxes.
            </p>
            <form onSubmit={handleCreateGroup} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Group Name</label>
                <input
                  type="text"
                  required
                  placeholder="Development Team"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  style={{ width: '100%', background: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Description</label>
                <textarea
                  rows={3}
                  placeholder="Core engineering and infrastructure contributors"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  style={{ width: '100%', background: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '13px', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setAddGroupModalOpen(false)}
                  style={{ padding: '10px 16px', background: '#1a1a1a', color: '#aaa', borderRadius: '8px', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: '10px 18px', background: 'var(--accent-red)', color: '#fff', borderRadius: '8px', fontWeight: 700, fontSize: '13px' }}
                >
                  {submitting ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal 5: Manage Group (Members & Mailboxes) ─────────────────── */}
      {manageGroupModalOpen && selectedGroupDetail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div style={{ background: '#121212', border: '1px solid var(--border-color)', borderRadius: '14px', width: '100%', maxWidth: '640px', maxHeight: '85vh', overflowY: 'auto', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>{selectedGroupDetail.group.name}</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0' }}>{selectedGroupDetail.group.description || 'Manage members and linked mailboxes.'}</p>
              </div>
              <button onClick={() => setManageGroupModalOpen(false)} style={{ color: '#888' }}>
                <X size={20} />
              </button>
            </div>

            {/* Section A: Linked Mailboxes */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-red)', marginBottom: '10px' }}>
                Linked Mailboxes ({selectedGroupDetail.mailboxes.length})
              </div>
              <div style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: '8px', padding: '12px', marginBottom: '10px' }}>
                {selectedGroupDetail.mailboxes.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No mailboxes linked to this group yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedGroupDetail.mailboxes.map((mb) => (
                      <div key={mb.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#151515', padding: '8px 12px', borderRadius: '6px', fontSize: '13px' }}>
                        <span>{mb.email}</span>
                        <button onClick={() => handleRemoveMailboxFromGroup(mb.id)} style={{ color: '#ff6b6b' }} title="Remove Mailbox">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Add mailbox to group */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={addMailboxId}
                  onChange={(e) => setAddMailboxId(e.target.value)}
                  style={{ flex: 1, background: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '13px' }}
                >
                  <option value="">Select mailbox to link...</option>
                  {mailboxes.map((mb) => (
                    <option key={mb.id} value={mb.id}>{mb.email}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddMailboxToGroup}
                  style={{ background: '#1f1f1f', border: '1px solid #333', color: '#fff', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}
                >
                  Link Mailbox
                </button>
              </div>
            </div>

            {/* Section B: Group Members */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-red)', marginBottom: '10px' }}>
                Group Members ({selectedGroupDetail.members.length})
              </div>
              <div style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: '8px', padding: '12px', marginBottom: '10px' }}>
                {selectedGroupDetail.members.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No members in this group yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedGroupDetail.members.map((mem) => (
                      <div key={mem.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#151515', padding: '8px 12px', borderRadius: '6px', fontSize: '13px' }}>
                        <div>
                          <span style={{ fontWeight: 600 }}>{mem.displayName || mem.email.split('@')[0]}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: '8px' }}>({mem.email})</span>
                        </div>
                        <button onClick={() => handleRemoveMemberFromGroup(mem.id)} style={{ color: '#ff6b6b' }} title="Remove Member">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Add member to group */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={addMemberUserId}
                  onChange={(e) => setAddMemberUserId(e.target.value)}
                  style={{ flex: 1, background: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '13px' }}
                >
                  <option value="">Select user to add...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.email} ({u.displayName || 'No Name'})</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddMemberToGroup}
                  style={{ background: '#1f1f1f', border: '1px solid #333', color: '#fff', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}
                >
                  Add Member
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal 6: Direct Access Assignment ────────────────────────────── */}
      {assignModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div style={{ background: '#121212', border: '1px solid var(--border-color)', borderRadius: '14px', width: '100%', maxWidth: '480px', padding: '28px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>Assign Mailbox Access</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
              Assign individual mailbox permissions to a specific user.
            </p>
            <form onSubmit={handleAssignDirect} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Select User</label>
                <select
                  required
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  style={{ width: '100%', background: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '13px' }}
                >
                  <option value="">Select user...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.email} ({u.displayName || 'User'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Select Mailbox</label>
                <select
                  required
                  value={selectedMailboxId}
                  onChange={(e) => setSelectedMailboxId(e.target.value)}
                  style={{ width: '100%', background: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '13px' }}
                >
                  <option value="">Select mailbox...</option>
                  {mailboxes.map((m) => (
                    <option key={m.id} value={m.id}>{m.email}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Access Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  style={{ width: '100%', background: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '13px' }}
                >
                  <option value="owner">Owner (Full Read, Write & Send Access)</option>
                  <option value="member">Member (Read & Send Access)</option>
                  <option value="read_only">Read-Only (View Only)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  style={{ padding: '10px 16px', background: '#1a1a1a', color: '#aaa', borderRadius: '8px', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: '10px 18px', background: 'var(--accent-red)', color: '#fff', borderRadius: '8px', fontWeight: 700, fontSize: '13px' }}
                >
                  {submitting ? 'Granting...' : 'Grant Access'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
