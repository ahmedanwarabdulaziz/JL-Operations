import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import theme from './theme/theme';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/Auth/AuthContext';
import { NotificationProvider } from './shared/components/Common/NotificationSystem';
import { FirebaseProvider } from './contexts/FirebaseContext';
import MainLayout from './components/Layout/MainLayout';
import AdminMainLayout from './admin/layouts/MainLayout';
import AdminMobileLayout from './admin-mobile/layouts/AdminMobileLayout';
import LoginPage from './components/Auth/LoginPage';
import DashboardPage from './admin/pages/Dashboard/DashboardPage';
import TestPage from './pages/Test/TestPage';
import EmailTestPage from './pages/Test/EmailTestPage';
import CustomersPage from './pages/Customers/CustomersPage';
import CorporateCustomersPage from './admin/pages/CorporateCustomers/CorporateCustomersPage';
import CorporateCustomerInvoicesPage from './admin/pages/CorporateCustomers/CorporateCustomerInvoicesPage';
import AllocationOrdersPage from './admin/pages/AllocationOrders/AllocationOrdersPage';
import OrdersPage from './pages/Orders/OrdersPage';
import NewOrderPage from './pages/Orders/NewOrderPage';
import CorporateOrderPage from './pages/Orders/CorporateOrderPage';
import WorkshopPage from './pages/Workshop/WorkshopPage';
import TreatmentPage from './pages/Treatment/TreatmentPage';
import MaterialCompaniesPage from './pages/MaterialCompanies/MaterialCompaniesPage';
import PlatformsPage from './pages/Platforms/PlatformsPage';
import InvoicePage from './admin/pages/Invoice/InvoicePage';
import CorporateInvoicesPage from './admin/pages/CorporateInvoices/CorporateInvoicesPage';
import TaxedInvoicesPage from './admin/pages/TaxedInvoices/TaxedInvoicesPage';
import DeleteTInvoicesPage from './admin/pages/TaxedInvoices/DeleteTInvoicesPage';
import MobileInvoicesPage from './admin-mobile/pages/Invoices/MobileInvoicesPage';

import FinancePage from './admin/pages/Finance/FinancePage';
import PLPage from './pages/Finance/PLPage';
import StatusManagementPage from './pages/StatusManagement/StatusManagementPage';
import DataManagementPage from './pages/DataManagement/DataManagementPage';
import EmailSettingsPage from './pages/EmailSettings/EmailSettingsPage';
import EndDonePage from './admin/pages/EndDone/EndDonePage';
import EndCancelledPage from './pages/EndCancelled/EndCancelledPage';
import PendingOrdersPage from './pages/PendingOrders/PendingOrdersPage';
import LeadFormPage from './pages/LeadFormPage/LeadFormPage';
import StandaloneLeadForm from './pages/StandaloneLeadForm/StandaloneLeadForm';
import PublicLeadForm from './pages/PublicLeadForm/PublicLeadForm';
import LeadsManagement from './pages/LeadsManagement/LeadsManagement';
import TestingFinancialPage from './pages/Finance/TestingFinancialPage';
import MaterialRequestPage from './admin/pages/MaterialRequest/MaterialRequestPage';
import ExtraExpensesPage from './pages/ExtraExpenses/ExtraExpensesPage';
import ControlPage from './admin/pages/Control/ControlPage';
import MigrationUtilityPage from './admin/pages/Migration/MigrationUtilityPage';

        // Website Management imports
        import AdminWebsiteLayout from './admin/layouts/WebsiteLayout';
        import ImageGalleryPage from './admin/pages/Website/ImageGalleryPage';
        import CategoryManagementPage from './admin/pages/Website/CategoryManagementPage';
        import TagManagementPage from './admin/pages/Website/TagManagementPage';
        import FurniturePiecesPage from './admin/pages/FurniturePieces/FurniturePiecesPage';

// Customer Invoices imports
import CustomerInvoicesPage from './admin/pages/CustomerInvoices/CustomerInvoicesPage';
import CreateInvoicePage from './admin/pages/CustomerInvoices/CreateInvoicePage';
import EditInvoicePage from './admin/pages/CustomerInvoices/EditInvoicePage';
import PrintInvoicePage from './admin/pages/CustomerInvoices/PrintInvoicePage';

