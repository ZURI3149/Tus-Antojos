import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';

export const TEST_SUPABASE_URL = 'http://127.0.0.1:54321';
export const TEST_ISSUER = `${TEST_SUPABASE_URL}/auth/v1`;

/** Par de claves ES256 de prueba con su JWKS público, como el de Supabase. */
export async function createTestKeys(kid = 'test-key') {
  const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
  const jwk = { ...(await exportJWK(publicKey)), kid, alg: 'ES256', use: 'sig' };
  const jwks = createLocalJWKSet({ keys: [jwk] });

  async function sign(
    claims: JWTPayload & { sub?: string } = {},
    options: { expiresIn?: string | number; issuer?: string; audience?: string; kid?: string } = {},
  ): Promise<string> {
    return new SignJWT({ role: 'authenticated', ...claims })
      .setProtectedHeader({ alg: 'ES256', kid: options.kid ?? kid, typ: 'JWT' })
      .setIssuedAt()
      .setIssuer(options.issuer ?? TEST_ISSUER)
      .setAudience(options.audience ?? 'authenticated')
      .setExpirationTime(options.expiresIn ?? '1h')
      .sign(privateKey);
  }

  return { jwks, sign };
}
