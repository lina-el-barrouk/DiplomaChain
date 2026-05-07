import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { adminApi } from '../../api'
import { Users, Building2, GraduationCap, ScrollText, CheckCircle, Link, Eye } from 'lucide-react'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.getStats()
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const statCards = stats ? [
    { label: 'Utilisateurs', value: stats.total_users, icon: Users, color: 'var(--info)', bg: 'rgba(37,99,235,0.06)' },
    { label: 'Institutions', value: stats.total_institutions, sub: `${stats.approved_institutions} approuvées`, icon: Building2, color: '#6d28d9', bg: 'rgba(109,40,217,0.06)' },
    { label: 'Diplômes émis', value: stats.issued_diplomas, sub: `${stats.revoked_diplomas} révoqués`, icon: ScrollText, color: 'var(--primary)', bg: 'var(--green-50)', gold: true },
    { label: 'Sur blockchain', value: stats.blockchain_anchored, icon: Link, color: 'var(--success)', bg: 'rgba(22,163,74,0.06)' },
    { label: 'Vérifications', value: stats.total_verifications, sub: `${stats.verifications_today} aujourd'hui`, icon: Eye, color: 'var(--warning)', bg: 'rgba(217,119,6,0.06)' },
    { label: 'En attente', value: stats.pending_institutions, sub: 'institutions à approuver', icon: CheckCircle, color: 'var(--danger)', bg: 'rgba(220,38,38,0.06)' },
  ] : []

  return (
    <Layout>
      <div className="page-header">
        <h1 className="page-title">Tableau de bord</h1>
        <p className="page-subtitle">Vue d'ensemble de la plateforme DiplomaChain</p>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-3)', padding: '40px 0' }}>Chargement des statistiques...</div>
      ) : (
        <div className="stats-grid fade-in">
          {statCards.map((s, i) => (
            <div key={i} className={`stat-card ${s.gold ? 'gold' : ''}`}>
              <div className="stat-icon" style={{ background: s.bg }}>
                <s.icon size={18} style={{ color: s.color }} />
              </div>
              <div className="stat-value">{s.value ?? '—'}</div>
              <div className="stat-label">{s.label}</div>
              {s.sub && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.sub}</div>}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 8 }}>
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--text-1)' }}>Accès rapides</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Approuver des institutions', path: '/admin/institutions', icon: Building2 },
              { label: 'Valider des étudiants', path: '/admin/students', icon: GraduationCap },
              { label: 'Gérer les utilisateurs', path: '/admin/users', icon: Users },
              { label: 'Voir les logs d\'audit', path: '/admin/audit', icon: ScrollText },
            ].map(l => (
              <a key={l.path} href={l.path} style={{ fontSize: 14, color: 'var(--text-2)', textDecoration: 'none', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-3)', display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.2s' }}>
                <l.icon size={16} style={{ color: 'var(--primary)' }} />
                {l.label}
              </a>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--text-1)' }}>État du système</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'API Backend', ok: true },
              { label: 'Base de données MySQL', ok: true },
              { label: 'Hedera Hashgraph', ok: true, sub: 'testnet' },
              { label: 'Redis / Celery', ok: false, sub: 'mode mémoire' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{s.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {s.sub && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.sub}</span>}
                  <span style={{ fontSize: 12, color: s.ok ? 'var(--success)' : 'var(--warning)', fontWeight: 500 }}>
                    {s.ok ? 'Actif' : 'Partiel'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}
