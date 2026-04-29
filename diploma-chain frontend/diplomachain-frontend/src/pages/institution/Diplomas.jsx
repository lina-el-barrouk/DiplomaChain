import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { diplomaApi, pdfApi, qrApi } from '../../api'
import { Plus, Send, XCircle, Download, QrCode, RefreshCw, Search } from 'lucide-react'
import toast from 'react-hot-toast'

export default function InstitutionDiplomas() {
  const [diplomas, setDiplomas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showRevoke, setShowRevoke] = useState(null)
  const [revokeReason, setRevokeReason] = useState('')
  const [qrModal, setQrModal] = useState(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({
    student_id: '', degree_title: '', field_of_study: '',
    graduation_date: '', honors: ''
  })

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await diplomaApi.list()
      setDiplomas(data)
    } catch { toast.error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const create = async (e) => {
    e.preventDefault()
    try {
      await diplomaApi.create({
        ...form,
        graduation_date: new Date(form.graduation_date).toISOString(),
      })
      toast.success('Diplôme créé ✓')
      setShowCreate(false)
      setForm({ student_id: '', degree_title: '', field_of_study: '', graduation_date: '', honors: '' })
      load()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erreur lors de la création') }
  }

  const issue = async (id) => {
    try {
      await diplomaApi.issue(id)
      toast.success('Diplôme émis et ancré sur Hedera ⛓')
      load()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erreur') }
  }

  const revoke = async () => {
    if (!revokeReason.trim()) { toast.error('Motif requis'); return }
    try {
      await diplomaApi.revoke(showRevoke, revokeReason)
      toast.success('Diplôme révoqué')
      setShowRevoke(null)
      setRevokeReason('')
      load()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erreur') }
  }

  const downloadPdf = async (id, code) => {
    try {
      const { data } = await pdfApi.generate(id)
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `diplome-${code}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Erreur lors de la génération du PDF') }
  }

  const showQr = async (id) => {
    try {
      const { data } = await qrApi.getBase64(id)
      setQrModal(data)
    } catch { toast.error('Erreur QR code') }
  }

  const filtered = diplomas.filter(d =>
    d.unique_code.includes(search.toUpperCase()) ||
    d.degree_title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Diplômes</h1>
          <p className="page-subtitle">Créez, émettez et gérez les diplômes de votre institution</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /></button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Nouveau diplôme
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
        <input
          className="input"
          style={{ paddingLeft: 38 }}
          placeholder="Rechercher par code ou titre..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <h3>Aucun diplôme</h3>
            <p style={{ marginTop: 8 }}>Cliquez sur "Nouveau diplôme" pour commencer</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Code</th><th>Titre</th><th>Statut</th><th>Blockchain</th><th>Créé le</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id}>
                  <td><span className="mono" style={{ fontSize: 12, color: 'var(--gold)' }}>{d.unique_code}</span></td>
                  <td style={{ color: 'var(--text-1)' }}>{d.degree_title}</td>
                  <td>
                    <span className={`badge ${d.status === 'issued' ? 'badge-success' : d.status === 'revoked' ? 'badge-danger' : 'badge-muted'}`}>
                      {d.status === 'issued' ? '✓ Émis' : d.status === 'revoked' ? '✗ Révoqué' : '⏳ En attente'}
                    </span>
                  </td>
                  <td>
                    {d.blockchain_anchored
                      ? <span className="badge badge-gold">⛓ Ancré</span>
                      : <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ fontSize: 12 }}>{new Date(d.created_at).toLocaleDateString('fr-FR')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {d.status === 'pending' && (
                        <button className="btn btn-success btn-sm" onClick={() => issue(d.id)}>
                          <Send size={13} /> Émettre
                        </button>
                      )}
                      {d.status === 'issued' && (
                        <>
                          <button className="btn btn-ghost btn-sm" onClick={() => downloadPdf(d.id, d.unique_code)} title="Télécharger PDF">
                            <Download size={13} />
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => showQr(d.id)} title="QR Code">
                            <QrCode size={13} />
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => setShowRevoke(d.id)}>
                            <XCircle size={13} /> Révoquer
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 500, padding: 28 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, color: 'var(--text-1)' }}>Nouveau diplôme</h3>
            <form onSubmit={create}>
              <div className="form-group">
                <label className="input-label">ID de l'étudiant *</label>
                <input className="input mono" placeholder="UUID de l'étudiant" value={form.student_id}
                  onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="input-label">Titre du diplôme *</label>
                <input className="input" placeholder="ex: Master en Informatique" value={form.degree_title}
                  onChange={e => setForm(f => ({ ...f, degree_title: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="input-label">Domaine d'études *</label>
                <input className="input" placeholder="ex: Intelligence Artificielle" value={form.field_of_study}
                  onChange={e => setForm(f => ({ ...f, field_of_study: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="input-label">Date de graduation *</label>
                <input className="input" type="date" value={form.graduation_date}
                  onChange={e => setForm(f => ({ ...f, graduation_date: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="input-label">Mention</label>
                <select className="input" value={form.honors} onChange={e => setForm(f => ({ ...f, honors: e.target.value }))}>
                  <option value="">Aucune mention</option>
                  <option value="Passable">Passable</option>
                  <option value="Assez Bien">Assez Bien</option>
                  <option value="Bien">Bien</option>
                  <option value="Très Bien">Très Bien</option>
                  <option value="Excellent">Excellent</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button className="btn btn-primary" type="submit">Créer le diplôme</button>
                <button className="btn btn-ghost" type="button" onClick={() => setShowCreate(false)}>Annuler</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revoke Modal */}
      {showRevoke && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: 420, padding: 28 }}>
            <h3 style={{ marginBottom: 16, color: 'var(--text-1)' }}>Révoquer le diplôme</h3>
            <textarea className="input" placeholder="Motif de révocation (minimum 10 caractères)..."
              value={revokeReason} onChange={e => setRevokeReason(e.target.value)}
              rows={4} style={{ resize: 'vertical', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-danger" onClick={revoke}>Confirmer la révocation</button>
              <button className="btn btn-ghost" onClick={() => { setShowRevoke(null); setRevokeReason('') }}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {qrModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setQrModal(null)}>
          <div className="card" style={{ padding: 28, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16, color: 'var(--text-1)' }}>QR Code du diplôme</h3>
            <img src={`data:image/png;base64,${qrModal.qr_code_base64}`} alt="QR Code" style={{ width: 200, height: 200, margin: '0 auto', display: 'block' }} />
            <p className="mono" style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 12 }}>{qrModal.unique_code}</p>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 16 }} onClick={() => setQrModal(null)}>Fermer</button>
          </div>
        </div>
      )}
    </Layout>
  )
}
