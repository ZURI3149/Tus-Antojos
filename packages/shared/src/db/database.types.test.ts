import { describe, expect, it } from 'vitest';
import { INGREDIENT_UNITS } from '../catalog/units';
import { INVENTORY_MOVEMENT_TYPES } from '../inventory/inventory.schema';
import { PROMOTION_KINDS } from '../promotions';
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

  it('el enum inventory_movement_type de PostgreSQL coincide con INVENTORY_MOVEMENT_TYPES', () => {
    expect([...Constants.public.Enums.inventory_movement_type]).toEqual([
      ...INVENTORY_MOVEMENT_TYPES,
    ]);
  });

  it('el enum promotion_kind de PostgreSQL coincide con PROMOTION_KINDS', () => {
    expect([...Constants.public.Enums.promotion_kind]).toEqual([...PROMOTION_KINDS]);
  });
});
