import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme/theme';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/Auth/AuthContext';
import { NotificationProvider } from './components/Common/NotificationSystem';
import { FirebaseProvider } from './contexts/FirebaseContext';
import { GmailAuthProvider } from './contexts/GmailAuthContext';
import MainLayout from './components/Layout/MainLayout';
import LoginPage from './components/Auth/LoginPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import TestPage from './pages/Test/TestPage';
import CustomersPage from './pages/Customers/CustomersPage';
import OrdersPage from './pages/Orders/OrdersPage';
import NewOrderPage from './pages/Orders/NewOrderPage';
import WorkshopPage from './pages/Workshop/WorkshopPage';
import TreatmentPage from './pages/Treatment/TreatmentPage';
import MaterialCompaniesPage from './pages/MaterialCompanies/MaterialCompaniesPage';
import PlatformsPage from './pages/Platforms/PlatformsPage';
import InvoicePage from './pages/Invoice/InvoicePage';
import DataManagementPage from './pages/DataManagement/DataManagementPage';
import RapidInvoiceSettingsPage from './pages/RapidInvoice/RapidInvoiceSettingsPage';

const AppContent = () => {
  const { user, loading } = useAuth();

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

  if (!user) {
    return <LoginPage onLoginSuccess={() => {}} />;
  }

  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/test" element={<TestPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/new" element={<NewOrderPage />} />
        <Route path="/workshop" element={<WorkshopPage />} />
        <Route path="/treatment" element={<TreatmentPage />} />
        <Route path="/material-companies" element={<MaterialCompaniesPage />} />
        <Route path="/platforms" element={<PlatformsPage />} />
        <Route path="/invoices" element={<InvoicePage />} />
        <Route path="/data-management" element={<DataManagementPage />} />
        <Route path="/rapid-invoice-settings" element={<RapidInvoiceSettingsPage />} />
      </Routes>
    </MainLayout>
  );
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <AuthProvider>
        <FirebaseProvider>
          <NotificationProvider>
            <GmailAuthProvider>
              <Router>
                <AppContent />
              </Router>
            </GmailAuthProvider>
          </NotificationProvider>
        </FirebaseProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App; 