-- =============================================================================
-- 0004_inventory: stock, compras, mermas, conteos y kardex append-only.
-- Spec: specs/SPEC-inventory.md §3.1 · Tarea I2
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tipos y tablas
-- -----------------------------------------------------------------------------

create type public.inventory_movement_type as enum (
  'compra',
  'venta',
  'merma',
  'ajuste',
  'anulacion'
);

-- Estado actual del stock por insumo (una fila por insumo).
create table public.inventory_stock (
  ingredient_id uuid primary key references public.ingredients (id) on delete cascade,
  quantity bigint not null default 0,
  avg_unit_cost numeric(20,6) not null default 0 check (avg_unit_cost >= 0),
  min_quantity integer not null default 0 check (min_quantity >= 0 and min_quantity <= 100000000),
  updated_at timestamptz not null default now()
);

comment on table public.inventory_stock is 'Existencias, costo promedio y stock mínimo por insumo.';

create trigger inventory_stock_set_updated_at
  before update on public.inventory_stock
  for each row execute function private.set_updated_at();

-- Compras a proveedores.
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  purchased_on date not null check (purchased_on <= current_date),
  supplier text not null default '' check (char_length(supplier) <= 120),
  note text not null default '' check (char_length(note) <= 500),
  total_cents bigint not null check (total_cents >= 0 and total_cents <= 100000000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index purchases_purchased_on_idx on public.purchases (purchased_on desc, created_at desc);

comment on table public.purchases is 'Facturas o comprobantes de compra de insumos.';

-- Líneas de compra.
create table public.purchase_items (
  purchase_id uuid not null references public.purchases (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  quantity integer not null check (quantity > 0 and quantity <= 100000000),
  cost_cents integer not null check (cost_cents >= 0 and cost_cents <= 100000000),
  primary key (purchase_id, ingredient_id)
);

create index purchase_items_ingredient_id_idx on public.purchase_items (ingredient_id);

comment on table public.purchase_items is 'Insumos y costos de cada línea de compra.';

-- Kardex append-only de movimientos de inventario.
create table public.inventory_movements (
  id bigint generated always as identity primary key,
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  type public.inventory_movement_type not null,
  quantity integer not null check (quantity <> 0 and quantity between -100000000 and 100000000),
  cost_cents integer not null check (cost_cents between -100000000 and 100000000),
  balance_quantity bigint not null,
  balance_avg_unit_cost numeric(20,6) not null check (balance_avg_unit_cost >= 0),
  purchase_id uuid references public.purchases (id) on delete restrict,
  order_id uuid, -- FK hacia orders(id) se agregará en el módulo orders
  reason text not null default '' check (char_length(reason) <= 200),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint inventory_movements_compra_check check (
    type <> 'compra' or (purchase_id is not null and quantity > 0 and cost_cents >= 0)
  ),
  constraint inventory_movements_merma_check check (
    type <> 'merma' or (quantity < 0 and cost_cents <= 0 and char_length(reason) >= 3)
  ),
  constraint inventory_movements_ajuste_check check (
    type <> 'ajuste' or (char_length(reason) >= 3)
  ),
  constraint inventory_movements_venta_check check (
    type <> 'venta' or (quantity < 0 and cost_cents <= 0)
  ),
  constraint inventory_movements_anulacion_check check (
    type <> 'anulacion' or (quantity > 0 and cost_cents >= 0)
  )
);

create index inventory_movements_kardex_idx on public.inventory_movements (ingredient_id, id desc);

comment on table public.inventory_movements is 'Kardex append-only: auditable, inmutable y ordenado por ID.';

-- -----------------------------------------------------------------------------
-- 2. Triggers de protección y alta automática
-- -----------------------------------------------------------------------------

-- Alta automática de fila en inventory_stock para insumos nuevos.
create function private.ingredients_create_stock()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.inventory_stock (ingredient_id, quantity, avg_unit_cost, min_quantity)
  values (new.id, 0, 0, 0)
  on conflict (ingredient_id) do nothing;
  return new;
end;
$$;

create trigger ingredients_stock_after_insert
  after insert on public.ingredients
  for each row execute function private.ingredients_create_stock();

-- Relleno de inventory_stock para los insumos ya existentes.
insert into public.inventory_stock (ingredient_id, quantity, avg_unit_cost, min_quantity)
select id, 0, 0, 0 from public.ingredients
on conflict (ingredient_id) do nothing;

-- Inmutabilidad del kardex: solo postgres puede modificar o borrar (para tests y mantenimiento).
create function private.inventory_movements_prevent_modification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'postgres' and session_user <> 'postgres' then
    raise exception 'KARDEX_APPEND_ONLY' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger inventory_movements_append_only
  before update or delete on public.inventory_movements
  for each row execute function private.inventory_movements_prevent_modification();

revoke truncate on public.inventory_movements from public, anon, authenticated, service_role;
revoke update, delete on public.inventory_movements from public, anon, authenticated, service_role;

-- Extensión de la regla INGREDIENT_UNIT_LOCKED: si el insumo tiene movimientos, no cambia de unidad.
create or replace function private.ingredients_check_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_products text[];
begin
  if new.unit is distinct from old.unit
     and (
       exists (select 1 from public.recipe_items where ingredient_id = new.id)
       or exists (select 1 from public.inventory_movements where ingredient_id = new.id)
     ) then
    raise exception 'INGREDIENT_UNIT_LOCKED' using errcode = 'P0001';
  end if;

  if old.is_active and not new.is_active then
    perform 1 from public.products p
    join public.recipe_items r on r.product_id = p.id
    where r.ingredient_id = new.id
    for share of p;
    select array_agg(p.name order by p.name) into v_products
    from public.products p
    join public.recipe_items r on r.product_id = p.id
    where r.ingredient_id = new.id and p.is_active;
    if v_products is not null then
      raise exception 'INGREDIENT_IN_USE'
        using errcode = 'P0001',
              detail = jsonb_build_object('products', to_jsonb(v_products))::text;
    end if;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Funciones internas: bloqueo ordenado y aplicación de movimientos
-- -----------------------------------------------------------------------------

-- Bloquea filas de stock en orden determinista de ingredient_id para evitar deadlocks (IN-07).
create function private.lock_inventory(p_ingredient_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_sorted_ids uuid[];
begin
  select array_agg(id order by id) into v_sorted_ids
  from unnest(p_ingredient_ids) as id;

  perform 1
  from public.inventory_stock
  where ingredient_id = any(v_sorted_ids)
  order by ingredient_id
  for update;
end;
$$;

-- Única función que escribe en inventory_movements e inventory_stock.
create function private.apply_inventory_movement(
  p_ingredient_id uuid,
  p_type public.inventory_movement_type,
  p_quantity integer,
  p_reason text default '',
  p_user_id uuid default null,
  p_purchase_id uuid default null,
  p_order_id uuid default null,
  p_cost_cents numeric default null
)
returns public.inventory_movements
language plpgsql
set search_path = ''
as $$
declare
  v_stock public.inventory_stock%rowtype;
  v_movement public.inventory_movements%rowtype;
  v_new_qty bigint;
  v_new_avg numeric(20,6);
  v_movement_cost integer;
begin
  select * into v_stock
  from public.inventory_stock
  where ingredient_id = p_ingredient_id
  for update;

  if not found then
    raise exception 'INGREDIENT_NOT_FOUND' using errcode = 'P0001';
  end if;

  if p_quantity = 0 then
    raise exception 'ADJUSTMENT_NO_CHANGE' using errcode = 'P0001';
  end if;

  v_new_qty := v_stock.quantity + p_quantity;

  if p_type = 'compra' then
    if p_cost_cents is null then
      raise exception 'COMPRA_REQUIRES_COST' using errcode = 'P0001';
    end if;
    v_movement_cost := round(p_cost_cents)::integer;
    if v_stock.quantity > 0 then
      v_new_avg := round(
        (v_stock.quantity::numeric * v_stock.avg_unit_cost + v_movement_cost::numeric) / v_new_qty::numeric,
        6
      );
    else
      -- Con stock previo <= 0, el nuevo promedio es el costo unitario de esta compra
      v_new_avg := round(v_movement_cost::numeric / p_quantity::numeric, 6);
    end if;
  else
    -- Salidas (merma, venta, ajuste negativo) y entradas por ajuste positivo o anulación:
    -- se valorizan al costo promedio vigente y no lo alteran.
    v_movement_cost := round(p_quantity::numeric * v_stock.avg_unit_cost)::integer;
    v_new_avg := v_stock.avg_unit_cost;
  end if;

  update public.inventory_stock
  set quantity = v_new_qty,
      avg_unit_cost = v_new_avg,
      updated_at = now()
  where ingredient_id = p_ingredient_id;

  insert into public.inventory_movements (
    ingredient_id,
    type,
    quantity,
    cost_cents,
    balance_quantity,
    balance_avg_unit_cost,
    purchase_id,
    order_id,
    reason,
    created_by
  ) values (
    p_ingredient_id,
    p_type,
    p_quantity,
    v_movement_cost,
    v_new_qty,
    v_new_avg,
    p_purchase_id,
    p_order_id,
    coalesce(p_reason, ''),
    p_user_id
  ) returning * into v_movement;

  return v_movement;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. RPCs de negocio (llamados por service_role desde NestJS)
-- -----------------------------------------------------------------------------

create function public.register_purchase(
  p_purchased_on date,
  p_supplier text,
  p_note text,
  p_items jsonb,
  p_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase_id uuid;
  v_item record;
  v_total_cents bigint := 0;
  v_ingredient_ids uuid[];
  v_count integer;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'PURCHASE_EMPTY' using errcode = 'P0001';
  end if;

  -- Extraer y validar ingredientes
  select array_agg((item->>'ingredientId')::uuid)
  into v_ingredient_ids
  from jsonb_array_elements(p_items) as item;

  -- Comprobar que todos los insumos existan y estén activos
  select count(*) into v_count
  from public.ingredients
  where id = any(v_ingredient_ids);

  if v_count <> array_length(v_ingredient_ids, 1) then
    raise exception 'INGREDIENT_NOT_FOUND' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.ingredients
    where id = any(v_ingredient_ids) and not is_active
  ) then
    raise exception 'INGREDIENT_INACTIVE' using errcode = 'P0001';
  end if;

  -- Bloqueo determinista en orden de ingredient_id para prevenir interbloqueos
  perform private.lock_inventory(v_ingredient_ids);

  -- Calcular total de compra
  select sum((item->>'costCents')::bigint)
  into v_total_cents
  from jsonb_array_elements(p_items) as item;

  if v_total_cents > 100000000 then
    raise exception 'PURCHASE_TOTAL_TOO_HIGH' using errcode = 'P0001';
  end if;

  insert into public.purchases (
    purchased_on,
    supplier,
    note,
    total_cents,
    created_by
  ) values (
    p_purchased_on,
    coalesce(p_supplier, ''),
    coalesce(p_note, ''),
    v_total_cents,
    p_user_id
  ) returning id into v_purchase_id;

  for v_item in
    select
      (item->>'ingredientId')::uuid as ingredient_id,
      (item->>'quantity')::integer as quantity,
      (item->>'costCents')::integer as cost_cents
    from jsonb_array_elements(p_items) as item
  loop
    insert into public.purchase_items (
      purchase_id,
      ingredient_id,
      quantity,
      cost_cents
    ) values (
      v_purchase_id,
      v_item.ingredient_id,
      v_item.quantity,
      v_item.cost_cents
    );

    perform private.apply_inventory_movement(
      v_item.ingredient_id,
      'compra',
      v_item.quantity,
      '',
      p_user_id,
      v_purchase_id,
      null,
      v_item.cost_cents
    );
  end loop;

  return v_purchase_id;
end;
$$;

create function public.record_waste(
  p_ingredient_id uuid,
  p_quantity integer,
  p_reason text,
  p_user_id uuid default null
)
returns public.inventory_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stock public.inventory_stock%rowtype;
  v_movement public.inventory_movements%rowtype;
begin
  if p_quantity <= 0 then
    raise exception 'QUANTITY_MUST_BE_POSITIVE' using errcode = 'P0001';
  end if;

  select * into v_stock
  from public.inventory_stock
  where ingredient_id = p_ingredient_id
  for update;

  if not found then
    raise exception 'INGREDIENT_NOT_FOUND' using errcode = 'P0001';
  end if;

  if p_quantity > v_stock.quantity then
    raise exception 'STOCK_INSUFFICIENT'
      using errcode = 'P0001',
            detail = jsonb_build_object('available', v_stock.quantity)::text;
  end if;

  v_movement := private.apply_inventory_movement(
    p_ingredient_id,
    'merma',
    -p_quantity,
    trim(p_reason),
    p_user_id,
    null,
    null,
    null
  );

  return v_movement;
end;
$$;

create function public.count_stock(
  p_ingredient_id uuid,
  p_counted integer,
  p_reason text,
  p_user_id uuid default null
)
returns public.inventory_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stock public.inventory_stock%rowtype;
  v_diff integer;
  v_movement public.inventory_movements%rowtype;
begin
  if p_counted < 0 then
    raise exception 'COUNT_MUST_BE_NON_NEGATIVE' using errcode = 'P0001';
  end if;

  select * into v_stock
  from public.inventory_stock
  where ingredient_id = p_ingredient_id
  for update;

  if not found then
    raise exception 'INGREDIENT_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_diff := p_counted - v_stock.quantity::integer;

  if v_diff = 0 then
    raise exception 'ADJUSTMENT_NO_CHANGE' using errcode = 'P0001';
  end if;

  v_movement := private.apply_inventory_movement(
    p_ingredient_id,
    'ajuste',
    v_diff,
    trim(p_reason),
    p_user_id,
    null,
    null,
    null
  );

  return v_movement;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Privilegios y Políticas RLS
-- -----------------------------------------------------------------------------

-- Revocar llamadas directas a RPCs desde roles de cliente
revoke execute on function public.register_purchase from public, anon, authenticated;
grant execute on function public.register_purchase to service_role;

revoke execute on function public.record_waste from public, anon, authenticated;
grant execute on function public.record_waste to service_role;

revoke execute on function public.count_stock from public, anon, authenticated;
grant execute on function public.count_stock to service_role;

revoke all on function private.lock_inventory from public, anon, authenticated;
revoke all on function private.apply_inventory_movement from public, anon, authenticated;

-- RLS en las 4 tablas (solo select para admin)
alter table public.inventory_stock enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.inventory_movements enable row level security;

-- Los usuarios autenticados pueden consultar, pero RLS restringe a solo admin
grant select on public.inventory_stock, public.purchases, public.purchase_items, public.inventory_movements
  to authenticated;

create policy inventory_stock_select
  on public.inventory_stock for select to authenticated
  using ((select private.current_app_role()) = 'admin');

create policy purchases_select
  on public.purchases for select to authenticated
  using ((select private.current_app_role()) = 'admin');

create policy purchase_items_select
  on public.purchase_items for select to authenticated
  using ((select private.current_app_role()) = 'admin');

create policy inventory_movements_select
  on public.inventory_movements for select to authenticated
  using ((select private.current_app_role()) = 'admin');

-- Permitir a service_role acceso para la API NestJS.
-- El kardex es append-only: service_role solo lee e inserta (el trigger además bloquea UPDATE/DELETE).
grant all on public.inventory_stock, public.purchases, public.purchase_items to service_role;
grant select, insert on public.inventory_movements to service_role;
revoke update, delete on public.inventory_movements from service_role;