// Website imports
import WebsiteLayout from './website/layouts/WebsiteLayout';
import HomePage from './website/pages/HomePage';
import ServicesPage from './website/pages/ServicesPage';
import AboutPage from './website/pages/AboutPage';
import ContactPage from './website/pages/ContactPage';

const AppContent = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Check if we're on the standalone form route
  const isStandaloneForm = location.pathname === '/standalone-form';

  // If it's the standalone form, render it without authentication
  if (isStandaloneForm) {
    return <PublicLeadForm />;
  }

  // Check if we're on a website route (public routes)
  const isWebsiteRoute = location.pathname === '/' || 
                        location.pathname === '/services' ||
                        location.pathname === '/about' ||
                        location.pathname === '/contact' ||
                        location.pathname === '/lead-form';

  // If it's a website route, render website layout without authentication
  if (isWebsiteRoute) {
    return (
      <WebsiteLayout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/lead-form" element={<LeadFormPage />} />
        </Routes>
      </WebsiteLayout>
    );
  }

  // Check if we're on a website management route (separate from main admin)
  const isWebsiteManagementRoute = location.pathname.startsWith('/admin/website');

  // Check if we're on the mobile admin experience
  const isAdminMobileRoute = location.pathname.startsWith('/admin/mobile');

  // Check if we're on an admin route (excluding website management)
  const isAdminRoute = location.pathname.startsWith('/admin') || 
                      location.pathname === '/test' ||
                      location.pathname === '/customers' ||
                      location.pathname === '/orders' ||
                      location.pathname === '/workshop' ||
                      location.pathname === '/treatment' ||
                      location.pathname === '/material-companies' ||
                      location.pathname === '/platforms' ||
                      location.pathname === '/invoices' ||
                      location.pathname === '/customer-invoices' ||
                      location.pathname === '/finance' ||
                      location.pathname === '/pl' ||
                      location.pathname === '/status-management' ||
                      location.pathname === '/data-management' ||
                      location.pathname === '/email-settings' ||
                      location.pathname === '/end-done' ||
                      location.pathname === '/end-cancelled' ||
                      location.pathname === '/leads' ||
                      location.pathname === '/extra-expenses';

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        Loading...
      </div>
    );
  }

  // If it's a website management route but user is not authenticated, redirect to login
  if (isWebsiteManagementRoute && !user) {
    return <LoginPage onLoginSuccess={() => {}} />;
  }

  // If it's a website management route and user is authenticated, render website management layout
  if (isWebsiteManagementRoute && user) {
    return (
            <AdminWebsiteLayout>
                <Routes>
                  <Route path="/admin/website" element={<ImageGalleryPage />} />
                  <Route path="/admin/website/images" element={<ImageGalleryPage />} />
                  <Route path="/admin/website/categories" element={<CategoryManagementPage />} />
                  <Route path="/admin/website/tags" element={<TagManagementPage />} />
                  <Route path="/admin/website/furniture-pieces" element={<FurniturePiecesPage />} />
                </Routes>
            </AdminWebsiteLayout>
    );
  }

  // If it's an admin route but user is not authenticated, redirect to login
  if (isAdminRoute && !user) {
    return <LoginPage onLoginSuccess={() => {}} />;
  }

  if (isAdminMobileRoute && user) {
    return (
      <AdminMobileLayout>
        <Routes>
          <Route path="/admin/mobile" element={<Navigate to="/admin/mobile/invoices" replace />} />
          <Route path="/admin/mobile/invoices" element={<MobileInvoicesPage />} />
        </Routes>
      </AdminMobileLayout>
    );
  }

  // If it's an admin route and user is authenticated, render admin layout
  if (isAdminRoute && user) {
    return (
      <AdminMainLayout>
        <Routes>
          {/* Redirect old admin routes to new /admin routes */}
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/admin" element={<DashboardPage />} />
          <Route path="/test" element={<Navigate to="/admin/test" replace />} />
          <Route path="/admin/test" element={<TestPage />} />
          <Route path="/admin/email-test" element={<EmailTestPage />} />
          <Route path="/customers" element={<Navigate to="/admin/customers" replace />} />
          <Route path="/admin/customers" element={<CustomersPage />} />
          <Route path="/admin/corporate-customers" element={<CorporateCustomersPage />} />
          <Route path="/admin/corporate-customers/:customerId/invoices" element={<CorporateCustomerInvoicesPage />} />
          <Route path="/admin/allocation-orders" element={<AllocationOrdersPage />} />
          <Route path="/orders" element={<Navigate to="/admin/orders" replace />} />
          <Route path="/admin/orders" element={<OrdersPage />} />
          <Route path="/orders/new" element={<Navigate to="/admin/orders/new" replace />} />
          <Route path="/admin/orders/new" element={<NewOrderPage />} />
          <Route path="/admin/orders/corporate" element={<CorporateOrderPage />} />
          <Route path="/workshop" element={<Navigate to="/admin/workshop" replace />} />
          <Route path="/admin/workshop" element={<WorkshopPage />} />
          <Route path="/material-request" element={<Navigate to="/admin/material-request" replace />} />
          <Route path="/admin/material-request" element={<MaterialRequestPage />} />
          <Route path="/treatment" element={<Navigate to="/admin/treatment" replace />} />
          <Route path="/admin/treatment" element={<TreatmentPage />} />
          <Route path="/material-companies" element={<Navigate to="/admin/material-companies" replace />} />
          <Route path="/admin/material-companies" element={<MaterialCompaniesPage />} />
          <Route path="/platforms" element={<Navigate to="/admin/platforms" replace />} />
          <Route path="/admin/platforms" element={<PlatformsPage />} />
          <Route path="/invoices" element={<Navigate to="/admin/invoices" replace />} />
          <Route path="/admin/invoices" element={<InvoicePage />} />
          <Route path="/admin/corporate-invoices" element={<CorporateInvoicesPage />} />
          <Route path="/admin/taxed-invoices" element={<TaxedInvoicesPage />} />
          <Route path="/admin/taxed-invoices/delete-t-invoices" element={<DeleteTInvoicesPage />} />
          
          {/* Customer Invoices Routes */}
          <Route path="/customer-invoices" element={<Navigate to="/admin/customer-invoices" replace />} />
          <Route path="/admin/customer-invoices" element={<CustomerInvoicesPage />} />
          <Route path="/admin/customer-invoices/create" element={<CreateInvoicePage />} />
          <Route path="/admin/customer-invoices/edit" element={<EditInvoicePage />} />
          <Route path="/admin/customer-invoices/print" element={<PrintInvoicePage />} />

          <Route path="/finance" element={<Navigate to="/admin/finance" replace />} />
          <Route path="/admin/finance" element={<FinancePage />} />
          <Route path="/pl" element={<Navigate to="/admin/pl" replace />} />
          <Route path="/admin/pl" element={<PLPage />} />
          <Route path="/status-management" element={<Navigate to="/admin/status-management" replace />} />
          <Route path="/admin/status-management" element={<StatusManagementPage />} />
          <Route path="/data-management" element={<Navigate to="/admin/data-management" replace />} />
          <Route path="/admin/data-management" element={<DataManagementPage />} />
          <Route path="/admin/control" element={<ControlPage />} />
          <Route path="/admin/migration" element={<MigrationUtilityPage />} />
          <Route path="/email-settings" element={<Navigate to="/admin/email-settings" replace />} />
          <Route path="/admin/email-settings" element={<EmailSettingsPage />} />
          <Route path="/end-done" element={<Navigate to="/admin/end-done" replace />} />
          <Route path="/admin/end-done" element={<EndDonePage />} />
          <Route path="/end-cancelled" element={<Navigate to="/admin/end-cancelled" replace />} />
          <Route path="/admin/end-cancelled" element={<EndCancelledPage />} />
          <Route path="/pending-orders" element={<Navigate to="/admin/pending-orders" replace />} />
          <Route path="/admin/pending-orders" element={<PendingOrdersPage />} />
          <Route path="/leads" element={<Navigate to="/admin/leads" replace />} />
          <Route path="/admin/leads" element={<LeadsManagement />} />
          <Route path="/extra-expenses" element={<Navigate to="/admin/extra-expenses" replace />} />
          <Route path="/admin/extra-expenses" element={<ExtraExpensesPage />} />
          <Route path="/admin/testing-financial" element={<TestingFinancialPage />} />
        </Routes>
      </AdminMainLayout>
    );
  }

  // Default fallback - redirect to website home
  return <Navigate to="/" replace />;
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <FirebaseProvider>
          <NotificationProvider>
            <Router>
              <AppContent />
            </Router>
          </NotificationProvider>
        </FirebaseProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App; 