import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { APP_CONFIG } from '../../src/config/config.module.js';
import { loadEnv } from '../../src/config/env.schema.js';

/**
 * OR-09 / CE-12: `POST /orders` con 5 líneas responde en p95 < 300 ms contra Supabase local.
 * Mide la API completa en proceso (guardas, validación, RPC `create_order` vía PostgREST).
 */
const SEED_PASSWORD = 'TusAntojos-local-2026';
const PREFIX = `zz-ord-lat-${crypto.randomUUID().slice(0, 8)}-`;
const WARMUP = 10;
const SAMPLES = 100;
const P95_BUDGET_MS = 300;

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)]!;
}

describe('OR-09: latencia de POST /orders', () => {
  const supabase = inject('localSupabase');

  let app: INestApplication;
  let cashierToken: string;
  let pool: pg.Pool;
  const productIds: string[] = [];

  const sql = (text: string, params: unknown[] = []) => pool.query(text, params);

  async function cleanup() {
    const like = `${PREFIX}%`;
    const { rows } = await sql(
      `select distinct o.id from public.orders o
       join public.order_items oi on oi.order_id = o.id
       join public.products p on p.id = oi.product_id
       where p.name like $1`,
      [like],
    );
    const oids = rows.map((r) => r.id as string);
    if (oids.length > 0) {
      await sql(`delete from public.inventory_movements where order_id = any($1)`, [oids]);
      await sql(`delete from public.order_events where order_id = any($1)`, [oids]);
      await sql(`delete from public.order_items where order_id = any($1)`, [oids]);
      await sql(`delete from public.orders where id = any($1)`, [oids]);
    }
    await sql(`update public.products set is_active = false where name like $1`, [like]);
    await sql(
      `delete from public.recipe_items where product_id in (select id from public.products where name like $1)`,
      [like],
    );
    await sql(`delete from public.products where name like $1`, [like]);
    await sql(
      `delete from public.inventory_stock where ingredient_id in (select id from public.ingredients where name like $1)`,
      [like],
    );
    await sql(`delete from public.ingredients where name like $1`, [like]);
    await sql(`delete from public.categories where name like $1`, [like]);
    // Los pedidos de prueba hicieron avanzar el contador del día: se devuelve al número más
    // alto que sigue existiendo (sin repetir) y se borran los de días sin pedidos.
    await sql(
      `delete from public.order_counters c
       where not exists (select 1 from public.orders o where o.business_date = c.business_date)`,
    );
    await sql(
      `update public.order_counters c
       set last_number = (select max(o.order_number) from public.orders o where o.business_date = c.business_date)`,
    );
  }

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: supabase.dbUrl, max: 2 });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(
        loadEnv({
          SUPABASE_URL: supabase.apiUrl,
          SUPABASE_SERVICE_ROLE_KEY: supabase.serviceRoleKey,
          LOG_LEVEL: 'silent',
        }),
      )
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();

    const browser = createClient(supabase.apiUrl, supabase.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await browser.auth.signInWithPassword({
      email: 'cajero@tusantojos.test',
      password: SEED_PASSWORD,
    });
    cashierToken = data.session!.access_token;

    // 5 productos, cada uno con una receta de 2 insumos (10 insumos bloqueados por pedido).
    const { rows: cat } = await sql(
      `insert into public.categories (name, sort_order, is_active) values ($1, 999, true) returning id`,
      [`${PREFIX}Cat`],
    );
    for (let i = 0; i < 5; i++) {
      const { rows: prod } = await sql(
        `insert into public.products (category_id, name, description, price_cents, is_active)
         values ($1, $2, '', $3, false) returning id`,
        [cat[0]!.id, `${PREFIX}P${i}`, 1000 + i * 250],
      );
      const productId = prod[0]!.id as string;
      for (let j = 0; j < 2; j++) {
        const { rows: ing } = await sql(
          `insert into public.ingredients (name, unit, is_active) values ($1, 'g', true) returning id`,
          [`${PREFIX}I${i}-${j}`],
        );
        await sql(
          `update public.inventory_stock set quantity = 1000000, avg_unit_cost = 1 where ingredient_id = $1`,
          [ing[0]!.id],
        );
        await sql(
          `insert into public.recipe_items (product_id, ingredient_id, quantity) values ($1, $2, 50)`,
          [productId, ing[0]!.id],
        );
      }
      await sql(`update public.products set is_active = true where id = $1`, [productId]);
      productIds.push(productId);
    }
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
    await pool.end();
  });

  it(`${SAMPLES} pedidos de 5 líneas: p95 < ${P95_BUDGET_MS} ms`, async () => {
    const server = app.getHttpServer();
    const send = () =>
      request(server)
        .post('/orders')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          clientOrderId: crypto.randomUUID(),
          items: productIds.map((productId, i) => ({ productId, quantity: (i % 3) + 1 })),
          paymentMethod: 'efectivo',
        });

    // Calentamiento: conexiones, JWKS y planes de consulta.
    for (let i = 0; i < WARMUP; i++) {
      const res = await send();
      expect(res.status).toBe(201);
    }

    const durations: number[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      const start = performance.now();
      const res = await send();
      durations.push(performance.now() - start);
      expect(res.status).toBe(201);
    }

    const sorted = [...durations].sort((a, b) => a - b);
    const p50 = percentile(sorted, 50);
    const p95 = percentile(sorted, 95);
    const max = sorted[sorted.length - 1]!;
    console.info(
      `[OR-09] POST /orders (5 líneas, ${SAMPLES} muestras): p50=${p50.toFixed(1)} ms · p95=${p95.toFixed(1)} ms · máx=${max.toFixed(1)} ms`,
    );

    expect(p95).toBeLessThan(P95_BUDGET_MS);
  }, 120_000);
});
