-- =============================================================================
-- 0005_promotions: tipos, promociones, productos en promoción, cálculo y RPC.
-- Spec: specs/SPEC-promotions.md §3.1 · Tarea PM2
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tipos y tablas
-- -----------------------------------------------------------------------------

create type public.promotion_kind as enum ('porcentaje', 'monto_fijo');

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80 and name = btrim(name)),
  kind public.promotion_kind not null,
  value integer not null check (
    (kind = 'porcentaje' and value between 1 and 100) or
    (kind = 'monto_fijo' and value between 1 and 100000000)
  ),
  starts_at timestamptz not null,
  ends_at timestamptz check (ends_at is null or ends_at > starts_at),
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Nombres únicos entre promociones activas (insensible a mayúsculas/minúsculas)
create unique index promotions_name_active_key on public.promotions (lower(name)) where is_active;
create index promotions_starts_at_ends_at_idx on public.promotions (starts_at, ends_at);

create table public.promotion_products (
  promotion_id uuid not null references public.promotions (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  primary key (promotion_id, product_id)
);

create index promotion_products_product_id_idx on public.promotion_products (product_id);

comment on table public.promotions is 'Descuentos con vigencia sobre productos del menú.';
comment on table public.promotion_products is 'Productos incluidos en cada promoción.';

create trigger promotions_set_updated_at
  before update on public.promotions
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. Funciones de cálculo (private)
-- -----------------------------------------------------------------------------

create or replace function private.promotion_unit_discount(
  p_price_cents integer,
  p_kind public.promotion_kind,
  p_value integer
)
returns integer
language sql
immutable
as $$
  select case
    when p_price_cents <= 0 or p_value <= 0 then 0
    when p_kind = 'porcentaje' then
      least(p_price_cents, greatest(0, round((p_price_cents::numeric * p_value::numeric) / 100)::integer))
    else
      least(p_price_cents, greatest(0, p_value))
  end;
$$;

create or replace function private.best_promotion(
  p_product_id uuid,
  p_price_cents integer,
  p_at timestamptz
)
returns table (
  promotion_id uuid,
  name text,
  unit_discount_cents integer
)
language sql
stable
as $$
  select
    p.id as promotion_id,
    p.name,
    private.promotion_unit_discount(p_price_cents, p.kind, p.value) as unit_discount_cents
  from public.promotions p
  join public.promotion_products pp on pp.promotion_id = p.id
  where pp.product_id = p_product_id
    and p.is_active = true
    and p.starts_at <= p_at
    and (p.ends_at is null or p_at < p.ends_at)
    and private.promotion_unit_discount(p_price_cents, p.kind, p.value) > 0
  order by
    unit_discount_cents desc,
    p.starts_at asc,
    p.id asc
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- 3. Funciones RPC (public)
-- -----------------------------------------------------------------------------

create or replace function public.create_promotion(
  p_name text,
  p_kind public.promotion_kind,
  p_value integer,
  p_starts_at timestamptz,
  p_product_ids uuid[],
  p_ends_at timestamptz default null,
  p_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_trimmed_name text := btrim(coalesce(p_name, ''));
  v_distinct_products uuid[];
  v_count integer;
begin
  if char_length(v_trimmed_name) < 1 or char_length(v_trimmed_name) > 80 then
    raise exception 'PROMOTION_INVALID_NAME' using errcode = 'P0001';
  end if;

  if p_kind = 'porcentaje' and (p_value < 1 or p_value > 100) then
    raise exception 'PROMOTION_INVALID_VALUE' using errcode = 'P0001';
  elsif p_kind = 'monto_fijo' and (p_value < 1 or p_value > 100000000) then
    raise exception 'PROMOTION_INVALID_VALUE' using errcode = 'P0001';
  end if;

  if p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception 'PROMOTION_INVALID_DATES' using errcode = 'P0001';
  end if;

  -- Comprobar nombre único entre activas
  if exists (
    select 1 from public.promotions
    where is_active = true and lower(name) = lower(v_trimmed_name)
  ) then
    raise exception 'PROMOTION_NAME_TAKEN' using errcode = 'P0001';
  end if;

  -- Obtener productos únicos sin duplicados
  select array_agg(distinct pid) into v_distinct_products
  from unnest(coalesce(p_product_ids, array[]::uuid[])) as pid;

  if v_distinct_products is null or array_length(v_distinct_products, 1) < 1 or array_length(v_distinct_products, 1) > 100 then
    raise exception 'PROMOTION_EMPTY_PRODUCTS' using errcode = 'P0001';
  end if;

  -- Comprobar que todos los productos existen
  select count(*) into v_count
  from public.products
  where id = any(v_distinct_products);

  if v_count <> array_length(v_distinct_products, 1) then
    raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0001';
  end if;

  insert into public.promotions (
    name,
    kind,
    value,
    starts_at,
    ends_at,
    is_active,
    created_by
  ) values (
    v_trimmed_name,
    p_kind,
    p_value,
    p_starts_at,
    p_ends_at,
    true,
    p_user_id
  ) returning id into v_id;

  insert into public.promotion_products (promotion_id, product_id)
  select v_id, pid from unnest(v_distinct_products) as pid;

  return v_id;
end;
$$;

create or replace function public.update_promotion(
  p_id uuid,
  p_changes jsonb,
  p_product_ids uuid[] default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_promo public.promotions%rowtype;
  v_name text;
  v_kind public.promotion_kind;
  v_value integer;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_is_active boolean;
  v_distinct_products uuid[];
  v_count integer;
begin
  select * into v_promo
  from public.promotions
  where id = p_id
  for update;

  if not found then
    raise exception 'PROMOTION_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_name := case
    when p_changes ? 'name' then btrim((p_changes->>'name'))
    else v_promo.name
  end;

  v_kind := case
    when p_changes ? 'kind' then (p_changes->>'kind')::public.promotion_kind
    else v_promo.kind
  end;

  v_value := case
    when p_changes ? 'value' then (p_changes->>'value')::integer
    else v_promo.value
  end;

  v_starts_at := case
    when p_changes ? 'startsAt' then (p_changes->>'startsAt')::timestamptz
    when p_changes ? 'starts_at' then (p_changes->>'starts_at')::timestamptz
    else v_promo.starts_at
  end;

  v_ends_at := case
    when p_changes ? 'endsAt' then
      case when p_changes->>'endsAt' is null then null else (p_changes->>'endsAt')::timestamptz end
    when p_changes ? 'ends_at' then
      case when p_changes->>'ends_at' is null then null else (p_changes->>'ends_at')::timestamptz end
    else v_promo.ends_at
  end;

  v_is_active := case
    when p_changes ? 'isActive' then (p_changes->>'isActive')::boolean
    when p_changes ? 'is_active' then (p_changes->>'is_active')::boolean
    else v_promo.is_active
  end;

  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'PROMOTION_INVALID_NAME' using errcode = 'P0001';
  end if;

  if v_kind = 'porcentaje' and (v_value < 1 or v_value > 100) then
    raise exception 'PROMOTION_INVALID_VALUE' using errcode = 'P0001';
  elsif v_kind = 'monto_fijo' and (v_value < 1 or v_value > 100000000) then
    raise exception 'PROMOTION_INVALID_VALUE' using errcode = 'P0001';
  end if;

  if v_ends_at is not null and v_ends_at <= v_starts_at then
    raise exception 'PROMOTION_INVALID_DATES' using errcode = 'P0001';
  end if;

  -- Comprobar nombre único entre activas
  if v_is_active and exists (
    select 1 from public.promotions
    where id <> p_id and is_active = true and lower(name) = lower(v_name)
  ) then
    raise exception 'PROMOTION_NAME_TAKEN' using errcode = 'P0001';
  end if;

  update public.promotions
  set
    name = v_name,
    kind = v_kind,
    value = v_value,
    starts_at = v_starts_at,
    ends_at = v_ends_at,
    is_active = v_is_active
  where id = p_id;

  -- Reemplazar productos si se envió el array
  if p_product_ids is not null then
    select array_agg(distinct pid) into v_distinct_products
    from unnest(p_product_ids) as pid;

    if v_distinct_products is null or array_length(v_distinct_products, 1) < 1 or array_length(v_distinct_products, 1) > 100 then
      raise exception 'PROMOTION_EMPTY_PRODUCTS' using errcode = 'P0001';
    end if;

    select count(*) into v_count
    from public.products
    where id = any(v_distinct_products);

    if v_count <> array_length(v_distinct_products, 1) then
      raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0001';
    end if;

    delete from public.promotion_products where promotion_id = p_id;

    insert into public.promotion_products (promotion_id, product_id)
    select p_id, pid from unnest(v_distinct_products) as pid;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Privilegios y Políticas RLS
-- -----------------------------------------------------------------------------

revoke execute on function public.create_promotion from public, anon, authenticated;
grant execute on function public.create_promotion to service_role;

revoke execute on function public.update_promotion from public, anon, authenticated;
grant execute on function public.update_promotion to service_role;

revoke all on function private.promotion_unit_discount from public, anon, authenticated;
revoke all on function private.best_promotion from public, anon, authenticated;

alter table public.promotions enable row level security;
alter table public.promotion_products enable row level security;

grant select on public.promotions, public.promotion_products to authenticated;
grant all on public.promotions, public.promotion_products to service_role;

create policy promotions_select on public.promotions
  for select to authenticated
  using (
    (select private.current_app_role()) = 'admin'
    or (is_active and (select private.current_app_role()) is not null)
  );

create policy promotion_products_select on public.promotion_products
  for select to authenticated
  using (exists (select 1 from public.promotions p where p.id = promotion_id));
