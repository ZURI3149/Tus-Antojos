import { describe, expect, it } from 'vitest';
import { API_ERROR_CODES, API_ERROR_HTTP_STATUS, apiErrorBodySchema } from './errors';

describe('códigos de error', () => {
  it('cada código tiene su estado HTTP según el spec §3.3', () => {
    expect(API_ERROR_HTTP_STATUS).toEqual({
      VALIDATION_ERROR: 400,
      UNAUTHENTICATED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      CONFLICT: 409,
      BUSINESS_RULE: 422,
      INTERNAL: 500,
    });
    expect(Object.keys(API_ERROR_HTTP_STATUS).sort()).toEqual([...API_ERROR_CODES].sort());
  });
});

describe('apiErrorBodySchema', () => {
  it('acepta un error de validación con detalles por campo', () => {
    const body = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos inválidos',
        details: [{ path: 'items.0.quantity', message: 'Debe ser mayor a 0' }],
        requestId: '8f1c2d',
      },
    };
    expect(apiErrorBodySchema.parse(body)).toEqual(body);
  });

  it('acepta details como objeto (p. ej. reason de un RPC)', () => {
    const body = {
      error: {
        code: 'BUSINESS_RULE',
        message: 'Operación rechazada',
        details: { reason: 'PRODUCT_INACTIVE' },
        requestId: 'abc',
      },
    };
    expect(apiErrorBodySchema.safeParse(body).success).toBe(true);
  });

  it('details es opcional', () => {
    const body = { error: { code: 'NOT_FOUND', message: 'No existe', requestId: 'r1' } };
    expect(apiErrorBodySchema.safeParse(body).success).toBe(true);
  });

  it('rechaza códigos desconocidos y la falta de requestId', () => {
    expect(
      apiErrorBodySchema.safeParse({ error: { code: 'OOPS', message: 'x', requestId: 'r' } })
        .success,
    ).toBe(false);
    expect(
      apiErrorBodySchema.safeParse({ error: { code: 'INTERNAL', message: 'x' } }).success,
    ).toBe(false);
  });
});
