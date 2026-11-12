-- =============================================================================
-- 0001_platform: privilegios por defecto, roles y perfiles.
-- Spec: specs/SPEC-platform.md §2.1 y §3.2
--
-- Regla del sistema: el cliente (anon / authenticated) NUNCA escribe.
-- Toda escritura pasa por NestJS con service_role, que llama a funciones RPC.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Privilegios por defecto para todo objeto FUTURO creado por `postgres`
--    (el rol con el que corren las migraciones) en el esquema public.
--    Supabase, por defecto, concede ALL a anon y authenticated: se revoca.
--    service_role conserva sus permisos.
-- -----------------------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;
-- PostgreSQL concede EXECUTE a PUBLIC en toda función nueva; se revoca globalmente.
alter default privileges for role postgres
  revoke execute on functions from public;

-- Objetos que ya existan en public.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- Cada tabla nueva debe, en su propia migración:
--   alter table ... enable row level security;
--   grant select on ... to authenticated;
--   create policy ... for select to authenticated using (...);
-- y nunca políticas de insert/update/delete.

-- -----------------------------------------------------------------------------
-- 2. Esquema privado: funciones auxiliares que usan las políticas RLS y los
--    triggers. No está en `api.schemas`, así que la API REST no lo expone.
-- -----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Roles de la aplicación (deben coincidir con APP_ROLES en @tus-antojos/shared)
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('cajero', 'cocina', 'admin');

-- -----------------------------------------------------------------------------
-- 4. Perfiles: una fila por usuario de auth.users. El rol vive en
--    auth.users.raw_app_meta_data.role (no editable por el cliente) y se
--    replica aquí con un trigger.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  role public.app_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Perfil y rol de cada usuario. Lo escribe solo el trigger de auth.users y la API (service_role).';

-- updated_at automático (genérico, reutilizable por otros módulos).
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Sincroniza auth.users -> profiles. Rechaza usuarios sin un rol válido, de modo
-- que crear el usuario y su perfil es atómico (si falla uno, falla todo).
--
-- Es un trigger DIFERIDO (se ejecuta al confirmar la transacción) y relee la fila
-- actual: Supabase Auth inserta el usuario sin app_metadata.role y lo escribe
-- después, dentro de la misma transacción. Validar en el INSERT rechazaría a
-- todo usuario creado con auth.admin.createUser().
create function private.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user auth.users%rowtype;
  v_role text;
begin
  select * into v_user from auth.users where id = new.id;
  if not found then
    return null; -- borrado dentro de la misma transacción
  end if;

  v_role := v_user.raw_app_meta_data ->> 'role';
  if v_role is null or v_role not in ('cajero', 'cocina', 'admin') then
    raise exception 'INVALID_ROLE'
      using errcode = 'P0001',
            detail = format('El usuario %s no tiene un rol válido en app_metadata.role', v_user.id);
  end if;

  insert into public.profiles (id, full_name, role)
  values (
    v_user.id,
    coalesce(v_user.raw_user_meta_data ->> 'full_name', ''),
    v_role::public.app_role
  )
  on conflict (id) do update
    set role = excluded.role
    where public.profiles.role is distinct from excluded.role;

  return null;
end;
$$;

create constraint trigger on_auth_user_sync_profile
  after insert or update of raw_app_meta_data on auth.users
  deferrable initially deferred
  for each row execute function private.sync_profile_from_auth();

-- -----------------------------------------------------------------------------
-- 5. Rol del usuario actual, para las políticas RLS de todos los módulos.
--    Lee `profiles` (fuente de verdad) y devuelve NULL si el usuario no existe
--    o está inactivo: un usuario desactivado pierde la lectura de inmediato,
--    sin esperar a que venza su JWT.
--    Uso en políticas: `(select private.current_app_role()) in (...)`
--    (el `select` hace que se evalúe una vez por consulta, no por fila).
-- -----------------------------------------------------------------------------
create function private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active;
$$;

revoke execute on function private.current_app_role() from public, anon;
grant execute on function private.current_app_role() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6. RLS de profiles: cada usuario lee su propio perfil; admin lee todos.
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

grant select on public.profiles to authenticated;

create policy profiles_select_own_or_admin
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or (select private.current_app_role()) = 'admin'
  );
