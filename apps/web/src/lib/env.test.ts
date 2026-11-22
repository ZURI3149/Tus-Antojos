import { parseWebEnv } from './env';

const valid = {
  VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
  VITE_SUPABASE_ANON_KEY: 'sb_publishable_abc',
  VITE_API_URL: 'http://localhost:3000',
};

describe('parseWebEnv', () => {
  it('lee las variables públicas', () => {
    expect(parseWebEnv(valid)).toEqual({
      supabaseUrl: 'http://127.0.0.1:54321',
      supabaseAnonKey: 'sb_publishable_abc',
      apiUrl: 'http://localhost:3000',
      sentryDsn: undefined,
      sentryEnvironment: undefined,
      appVersion: undefined,
      printerSimulated: false,
    });
  });

  it('la impresora simulada solo se activa con VITE_PRINTER_SIMULATED=true', () => {
    expect(parseWebEnv({ ...valid, VITE_PRINTER_SIMULATED: 'true' }).printerSimulated).toBe(true);
    expect(parseWebEnv({ ...valid, VITE_PRINTER_SIMULATED: 'false' }).printerSimulated).toBe(false);
    expect(parseWebEnv({ ...valid, VITE_PRINTER_SIMULATED: '1' }).printerSimulated).toBe(false);
  });

  it('quita la barra final de las URLs', () => {
    expect(parseWebEnv({ ...valid, VITE_API_URL: 'http://localhost:3000/' }).apiUrl).toBe(
      'http://localhost:3000',
    );
  });

  it('falla nombrando las variables que faltan', () => {
    expect(() => parseWebEnv({})).toThrow(
      /VITE_SUPABASE_URL.*VITE_SUPABASE_ANON_KEY.*VITE_API_URL/s,
    );
  });

  it('rechaza una service role key / secret key por error en el frontend', () => {
    expect(() =>
      parseWebEnv({ ...valid, VITE_SUPABASE_ANON_KEY: 'sb_secret_no-deberia-estar-aqui' }),
    ).toThrow(/VITE_SUPABASE_ANON_KEY/);
    const legacyServiceRole =
      'eyJhbGciOiJIUzI1NiJ9.' +
      btoa(JSON.stringify({ role: 'service_role' })).replace(/=+$/, '') +
      '.firma';
    expect(() => parseWebEnv({ ...valid, VITE_SUPABASE_ANON_KEY: legacyServiceRole })).toThrow(
      /service_role/,
    );
  });
});
