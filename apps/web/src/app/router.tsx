import { APP_ROLES } from '@tus-antojos/shared';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { AdminPage } from '@/features/admin/AdminPage';
import { OrderDetailPage } from '@/features/admin/orders/OrderDetailPage';
import { OrdersPage } from '@/features/admin/orders/OrdersPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { CategoriesPage } from '@/features/catalog/CategoriesPage';
import { IngredientsPage } from '@/features/catalog/IngredientsPage';
import { NewProductPage, ProductEditPage } from '@/features/catalog/ProductEditPage';
import { ProductsPage } from '@/features/catalog/ProductsPage';
import { KardexPage } from '@/features/inventory/KardexPage';
import { PurchaseForm } from '@/features/inventory/PurchaseForm';
import { PurchasesPage } from '@/features/inventory/PurchasesPage';
import { StockPage } from '@/features/inventory/StockPage';
import { KitchenPage } from '@/features/kitchen/KitchenPage';
import { CashierOrdersPage } from '@/features/pos/CashierOrdersPage';
import { PosPage } from '@/features/pos/PosPage';
import { NewPromotionPage } from '@/features/promotions/NewPromotionPage';
import { PromotionEditPage } from '@/features/promotions/PromotionEditPage';
import { PromotionsPage } from '@/features/promotions/PromotionsPage';
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
                children: [
                  { path: posSection.path, element: <PosPage /> },
                  { path: `${posSection.path}/pedidos`, element: <CashierOrdersPage /> },
                ],
              },
              {
                element: <RequireRole allowed={kitchenSection.roles} />,
                children: [{ path: kitchenSection.path, element: <KitchenPage /> }],
              },
              {
                element: <RequireRole allowed={adminSection.roles} />,
                children: [
                  { path: adminSection.path, element: <AdminPage /> },
                  { path: `${adminSection.path}/pedidos`, element: <OrdersPage /> },
                  { path: `${adminSection.path}/pedidos/:id`, element: <OrderDetailPage /> },
                  { path: `${adminSection.path}/usuarios`, element: <UsersPage /> },
                  { path: `${adminSection.path}/promociones`, element: <PromotionsPage /> },
                  {
                    path: `${adminSection.path}/promociones/nueva`,
                    element: <NewPromotionPage />,
                  },
                  {
                    path: `${adminSection.path}/promociones/:id`,
                    element: <PromotionEditPage />,
                  },
                  { path: `${adminSection.path}/categorias`, element: <CategoriesPage /> },
                  { path: `${adminSection.path}/insumos`, element: <IngredientsPage /> },
                  { path: `${adminSection.path}/productos`, element: <ProductsPage /> },
                  { path: `${adminSection.path}/productos/nuevo`, element: <NewProductPage /> },
                  { path: `${adminSection.path}/productos/:id`, element: <ProductEditPage /> },
                  { path: `${adminSection.path}/inventario`, element: <StockPage /> },
                  {
                    path: `${adminSection.path}/inventario/:ingredientId`,
                    element: <KardexPage />,
                  },
                  { path: `${adminSection.path}/compras`, element: <PurchasesPage /> },
                  { path: `${adminSection.path}/compras/nueva`, element: <PurchaseForm /> },
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
