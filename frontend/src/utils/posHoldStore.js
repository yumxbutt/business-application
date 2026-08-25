import { POS_HELD_ORDERS_KEY } from '../config/posDefaults';

const storageKey = (branchId) => `${POS_HELD_ORDERS_KEY}.${branchId}`;

const readAll = (branchId) => {
  if (!branchId) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(branchId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeAll = (branchId, orders) => {
  if (!branchId) return;
  try {
    window.localStorage.setItem(storageKey(branchId), JSON.stringify(orders));
  } catch {
    // quota / private mode — ignore
  }
};

export const listHeldOrders = (branchId) =>
  readAll(branchId).sort((a, b) => String(b.heldAt).localeCompare(String(a.heldAt)));

export const saveHeldOrder = (branchId, order) => {
  const next = [order, ...readAll(branchId).filter((row) => row.id !== order.id)];
  writeAll(branchId, next);
  return next;
};

export const removeHeldOrder = (branchId, orderId) => {
  const next = readAll(branchId).filter((row) => row.id !== orderId);
  writeAll(branchId, next);
  return next;
};

export const makeHoldId = () =>
  `HOLD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
