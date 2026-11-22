-- =============================================================================
-- 0006_orders: pedidos, líneas, eventos, número del día, enlace al kardex y RPCs atómicos.
-- Spec: specs/SPEC-orders.md §3.1
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tipos enumerados
-- -----------------------------------------------------------------------------

create type public.order_status as enum (
  'pendiente',
  'en_preparacion',
  'listo',
  'entregado',
  'anulado'
);

create type public.payment_method as enum (
  'efectivo',
  'qr'
);

-- -----------------------------------------------------------------------------
-- 2. Tablas del módulo orders
-- -----------------------------------------------------------------------------

-- Contador correlativo de número de pedido por día (D6).
create table public.order_counters (
  business_date date primary key,
  last_number integer not null check (last_number >= 0)
);

comment on table public.order_counters is 'Contador correlativo de número de pedido por día.';

-- Pedidos de venta.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  client_order_id uuid not null unique,
  request_hash text not null,
  business_date date not null,
  order_number integer not null,
  status public.order_status not null default 'pendiente',
  payment_method public.payment_method not null,
  subtotal_cents bigint not null check (subtotal_cents >= 0),
  discount_cents bigint not null check (discount_cents >= 0),
  total_cents bigint not null check (total_cents >= 0),
  cashier_id uuid references public.profiles (id) on delete set null,
  created_offline_at timestamptz,
  cancel_reason text check (cancel_reason is null or (char_length(cancel_reason) >= 3 and char_length(cancel_reason) <= 200)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orders_total_consistency check (total_cents = subtotal_cents - discount_cents),
  constraint orders_daily_number_unique unique (business_date, order_number)
);

create index orders_daily_list_idx on public.orders (business_date desc, order_number desc);
create index orders_kitchen_queue_idx on public.orders (status, created_at)
  where status in ('pendiente', 'en_preparacion', 'listo');
create index orders_cashier_idx on public.orders (cashier_id, business_date desc);

comment on table public.orders is 'Ventas realizadas en caja con número correlativo diario y método de pago.';

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function private.set_updated_at();

-- Líneas de pedido.
create table public.order_items (
  order_id uuid not null references public.orders (id) on delete restrict,
  line_no smallint not null,
  product_id uuid not null references public.products (id) on delete restrict,
  product_name text not null,
  quantity integer not null check (quantity >= 1 and quantity <= 999),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  promotion_id uuid references public.promotions (id) on delete set null,
  promotion_name text,
  unit_discount_cents integer not null default 0 check (unit_discount_cents >= 0 and unit_discount_cents <= unit_price_cents),
  line_total_cents bigint not null check (line_total_cents >= 0),
  note text not null default '' check (char_length(note) <= 140),

  primary key (order_id, line_no),
  constraint order_items_line_total check (line_total_cents = (unit_price_cents - unit_discount_cents)::bigint * quantity)
);

create index order_items_product_id_idx on public.order_items (product_id);

comment on table public.order_items is 'Productos, precios históricos y promociones aplicadas en cada pedido.';

-- Historial append-only de cambios de estado del pedido.
create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  reason text not null default '' check (char_length(reason) <= 200),
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index order_events_order_id_idx on public.order_events (order_id, id asc);

comment on table public.order_events is 'Historial inmutable de estados de cada pedido.';

create or replace function private.order_events_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'postgres' and session_user <> 'postgres' then
    raise exception 'ORDER_EVENTS_IMMUTABLE' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger order_events_no_update_delete
  before update or delete on public.order_events
  for each row execute function private.order_events_immutable();

-- -----------------------------------------------------------------------------
-- 3. Actualización de inventory_movements (D12)
-- -----------------------------------------------------------------------------

alter table public.inventory_movements
  add constraint inventory_movements_order_id_fkey
  foreign key (order_id) references public.orders (id) on delete restrict;

alter table public.inventory_movements
  drop constraint inventory_movements_venta_check;

