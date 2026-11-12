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
