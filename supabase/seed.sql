-- =============================================================================
-- Seed SOLO para entorno local / CI. Nunca se aplica en Supabase Cloud
-- (`supabase db push` no ejecuta el seed).
--
-- Usuarios de prueba (contraseña común: TusAntojos-local-2026):
--   cajero@tusantojos.test  -> cajero
--   cocina@tusantojos.test  -> cocina
--   admin@tusantojos.test   -> admin
--
-- Los perfiles los crea el trigger private.sync_profile_from_auth.
-- =============================================================================

with seed_users (id, email, role, full_name) as (
  values
    ('00000000-0000-4000-a000-000000000001'::uuid, 'cajero@tusantojos.test', 'cajero', 'Cajero de Prueba'),
    ('00000000-0000-4000-a000-000000000002'::uuid, 'cocina@tusantojos.test', 'cocina', 'Cocina de Prueba'),
    ('00000000-0000-4000-a000-000000000003'::uuid, 'admin@tusantojos.test', 'admin', 'Admin de Prueba')
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  -- GoTrue no admite NULL en estas columnas al iniciar sesión.
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  id,
  'authenticated',
  'authenticated',
  email,
  extensions.crypt('TusAntojos-local-2026', extensions.gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', role),
  jsonb_build_object('full_name', full_name),
  now(),
  now(),
  '', '', '', ''
from seed_users;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(),
  u.id,
  u.id::text,
  'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(),
  now(),
  now()
from auth.users u
where u.email like '%@tusantojos.test';

-- Forzar la ejecución del trigger diferido on_auth_user_sync_profile para que public.profiles
-- tenga los usuarios creados antes de que las FKs de otros módulos los referencien.
set constraints all immediate;

-- =============================================================================
-- Menú de ejemplo (spec catalog §3.1): 3 categorías, 8 insumos, 6 productos activos
-- con receta y 1 inactivo. Cantidades en unidad base (g, ml, unidad) y precios en
-- centavos. Los productos se insertan inactivos y se activan después de cargar su
-- receta: la regla PRODUCT_WITHOUT_RECIPE se comprueba en cada sentencia.
-- =============================================================================

insert into public.categories (id, name, sort_order) values
  ('00000000-0000-4000-c000-000000000001', 'Helados', 1),
  ('00000000-0000-4000-c000-000000000002', 'Postres', 2),
  ('00000000-0000-4000-c000-000000000003', 'Bebidas', 3);

insert into public.ingredients (id, name, unit) values
  ('00000000-0000-4000-e000-000000000001', 'Leche', 'ml'),
  ('00000000-0000-4000-e000-000000000002', 'Crema de leche', 'ml'),
  ('00000000-0000-4000-e000-000000000003', 'Azúcar', 'g'),
  ('00000000-0000-4000-e000-000000000004', 'Chocolate en polvo', 'g'),
  ('00000000-0000-4000-e000-000000000005', 'Frutillas', 'g'),
  ('00000000-0000-4000-e000-000000000006', 'Cono de galleta', 'unidad'),
  ('00000000-0000-4000-e000-000000000007', 'Vaso descartable', 'unidad'),
  ('00000000-0000-4000-e000-000000000008', 'Gaseosa personal', 'unidad');

insert into public.products (id, category_id, name, description, price_cents) values
  ('00000000-0000-4000-f000-000000000001', '00000000-0000-4000-c000-000000000001',
   'Cono simple', 'Una bola de helado de leche en cono', 800),
  ('00000000-0000-4000-f000-000000000002', '00000000-0000-4000-c000-000000000001',
   'Cono de frutilla', 'Helado de frutilla en cono', 1000),
  ('00000000-0000-4000-f000-000000000003', '00000000-0000-4000-c000-000000000001',
   'Copa de chocolate', 'Tres bolas de chocolate en vaso', 1500),
  ('00000000-0000-4000-f000-000000000004', '00000000-0000-4000-c000-000000000002',
   'Frutillas con crema', '', 1800),
  ('00000000-0000-4000-f000-000000000005', '00000000-0000-4000-c000-000000000003',
   'Licuado de frutilla', 'Con leche', 1200),
  ('00000000-0000-4000-f000-000000000006', '00000000-0000-4000-c000-000000000003',
   'Gaseosa', 'Personal de 500 ml', 700),
  ('00000000-0000-4000-f000-000000000007', '00000000-0000-4000-c000-000000000003',
   'Malteada de chocolate', 'Fuera de temporada', 1400),
  ('00000000-0000-4000-f000-000000000008', '00000000-0000-4000-c000-000000000002',
   'Torta artesanal', 'Porción individual de chocolate y crema', 2500);

insert into public.recipe_items (product_id, ingredient_id, quantity) values
  -- Cono simple: 120 ml de leche, 20 g de azúcar, 1 cono
  ('00000000-0000-4000-f000-000000000001', '00000000-0000-4000-e000-000000000001', 120),
  ('00000000-0000-4000-f000-000000000001', '00000000-0000-4000-e000-000000000003', 20),
  ('00000000-0000-4000-f000-000000000001', '00000000-0000-4000-e000-000000000006', 1),
  -- Cono de frutilla
  ('00000000-0000-4000-f000-000000000002', '00000000-0000-4000-e000-000000000001', 100),
  ('00000000-0000-4000-f000-000000000002', '00000000-0000-4000-e000-000000000005', 60),
  ('00000000-0000-4000-f000-000000000002', '00000000-0000-4000-e000-000000000006', 1),
  -- Copa de chocolate
  ('00000000-0000-4000-f000-000000000003', '00000000-0000-4000-e000-000000000002', 150),
  ('00000000-0000-4000-f000-000000000003', '00000000-0000-4000-e000-000000000004', 30),
  ('00000000-0000-4000-f000-000000000003', '00000000-0000-4000-e000-000000000003', 25),
  ('00000000-0000-4000-f000-000000000003', '00000000-0000-4000-e000-000000000007', 1),
  -- Frutillas con crema
  ('00000000-0000-4000-f000-000000000004', '00000000-0000-4000-e000-000000000005', 200),
  ('00000000-0000-4000-f000-000000000004', '00000000-0000-4000-e000-000000000002', 100),
  ('00000000-0000-4000-f000-000000000004', '00000000-0000-4000-e000-000000000003', 15),
  ('00000000-0000-4000-f000-000000000004', '00000000-0000-4000-e000-000000000007', 1),
  -- Licuado de frutilla
  ('00000000-0000-4000-f000-000000000005', '00000000-0000-4000-e000-000000000001', 300),
  ('00000000-0000-4000-f000-000000000005', '00000000-0000-4000-e000-000000000005', 120),
  ('00000000-0000-4000-f000-000000000005', '00000000-0000-4000-e000-000000000003', 20),
  ('00000000-0000-4000-f000-000000000005', '00000000-0000-4000-e000-000000000007', 1),
  -- Gaseosa: reventa modelada como insumo 1:1 (spec catalog D1)
  ('00000000-0000-4000-f000-000000000006', '00000000-0000-4000-e000-000000000008', 1),
  -- Malteada (queda inactiva)
  ('00000000-0000-4000-f000-000000000007', '00000000-0000-4000-e000-000000000001', 300),
  ('00000000-0000-4000-f000-000000000007', '00000000-0000-4000-e000-000000000004', 40),
  ('00000000-0000-4000-f000-000000000007', '00000000-0000-4000-e000-000000000007', 1),
  -- Torta artesanal: 150 ml de crema, 30 g de chocolate, 25 g de azúcar
  ('00000000-0000-4000-f000-000000000008', '00000000-0000-4000-e000-000000000002', 150),
  ('00000000-0000-4000-f000-000000000008', '00000000-0000-4000-e000-000000000004', 30),
  ('00000000-0000-4000-f000-000000000008', '00000000-0000-4000-e000-000000000003', 25);

update public.products set is_active = true
where id <> '00000000-0000-4000-f000-000000000007'
  and id::text like '00000000-0000-4000-f000-%';

-- =============================================================================
-- Inventario inicial (spec inventory §3.1 y §5): compra inicial para los 8 insumos,
-- una merma y configuración de mínimos en 3 insumos (uno queda bajo mínimo).
-- =============================================================================

select public.register_purchase(
  current_date,
  'Distribuidora Central Gastronómica',
  'Compra inicial de reaprovisionamiento',
  jsonb_build_array(
    jsonb_build_object('ingredientId', '00000000-0000-4000-e000-000000000001', 'quantity', 20000, 'costCents', 10000),
    jsonb_build_object('ingredientId', '00000000-0000-4000-e000-000000000002', 'quantity', 5000, 'costCents', 5000),
    jsonb_build_object('ingredientId', '00000000-0000-4000-e000-000000000003', 'quantity', 10000, 'costCents', 8000),
    jsonb_build_object('ingredientId', '00000000-0000-4000-e000-000000000004', 'quantity', 2000, 'costCents', 4000),
    jsonb_build_object('ingredientId', '00000000-0000-4000-e000-000000000005', 'quantity', 2000, 'costCents', 3000),
    jsonb_build_object('ingredientId', '00000000-0000-4000-e000-000000000006', 'quantity', 200, 'costCents', 10000),
    jsonb_build_object('ingredientId', '00000000-0000-4000-e000-000000000007', 'quantity', 200, 'costCents', 6000),
    jsonb_build_object('ingredientId', '00000000-0000-4000-e000-000000000008', 'quantity', 50, 'costCents', 20000)
  ),
  '00000000-0000-4000-a000-000000000003'::uuid
);

-- Merma de prueba: 500 g de Frutillas
select public.record_waste(
  '00000000-0000-4000-e000-000000000005'::uuid,
  500,
  'Frutillas en mal estado detectadas en recepción',
  '00000000-0000-4000-a000-000000000003'::uuid
);

-- Stock mínimo configurado en 3 insumos (Frutillas queda bajo mínimo: 1500 g < 3000 g)
update public.inventory_stock set min_quantity = 5000 where ingredient_id = '00000000-0000-4000-e000-000000000001';
update public.inventory_stock set min_quantity = 5000 where ingredient_id = '00000000-0000-4000-e000-000000000003';
update public.inventory_stock set min_quantity = 3000 where ingredient_id = '00000000-0000-4000-e000-000000000005';

-- =============================================================================
-- Promociones de ejemplo (spec promotions §3.1 y PM4):
-- una vigente (15 % en 2 productos), una programada (Bs 2 de descuento en 7 días) y una vencida.
-- =============================================================================

select public.create_promotion(
  'Promo Verano 15%',
  'porcentaje',
  15,
  now() - interval '1 day',
  array['00000000-0000-4000-f000-000000000001'::uuid, '00000000-0000-4000-f000-000000000002'::uuid],
  now() + interval '30 days',
  '00000000-0000-4000-a000-000000000003'::uuid
);

select public.create_promotion(
  'Descuento Especial Helados',
  'monto_fijo',
  200,
  now() + interval '7 days',
  array['00000000-0000-4000-f000-000000000003'::uuid],
  now() + interval '14 days',
  '00000000-0000-4000-a000-000000000003'::uuid
);

select public.create_promotion(
  'Promo Lanzamiento Pasada',
  'porcentaje',
  10,
  now() - interval '30 days',
  array['00000000-0000-4000-f000-000000000001'::uuid],
  now() - interval '1 day',
  '00000000-0000-4000-a000-000000000003'::uuid
);
