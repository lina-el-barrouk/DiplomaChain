import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { adminApi } from '../../api'
import { ClipboardList, RefreshCw, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminAudit() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await adminApi.getAuditLogs()
      setLogs(data)
    } catch { toast.error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const cleanup = async () => {
    try {
      const { data } = await adminApi.cleanupTokens()
      toast.success(`${data.deleted_tokens} tokens expirés supprimés`)
    } catch { toast.error('Erreur') }
  }

  const resultColors = {
    valid: 'badge-success',
    invalid: 'badge-danger',
    revoked: 'badge-danger',
    not_found: 'badge-muted',
  }

  return (
    <Layout>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Audit logs</h1>
          <p className="page-subtitle">Historique de toutes les vérifications de diplômes</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /></button>
          <button className="btn btn-danger btn-sm" onClick={cleanup}><Trash2 size={14} /> Purger tokens</button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Chargement...</div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <ClipboardList size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <h3>Aucun log</h3>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Diplôme ID</th>
                <th>Résultat</th>
                <th>IP Vérificateur</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td><span className="mono" style={{ fontSize: 12 }}>{log.diploma_id?.slice(0, 8)}...</span></td>
                  <td><span className={`badge ${resultColors[log.result] || 'badge-muted'}`}>{log.result}</span></td>
                  <td><span className="mono" style={{ fontSize: 12 }}>{log.verifier_ip || '—'}</span></td>
                  <td style={{ fontSize: 12 }}>{new Date(log.checked_at).toLocaleString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  )
}
