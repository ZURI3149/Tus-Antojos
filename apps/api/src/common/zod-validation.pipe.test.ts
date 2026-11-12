import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { AppException } from './app-exception.js';
import { ZodValidationPipe } from './zod-validation.pipe.js';

const schema = z.object({
  items: z.array(z.object({ quantity: z.number().int().positive() })).min(1),
  email: z.email(),
  page: z.coerce.number().int().default(1),
});

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(schema);
  const meta = { type: 'body' as const };

  it('devuelve los datos ya parseados (con coerción y valores por defecto)', () => {
    expect(pipe.transform({ items: [{ quantity: 2 }], email: 'a@b.co', extra: 'x' }, meta)).toEqual(
      { items: [{ quantity: 2 }], email: 'a@b.co', page: 1 },
    );
  });

  it('lanza VALIDATION_ERROR con path y mensaje en español por cada campo inválido', () => {
    let thrown: unknown;
    try {
      pipe.transform({ items: [{ quantity: 0 }], email: 'no-es-correo' }, meta);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(AppException);
    const error = thrown as AppException;
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.getStatus()).toBe(400);
    expect(error.details).toEqual([
      { path: 'items.0.quantity', message: expect.stringMatching(/se esperaba/i) },
      { path: 'email', message: expect.stringMatching(/inválid/i) },
    ]);
  });

  it('un body ausente se informa en la raíz', () => {
    expect(() => pipe.transform(undefined, meta)).toThrow(AppException);
    try {
      pipe.transform(undefined, meta);
    } catch (error) {
      expect((error as AppException).details).toEqual([
        { path: '(raíz)', message: expect.any(String) },
      ]);
    }
  });
});
