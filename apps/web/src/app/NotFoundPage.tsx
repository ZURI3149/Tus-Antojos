import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-2xl font-semibold">Página no encontrada</h1>
      <Link to="/" className="text-primary underline underline-offset-4">
        Volver al inicio
      </Link>
    </main>
  );
}
