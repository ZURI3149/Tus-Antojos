import type { LucideIcon } from 'lucide-react';

/** Aviso de pantalla pendiente, para los módulos que todavía no se construyen. */
export function ComingSoon({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-md border border-dashed bg-secondary/40 px-6 py-16 text-center">
      <span className="flex size-20 items-center justify-center rounded-full bg-background text-primary ring-1 ring-border">
        <Icon aria-hidden className="size-9" strokeWidth={1.25} />
      </span>
      <span className="rounded-sm bg-accent px-2 py-0.5 font-heading text-[0.7rem] tracking-wider text-accent-foreground uppercase">
        En construcción
      </span>
      <p className="font-heading text-lg font-light">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{children}</p>
      <span aria-hidden className="text-xl tracking-[0.5em] text-primary">
        ···
      </span>
    </div>
  );
}
