-- =============================================================================
-- 0002_users_admin: funciones RPC para la gestión de usuarios (solo service_role).
-- Spec: specs/SPEC-platform.md §2.1 (módulo users) · Tarea T13
--
-- Por los privilegios por defecto de 0001_platform, estas funciones nacen sin
-- EXECUTE para anon/authenticated: solo NestJS (service_role) puede llamarlas.
-- La API exige además el rol admin (RolesGuard).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Lista de usuarios (o uno solo) con el correo y el último acceso de auth.users.
-- -----------------------------------------------------------------------------
create function public.admin_list_users(p_user_id uuid default null)
returns table (
  id uuid,
  email text,
  full_name text,
  role public.app_role,
  is_active boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, u.email::text, p.full_name, p.role, p.is_active, p.created_at, u.last_sign_in_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p_user_id is null or p.id = p_user_id
  order by p.created_at, u.email;
$$;

-- -----------------------------------------------------------------------------
-- Actualiza rol, estado y/o nombre en UNA transacción.
--   - El rol se escribe en auth.users.raw_app_meta_data; el trigger
--     private.sync_profile_from_auth lo replica en profiles.
--   - Si cambia el rol o se desactiva, se cierran sus sesiones (sus refresh
--     tokens dejan de servir). Sus access tokens vigentes ya no sirven en la
--     API ni en RLS porque ambos leen profiles.
--   - Nunca deja el sistema sin un admin activo.
-- Errores (P0001): NOTHING_TO_UPDATE, USER_NOT_FOUND, LAST_ADMIN.
-- -----------------------------------------------------------------------------
create function public.admin_update_user(
  p_user_id uuid,
  p_role public.app_role default null,
  p_is_active boolean default null,
  p_full_name text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.profiles%rowtype;
  v_other_active_admins integer;
  v_role_changes boolean;
begin
  if p_role is null and p_is_active is null and p_full_name is null then
    raise exception 'NOTHING_TO_UPDATE' using errcode = 'P0001';
  end if;

  select * into v_current from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_role_changes := p_role is not null and p_role <> v_current.role;

  if v_current.role = 'admin' and v_current.is_active
     and (v_role_changes or p_is_active = false) then
    -- Bloquea a todos los admins activos: dos cambios simultáneos no pueden
    -- dejar el sistema sin admin.
    perform 1 from public.profiles where role = 'admin' and is_active for update;
    select count(*) into v_other_active_admins
    from public.profiles
    where role = 'admin' and is_active and id <> p_user_id;
    if v_other_active_admins = 0 then
      raise exception 'LAST_ADMIN' using errcode = 'P0001';
    end if;
  end if;

  if v_role_changes then
    update auth.users
    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                            || jsonb_build_object('role', p_role::text),
        updated_at = now()
    where id = p_user_id;
  end if;

  if p_is_active is not null or p_full_name is not null then
    update public.profiles
    set is_active = coalesce(p_is_active, is_active),
        full_name = coalesce(p_full_name, full_name)
    where id = p_user_id;
  end if;

  if v_role_changes or p_is_active = false then
    delete from auth.sessions where user_id = p_user_id;
  end if;
end;
$$;
