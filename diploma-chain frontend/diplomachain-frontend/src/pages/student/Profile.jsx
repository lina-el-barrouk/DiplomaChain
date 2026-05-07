import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { studentApi } from '../../api'
import { User, Save, Shield, CheckCircle, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

export default function StudentProfile() {
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({ full_name: '', national_id: '', birth_date: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    studentApi.getMe()
      .then(r => {
        setProfile(r.data)
        setForm({ full_name: r.data.full_name, national_id: '••••••••', birth_date: r.data.birth_date })
      })
      .catch(() => setCreating(true))
      .finally(() => setLoading(false))
  }, [])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await studentApi.createMe(form)
      setProfile(data)
      setCreating(false)
      toast.success('Profil créé — En attente de validation par l\'admin')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Layout><div style={{ padding: 40, color: 'var(--text-3)' }}>Chargement...</div></Layout>

  return (
    <Layout>
      <div className="page-header">
        <h1 className="page-title">Mon profil</h1>
        <p className="page-subtitle">
          {creating
            ? 'Créez votre profil étudiant — un admin vérifiera votre identité'
            : 'Vos informations personnelles chiffrées AES-256'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card card-gold">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ width: 40, height: 40, background: 'var(--green-50)', border: '1px solid var(--border-strong)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={20} style={{ color: 'var(--primary)' }} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)' }}>
              {creating ? 'Créer mon profil' : 'Mes informations'}
            </h3>
          </div>

          {creating ? (
            <form onSubmit={save}>
              <div className="form-group">
                <label className="input-label">Nom complet *</label>
                <input className="input" placeholder="Prénom Nom" value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="input-label">Numéro CIN *</label>
                <input className="input mono" placeholder="AB123456" value={form.national_id}
                  onChange={e => setForm(f => ({ ...f, national_id: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="input-label">Date de naissance *</label>
                <input className="input" type="date" value={form.birth_date}
                  onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))} required />
              </div>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? <span className="spinner" /> : <Save size={15} />}
                Créer mon profil
              </button>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {[
                { label: 'Nom complet', value: profile?.full_name },
                { label: 'Numéro CIN', value: '••••••••', mono: true },
                { label: 'Date de naissance', value: profile?.birth_date },
              ].map(f => (
                <div key={f.label}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{f.label}</div>
                  <div className={f.mono ? 'mono' : ''} style={{ fontSize: 15, color: 'var(--text-1)', fontWeight: 500 }}>{f.value || '—'}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <Shield size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>Sécurité & Confidentialité</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Chiffrement des données', value: 'AES-256 (Fernet)', ok: true },
              { label: 'Validation identité', value: profile ? (profile.is_approved ? 'Validé' : 'En attente') : 'Non créé', ok: !!profile?.is_approved },
              { label: 'Stockage CIN', value: 'Chiffré en base', ok: true },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-3)', borderRadius: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{s.label}</span>
                <span style={{ fontSize: 12, color: s.ok ? 'var(--success)' : 'var(--warning)', fontWeight: 500 }}>{s.value}</span>
              </div>
            ))}
          </div>

          {!creating && !profile?.is_approved && (
            <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.15)', borderRadius: 8, fontSize: 13, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={14} style={{ flexShrink: 0 }} /> Votre profil est en attente de validation par un administrateur. Il vérifiera que vos informations correspondent à votre CIN.
            </div>
          )}

          {!creating && profile?.is_approved && (
            <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.15)', borderRadius: 8, fontSize: 13, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={14} style={{ flexShrink: 0 }} /> Votre identité a été vérifiée. Vous pouvez recevoir des diplômes officiels.
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
