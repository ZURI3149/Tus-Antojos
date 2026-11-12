import { NavLink, Outlet } from 'react-router';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import { useProfile } from '@/features/auth/use-profile';
import { cn } from '@/lib/utils';
import { ROLE_LABELS, SECTIONS } from './roles';
import { useSignOutAndLeave } from './use-sign-out';

export function AppShell() {
  const { session } = useAuth();
  const { data: profile } = useProfile();
  const signOut = useSignOutAndLeave();
  if (!profile) return null;

  const sections = SECTIONS.filter((s) => (s.roles as readonly string[]).includes(profile.role));

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex flex-wrap items-center gap-4 border-b px-4 py-2">
        <span className="font-semibold">Tus Antojos</span>
        <nav aria-label="Principal" className="flex gap-1">
          {sections.map((section) => (
            <NavLink
              key={section.path}
              to={section.path}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-1.5 text-sm hover:bg-muted',
                  isActive && 'bg-muted font-medium',
                )
              }
            >
              {section.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span>{profile.fullName || session?.user.email}</span>
          <span
            data-slot="role-badge"
            className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
          >
            {ROLE_LABELS[profile.role]}
          </span>
          <Button variant="outline" size="sm" onClick={signOut}>
            Cerrar sesión
          </Button>
        </div>
      </header>
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
