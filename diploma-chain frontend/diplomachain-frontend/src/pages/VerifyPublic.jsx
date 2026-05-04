import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { diplomaApi } from '../api'
import { CheckCircle, XCircle, AlertCircle, Link as LinkIcon, Search, ArrowLeft } from 'lucide-react'
import './VerifyPublic.css'

export default function VerifyPublic() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [search, setSearch] = useState(code !== 'CODE' ? code : '')
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (code && code !== 'CODE') verify(code)
  }, [])

  const verify = async (c) => {
    const target = c || search
    if (!target) return
    setLoading(true)
    setError(null)
    setResult(null)
    setHistory(null)
    try {
      const { data } = await diplomaApi.verify(target.toUpperCase())
      setResult(data)
      if (data.valid) {
        try {
          const { data: h } = await diplomaApi.verifyHistory(target.toUpperCase())
          setHistory(h)
        } catch {}
      }
    } catch (err) {
      setError('Diplôme introuvable ou code invalide')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    verify()
  }

  return (
    <div className="verify-page">
      <div className="verify-bg"><div className="verify-glow" /></div>

      <div className="verify-container fade-in">
        <button className="btn btn-ghost btn-sm back-btn" onClick={() => navigate('/login')}>
          <ArrowLeft size={15} /> Retour
        </button>

        <div className="verify-header">
          <div className="verify-logo-mark">DC</div>
          <h1 className="verify-title">Vérification de diplôme</h1>
          <p className="verify-sub">Vérifiez l'authenticité d'un diplôme ancré sur Hedera Hashgraph</p>
        </div>

        <form className="verify-form card card-gold" onSubmit={handleSubmit}>
          <label className="input-label">Code unique du diplôme</label>
          <div className="verify-input-row">
            <input
              className="input mono"
              placeholder="DC-XXXX-XXXX-XXXX"
              value={search}
              onChange={e => setSearch(e.target.value.toUpperCase())}
              style={{ letterSpacing: '0.1em' }}
            />
            <button className="btn btn-primary" type="submit" disabled={loading || !search}>
              {loading ? <span className="spinner" /> : <Search size={16} />}
              Vérifier
            </button>
          </div>
        </form>

        {result && (
          <div className={`verify-result card fade-in ${result.valid ? 'result-valid' : result.reason?.includes('révoqué') ? 'result-revoked' : 'result-invalid'}`}>
            <div className="result-icon-row">
              {result.valid
                ? <CheckCircle size={36} className="icon-success" />
                : result.reason?.includes('révoqué')
                ? <XCircle size={36} className="icon-danger" />
                : <AlertCircle size={36} className="icon-warning" />
              }
              <div>
                <div className="result-status">
                  {result.valid ? '✓ Diplôme authentique' : result.reason?.includes('révoqué') ? '✗ Diplôme révoqué' : '✗ Diplôme invalide'}
                </div>
                {result.reason && <div className="result-reason">{result.reason}</div>}
              </div>
            </div>

            {result.valid && (
              <div className="result-details">
                <div className="result-grid">
                  <div className="result-field">
                    <span className="result-field-label">Étudiant</span>
                    <span className="result-field-value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {result.student_name ? (
                        <>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                            background: 'linear-gradient(135deg, var(--gold), #b8922e)',
                            fontSize: 11, fontWeight: 700, color: '#000',
                          }}>
                            {result.student_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                          <strong>{result.student_name}</strong>
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>— (données privées)</span>
                      )}
                    </span>
                  </div>
                  <div className="result-field">
                    <span className="result-field-label">Diplôme</span>
                    <span className="result-field-value">{result.degree_title}</span>
                  </div>
                  <div className="result-field">
                    <span className="result-field-label">Domaine</span>
                    <span className="result-field-value">{result.field_of_study}</span>
                  </div>
                  <div className="result-field">
                    <span className="result-field-label">Date</span>
                    <span className="result-field-value">{new Date(result.graduation_date).toLocaleDateString('fr-FR')}</span>
                  </div>
                  {result.honors && (
                    <div className="result-field">
                      <span className="result-field-label">Mention</span>
                      <span className="result-field-value result-mention">{result.honors}</span>
                    </div>
                  )}
                  <div className="result-field">
                    <span className="result-field-label">Émis le</span>
                    <span className="result-field-value">{result.issued_at ? new Date(result.issued_at).toLocaleDateString('fr-FR') : '—'}</span>
                  </div>
                </div>

                <div className="blockchain-section">
                  <div className="blockchain-header">
                    <LinkIcon size={14} />
                    <span>Ancrage Blockchain Hedera</span>
                  </div>
                  <div className={`blockchain-status ${result.blockchain_anchored ? 'anchored' : 'not-anchored'}`}>
                    {result.blockchain_anchored ? '⛓ Ancré sur Hedera Hashgraph' : '⚠ Non ancré sur blockchain'}
                  </div>
                  {result.hedera_transaction_id && (
                    <div className="blockchain-tx mono">{result.hedera_transaction_id}</div>
                  )}
                </div>
              </div>
            )}

            {result.revoked_at && (
              <div className="revoke-info">
                <div className="result-field">
                  <span className="result-field-label">Révoqué le</span>
                  <span className="result-field-value">{new Date(result.revoked_at).toLocaleDateString('fr-FR')}</span>
                </div>
                {result.revocation_reason && (
                  <div className="result-field">
                    <span className="result-field-label">Motif</span>
                    <span className="result-field-value">{result.revocation_reason}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {history && (
          <div className="card fade-in" style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 12 }}>
              Historique des vérifications — {history.total_verifications} au total
            </div>
            {history.history?.slice(0, 5).map((h, i) => (
              <div key={i} className="history-row">
                <span className={`badge badge-${h.result === 'valid' ? 'success' : 'danger'}`}>{h.result}</span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{new Date(h.checked_at).toLocaleString('fr-FR')}</span>
                <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{h.verifier_ip}</span>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="verify-error card fade-in">
            <AlertCircle size={20} />
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
