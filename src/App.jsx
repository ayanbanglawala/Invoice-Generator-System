import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";
import BottomNav from "./components/BottomNav";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CreateBill from "./pages/CreateBill";
import BillView from "./pages/BillView";
import Customers from "./pages/Customers";
import CustomerLedger from "./pages/CustomerLedger";
import Parcels from "./pages/Parcels";
import DealerBills from "./pages/DealerBills";
import DealerBillView from "./pages/DealerBillView";
import Settings from "./pages/Settings";

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
