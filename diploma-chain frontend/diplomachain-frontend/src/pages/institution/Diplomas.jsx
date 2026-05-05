import { useRef, useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { diplomaApi, pdfApi, qrApi } from '../../api'
import { Plus, Send, XCircle, Download, QrCode, RefreshCw, Search, FileSpreadsheet, UploadCloud, CheckCircle, AlertCircle, X } from 'lucide-react'
import toast from 'react-hot-toast'

export default function InstitutionDiplomas() {
  const [diplomas, setDiplomas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showRevoke, setShowRevoke] = useState(null)
  const [revokeReason, setRevokeReason] = useState('')
  const [qrModal, setQrModal] = useState(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ massar_code: '', degree_title: '', field_of_study: '', graduation_date: '', honors: '' })

  // Bulk state
  const [showBulk, setShowBulk] = useState(false)
  const [bulkFile, setBulkFile] = useState(null)
  const [bulkDragging, setBulkDragging] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResults, setBulkResults] = useState(null) // { success, total, errors }
  const bulkInputRef = useRef()

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await diplomaApi.list()
      console.log('[Diplomas] API response:', data?.length, 'items', data?.map(d => ({id: d.id?.slice(0,8), status: d.status})))
      setDiplomas(data)
    } catch (e) {
      console.error('[Diplomas] load error:', e.response?.status, e.response?.data)
      toast.error('Erreur de chargement : ' + (e.response?.data?.detail || e.message || 'inconnue'))
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const create = async (e) => {
    e.preventDefault()
    try {
      await diplomaApi.create({ ...form, graduation_date: new Date(form.graduation_date).toISOString() })
      toast.success('Diplôme créé ✓')
      setShowCreate(false)
      setForm({ massar_code: '', degree_title: '', field_of_study: '', graduation_date: '', honors: '' })
      load()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erreur lors de la création') }
  }

  const issue = async (id) => {
    try { await diplomaApi.issue(id); toast.success('Diplôme émis ⛓'); load() }
    catch (e) { toast.error(e.response?.data?.detail || 'Erreur') }
  }

  const anchor = async (id) => {
    try { await diplomaApi.anchor(id); toast.success('Diplôme ancré sur Hedera ⛓'); load() }
    catch (e) { toast.error(e.response?.data?.detail || 'Erreur lors de l\'ancrage') }
  }

  const revoke = async () => {
    if (!revokeReason.trim()) { toast.error('Motif requis'); return }
    try {
      await diplomaApi.revoke(showRevoke, revokeReason)
      toast.success('Diplôme révoqué')
      setShowRevoke(null); setRevokeReason(''); load()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erreur') }
  }

  const downloadPdf = async (id, code) => {
    try {
      const { data } = await pdfApi.generate(id)
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
      const a = document.createElement('a'); a.href = url; a.download = `diplome-${code}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Erreur PDF') }
  }

  const showQr = async (id) => {
    try { const { data } = await qrApi.getBase64(id); setQrModal(data) }
    catch { toast.error('Erreur QR code') }
  }

  // ── Bulk helpers ──────────────────────────────────────────────────────────
  const downloadTemplate = async () => {
    try {
      const { data } = await pdfApi.getBulkTemplate()
      const url = URL.createObjectURL(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const a = document.createElement('a'); a.href = url; a.download = 'template_diplomes_masse.xlsx'; a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Impossible de télécharger le template') }
  }

  const handleBulkDrop = (e) => {
    e.preventDefault(); setBulkDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) setBulkFile(f)
    else toast.error('Fichier Excel (.xlsx) requis')
  }

  const handleBulkGenerate = async () => {
    if (!bulkFile) { toast.error('Sélectionnez un fichier Excel'); return }
    setBulkLoading(true); setBulkResults(null)
    try {
      const resp = await pdfApi.bulkGenerate(bulkFile)
      const successCount = parseInt(resp.headers['x-success-count'] || '0')
      const totalCount   = parseInt(resp.headers['x-total-count']   || '0')

      // Télécharger le ZIP
      const url = URL.createObjectURL(new Blob([resp.data], { type: 'application/zip' }))
      const a = document.createElement('a'); a.href = url; a.download = 'diplomes_masse.zip'; a.click()
      URL.revokeObjectURL(url)

      setBulkResults({ success: successCount, total: totalCount, errors: totalCount - successCount })
      toast.success(`${successCount} diplôme(s) créé(s) en attente d'émission !`)
      load()
    } catch (err) {
      // Avec responseType:'blob', l'erreur HTTP est aussi un Blob → il faut la lire comme texte JSON
      let detail = null
      try {
        if (err.response?.data instanceof Blob) {
          const text = await err.response.data.text()
          const parsed = JSON.parse(text)
          detail = parsed.detail
        } else {
          detail = err.response?.data?.detail
        }
      } catch { /* ignore parse errors */ }

      if (detail?.rapport) {
        const allRows   = detail.rapport
        const errRows   = allRows.filter(r => r.statut === 'erreur')
        const okRows    = allRows.filter(r => r.statut === 'succès')
        setBulkResults({ success: okRows.length, total: allRows.length, errors: errRows.length, errorList: errRows })
        toast.error(detail.message || 'Aucun diplôme généré')
      } else {
        const msg = typeof detail === 'string' ? detail : 'Erreur lors de la génération'
        toast.error(msg)
        setBulkResults({ success: 0, total: 0, errors: 0, errorList: [{ ligne: '?', code_massar: '', message: msg }] })
      }
    } finally { setBulkLoading(false) }
  }

  const closeBulk = () => { setShowBulk(false); setBulkFile(null); setBulkResults(null) }

  const filtered = diplomas.filter(d => {
    if (!d) return false
    const code  = (d.unique_code  || '').toUpperCase()
    const title = (d.degree_title || '').toLowerCase()
    const sname = (d.student_name || '').toLowerCase()
    const s_massar = (d.student_massar_code || '').toLowerCase()
    const q = search.toLowerCase()
    return code.includes(search.toUpperCase()) || title.includes(q) || sname.includes(q) || s_massar.includes(q)
  })

  return (
    <Layout>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Diplômes</h1>
          <p className="page-subtitle">Créez, émettez et gérez les diplômes de votre institution</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /></button>
          <button className="btn btn-ghost" onClick={() => setShowBulk(true)} id="btn-bulk-generate">
            <FileSpreadsheet size={16} /> Génération en masse
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)} id="btn-new-diploma">
            <Plus size={16} /> Nouveau diplôme
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
        <input className="input" style={{ paddingLeft: 38 }} placeholder="Rechercher par code, titre, nom ou code massar..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <h3>Aucun diplôme</h3>
            <p style={{ marginTop: 8 }}>Cliquez sur "Nouveau diplôme" ou utilisez la "Génération en masse"</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Étudiant</th>
                <th>Code Massar</th>
                <th>Titre</th>
                <th>Statut</th>
                <th>Blockchain</th>
                <th>Créé le</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id}>
                  <td><span className="mono" style={{ fontSize: 12, color: 'var(--gold)' }}>{d.unique_code}</span></td>
                  <td>
                    {d.student_name ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--gold), #b8922e)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: '#000', flexShrink: 0,
                        }}>
                          {d.student_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ color: 'var(--text-1)', fontSize: 13 }}>{d.student_name}</span>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-2)' }}>
                    {d.student_massar_code || <span style={{ color: 'var(--text-3)' }}>—</span>}
                  </td>
                  <td style={{ color: 'var(--text-1)' }}>{d.degree_title}</td>
                  <td>
                    <span className={`badge ${d.status === 'issued' ? 'badge-success' : d.status === 'revoked' ? 'badge-danger' : 'badge-muted'}`}>
                      {d.status === 'issued' ? '✓ Émis' : d.status === 'revoked' ? '✗ Révoqué' : '⏳ En attente'}
                    </span>
                  </td>
                  <td>{d.blockchain_anchored ? <span className="badge badge-gold">⛓ Ancré</span> : <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>}</td>
                  <td style={{ fontSize: 12 }}>{new Date(d.created_at).toLocaleDateString('fr-FR')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minWidth: '180px' }}>
                      {/* Émettre : visible pour tout diplôme qui n'est pas encore émis ou révoqué */}
                      {d.status !== 'issued' && d.status !== 'revoked' && (
                        <button className="btn btn-success btn-sm" onClick={() => issue(d.id)}>
                          <Send size={13} /> Émettre
                        </button>
                      )}
                      {d.status === 'issued' && (
                        <>
                          {!d.blockchain_anchored && (
                            <button className="btn btn-primary btn-sm" onClick={() => anchor(d.id)} title="Ancrer sur Hedera">
                              <Send size={13} /> Ancrer
                            </button>
                          )}
                          <button className="btn btn-ghost btn-sm" onClick={() => downloadPdf(d.id, d.unique_code)} title="PDF"><Download size={13} /></button>
                          <button className="btn btn-ghost btn-sm" onClick={() => showQr(d.id)} title="QR"><QrCode size={13} /></button>
                          <button className="btn btn-danger btn-sm" onClick={() => setShowRevoke(d.id)}><XCircle size={13} /> Révoquer</button>
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

      {/* ── Bulk Modal ───────────────────────────────────────────────────────── */}
      {showBulk && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 600, padding: 32, position: 'relative' }}>
            <button onClick={closeBulk} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}><X size={20} /></button>

            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: 'var(--text-1)' }}>
              <FileSpreadsheet size={20} style={{ marginRight: 8, verticalAlign: 'middle', color: 'var(--gold)' }} />
              Génération en masse
            </h3>
            <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 24 }}>
              Uploadez un fichier Excel (.xlsx) contenant les données des étudiants.<br />
              Un diplôme en <strong style={{ color: 'var(--gold)' }}>attente d'émission</strong> sera créé pour chaque ligne valide,
              avec un PDF de prévisualisation dans le ZIP.<br />
              <span style={{ color: 'var(--text-3)', fontSize: 12 }}>➜ Revenez ensuite dans la liste et cliquez <strong>Émettre</strong> sur chaque diplôme pour l'ancrer sur Hedera.</span>
            </p>

            {/* Colonnes attendues */}
            <div style={{ background: 'var(--bg-2)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: 'var(--text-2)' }}>
              <strong style={{ color: 'var(--text-1)' }}>Colonnes requises :</strong>
              <span style={{ marginLeft: 8, color: 'var(--gold)' }}>code_massar</span>
              <span style={{ color: 'var(--text-3)' }}> · </span>
              <span style={{ color: 'var(--gold)' }}>titre_diplome</span>
              <span style={{ color: 'var(--text-3)' }}> · </span>
              <span style={{ color: 'var(--gold)' }}>domaine</span>
              <span style={{ color: 'var(--text-3)' }}> · </span>
              <span style={{ color: 'var(--gold)' }}>date_graduation</span>
              <span style={{ color: 'var(--text-3)' }}> · </span>
              <span>mention <em>(optionnel)</em></span>
            </div>

            {/* Download template */}
            <button className="btn btn-ghost" style={{ marginBottom: 20, width: '100%', justifyContent: 'center', borderStyle: 'dashed' }}
              onClick={downloadTemplate} id="btn-download-template">
              <Download size={15} /> Télécharger le fichier modèle (.xlsx)
            </button>

            {/* Drop zone */}
            <div
              id="bulk-drop-zone"
              onDragOver={e => { e.preventDefault(); setBulkDragging(true) }}
              onDragLeave={() => setBulkDragging(false)}
              onDrop={handleBulkDrop}
              onClick={() => bulkInputRef.current?.click()}
              style={{
                border: `2px dashed ${bulkDragging ? 'var(--gold)' : bulkFile ? 'var(--success, #4ade80)' : 'var(--border)'}`,
                borderRadius: 10,
                padding: '32px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all .2s',
                background: bulkDragging ? 'rgba(201,168,76,0.06)' : 'var(--bg-2)',
                marginBottom: 20,
              }}>
              <input ref={bulkInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files[0]; if (f) setBulkFile(f) }} />
              <UploadCloud size={36} style={{ color: bulkFile ? 'var(--success, #4ade80)' : 'var(--text-3)', marginBottom: 8 }} />
              {bulkFile ? (
                <>
                  <p style={{ color: 'var(--text-1)', fontWeight: 600 }}>{bulkFile.name}</p>
                  <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 4 }}>{(bulkFile.size / 1024).toFixed(1)} Ko — Cliquez pour changer</p>
                </>
              ) : (
                <>
                  <p style={{ color: 'var(--text-2)' }}>Glissez votre fichier Excel ici</p>
                  <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 4 }}>ou cliquez pour parcourir</p>
                </>
              )}
            </div>

            {/* Results */}
            {bulkResults && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: bulkResults.errorList ? 12 : 0 }}>
                  <div style={{ flex: 1, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                    <CheckCircle size={18} style={{ color: '#4ade80' }} />
                    <p style={{ fontSize: 22, fontWeight: 700, color: '#4ade80', margin: '4px 0' }}>{bulkResults.success}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Créés (pending)</p>
                  </div>
                  <div style={{ flex: 1, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                    <AlertCircle size={18} style={{ color: '#f87171' }} />
                    <p style={{ fontSize: 22, fontWeight: 700, color: '#f87171', margin: '4px 0' }}>{bulkResults.errors}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Erreurs</p>
                  </div>
                  <div style={{ flex: 1, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                    <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', margin: '4px 0' }}>{bulkResults.total}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Total lignes</p>
                  </div>
                </div>
                {bulkResults.errorList && bulkResults.errorList.length > 0 && (
                  <div style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: 12, maxHeight: 150, overflowY: 'auto' }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#f87171', marginBottom: 6 }}>Détail des erreurs :</p>
                    {bulkResults.errorList.map((e, i) => (
                      <p key={i} style={{ fontSize: 11, color: 'var(--text-2)', margin: '2px 0' }}>
                        <span style={{ color: 'var(--text-3)' }}>Ligne {e.ligne} · {e.code_massar || '—'}</span> — {e.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleBulkGenerate}
                disabled={!bulkFile || bulkLoading} id="btn-bulk-submit">
                {bulkLoading ? 'Génération en cours...' : <><UploadCloud size={15} /> Générer les diplômes</>}
              </button>
              <button className="btn btn-ghost" onClick={closeBulk}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 500, padding: 28 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, color: 'var(--text-1)' }}>Nouveau diplôme</h3>
            <form onSubmit={create}>
              <div className="form-group">
                <label className="input-label">Code Massar de l'étudiant *</label>
                <input className="input mono" placeholder="ex: P123456789" value={form.massar_code}
                  onChange={e => setForm(f => ({ ...f, massar_code: e.target.value }))} required />
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
                  <option>Passable</option><option>Assez Bien</option><option>Bien</option>
                  <option>Très Bien</option><option>Excellent</option>
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
            <textarea className="input" placeholder="Motif de révocation..." value={revokeReason}
              onChange={e => setRevokeReason(e.target.value)} rows={4} style={{ resize: 'vertical', marginBottom: 16 }} />
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
