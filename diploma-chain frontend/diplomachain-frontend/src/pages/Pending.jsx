import { useLocation, Link } from "react-router-dom";
import { Clock, LogOut } from "lucide-react";

export default function Pending() {
  const { state } = useLocation();
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-0)",
        padding: 24,
      }}
    >
      <div
        className="card card-gold fade-in"
        style={{
          maxWidth: 460,
          width: "100%",
          textAlign: "center",
          padding: 40,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            background: "rgba(243,156,18,0.1)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <Clock size={28} style={{ color: "#f39c12" }} />
        </div>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 22,
            color: "var(--text-1)",
            marginBottom: 12,
          }}
        >
          Compte en cours de vérification
        </h2>
        <p
          style={{
            color: "var(--text-2)",
            fontSize: 14,
            lineHeight: 1.7,
            marginBottom: 24,
          }}
        >
          {state?.message ||
            "Votre compte est en cours de vérification par un administrateur. Vous recevrez une confirmation dès que votre identité aura été validée."}
        </p>
        <div
          style={{
            background: "var(--bg-3)",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 24,
            fontSize: 13,
            color: "var(--text-3)",
          }}
        >
          ⏱ Délai habituel : 24 à 48 heures
        </div>
        <Link
          to="/"
          className="btn btn-ghost"
          style={{ width: "100%", justifyContent: "center" }}
        >
          <LogOut size={15} /> Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}
