import { z } from 'zod';
import { appRoleSchema } from '../roles';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Ingresa un correo válido' }));

const fullName = z
  .string()
  .trim()
  .min(1, { error: 'Ingresa el nombre' })
  .max(120, { error: 'Máximo 120 caracteres' });

/** Alta de usuario (solo admin). */
export const createUserSchema = z.object({
  email,
  // 72: límite de bcrypt (lo que exceda se ignoraría en silencio).
  password: z
    .string()
    .min(8, { error: 'Mínimo 8 caracteres' })
    .max(72, { error: 'Máximo 72 caracteres' }),
  fullName,
  role: appRoleSchema,
});

export type CreateUserInput = z.input<typeof createUserSchema>;
export type CreateUser = z.output<typeof createUserSchema>;

/** Edición de usuario (solo admin). El correo y la contraseña no se cambian aquí. */
export const updateUserSchema = z
  .strictObject({
    role: appRoleSchema.optional(),
    isActive: z.boolean().optional(),
    fullName: fullName.optional(),
  })
  .refine((v) => v.role !== undefined || v.isActive !== undefined || v.fullName !== undefined, {
    error: 'Indica al menos un cambio',
  });

export type UpdateUserInput = z.input<typeof updateUserSchema>;
export type UpdateUser = z.output<typeof updateUserSchema>;

/** Usuario tal como lo devuelve la API. */
export const userSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  fullName: z.string(),
  role: appRoleSchema,
  isActive: z.boolean(),
  createdAt: z.string(),
  lastSignInAt: z.string().nullable(),
});

export type User = z.infer<typeof userSchema>;
