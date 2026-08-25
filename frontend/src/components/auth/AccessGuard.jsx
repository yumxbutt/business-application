import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AccessGuard({ requiredRights, children }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  if (user.role === 'main_admin') return children;

  const rights = Array.isArray(requiredRights) ? requiredRights : [requiredRights];
  const userRights = user.accessRights || [];
  const hasRight = rights.some((right) => userRights.includes(right));

  if (!hasRight) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
