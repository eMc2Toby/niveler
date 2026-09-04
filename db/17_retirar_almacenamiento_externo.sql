-- =====================================================================
-- NIVELER BOLIVIA — 17_retirar_almacenamiento_externo.sql
-- Retira el microservicio y los metadatos de almacenamiento externo.
-- Las imágenes vuelven al bucket `productos` de Supabase Storage.
-- =====================================================================

begin;

-- Nunca se deja una referencia externa inutilizable en el catálogo.
update productos
set imagen_url = null, updated_at = now()
where imagen_url like 'r2:%';

drop function if exists rpc_reservar_imagen_producto(uuid, uuid, text, text, text, text, text, int, int, int, text, boolean);
drop function if exists rpc_autorizar_carga_imagen(uuid);
drop function if exists rpc_activar_imagen_producto(uuid);
drop function if exists rpc_abandonar_imagen_producto(uuid, text);
drop function if exists rpc_solicitar_eliminar_imagen(uuid);
drop function if exists rpc_solicitar_eliminar_imagen_activa(uuid);
drop function if exists rpc_resumen_almacenamiento();
drop function if exists rpc_preparar_limpieza_imagenes();
drop function if exists rpc_obtener_eliminaciones_pendientes(int);
drop function if exists rpc_confirmar_imagen_r2_eliminada(uuid);
drop function if exists rpc_registrar_error_eliminacion(uuid, text);
drop function if exists rpc_listar_claves_imagenes();
drop function if exists fn_consumir_limite_imagen(text);

drop table if exists cola_eliminacion_imagenes;
drop table if exists control_solicitudes_imagenes;
drop table if exists producto_imagenes;
drop table if exists limites_almacenamiento_sucursal;
drop table if exists configuracion_almacenamiento;
drop type if exists estado_imagen_producto;

comment on column productos.imagen_url is
  'Ruta del objeto en el bucket productos de Supabase Storage.';

-- Conserva la creación de producto y el movimiento inicial en una sola
-- transacción, y permite guardar la ruta subida al bucket existente.
drop function if exists rpc_crear_producto_con_stock(text, text, text, uuid, uuid, text, numeric, boolean, numeric, uuid);

create function rpc_crear_producto_con_stock(
  p_sku text,
  p_nombre text,
  p_descripcion text,
  p_categoria_id uuid,
  p_marca_id uuid,
  p_unidad_medida text,
  p_stock_minimo numeric,
  p_activo boolean,
  p_stock_inicial numeric,
  p_ubicacion_destino_id uuid,
  p_imagen_url text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_producto productos;
  v_proveedor_id uuid;
  v_movimiento jsonb := null;
begin
  perform fn_exigir_nivel(60, 'crear productos');
  if nullif(trim(p_sku), '') is null then raise exception 'El código es obligatorio.'; end if;
  if char_length(trim(coalesce(p_nombre, ''))) < 2 then raise exception 'Escribe el nombre del producto.'; end if;
  if coalesce(p_stock_minimo, 0) < 0 then raise exception 'El stock mínimo no puede ser negativo.'; end if;
  if coalesce(p_stock_inicial, 0) < 0 then raise exception 'El stock inicial no puede ser negativo.'; end if;
  if coalesce(p_stock_inicial, 0) > 0 and p_ubicacion_destino_id is null then
    raise exception 'Selecciona la sucursal que recibirá el stock inicial.';
  end if;

  insert into productos(sku, nombre, descripcion, categoria_id, marca_id,
                        unidad_medida, stock_minimo, activo, imagen_url)
  values (trim(p_sku), trim(p_nombre), nullif(trim(p_descripcion), ''),
          p_categoria_id, p_marca_id, trim(p_unidad_medida),
          coalesce(p_stock_minimo, 0), coalesce(p_activo, true),
          nullif(trim(p_imagen_url), ''))
  returning * into v_producto;

  if coalesce(p_stock_inicial, 0) > 0 then
    select id into v_proveedor_id from ubicaciones
    where tipo = 'PROVEEDOR' and activo order by id limit 1;
    if v_proveedor_id is null then raise exception 'Falta la ubicación virtual PROVEEDOR.'; end if;

    v_movimiento := rpc_registrar_movimiento(
      'ENTRADA', v_proveedor_id, p_ubicacion_destino_id,
      jsonb_build_array(jsonb_build_object(
        'producto_id', v_producto.id,
        'cantidad', p_stock_inicial
      )),
      'Stock inicial al registrar ' || v_producto.sku
    );
  end if;

  return to_jsonb(v_producto) || jsonb_build_object('movimiento_stock_inicial', v_movimiento);
end $$;

grant execute on function rpc_crear_producto_con_stock(text, text, text, uuid, uuid, text, numeric, boolean, numeric, uuid, text) to authenticated;
revoke execute on function rpc_crear_producto_con_stock(text, text, text, uuid, uuid, text, numeric, boolean, numeric, uuid, text) from public, anon;

commit;
