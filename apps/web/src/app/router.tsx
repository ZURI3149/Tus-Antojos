import { APP_ROLES } from '@tus-antojos/shared';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { AdminPage } from '@/features/admin/AdminPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { KitchenPage } from '@/features/kitchen/KitchenPage';
import { PosPage } from '@/features/pos/PosPage';
import { UsersPage } from '@/features/users/UsersPage';
import { AppShell } from './AppShell';
import { NoAccessPage } from './NoAccessPage';
import { NotFoundPage } from './NotFoundPage';
import { RequireRole } from './RequireRole';
import { RoleRedirect } from './RoleRedirect';
import { RouteErrorPage } from './RouteErrorPage';
import { SECTIONS } from './roles';

const [posSection, kitchenSection, adminSection] = SECTIONS;

export const routes: RouteObject[] = [
  {
    // Raíz: atrapa los errores de cualquier pantalla y los reporta a Sentry.
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        // Cualquier usuario con sesión y perfil activo.
        element: <RequireRole allowed={APP_ROLES} />,
        children: [
          { path: '/', element: <RoleRedirect /> },
          { path: '/sin-acceso', element: <NoAccessPage /> },
          {
            element: <AppShell />,
            children: [
              {
                element: <RequireRole allowed={posSection.roles} />,
                children: [{ path: posSection.path, element: <PosPage /> }],
              },
              {
                element: <RequireRole allowed={kitchenSection.roles} />,
                children: [{ path: kitchenSection.path, element: <KitchenPage /> }],
              },
              {
                element: <RequireRole allowed={adminSection.roles} />,
                children: [
                  { path: adminSection.path, element: <AdminPage /> },
                  { path: `${adminSection.path}/usuarios`, element: <UsersPage /> },
                ],
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
