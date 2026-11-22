import {
  ArrowRight,
  Boxes,
  ChartColumn,
  Croissant,
  Percent,
  Receipt,
  Tags,
  Users,
  Wheat,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/page-header';
import { CATALOG_SECTIONS } from '@/features/catalog/sections';
import { InventoryAlerts } from '@/features/inventory/InventoryAlerts';
import { usePromotions } from '@/features/promotions/api';
import { promotionStatus } from '@tus-antojos/shared';

const ICONS: Record<string, LucideIcon> = {
  '/admin/pedidos': Receipt,
  '/admin/productos': Croissant,
  '/admin/categorias': Tags,
  '/admin/insumos': Wheat,
  '/admin/usuarios': Users,
  '/admin/inventario': Boxes,
  '/admin/promociones': Percent,
};

const SECTIONS = [
  {
    path: '/admin/pedidos',
    label: 'Pedidos',
    description: 'Historial de ventas, comandas y kardex',
  },
  ...CATALOG_SECTIONS,
  {
    path: '/admin/promociones',
    label: 'Promociones',
    description: 'Descuentos por porcentaje o monto fijo',
  },
  {
    path: '/admin/inventario',
    label: 'Inventario',
    description: 'Stock, kardex, compras y mermas',
  },
  {
    path: '/admin/usuarios',
    label: 'Usuarios',
    description: 'Altas, roles y activación de cuentas',
  },
];

/** Módulos que aún no tienen pantalla: se muestran como adelanto, sin enlace. */
const UPCOMING = [
  { label: 'Reportes', description: 'Ventas, cierres de caja y consumo', icon: ChartColumn },
];

// Panel de administración. Cada módulo agrega aquí sus secciones.
export function AdminPage() {
  const promotions = usePromotions();
  const vigentesCount = promotions.data
    ? promotions.data.filter((p) => promotionStatus(p) === 'vigente').length
    : undefined;

  return (
    <section className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Panel"
        title="Administración"
        description="Gestión integral de catálogo, inventario y cuentas de usuario."
      />
      <InventoryAlerts />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((section) => {
          const Icon = ICONS[section.path] ?? Croissant;
          return (
            <li key={section.path}>
              <Link
                to={section.path}
                className="group flex h-full flex-col items-center gap-3 rounded-md border bg-card px-6 py-8 text-center transition-all outline-none hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex size-16 items-center justify-center rounded-full bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon aria-hidden className="size-7" strokeWidth={1.5} />
                </span>
                <span className="font-heading text-base tracking-[0.16em] uppercase">
                  {section.label}
                </span>
                <span className="text-sm text-muted-foreground">{section.description}</span>
                {section.path === '/admin/promociones' && vigentesCount !== undefined && (
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-heading text-xs font-semibold text-primary">
                    {vigentesCount} {vigentesCount === 1 ? 'vigente' : 'vigentes'}
                  </span>
                )}
                <span className="mt-auto inline-flex items-center gap-1 pt-2 font-heading text-xs font-medium tracking-wider text-primary uppercase">
                  Ver sección
                  <ArrowRight
                    aria-hidden
                    className="size-3.5 transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </Link>
            </li>
          );
        })}
        {UPCOMING.map(({ label, description, icon: Icon }) => (
          <li key={label}>
            <div className="flex h-full flex-col items-center gap-3 rounded-md border border-dashed px-6 py-8 text-center text-muted-foreground">
              <span className="flex size-16 items-center justify-center rounded-full bg-secondary">
                <Icon aria-hidden className="size-7" strokeWidth={1.5} />
              </span>
              <span className="font-heading text-base tracking-[0.16em] uppercase">{label}</span>
              <span className="text-sm">{description}</span>
              <span className="mt-auto rounded-sm bg-accent px-2 py-0.5 font-heading text-[0.7rem] tracking-wider text-accent-foreground uppercase">
                Próximamente
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
