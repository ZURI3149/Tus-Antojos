import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { Roles, ROLES_KEY } from './roles.decorator.js';

describe('@Roles()', () => {
  it('guarda los roles en los metadatos', () => {
    class Probe {
      @Roles('cajero', 'admin')
      handler() {}
    }
    expect(new Reflector().get(ROLES_KEY, Probe.prototype.handler)).toEqual(['cajero', 'admin']);
  });

  it('exige al menos un rol', () => {
    // @ts-expect-error -- sin roles no compila; en tiempo de ejecución también falla
    expect(() => Roles()).toThrow(/al menos un rol/);
  });
});
