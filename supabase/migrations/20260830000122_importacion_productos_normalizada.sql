-- =====================================================================
-- NIVELER BOLIVIA — 22_importacion_productos_normalizada.sql
-- Normaliza y valida la unidad importada desde Excel.
-- =====================================================================

begin;

-- Repara filas importadas por versiones anteriores del RPC.
update productos
set unidad_medida = upper(trim(unidad_medida)),
    updated_at = now()
where unidad_medida <> upper(trim(unidad_medida))
  and upper(trim(unidad_medida)) in ('UNIDAD', 'CAJA', 'PAQUETE', 'PAR', 'METRO', 'KILO', 'LITRO');

create or replace function rpc_importar_productos(p_productos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_sku text;
  v_nombre text;
  v_categoria_texto text;
  v_marca_texto text;
  v_unidad_medida text;
  v_categoria_id uuid;
  v_marca_id uuid;
  v_producto_id uuid;
  v_stock_minimo numeric;
  v_activo boolean;
  v_creados int := 0;
  v_actualizados int := 0;
begin
  perform fn_exigir_nivel(60, 'importar productos');

  if jsonb_typeof(p_productos) <> 'array' then
    raise exception 'El archivo no contiene una lista valida de productos.';
  end if;
  if jsonb_array_length(p_productos) = 0 then
    raise exception 'El archivo no contiene productos.';
  end if;
  if jsonb_array_length(p_productos) > 5000 then
    raise exception 'Solo se permiten 5.000 productos por importacion.';
  end if;

  for v_item in select value from jsonb_array_elements(p_productos)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Una fila del archivo no es valida.';
    end if;

    v_sku := upper(trim(coalesce(v_item->>'sku', '')));
    v_nombre := trim(coalesce(v_item->>'nombre', ''));
    v_categoria_texto := nullif(trim(coalesce(v_item->>'categoria', '')), '');
    v_marca_texto := nullif(trim(coalesce(v_item->>'marca', '')), '');
    v_unidad_medida := upper(coalesce(nullif(trim(v_item->>'unidad_medida'), ''), 'UNIDAD'));
    v_stock_minimo := coalesce((v_item->>'stock_minimo')::numeric, 0);
    v_activo := coalesce((v_item->>'activo')::boolean, true);
    v_categoria_id := null;
    v_marca_id := null;

    if v_sku = '' or v_nombre = '' then
      raise exception 'Todas las filas necesitan SKU y nombre.';
    end if;
    if v_stock_minimo < 0 then
      raise exception 'El stock minimo de % no puede ser negativo.', v_sku;
    end if;
    if v_unidad_medida not in ('UNIDAD', 'CAJA', 'PAQUETE', 'PAR', 'METRO', 'KILO', 'LITRO') then
      raise exception 'La unidad de medida "%" del producto % no es valida.', v_unidad_medida, v_sku;
    end if;

    if v_categoria_texto is not null then
      select c.id into v_categoria_id
      from categorias c
      where lower(trim(c.nombre)) = lower(v_categoria_texto) and c.activo
      limit 1;
      if v_categoria_id is null then
        raise exception 'La categoria "%" del producto % no existe o esta inactiva.', v_categoria_texto, v_sku;
      end if;
    end if;

    if v_marca_texto is not null then
      select m.id into v_marca_id
      from marcas m
      where lower(trim(m.nombre)) = lower(v_marca_texto) and m.activo
      limit 1;
      if v_marca_id is null then
        raise exception 'La marca "%" del producto % no existe o esta inactiva.', v_marca_texto, v_sku;
      end if;
    end if;

    select p.id into v_producto_id
    from productos p
    where upper(trim(p.sku)) = v_sku
    limit 1
    for update;

    if v_producto_id is null then
      insert into productos (
        sku, nombre, descripcion, categoria_id, marca_id,
        unidad_medida, stock_minimo, activo
      ) values (
        v_sku,
        v_nombre,
        nullif(trim(coalesce(v_item->>'descripcion', '')), ''),
        v_categoria_id,
        v_marca_id,
        v_unidad_medida,
        v_stock_minimo,
        v_activo
      );
      v_creados := v_creados + 1;
    else
      update productos
      set sku = v_sku,
          nombre = v_nombre,
          descripcion = nullif(trim(coalesce(v_item->>'descripcion', '')), ''),
          categoria_id = v_categoria_id,
          marca_id = v_marca_id,
          unidad_medida = v_unidad_medida,
          stock_minimo = v_stock_minimo,
          activo = v_activo,
          updated_at = now()
      where id = v_producto_id;
      v_actualizados := v_actualizados + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'creados', v_creados,
    'actualizados', v_actualizados,
    'total', v_creados + v_actualizados
  );
end $$;

grant execute on function rpc_importar_productos(jsonb) to authenticated;
revoke execute on function rpc_importar_productos(jsonb) from public, anon;

commit;