alter table public.inventory_movements
  add constraint inventory_movements_venta_check check (
    type <> 'venta' or (order_id is not null and quantity < 0 and cost_cents <= 0)
  );

alter table public.inventory_movements
  drop constraint inventory_movements_anulacion_check;

alter table public.inventory_movements
  add constraint inventory_movements_anulacion_check check (
    type <> 'anulacion' or (order_id is not null and quantity > 0 and cost_cents >= 0)
  );

create index inventory_movements_order_id_idx
  on public.inventory_movements (order_id)
  where order_id is not null;

-- -----------------------------------------------------------------------------
-- 4. Funciones internas
-- -----------------------------------------------------------------------------

-- Fecha comercial en hora de Bolivia (America/La_Paz, -04:00).
create or replace function private.business_date(p_at timestamptz default now())
returns date
language sql
immutable
security definer
set search_path = ''
as $$
  select (timezone('America/La_Paz', coalesce(p_at, now())))::date;
$$;

-- Formato canónico de JSON del pedido con sus líneas.
create or replace function private.get_order_json(p_order_id uuid, p_replayed boolean default false)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', o.id,
    'clientOrderId', o.client_order_id,
    'businessDate', o.business_date,
    'orderNumber', o.order_number,
    'status', o.status,
    'paymentMethod', o.payment_method,
    'subtotalCents', o.subtotal_cents,
    'discountCents', o.discount_cents,
    'totalCents', o.total_cents,
    'cashierId', o.cashier_id,
    'createdOfflineAt', o.created_offline_at,
    'cancelReason', o.cancel_reason,
    'createdAt', o.created_at,
    'updatedAt', o.updated_at,
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'lineNo', i.line_no,
            'productId', i.product_id,
            'productName', i.product_name,
            'quantity', i.quantity,
            'unitPriceCents', i.unit_price_cents,
            'promotionId', i.promotion_id,
            'promotionName', i.promotion_name,
            'unitDiscountCents', i.unit_discount_cents,
            'lineTotalCents', i.line_total_cents,
            'note', i.note
          ) order by i.line_no
        )
        from public.order_items i
        where i.order_id = o.id
      ),
      '[]'::jsonb
    ),
    'replayed', p_replayed
  )
  from public.orders o
  where o.id = p_order_id;
$$;

-- -----------------------------------------------------------------------------
-- 5. RPCs de negocio (llamados exclusivamente por service_role)
-- -----------------------------------------------------------------------------

