-- =====================================================================
-- PixelOffice v3: camadas do mapa (frente, efeitos de tile, imagens de fundo/frente),
-- rotação de objetos, inventário, construção na própria mesa e objetos importados.
-- Rode depois das migrações v1 (20261022) e v2 (20261024).
-- =====================================================================

alter table public.maps add column if not exists fg jsonb not null default '{}';
alter table public.maps add column if not exists fx jsonb not null default '{}';
alter table public.maps add column if not exists bg jsonb;
alter table public.maps add column if not exists fg_img jsonb;

alter table public.map_objects add column if not exists rot integer;
alter table public.map_objects add column if not exists flip boolean not null default false;

create or replace function public.ensure_map(p_map jsonb, p_objects jsonb, p_zones jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.maps where id = 'main') then
    return false;
  end if;
  insert into public.maps (id, width, height, floor, spawn, version, fg, fx, bg, fg_img)
  values ('main', (p_map ->> 'width')::int, (p_map ->> 'height')::int, p_map -> 'floor',
          coalesce(p_map -> 'spawn', '{"x":1,"y":1}'), coalesce((p_map ->> 'version')::int, 1),
          coalesce(p_map -> 'fg', '{}'), coalesce(p_map -> 'fx', '{}'), p_map -> 'bg', p_map -> 'fgImg');
  insert into public.map_objects (id, type, x, y, color, state, data, rot, flip)
  select o ->> 'id', o ->> 'type', (o ->> 'x')::int, (o ->> 'y')::int, o ->> 'color',
         coalesce(o -> 'state', '{}'), coalesce(o -> 'data', '{}'), (o ->> 'rot')::int, coalesce((o ->> 'flip')::boolean, false)
  from jsonb_array_elements(p_objects) o;
  insert into public.zones (id, name, kind, x, y, w, h, meeting)
  select z ->> 'id', coalesce(z ->> 'name', ''), coalesce(z ->> 'kind', 'area'),
         (z ->> 'x')::int, (z ->> 'y')::int, (z ->> 'w')::int, (z ->> 'h')::int, coalesce((z ->> 'meeting')::boolean, false)
  from jsonb_array_elements(p_zones) z;
  return true;
end;
$$;

