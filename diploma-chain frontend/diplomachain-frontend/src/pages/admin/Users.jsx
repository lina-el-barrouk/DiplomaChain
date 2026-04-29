import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { adminApi } from '../../api'
import { Users, Lock, Unlock, UserX, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const params = roleFilter ? { role: roleFilter } : {}
      const { data } = await adminApi.listUsers(params)
      setUsers(data)
    } catch { toast.error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [roleFilter])

  const toggle = async (id, active) => {
    try {
      await adminApi.toggleUser(id, !active)
      toast.success(`Compte ${!active ? 'activé' : 'désactivé'}`)
      load()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erreur') }
  }

  const unlock = async (id) => {
    try {
      await adminApi.unlockUser(id)
      toast.success('Compte déverrouillé')
      load()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erreur') }
  }

  const roleColors = {
    admin: 'badge-gold',
    institution: 'badge-info',
    student: 'badge-success',
  }

  return (
    <Layout>
      <div className="page-header">
        <h1 className="page-title">Utilisateurs</h1>
        <p className="page-subtitle">Gérez tous les comptes de la plateforme</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['', 'admin', 'institution', 'student'].map(r => (
          <button
            key={r}
            className={`btn btn-sm ${roleFilter === r ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setRoleFilter(r)}
          >{r || 'Tous'}</button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Chargement...</div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <Users size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <h3>Aucun utilisateur</h3>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Rôle</th>
                <th>Statut</th>
                <th>Dernière connexion</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ color: 'var(--text-1)', fontWeight: 500 }}>{u.email}</td>
                  <td><span className={`badge ${roleColors[u.role] || 'badge-muted'}`}>{u.role}</span></td>
                  <td>
                    <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                      {u.is_active ? '● Actif' : '● Inactif'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {u.last_login ? new Date(u.last_login).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {u.role !== 'admin' && (
                        <button
                          className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}`}
                          onClick={() => toggle(u.id, u.is_active)}
                        >
                          {u.is_active ? <><UserX size={13} /> Désactiver</> : <><UserCheck size={13} /> Activer</>}
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => unlock(u.id)}>
                        <Unlock size={13} /> Déverr.
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  )
}
