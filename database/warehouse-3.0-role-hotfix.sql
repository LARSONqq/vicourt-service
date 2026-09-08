-- Warehouse 3.0 production role-check hotfix.
-- Corrects calls to private.has_role(text[]) without changing RPC
-- signatures, business logic, SECURITY DEFINER settings, or privileges.

begin;
create or replace function public.create_warehouse_item_with_opening_balance(
  p_name text,
  p_category text,
  p_quantity numeric,
  p_unit text,
  p_min_quantity numeric,
  p_target_quantity numeric,
  p_unit_cost numeric,
  p_supplier text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_item public.warehouse_items%rowtype;
  v_actor_id uuid := auth.uid();
  v_actor_name text;
begin
  if v_actor_id is null
    or not private.is_active_user()
    or not private.has_role(array['admin']::text[])
  then
    raise exception 'Недостатньо прав для створення позиції складу.'
      using errcode = '42501';
  end if;

  if nullif(btrim(p_name), '') is null or char_length(btrim(p_name)) > 300 then
    raise exception 'Вкажіть коректну назву матеріалу.';
  end if;

  if nullif(btrim(p_unit), '') is null or char_length(btrim(p_unit)) > 50 then
    raise exception 'Вкажіть коректну одиницю виміру.';
  end if;

  if p_quantity is null or p_quantity = 'NaN'::numeric or p_quantity < 0 or p_quantity >= 'Infinity'::numeric then
    raise exception 'Кількість не може бути від’ємною.';
  end if;

  if p_min_quantity is null or p_min_quantity = 'NaN'::numeric or p_min_quantity < 0 or p_min_quantity >= 'Infinity'::numeric then
    raise exception 'Мінімальний залишок має бути коректним.';
  end if;

  if p_target_quantity is not null and (
    p_target_quantity = 'NaN'::numeric
    or p_target_quantity < p_min_quantity
    or p_target_quantity >= 'Infinity'::numeric
  ) then
    raise exception 'Цільовий запас не може бути меншим за мінімальний залишок.';
  end if;

  if p_unit_cost is null or p_unit_cost = 'NaN'::numeric or p_unit_cost < 0 or p_unit_cost >= 'Infinity'::numeric then
    raise exception 'Облікова ціна має бути коректною.';
  end if;

  insert into public.warehouse_items (
    name,
    category,
    quantity,
    unit,
    min_quantity,
    target_quantity,
    purchase_price,
    supplier
  )
  values (
    btrim(p_name),
    nullif(btrim(p_category), ''),
    p_quantity,
    btrim(p_unit),
    p_min_quantity,
    p_target_quantity,
    p_unit_cost,
    nullif(btrim(p_supplier), '')
  )
  returning * into v_item;

  v_actor_name := private.current_ledger_actor_name();

  insert into public.warehouse_movements (
      item_id,
      material_id,
      object_id,
      movement_type,
      movement_code,
      ledger_version,
      quantity,
      unit_price,
      item_name_snapshot,
      unit_snapshot,
      object_name_snapshot,
      warehouse_quantity_after,
      object_quantity_after,
      source_type,
      source_id,
      note,
      performed_by,
      performed_by_name
    )
    values (
      v_item.id,
      null,
      null,
      'Прихід',
      'opening_balance',
      3,
      p_quantity,
      p_unit_cost,
      v_item.name,
      v_item.unit,
      null,
      p_quantity,
      null,
      'item_creation',
      v_item.id,
      'Початковий залишок нової позиції складу.',
      v_actor_id,
      v_actor_name
  );

  return v_item.id;
end
$function$;

create or replace function public.delete_warehouse_item(
  p_item_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_item public.warehouse_items%rowtype;
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null
    or not private.is_active_user()
    or not private.has_role(array['admin']::text[])
  then
    raise exception 'Недостатньо прав для видалення позиції складу.'
      using errcode = '42501';
  end if;

  select *
  into v_item
  from public.warehouse_items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Позицію складу не знайдено.';
  end if;

  if v_item.quantity <> 0 then
    raise exception 'Спочатку скоригуйте залишок позиції до нуля.';
  end if;

  if exists (
    select 1
    from public.materials m
    where m.warehouse_item_id = v_item.id
  ) then
    raise exception 'Позиція використовується в матеріалах об’єктів.';
  end if;

  if exists (
    select 1
    from public.warehouse_purchases wp
    where wp.item_id = v_item.id
  ) then
    raise exception 'Позиція має історію закупівель і не може бути видалена.';
  end if;

  delete from public.warehouse_items
  where id = v_item.id;
end
$function$;

create or replace function public.adjust_warehouse_stock(
  p_item_id bigint,
  p_direction text,
  p_quantity numeric,
  p_unit_cost numeric,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_item public.warehouse_items%rowtype;
  v_previous_quantity numeric;
  v_new_quantity numeric;
  v_snapshot_cost numeric;
  v_new_average numeric;
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_code text;
  v_legacy_type text;
begin
  if v_actor_id is null
    or not private.is_active_user()
    or not private.has_role(array['admin']::text[])
  then
    raise exception 'Недостатньо прав для корекції залишку.'
      using errcode = '42501';
  end if;

  if p_direction not in ('in', 'out') then
    raise exception 'Некоректний напрям корекції.';
  end if;

  if p_quantity is null or p_quantity = 'NaN'::numeric or p_quantity <= 0 or p_quantity >= 'Infinity'::numeric then
    raise exception 'Кількість повинна бути більшою за нуль.';
  end if;

  if nullif(btrim(p_reason), '') is null or char_length(p_reason) > 2000 then
    raise exception 'Вкажіть причину корекції залишку (до 2000 символів).';
  end if;

  select *
  into v_item
  from public.warehouse_items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Позицію складу не знайдено.';
  end if;

  v_previous_quantity := v_item.quantity;

  if p_direction = 'in' then
    if p_unit_cost is null or p_unit_cost = 'NaN'::numeric or p_unit_cost < 0 or p_unit_cost >= 'Infinity'::numeric then
      raise exception 'Для збільшення залишку вкажіть коректну облікову ціну.';
    end if;

    v_new_quantity := v_item.quantity + p_quantity;
    v_snapshot_cost := p_unit_cost;
    v_new_average := (
      v_item.quantity * v_item.purchase_price
      + p_quantity * p_unit_cost
    ) / v_new_quantity;
    v_code := 'adjustment_in';
    v_legacy_type := 'Прихід';
  else
    if p_quantity > v_item.quantity then
      raise exception 'Недостатньо матеріалу на складі.';
    end if;

    v_new_quantity := v_item.quantity - p_quantity;
    v_snapshot_cost := v_item.purchase_price;
    v_new_average := v_item.purchase_price;
    v_code := 'adjustment_out';
    v_legacy_type := 'Списання';
  end if;

  update public.warehouse_items
  set
    quantity = v_new_quantity,
    purchase_price = v_new_average
  where id = v_item.id;

  v_actor_name := private.current_ledger_actor_name();

  insert into public.warehouse_movements (
    item_id,
    material_id,
    object_id,
    movement_type,
    movement_code,
    ledger_version,
    quantity,
    unit_price,
    item_name_snapshot,
    unit_snapshot,
    object_name_snapshot,
    warehouse_quantity_after,
    object_quantity_after,
    source_type,
    source_id,
    note,
    performed_by,
    performed_by_name
  )
  values (
    v_item.id,
    null,
    null,
    v_legacy_type,
    v_code,
    3,
    p_quantity,
    v_snapshot_cost,
    v_item.name,
    v_item.unit,
    null,
    v_new_quantity,
    null,
    'manual_adjustment',
    null,
    btrim(p_reason),
    v_actor_id,
    v_actor_name
  );

  return jsonb_build_object(
    'previous_quantity', v_previous_quantity,
    'new_quantity', v_new_quantity,
    'unit_cost', v_snapshot_cost
  );
end
$function$;

create or replace function public.allocate_warehouse_material(
  p_object_id bigint,
  p_warehouse_item_id bigint,
  p_quantity numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_item public.warehouse_items%rowtype;
  v_material public.materials%rowtype;
  v_object_name text;
  v_new_object_quantity numeric;
  v_new_object_cost numeric;
  v_actor_id uuid := auth.uid();
  v_actor_name text;
begin
  if v_actor_id is null
    or not private.is_active_user()
    or not private.has_role(
      array['admin', 'object_manager']::text[]
    )
  then
    raise exception 'Недостатньо прав для видачі матеріалу на об’єкт.'
      using errcode = '42501';
  end if;

  if p_quantity is null or p_quantity = 'NaN'::numeric or p_quantity <= 0 or p_quantity >= 'Infinity'::numeric then
    raise exception 'Кількість повинна бути більшою за нуль.';
  end if;

  select name
  into v_object_name
  from public.objects
  where id = p_object_id;

  if not found then
    raise exception 'Об’єкт не знайдено.';
  end if;

  select *
  into v_item
  from public.warehouse_items
  where id = p_warehouse_item_id
  for update;

  if not found then
    raise exception 'Матеріал на складі не знайдено.';
  end if;

  if p_quantity > v_item.quantity then
    raise exception 'Недостатньо матеріалу на складі.';
  end if;

  select *
  into v_material
  from public.materials
  where object_id = p_object_id
    and warehouse_item_id = p_warehouse_item_id
  order by id
  limit 1
  for update;

  if found then
    v_new_object_quantity := v_material.quantity + p_quantity;
    v_new_object_cost := (
      v_material.quantity * v_material.price
      + p_quantity * v_item.purchase_price
    ) / v_new_object_quantity;

    update public.materials
    set
      quantity = v_new_object_quantity,
      price = v_new_object_cost,
      name = v_item.name,
      unit = v_item.unit
    where id = v_material.id
    returning * into v_material;
  else
    insert into public.materials (
      object_id,
      warehouse_item_id,
      name,
      quantity,
      unit,
      price
    )
    values (
      p_object_id,
      p_warehouse_item_id,
      v_item.name,
      p_quantity,
      v_item.unit,
      v_item.purchase_price
    )
    returning * into v_material;

    v_new_object_quantity := p_quantity;
  end if;

  update public.warehouse_items
  set quantity = v_item.quantity - p_quantity
  where id = v_item.id;

  v_actor_name := private.current_ledger_actor_name();

  insert into public.warehouse_movements (
    item_id,
    material_id,
    object_id,
    movement_type,
    movement_code,
    ledger_version,
    quantity,
    unit_price,
    item_name_snapshot,
    unit_snapshot,
    object_name_snapshot,
    warehouse_quantity_after,
    object_quantity_after,
    source_type,
    source_id,
    note,
    performed_by,
    performed_by_name
  )
  values (
    v_item.id,
    v_material.id,
    p_object_id,
    'Списання',
    'issue_to_object',
    3,
    p_quantity,
    v_item.purchase_price,
    v_item.name,
    v_item.unit,
    v_object_name,
    v_item.quantity - p_quantity,
    v_new_object_quantity,
    'object_material',
    v_material.id,
    'Видано зі складу на об’єкт.',
    v_actor_id,
    v_actor_name
  );
end
$function$;

create or replace function public.return_object_material_to_warehouse(
  p_material_id bigint,
  p_object_id bigint,
  p_quantity numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_item_id bigint;
  v_item public.warehouse_items%rowtype;
  v_material public.materials%rowtype;
  v_object_name text;
  v_new_object_quantity numeric;
  v_new_warehouse_quantity numeric;
  v_new_warehouse_cost numeric;
  v_material_reference bigint;
  v_actor_id uuid := auth.uid();
  v_actor_name text;
begin
  if v_actor_id is null
    or not private.is_active_user()
    or not private.has_role(
      array['admin', 'object_manager']::text[]
    )
  then
    raise exception 'Недостатньо прав для повернення матеріалу.'
      using errcode = '42501';
  end if;

  if p_quantity is null or p_quantity = 'NaN'::numeric or p_quantity <= 0 or p_quantity >= 'Infinity'::numeric then
    raise exception 'Кількість повинна бути більшою за нуль.';
  end if;

  select warehouse_item_id
  into v_item_id
  from public.materials
  where id = p_material_id
    and object_id = p_object_id;

  if not found or v_item_id is null then
    raise exception 'Матеріал не знайдено або він не походить зі складу.';
  end if;

  select *
  into v_item
  from public.warehouse_items
  where id = v_item_id
  for update;

  if not found then
    raise exception 'Позицію складу не знайдено.';
  end if;

  select *
  into v_material
  from public.materials
  where id = p_material_id
    and object_id = p_object_id
    and warehouse_item_id = v_item.id
  for update;

  if not found then
    raise exception 'Матеріал не знайдено.';
  end if;

  if p_quantity > v_material.quantity then
    raise exception 'Не можна повернути більше, ніж є на об’єкті.';
  end if;

  select name
  into v_object_name
  from public.objects
  where id = p_object_id;

  if not found then
    raise exception 'Об’єкт не знайдено.';
  end if;

  v_new_object_quantity := v_material.quantity - p_quantity;
  v_new_warehouse_quantity := v_item.quantity + p_quantity;
  v_new_warehouse_cost := (
    v_item.quantity * v_item.purchase_price
    + p_quantity * v_material.price
  ) / v_new_warehouse_quantity;

  update public.warehouse_items
  set
    quantity = v_new_warehouse_quantity,
    purchase_price = v_new_warehouse_cost
  where id = v_item.id;

  if v_new_object_quantity = 0 then
    delete from public.materials
    where id = v_material.id;
    v_material_reference := null;
  else
    update public.materials
    set quantity = v_new_object_quantity
    where id = v_material.id;
    v_material_reference := v_material.id;
  end if;

  v_actor_name := private.current_ledger_actor_name();

  insert into public.warehouse_movements (
    item_id,
    material_id,
    object_id,
    movement_type,
    movement_code,
    ledger_version,
    quantity,
    unit_price,
    item_name_snapshot,
    unit_snapshot,
    object_name_snapshot,
    warehouse_quantity_after,
    object_quantity_after,
    source_type,
    source_id,
    note,
    performed_by,
    performed_by_name
  )
  values (
    v_item.id,
    v_material_reference,
    p_object_id,
    'Прихід',
    'return_from_object',
    3,
    p_quantity,
    v_material.price,
    v_item.name,
    v_item.unit,
    v_object_name,
    v_new_warehouse_quantity,
    v_new_object_quantity,
    'object_material',
    v_material.id,
    'Повернено з об’єкта на склад.',
    v_actor_id,
    v_actor_name
  );
end
$function$;

create or replace function public.change_allocated_material_quantity(
  p_material_id bigint,
  p_object_id bigint,
  p_quantity numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_item_id bigint;
  v_current_quantity numeric;
  v_locked_material public.materials%rowtype;
begin
  if auth.uid() is null
    or not private.is_active_user()
    or not private.has_role(
      array['admin', 'object_manager']::text[]
    )
  then
    raise exception 'Недостатньо прав для зміни матеріалу.'
      using errcode = '42501';
  end if;

  if p_quantity is null or p_quantity = 'NaN'::numeric or p_quantity <= 0 or p_quantity >= 'Infinity'::numeric then
    raise exception 'Кількість повинна бути більшою за нуль.';
  end if;

  select warehouse_item_id
  into v_item_id
  from public.materials
  where id = p_material_id
    and object_id = p_object_id;

  if not found or v_item_id is null then
    raise exception 'Матеріал не знайдено або він не походить зі складу.';
  end if;

  perform 1
  from public.warehouse_items
  where id = v_item_id
  for update;

  if not found then
    raise exception 'Позицію складу не знайдено.';
  end if;

  select *
  into v_locked_material
  from public.materials
  where id = p_material_id
    and object_id = p_object_id
    and warehouse_item_id = v_item_id
  for update;

  if not found then
    raise exception 'Матеріал не знайдено.';
  end if;

  v_current_quantity := v_locked_material.quantity;

  if p_quantity > v_current_quantity then
    perform public.allocate_warehouse_material(
      p_object_id,
      v_item_id,
      p_quantity - v_current_quantity
    );
  elsif p_quantity < v_current_quantity then
    perform public.return_object_material_to_warehouse(
      p_material_id,
      p_object_id,
      v_current_quantity - p_quantity
    );
  end if;
end
$function$;

create or replace function public.create_direct_object_material(
  p_object_id bigint,
  p_name text,
  p_quantity numeric,
  p_unit text,
  p_unit_cost numeric
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_material public.materials%rowtype;
  v_object_name text;
  v_actor_id uuid := auth.uid();
  v_actor_name text;
begin
  if v_actor_id is null
    or not private.is_active_user()
    or not private.has_role(
      array['admin', 'object_manager']::text[]
    )
  then
    raise exception 'Недостатньо прав для додавання матеріалу.'
      using errcode = '42501';
  end if;

  if nullif(btrim(p_name), '') is null or char_length(btrim(p_name)) > 300 then
    raise exception 'Вкажіть коректну назву матеріалу.';
  end if;

  if nullif(btrim(p_unit), '') is null or char_length(btrim(p_unit)) > 50 then
    raise exception 'Вкажіть коректну одиницю виміру.';
  end if;

  if p_quantity is null or p_quantity = 'NaN'::numeric or p_quantity <= 0 or p_quantity >= 'Infinity'::numeric then
    raise exception 'Кількість повинна бути більшою за нуль.';
  end if;

  if p_unit_cost is null or p_unit_cost = 'NaN'::numeric or p_unit_cost < 0 or p_unit_cost >= 'Infinity'::numeric then
    raise exception 'Ціна має бути коректною.';
  end if;

  select name
  into v_object_name
  from public.objects
  where id = p_object_id;

  if not found then
    raise exception 'Об’єкт не знайдено.';
  end if;

  insert into public.materials (
    object_id,
    warehouse_item_id,
    name,
    quantity,
    unit,
    price
  )
  values (
    p_object_id,
    null,
    btrim(p_name),
    p_quantity,
    btrim(p_unit),
    p_unit_cost
  )
  returning * into v_material;

  v_actor_name := private.current_ledger_actor_name();

  insert into public.warehouse_movements (
    item_id,
    material_id,
    object_id,
    movement_type,
    movement_code,
    ledger_version,
    quantity,
    unit_price,
    item_name_snapshot,
    unit_snapshot,
    object_name_snapshot,
    warehouse_quantity_after,
    object_quantity_after,
    source_type,
    source_id,
    note,
    performed_by,
    performed_by_name
  )
  values (
    null,
    v_material.id,
    p_object_id,
    'Списання',
    'direct_to_object',
    3,
    p_quantity,
    p_unit_cost,
    v_material.name,
    v_material.unit,
    v_object_name,
    null,
    p_quantity,
    'object_material',
    v_material.id,
    'Матеріал додано без руху через склад.',
    v_actor_id,
    v_actor_name
  );

  return v_material.id;
end
$function$;

create or replace function public.update_direct_object_material(
  p_material_id bigint,
  p_object_id bigint,
  p_name text,
  p_quantity numeric,
  p_unit text,
  p_unit_cost numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_material public.materials%rowtype;
  v_object_name text;
  v_delta numeric;
  v_movement_cost numeric;
  v_new_cost numeric;
  v_code text;
  v_legacy_type text;
  v_cost_changed boolean;
  v_actor_id uuid := auth.uid();
  v_actor_name text;
begin
  if v_actor_id is null
    or not private.is_active_user()
    or not private.has_role(
      array['admin', 'object_manager']::text[]
    )
  then
    raise exception 'Недостатньо прав для зміни матеріалу.'
      using errcode = '42501';
  end if;

  if nullif(btrim(p_name), '') is null or char_length(btrim(p_name)) > 300 then
    raise exception 'Вкажіть коректну назву матеріалу.';
  end if;

  if nullif(btrim(p_unit), '') is null or char_length(btrim(p_unit)) > 50 then
    raise exception 'Вкажіть коректну одиницю виміру.';
  end if;

  if p_quantity is null or p_quantity = 'NaN'::numeric or p_quantity <= 0 or p_quantity >= 'Infinity'::numeric then
    raise exception 'Кількість повинна бути більшою за нуль.';
  end if;

  if p_unit_cost is null or p_unit_cost = 'NaN'::numeric or p_unit_cost < 0 or p_unit_cost >= 'Infinity'::numeric then
    raise exception 'Ціна має бути коректною.';
  end if;

  select *
  into v_material
  from public.materials
  where id = p_material_id
    and object_id = p_object_id
    and warehouse_item_id is null
  for update;

  if not found then
    raise exception 'Матеріал не знайдено.';
  end if;

  select name
  into v_object_name
  from public.objects
  where id = p_object_id;

  if not found then
    raise exception 'Об’єкт не знайдено.';
  end if;

  v_delta := p_quantity - v_material.quantity;
  v_cost_changed := p_unit_cost <> v_material.price;

  if v_cost_changed then
    update public.materials
    set
      name = btrim(p_name),
      quantity = p_quantity,
      unit = btrim(p_unit),
      price = p_unit_cost
    where id = v_material.id;

    v_actor_name := private.current_ledger_actor_name();

    insert into public.warehouse_movements (
      item_id,
      material_id,
      object_id,
      movement_type,
      movement_code,
      ledger_version,
      quantity,
      unit_price,
      item_name_snapshot,
      unit_snapshot,
      object_name_snapshot,
      warehouse_quantity_after,
      object_quantity_after,
      source_type,
      source_id,
      note,
      performed_by,
      performed_by_name
    )
    values (
      null,
      v_material.id,
      p_object_id,
      'Прихід',
      'direct_object_reversal',
      3,
      v_material.quantity,
      v_material.price,
      v_material.name,
      v_material.unit,
      v_object_name,
      null,
      null,
      'object_material',
      v_material.id,
      'Скориговано історичну вартість прямого матеріалу.',
      v_actor_id,
      v_actor_name
    );

    insert into public.warehouse_movements (
      item_id,
      material_id,
      object_id,
      movement_type,
      movement_code,
      ledger_version,
      quantity,
      unit_price,
      item_name_snapshot,
      unit_snapshot,
      object_name_snapshot,
      warehouse_quantity_after,
      object_quantity_after,
      source_type,
      source_id,
      note,
      performed_by,
      performed_by_name
    )
    values (
      null,
      v_material.id,
      p_object_id,
      'Списання',
      'direct_to_object',
      3,
      p_quantity,
      p_unit_cost,
      btrim(p_name),
      btrim(p_unit),
      v_object_name,
      null,
      p_quantity,
      'object_material',
      v_material.id,
      'Зафіксовано нову вартісну основу прямого матеріалу.',
      v_actor_id,
      v_actor_name
    );

    return;
  end if;

  v_new_cost := v_material.price;

  if v_delta > 0 then
    v_movement_cost := p_unit_cost;
    v_new_cost := (
      v_material.quantity * v_material.price
      + v_delta * p_unit_cost
    ) / p_quantity;
    v_code := 'direct_to_object';
    v_legacy_type := 'Списання';
  elsif v_delta < 0 then
    v_movement_cost := v_material.price;
    v_code := 'direct_object_reversal';
    v_legacy_type := 'Прихід';
  end if;

  update public.materials
  set
    name = btrim(p_name),
    quantity = p_quantity,
    unit = btrim(p_unit),
    price = v_new_cost
  where id = v_material.id;

  if v_delta <> 0 then
    v_actor_name := private.current_ledger_actor_name();

    insert into public.warehouse_movements (
      item_id,
      material_id,
      object_id,
      movement_type,
      movement_code,
      ledger_version,
      quantity,
      unit_price,
      item_name_snapshot,
      unit_snapshot,
      object_name_snapshot,
      warehouse_quantity_after,
      object_quantity_after,
      source_type,
      source_id,
      note,
      performed_by,
      performed_by_name
    )
    values (
      null,
      v_material.id,
      p_object_id,
      v_legacy_type,
      v_code,
      3,
      abs(v_delta),
      v_movement_cost,
      btrim(p_name),
      btrim(p_unit),
      v_object_name,
      null,
      p_quantity,
      'object_material',
      v_material.id,
      case
        when v_delta > 0 then 'Збільшено прямий матеріал об’єкта.'
        else 'Зменшено прямий матеріал об’єкта.'
      end,
      v_actor_id,
      v_actor_name
    );
  end if;
end
$function$;

create or replace function public.delete_material_with_stock_restore(
  p_material_id bigint,
  p_object_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_material public.materials%rowtype;
  v_object_name text;
  v_actor_id uuid := auth.uid();
  v_actor_name text;
begin
  if v_actor_id is null
    or not private.is_active_user()
    or not private.has_role(
      array['admin', 'object_manager']::text[]
    )
  then
    raise exception 'Недостатньо прав для видалення матеріалу.'
      using errcode = '42501';
  end if;

  select *
  into v_material
  from public.materials
  where id = p_material_id
    and object_id = p_object_id;

  if not found then
    raise exception 'Матеріал не знайдено.';
  end if;

  if v_material.warehouse_item_id is not null then
    perform public.return_object_material_to_warehouse(
      p_material_id,
      p_object_id,
      v_material.quantity
    );
    return;
  end if;

  select *
  into v_material
  from public.materials
  where id = p_material_id
    and object_id = p_object_id
    and warehouse_item_id is null
  for update;

  if not found then
    raise exception 'Матеріал не знайдено.';
  end if;

  select name
  into v_object_name
  from public.objects
  where id = p_object_id;

  delete from public.materials
  where id = v_material.id;

  v_actor_name := private.current_ledger_actor_name();

  insert into public.warehouse_movements (
    item_id,
    material_id,
    object_id,
    movement_type,
    movement_code,
    ledger_version,
    quantity,
    unit_price,
    item_name_snapshot,
    unit_snapshot,
    object_name_snapshot,
    warehouse_quantity_after,
    object_quantity_after,
    source_type,
    source_id,
    note,
    performed_by,
    performed_by_name
  )
  values (
    null,
    null,
    p_object_id,
    'Прихід',
    'direct_object_reversal',
    3,
    v_material.quantity,
    v_material.price,
    v_material.name,
    v_material.unit,
    v_object_name,
    null,
    0,
    'object_material',
    v_material.id,
    'Прямий матеріал видалено з балансу об’єкта.',
    v_actor_id,
    v_actor_name
  );
end
$function$;

create or replace function public.complete_warehouse_purchase(
  p_purchase_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_purchase public.warehouse_purchases%rowtype;
  v_item public.warehouse_items%rowtype;
  v_new_quantity numeric;
  v_new_average numeric;
  v_actor_id uuid := auth.uid();
  v_actor_name text;
begin
  if v_actor_id is null
    or not private.is_active_user()
    or not private.has_role(
      array['admin', 'object_manager']::text[]
    )
  then
    raise exception 'Недостатньо прав для оприбуткування закупівлі.'
      using errcode = '42501';
  end if;

  select *
  into v_purchase
  from public.warehouse_purchases
  where id = p_purchase_id
  for update;

  if not found then
    raise exception 'Закупівлю не знайдено.';
  end if;

  if v_purchase.status <> 'Заплановано' then
    raise exception 'Закупівлю вже оприбутковано.';
  end if;

  if v_purchase.quantity is null
    or v_purchase.quantity <= 0
    or v_purchase.quantity = 'NaN'::numeric
    or v_purchase.quantity >= 'Infinity'::numeric
    or v_purchase.purchase_price is null
    or v_purchase.purchase_price = 'NaN'::numeric
    or v_purchase.purchase_price < 0
    or v_purchase.purchase_price >= 'Infinity'::numeric
  then
    raise exception 'Закупівля містить некоректну кількість або ціну.';
  end if;

  select *
  into v_item
  from public.warehouse_items
  where id = v_purchase.item_id
  for update;

  if not found then
    raise exception 'Позицію складу не знайдено.';
  end if;

  v_new_quantity := v_item.quantity + v_purchase.quantity;
  v_new_average := (
    v_item.quantity * v_item.purchase_price
    + v_purchase.quantity * v_purchase.purchase_price
  ) / v_new_quantity;

  update public.warehouse_purchases
  set
    status = 'Закуплено',
    purchased_at = clock_timestamp()
  where id = v_purchase.id;

  update public.warehouse_items
  set
    quantity = v_new_quantity,
    purchase_price = v_new_average
  where id = v_item.id;

  v_actor_name := private.current_ledger_actor_name();

  insert into public.warehouse_movements (
    item_id,
    material_id,
    object_id,
    movement_type,
    movement_code,
    ledger_version,
    quantity,
    unit_price,
    item_name_snapshot,
    unit_snapshot,
    object_name_snapshot,
    warehouse_quantity_after,
    object_quantity_after,
    source_type,
    source_id,
    note,
    performed_by,
    performed_by_name
  )
  values (
    v_item.id,
    null,
    null,
    'Прихід',
    'purchase_receipt',
    3,
    v_purchase.quantity,
    v_purchase.purchase_price,
    v_item.name,
    v_item.unit,
    null,
    v_new_quantity,
    null,
    'purchase',
    v_purchase.id,
    coalesce(nullif(btrim(v_purchase.note), ''), 'Оприбутковано закупівлю.'),
    v_actor_id,
    v_actor_name
  );
end
$function$;

create or replace function public.create_warehouse_movement(
  p_item_id bigint,
  p_object_id bigint,
  p_movement_type text,
  p_quantity numeric,
  p_note text DEFAULT NULL::text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_current_cost numeric;
  v_reason text := coalesce(
    nullif(btrim(p_note), ''),
    'Legacy-корекція через попередню версію застосунку.'
  );
begin
  if auth.uid() is null
    or not private.is_active_user()
    or not private.has_role(array['admin']::text[])
  then
    raise exception 'Недостатньо прав для складської операції.'
      using errcode = '42501';
  end if;

  if p_movement_type not in ('Прихід', 'Списання') then
    raise exception 'Некоректний тип руху.';
  end if;

  if p_object_id is not null then
    if p_movement_type <> 'Списання' then
      raise exception 'Повернення з об’єкта виконується через матеріали об’єкта.';
    end if;

    perform public.allocate_warehouse_material(
      p_object_id,
      p_item_id,
      p_quantity
    );
    return;
  end if;

  select purchase_price
  into v_current_cost
  from public.warehouse_items
  where id = p_item_id;

  if not found then
    raise exception 'Позицію складу не знайдено.';
  end if;

  if p_movement_type = 'Прихід' then
    perform public.adjust_warehouse_stock(
      p_item_id,
      'in',
      p_quantity,
      v_current_cost,
      v_reason
    );
  else
    perform public.adjust_warehouse_stock(
      p_item_id,
      'out',
      p_quantity,
      null,
      v_reason
    );
  end if;
end
$function$;

-- ALTER the already deployed POST policy in place. If POST has not been
-- deployed in an environment, there is no affected policy to change.
do $migration$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'warehouse_movements'
      and policyname = 'warehouse_movements_management_select'
  ) then
    execute $policy$
      alter policy warehouse_movements_management_select
      on public.warehouse_movements
      to authenticated
      using (
        private.is_active_user()
        and private.has_role(
          array['admin', 'object_manager']::text[]
        )
      )
    $policy$;
  end if;
end
$migration$;

-- CREATE OR REPLACE preserves the existing function privileges. No grants
-- or function signatures are changed by this hotfix.
commit;

