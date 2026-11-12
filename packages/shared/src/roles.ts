import { z } from 'zod';

/** Roles de la aplicación. Deben coincidir con el tipo `app_role` de PostgreSQL. */
export const APP_ROLES = ['cajero', 'cocina', 'admin'] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const appRoleSchema = z.enum(APP_ROLES);

export function isAppRole(value: unknown): value is AppRole {
  return appRoleSchema.safeParse(value).success;
}
