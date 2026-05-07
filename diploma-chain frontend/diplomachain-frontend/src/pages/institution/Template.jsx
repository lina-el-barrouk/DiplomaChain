import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { pdfApi } from '../../api'
import { Upload, FileText, CheckCircle, Info } from 'lucide-react'
import toast from 'react-hot-toast'

export default function InstitutionTemplate() {
  const [template, setTemplate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    pdfApi.getTemplate()
      .then(r => setTemplate(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleFile = async (file) => {
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast.error('Seuls les fichiers PDF sont acceptés')
      return
    }
    setUploading(true)
    try {
      const { data } = await pdfApi.uploadTemplate(file)
      setTemplate({ has_template: true, ...data })
      toast.success('Template uploadé avec succès')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erreur lors de l\'upload')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }

  return (
    <Layout>
      <div className="page-header">
        <h1 className="page-title">Template PDF</h1>
        <p className="page-subtitle">Uploadez le design de vos diplômes — les informations seront insérées automatiquement</p>
      </div>

      {/* Instructions */}
      <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(52,152,219,0.25)', background: 'rgba(52,152,219,0.04)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#3498db', marginBottom: 12 }}>
          <Info size={15} style={{ marginRight: 6, flexShrink: 0 }} /> Comment préparer votre template
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
          Créez votre design dans Word, Canva ou PowerPoint avec ces zones de texte exactes :
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
          {[
            ['{{NOM_ETUDIANT}}', 'Nom complet de l\'étudiant'],
            ['{{TITRE_DIPLOME}}', 'Titre du diplôme'],
            ['{{DOMAINE}}', 'Domaine d\'études'],
            ['{{INSTITUTION}}', 'Nom de l\'institution'],
            ['{{DATE}}', 'Date de graduation'],
            ['{{MENTION}}', 'Mention obtenue'],
            ['{{CODE}}', 'Code unique du diplôme'],
            ['{{QR_CODE}}', 'QR code de vérification'],
          ].map(([ph, desc]) => (
            <div key={ph} style={{ background: 'var(--bg-2)', borderRadius: 6, padding: '8px 12px' }}>
              <div className="mono" style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 500 }}>{ph}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{desc}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 12 }}>
          Exportez en PDF → uploadez ci-dessous → le backend remplace automatiquement les placeholders.
        </p>
      </div>

      {/* Upload zone */}
      <div
        className="card"
        style={{
          border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`,
          textAlign: 'center',
          padding: '48px 24px',
          cursor: 'pointer',
          transition: 'border-color 0.2s',
          background: dragOver ? 'var(--green-50)' : 'var(--bg-1)',
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input').click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])}
        />

        {uploading ? (
          <>
            <div className="spinner" style={{ margin: '0 auto 16px', width: 32, height: 32 }} />
            <p style={{ color: 'var(--text-2)' }}>Upload en cours...</p>
          </>
        ) : (
          <>
            <Upload size={36} style={{ color: 'var(--primary)', margin: '0 auto 16px' }} />
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 6 }}>
              Glissez votre PDF ici
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
              ou cliquez pour sélectionner — max 20 Mo
            </p>
          </>
        )}
      </div>

      {/* Current template */}
      {!loading && template?.has_template && (
        <div className="card card-gold fade-in" style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, background: 'rgba(22,163,74,0.08)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={22} style={{ color: 'var(--success)' }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>Template actif</div>
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
                <FileText size={12} style={{ display: 'inline', marginRight: 5 }} />
                {template.file_name}
              </div>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <span className="badge badge-success"><CheckCircle size={11} /> Actif</span>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 14 }}>
            Pour mettre à jour votre template, uploadez simplement un nouveau fichier PDF.
          </p>
        </div>
      )}

      {!loading && !template?.has_template && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg-2)', borderRadius: 8, fontSize: 13, color: 'var(--text-3)' }}>
          <Info size={14} style={{ marginRight: 6, flexShrink: 0, verticalAlign: 'middle' }} /> Aucun template configuré — un design élégant par défaut sera utilisé lors de la génération des PDFs.
        </div>
      )}
    </Layout>
  )
}
