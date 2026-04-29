import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { institutionApi } from '../../api'
import { Building2, Save } from 'lucide-react'
import toast from 'react-hot-toast'

export default function InstitutionProfile() {
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({ name: '', country: '', accreditation_number: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    institutionApi.getMe()
      .then(r => {
        setProfile(r.data)
        setForm({ name: r.data.name, country: r.data.country, accreditation_number: r.data.accreditation_number })
      })
      .catch(() => setCreating(true))
      .finally(() => setLoading(false))
  }, [])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (creating) {
        const { data } = await institutionApi.create(form)
        setProfile(data)
        setCreating(false)
        toast.success('Profil institution créé ✓')
      } else {
        const { data } = await institutionApi.updateMe(form)
        setProfile(data)
        toast.success('Profil mis à jour ✓')
      }
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
        <h1 className="page-title">Mon profil institution</h1>
        <p className="page-subtitle">{creating ? 'Créez votre profil pour commencer à émettre des diplômes' : 'Informations de votre établissement'}</p>
      </div>

      {profile && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <span className={`badge ${profile.is_approved ? 'badge-success' : 'badge-muted'}`} style={{ fontSize: 13, padding: '6px 14px' }}>
            {profile.is_approved ? '✓ Institution approuvée' : '⏳ En attente d\'approbation'}
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card card-gold">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ width: 40, height: 40, background: 'var(--gold-glow)', border: '1px solid var(--border-strong)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={20} style={{ color: 'var(--gold)' }} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)' }}>
              {creating ? 'Créer mon profil' : 'Informations'}
            </h3>
          </div>

          <form onSubmit={save}>
            <div className="form-group">
              <label className="input-label">Nom de l'établissement *</label>
              <input className="input" placeholder="Université de..." value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="input-label">Pays *</label>
              <input className="input" placeholder="Maroc" value={form.country}
                onChange={e => setForm(f => ({ ...f, country: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="input-label">Numéro d'accréditation *</label>
              <input className="input mono" placeholder="UNIV-MA-2024-001" value={form.accreditation_number}
                onChange={e => setForm(f => ({ ...f, accreditation_number: e.target.value }))}
                disabled={!creating} required />
              {!creating && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Le numéro d'accréditation ne peut pas être modifié.</p>}
            </div>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? <span className="spinner" /> : <Save size={15} />}
              {creating ? 'Créer le profil' : 'Enregistrer'}
            </button>
          </form>
        </div>

        {profile && (
          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--text-1)' }}>Informations du compte</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'ID Institution', value: profile.id, mono: true },
                { label: 'Créé le', value: new Date(profile.created_at).toLocaleDateString('fr-FR') },
                { label: 'Statut', value: profile.is_approved ? 'Approuvée ✓' : 'En attente ⏳' },
              ].map(f => (
                <div key={f.label}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{f.label}</div>
                  <div className={f.mono ? 'mono' : ''} style={{ fontSize: 13, color: 'var(--text-1)', wordBreak: 'break-all' }}>{f.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
