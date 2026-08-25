import PermissionGuard from './PermissionGuard';
import { getRouteAccess } from '../../config/routeAccessMap';

export default function RouteGuard({ routePath, children }) {
  const { roles, rights } = getRouteAccess(routePath);

  return (
    <PermissionGuard allowedRoles={roles} requiredRights={rights}>
      {children}
    </PermissionGuard>
  );
}
