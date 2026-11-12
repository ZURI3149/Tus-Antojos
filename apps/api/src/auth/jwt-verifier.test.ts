import { SignJWT, UnsecuredJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestKeys, TEST_ISSUER, TEST_SUPABASE_URL } from '../../test/support/jwt.js';
import { loadEnv } from '../config/env.schema.js';
import { InvalidTokenError, JwtVerifier } from './jwt-verifier.js';

const USER_ID = '00000000-0000-4000-a000-000000000001';
const baseEnv = { SUPABASE_URL: TEST_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: 'k' };

describe('JwtVerifier', () => {
  let keys: Awaited<ReturnType<typeof createTestKeys>>;
  let otherKeys: Awaited<ReturnType<typeof createTestKeys>>;
  let verifier: JwtVerifier;

  beforeAll(async () => {
    keys = await createTestKeys();
    otherKeys = await createTestKeys('otra-clave');
    verifier = new JwtVerifier(loadEnv(baseEnv), keys.jwks);
  });

  it('acepta un token ES256 válido y devuelve el usuario', async () => {
    const token = await keys.sign({ sub: USER_ID, email: 'cajero@tusantojos.test' });
    await expect(verifier.verify(token)).resolves.toEqual({
      userId: USER_ID,
      email: 'cajero@tusantojos.test',
    });
  });

  it('email es null si el token no lo trae', async () => {
    const token = await keys.sign({ sub: USER_ID });
    await expect(verifier.verify(token)).resolves.toEqual({ userId: USER_ID, email: null });
  });

  const rejects = (label: string, makeToken: () => Promise<string> | string) =>
    it(`rechaza: ${label}`, async () => {
      await expect(verifier.verify(await makeToken())).rejects.toBeInstanceOf(InvalidTokenError);
    });

  rejects('token vencido', () => keys.sign({ sub: USER_ID }, { expiresIn: '-1m' }));
  rejects('emisor distinto', () =>
    keys.sign({ sub: USER_ID }, { issuer: 'https://otro.supabase.co/auth/v1' }),
  );
  rejects('audiencia distinta', () => keys.sign({ sub: USER_ID }, { audience: 'anon' }));
  rejects('firmado con otra clave privada (mismo kid)', () =>
    otherKeys.sign({ sub: USER_ID }, { kid: 'test-key' }),
  );
  rejects('kid desconocido', () => otherKeys.sign({ sub: USER_ID }));
  rejects('sin sub', () => keys.sign({}));
  rejects('sub que no es UUID', () => keys.sign({ sub: 'admin' }));
  rejects('texto que no es un JWT', () => 'esto-no-es-un-jwt');
  rejects('cadena vacía', () => '');
  rejects('alg "none" (sin firma)', () =>
    new UnsecuredJWT({ sub: USER_ID, role: 'authenticated' })
      .setIssuer(TEST_ISSUER)
      .setAudience('authenticated')
      .setExpirationTime('1h')
      .encode(),
  );
  rejects('HS256 cuando no hay SUPABASE_JWT_SECRET (confusión de algoritmo)', () =>
    new SignJWT({ sub: USER_ID })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(TEST_ISSUER)
      .setAudience('authenticated')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('cualquier-secreto')),
  );

  describe('con SUPABASE_JWT_SECRET (proyectos con firma HS256 heredada)', () => {
    const secret = 'super-secreto-compartido-de-al-menos-32-caracteres';
    const hsVerifier = () =>
      new JwtVerifier(loadEnv({ ...baseEnv, SUPABASE_JWT_SECRET: secret }), keys.jwks);
    const signHs = (key: string) =>
      new SignJWT({ sub: USER_ID, role: 'authenticated' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer(TEST_ISSUER)
        .setAudience('authenticated')
        .setExpirationTime('1h')
        .sign(new TextEncoder().encode(key));

    it('acepta HS256 firmado con el secreto', async () => {
      await expect(hsVerifier().verify(await signHs(secret))).resolves.toMatchObject({
        userId: USER_ID,
      });
    });

    it('rechaza HS256 firmado con otro secreto', async () => {
      await expect(hsVerifier().verify(await signHs('otro-secreto'))).rejects.toBeInstanceOf(
        InvalidTokenError,
      );
    });

    it('sigue aceptando ES256 por JWKS', async () => {
      await expect(hsVerifier().verify(await keys.sign({ sub: USER_ID }))).resolves.toMatchObject({
        userId: USER_ID,
      });
    });
  });

  it('si el JWKS no está disponible NO es un token inválido (→ 500, no cierra sesiones)', async () => {
    const down = new JwtVerifier(loadEnv(baseEnv), async () => {
      throw new TypeError('fetch failed');
    });
    const token = await keys.sign({ sub: USER_ID });
    const error = await down.verify(token).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TypeError);
    expect(error).not.toBeInstanceOf(InvalidTokenError);
  });

  it('respeta SUPABASE_JWT_ISSUER si se configura', async () => {
    const custom = new JwtVerifier(
      loadEnv({ ...baseEnv, SUPABASE_JWT_ISSUER: 'https://auth.tusantojos.com/auth/v1' }),
      keys.jwks,
    );
    const token = await keys.sign(
      { sub: USER_ID },
      { issuer: 'https://auth.tusantojos.com/auth/v1' },
    );
    await expect(custom.verify(token)).resolves.toMatchObject({ userId: USER_ID });
  });
});
