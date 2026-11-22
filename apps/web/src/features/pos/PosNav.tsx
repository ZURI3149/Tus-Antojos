import { NavLink } from 'react-router';
import { cn } from '@/lib/utils';

export function PosNav() {
  return (
    <nav aria-label="Navegación de caja" className="flex flex-wrap gap-2">
      <NavLink
        to="/caja"
        end
        className={({ isActive }) =>
          cn(
            'rounded-full border px-4 py-1.5 font-heading text-xs tracking-[0.12em] uppercase transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
            isActive
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background text-foreground/80 hover:border-primary/50 hover:text-primary',
          )
        }
      >
        Nueva venta
      </NavLink>
      <NavLink
        to="/caja/pedidos"
        className={({ isActive }) =>
          cn(
            'rounded-full border px-4 py-1.5 font-heading text-xs tracking-[0.12em] uppercase transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
            isActive
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background text-foreground/80 hover:border-primary/50 hover:text-primary',
          )
        }
      >
        Pedidos del día
      </NavLink>
    </nav>
  );
}
