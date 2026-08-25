import { useAuth } from '../context/AuthContext';

export function useAccess() {
  const { user } = useAuth();

  const isMainAdmin = user?.role === 'main_admin';
  const rights = user?.accessRights || [];

  const has = (code) => isMainAdmin || rights.includes(code);
  const hasAny = (codes = []) => isMainAdmin || codes.some((code) => rights.includes(code));
  const hasAll = (codes = []) => isMainAdmin || codes.every((code) => rights.includes(code));

  return { has, hasAny, hasAll, isMainAdmin, rights };
}
