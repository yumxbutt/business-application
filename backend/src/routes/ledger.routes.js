const express = require("express");
const { query } = require("express-validator");
const { authenticate } = require("../middleware/auth.middleware");
const { authorize } = require("../middleware/authorize.middleware");
const { ROLES } = require("../constants/roles");
const {
  getContactLedger,
  getReceivables,
  getPayables,
  getLedgerReport,
  getCashBook,
  getOpeningBalance,
  setOpeningBalance,
  getTradingLedgerRegister,
} = require("../controllers/ledger.controller");

const router = express.Router();
const managers = [ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN];
const allRoles = [ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN, ROLES.STAFF];

router.get("/contact/:contactId", authenticate, authorize(...allRoles), [query("startDate").optional().isISO8601(), query("endDate").optional().isISO8601()], getContactLedger);
router.get("/receivables", authenticate, authorize(...allRoles), [query("branchId").optional().isInt({ min: 1 })], getReceivables);
router.get("/payables", authenticate, authorize(...allRoles), [query("branchId").optional().isInt({ min: 1 })], getPayables);
router.get("/cash-book", authenticate, authorize(...allRoles), [query("branchId").optional().isInt({ min: 1 }), query("startDate").optional().isISO8601(), query("endDate").optional().isISO8601()], getCashBook);
router.get("/report", authenticate, authorize(...managers), [query("startDate").optional().isISO8601(), query("endDate").optional().isISO8601()], getLedgerReport);
router.get("/opening-balance", authenticate, authorize(...allRoles), [query("branchId").optional().isInt({ min: 1 })], getOpeningBalance);
router.post("/opening-balance", authenticate, authorize(...managers), setOpeningBalance);
router.get("/trading-register", authenticate, authorize(...allRoles), [query("branchId").optional().isInt({ min: 1 }), query("startDate").optional().isISO8601(), query("endDate").optional().isISO8601()], getTradingLedgerRegister);

module.exports = router;