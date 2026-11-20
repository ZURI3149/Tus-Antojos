import { APP_ROLES, type AppRole, type User } from '@tus-antojos/shared';
import { useState } from 'react';
import { ROLE_LABELS } from '@/app/roles';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import { cn } from '@/lib/utils';
import { useUpdateUser, useUsers } from './api';
import { selectClassName } from '@/lib/utils';
import { UserForm } from './UserForm';

const dateFormat = new Intl.DateTimeFormat('es', { dateStyle: 'short', timeStyle: 'short' });

export function UsersPage() {
  const users = useUsers();
  const [creating, setCreating] = useState(false);

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Administración"
        title="Usuarios"
        description="Quién entra a la caja, la cocina y la administración."
        actions={!creating && <Button onClick={() => setCreating(true)}>Nuevo usuario</Button>}
      />

      {creating && <UserForm onDone={() => setCreating(false)} />}

      {users.isPending && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {users.isError && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/40 p-3 text-sm">
          <span>No se pudo cargar la lista de usuarios</span>
          <Button size="sm" variant="outline" onClick={() => users.refetch()}>
            Reintentar
          </Button>
        </div>
      )}
      {users.data && <UsersTable users={users.data} />}
    </section>
  );
}

function UsersTable({ users }: { users: User[] }) {
  const { session } = useAuth();
  const updateUser = useUpdateUser();

  return (
    <div className="relative overflow-x-auto rounded-md border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-secondary text-left">
          <tr>
            <th className="px-3 py-2 font-medium">Nombre</th>
            <th className="px-3 py-2 font-medium">Correo</th>
            <th className="px-3 py-2 font-medium">Rol</th>
            <th className="px-3 py-2 font-medium">Estado</th>
            <th className="px-3 py-2 font-medium">Último acceso</th>
            <th className="px-3 py-2 font-medium">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const isSelf = user.id === session?.user.id;
            return (
              <tr key={user.id} className="border-t transition-colors hover:bg-secondary/50">
                <td className="px-3 py-2">
                  {user.fullName} {isSelf && <span className="text-muted-foreground">(tú)</span>}
                </td>
                <td className="px-3 py-2">{user.email}</td>
                <td className="px-3 py-2">
                  <select
                    aria-label={`Rol de ${user.fullName}`}
                    className={cn(selectClassName, 'w-40')}
                    value={user.role}
                    disabled={isSelf}
                    onChange={(e) =>
                      updateUser.mutate({
                        id: user.id,
                        changes: { role: e.target.value as AppRole },
                      })
                    }
                  >
                    {APP_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <StatusBadge active={user.isActive} />
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {user.lastSignInAt ? dateFormat.format(new Date(user.lastSignInAt)) : 'Nunca'}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isSelf}
                    onClick={() =>
                      updateUser.mutate({ id: user.id, changes: { isActive: !user.isActive } })
                    }
                  >
                    {user.isActive ? 'Desactivar' : 'Activar'}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
