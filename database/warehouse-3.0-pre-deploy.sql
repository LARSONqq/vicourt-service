begin;

-- One immutable checkpoint separates the current-state opening snapshot from
-- exact Warehouse 3.0 operational facts. POST deploy creates version 3 once.
create table if not exists public.warehouse_ledger_cutovers (
  ledger_version smallint primary key,
  boundary_movement_id bigint not null,
  cutover_at timestamptz not null default clock_timestamp(),
  constraint warehouse_ledger_cutovers_version_check
    check (ledger_version >= 1),
  constraint warehouse_ledger_cutovers_boundary_check
    check (boundary_movement_id >= 0)
);

alter table public.warehouse_ledger_cutovers enable row level security;

revoke all on table public.warehouse_ledger_cutovers
  from public, anon, authenticated;

drop trigger if exists warehouse_movements_immutable_trigger
  on public.warehouse_movements;

alter table public.warehouse_movements
  add column if not exists material_id bigint,
  add column if not exists movement_code text,
  add column if not exists ledger_version smallint,
  add column if not exists item_name_snapshot text,
  add column if not exists unit_snapshot text,
  add column if not exists object_name_snapshot text,
  add column if not exists warehouse_quantity_after numeric(18,3),
  add column if not exists object_quantity_after numeric(18,3),
  add column if not exists source_type text,
  add column if not exists source_id bigint,
  add column if not exists total_cost numeric(20,2)
    generated always as (
      round(quantity::numeric * unit_price::numeric, 2)
    ) stored;

update public.warehouse_movements wm
set
  movement_code = coalesce(
    wm.movement_code,
    case wm.movement_type
      when 'Прихід' then 'legacy_receipt'
      else 'legacy_write_off'
    end
  ),
  ledger_version = coalesce(wm.ledger_version, 1),
  source_type = coalesce(wm.source_type, 'legacy'),
  source_id = case
    when coalesce(wm.source_type, 'legacy') = 'legacy'
      then coalesce(wm.source_id, wm.id)
    else wm.source_id
  end,
  unit_price = coalesce(wm.unit_price, 0);

update public.warehouse_movements wm
set
  item_name_snapshot = coalesce(
    nullif(btrim(wm.item_name_snapshot), ''),
    nullif(btrim(wi.name), '')
  ),
  unit_snapshot = coalesce(
    nullif(btrim(wm.unit_snapshot), ''),
    nullif(btrim(wi.unit), '')
  )
from public.warehouse_items wi
where wi.id = wm.item_id;

update public.warehouse_movements wm
set object_name_snapshot = coalesce(
  nullif(btrim(wm.object_name_snapshot), ''),
  nullif(btrim(o.name), '')
)
from public.objects o
where o.id = wm.object_id;

update public.warehouse_movements
set
  item_name_snapshot = coalesce(
    nullif(btrim(item_name_snapshot), ''),
    case
      when item_id is not null then 'Матеріал #' || item_id::text
      else 'Матеріал'
    end
  ),
  unit_snapshot = coalesce(
    nullif(btrim(unit_snapshot), ''),
    'од.'
  );

alter table public.warehouse_movements
  alter column item_id drop not null,
  alter column movement_code set not null,
  alter column ledger_version set not null,
  alter column item_name_snapshot set not null,
  alter column unit_snapshot set not null,
  alter column source_type set not null,
  alter column unit_price set not null;

alter table public.warehouse_movements
  drop constraint if exists warehouse_movements_ledger_quantity_check,
  add constraint warehouse_movements_ledger_quantity_check
    check (
      quantity >= 0
      and quantity <> 'NaN'::numeric
      and quantity < 'Infinity'::numeric
      and (
        quantity > 0
        or (
          movement_code = 'opening_balance'
          and source_type in ('item_creation', 'ledger_cutover')
        )
        or (
          movement_code = 'object_opening_balance'
          and source_type = 'ledger_cutover'
        )
      )
    ),
  drop constraint if exists warehouse_movements_ledger_unit_price_check,
  add constraint warehouse_movements_ledger_unit_price_check
    check (
      unit_price >= 0
      and unit_price <> 'NaN'::numeric
      and unit_price < 'Infinity'::numeric
    ),
  drop constraint if exists warehouse_movements_movement_code_check,
  add constraint warehouse_movements_movement_code_check
    check (
      movement_code in (
        'legacy_receipt',
        'legacy_write_off',
        'purchase_receipt',
        'issue_to_object',
        'return_from_object',
        'adjustment_in',
        'adjustment_out',
        'opening_balance',
        'object_opening_balance',
        'direct_to_object',
        'direct_object_reversal'
      )
    ),
  drop constraint if exists warehouse_movements_source_type_check,
  add constraint warehouse_movements_source_type_check
    check (
      source_type in (
        'legacy',
        'purchase',
        'object_material',
        'manual_adjustment',
        'item_creation',
        'ledger_cutover'
      )
    ),
  drop constraint if exists warehouse_movements_ledger_version_check,
  add constraint warehouse_movements_ledger_version_check
    check (ledger_version >= 1),
  drop constraint if exists warehouse_movements_snapshot_text_check,
  add constraint warehouse_movements_snapshot_text_check
    check (
      char_length(btrim(item_name_snapshot)) between 1 and 300
      and char_length(btrim(unit_snapshot)) between 1 and 50
      and (
        object_name_snapshot is null
        or char_length(btrim(object_name_snapshot)) between 1 and 300
      )
    ),
  drop constraint if exists warehouse_movements_balance_after_check,
  add constraint warehouse_movements_balance_after_check
    check (
      (
        warehouse_quantity_after is null
        or (
          warehouse_quantity_after >= 0
          and warehouse_quantity_after <> 'NaN'::numeric
          and warehouse_quantity_after < 'Infinity'::numeric
        )
      )
      and (
        object_quantity_after is null
        or (
          object_quantity_after >= 0
          and object_quantity_after <> 'NaN'::numeric
          and object_quantity_after < 'Infinity'::numeric
        )
      )
    ),
  drop constraint if exists warehouse_movements_note_length_check,
  add constraint warehouse_movements_note_length_check
    check (note is null or char_length(note) <= 2000);

