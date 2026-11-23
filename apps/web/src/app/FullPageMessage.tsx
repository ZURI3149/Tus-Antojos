import type { ReactNode } from 'react';

/** Mensaje a pantalla completa (sin acceso, errores, usuario desactivado). */
export function FullPageMessage({
  title,
  description,
  eyebrow = 'Tus Antojos',
  children,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  children?: ReactNode;
}) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-secondary p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-md border-t-4 border-primary bg-card px-6 py-10 text-center shadow-sm">
        <picture className="contents">
          <source srcSet="/logo1.webp" type="image/webp" />
          <img
            src="/logo1.png"
            alt="Logo Tus Antojos"
            className="size-12 rounded-md object-contain"
          />
        </picture>
        <div className="flex flex-col gap-1">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="page-title text-xl">{title}</h1>
        </div>
        <span aria-hidden className="block h-0.5 w-12 bg-primary" />
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        {children && <div className="flex w-full flex-col gap-2 pt-2">{children}</div>}
      </div>
    </main>
  );
}

export function LoadingScreen() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4" aria-busy="true">
      <p className="font-heading text-sm tracking-[0.2em] text-muted-foreground uppercase">
        Cargando…
      </p>
    </main>
  );
}
