import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../api";
import toast from "react-hot-toast";
import {
  Mail,
  Lock,
  ChevronRight,
  Building2,
  GraduationCap,
  User,
  MapPin,
  CreditCard,
  Calendar,
} from "lucide-react";
import "./Auth.css";

export default function Register() {
  const [form, setForm] = useState({
    email: "",
    password: "",
    role: "student",
    full_name: "",
    national_id: "",
    birth_date: "",
    institution_name: "",
    country: "",
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        email: form.email,
        password: form.password,
        role: form.role,
        ...(form.role === "student" && {
          student: {
            full_name: form.full_name,
            national_id: form.national_id,
            birth_date: form.birth_date,
          },
        }),
        ...(form.role === "institution" && {
          institution: {
            name: form.institution_name,
            country: form.country,
          },
        }),
      };
      await authApi.register(payload);
      toast.success("Compte créé ! En attente de validation.");
      navigate("/login");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-glow" />
      </div>
      <div className="auth-container fade-in" style={{ maxWidth: 480 }}>
        <div className="auth-logo">
          <div className="auth-logo-mark">DC</div>
          <div className="auth-logo-text">
            <span className="auth-logo-name">DiplomaChain</span>
            <span className="auth-logo-sub">
              Blockchain Certificate Platform
            </span>
          </div>
        </div>

        <div className="card card-gold auth-card">
          <h2 className="auth-title">Créer un compte</h2>
          <p className="auth-desc">
            Rejoignez la plateforme de certification blockchain
          </p>

          <form onSubmit={handleSubmit}>
            {/* Role selector */}
            <div className="form-group">
              <label className="input-label">Je suis...</label>
              <div className="role-grid">
                {[
                  {
                    value: "institution",
                    icon: <Building2 size={22} />,
                    label: "Institution",
                    desc: "Université, école...",
                  },
                  {
                    value: "student",
                    icon: <GraduationCap size={22} />,
                    label: "Étudiant",
                    desc: "Consulter mes diplômes",
                  },
                ].map((r) => (
                  <div
                    key={r.value}
                    className={`role-card ${form.role === r.value ? "selected" : ""}`}
                    onClick={() => setForm((f) => ({ ...f, role: r.value }))}
                  >
                    <div className="role-card-icon">{r.icon}</div>
                    <div className="role-card-label">{r.label}</div>
                    <div className="role-card-desc">{r.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Common fields */}
            <div className="form-group">
              <label className="input-label">Adresse email *</label>
              <div className="input-icon-wrap">
                <Mail size={15} className="input-icon" />
                <input
                  className="input input-with-icon"
                  type="email"
                  placeholder="votre@email.com"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="input-label">Mot de passe *</label>
              <div className="input-icon-wrap">
                <Lock size={15} className="input-icon" />
                <input
                  className="input input-with-icon"
                  type="password"
                  placeholder="Min. 12 caractères"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  required
                />
              </div>
              <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                Majuscule + chiffre + caractère spécial requis
              </p>
            </div>

            {/* Student specific */}
            {form.role === "student" && (
              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  paddingTop: 16,
                  marginTop: 4,
                }}
              >
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--gold)",
                    marginBottom: 14,
                    fontWeight: 500,
                  }}
                >
                  🎓 Informations d'identité — seront vérifiées par l'admin
                </p>
                <div className="form-group">
                  <label className="input-label">Nom complet *</label>
                  <div className="input-icon-wrap">
                    <User size={15} className="input-icon" />
                    <input
                      className="input input-with-icon"
                      placeholder="Prénom Nom"
                      value={form.full_name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, full_name: e.target.value }))
                      }
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="input-label">Numéro CIN *</label>
                  <div className="input-icon-wrap">
                    <CreditCard size={15} className="input-icon" />
                    <input
                      className="input input-with-icon mono"
                      placeholder="AB123456"
                      value={form.national_id}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, national_id: e.target.value }))
                      }
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="input-label">Date de naissance *</label>
                  <div className="input-icon-wrap">
                    <Calendar size={15} className="input-icon" />
                    <input
                      className="input input-with-icon"
                      type="date"
                      value={form.birth_date}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, birth_date: e.target.value }))
                      }
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Institution specific */}
            {form.role === "institution" && (
              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  paddingTop: 16,
                  marginTop: 4,
                }}
              >
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--gold)",
                    marginBottom: 14,
                    fontWeight: 500,
                  }}
                >
                  🏛 Informations de l'établissement
                </p>
                <div className="form-group">
                  <label className="input-label">
                    Nom de l'établissement *
                  </label>
                  <div className="input-icon-wrap">
                    <Building2 size={15} className="input-icon" />
                    <input
                      className="input input-with-icon"
                      placeholder="Université de..."
                      value={form.institution_name}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          institution_name: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="input-label">Pays *</label>
                  <div className="input-icon-wrap">
                    <MapPin size={15} className="input-icon" />
                    <input
                      className="input input-with-icon"
                      placeholder="Maroc"
                      value={form.country}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, country: e.target.value }))
                      }
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              className="btn btn-primary btn-lg auth-submit"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <span className="spinner" />
              ) : (
                <ChevronRight size={18} />
              )}
              {loading ? "Création..." : "Créer mon compte"}
            </button>
          </form>

          <div className="auth-footer">
            Déjà un compte ?{" "}
            <Link to="/login" className="auth-link">
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
