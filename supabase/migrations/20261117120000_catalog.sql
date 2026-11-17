-- =============================================================================
-- 0003_catalog: categorías, productos, insumos, recetas y bucket de fotos.
-- Spec: specs/SPEC-catalog.md §3.1 · Tarea C2
--
-- Escribe solo service_role (NestJS). Las reglas de negocio viven aquí, en
-- triggers, para que valgan sin importar quién escriba.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tablas
-- -----------------------------------------------------------------------------

-- Debe coincidir con INGREDIENT_UNITS en @tus-antojos/shared (unidades base, S3).
create type public.ingredient_unit as enum ('g', 'ml', 'unidad');

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80 and name = btrim(name)),
  sort_order integer not null default 0 check (sort_order between 0 and 9999),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index categories_name_key on public.categories (lower(name));

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 80 and name = btrim(name)),
  description text not null default '' check (char_length(description) <= 500),
  price_cents integer not null check (price_cents > 0 and price_cents <= 100000000),
  -- Ruta dentro del bucket product-images; siempre en la carpeta del propio producto.
  image_path text check (image_path like 'products/' || id::text || '/%.webp'),
  -- Nace inactivo: un producto activo necesita receta (D1).
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index products_name_key on public.products (lower(name));
create index products_category_id_idx on public.products (category_id);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80 and name = btrim(name)),
  unit public.ingredient_unit not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index ingredients_name_key on public.ingredients (lower(name));

-- Cuánto consume UNA unidad vendida del producto, en la unidad base del insumo.
create table public.recipe_items (
  product_id uuid not null references public.products (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  quantity integer not null check (quantity > 0 and quantity <= 1000000),
  primary key (product_id, ingredient_id)
);
create index recipe_items_ingredient_id_idx on public.recipe_items (ingredient_id);

comment on table public.categories is 'Categorías del menú. Escribe solo la API (service_role).';
comment on table public.products is 'Productos vendibles. Activo ⇒ tiene receta con insumos activos y categoría activa.';
comment on table public.ingredients is 'Insumos en unidad base entera (g, ml, unidad).';
comment on table public.recipe_items is 'Receta: insumos y cantidades que consume una unidad del producto.';

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function private.set_updated_at();
create trigger products_set_updated_at
  before update on public.products
  for each row execute function private.set_updated_at();
create trigger ingredients_set_updated_at
  before update on public.ingredients
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. Reglas de negocio (spec §3.1). Errores P0001 → 422 BUSINESS_RULE en la API.
--
-- Los triggers de restricción son DEFERRABLE INITIALLY IMMEDIATE: una escritura
-- suelta se valida al terminar la sentencia; los RPC que tocan varias tablas
-- hacen `set constraints all deferred` y validan al final con `immediate`.
--
-- Concurrencia: activar un producto y desactivar uno de sus insumos (o su
-- categoría) a la vez podría saltarse las reglas en READ COMMITTED. Por eso
-- cada lado bloquea con FOR SHARE las filas del otro: espera a que la otra
-- transacción confirme y vuelve a leer su estado.
-- -----------------------------------------------------------------------------

-- Un producto activo debe tener receta, con insumos activos, y categoría activa.
create function private.check_product_rules(p_product_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
begin
  select * into v_product from public.products where id = p_product_id;
  if not found or not v_product.is_active then
    return;
  end if;

  perform 1 from public.categories c
  where c.id = v_product.category_id and c.is_active
  for share;
  if not found then
    raise exception 'CATEGORY_INACTIVE' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.recipe_items where product_id = p_product_id) then
    raise exception 'PRODUCT_WITHOUT_RECIPE' using errcode = 'P0001';
  end if;

  perform 1 from public.ingredients i
  join public.recipe_items r on r.ingredient_id = i.id
  where r.product_id = p_product_id
  for share of i;
  if exists (
    select 1 from public.recipe_items r
    join public.ingredients i on i.id = r.ingredient_id
    where r.product_id = p_product_id and not i.is_active
  ) then
    raise exception 'INGREDIENT_INACTIVE' using errcode = 'P0001';
  end if;
end;
$$;

-- Los triggers corren con el rol de quien escribe (service_role) y PostgreSQL sí
-- verifica EXECUTE en esta llamada anidada (0001_platform lo revoca por defecto).
grant execute on function private.check_product_rules(uuid) to service_role;

create function private.products_check_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform private.check_product_rules(new.id);
  return null;
end;
$$;

create constraint trigger products_rules
  after insert or update on public.products
  deferrable initially immediate
  for each row execute function private.products_check_rules();

create function private.recipe_items_check_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform private.check_product_rules(new.product_id);
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.check_product_rules(old.product_id);
  end if;
  return null;
end;
$$;

create constraint trigger recipe_items_rules
  after insert or update or delete on public.recipe_items
  deferrable initially immediate
  for each row execute function private.recipe_items_check_rules();

-- No se agrega un insumo inactivo a ninguna receta (aunque el producto esté inactivo).
-- Si el insumo no existe, decide la clave foránea (23503).
create function private.recipe_items_require_active_ingredient()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.ingredients where id = new.ingredient_id and not is_active
  ) then
    raise exception 'INGREDIENT_INACTIVE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger recipe_items_active_ingredient
  before insert or update of ingredient_id on public.recipe_items
  for each row execute function private.recipe_items_require_active_ingredient();

