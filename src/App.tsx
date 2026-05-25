import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import LoginPage from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import StaffDashboard from "./pages/StaffDashboard";
import StudiosPage from "./pages/Studios";
import UsersPage from "./pages/Staff";
import StudentsPage from "./pages/Students";
import BatchesPage from "./pages/Batches";
import EnrollmentsPage from "./pages/Enrollments";
import ApplicationCasesPage from "./pages/ApplicationCases";
import PaymentsPage from "./pages/Payments";
import AttendancePage from "./pages/Attendance";
import SettingsPage from "./pages/Settings";
import PlanCyclesPage from "./pages/PlanCycles";
import DropInsPage from "./pages/DropIns";
import ImportPage from "./pages/Import";
import RegisterPage from "./pages/Register";
import ConfirmCashPage from "./pages/ConfirmCash";
import ResetPasswordPage from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="text-muted-foreground">Loading...</div></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="text-muted-foreground">Loading...</div></div>;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function HomePage() {
  const { isAdminOrManager, staffUser } = useAuth();
  // If admin/manager or no staff record (superadmin), show full dashboard
  if (isAdminOrManager || !staffUser) return <Dashboard />;
  return <StaffDashboard />;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
    <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
    <Route path="/studios" element={<ProtectedRoute><StudiosPage /></ProtectedRoute>} />
    <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
    <Route path="/students" element={<ProtectedRoute><StudentsPage /></ProtectedRoute>} />
    <Route path="/batches" element={<ProtectedRoute><BatchesPage /></ProtectedRoute>} />
    <Route path="/plan-cycles" element={<ProtectedRoute><PlanCyclesPage /></ProtectedRoute>} />
    <Route path="/enrollments" element={<ProtectedRoute><EnrollmentsPage /></ProtectedRoute>} />
    <Route path="/application-cases" element={<ProtectedRoute><ApplicationCasesPage /></ProtectedRoute>} />
    <Route path="/drop-ins" element={<ProtectedRoute><DropInsPage /></ProtectedRoute>} />
    <Route path="/payments" element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>} />
    <Route path="/attendance" element={<ProtectedRoute><AttendancePage /></ProtectedRoute>} />
    <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
    <Route path="/import" element={<ProtectedRoute><ImportPage /></ProtectedRoute>} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/confirm-cash" element={<ConfirmCashPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <TestDateProvider>
            <AppRoutes />
          </TestDateProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
