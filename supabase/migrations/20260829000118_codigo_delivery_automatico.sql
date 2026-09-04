-- =====================================================================
-- NIVELER BOLIVIA — 18_codigo_delivery_automatico.sql
-- El código de cada delivery se asigna con una secuencia concurrente.
-- =====================================================================

begin;

create sequence if not exists deliveries_codigo_seq
  as bigint start with 1 increment by 1 minvalue 1 no cycle;

do $$
declare
  v_maximo bigint;
begin
  select coalesce(max(substring(codigo from '^DEL-([0-9]+)$')::bigint), 0)
  into v_maximo
  from deliveries
  where codigo ~ '^DEL-[0-9]+$';

  if v_maximo > 0 then
    perform setval('deliveries_codigo_seq', v_maximo, true);
  else
    perform setval('deliveries_codigo_seq', 1, false);
  end if;
end $$;

alter sequence deliveries_codigo_seq owned by deliveries.codigo;

-- El default vuelve opcional el campo para PostgREST y el trigger impide que
-- un cliente salte la numeración enviando un código manual.
alter table deliveries alter column codigo set default '';

create or replace function fn_asignar_codigo_delivery()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.codigo := 'DEL-' || lpad(nextval('deliveries_codigo_seq')::text, 3, '0');
  return new;
end $$;

drop trigger if exists trg_asignar_codigo_delivery on deliveries;
create trigger trg_asignar_codigo_delivery
before insert on deliveries
for each row execute function fn_asignar_codigo_delivery();

revoke all on sequence deliveries_codigo_seq from public, anon, authenticated;
revoke execute on function fn_asignar_codigo_delivery() from public, anon, authenticated;

comment on column deliveries.codigo is
  'Código correlativo generado por PostgreSQL con formato DEL-001.';

commit;