-- Registrar un nuevo pedido de venta completo y atómico (D1, D2, D4, D6).
create or replace function public.create_order(
  p_client_order_id uuid,
  p_items jsonb,
  p_payment_method public.payment_method,
  p_cashier_id uuid default null,
  p_created_offline_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_hash text;
  v_existing record;
  v_priced_at timestamptz;
  v_business_date date;
  v_order_id uuid;
  v_order_number integer;
  v_items_count integer;

  v_item record;
  v_product record;
  v_best_promo record;

  v_subtotal_cents bigint := 0;
  v_discount_cents bigint := 0;
  v_total_cents bigint := 0;

  v_line_no smallint := 0;
  v_unit_discount integer;
  v_line_total bigint;

  v_ingredient record;
  v_ingredient_ids uuid[];
begin
  -- Idempotencia: bloqueo consultivo para evitar concurrencia simultánea con el mismo client_order_id
  perform pg_advisory_xact_lock(hashtext(p_client_order_id::text));

  v_items_count := jsonb_array_length(p_items);
  if v_items_count is null or v_items_count < 1 or v_items_count > 50 then
    raise exception 'INVALID_ITEMS_COUNT' using errcode = 'P0001';
  end if;

  -- Calcular hash determinista del contenido del pedido
  v_request_hash := md5(p_payment_method::text || ':' || coalesce(p_created_offline_at::text, '') || ':' || p_items::text);

  -- Comprobar si ya existe la clave de idempotencia
  select id, request_hash into v_existing
  from public.orders
  where client_order_id = p_client_order_id;

  if found then
    if v_existing.request_hash = v_request_hash then
      -- Idéntico contenido: retornar pedido existente con replayed: true (D2)
      return private.get_order_json(v_existing.id, true);
    else
      -- Mismo ID con diferente contenido: rechazar con conflicto (D2)
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = 'P0001';
    end if;
  end if;

  -- Validar fecha offline (no puede ser futura)
  if p_created_offline_at is not null and p_created_offline_at > (now() + interval '1 minute') then
    raise exception 'FUTURE_DATE_NOT_ALLOWED' using errcode = 'P0001';
  end if;

  v_priced_at := coalesce(p_created_offline_at, now());
  v_business_date := private.business_date(v_priced_at);

  -- 1. Validar productos (existencia y estado activo)
  for v_item in
    select
      coalesce(x->>'productId', x->>'product_id')::uuid as product_id,
      (x->>'quantity')::integer as quantity,
      coalesce(x->>'note', '') as note
    from jsonb_array_elements(p_items) as x
  loop
    if v_item.quantity is null or v_item.quantity < 1 or v_item.quantity > 999 then
      raise exception 'INVALID_QUANTITY' using errcode = 'P0001';
    end if;

    select * into v_product
    from public.products
    where id = v_item.product_id;

    if not found then
      raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0001';
    end if;

    if not v_product.is_active then
      raise exception 'PRODUCT_INACTIVE' using errcode = 'P0001', detail = v_product.name;
    end if;
  end loop;

  -- 2. Consolidar insumos requeridos por las recetas y bloquear stocks ordenadamente
  for v_ingredient in
    select
      r.ingredient_id,
      sum(r.quantity::bigint * (item->>'quantity')::bigint)::bigint as total_qty
    from jsonb_array_elements(p_items) as item
    join public.recipe_items r on r.product_id = coalesce(item->>'productId', item->>'product_id')::uuid
    group by r.ingredient_id
  loop
    if v_ingredient.total_qty > 100000000 then
      raise exception 'ORDER_TOO_LARGE' using errcode = 'P0001';
    end if;
  end loop;

  select array_agg(distinct r.ingredient_id order by r.ingredient_id) into v_ingredient_ids
  from jsonb_array_elements(p_items) as item
  join public.recipe_items r on r.product_id = coalesce(item->>'productId', item->>'product_id')::uuid;

  if v_ingredient_ids is not null and array_length(v_ingredient_ids, 1) > 0 then
    perform private.lock_inventory(v_ingredient_ids);
  end if;

  -- 3. Crear cabecera preliminar del pedido
  v_order_id := gen_random_uuid();

  -- Obtener número de pedido correlativo del día
  insert into public.order_counters (business_date, last_number)
  values (v_business_date, 1)
  on conflict (business_date) do update
    set last_number = public.order_counters.last_number + 1
  returning last_number into v_order_number;

  insert into public.orders (
    id,
    client_order_id,
    request_hash,
    business_date,
    order_number,
    status,
    payment_method,
    subtotal_cents,
    discount_cents,
    total_cents,
    cashier_id,
    created_offline_at,
    created_at,
    updated_at
  ) values (
    v_order_id,
    p_client_order_id,
    v_request_hash,
    v_business_date,
    v_order_number,
    'pendiente',
    p_payment_method,
    0,
    0,
    0,
    p_cashier_id,
    p_created_offline_at,
    now(),
    now()
  );

  -- 4. Insertar líneas del pedido con precio y mejor promoción calculada
  for v_item in
    select
      coalesce(x->>'productId', x->>'product_id')::uuid as product_id,
      (x->>'quantity')::integer as quantity,
      coalesce(x->>'note', '') as note
    from jsonb_array_elements(p_items) as x
  loop
    v_line_no := v_line_no + 1;

    select * into v_product
    from public.products
    where id = v_item.product_id;

    -- Evaluar la mejor promoción vigente en v_priced_at
    select * into v_best_promo
    from private.best_promotion(v_product.id, v_product.price_cents, v_priced_at)
    limit 1;

    if found then
      v_unit_discount := v_best_promo.unit_discount_cents;
    else
      v_best_promo.promotion_id := null;
      v_best_promo.name := null;
      v_unit_discount := 0;
    end if;

    v_line_total := (v_product.price_cents - v_unit_discount)::bigint * v_item.quantity;

    insert into public.order_items (
      order_id,
      line_no,
      product_id,
      product_name,
      quantity,
      unit_price_cents,
      promotion_id,
      promotion_name,
      unit_discount_cents,
      line_total_cents,
      note
    ) values (
      v_order_id,
      v_line_no,
      v_product.id,
      v_product.name,
      v_item.quantity,
      v_product.price_cents,
      v_best_promo.promotion_id,
      v_best_promo.name,
      v_unit_discount,
      v_line_total,
      v_item.note
    );

    v_subtotal_cents := v_subtotal_cents + (v_product.price_cents::bigint * v_item.quantity);
    v_discount_cents := v_discount_cents + (v_unit_discount::bigint * v_item.quantity);
  end loop;

  v_total_cents := v_subtotal_cents - v_discount_cents;

  -- Actualizar totales en la cabecera
  update public.orders
  set subtotal_cents = v_subtotal_cents,
      discount_cents = v_discount_cents,
      total_cents = v_total_cents
  where id = v_order_id;

  -- 5. Registrar evento inicial en order_events
  insert into public.order_events (
    order_id,
    from_status,
    to_status,
    reason,
    user_id
  ) values (
    v_order_id,
    null,
    'pendiente',
    'Pedido creado',
    p_cashier_id
  );

  -- 6. Aplicar salidas en el kardex por cada insumo consumido
  for v_ingredient in
    select
      r.ingredient_id,
      sum(r.quantity::bigint * (item->>'quantity')::bigint)::bigint as total_qty
    from jsonb_array_elements(p_items) as item
    join public.recipe_items r on r.product_id = coalesce(item->>'productId', item->>'product_id')::uuid
    group by r.ingredient_id
  loop
    perform private.apply_inventory_movement(
      v_ingredient.ingredient_id,
      'venta',
      (-v_ingredient.total_qty)::integer,
      'Venta pedido #' || v_order_number,
      p_cashier_id,
      null,
      v_order_id
    );
  end loop;

  return private.get_order_json(v_order_id, false);
end;
$$;

-- Avanzar el estado de un pedido (D7).
create or replace function public.advance_order_status(
  p_order_id uuid,
  p_to_status public.order_status,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Idempotencia si ya está en el estado pedido
  if v_order.status = p_to_status then
    return private.get_order_json(p_order_id, false);
  end if;

  -- Validar transiciones permitidas (pendiente -> en_preparacion -> listo -> entregado)
  if not (
    (v_order.status = 'pendiente' and p_to_status = 'en_preparacion') or
    (v_order.status = 'en_preparacion' and p_to_status = 'listo') or
    (v_order.status = 'listo' and p_to_status = 'entregado')
  ) then
    raise exception 'INVALID_STATUS_TRANSITION' using errcode = 'P0001', detail = v_order.status::text;
  end if;

  update public.orders
  set status = p_to_status,
      updated_at = now()
  where id = p_order_id;

  insert into public.order_events (
    order_id,
    from_status,
    to_status,
    reason,
    user_id
  ) values (
    p_order_id,
    v_order.status,
    p_to_status,
    '',
    p_user_id
  );

  return private.get_order_json(p_order_id, false);
end;
$$;

-- Anular un pedido devolviendo los insumos al kardex (D8).
create or replace function public.cancel_order(
  p_order_id uuid,
  p_reason text,
  p_user_id uuid default null,
  p_only_cashier uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_movement record;
  v_ingredient_ids uuid[];
begin
  if p_reason is null or char_length(trim(p_reason)) < 3 or char_length(p_reason) > 200 then
    raise exception 'INVALID_CANCEL_REASON' using errcode = 'P0001';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Idempotencia si ya está anulado
  if v_order.status = 'anulado' then
    return private.get_order_json(p_order_id, false);
  end if;

  -- Solo se puede anular desde pendiente o en_preparacion
  if v_order.status not in ('pendiente', 'en_preparacion') then
    raise exception 'ORDER_NOT_CANCELLABLE' using errcode = 'P0001', detail = v_order.status::text;
  end if;

  -- Si es cajero, solo sus pedidos de hoy (D8)
  if p_only_cashier is not null then
    if v_order.cashier_id is distinct from p_only_cashier or v_order.business_date <> private.business_date(now()) then
      raise exception 'ORDER_CANCEL_FORBIDDEN' using errcode = 'P0001';
    end if;
  end if;

  -- Bloquear los insumos que se van a devolver
  select array_agg(distinct ingredient_id order by ingredient_id) into v_ingredient_ids
  from public.inventory_movements
  where order_id = p_order_id and type = 'venta';

  if v_ingredient_ids is not null and array_length(v_ingredient_ids, 1) > 0 then
    perform private.lock_inventory(v_ingredient_ids);
  end if;

  -- Revertir cada movimiento venta como anulacion
  for v_movement in
    select ingredient_id, quantity
    from public.inventory_movements
    where order_id = p_order_id and type = 'venta'
  loop
    perform private.apply_inventory_movement(
      v_movement.ingredient_id,
      'anulacion',
      (-v_movement.quantity)::integer,
      'Anulación pedido #' || v_order.order_number || ': ' || trim(p_reason),
      p_user_id,
      null,
      p_order_id
    );
  end loop;

  update public.orders
  set status = 'anulado',
      cancel_reason = trim(p_reason),
      updated_at = now()
  where id = p_order_id;

  insert into public.order_events (
    order_id,
    from_status,
    to_status,
    reason,
    user_id
  ) values (
    p_order_id,
    v_order.status,
    'anulado',
    trim(p_reason),
    p_user_id
  );

  return private.get_order_json(p_order_id, false);
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Privilegios y Políticas RLS
-- -----------------------------------------------------------------------------

-- Revocar llamadas directas a RPCs desde roles de cliente
revoke execute on function public.create_order from public, anon, authenticated;
grant execute on function public.create_order to service_role;

revoke execute on function public.advance_order_status from public, anon, authenticated;
grant execute on function public.advance_order_status to service_role;

revoke execute on function public.cancel_order from public, anon, authenticated;
grant execute on function public.cancel_order to service_role;

revoke all on function private.business_date from public, anon, authenticated;
grant execute on function private.business_date to service_role;

revoke all on function private.get_order_json from public, anon, authenticated;
grant execute on function private.get_order_json to service_role;

-- Activar RLS en las tablas
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.order_counters enable row level security;

-- Lectura para usuarios autenticados (cajero, cocina y admin)
grant select on public.orders, public.order_items, public.order_events, public.order_counters to authenticated;

create policy orders_select
  on public.orders for select to authenticated
  using (true);

create policy order_items_select
  on public.order_items for select to authenticated
  using (true);

create policy order_events_select
  on public.order_events for select to authenticated
  using (true);

create policy order_counters_select
  on public.order_counters for select to authenticated
  using ((select private.current_app_role()) = 'admin');

-- Escritura solo permitida para service_role (a través de los RPCs)
grant all on public.orders, public.order_items, public.order_counters to service_role;
grant select, insert on public.order_events to service_role;
revoke update, delete on public.order_events from service_role;