-- Insumos: no se desactivan si los usa un producto activo; la unidad queda fija
-- en cuanto el insumo está en una receta (inventory extenderá esto a movimientos).
create function private.ingredients_check_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_products text[];
begin
  if new.unit is distinct from old.unit
     and exists (select 1 from public.recipe_items where ingredient_id = new.id) then
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

create trigger ingredients_rules
  before update on public.ingredients
  for each row execute function private.ingredients_check_rules();

-- Categorías: no se desactivan si tienen productos activos.
create function private.categories_check_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_active_products integer;
begin
  if old.is_active and not new.is_active then
    perform 1 from public.products where category_id = new.id for share;
    select count(*) into v_active_products
    from public.products
    where category_id = new.id and is_active;
    if v_active_products > 0 then
      raise exception 'CATEGORY_IN_USE'
        using errcode = 'P0001',
              detail = jsonb_build_object('activeProducts', v_active_products)::text;
    end if;
  end if;
  return new;
end;
$$;

create trigger categories_rules
  before update on public.categories
  for each row execute function private.categories_check_rules();

-- -----------------------------------------------------------------------------
-- 3. RPC (solo service_role, por los privilegios por defecto de 0001_platform)
--    p_recipe / p_items: [{ "ingredient_id": uuid, "quantity": int }, ...]
-- -----------------------------------------------------------------------------

-- Crea el producto y su receta en UNA transacción. Devuelve el id.
create function public.create_product(
  p_category_id uuid,
  p_name text,
  p_description text,
  p_price_cents integer,
  p_is_active boolean,
  p_recipe jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  set constraints all deferred;

  insert into public.products (category_id, name, description, price_cents, is_active)
  values (p_category_id, p_name, coalesce(p_description, ''), p_price_cents, p_is_active)
  returning id into v_id;

  insert into public.recipe_items (product_id, ingredient_id, quantity)
  select v_id, x.ingredient_id, x.quantity
  from jsonb_to_recordset(coalesce(p_recipe, '[]'::jsonb)) as x(ingredient_id uuid, quantity integer);

  -- Valida aquí las reglas diferidas: el error sale de la función y no del COMMIT.
  set constraints all immediate;
  return v_id;
end;
$$;

-- Reemplaza la receta completa del producto en UNA transacción.
-- Errores (P0001): PRODUCT_NOT_FOUND, más las reglas de §2.
create function public.set_product_recipe(p_product_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  set constraints all deferred;

  perform 1 from public.products where id = p_product_id for update;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0001';
  end if;

  delete from public.recipe_items where product_id = p_product_id;

  insert into public.recipe_items (product_id, ingredient_id, quantity)
  select p_product_id, x.ingredient_id, x.quantity
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as x(ingredient_id uuid, quantity integer);

  set constraints all immediate;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. RLS (spec platform §3.2): los 3 roles leen; cajero y cocina solo lo activo.
-- -----------------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.ingredients enable row level security;
alter table public.recipe_items enable row level security;

grant select on public.categories, public.products, public.ingredients, public.recipe_items
  to authenticated;

create policy categories_select on public.categories
  for select to authenticated
  using (
    (select private.current_app_role()) = 'admin'
    or (is_active and (select private.current_app_role()) is not null)
  );

create policy products_select on public.products
  for select to authenticated
  using (
    (select private.current_app_role()) = 'admin'
    or (is_active and (select private.current_app_role()) is not null)
  );

create policy ingredients_select on public.ingredients
  for select to authenticated
  using (
    (select private.current_app_role()) = 'admin'
    or (is_active and (select private.current_app_role()) is not null)
  );

-- Una línea de receta se ve si se ve su producto (la subconsulta aplica la RLS de products).
create policy recipe_items_select on public.recipe_items
  for select to authenticated
  using (exists (select 1 from public.products p where p.id = product_id));

-- -----------------------------------------------------------------------------
-- 5. Bucket de fotos (D3). Público para leer; sin políticas de escritura en
--    storage.objects: solo se sube con la URL firmada que emite la API.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
