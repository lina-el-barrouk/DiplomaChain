// Admin Students
import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { studentApi } from '../../api'
import { CheckCircle, XCircle, GraduationCap } from 'lucide-react'
import toast from 'react-hot-toast'

export function AdminStudents() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [rejectId, setRejectId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await studentApi.getPending()
      setStudents(data)
    } catch { toast.error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const approve = async (id) => {
    try {
      await studentApi.approve(id)
      toast.success('Profil étudiant approuvé ✓')
      load()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erreur') }
  }

  const reject = async () => {
    if (!rejectReason.trim()) { toast.error('Motif requis'); return }
    try {
      await studentApi.reject(rejectId, rejectReason)
      toast.success('Profil rejeté')
      setRejectId(null)
      setRejectReason('')
      load()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erreur') }
  }

  return (
    <Layout>
      <div className="page-header">
        <h1 className="page-title">Validation des étudiants</h1>
        <p className="page-subtitle">Vérifiez les pièces d'identité avant d'approuver les profils</p>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Chargement...</div>
        ) : students.length === 0 ? (
          <div className="empty-state">
            <GraduationCap size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <h3>Aucun profil en attente</h3>
            <p>Tous les profils ont été traités</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nom complet</th>
                <th>CIN</th>
                <th>Date de naissance</th>
                <th>Inscrit le</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 500, color: 'var(--text-1)' }}>{s.full_name}</td>
                  <td><span className="mono" style={{ fontSize: 12 }}>{s.national_id}</span></td>
                  <td>{s.birth_date}</td>
                  <td style={{ fontSize: 12 }}>{new Date(s.created_at).toLocaleDateString('fr-FR')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-success btn-sm" onClick={() => approve(s.id)}>
                        <CheckCircle size={13} /> Approuver
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => setRejectId(s.id)}>
                        <XCircle size={13} /> Rejeter
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {rejectId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: 400, padding: 28 }}>
            <h3 style={{ marginBottom: 16, color: 'var(--text-1)' }}>Motif de rejet</h3>
            <textarea
              className="input"
              placeholder="Expliquez pourquoi ce profil est rejeté..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={4}
              style={{ resize: 'vertical', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-danger" onClick={reject}>Confirmer le rejet</button>
              <button className="btn btn-ghost" onClick={() => { setRejectId(null); setRejectReason('') }}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

export default AdminStudents
