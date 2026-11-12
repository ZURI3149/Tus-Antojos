import { describe, expect, it } from 'vitest';
import { APP_ROLES, appRoleSchema, isAppRole } from './roles';

describe('roles', () => {
  it('define exactamente los tres roles del sistema', () => {
    expect(APP_ROLES).toEqual(['cajero', 'cocina', 'admin']);
  });

  it.each(APP_ROLES)('acepta el rol %s', (role) => {
    expect(appRoleSchema.parse(role)).toBe(role);
    expect(isAppRole(role)).toBe(true);
  });

  it.each(['Admin', 'mesero', '', null, undefined, 1])('rechaza %j', (value) => {
    expect(appRoleSchema.safeParse(value).success).toBe(false);
    expect(isAppRole(value)).toBe(false);
  });
});
