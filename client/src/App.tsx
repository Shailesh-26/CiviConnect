import { Suspense, useEffect, type ReactNode } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { Layout } from "./components/Layout";
import { lazyPage } from "./lib/lazyPage";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";

// Every other page is downloaded only when needed, then fetched quietly in the background
// after the first screen has loaded, so moving between pages stays instant.
const pages = {
  Admin: lazyPage(() => import("./pages/Admin")),
  Analytics: lazyPage(() => import("./pages/Analytics")),
  Dashboard: lazyPage(() => import("./pages/Dashboard")),
  ForgotPassword: lazyPage(() => import("./pages/ForgotPassword")),
  Insights: lazyPage(() => import("./pages/Insights")),
  IssueDetail: lazyPage(() => import("./pages/IssueDetail")),
  Issues: lazyPage(() => import("./pages/Issues")),
  MapView: lazyPage(() => import("./pages/MapView")),
  MyReports: lazyPage(() => import("./pages/MyReports")),
  Neighbourhood: lazyPage(() => import("./pages/Neighbourhood")),
  Profile: lazyPage(() => import("./pages/Profile")),
  PublicIssue: lazyPage(() => import("./pages/PublicIssue")),
  ReportIssue: lazyPage(() => import("./pages/ReportIssue")),
  ResetPassword: lazyPage(() => import("./pages/ResetPassword")),
};
const Admin = pages.Admin.Page;
const Analytics = pages.Analytics.Page;
const Dashboard = pages.Dashboard.Page;
const ForgotPassword = pages.ForgotPassword.Page;
const Insights = pages.Insights.Page;
const IssueDetail = pages.IssueDetail.Page;
const Issues = pages.Issues.Page;
const MapView = pages.MapView.Page;
const MyReports = pages.MyReports.Page;
const Neighbourhood = pages.Neighbourhood.Page;
const Profile = pages.Profile.Page;
const PublicIssue = pages.PublicIssue.Page;
const ReportIssue = pages.ReportIssue.Page;
const ResetPassword = pages.ResetPassword.Page;

let preloaded = false;
// Other pages are fetched in the background one at a time, so they never take bandwidth from the page
// and data you are waiting for. On a slow or data-saving connection they are not fetched ahead at all.
async function preloadPages() {
  if (preloaded) return;
  preloaded = true;
  const net = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (net?.saveData || /(^|-)2g|3g/.test(net?.effectiveType ?? "")) return;
  for (const page of Object.values(pages)) await page.preload().catch(() => undefined);
}

// Shown only if a page takes more than a moment to arrive (slow network, first visit).
function PageLoading() {
  return (
    <div className="cc-defer space-y-4" aria-busy="true" aria-label="Loading page">
      <div className="skeleton h-9 w-56" />
      <div className="skeleton h-4 w-80 max-w-full" />
      <div className="skeleton h-64 w-full" />
    </div>
  );
}

function Page({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageLoading />}>{children}</Suspense>;
}

function FullPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="grid min-h-screen place-items-center"><div className="cc-defer skeleton h-40 w-80 max-w-[90vw]" /></div>}>{children}</Suspense>;
}

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
  // Not on the landing page, so its animations never compete with the download.
  const onLanding = useLocation().pathname === "/";
  useEffect(() => {
    if (onLanding || preloaded) return;
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const id = idle(() => void preloadPages(), { timeout: 3000 });
    return () => cancel(id);
  }, [onLanding]);

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<FullPage><ForgotPassword /></FullPage>} />
      <Route path="/reset-password" element={<FullPage><ResetPassword /></FullPage>} />
      <Route path="/i/:ticket" element={<FullPage><PublicIssue /></FullPage>} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Page><Dashboard /></Page>} />
          <Route path="/report" element={<Page><ReportIssue /></Page>} />
          <Route path="/map" element={<Page><MapView /></Page>} />
          <Route path="/issues/:id" element={<Page><IssueDetail /></Page>} />
          <Route path="/profile" element={<Page><Profile /></Page>} />
          <Route path="/neighbourhood" element={<Page><Neighbourhood /></Page>} />
          <Route path="/insights" element={<Page><Insights /></Page>} />
          <Route element={<ProtectedRoute roles={["citizen"]} />}>
            <Route path="/my-reports" element={<Page><MyReports /></Page>} />
          </Route>
          <Route element={<ProtectedRoute roles={["officer", "admin"]} />}>
            <Route path="/issues" element={<Page><Issues /></Page>} />
            <Route path="/analytics" element={<Page><Analytics /></Page>} />
          </Route>
          <Route element={<ProtectedRoute roles={["admin"]} />}>
            <Route path="/admin" element={<Page><Admin /></Page>} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
