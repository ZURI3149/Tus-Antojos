import { loginSchema } from './login.schema';

describe('loginSchema', () => {
  it('acepta correo y contraseña, normalizando el correo', () => {
    expect(loginSchema.parse({ email: '  Cajero@TusAntojos.test ', password: 'x' })).toEqual({
      email: 'cajero@tusantojos.test',
      password: 'x',
    });
  });

  it('mensajes en español', () => {
    const result = loginSchema.safeParse({ email: 'no-es-correo', password: '' });
    expect(result.success).toBe(false);
    const messages = result.error!.issues.map((i) => [i.path[0], i.message]);
    expect(messages).toEqual([
      ['email', 'Ingresa un correo válido'],
      ['password', 'Ingresa tu contraseña'],
    ]);
  });
});