alter table public.warehouse_items
  drop constraint if exists warehouse_items_ledger_quantity_check,
  add constraint warehouse_items_ledger_quantity_check
    check (
      quantity >= 0
      and quantity <> 'NaN'::numeric
      and quantity < 'Infinity'::numeric
    ),
  drop constraint if exists warehouse_items_ledger_purchase_price_check,
  add constraint warehouse_items_ledger_purchase_price_check
    check (
      purchase_price >= 0
      and purchase_price <> 'NaN'::numeric
      and purchase_price < 'Infinity'::numeric
    );

alter table public.materials
  drop constraint if exists materials_ledger_quantity_check,
  add constraint materials_ledger_quantity_check
    check (
      quantity > 0
      and quantity <> 'NaN'::numeric
      and quantity < 'Infinity'::numeric
    ),
  drop constraint if exists materials_ledger_price_check,
  add constraint materials_ledger_price_check
    check (
      price >= 0
      and price <> 'NaN'::numeric
      and price < 'Infinity'::numeric
    );

do $migration$
declare
  constraint_record record;
begin
  for constraint_record in
    select distinct c.conname
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any(c.conkey)
    where c.conrelid = 'public.warehouse_movements'::regclass
      and c.contype = 'f'
      and a.attname = 'item_id'
  loop
    execute format(
      'alter table public.warehouse_movements drop constraint %I',
      constraint_record.conname
    );
  end loop;

  for constraint_record in
    select distinct c.conname
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any(c.conkey)
    where c.conrelid = 'public.warehouse_movements'::regclass
      and c.contype = 'f'
      and a.attname = 'object_id'
  loop
    execute format(
      'alter table public.warehouse_movements drop constraint %I',
      constraint_record.conname
    );
  end loop;

  for constraint_record in
    select distinct c.conname
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any(c.conkey)
    where c.conrelid = 'public.warehouse_movements'::regclass
      and c.contype = 'f'
      and a.attname = 'material_id'
  loop
    execute format(
      'alter table public.warehouse_movements drop constraint %I',
      constraint_record.conname
    );
  end loop;
end
$migration$;

alter table public.warehouse_movements
  add constraint warehouse_movements_item_id_fkey
    foreign key (item_id)
    references public.warehouse_items(id)
    on delete set null
    not valid,
  add constraint warehouse_movements_object_id_fkey
    foreign key (object_id)
    references public.objects(id)
    on delete set null
    not valid,
  add constraint warehouse_movements_material_id_fkey
    foreign key (material_id)
    references public.materials(id)
    on delete set null
    not valid;

alter table public.warehouse_movements
  validate constraint warehouse_movements_item_id_fkey,
  validate constraint warehouse_movements_object_id_fkey,
  validate constraint warehouse_movements_material_id_fkey;

create index if not exists warehouse_movements_created_at_id_idx
  on public.warehouse_movements (created_at desc, id desc);

create index if not exists warehouse_movements_item_created_at_id_idx
  on public.warehouse_movements (item_id, created_at desc, id desc)
  where item_id is not null;

create index if not exists warehouse_movements_object_created_at_id_idx
  on public.warehouse_movements (object_id, created_at desc, id desc)
  where object_id is not null;

create index if not exists warehouse_movements_code_created_at_id_idx
  on public.warehouse_movements (movement_code, created_at desc, id desc);

create index if not exists warehouse_movements_source_idx
  on public.warehouse_movements (source_type, source_id)
  where source_id is not null;

create unique index if not exists warehouse_movements_unique_single_source_idx
  on public.warehouse_movements (movement_code, source_type, source_id)
  where source_id is not null
    and (
      (movement_code = 'purchase_receipt' and source_type = 'purchase')
      or (
        movement_code = 'opening_balance'
        and source_type in ('item_creation', 'ledger_cutover')
      )
      or (
        movement_code = 'object_opening_balance'
        and source_type = 'ledger_cutover'
      )
    );

