import { zodResolver } from '@hookform/resolvers/zod';
import {
  APP_ROLES,
  createUserSchema,
  type CreateUser,
  type CreateUserInput,
} from '@tus-antojos/shared';
import { useForm } from 'react-hook-form';
import { ROLE_LABELS } from '@/app/roles';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import { selectClassName } from '@/lib/utils';
import { notifyError, useCreateUser } from './api';

const FIELDS = ['email', 'password', 'fullName', 'role'] as const;
type FieldName = (typeof FIELDS)[number];
const isField = (path: string): path is FieldName => (FIELDS as readonly string[]).includes(path);

export function UserForm({ onDone }: { onDone: () => void }) {
  const createUser = useCreateUser();
  const form = useForm<CreateUserInput, unknown, CreateUser>({
    // El mismo esquema que valida la API.
    resolver: zodResolver(createUserSchema),
    defaultValues: { fullName: '', email: '', password: '', role: 'cajero' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await createUser.mutateAsync(values);
      onDone();
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === 'VALIDATION_ERROR' &&
        error.fieldErrors.length
      ) {
        for (const issue of error.fieldErrors) {
          if (isField(issue.path)) form.setError(issue.path, { message: issue.message });
        }
        return;
      }
      if (error instanceof ApiError && error.code === 'CONFLICT') {
        form.setError('email', { message: error.message });
        return;
      }
      notifyError(error);
    }
  });

  return (
    <form
      aria-label="Nuevo usuario"
      onSubmit={onSubmit}
      noValidate
      className="rounded-md border-l-4 border-primary bg-secondary/60 p-4"
    >
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.fullName}>
            <FieldLabel htmlFor="user-fullName">Nombre</FieldLabel>
            <Input
              id="user-fullName"
              aria-invalid={!!errors.fullName}
              {...form.register('fullName')}
            />
            <FieldError errors={[errors.fullName]} />
          </Field>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="user-email">Correo</FieldLabel>
            <Input
              id="user-email"
              type="email"
              autoComplete="off"
              aria-invalid={!!errors.email}
              {...form.register('email')}
            />
            <FieldError errors={[errors.email]} />
          </Field>
          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="user-password">Contraseña</FieldLabel>
            <Input
              id="user-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...form.register('password')}
            />
            <FieldError errors={[errors.password]} />
          </Field>
          <Field data-invalid={!!errors.role}>
            <FieldLabel htmlFor="user-role">Rol</FieldLabel>
            <select
              id="user-role"
              className={`${selectClassName} w-full`}
              {...form.register('role')}
            >
              {APP_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
            <FieldError errors={[errors.role]} />
          </Field>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creando…' : 'Crear usuario'}
          </Button>
          <Button type="button" variant="outline" onClick={onDone}>
            Cancelar
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
