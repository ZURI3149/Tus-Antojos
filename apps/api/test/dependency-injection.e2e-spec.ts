import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { API_ERROR_HTTP_STATUS, APP_ROLES } from '@tus-antojos/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

@Injectable()
class GreetingService {
  greet(): string {
    return 'hola';
  }
}

// Sin @Inject(): Nest resuelve GreetingService solo por los metadatos de tipo
// (design:paramtypes). Si SWC no los emitiera, `greetings` llegaría undefined.
@Controller('greet')
class GreetingController {
  constructor(private readonly greetings: GreetingService) {}

  @Get()
  greet(): { message: string } {
    return { message: this.greetings.greet() };
  }
}

@Module({ controllers: [GreetingController], providers: [GreetingService] })
class GreetingModule {}

describe('entorno de pruebas de la API', () => {
  it('inyecta dependencias por tipo (metadatos de decoradores emitidos por SWC)', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [GreetingModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    await request(app.getHttpServer()).get('/greet').expect(200, { message: 'hola' });
    await app.close();
  });

  it('resuelve el paquete @tus-antojos/shared', () => {
    expect(APP_ROLES).toContain('admin');
    expect(API_ERROR_HTTP_STATUS.UNAUTHENTICATED).toBe(401);
  });
});