-- Pinta a camada da frente (fg) ou de efeitos (fx): p_cells = [[x, y, valor|null], ...]
create or replace function public.paint_layer(p_layer text, p_cells jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  c jsonb;
  k text;
begin
  if not public.can_edit() then
    raise exception 'sem permissão';
  end if;
  if p_layer not in ('fg', 'fx') then
    raise exception 'camada inválida';
  end if;
  execute format('select %I from public.maps where id = ''main''', p_layer) into v;
  v := coalesce(v, '{}');
  for c in select * from jsonb_array_elements(p_cells) loop
    k := (c ->> 0) || ',' || (c ->> 1);
    if c -> 2 is null or jsonb_typeof(c -> 2) = 'null' or (c ->> 2) = '' then
      v := v - k;
    else
      v := jsonb_set(v, array[k], c -> 2, true);
    end if;
  end loop;
  execute format('update public.maps set %I = $1, updated_at = now() where id = ''main''', p_layer) using v;
end;
$$;

-- Imagem inteira de fundo ou de frente: p_which = 'bg' | 'fgImg'; p_value = {"url":..., "w":..., "h":...} ou null
create or replace function public.set_map_image(p_which text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_edit() then
    raise exception 'sem permissão';
  end if;
  if p_which = 'bg' then
    update public.maps set bg = p_value, updated_at = now() where id = 'main';
  elsif p_which = 'fgImg' then
    update public.maps set fg_img = p_value, updated_at = now() where id = 'main';
  else
    raise exception 'imagem inválida';
  end if;
end;
$$;

-- Mover/girar/espelhar: editores, ou o dono de um item colocado na própria mesa
create or replace function public.move_object(p_id text, p_x int default null, p_y int default null, p_rot int default null, p_flip boolean default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.map_objects
     set x = coalesce(p_x, x), y = coalesce(p_y, y), rot = coalesce(p_rot, rot), flip = coalesce(p_flip, flip)
   where id = p_id and (public.can_edit() or data ->> 'placed_by' = auth.uid()::text);
  if not found then
    raise exception 'sem permissão';
  end if;
end;
$$;

-- O tile (x, y) está na área da mesa de quem chama?
create or replace function public.in_my_desk_area(p_x int, p_y int)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.zones z
      join public.map_objects d
        on d.map_id = z.map_id and d.x >= z.x and d.y >= z.y and d.x < z.x + z.w and d.y < z.y + z.h
       and d.data -> 'owner' ->> 'uid' = auth.uid()::text
     where z.map_id = 'main' and z.kind = 'desk'
       and p_x >= z.x and p_y >= z.y and p_x < z.x + z.w and p_y < z.y + z.h
  );
$$;

-- Membros constroem na área da própria mesa com itens do inventário
create or replace function public.place_owned_object(p_obj jsonb, p_w int default 1, p_h int default 1)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  x0 int := (p_obj ->> 'x')::int;
  y0 int := (p_obj ->> 'y')::int;
  i int;
  j int;
begin
  if public.is_guest() then
    raise exception 'convidados não constroem';
  end if;
  if not public.can_edit() then
    for i in 0 .. greatest(p_w, 1) - 1 loop
      for j in 0 .. greatest(p_h, 1) - 1 loop
        if not public.in_my_desk_area(x0 + i, y0 + j) then
          raise exception 'fora da área da sua mesa';
        end if;
      end loop;
    end loop;
  end if;
  insert into public.map_objects (id, type, x, y, color, state, data, rot, flip)
  values (p_obj ->> 'id', p_obj ->> 'type', x0, y0, p_obj ->> 'color', coalesce(p_obj -> 'state', '{}'),
          coalesce(p_obj -> 'data', '{}') || jsonb_build_object('placed_by', auth.uid()),
          (p_obj ->> 'rot')::int, coalesce((p_obj ->> 'flip')::boolean, false));
end;
$$;

create or replace function public.pickup_object(p_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
begin
  delete from public.map_objects
   where id = p_id and (public.can_edit() or data ->> 'placed_by' = auth.uid()::text)
  returning type into v_type;
  if v_type is null then
    raise exception 'sem permissão';
  end if;
  return v_type;
end;
$$;

-- Inventário (itens, hotbar, zeny) no perfil
alter table public.profiles add column if not exists inventory jsonb not null default '{}';
grant update (name, avatar, combat, inventory) on public.profiles to authenticated;

-- Objetos importados (imagens enviadas, já na grade de 32 px)
create table if not exists public.custom_objects (
  id text primary key,
  name text not null default 'Objeto',
  url text not null,
  w integer not null default 1 check (w between 1 and 20),
  h integer not null default 1 check (h between 1 and 20),
  px_w integer,
  px_h integer,
  solid boolean not null default true,
  layer text not null default 'object' check (layer in ('object', 'flat', 'wall')),
  action jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.custom_objects enable row level security;
drop policy if exists "objetos importados visiveis" on public.custom_objects;
create policy "objetos importados visiveis" on public.custom_objects for select to authenticated using (true);
drop policy if exists "editores importam" on public.custom_objects;
create policy "editores importam" on public.custom_objects for insert to authenticated with check (public.can_edit());
drop policy if exists "editores removem importados" on public.custom_objects;
create policy "editores removem importados" on public.custom_objects for delete to authenticated using (public.can_edit());

-- Bucket público para imagens do mapa (fundo, frente, objetos importados)
insert into storage.buckets (id, name, public, file_size_limit)
values ('map-assets', 'map-assets', true, 10485760)
on conflict (id) do nothing;
drop policy if exists "enviar imagens do mapa" on storage.objects;
create policy "enviar imagens do mapa" on storage.objects for insert to authenticated
  with check (bucket_id = 'map-assets' and public.can_edit());
drop policy if exists "apagar imagens do mapa" on storage.objects;
create policy "apagar imagens do mapa" on storage.objects for delete to authenticated
  using (bucket_id = 'map-assets' and public.can_edit());
