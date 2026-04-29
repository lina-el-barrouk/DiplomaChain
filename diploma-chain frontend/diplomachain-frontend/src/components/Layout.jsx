import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { authApi } from "../api";
import toast from "react-hot-toast";
import {
  LayoutDashboard,
  Users,
  Building2,
  GraduationCap,
  FileText,
  ScrollText,
  Settings,
  LogOut,
  Shield,
  BookOpen,
  Upload,
  User,
  ClipboardList,
} from "lucide-react";
import "./Layout.css";

const menus = {
  admin: [
    {
      to: "/admin",
      icon: LayoutDashboard,
      label: "Tableau de bord",
      end: true,
    },
    { to: "/admin/institutions", icon: Building2, label: "Institutions" },
    { to: "/admin/students", icon: GraduationCap, label: "Étudiants" },
    { to: "/admin/users", icon: Users, label: "Utilisateurs" },
    { to: "/admin/audit", icon: ClipboardList, label: "Audit logs" },
  ],
  institution: [
    {
      to: "/institution",
      icon: LayoutDashboard,
      label: "Tableau de bord",
      end: true,
    },
    { to: "/institution/diplomas", icon: ScrollText, label: "Diplômes" },
    { to: "/institution/template", icon: Upload, label: "Template PDF" },
    { to: "/institution/profile", icon: Settings, label: "Mon profil" },
  ],
  student: [
    { to: "/student", icon: LayoutDashboard, label: "Mes diplômes", end: true },
    { to: "/student/profile", icon: User, label: "Mon profil" },
  ],
};

const roleLabels = {
  admin: "Administrateur",
  institution: "Institution",
  student: "Étudiant",
};

const roleIcons = {
  admin: Shield,
  institution: Building2,
  student: GraduationCap,
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = menus[user?.role] || [];
  const RoleIcon = roleIcons[user?.role] || User;

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {}
    logout();
    navigate("/");
    toast.success("Déconnecté");
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">DC</div>
          <div>
            <div className="logo-name">DiplomaChain</div>
            <div className="logo-sub">Blockchain Certificates</div>
          </div>
        </div>

        <div className="sidebar-role">
          <RoleIcon size={14} />
          <span>{roleLabels[user?.role]}</span>
        </div>

        <nav className="sidebar-nav">
          {items.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon size={17} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-email">{user?.email}</div>
          <button
            className="btn btn-ghost btn-sm logout-btn"
            onClick={handleLogout}
          >
            <LogOut size={15} />
            Déconnexion
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="content-inner">{children}</div>
      </main>
    </div>
  );
}
