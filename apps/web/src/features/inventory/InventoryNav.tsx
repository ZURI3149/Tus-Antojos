import { NavLink } from 'react-router';
import { cn } from '@/lib/utils';
import { INVENTORY_SECTIONS } from './sections';

export function InventoryNav() {
  return (
    <nav aria-label="Inventario" className="flex flex-wrap gap-2">
      {INVENTORY_SECTIONS.map((section) => (
        <NavLink
          key={section.path}
          to={section.path}
          end={section.path === '/admin/inventario'}
          className={({ isActive }) =>
            cn(
              'rounded-full border px-4 py-1.5 font-heading text-xs tracking-[0.12em] uppercase transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              isActive
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground/80 hover:border-primary/50 hover:text-primary',
            )
          }
        >
          {section.label}
        </NavLink>
      ))}
    </nav>
  );
}
