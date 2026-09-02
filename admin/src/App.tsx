import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { hasToken } from './lib/api';
import Layout from './components/Layout';
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import UsersPage from './pages/Users';
import TripsPage from './pages/Trips';
import BookingsPage from './pages/Bookings';
import PaymentsPage from './pages/Payments';
import SafetyPage from './pages/Safety';
import AuditLogPage from './pages/AuditLog';
import SystemConfigPage from './pages/SystemConfig';
import TrustSafetyPage from './pages/TrustSafety';
import DriverDocsPage from './pages/DriverDocs';
import VehicleReviewPage from './pages/VehicleReview';
import NotificationsPage from './pages/Notifications';
import SubscriptionsPage from './pages/Subscriptions';
import SupportTicketsPage from './pages/SupportTickets';
import DriverEarningsPage from './pages/DriverEarnings';
import ComplianceLogsPage from './pages/ComplianceLogs';
import AgentsPage from './pages/Agents';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!hasToken()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="trips" element={<TripsPage />} />
          <Route path="bookings" element={<BookingsPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="safety" element={<SafetyPage />} />
          <Route path="audit" element={<AuditLogPage />} />
          <Route path="config" element={<SystemConfigPage />} />
          <Route path="trust-safety" element={<TrustSafetyPage />} />
          <Route path="driver-docs" element={<DriverDocsPage />} />
          <Route path="vehicle-review" element={<VehicleReviewPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="subscriptions" element={<SubscriptionsPage />} />
          <Route path="support-tickets" element={<SupportTicketsPage />} />
          <Route path="driver-earnings" element={<DriverEarningsPage />} />
          <Route path="compliance-logs" element={<ComplianceLogsPage />} />
          <Route path="agents" element={<AgentsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
