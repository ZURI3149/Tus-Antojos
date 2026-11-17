import { describe, expect, it } from 'vitest';
import { INGREDIENT_UNITS } from '../catalog/units';
import { APP_ROLES } from '../roles';
import { Constants } from './database.types';

// database.types.ts se genera desde la BD (`pnpm db:types`). Si alguien cambia el
// enum app_role en una migración sin actualizar APP_ROLES (o al revés), falla aquí.
describe('tipos generados de la base de datos', () => {
  it('el enum app_role de PostgreSQL coincide con APP_ROLES', () => {
    expect([...Constants.public.Enums.app_role]).toEqual([...APP_ROLES]);
  });

  it('el enum ingredient_unit de PostgreSQL coincide con INGREDIENT_UNITS', () => {
    expect([...Constants.public.Enums.ingredient_unit]).toEqual([...INGREDIENT_UNITS]);
  });
});
