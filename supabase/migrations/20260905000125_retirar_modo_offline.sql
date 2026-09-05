-- ============================================================
-- 25. Retirar la infraestructura del antiguo modo sin conexión
-- ============================================================
-- El frontend opera directamente contra las RPC transaccionales. La tabla y
-- el despachador idempotente ya no tienen consumidores y no deben conservar
-- datos operativos.

begin;

drop function if exists public.rpc_ejecutar_operacion_offline(uuid, text, jsonb);
drop table if exists public.operaciones_idempotentes;

commit;