create or replace function private.current_ledger_actor_name()
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    nullif(btrim(p.full_name), ''),
    nullif(btrim(p.email), ''),
    'Користувач'
  )
  from public.profiles p
  where p.id = auth.uid()
$function$;

revoke all on function private.current_ledger_actor_name()
  from public, anon, authenticated;

create or replace function public.prevent_warehouse_movement_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'UPDATE'
    and (
      new.item_id is not distinct from old.item_id
      or (old.item_id is not null and new.item_id is null)
    )
    and (
      new.object_id is not distinct from old.object_id
      or (old.object_id is not null and new.object_id is null)
    )
    and (
      new.material_id is not distinct from old.material_id
      or (old.material_id is not null and new.material_id is null)
    )
    and (
      to_jsonb(new) - 'item_id' - 'object_id' - 'material_id'
      =
      to_jsonb(old) - 'item_id' - 'object_id' - 'material_id'
    )
    and (
      new.item_id is distinct from old.item_id
      or new.object_id is distinct from old.object_id
      or new.material_id is distinct from old.material_id
    )
  then
    return new;
  end if;

  raise exception 'Ledger рухів матеріалів є незмінним. Створіть коригувальний рух.'
    using errcode = '42501';
end
$function$;

drop trigger if exists warehouse_movements_immutable_trigger
  on public.warehouse_movements;

create trigger warehouse_movements_immutable_trigger
before update or delete on public.warehouse_movements
for each row execute function public.prevent_warehouse_movement_mutation();

-- The legacy application already writes movements through RPC, so revoking
-- direct ledger mutation here is rolling-safe and closes the tombstone bypass
-- before the POST-deploy privilege tightening.
revoke insert, update, delete, truncate on table public.warehouse_movements
  from public, anon, authenticated;

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
    or not private.has_role('admin')
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
    or not private.has_role('admin')
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
    or not private.has_role('admin')
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
    or not (
      private.has_role('admin')
      or private.has_role('object_manager')
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
    or not (
      private.has_role('admin')
      or private.has_role('object_manager')
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
    or not (
      private.has_role('admin')
      or private.has_role('object_manager')
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
    or not (
      private.has_role('admin')
      or private.has_role('object_manager')
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
    or not (
      private.has_role('admin')
      or private.has_role('object_manager')
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
    or not (
      private.has_role('admin')
      or private.has_role('object_manager')
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
    or not (
      private.has_role('admin')
      or private.has_role('object_manager')
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
    or not private.has_role('admin')
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

revoke all on function public.prevent_warehouse_movement_mutation()
  from public, anon, authenticated;

revoke all on function public.create_warehouse_item_with_opening_balance(
  text, text, numeric, text, numeric, numeric, numeric, text
) from public, anon, authenticated;
grant execute on function public.create_warehouse_item_with_opening_balance(
  text, text, numeric, text, numeric, numeric, numeric, text
) to authenticated;

revoke all on function public.delete_warehouse_item(bigint)
  from public, anon, authenticated;
grant execute on function public.delete_warehouse_item(bigint)
  to authenticated;

revoke all on function public.adjust_warehouse_stock(
  bigint, text, numeric, numeric, text
) from public, anon, authenticated;
grant execute on function public.adjust_warehouse_stock(
  bigint, text, numeric, numeric, text
) to authenticated;

revoke all on function public.allocate_warehouse_material(
  bigint, bigint, numeric
) from public, anon, authenticated;
grant execute on function public.allocate_warehouse_material(
  bigint, bigint, numeric
) to authenticated;

revoke all on function public.return_object_material_to_warehouse(
  bigint, bigint, numeric
) from public, anon, authenticated;
grant execute on function public.return_object_material_to_warehouse(
  bigint, bigint, numeric
) to authenticated;

revoke all on function public.change_allocated_material_quantity(
  bigint, bigint, numeric
) from public, anon, authenticated;
grant execute on function public.change_allocated_material_quantity(
  bigint, bigint, numeric
) to authenticated;

revoke all on function public.create_direct_object_material(
  bigint, text, numeric, text, numeric
) from public, anon, authenticated;
grant execute on function public.create_direct_object_material(
  bigint, text, numeric, text, numeric
) to authenticated;

revoke all on function public.update_direct_object_material(
  bigint, bigint, text, numeric, text, numeric
) from public, anon, authenticated;
grant execute on function public.update_direct_object_material(
  bigint, bigint, text, numeric, text, numeric
) to authenticated;

revoke all on function public.delete_material_with_stock_restore(
  bigint, bigint
) from public, anon, authenticated;
grant execute on function public.delete_material_with_stock_restore(
  bigint, bigint
) to authenticated;

revoke all on function public.complete_warehouse_purchase(bigint)
  from public, anon, authenticated;
grant execute on function public.complete_warehouse_purchase(bigint)
  to authenticated;

revoke all on function public.create_warehouse_movement(
  bigint, bigint, text, numeric, text
) from public, anon, authenticated;
grant execute on function public.create_warehouse_movement(
  bigint, bigint, text, numeric, text
) to authenticated;

notify pgrst, 'reload schema';

commit;
