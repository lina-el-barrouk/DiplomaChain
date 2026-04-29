import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { institutionApi } from '../../api'
import { CheckCircle, XCircle, Building2, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminInstitutions() {
  const [institutions, setInstitutions] = useState([])
  const [filter, setFilter] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const params = filter !== null ? { approved: filter } : {}
      const { data } = await institutionApi.list(params)
      setInstitutions(data)
    } catch { toast.error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [filter])

  const approve = async (id) => {
    try {
      await institutionApi.approve(id)
      toast.success('Institution approuvée ✓')
      load()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erreur') }
  }

  const reject = async (id) => {
    try {
      await institutionApi.reject(id)
      toast.success('Institution rejetée')
      load()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erreur') }
  }

  return (
    <Layout>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Institutions</h1>
          <p className="page-subtitle">Gérez les établissements inscrits sur la plateforme</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /></button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[{ label: 'Toutes', val: null }, { label: 'En attente', val: false }, { label: 'Approuvées', val: true }].map(f => (
          <button
            key={String(f.val)}
            className={`btn btn-sm ${filter === f.val ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(f.val)}
          >{f.label}</button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)' }}>Chargement...</div>
        ) : institutions.length === 0 ? (
          <div className="empty-state">
            <Building2 size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <h3>Aucune institution</h3>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Institution</th>
                <th>Pays</th>
                <th>Accréditation</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {institutions.map(inst => (
                <tr key={inst.id}>
                  <td style={{ fontWeight: 500, color: 'var(--text-1)' }}>{inst.name}</td>
                  <td>{inst.country}</td>
                  <td><span className="mono" style={{ fontSize: 12 }}>{inst.accreditation_number}</span></td>
                  <td>
                    <span className={`badge ${inst.is_approved ? 'badge-success' : 'badge-muted'}`}>
                      {inst.is_approved ? '✓ Approuvée' : '⏳ En attente'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {!inst.is_approved && (
                        <button className="btn btn-success btn-sm" onClick={() => approve(inst.id)}>
                          <CheckCircle size={13} /> Approuver
                        </button>
                      )}
                      {inst.is_approved && (
                        <button className="btn btn-danger btn-sm" onClick={() => reject(inst.id)}>
                          <XCircle size={13} /> Révoquer
                        </button>
                      )}
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
