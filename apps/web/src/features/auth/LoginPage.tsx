import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { safeRedirectTarget } from '@/app/roles';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <main className="flex min-h-svh items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1>Iniciar sesión</h1>
          </CardTitle>
          <CardDescription>Tus Antojos · Punto de venta y gestión</CardDescription>
        </CardHeader>
        <CardContent>
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
                className="w-full"
                disabled={isSubmitting || status === 'loading'}
              >
                {isSubmitting ? 'Ingresando…' : 'Iniciar sesión'}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
