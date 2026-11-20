import type { ReactNode } from 'react';

/**
 * Encabezado de pantalla: antetítulo en rojo, título en mayúsculas espaciadas,
 * un filete rojo corto y, a la derecha, las acciones principales.
 * El antetítulo queda fuera del <h1> para no cambiar su nombre accesible.
 */
export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  badge,
}: {
  title: ReactNode;
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="page-title">{title}</h1>
          {badge}
        </div>
        <span aria-hidden className="mt-1 block h-0.5 w-12 bg-primary" />
        {description && <p className="mt-2 max-w-prose text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
