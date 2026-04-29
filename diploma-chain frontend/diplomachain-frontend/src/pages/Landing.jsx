import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { diplomaApi } from "../api";
import {
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Shield,
  Building2,
  GraduationCap,
  ChevronRight,
  Lock,
  LogOut,
  LayoutDashboard,
  FileCheck,
  Cpu,
  Globe,
  QrCode,
} from "lucide-react";
import toast from "react-hot-toast";
import "./Landing.css";

export default function Landing() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verifyMode, setVerifyMode] = useState("code");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setScanning(true);
    } catch {
      toast.error("Impossible d'accéder à la caméra");
    }
  };

  const stopCamera = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    if (!scanning || !videoRef.current) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const tick = () => {
      if (!videoRef.current || !streamRef.current) return;
      if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);
        if ("BarcodeDetector" in window) {
          const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
          detector
            .detect(canvas)
            .then((codes) => {
              if (codes.length > 0) {
                const raw = codes[0].rawValue;
                const match = raw.match(
                  /DC-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/,
                );
                if (match) {
                  stopCamera();
                  setVerifyMode("code");
                  setCode(match[0]);
                  doVerify(match[0]);
                }
              }
            })
            .catch(() => {});
        }
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [scanning]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const doVerify = async (target) => {
    const val = target || code;
    if (!val || !val.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const { data } = await diplomaApi.verify(val.trim().toUpperCase());
      setResult(data);
    } catch {
      setResult({
        valid: false,
        reason: "Diplôme introuvable ou code invalide",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = (e) => {
    e.preventDefault();
    doVerify(code);
  };

  const handleLogout = () => {
    logout();
    toast.success("Déconnecté");
  };

  const dashboardPath = !user
    ? "/login"
    : user.role === "admin"
      ? "/admin"
      : user.role === "institution"
        ? "/institution"
        : "/student";

  return (
    <div className="landing">
      {/* NAVBAR */}
      <nav className="landing-nav">
        <div className="nav-logo">
          <div className="nav-logo-mark">DC</div>
          <span className="nav-logo-name">DiplomaChain</span>
        </div>
        <div className="nav-actions">
          {user ? (
            <div className="nav-user">
              <div className="nav-user-info">
                <div className="nav-user-role">{user.role}</div>
                <div className="nav-user-email">{user.email}</div>
              </div>
              <Link to={dashboardPath} className="btn btn-primary btn-sm">
                <LayoutDashboard size={14} /> Mon espace
              </Link>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <Link to="/login" className="btn btn-ghost btn-sm">
                Se connecter
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Créer un compte
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-glow" />
        <div className="hero-content">
          <div className="hero-badge">
            <Cpu size={13} />
            <span>Propulsé par Hedera Hashgraph</span>
          </div>
          <h1 className="hero-title">
            Des diplômes
            <br />
            <span className="hero-title-gold">infalsifiables</span>
            <br />
            sur blockchain
          </h1>
          <p className="hero-desc">
            DiplomaChain ancre chaque diplôme sur la blockchain Hedera. Vérifiez
            l'authenticité d'un diplôme en quelques secondes, depuis n'importe
            où dans le monde.
          </p>

          {/* VERIFICATION ZONE */}
          <div className="verify-zone">
            <div className="verify-tabs">
              <button
                className={`verify-tab ${verifyMode === "code" ? "active" : ""}`}
                onClick={() => {
                  setVerifyMode("code");
                  setResult(null);
                  stopCamera();
                }}
              >
                <Search size={14} /> Code unique
              </button>
              <button
                className={`verify-tab ${verifyMode === "qr" ? "active" : ""}`}
                onClick={() => {
                  setVerifyMode("qr");
                  setResult(null);
                }}
              >
                <QrCode size={14} /> Scanner QR
              </button>
            </div>

            {verifyMode === "code" ? (
              <form className="verify-form-row" onSubmit={handleVerifySubmit}>
                <input
                  className="input verify-input mono"
                  placeholder="DC-XXXX-XXXX-XXXX"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  style={{ letterSpacing: "0.08em" }}
                />
                <button
                  className="btn btn-primary btn-lg"
                  type="submit"
                  disabled={loading || !code}
                >
                  {loading ? (
                    <span className="spinner" />
                  ) : (
                    <Search size={17} />
                  )}
                  Vérifier
                </button>
              </form>
            ) : (
              <div className="qr-scanner-zone">
                <div className="qr-scanner-box">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="qr-video"
                  />
                  <div className="qr-overlay">
                    <div className="qr-corner tl" />
                    <div className="qr-corner tr" />
                    <div className="qr-corner bl" />
                    <div className="qr-corner br" />
                    {scanning && <div className="qr-scanline" />}
                  </div>
                </div>
                <p className="qr-hint">
                  {scanning
                    ? "📷 Pointez la caméra vers le QR code du diplôme..."
                    : "Cliquez pour démarrer la caméra"}
                </p>
                {!scanning ? (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={startCamera}
                  >
                    Démarrer la caméra
                  </button>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={stopCamera}>
                    Arrêter
                  </button>
                )}
              </div>
            )}

            {/* RESULT */}
            {result !== null && (
              <div
                className={`verify-result-inline fade-in ${
                  result.valid
                    ? "res-valid"
                    : result.reason && result.reason.includes("révoqué")
                      ? "res-revoked"
                      : "res-invalid"
                }`}
              >
                <div className="res-icon">
                  {result.valid ? (
                    <CheckCircle size={22} />
                  ) : result.reason && result.reason.includes("révoqué") ? (
                    <XCircle size={22} />
                  ) : (
                    <AlertCircle size={22} />
                  )}
                </div>
                <div className="res-body">
                  <div className="res-title">
                    {result.valid
                      ? "Diplôme authentique ✓"
                      : result.reason && result.reason.includes("révoqué")
                        ? "Diplôme révoqué"
                        : "Diplôme introuvable"}
                  </div>
                  {result.valid && (
                    <div className="res-details">
                      {result.degree_title && (
                        <span>{result.degree_title}</span>
                      )}
                      {result.honors && (
                        <span className="res-mention">{result.honors}</span>
                      )}
                      {result.field_of_study && (
                        <span>{result.field_of_study}</span>
                      )}
                      {result.blockchain_anchored && (
                        <span className="res-chain">⛓ Ancré sur Hedera</span>
                      )}
                    </div>
                  )}
                  {!result.valid && result.reason && (
                    <div style={{ fontSize: 13, opacity: 0.8 }}>
                      {result.reason}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* STATS */}
        <div className="hero-stats">
          {[
            { value: "100%", label: "Infalsifiable" },
            { value: "3s", label: "Consensus Hedera" },
            { value: "SHA-256", label: "Intégrité" },
            { value: "Public", label: "Vérification" },
          ].map((s, i) => (
            <div key={i} className="hero-stat">
              <div className="hero-stat-value">{s.value}</div>
              <div className="hero-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section">
        <div className="section-container">
          <div className="section-header">
            <h2 className="section-title">Comment ça fonctionne</h2>
            <p className="section-sub">
              Un processus simple, sécurisé et transparent
            </p>
          </div>
          <div className="steps-grid">
            {[
              {
                num: "01",
                icon: <GraduationCap size={22} />,
                title: "L'étudiant crée son profil",
                desc: "L'étudiant s'inscrit et soumet ses informations d'identité. Un administrateur vérifie et valide son identité via sa CIN.",
                color: "#3498db",
              },
              {
                num: "02",
                icon: <Building2 size={22} />,
                title: "L'institution émet le diplôme",
                desc: "L'institution approuvée crée le diplôme et l'émet officiellement. Le diplôme est ancré en temps réel sur Hedera.",
                color: "#c9a84c",
              },
              {
                num: "03",
                icon: <FileCheck size={22} />,
                title: "Vérification instantanée",
                desc: "N'importe qui peut vérifier l'authenticité d'un diplôme via son code unique ou en scannant le QR code.",
                color: "#2ecc71",
              },
              {
                num: "04",
                icon: <Globe size={22} />,
                title: "Preuve blockchain mondiale",
                desc: "Chaque diplôme est ancré sur Hedera Hashgraph — un registre distribué immuable accessible publiquement.",
                color: "#9b59b6",
              },
            ].map((s, i) => (
              <div key={i} className="step-card">
                <div className="step-num" style={{ color: s.color }}>
                  {s.num}
                </div>
                <div
                  className="step-icon"
                  style={{ background: `${s.color}18`, color: s.color }}
                >
                  {s.icon}
                </div>
                <h3 className="step-title">{s.title}</h3>
                <p className="step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PORTALS */}
      <section className="section section-dark">
        <div className="section-container">
          <div className="section-header">
            <h2 className="section-title">Accédez à votre espace</h2>
            <p className="section-sub">
              Chaque rôle dispose d'un espace dédié et sécurisé
            </p>
          </div>
          <div className="portals-grid">
            <div className="portal-card portal-institution">
              <div className="portal-icon-wrap">
                <Building2 size={28} />
              </div>
              <h3 className="portal-title">Espace Institution</h3>
              <p className="portal-desc">
                Émettez des diplômes officiels, gérez vos templates PDF, suivez
                vos certifications sur blockchain.
              </p>
              <ul className="portal-features">
                <li>
                  <CheckCircle size={13} /> Créer et émettre des diplômes
                </li>
                <li>
                  <CheckCircle size={13} /> Upload de template PDF personnalisé
                </li>
                <li>
                  <CheckCircle size={13} /> Ancrage automatique sur Hedera
                </li>
                <li>
                  <CheckCircle size={13} /> Génération de QR codes
                </li>
              </ul>
              {user && user.role === "institution" ? (
                <Link to="/institution" className="btn btn-primary portal-btn">
                  <LayoutDashboard size={16} /> Mon tableau de bord
                </Link>
              ) : (
                <Link to="/login" className="btn btn-primary portal-btn">
                  <Lock size={16} /> Se connecter <ChevronRight size={15} />
                </Link>
              )}
            </div>

            <div className="portal-card portal-student">
              <div className="portal-icon-wrap">
                <GraduationCap size={28} />
              </div>
              <h3 className="portal-title">Espace Étudiant</h3>
              <p className="portal-desc">
                Consultez vos diplômes certifiés, téléchargez vos PDFs et
                partagez vos QR codes avec vos employeurs.
              </p>
              <ul className="portal-features">
                <li>
                  <CheckCircle size={13} /> Voir mes diplômes certifiés
                </li>
                <li>
                  <CheckCircle size={13} /> Télécharger le PDF officiel
                </li>
                <li>
                  <CheckCircle size={13} /> Partager via QR code
                </li>
                <li>
                  <CheckCircle size={13} /> Profil vérifié par l'admin
                </li>
              </ul>
              {user && user.role === "student" ? (
                <Link to="/student" className="btn btn-primary portal-btn">
                  <LayoutDashboard size={16} /> Mon tableau de bord
                </Link>
              ) : (
                <Link to="/login" className="btn btn-primary portal-btn">
                  <Lock size={16} /> Se connecter <ChevronRight size={15} />
                </Link>
              )}
            </div>

            <div className="portal-card portal-admin">
              <div className="portal-icon-wrap">
                <Shield size={28} />
              </div>
              <h3 className="portal-title">Espace Admin</h3>
              <p className="portal-desc">
                Supervisez la plateforme, approuvez les institutions, validez
                les identités et consultez les logs d'audit.
              </p>
              <ul className="portal-features">
                <li>
                  <CheckCircle size={13} /> Approuver les institutions
                </li>
                <li>
                  <CheckCircle size={13} /> Valider les identités étudiants
                </li>
                <li>
                  <CheckCircle size={13} /> Statistiques globales
                </li>
                <li>
                  <CheckCircle size={13} /> Logs d'audit complets
                </li>
              </ul>
              {user && user.role === "admin" ? (
                <Link to="/admin" className="btn btn-primary portal-btn">
                  <LayoutDashboard size={16} /> Mon tableau de bord
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="btn portal-btn"
                  style={{
                    background: "var(--bg-3)",
                    color: "var(--text-2)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <Lock size={16} /> Accès restreint
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section className="section">
        <div className="section-container">
          <div className="security-grid">
            <div className="security-text">
              <h2
                className="section-title"
                style={{ textAlign: "left", marginBottom: 16 }}
              >
                Sécurité de bout en bout
              </h2>
              <p
                style={{
                  color: "var(--text-2)",
                  fontSize: 15,
                  lineHeight: 1.8,
                  marginBottom: 24,
                }}
              >
                DiplomaChain utilise les technologies cryptographiques les plus
                avancées pour garantir l'intégrité et l'authenticité de chaque
                diplôme émis.
              </p>
              <div className="security-items">
                {[
                  {
                    label: "Hachage SHA-256",
                    desc: "Empreinte cryptographique unique de chaque diplôme",
                  },
                  {
                    label: "JWT HS256",
                    desc: "Authentification sécurisée avec tokens signés",
                  },
                  {
                    label: "AES-256",
                    desc: "Données personnelles chiffrées en base de données",
                  },
                  {
                    label: "Hedera HCS",
                    desc: "Ancrage immuable sur blockchain publique",
                  },
                ].map((s, i) => (
                  <div key={i} className="security-item">
                    <div className="security-dot" />
                    <div>
                      <div className="security-label">{s.label}</div>
                      <div className="security-desc">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="security-visual">
              <div className="security-card">
                <div className="sec-card-header">
                  <span
                    className="mono"
                    style={{ fontSize: 12, color: "var(--gold)" }}
                  >
                    diploma.verify()
                  </span>
                </div>
                <div className="sec-card-body">
                  {[
                    ["unique_code", '"DC-6PCX-T3DR-HXEU"', "#c9a84c"],
                    ["valid", "true", "#2ecc71"],
                    ["blockchain_anchored", "true", "#2ecc71"],
                    ["hedera_tx", '"0.0.1234@..."', "#3498db"],
                    ["sha256_hash", '"3847fe28..."', "#9b59b6"],
                  ].map(([k, v, c], i) => (
                    <div key={i} className="sec-line">
                      <span style={{ color: "var(--text-3)" }}>{k}:</span>
                      <span style={{ color: c }} className="mono">
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="footer-logo">
          <div
            className="nav-logo-mark"
            style={{ width: 28, height: 28, fontSize: 11 }}
          >
            DC
          </div>
          <span style={{ color: "var(--text-3)", fontSize: 13 }}>
            DiplomaChain — Blockchain Certificate Platform
          </span>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-3)" }}>
          Hedera Hashgraph Testnet · SHA-256 · AES-256
        </div>
      </footer>
    </div>
  );
}
