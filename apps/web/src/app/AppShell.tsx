import { LogOut } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router';
import { NetworkBadge } from '@/components/network-badge';
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
    <div className="flex min-h-svh flex-col bg-background">
      {/* Franja superior en rojo: quién está conectado y salida. */}
      <div className="bg-primary text-primary-foreground">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-1.5 text-xs">
          <span className="hidden font-heading font-light tracking-wide sm:inline">
            Punto de venta y gestión
          </span>
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <NetworkBadge />
            <span className="truncate">{profile.fullName || session?.user.email}</span>
            <span
              data-slot="role-badge"
              className="rounded-sm bg-gold px-2 py-0.5 font-heading text-[0.7rem] font-medium tracking-wider text-gold-foreground uppercase"
            >
              {ROLE_LABELS[profile.role]}
            </span>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex min-h-8 min-w-8 shrink-0 items-center justify-center gap-1.5 rounded-sm px-2 font-heading tracking-wider uppercase outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <LogOut aria-hidden className="size-3.5" />
              <span className="sr-only sm:not-sr-only">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3">
          <Link
            to="/"
            className="flex items-center gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <picture>
              <source srcSet="/logo1.webp" type="image/webp" />
              <img
                src="/logo1.png"
                alt="Logo Tus Antojos"
                className="size-10 rounded-md object-contain"
              />
            </picture>
            <span className="font-heading text-lg font-normal tracking-[0.22em] uppercase">
              Tus <span className="text-primary">Antojos</span>
            </span>
          </Link>
          <nav aria-label="Principal" className="-mx-1 flex overflow-x-auto">
            {sections.map((section) => (
              <NavLink
                key={section.path}
                to={section.path}
                className={({ isActive }) =>
                  cn(
                    'relative px-3 py-2 font-heading text-[0.8rem] tracking-[0.14em] whitespace-nowrap uppercase outline-none transition-colors hover:text-primary focus-visible:text-primary',
                    "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:scale-x-0 after:bg-primary after:transition-transform after:content-['']",
                    isActive ? 'font-medium text-primary after:scale-x-100' : 'text-foreground/80',
                  )
                }
              >
                {section.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t bg-secondary">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground">
          <span className="font-heading tracking-[0.2em] uppercase">Tus Antojos</span>
          <span>Hecho con cariño, un antojo a la vez</span>
        </div>
      </footer>
    </div>
  );
}
