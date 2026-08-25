import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './AppShell';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import RouteGuard from '../components/auth/RouteGuard';
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
import LedgerReportPage from '../pages/LedgerReportPage';
import ReportsPage from '../pages/ReportsPage';
import SalesSummaryReportPage from '../pages/SalesSummaryReportPage';
import PurchaseSummaryReportPage from '../pages/PurchaseSummaryReportPage';
import ProfitLossReportPage from '../pages/ProfitLossReportPage';
import BranchManagementPage from '../pages/BranchManagementPage';
import ExpensePage from '../pages/ExpensePage';
import StockTransferPage from '../pages/StockTransferPage';
import AdminPage from '../pages/AdminPage';
import LoginActivityPage from '../pages/LoginActivityPage';
import AccountHeadsPage from '../pages/AccountHeadsPage';
import PosPage from '../pages/PosPage';

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      <Route
        path="/pos"
        element={
          <ProtectedRoute>
            <RouteGuard routePath="/pos">
              <PosPage />
            </RouteGuard>
          </ProtectedRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/sales" element={<RouteGuard routePath="/sales"><SalesPage /></RouteGuard>} />
        <Route path="/sales/new" element={<RouteGuard routePath="/sales/new"><SalesPage createMode /></RouteGuard>} />
        <Route path="/sales-returns" element={<RouteGuard routePath="/sales-returns"><SalesReturnPage /></RouteGuard>} />
        <Route path="/purchase" element={<RouteGuard routePath="/purchase"><PurchasePage /></RouteGuard>} />
        <Route path="/purchase/new" element={<RouteGuard routePath="/purchase/new"><PurchasePage createMode /></RouteGuard>} />
        <Route path="/purchase-returns" element={<RouteGuard routePath="/purchase-returns"><PurchaseReturnPage /></RouteGuard>} />
        <Route path="/inventory" element={<RouteGuard routePath="/inventory"><InventoryPage /></RouteGuard>} />
        <Route path="/fifo-stock-report" element={<RouteGuard routePath="/fifo-stock-report"><FifoStockReportPage /></RouteGuard>} />
        <Route path="/product-history" element={<RouteGuard routePath="/product-history"><ProductHistoryPage /></RouteGuard>} />
        <Route path="/reports" element={<RouteGuard routePath="/reports"><ReportsPage /></RouteGuard>} />
        <Route path="/reports/ledger" element={<RouteGuard routePath="/reports/ledger"><LedgerReportPage /></RouteGuard>} />
        <Route path="/reports/sales" element={<RouteGuard routePath="/reports/sales"><SalesSummaryReportPage /></RouteGuard>} />
        <Route path="/reports/purchase" element={<RouteGuard routePath="/reports/purchase"><PurchaseSummaryReportPage /></RouteGuard>} />
        <Route path="/reports/profit-loss" element={<RouteGuard routePath="/reports/profit-loss"><ProfitLossReportPage /></RouteGuard>} />
        <Route path="/branches" element={<RouteGuard routePath="/branches"><BranchManagementPage /></RouteGuard>} />
        <Route path="/expenses" element={<RouteGuard routePath="/expenses"><ExpensePage /></RouteGuard>} />
        <Route path="/stock-transfers" element={<RouteGuard routePath="/stock-transfers"><StockTransferPage /></RouteGuard>} />
        <Route path="/products" element={<RouteGuard routePath="/products"><ProductManagementPage /></RouteGuard>} />
        <Route path="/products/categories" element={<RouteGuard routePath="/products/categories"><ProductCategoriesPage /></RouteGuard>} />
        <Route path="/products/types" element={<RouteGuard routePath="/products/types"><ProductTypesPage /></RouteGuard>} />
        <Route path="/products/units" element={<RouteGuard routePath="/products/units"><ProductUnitsPage /></RouteGuard>} />
        <Route path="/products/attributes" element={<RouteGuard routePath="/products/attributes"><ProductAttributesPage /></RouteGuard>} />
        <Route path="/products/variants" element={<RouteGuard routePath="/products/variants"><ProductVariantsPage /></RouteGuard>} />
        <Route path="/products/branch-settings" element={<RouteGuard routePath="/products/branch-settings"><ProductBranchSettingsPage /></RouteGuard>} />
        <Route path="/users" element={<RouteGuard routePath="/users"><UserManagementPage /></RouteGuard>} />
        <Route path="/access-rights" element={<RouteGuard routePath="/access-rights"><AccessRightsPage /></RouteGuard>} />
        <Route path="/contacts" element={<RouteGuard routePath="/contacts"><ContactManagementPage /></RouteGuard>} />
        <Route path="/ledger" element={<RouteGuard routePath="/ledger"><LedgerPage /></RouteGuard>} />
        <Route path="/receivables" element={<RouteGuard routePath="/receivables"><ReceivablesPage /></RouteGuard>} />
        <Route path="/payables" element={<RouteGuard routePath="/payables"><PayablesPage /></RouteGuard>} />
        <Route path="/cash-book" element={<RouteGuard routePath="/cash-book"><CashBookPage /></RouteGuard>} />
        <Route path="/trading-ledger" element={<RouteGuard routePath="/trading-ledger"><TradingRegisterPage /></RouteGuard>} />
        <Route path="/cash-vouchers" element={<RouteGuard routePath="/cash-vouchers"><CashVoucherPage /></RouteGuard>} />
        <Route path="/settings/company" element={<RouteGuard routePath="/settings/company"><CompanySettingsPage /></RouteGuard>} />
        <Route path="/settings/payment-accounts" element={<RouteGuard routePath="/settings/payment-accounts"><PaymentAccountsPage /></RouteGuard>} />
        <Route path="/settings/account-heads" element={<RouteGuard routePath="/settings/account-heads"><AccountHeadsPage /></RouteGuard>} />
        <Route path="/admin" element={<RouteGuard routePath="/admin"><AdminPage /></RouteGuard>} />
        <Route path="/admin/login-activities" element={<RouteGuard routePath="/admin/login-activities"><LoginActivityPage /></RouteGuard>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
