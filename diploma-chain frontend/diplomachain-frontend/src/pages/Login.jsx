import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { authApi } from "../api";
import toast from "react-hot-toast";
import { Lock, Mail, ChevronRight } from "lucide-react";
import "./Auth.css";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await authApi.login(form);
      // Decode role from JWT
      const payload = JSON.parse(atob(data.access_token.split(".")[1]));
      login({ ...data, role: payload.role, email: form.email });
      toast.success("Bienvenue !");
      if (payload.role === "admin") navigate("/admin");
      else if (payload.role === "institution") navigate("/institution");
      else navigate("/student");
    } catch (err) {
      const detail = err.response?.data?.detail || "";
      if (detail.startsWith("PENDING:")) {
        navigate("/pending", {
          state: { message: detail.replace("PENDING:", "") },
        });
      } else if (detail.startsWith("REJECTED:")) {
        navigate("/rejected", {
          state: { reason: detail.replace("REJECTED:", "") },
        });
      } else {
        toast.error(detail || "Identifiants incorrects");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-glow" />
      </div>

      <div className="auth-container fade-in">
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
          <h2 className="auth-title">Connexion</h2>
          <p className="auth-desc">Accédez à votre espace sécurisé</p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="input-label">Adresse email</label>
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
              <label className="input-label">Mot de passe</label>
              <div className="input-icon-wrap">
                <Lock size={15} className="input-icon" />
                <input
                  className="input input-with-icon"
                  type="password"
                  placeholder="••••••••••••"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  required
                />
              </div>
            </div>

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
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </form>

          <div className="auth-footer">
            Pas encore de compte ?{" "}
            <Link to="/register" className="auth-link">
              Créer un compte
            </Link>
          </div>

          <div className="auth-verify-link">
            <Link to="/verify/CODE" className="auth-link-muted">
              🔍 Vérifier un diplôme publiquement
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
