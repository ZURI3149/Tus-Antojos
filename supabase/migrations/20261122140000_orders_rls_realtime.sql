-- =============================================================================
-- 0007_orders_rls_realtime: endurece la lectura de pedidos y los publica por Realtime.
-- - Las políticas de 0006 usaban `using (true)`: cualquier JWT válido (incluido un
--   usuario sin rol o desactivado) leía todo el historial de ventas. Ahora se exige
--   un rol de la app, igual que catálogo, inventario y promociones.
-- - La cocina y la caja escuchan los cambios de `orders` por Supabase Realtime
--   (postgres_changes respeta estas mismas políticas RLS).
-- =============================================================================

drop policy if exists orders_select on public.orders;
create policy orders_select
  on public.orders for select to authenticated
  using ((select private.current_app_role()) is not null);

drop policy if exists order_items_select on public.order_items;
create policy order_items_select
  on public.order_items for select to authenticated
  using ((select private.current_app_role()) is not null);

drop policy if exists order_events_select on public.order_events;
create policy order_events_select
  on public.order_events for select to authenticated
  using ((select private.current_app_role()) is not null);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
     ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end
$$;
