import { Link } from 'react-router';
import { CATALOG_SECTIONS } from '@/features/catalog/sections';

const SECTIONS = [
  ...CATALOG_SECTIONS,
  {
    path: '/admin/usuarios',
    label: 'Usuarios',
    description: 'Altas, roles y activación de cuentas',
  },
];

// Panel de administración. Cada módulo agrega aquí sus secciones.
export function AdminPage() {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Administración</h1>
        <p className="text-muted-foreground">
          Catálogo y usuarios. Inventario y reportes llegarán después.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {SECTIONS.map((section) => (
          <li key={section.path}>
            <Link to={section.path} className="block rounded-lg border p-4 hover:bg-muted">
              <span className="font-medium">{section.label}</span>
              <span className="block text-sm text-muted-foreground">{section.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
