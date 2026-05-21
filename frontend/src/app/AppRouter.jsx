import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './AppShell';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import RoleGuard from '../components/auth/RoleGuard';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import SalesPage from '../pages/SalesPage';
import SalesReturnPage from '../pages/SalesReturnPage';
import PurchaseReturnPage from '../pages/PurchaseReturnPage';
import UnauthorizedPage from '../pages/UnauthorizedPage';
import UserManagementPage from '../pages/UserManagementPage';
import AccessRightsPage from '../pages/AccessRightsPage';
import ProductManagementPage from '../pages/ProductManagementPage';
import ProductCategoriesPage from '../pages/ProductCategoriesPage';
import ProductTypesPage from '../pages/ProductTypesPage';
import ProductUnitsPage from '../pages/ProductUnitsPage';
import ProductAttributesPage from '../pages/ProductAttributesPage';
import ProductVariantsPage from '../pages/ProductVariantsPage';
import ProductBranchSettingsPage from '../pages/ProductBranchSettingsPage';
import InventoryPage from '../pages/InventoryPage';
import ContactManagementPage from '../pages/ContactManagementPage';
import LedgerPage from '../pages/LedgerPage';
import ReceivablesPage from '../pages/ReceivablesPage';
import PayablesPage from '../pages/PayablesPage';
import PurchasePage from '../pages/PurchasePage';
import FifoStockReportPage from '../pages/FifoStockReportPage';
import ProductHistoryPage from '../pages/ProductHistoryPage';
import CashBookPage from '../pages/CashBookPage';
import TradingRegisterPage from '../pages/TradingRegisterPage';
import CashVoucherPage from '../pages/CashVoucherPage';
import CompanySettingsPage from '../pages/CompanySettingsPage';
import PaymentAccountsPage from '../pages/PaymentAccountsPage';

function PlaceholderPage({ title }) {
  return <h2>{title} module will be added incrementally.</h2>;
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route
          path="/sales"
          element={
            <RoleGuard allowedRoles={['main_admin', 'branch_admin', 'staff']}>
              <SalesPage />
            </RoleGuard>
          }
        />
        <Route
          path="/sales/new"
          element={
            <RoleGuard allowedRoles={['main_admin', 'branch_admin', 'staff']}>
              <SalesPage createMode />
            </RoleGuard>
          }
        />
        <Route
          path="/sales-returns"
          element={
            <RoleGuard allowedRoles={['main_admin', 'branch_admin', 'staff']}>
              <SalesReturnPage />
            </RoleGuard>
          }
        />
        <Route
          path="/purchase"
          element={
            <RoleGuard allowedRoles={['main_admin', 'branch_admin', 'staff']}>
              <PurchasePage />
            </RoleGuard>
          }
        />
        <Route
          path="/purchase/new"
          element={
            <RoleGuard allowedRoles={['main_admin', 'branch_admin', 'staff']}>
              <PurchasePage createMode />
            </RoleGuard>
          }
        />
        <Route
          path="/purchase-returns"
          element={
            <RoleGuard allowedRoles={['main_admin', 'branch_admin', 'staff']}>
              <PurchaseReturnPage />
            </RoleGuard>
          }
        />
        <Route
          path="/inventory"
          element={
            <RoleGuard allowedRoles={['main_admin', 'branch_admin', 'staff']}>
              <InventoryPage />
            </RoleGuard>
          }
        />
        <Route
          path="/fifo-stock-report"
          element={
            <RoleGuard allowedRoles={['main_admin', 'branch_admin', 'staff']}>
              <FifoStockReportPage />
            </RoleGuard>
          }
        />
        <Route
          path="/product-history"
          element={
            <RoleGuard allowedRoles={['main_admin', 'branch_admin', 'staff']}>
              <ProductHistoryPage />
            </RoleGuard>
          }
        />
        <Route path="/reports" element={<PlaceholderPage title="Reports" />} />
        <Route
          path="/products"
          element={
            <RoleGuard allowedRoles={['main_admin', 'branch_admin', 'staff']}>
              <ProductManagementPage />
            </RoleGuard>
          }
        />
        <Route
          path="/products/categories"
          element={
            <RoleGuard allowedRoles={['main_admin', 'branch_admin']}>
              <ProductCategoriesPage />
            </RoleGuard>
          }
        />
        <Route
          path="/products/types"
          element={
            <RoleGuard allowedRoles={['main_admin', 'branch_admin']}>
              <ProductTypesPage />
            </RoleGuard>
          }
        />
        <Route
          path="/products/units"
          element={
            <RoleGuard allowedRoles={['main_admin', 'branch_admin']}>
              <ProductUnitsPage />
            </RoleGuard>
          }
        />
        <Route
          path="/products/attributes"
          element={
            <RoleGuard allowedRoles={['main_admin', 'branch_admin']}>
              <ProductAttributesPage />
            </RoleGuard>
          }
        />
        <Route
          path="/products/variants"
          element={
            <RoleGuard allowedRoles={['main_admin', 'branch_admin']}>
              <ProductVariantsPage />
            </RoleGuard>
          }
        />
        <Route
          path="/products/branch-settings"
          element={
            <RoleGuard allowedRoles={['main_admin', 'branch_admin']}>
              <ProductBranchSettingsPage />
            </RoleGuard>
          }
        />
        <Route
          path="/users"
          element={
            <RoleGuard allowedRoles={['main_admin', 'branch_admin']}>
              <UserManagementPage />
            </RoleGuard>
          }
        />
        <Route
          path="/access-rights"
          element={
            <RoleGuard allowedRoles={['main_admin', 'branch_admin']}>
              <AccessRightsPage />
            </RoleGuard>
          }
        />
        {/* Contacts & Ledger */}
        <Route
          path="/contacts"
          element={
            <RoleGuard allowedRoles={['main_admin', 'branch_admin', 'staff']}>
              <ContactManagementPage />
            </RoleGuard>
          }
        />
        <Route
          path="/ledger"
          element={
            <RoleGuard allowedRoles={['main_admin', 'branch_admin', 'staff']}>
              <LedgerPage />
            </RoleGuard>
          }
        />
        <Route
          path="/receivables"
          element={
            <RoleGuard allowedRoles={['main_admin', 'branch_admin', 'staff']}>
              <ReceivablesPage />
            </RoleGuard>
          }
        />
        <Route
          path="/payables"
          element={
            <RoleGuard allowedRoles={['main_admin', 'branch_admin', 'staff']}>
              <PayablesPage />
            </RoleGuard>
          }
        />
        <Route
          path="/cash-book"
          element={
            <RoleGuard allowedRoles={['main_admin', 'branch_admin', 'staff']}>
              <TradingRegisterPage />
            </RoleGuard>
          }
        />
        <Route
          path="/cash-vouchers"
          element={
            <RoleGuard allowedRoles={['main_admin', 'branch_admin', 'staff']}>
              <CashVoucherPage />
            </RoleGuard>
          }
        />

        <Route
          path="/settings/company"
          element={
            <RoleGuard allowedRoles={['main_admin']}>
              <CompanySettingsPage />
            </RoleGuard>
          }
        />
        <Route
          path="/settings/payment-accounts"
          element={
            <RoleGuard allowedRoles={['main_admin', 'branch_admin']}>
              <PaymentAccountsPage />
            </RoleGuard>
          }
        />
        <Route
          path="/admin"
          element={
            <RoleGuard allowedRoles={['main_admin']}>
              <PlaceholderPage title="Main Admin" />
            </RoleGuard>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
