-- =====================================================================
-- NIVELER BOLIVIA — 19_corregir_ubicacion_delivery.sql
-- Corrige el upsert de la ubicación creada automáticamente para deliveries.
-- =====================================================================

begin;

create or replace function fn_sincronizar_ubicacion_delivery()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into ubicaciones (codigo, nombre, tipo, delivery_id, activo)
  values ('UBI-DEL-' || left(new.id::text, 8), 'Stock de ' || new.nombre,
          'DELIVERY', new.id, new.activo)
  on conflict (delivery_id) where delivery_id is not null do update
  set nombre = excluded.nombre, activo = excluded.activo;
  return new;
end $$;

revoke execute on function fn_sincronizar_ubicacion_delivery()
from public, anon, authenticated;

commit;
