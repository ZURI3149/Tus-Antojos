import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function FullPageMessage({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1>{title}</h1>
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        {children && <CardContent className="flex flex-col gap-2">{children}</CardContent>}
      </Card>
    </main>
  );
}

export function LoadingScreen() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4" aria-busy="true">
      <p className="text-sm text-muted-foreground">Cargando…</p>
    </main>
  );
}
