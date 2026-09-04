-- 20 · SKU numérico automático para productos registrados desde la aplicación
--
-- Los códigos históricos (por ejemplo PRD-001) se conservan. Los productos
-- nuevos que no envían SKU reciben 1, 2, 3... mediante una secuencia. La
-- importación Excel puede seguir enviando un SKU para identificar/upsertar
-- productos existentes.

begin;

create sequence if not exists seq_producto_sku start with 1 increment by 1;

do $$
declare
  v_ultimo bigint;
begin
  select max(sku::bigint)
  into v_ultimo
  from productos
  where trim(sku) ~ '^[0-9]+$';

  if v_ultimo is null then
    perform setval('seq_producto_sku', 1, false);
  else
    perform setval('seq_producto_sku', v_ultimo, true);
  end if;
end $$;

create or replace function fn_asignar_sku_producto()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if nullif(trim(new.sku), '') is null then
    new.sku := nextval('seq_producto_sku')::text;
  else
    new.sku := trim(new.sku);
  end if;
  return new;
end $$;

drop trigger if exists trg_asignar_sku_producto on productos;
create trigger trg_asignar_sku_producto
before insert on productos
for each row execute function fn_asignar_sku_producto();

-- Se crea un endpoint nuevo para mantener disponible el endpoint anterior
-- durante el despliegue. Así un frontend todavía abierto no deja de funcionar.
create or replace function rpc_crear_producto_con_stock_auto(
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

  if char_length(trim(coalesce(p_nombre, ''))) < 2 then
    raise exception 'Escribe el nombre del producto.';
  end if;
  if char_length(trim(p_nombre)) > 120 then
    raise exception 'El nombre no puede superar 120 caracteres.';
  end if;
  if char_length(coalesce(p_descripcion, '')) > 500 then
    raise exception 'La descripción no puede superar 500 caracteres.';
  end if;
  if trim(coalesce(p_unidad_medida, '')) not in
     ('UNIDAD','CAJA','PAQUETE','PAR','METRO','KILO','LITRO') then
    raise exception 'La unidad de medida no es válida.';
  end if;
  if coalesce(p_stock_minimo, 0) < 0 then
    raise exception 'El stock mínimo no puede ser negativo.';
  end if;
  if coalesce(p_stock_inicial, 0) < 0 then
    raise exception 'El stock inicial no puede ser negativo.';
  end if;
  if coalesce(p_stock_inicial, 0) > 0 and p_ubicacion_destino_id is null then
    raise exception 'Selecciona la sucursal que recibirá el stock inicial.';
  end if;
  if coalesce(p_stock_inicial, 0) > 0 and not exists (
    select 1 from ubicaciones
    where id = p_ubicacion_destino_id and activo and tipo = 'SUCURSAL'
  ) then
    raise exception 'La sucursal de destino no es válida.';
  end if;

  insert into productos(nombre, descripcion, categoria_id, marca_id,
                        unidad_medida, stock_minimo, activo, imagen_url)
  values (trim(p_nombre), nullif(trim(p_descripcion), ''),
          p_categoria_id, p_marca_id, trim(p_unidad_medida),
          coalesce(p_stock_minimo, 0), coalesce(p_activo, true),
          nullif(trim(p_imagen_url), ''))
  returning * into v_producto;

  if coalesce(p_stock_inicial, 0) > 0 then
    select id into v_proveedor_id
    from ubicaciones
    where tipo = 'PROVEEDOR' and activo
    order by id
    limit 1;

    if v_proveedor_id is null then
      raise exception 'Falta la ubicación virtual PROVEEDOR.';
    end if;

    v_movimiento := rpc_registrar_movimiento(
      'ENTRADA', v_proveedor_id, p_ubicacion_destino_id,
      jsonb_build_array(jsonb_build_object(
        'producto_id', v_producto.id,
        'cantidad', p_stock_inicial
      )),
      'Stock inicial al registrar ' || v_producto.sku
    );
  end if;

  return to_jsonb(v_producto)
    || jsonb_build_object('movimiento_stock_inicial', v_movimiento);
end $$;

grant usage, select on sequence seq_producto_sku to authenticated;
grant execute on function rpc_crear_producto_con_stock_auto(
  text, text, uuid, uuid, text, numeric, boolean, numeric, uuid, text
) to authenticated;

revoke all on sequence seq_producto_sku from public, anon;
revoke execute on function fn_asignar_sku_producto() from public, anon, authenticated;
revoke execute on function rpc_crear_producto_con_stock_auto(
  text, text, uuid, uuid, text, numeric, boolean, numeric, uuid, text
) from public, anon;

commit;
