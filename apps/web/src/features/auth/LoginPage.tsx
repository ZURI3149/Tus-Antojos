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
    <main className="login-scope grid min-h-svh bg-background lg:grid-cols-[1.08fr_0.92fr]">
      {/* Imagen de marca: contiene el logo y la frase promocional. */}
      <section
        aria-label="Tus Antojos, tucumanas artesanales"
        className="relative min-h-[260px] overflow-hidden bg-[#090909] sm:min-h-[350px] lg:min-h-svh"
      >
        <picture>
          <source srcSet="/login-tus-antojos.webp" type="image/webp" />
          <img
            src="/login-tus-antojos.png"
            alt="Tus Antojos: Cada tucumana, un antojo irresistible"
            className="absolute inset-0 h-full w-full object-cover object-left"
          />
        </picture>
      </section>
      {/* Formulario: se conserva íntegra la autenticación existente. */}
      <section className="flex items-center justify-center bg-background px-6 py-12 sm:px-10 lg:px-14">
        <div className="flex w-full max-w-md flex-col gap-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-20 items-center justify-center overflow-hidden rounded-xl bg-[#111111] p-2">
              <picture>
                <source srcSet="/logo1.webp" type="image/webp" />
                <img
                  src="/logo1.png"
                  alt="Tus Antojos - Tucumanas"
                  className="h-full w-full object-contain"
                />
              </picture>
            </div>
            <div className="flex flex-col gap-1">
              <p className="eyebrow text-muted-foreground">Punto de venta y gestión</p>
              <h1 className="page-title">Iniciar sesión</h1>
            </div>
            <span aria-hidden className="block h-0.5 w-12 bg-primary" />
            <p className="max-w-xs text-sm text-muted-foreground">
              Ingresa a tu cuenta para continuar.
            </p>
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
                <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="tu@correo.com"
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
                  placeholder="Ingresa tu contraseña"
                  aria-invalid={!!errors.password}
                  {...form.register('password')}
                />
                <FieldError errors={[errors.password]} />
              </Field>
              <Button
                type="submit"
                size="lg"
                className="mt-2 w-full"
                disabled={isSubmitting || status === 'loading'}
              >
                {isSubmitting ? 'Ingresando…' : 'Iniciar sesión'}
              </Button>
            </FieldGroup>
          </form>
          <p className="text-center text-xs text-muted-foreground">Tus Antojos · Tucumanas</p>
        </div>
      </section>
    </main>
  );
}
