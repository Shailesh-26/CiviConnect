import { Link, Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { Layout } from "./components/Layout";
import Admin from "./pages/Admin";
import Dashboard from "./pages/Dashboard";
import IssueDetail from "./pages/IssueDetail";
import Issues from "./pages/Issues";
import Login from "./pages/Login";
import MapView from "./pages/MapView";
import MyReports from "./pages/MyReports";
import Register from "./pages/Register";
import ReportIssue from "./pages/ReportIssue";

function NotFound() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-ink/70">
        <Link to="/" className="font-medium text-signboard underline">
          Go to the dashboard
        </Link>
      </p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/report" element={<ReportIssue />} />
          <Route path="/map" element={<MapView />} />
          <Route path="/issues/:id" element={<IssueDetail />} />
        </Route>
        <Route element={<ProtectedRoute roles={["citizen"]} />}>
          <Route path="/my-reports" element={<MyReports />} />
        </Route>
        <Route element={<ProtectedRoute roles={["officer", "admin"]} />}>
          <Route path="/issues" element={<Issues />} />
        </Route>
        <Route element={<ProtectedRoute roles={["admin"]} />}>
          <Route path="/admin" element={<Admin />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
