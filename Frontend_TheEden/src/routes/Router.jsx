// src/routes/Router.jsx
import React from "react";
import { createBrowserRouter, Navigate, useLocation } from "react-router-dom";
import { useAuthContext } from "../context/AuthContext";

// Golfer
import GolferHomePage from "../pages/golfer/GolferHomePage.jsx";
import GolferBookingPage from "../pages/golfer/GolferBookingPage.jsx";
import ProfilePage from "../pages/golfer/ProfilePage.jsx";
import CheckoutSuccess from "../pages/golfer/CheckoutSuccess.jsx";
import UnauthorizedPage from "../pages/golfer/UnauthorizedPage.jsx";

// Auth
import LoginPage from "../pages/auth/LoginPage.jsx";
import RegisterPage from "../pages/auth/RegisterPage.jsx";
import StaffLoginPage from "../pages/auth/StaffLoginPage.jsx";

// Admin
import AdminDashboard from "../pages/admin/AdminDashboard.jsx";
import BookingTable from "../pages/admin/BookingTable.jsx";
import EmployeeDetail from "../pages/admin/EmployeeDetail.jsx";
import EmployeeForm from "../pages/admin/EmployeeForm.jsx";
import EmployeePage from "../components/admin/EmployeePage.jsx";

// Starter
import StarterLayout from "../layout/starterLayout.jsx";
import StarterDashboard from "../pages/starter/Dashboard.jsx";
import StarterReportPage from "../pages/starter/ReportPage.jsx";
import ReportConfirmPage from "../pages/starter/ReportConfirmPage.jsx";
import AddItem from "../pages/starter/AddItem.jsx";

// Caddie
import CaddieLayout from "../layout/caddieLayout.jsx";
import LandingPage from "../pages/Caddy/LandingPage.jsx";
import BookingPage from "../pages/Caddy/BookingPage.jsx";
import CaddyProfile from "../pages/Caddy/CaddyProfile.jsx";
import HistoryPage from "../pages/Caddy/HistoryPage.jsx";
import ProcessGolfPage from "../pages/Caddy/ProcessGolfPage.jsx";
import CaddieDashboard from "../pages/Caddy/Dashboard.jsx";
import DashboardStart from "../pages/Caddy/DashboardStart.jsx";

function RequireRole({ allowed = [], children }) {
  const { user } = useAuthContext();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname, reason: "auth" }} />;
  }
  if (!allowed.includes(user.role)) {
    return <Navigate to="/unauthorized" replace state={{ reason: "role" }} />;
  }
  return children;
}

const Router = createBrowserRouter([
  // Public / Golfer
  { path: "/", element: <GolferHomePage /> },

  // Booking flow
  { path: "/booking", element: <GolferBookingPage /> },
  { path: "/booking/success", element: <CheckoutSuccess /> },

  // Profile
  { path: "/profile", element: <ProfilePage /> },

  // Auth
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/staff/login", element: <StaffLoginPage /> },

  // Unauthorized
  { path: "/unauthorized", element: <UnauthorizedPage /> },

  // Starter
  {
    path: "/starter",
    element: (
      <RequireRole allowed={["starter"]}>
        <StarterLayout />
      </RequireRole>
    ),
    children: [
      { index: true, element: <StarterDashboard /> },
      { path: "dashboard", element: <StarterDashboard /> },
      { path: "report", element: <StarterReportPage /> },
      { path: "report/confirm", element: <ReportConfirmPage /> },
      { path: "additem", element: <AddItem /> },
    ],
  },

  // Caddie
  {
    element: (
      <RequireRole allowed={["caddy"]}>
        <CaddieLayout />
      </RequireRole>
    ),
    children: [
      { path: "/landing", element: <LandingPage /> },
      { path: "/caddy", element: <BookingPage /> },
      { path: "/caddy/booking", element: <BookingPage /> },
      { path: "/caddy/profile", element: <CaddyProfile /> },
      { path: "/caddy/history", element: <HistoryPage /> },
      { path: "/caddy/process", element: <ProcessGolfPage /> },
      { path: "/caddy/dashboard", element: <CaddieDashboard /> },
      { path: "/caddy/dashboard/start", element: <DashboardStart /> },
    ],
  },

  // Admin
  {
    path: "/admin",
    element: (
      <RequireRole allowed={["admin", "starter", "caddy"]}>
        <AdminDashboard />
      </RequireRole>
    ),
    children: [
      { index: true, element: <EmployeePage /> },
      { path: "booking", element: <BookingTable /> },
      { path: "add", element: <EmployeeForm /> },
      { path: "detail/:id", element: <EmployeeDetail /> },
    ],
  },

  // Fallback
  { path: "*", element: <Navigate to="/" replace /> },
]);

export default Router;
