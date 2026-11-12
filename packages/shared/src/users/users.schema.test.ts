import { describe, expect, it } from 'vitest';
import { createUserSchema, updateUserSchema, userSchema } from './users.schema';

describe('createUserSchema', () => {
  const valid = {
    email: '  Nuevo.Cajero@TusAntojos.test ',
    password: 'clave-segura-1',
    fullName: '  Ana Pérez ',
    role: 'cajero',
  };

  it('normaliza correo y nombre', () => {
    expect(createUserSchema.parse(valid)).toEqual({
      email: 'nuevo.cajero@tusantojos.test',
      password: 'clave-segura-1',
      fullName: 'Ana Pérez',
      role: 'cajero',
    });
  });

  it.each([
    ['correo inválido', { email: 'no-es-correo' }, 'email'],
    ['contraseña corta', { password: '1234567' }, 'password'],
    [
      'contraseña de más de 72 caracteres (límite de bcrypt)',
      { password: 'x'.repeat(73) },
      'password',
    ],
    ['nombre vacío', { fullName: '   ' }, 'fullName'],
    ['nombre de más de 120 caracteres', { fullName: 'x'.repeat(121) }, 'fullName'],
    ['rol inexistente', { role: 'mesero' }, 'role'],
  ])('rechaza %s', (_label, change, field) => {
    const result = createUserSchema.safeParse({ ...valid, ...change });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path[0])).toContain(field);
  });
});

describe('updateUserSchema', () => {
  it.each([{ role: 'admin' }, { isActive: false }, { fullName: 'Nuevo nombre' }])(
    'acepta %j',
    (input) => {
      expect(updateUserSchema.safeParse(input).success).toBe(true);
    },
  );

  it('exige al menos un campo', () => {
    const result = updateUserSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Indica al menos un cambio');
  });

  it('no acepta campos desconocidos (p. ej. email o password)', () => {
    expect(updateUserSchema.safeParse({ email: 'otro@x.co', role: 'admin' }).success).toBe(false);
  });
});

describe('userSchema', () => {
  it('describe el usuario que devuelve la API', () => {
    const user = {
      id: '00000000-0000-4000-a000-000000000001',
      email: 'cajero@tusantojos.test',
      fullName: 'Cajero de Prueba',
      role: 'cajero',
      isActive: true,
      createdAt: '2026-11-12T10:00:00.000Z',
      lastSignInAt: null,
    };
    expect(userSchema.parse(user)).toEqual(user);
  });
});
