import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./AuthContext";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyPublic from "./pages/VerifyPublic";

import AdminDashboard from "./pages/admin/Dashboard";
import AdminUsers from "./pages/admin/Users";
import AdminInstitutions from "./pages/admin/Institutions";
import AdminStudents from "./pages/admin/Students";
import AdminAudit from "./pages/admin/Audit";

import InstitutionDashboard from "./pages/institution/Dashboard";
import InstitutionDiplomas from "./pages/institution/Diplomas";
import InstitutionTemplate from "./pages/institution/Template";
import InstitutionProfile from "./pages/institution/Profile";

import StudentDashboard from "./pages/student/Dashboard";
import StudentProfile from "./pages/student/Profile";

import Pending from "./pages/Pending";
import Rejected from "./pages/Rejected";

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          color: "var(--text-3)",
          fontFamily: "var(--font-body)",
        }}
      >
        Chargement...
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function RoleRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "admin") return <Navigate to="/admin" replace />;
  if (user.role === "institution")
    return <Navigate to="/institution" replace />;
  if (user.role === "student") return <Navigate to="/student" replace />;
  return <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify/:code" element={<VerifyPublic />} />
      <Route path="/" element={<Landing />} />

      {/* Admin */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={["admin"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute roles={["admin"]}>
            <AdminUsers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/institutions"
        element={
          <ProtectedRoute roles={["admin"]}>
            <AdminInstitutions />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/students"
        element={
          <ProtectedRoute roles={["admin"]}>
            <AdminStudents />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/audit"
        element={
          <ProtectedRoute roles={["admin"]}>
            <AdminAudit />
          </ProtectedRoute>
        }
      />

      {/* Institution */}
      <Route
        path="/institution"
        element={
          <ProtectedRoute roles={["institution"]}>
            <InstitutionDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/institution/diplomas"
        element={
          <ProtectedRoute roles={["institution"]}>
            <InstitutionDiplomas />
          </ProtectedRoute>
        }
      />
      <Route
        path="/institution/template"
        element={
          <ProtectedRoute roles={["institution"]}>
            <InstitutionTemplate />
          </ProtectedRoute>
        }
      />
      <Route
        path="/institution/profile"
        element={
          <ProtectedRoute roles={["institution"]}>
            <InstitutionProfile />
          </ProtectedRoute>
        }
      />

      {/* Student */}
      <Route
        path="/student"
        element={
          <ProtectedRoute roles={["student"]}>
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/profile"
        element={
          <ProtectedRoute roles={["student"]}>
            <StudentProfile />
          </ProtectedRoute>
        }
      />
      <Route path="/pending" element={<Pending />} />
      <Route path="/rejected" element={<Rejected />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "var(--bg-1)",
              color: "var(--text-1)",
              border: "1px solid var(--border)",
              fontFamily: "var(--font-body)",
              fontSize: "14px",
              boxShadow: "var(--shadow)",
            },
            success: {
              iconTheme: { primary: "#16a34a", secondary: "#ffffff" },
            },
            error: {
              iconTheme: { primary: "#dc2626", secondary: "#ffffff" },
            },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
