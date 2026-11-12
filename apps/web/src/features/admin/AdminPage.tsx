import { Link } from 'react-router';

// Panel de administración. Usuarios (módulo platform); el resto llega en sus módulos.
export function AdminPage() {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Administración</h1>
        <p className="text-muted-foreground">
          En construcción: aquí irán el catálogo, el inventario y los reportes.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        <li>
          <Link to="/admin/usuarios" className="block rounded-lg border p-4 hover:bg-muted">
            <span className="font-medium">Usuarios</span>
            <span className="block text-sm text-muted-foreground">
              Altas, roles y activación de cuentas
            </span>
          </Link>
        </li>
      </ul>
    </section>
  );
}
