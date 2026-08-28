-- =====================================================================
-- 10_endurecer.sql · cerrar la API a quien no ha iniciado sesión
-- =====================================================================
-- Tres avisos del Security Advisor de Supabase, y uno de ellos era grave.
--
-- 1. GRAVE — "Public Can Execute SECURITY DEFINER Function".
--    En PostgreSQL, toda función nace con EXECUTE concedido a PUBLIC, o
--    sea también al rol `anon`: cualquiera con la anon key, sin iniciar
--    sesión, podía llamar a rpc_registrar_movimiento contra la API.
--
--    Y la guardia que agregó 09_permisos_rpc.sql no lo frenaba: se saltaba
--    la verificación cuando `auth.uid()` era nulo, pensando en el SQL
--    Editor... pero para una llamada anónima `auth.uid()` también es nulo.
--    La excepción pensada para la consola le abría la puerta a la calle.
--
--    Se arregla en dos frentes: revocando EXECUTE de PUBLIC y anon, y
--    cambiando la guardia para que distinga por `session_user`, que sí
--    diferencia a `postgres` (consola) de `anon` (internet). `current_user`
--    no sirve: dentro de una función SECURITY DEFINER siempre vale lo
--    mismo, el dueño de la función.
--
-- 2. "Function Search Path Mutable" en tres funciones auxiliares. Sin un
--    search_path fijo, alguien que pueda crear objetos en otro esquema
--    podría hacer que la función llame a su tabla en vez de la nuestra.
--
-- 3. "Public Bucket Allows Listing": el bucket de imágenes es público a
--    propósito, para que las fotos se vean sin sesión y queden en caché
--    del celular. Se acepta: son fotos de catálogo, no datos privados.
--
-- Ejecutar después de 09_permisos_rpc.sql.
-- =====================================================================


-- --------------------------------------------------------------------
-- 1. La guardia distingue consola de internet
-- --------------------------------------------------------------------

create or replace function fn_exigir_nivel(p_minimo int, p_accion text)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  -- `session_user` conserva el rol real de la conexión aunque la función
  -- corra como SECURITY DEFINER. postgres y service_role son la consola y
  -- los scripts de administración; anon es la calle.
  if session_user in ('postgres', 'supabase_admin', 'service_role') then
    return;
  end if;

  if coalesce(auth_nivel(), 0) < p_minimo then
    raise exception 'Tu rol no tiene permiso para %.', p_accion
      using errcode = '42501';
  end if;
end $$;


-- --------------------------------------------------------------------
-- 2. Sin sesión no se ejecuta nada
-- --------------------------------------------------------------------

revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;

grant execute on all functions in schema public to authenticated;

-- Y que las funciones futuras nazcan igual de cerradas.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public grant execute on functions to authenticated;


-- --------------------------------------------------------------------
-- 3. search_path fijo en las auxiliares que no lo tenían
-- --------------------------------------------------------------------

alter function fn_generar_codigo(text, text)          set search_path = public;
alter function fn_touch_updated_at()                  set search_path = public;
alter function fn_aplicar_delta(uuid, uuid, numeric)  set search_path = public;


-- Verificación: ninguna función del esquema public debe quedar ejecutable
-- por anon.
--
--   select p.proname
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and has_function_privilege('anon', p.oid, 'execute');
