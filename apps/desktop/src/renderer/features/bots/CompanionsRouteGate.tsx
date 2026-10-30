import { Navigate, Outlet } from 'react-router-dom';

import { isCompanionsEnabled } from '../../../shared/personalProfile';

/** Old /bots deep links fall back to ordinary tasks in the Windows personal build. */
export function CompanionsRouteGate() {
  return isCompanionsEnabled(window.electronAPI?.platform ?? '')
    ? <Outlet />
    : <Navigate to="/cc-agent" replace />;
}
