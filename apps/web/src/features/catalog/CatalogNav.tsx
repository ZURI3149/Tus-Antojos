import { NavLink } from 'react-router';
import { cn } from '@/lib/utils';
import { CATALOG_SECTIONS } from './sections';

export function CatalogNav() {
  return (
    <nav aria-label="Catálogo" className="flex flex-wrap gap-1 border-b pb-2">
      {CATALOG_SECTIONS.map((section) => (
        <NavLink
          key={section.path}
          to={section.path}
          className={({ isActive }) =>
            cn('rounded-md px-3 py-1.5 text-sm hover:bg-muted', isActive && 'bg-muted font-medium')
          }
        >
          {section.label}
        </NavLink>
      ))}
    </nav>
  );
}
