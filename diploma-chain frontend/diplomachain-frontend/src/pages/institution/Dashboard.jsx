import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { diplomaApi, institutionApi } from '../../api'
import { ScrollText, CheckCircle, XCircle, Clock, Link as LinkIcon, AlertCircle } from 'lucide-react'

export default function InstitutionDashboard() {
  const [diplomas, setDiplomas] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      diplomaApi.list(),
      institutionApi.getMe(),
    ]).then(([d, p]) => {
      setDiplomas(d.data)
      setProfile(p.data)
    }).catch(() => {})
    .finally(() => setLoading(false))
  }, [])

  const issued = diplomas.filter(d => d.status === 'issued').length
  const pending = diplomas.filter(d => d.status === 'pending').length
  const revoked = diplomas.filter(d => d.status === 'revoked').length
  const anchored = diplomas.filter(d => d.blockchain_anchored).length

  return (
    <Layout>
      <div className="page-header">
        <h1 className="page-title">
          {profile ? profile.name : 'Tableau de bord'}
        </h1>
        <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {profile?.is_approved
            ? <><CheckCircle size={14} style={{ color: 'var(--success)' }} /> Institution approuvée — vous pouvez émettre des diplômes</>
            : <><Clock size={14} style={{ color: 'var(--warning)' }} /> En attente d'approbation par un administrateur</>}
        </p>
      </div>

      {!profile?.is_approved && (
        <div style={{ background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 10, padding: '14px 18px', marginBottom: 24, fontSize: 14, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={18} /> Votre institution est en attente d'approbation. Un administrateur doit valider votre compte avant que vous puissiez créer des diplômes.
        </div>
      )}

      <div className="stats-grid fade-in">
        {[
          { label: 'Diplômes émis', value: issued, icon: CheckCircle, color: 'var(--success)', bg: 'rgba(22,163,74,0.06)' },
          { label: 'En attente', value: pending, icon: Clock, color: 'var(--warning)', bg: 'rgba(217,119,6,0.06)' },
          { label: 'Révoqués', value: revoked, icon: XCircle, color: 'var(--danger)', bg: 'rgba(220,38,38,0.06)' },
          { label: 'Sur blockchain', value: anchored, icon: LinkIcon, color: 'var(--primary)', bg: 'var(--green-50)', gold: true },
        ].map((s, i) => (
          <div key={i} className={`stat-card ${s.gold ? 'gold' : ''}`}>
            <div className="stat-icon" style={{ background: s.bg }}>
              <s.icon size={18} style={{ color: s.color }} />
            </div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>Derniers diplômes</h3>
          <a href="/institution/diplomas" className="btn btn-ghost btn-sm">Voir tout</a>
        </div>

        {loading ? (
          <div style={{ padding: 20, color: 'var(--text-3)' }}>Chargement...</div>
        ) : diplomas.length === 0 ? (
          <div className="empty-state" style={{ padding: '30px 0' }}>
            <ScrollText size={28} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
            <h3>Aucun diplôme créé</h3>
            <p style={{ marginTop: 8 }}>
              <a href="/institution/diplomas" className="auth-link">Créer votre premier diplôme</a>
            </p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Code</th><th>Titre</th><th>Statut</th><th>Blockchain</th><th>Date</th></tr>
            </thead>
            <tbody>
              {diplomas.slice(0, 5).map(d => (
                <tr key={d.id}>
                  <td><span className="mono" style={{ fontSize: 12, color: 'var(--primary)' }}>{d.unique_code}</span></td>
                  <td style={{ color: 'var(--text-1)' }}>{d.degree_title}</td>
                  <td>
                    <span className={`badge ${d.status === 'issued' ? 'badge-success' : d.status === 'revoked' ? 'badge-danger' : 'badge-muted'}`}>
                      {d.status}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${d.blockchain_anchored ? 'badge-gold' : 'badge-muted'}`}>
                      {d.blockchain_anchored ? (<><LinkIcon size={11} /> Ancré</>) : '—'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{new Date(d.created_at).toLocaleDateString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  )
}
