import { vi } from 'vitest';
import { ApiError, createApiClient } from './api-client';

function jsonResponse(status: number, body?: unknown, headers: Record<string, string> = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function setup(response: Response | (() => Promise<Response>), token: string | null = 'jwt-123') {
  const fetchImpl = vi.fn(typeof response === 'function' ? response : async () => response.clone());
  const onUnauthorized = vi.fn();
  const onForbidden = vi.fn();
  const api = createApiClient({
    baseUrl: 'http://api.test',
    getAccessToken: async () => token,
    onUnauthorized,
    onForbidden,
    fetch: fetchImpl as unknown as typeof fetch,
  });
  const lastRequest = () => {
    const [url, init] = fetchImpl.mock.calls.at(-1) as unknown as [string, RequestInit];
    return { url, init, headers: new Headers(init.headers) };
  };
  return { api, fetchImpl, onUnauthorized, onForbidden, lastRequest };
}

describe('createApiClient', () => {
  it('GET con Authorization, x-request-id y la URL completa', async () => {
    const s = setup(jsonResponse(200, [{ id: 1 }]));
    await expect(s.api.get('/users')).resolves.toEqual([{ id: 1 }]);
    const { url, init, headers } = s.lastRequest();
    expect(url).toBe('http://api.test/users');
    expect(init.method).toBe('GET');
    expect(headers.get('authorization')).toBe('Bearer jwt-123');
    expect(headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('POST y PATCH envían JSON', async () => {
    const s = setup(jsonResponse(201, { ok: true }));
    await s.api.post('/users', { a: 1 });
    expect(s.lastRequest().init.body).toBe('{"a":1}');
    expect(s.lastRequest().headers.get('content-type')).toBe('application/json');
    await s.api.patch('/users/1', { b: 2 });
    expect(s.lastRequest().init.method).toBe('PATCH');
  });

  it('sin sesión no envía Authorization', async () => {
    const s = setup(jsonResponse(200, {}), null);
    await s.api.get('/health');
    expect(s.lastRequest().headers.has('authorization')).toBe(false);
  });

  it('204 sin cuerpo → undefined', async () => {
    const s = setup(new Response(null, { status: 204 }));
    await expect(s.api.get('/algo')).resolves.toBeUndefined();
  });

  it('error con el formato de la API → ApiError con todos sus campos', async () => {
    const s = setup(
      jsonResponse(400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos inválidos',
          details: [{ path: 'email', message: 'Ingresa un correo válido' }],
          requestId: 'req-1',
        },
      }),
    );
    const error = await s.api.post('/users', {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Datos inválidos',
      requestId: 'req-1',
      fieldErrors: [{ path: 'email', message: 'Ingresa un correo válido' }],
    });
  });

  it('401 → ApiError y onUnauthorized (cierra la sesión)', async () => {
    const s = setup(
      jsonResponse(401, {
        error: { code: 'UNAUTHENTICATED', message: 'No autenticado', requestId: 'r' },
      }),
    );
    await expect(s.api.get('/users')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(s.onUnauthorized).toHaveBeenCalledTimes(1);
    expect(s.onForbidden).not.toHaveBeenCalled();
  });

  it('403 → ApiError y onForbidden con el mensaje', async () => {
    const s = setup(
      jsonResponse(403, {
        error: {
          code: 'FORBIDDEN',
          message: 'No tienes permiso para realizar esta acción',
          requestId: 'r',
        },
      }),
    );
    await expect(s.api.get('/users')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(s.onForbidden).toHaveBeenCalledWith('No tienes permiso para realizar esta acción');
  });

  it('respuesta de error que no sigue el formato → INTERNAL con el requestId del encabezado', async () => {
    const s = setup(
      new Response('<html>Bad Gateway</html>', {
        status: 502,
        headers: { 'x-request-id': 'req-gw' },
      }),
    );
    await expect(s.api.get('/users')).rejects.toMatchObject({
      status: 502,
      code: 'INTERNAL',
      message: 'Error del servidor. Inténtalo de nuevo.',
      requestId: 'req-gw',
    });
  });

  it('fallo de red → ApiError NETWORK', async () => {
    const s = setup(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(s.api.get('/users')).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK',
      message: 'No se pudo conectar con el servidor',
    });
  });
});
