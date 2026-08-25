export const WALK_IN_CUSTOMER_NAME = 'Walk-in Customer';

/** Auto-dismiss success strip and ready next sale (ms). */
export const POS_SUCCESS_AUTO_MS = 1500;

/** localStorage key for “auto print receipt after sale”. */
export const POS_AUTO_PRINT_KEY = 'pos.autoPrint';

/** localStorage key for restaurant kitchen token printing. */
export const POS_PRINT_TOKENS_KEY = 'pos.printKitchenTokens';

/** localStorage key prefix for held POS carts (suffix = branchId). */
export const POS_HELD_ORDERS_KEY = 'pos.heldOrders';

export const BUSINESS_MODE_RETAIL = 'retail';
export const BUSINESS_MODE_WHOLESALE = 'wholesale';
export const BUSINESS_MODE_RESTAURANT = 'restaurant';

export const TAX_MODE_CASH = 'cash_tax';
export const TAX_MODE_CARD = 'card_tax';
export const TAX_MODE_NONE = 'no_tax';

export const TAX_MODE_OPTIONS = [
  { value: TAX_MODE_CASH, label: 'Cash Tax' },
  { value: TAX_MODE_CARD, label: 'Card Tax' },
  { value: TAX_MODE_NONE, label: 'No Tax' },
];

export const normalizeBusinessMode = (value) => {
  if (value === BUSINESS_MODE_WHOLESALE) return BUSINESS_MODE_WHOLESALE;
  if (value === BUSINESS_MODE_RESTAURANT) return BUSINESS_MODE_RESTAURANT;
  return BUSINESS_MODE_RETAIL;
};

export const isRestaurantMode = (value) =>
  normalizeBusinessMode(value) === BUSINESS_MODE_RESTAURANT;

export const normalizeTaxMode = (value) => {
  if (value === TAX_MODE_CASH || value === TAX_MODE_CARD) return value;
  return TAX_MODE_NONE;
};

export const resolveTaxRate = (settings, taxMode) => {
  const mode = normalizeTaxMode(taxMode);
  if (mode === TAX_MODE_NONE) return 0;
  if (mode === TAX_MODE_CASH) return Math.max(0, Number(settings?.cashTaxRate || 0));
  if (mode === TAX_MODE_CARD) return Math.max(0, Number(settings?.cardTaxRate || 0));
  return 0;
};

export const taxModeLabel = (taxMode) => {
  const mode = normalizeTaxMode(taxMode);
  return TAX_MODE_OPTIONS.find((opt) => opt.value === mode)?.label || 'No Tax';
};

export const resolveWalkInCustomerId = (customers = []) => {
  const match = customers.find((row) => row.name === WALK_IN_CUSTOMER_NAME);
  return match ? String(match.id) : '';
};
