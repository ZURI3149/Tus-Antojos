import { Writable } from 'node:stream';
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  UnauthorizedException,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PostgrestError } from '@supabase/supabase-js';
import { apiErrorBodySchema } from '@tus-antojos/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppModule } from '../src/app.module.js';
import { Public } from '../src/auth/public.decorator.js';
import { AppException } from '../src/common/app-exception.js';
import { mapRpcError } from '../src/common/rpc-error.js';
import { ZodValidationPipe } from '../src/common/zod-validation.pipe.js';
import { APP_CONFIG, LOG_DESTINATION } from '../src/config/config.module.js';
import { loadEnv } from '../src/config/env.schema.js';
import { SupabaseService } from '../src/supabase/supabase.service.js';

const echoSchema = z.object({ quantity: z.number().int().positive() });

// Pública: aquí se prueba el formato de error, no la autenticación.
@Public()
@Controller('errores')
class ErrorsController {
  @Post('validacion')
  validate(@Body(new ZodValidationPipe(echoSchema)) body: z.infer<typeof echoSchema>) {
    return body;
  }

  @Get('401')
  unauthorized() {
    throw new UnauthorizedException('Unauthorized from Nest');
  }

  @Get('403')
  forbidden() {
    throw new ForbiddenException();
  }

  @Get('400-nest')
  nestBadRequest() {
    throw new BadRequestException('English message from Nest');
  }

  @Get('409')
  conflict() {
    throw new AppException('CONFLICT', 'El correo ya está registrado');
  }

  @Get('rpc')
  rpc() {
    throw mapRpcError(
      new PostgrestError({ code: 'P0001', message: 'PRODUCT_INACTIVE', details: '', hint: '' }),
    );
  }

  @Get('postgrest-sin-mapear')
  rawPostgrest() {
    throw new PostgrestError({ code: 'P0001', message: 'OUT_OF_STOCK', details: '', hint: '' });
  }

  @Get('500')
  crash() {
    throw new Error('fallo interno con datos sensibles: password=hunter2');
  }
}

describe('formato de error de la API (spec §3.3)', () => {
  let app: INestApplication;
  let lines: string[] = [];
  const capture = new Writable({
    write(chunk, _enc, cb) {
      lines.push(String(chunk));
      cb();
    },
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ErrorsController],
    })
      .overrideProvider(APP_CONFIG)
      .useValue(
        loadEnv({
          SUPABASE_URL: 'http://127.0.0.1:54321',
          SUPABASE_SERVICE_ROLE_KEY: 'test',
          NODE_ENV: 'test',
        }),
      )
      .overrideProvider(LOG_DESTINATION)
      .useValue(capture)
      .overrideProvider(SupabaseService)
      .useValue({ isDatabaseReachable: async () => true })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    lines = [];
  });

  afterAll(async () => {
    await app.close();
  });

  async function expectError(
    req: request.Test,
    status: number,
    code: string,
    message?: string | RegExp,
  ) {
    const res = await req.set('x-request-id', `req-${code}`).expect(status);
    expect(apiErrorBodySchema.safeParse(res.body).success).toBe(true);
    expect(res.body.error.code).toBe(code);
    expect(res.body.error.requestId).toBe(`req-${code}`);
    if (message) expect(res.body.error.message).toMatch(message);
    return res.body.error as { message: string; details?: unknown };
  }

  const http = () => request(app.getHttpServer());

  it('400 VALIDATION_ERROR con detalles por campo', async () => {
    const error = await expectError(
      http().post('/errores/validacion').send({ quantity: 0 }),
      400,
      'VALIDATION_ERROR',
      'Datos inválidos',
    );
    expect(error.details).toEqual([{ path: 'quantity', message: expect.any(String) }]);
  });

  it('400 VALIDATION_ERROR con JSON mal formado', async () => {
    await expectError(
      http().post('/errores/validacion').set('content-type', 'application/json').send('{"q":'),
      400,
      'VALIDATION_ERROR',
    );
  });

  it('las excepciones de Nest no filtran mensajes en inglés', async () => {
    const error = await expectError(http().get('/errores/400-nest'), 400, 'VALIDATION_ERROR');
    expect(error.message).not.toMatch(/English/);
  });

  it('401 UNAUTHENTICATED', async () => {
    await expectError(http().get('/errores/401'), 401, 'UNAUTHENTICATED', 'No autenticado');
  });

  it('403 FORBIDDEN', async () => {
    await expectError(http().get('/errores/403'), 403, 'FORBIDDEN');
  });

  it('404 NOT_FOUND para rutas inexistentes', async () => {
    await expectError(http().get('/no-existe'), 404, 'NOT_FOUND', 'Recurso no encontrado');
  });

  it('409 CONFLICT conserva el mensaje de AppException', async () => {
    await expectError(http().get('/errores/409'), 409, 'CONFLICT', 'El correo ya está registrado');
  });

  it('422 BUSINESS_RULE desde un error P0001 de RPC', async () => {
    const error = await expectError(http().get('/errores/rpc'), 422, 'BUSINESS_RULE');
    expect(error.details).toEqual({ reason: 'PRODUCT_INACTIVE' });
  });

  it('un PostgrestError lanzado sin mapear también se traduce', async () => {
    const error = await expectError(
      http().get('/errores/postgrest-sin-mapear'),
      422,
      'BUSINESS_RULE',
    );
    expect(error.details).toEqual({ reason: 'OUT_OF_STOCK' });
  });

  it('500 INTERNAL con mensaje genérico, sin traza, y el error completo en el log', async () => {
    const res = await http().get('/errores/500').set('x-request-id', 'req-crash').expect(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL', message: 'Error interno del servidor', requestId: 'req-crash' },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/hunter2|stack|at /);

    const logged = lines.map((l) => JSON.parse(l) as Record<string, unknown>);
    const errorLog = logged.find(
      (log) => log.requestId === 'req-crash' && (log.err as { stack?: string } | undefined)?.stack,
    );
    expect(errorLog?.level).toBe(50);
    expect((errorLog?.err as { message: string }).message).toContain('fallo interno');
  });
});
