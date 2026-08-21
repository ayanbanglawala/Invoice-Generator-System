import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";
import BottomNav from "./components/BottomNav";
import Login from "./pages/Login";

// Every page except Login is lazy-loaded — each becomes its own JS chunk
// that's only downloaded the first time the user actually visits that
// route. This matters most for BillView/DealerBillView (which pull in
// jspdf + html2canvas) and Settings (which pulls in xlsx) — those are
// large libraries that were previously being downloaded on first load
// for every user, even ones who never generate a PDF or export Excel.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CreateBill = lazy(() => import("./pages/CreateBill"));
const BillView = lazy(() => import("./pages/BillView"));
const Customers = lazy(() => import("./pages/Customers"));
const CustomerLedger = lazy(() => import("./pages/CustomerLedger"));
const Parcels = lazy(() => import("./pages/Parcels"));
const DealerBills = lazy(() => import("./pages/DealerBills"));
const DealerBillView = lazy(() => import("./pages/DealerBillView"));
const Settings = lazy(() => import("./pages/Settings"));

function PageLoader() {
  return (
    <div className="flex h-[60vh] w-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-500" />
    </div>
  );
}

function Shell() {
  const { loggedIn } = useAuth();
  const location = useLocation();
  const hasOwnActionBar =
    location.pathname === "/bills/new" ||
    /^\/bills\/[^/]+$/.test(location.pathname) ||
    /^\/dealer-bills\/[^/]+$/.test(location.pathname);
  const showNav = loggedIn && location.pathname !== "/login" && !hasOwnActionBar;

  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bills/new"
            element={
              <ProtectedRoute>
                <CreateBill />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bills/:id"
            element={
              <ProtectedRoute>
                <BillView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <ProtectedRoute>
                <Customers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers/:id"
            element={
              <ProtectedRoute>
                <CustomerLedger />
              </ProtectedRoute>
            }
          />
          <Route
            path="/parcels"
            element={
              <ProtectedRoute>
                <Parcels />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dealer-bills"
            element={
              <ProtectedRoute>
                <DealerBills />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dealer-bills/:id"
            element={
              <ProtectedRoute>
                <DealerBillView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      {showNav && <BottomNav />}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
