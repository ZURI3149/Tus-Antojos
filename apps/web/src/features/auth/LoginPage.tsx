import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { safeRedirectTarget } from '@/app/roles';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAuth, type SignInFailure } from './auth-context';
import { loginSchema, type LoginInput, type LoginValues } from './login.schema';

const FAILURE_MESSAGES: Record<SignInFailure, string> = {
  invalid_credentials: 'Correo o contraseña incorrectos',
  network: 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.',
  unknown: 'No se pudo iniciar sesión. Inténtalo de nuevo.',
};

export function LoginPage() {
  const { status, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // A donde volver tras iniciar sesión; "/" redirige según el rol.
  const target = safeRedirectTarget((location.state as { from?: unknown } | null)?.from) ?? '/';
  const [failure, setFailure] = useState<SignInFailure | null>(null);

  const form = useForm<LoginInput, unknown, LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  if (status === 'authenticated') return <Navigate to={target} replace />;

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    setFailure(null);
    const result = await signIn(email, password);
    if (result.ok) {
      navigate(target, { replace: true });
      return;
    }
    setFailure(result.reason);
    form.resetField('password');
    form.setFocus('password');
  });

  return (
    <main className="grid min-h-svh bg-background lg:grid-cols-2">
      {/* Panel de marca: solo en pantallas grandes. */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full border-[40px] border-white/10"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -left-16 size-64 rounded-full bg-gold/15"
        />
        <span className="relative font-heading text-xl tracking-[0.3em] uppercase">
          Tus Antojos
        </span>
        <div className="relative flex max-w-md flex-col gap-4">
          <p className="font-heading text-sm font-light tracking-wide text-gold">
            Artesanía y sabor
          </p>
          <p className="font-heading text-4xl leading-tight font-light">
            Cada pedido, preparado con cariño.
          </p>
          <p className="text-sm text-primary-foreground/80">
            Caja, cocina e inventario de la tienda en un solo lugar.
          </p>
        </div>
        <span aria-hidden className="relative text-2xl tracking-[0.5em] text-gold">
          ···
        </span>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="flex w-full max-w-sm flex-col gap-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <img src="/logo.svg" alt="" className="size-14" />
            <div className="flex flex-col gap-1">
              <p className="eyebrow">Tus Antojos · Punto de venta y gestión</p>
              <h1 className="page-title">Iniciar sesión</h1>
            </div>
            <span aria-hidden className="block h-0.5 w-12 bg-primary" />
          </div>
          <form onSubmit={onSubmit} noValidate>
            <FieldGroup>
              {failure && (
                <div
                  role="alert"
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {FAILURE_MESSAGES[failure]}
                </div>
              )}
              <Field data-invalid={!!errors.email}>
                <FieldLabel htmlFor="email">Correo</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  aria-invalid={!!errors.email}
                  {...form.register('email')}
                />
                <FieldError errors={[errors.email]} />
              </Field>
              <Field data-invalid={!!errors.password}>
                <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  {...form.register('password')}
                />
                <FieldError errors={[errors.password]} />
              </Field>
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isSubmitting || status === 'loading'}
              >
                {isSubmitting ? 'Ingresando…' : 'Iniciar sesión'}
              </Button>
            </FieldGroup>
          </form>
        </div>
      </div>
    </main>
  );
}
