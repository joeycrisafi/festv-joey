import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';

import Landing from './pages/Landing';
import VendorPackages from './pages/VendorPackages';
import VendorAvailability from './pages/VendorAvailability';
import VendorSetup from './pages/VendorSetup';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ClientDashboard from './pages/ClientDashboard';
import ProviderDashboard from './pages/ProviderDashboard';
import CreateEventRequest from './pages/CreateEventRequest';
import BrowseProviders from './pages/BrowseProviders';
import ProviderProfile from './pages/ProviderProfile';
import EventRequestDetail from './pages/EventRequestDetail';
import BookingDetail from './pages/BookingDetail';
import EventRequestsList from './pages/EventRequestsList';
import BookingsList from './pages/BookingsList';
import BecomeProvider from './pages/BecomeProvider';
import UserProfile from './pages/UserProfile';
import ProviderMenu from './pages/ProviderMenu';
import ProviderBookings from './pages/ProviderBookings';
import ProviderQuotes from './pages/ProviderQuotes';
import ProviderEarnings from './pages/ProviderEarnings';
import Planner from './pages/Planner';
import EventDashboard from './pages/EventDashboard';
import AdminProviderVerification from './pages/AdminProviderVerification';
import AccountVerify from './pages/AccountVerify';
import QuoteDetail from './pages/QuoteDetail';
import CreateEvent from './pages/CreateEvent';
import EventDetail from './pages/EventDetail';

function ProtectedRoute({ children, allowedRoles }: { 
  children: React.ReactNode; 
  allowedRoles?: ('CLIENT' | 'PROVIDER' | 'ADMIN')[];
}) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gold border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { isAuthenticated, user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {/* Public routes */}
        <Route index element={
          isAuthenticated 
            ? <Navigate to={user?.role === 'PROVIDER' ? '/provider/dashboard' : '/dashboard'} replace />
            : <Landing />
        } />
        <Route path="login" element={
          isAuthenticated 
            ? <Navigate to={user?.role === 'PROVIDER' ? '/provider/dashboard' : '/dashboard'} replace />
            : <Login />
        } />
        <Route path="register" element={
          isAuthenticated 
            ? <Navigate to={user?.role === 'PROVIDER' ? '/provider/dashboard' : '/dashboard'} replace />
            : <Register />
        } />
        <Route path="forgot-password" element={
          isAuthenticated 
            ? <Navigate to={user?.role === 'PROVIDER' ? '/provider/dashboard' : '/dashboard'} replace />
            : <ForgotPassword />
        } />
        <Route path="reset-password" element={
          isAuthenticated 
            ? <Navigate to={user?.role === 'PROVIDER' ? '/provider/dashboard' : '/dashboard'} replace />
            : <ResetPassword />
        } />
        <Route path="providers" element={<BrowseProviders />} />
        <Route path="providers/:id" element={<ProviderProfile />} />

        {/* Client routes */}
        <Route path="dashboard" element={
          <ProtectedRoute allowedRoles={['CLIENT']}>
            <ClientDashboard />
          </ProtectedRoute>
        } />
        <Route path="create-request" element={
          <ProtectedRoute allowedRoles={['CLIENT']}>
            <CreateEventRequest />
          </ProtectedRoute>
        } />
        <Route path="event-requests" element={
          <ProtectedRoute allowedRoles={['CLIENT']}>
            <EventRequestsList />
          </ProtectedRoute>
        } />
        <Route path="event-requests/:id" element={
          <ProtectedRoute allowedRoles={['CLIENT']}>
            <EventRequestDetail />
          </ProtectedRoute>
        } />
        <Route path="bookings" element={
          <ProtectedRoute allowedRoles={['CLIENT']}>
            <BookingsList />
          </ProtectedRoute>
        } />
        <Route path="bookings/:id" element={
          <ProtectedRoute>
            <BookingDetail />
          </ProtectedRoute>
        } />
        <Route path="events/new" element={
          <ProtectedRoute allowedRoles={['CLIENT']}>
            <CreateEvent />
          </ProtectedRoute>
        } />
        <Route path="events/:id" element={
          <ProtectedRoute allowedRoles={['CLIENT']}>
            <EventDetail />
          </ProtectedRoute>
        } />
        <Route path="quotes/:id" element={
          <ProtectedRoute>
            <QuoteDetail />
          </ProtectedRoute>
        } />
        <Route path="become-provider" element={
          <ProtectedRoute>
            <BecomeProvider />
          </ProtectedRoute>
        } />
        <Route path="profile" element={
          <ProtectedRoute>
            <UserProfile />
          </ProtectedRoute>
        } />
        <Route path="account/verify" element={
          <ProtectedRoute>
            <AccountVerify />
          </ProtectedRoute>
        } />

        {/* Provider routes */}
        <Route path="provider/dashboard" element={
          <ProtectedRoute allowedRoles={['PROVIDER']}>
            <ProviderDashboard />
          </ProtectedRoute>
        } />
        <Route path="provider/menu" element={
          <ProtectedRoute allowedRoles={['PROVIDER']}>
            <ProviderMenu />
          </ProtectedRoute>
        } />
        <Route path="provider/bookings" element={
          <ProtectedRoute allowedRoles={['PROVIDER']}>
            <ProviderBookings />
          </ProtectedRoute>
        } />
        <Route path="provider/quotes" element={
          <ProtectedRoute allowedRoles={['PROVIDER']}>
            <ProviderQuotes />
          </ProtectedRoute>
        } />
        <Route path="provider/earnings" element={
          <ProtectedRoute allowedRoles={['PROVIDER']}>
            <ProviderEarnings />
          </ProtectedRoute>
        } />

        {/* New vendor package/setup routes */}
        <Route path="vendor/setup" element={
          <ProtectedRoute allowedRoles={['PROVIDER']}>
            <VendorSetup />
          </ProtectedRoute>
        } />
        <Route path="vendor/packages" element={
          <ProtectedRoute allowedRoles={['PROVIDER']}>
            <VendorPackages />
          </ProtectedRoute>
        } />
        <Route path="vendor/availability" element={
          <ProtectedRoute allowedRoles={['PROVIDER']}>
            <VendorAvailability />
          </ProtectedRoute>
        } />

        {/* Internal planner - email-gated */}
        <Route path="planner" element={
          <ProtectedRoute>
            <Planner />
          </ProtectedRoute>
        } />
        <Route path="database" element={
          <ProtectedRoute>
            <EventDashboard />
          </ProtectedRoute>
        } />
        <Route path="admin/providers" element={
          <ProtectedRoute>
            <AdminProviderVerification />
          </ProtectedRoute>
        } />
      </Route>
    </Routes>
  );
}

export default App;
