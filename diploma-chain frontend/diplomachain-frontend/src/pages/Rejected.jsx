import { useLocation, Link } from "react-router-dom";
import { XCircle } from "lucide-react";

export default function Rejected() {
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
        className="card fade-in"
        style={{
          maxWidth: 460,
          width: "100%",
          textAlign: "center",
          padding: 40,
          borderColor: "rgba(231,76,60,0.3)",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            background: "rgba(231,76,60,0.1)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <XCircle size={28} style={{ color: "#e74c3c" }} />
        </div>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 22,
            color: "var(--text-1)",
            marginBottom: 12,
          }}
        >
          Compte refusé
        </h2>
        <p
          style={{
            color: "var(--text-2)",
            fontSize: 14,
            lineHeight: 1.7,
            marginBottom: 16,
          }}
        >
          Votre demande d'inscription a été refusée par un administrateur.
        </p>
        {state?.reason && (
          <div
            style={{
              background: "rgba(231,76,60,0.08)",
              border: "1px solid rgba(231,76,60,0.2)",
              borderRadius: 8,
              padding: "12px 16px",
              marginBottom: 24,
              fontSize: 13,
              color: "#e74c3c",
              textAlign: "left",
            }}
          >
            <strong>Motif :</strong> {state.reason}
          </div>
        )}
        <p style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 24 }}>
          Vous pouvez créer un nouveau compte avec des informations correctes.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <Link
            to="/register"
            className="btn btn-primary"
            style={{ flex: 1, justifyContent: "center" }}
          >
            Nouveau compte
          </Link>
          <Link
            to="/"
            className="btn btn-ghost"
            style={{ flex: 1, justifyContent: "center" }}
          >
            Accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
