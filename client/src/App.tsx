import { lazy, Suspense } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { Layout } from "./components/Layout";
import Admin from "./pages/Admin";
import Dashboard from "./pages/Dashboard";
import IssueDetail from "./pages/IssueDetail";
import Issues from "./pages/Issues";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import MapView from "./pages/MapView";
import MyReports from "./pages/MyReports";
import Register from "./pages/Register";
import ReportIssue from "./pages/ReportIssue";

const Analytics = lazy(() => import("./pages/Analytics"));

function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <p className="font-display text-8xl font-bold text-accent/30">404</p>
        <h1 className="mt-2 text-3xl font-semibold">This street does not exist</h1>
        <p className="mt-2 text-ink/60">The page you are looking for was moved or never existed.</p>
        <Link to="/" className="btn btn-primary mt-6">Back to home</Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/report" element={<ReportIssue />} />
          <Route path="/map" element={<MapView />} />
          <Route path="/issues/:id" element={<IssueDetail />} />
          <Route element={<ProtectedRoute roles={["citizen"]} />}>
            <Route path="/my-reports" element={<MyReports />} />
          </Route>
          <Route element={<ProtectedRoute roles={["officer", "admin"]} />}>
            <Route path="/issues" element={<Issues />} />
            <Route path="/analytics" element={<Suspense fallback={<div className="skeleton h-72 w-full" />}><Analytics /></Suspense>} />
          </Route>
          <Route element={<ProtectedRoute roles={["admin"]} />}>
            <Route path="/admin" element={<Admin />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
