import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { diplomaApi, pdfApi, qrApi } from '../../api'
import { ScrollText, Download, QrCode, CheckCircle, XCircle, Clock, Link as LinkIcon } from 'lucide-react'
import toast from 'react-hot-toast'

export default function StudentDashboard() {
  const [diplomas, setDiplomas] = useState([])
  const [loading, setLoading] = useState(true)
  const [qrModal, setQrModal] = useState(null)

  useEffect(() => {
    diplomaApi.list()
      .then(r => setDiplomas(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const downloadPdf = async (id, code) => {
    try {
      const { data } = await pdfApi.generate(id)
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `diplome-${code}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF téléchargé')
    } catch { toast.error('Erreur lors du téléchargement') }
  }

  const showQr = async (id) => {
    try {
      const { data } = await qrApi.getBase64(id)
      setQrModal(data)
    } catch { toast.error('Erreur QR code') }
  }

  return (
    <Layout>
      <div className="page-header">
        <h1 className="page-title">Mes diplômes</h1>
        <p className="page-subtitle">Consultez et téléchargez vos diplômes certifiés sur blockchain</p>
      </div>

      {loading ? (
        <div style={{ padding: 40, color: 'var(--text-3)' }}>Chargement...</div>
      ) : diplomas.length === 0 ? (
        <div className="card fade-in" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <ScrollText size={48} style={{ color: 'var(--text-3)', margin: '0 auto 16px', opacity: 0.4 }} />
          <h3 style={{ fontSize: 18, color: 'var(--text-2)', marginBottom: 8 }}>Aucun diplôme pour le moment</h3>
          <p style={{ color: 'var(--text-3)', fontSize: 14 }}>
            Vos diplômes apparaîtront ici une fois émis par votre institution.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {diplomas.map(d => (
            <div key={d.id} className={`card fade-in ${d.status === 'issued' ? 'card-gold' : ''}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-1)', fontFamily: 'var(--font-display)' }}>
                      {d.degree_title}
                    </h3>
                    <span className={`badge ${d.status === 'issued' ? 'badge-success' : d.status === 'revoked' ? 'badge-danger' : 'badge-muted'}`}>
                      {d.status === 'issued' ? <><CheckCircle size={11} /> Certifié</> : d.status === 'revoked' ? <><XCircle size={11} /> Révoqué</> : <><Clock size={11} /> En attente</>}
                    </span>
                  </div>

                  <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 12 }}>{d.field_of_study}</p>

                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Code unique</div>
                      <div className="mono" style={{ fontSize: 13, color: 'var(--primary)', marginTop: 2 }}>{d.unique_code}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date d'émission</div>
                      <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>{d.issued_at ? new Date(d.issued_at).toLocaleDateString('fr-FR') : '—'}</div>
                    </div>
                    {d.honors && (
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mention</div>
                        <div style={{ fontSize: 13, color: 'var(--primary)', marginTop: 2, fontWeight: 500 }}>{d.honors}</div>
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Blockchain</div>
                      <div style={{ fontSize: 13, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {d.blockchain_anchored
                          ? <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}><LinkIcon size={12} /> Ancré sur Hedera</span>
                          : <span style={{ color: 'var(--text-3)' }}>—</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {d.status === 'issued' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginLeft: 20 }}>
                    <button className="btn btn-primary btn-sm" onClick={() => downloadPdf(d.id, d.unique_code)}>
                      <Download size={14} /> PDF
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => showQr(d.id)}>
                      <QrCode size={14} /> QR Code
                    </button>
                    <a
                      href={`/verify/${d.unique_code}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm"
                    >
                      <LinkIcon size={14} /> Vérifier
                    </a>
                  </div>
                )}
              </div>

              {d.blockchain_anchored && d.hedera_transaction_id && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Transaction Hedera</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)', wordBreak: 'break-all' }}>
                    {d.hedera_transaction_id}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* QR Modal */}
      {qrModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setQrModal(null)}>
          <div className="card card-gold" style={{ padding: 32, textAlign: 'center', maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16, color: 'var(--text-1)', fontFamily: 'var(--font-display)' }}>QR Code de vérification</h3>
            <div style={{ background: 'white', padding: 16, borderRadius: 12, display: 'inline-block', marginBottom: 16, border: '1px solid var(--border)' }}>
              <img src={`data:image/png;base64,${qrModal.qr_code_base64}`} alt="QR Code de vérification" style={{ width: 180, height: 180, display: 'block' }} />
            </div>
            <p className="mono" style={{ fontSize: 12, color: 'var(--primary)', marginBottom: 6 }}>{qrModal.unique_code}</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>Scannez pour vérifier l'authenticité</p>
            <button className="btn btn-ghost btn-sm" onClick={() => setQrModal(null)}>Fermer</button>
          </div>
        </div>
      )}
    </Layout>
  )
}
