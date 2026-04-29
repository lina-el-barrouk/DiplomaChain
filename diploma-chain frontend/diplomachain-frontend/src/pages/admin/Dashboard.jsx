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
    { label: 'Utilisateurs', value: stats.total_users, icon: Users, color: '#3498db', bg: 'rgba(52,152,219,0.1)' },
    { label: 'Institutions', value: stats.total_institutions, sub: `${stats.approved_institutions} approuvées`, icon: Building2, color: '#9b59b6', bg: 'rgba(155,89,182,0.1)' },
    { label: 'Diplômes émis', value: stats.issued_diplomas, sub: `${stats.revoked_diplomas} révoqués`, icon: ScrollText, color: '#c9a84c', bg: 'rgba(201,168,76,0.1)', gold: true },
    { label: 'Sur blockchain', value: stats.blockchain_anchored, icon: Link, color: '#2ecc71', bg: 'rgba(46,204,113,0.1)' },
    { label: 'Vérifications', value: stats.total_verifications, sub: `${stats.verifications_today} aujourd'hui`, icon: Eye, color: '#e67e22', bg: 'rgba(230,126,34,0.1)' },
    { label: 'En attente', value: stats.pending_institutions, sub: 'institutions à approuver', icon: CheckCircle, color: '#e74c3c', bg: 'rgba(231,76,60,0.1)' },
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
              { label: '🏛 Approuver des institutions', path: '/admin/institutions' },
              { label: '🎓 Valider des étudiants', path: '/admin/students' },
              { label: '👥 Gérer les utilisateurs', path: '/admin/users' },
              { label: '📋 Voir les logs d\'audit', path: '/admin/audit' },
            ].map(l => (
              <a key={l.path} href={l.path} style={{ fontSize: 14, color: 'var(--text-2)', textDecoration: 'none', padding: '8px 12px', borderRadius: 6, background: 'var(--bg-3)' }}>
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
                  <span style={{ fontSize: 12, color: s.ok ? '#2ecc71' : '#f39c12', fontWeight: 500 }}>
                    {s.ok ? '● Actif' : '● Partiel'}
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
