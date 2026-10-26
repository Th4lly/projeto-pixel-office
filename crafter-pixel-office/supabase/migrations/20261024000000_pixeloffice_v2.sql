-- =====================================================================
-- PixelOffice v2: mesas próprias, arenas (combate d20), anexos de reunião e Notion
-- Rode depois de 20261022000000_pixeloffice.sql (SQL Editor do Supabase).
-- =====================================================================

-- Áreas novas: área de mesa, arena de monstros e arena PvP
alter table public.zones drop constraint if exists zones_kind_check;
alter table public.zones add constraint zones_kind_check check (kind in ('area', 'private', 'spotlight', 'desk', 'arena', 'pvp'));
alter table public.zones add column if not exists meeting boolean not null default false;

-- Versão do mapa (o jogo troca o escritório antigo pelo novo, com os sprites)
alter table public.maps add column if not exists version integer not null default 1;

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
  insert into public.maps (id, width, height, floor, spawn, version)
  values ('main', (p_map ->> 'width')::int, (p_map ->> 'height')::int, p_map -> 'floor',
          coalesce(p_map -> 'spawn', '{"x":1,"y":1}'), coalesce((p_map ->> 'version')::int, 1));
  insert into public.map_objects (id, type, x, y, color, state, data)
  select o ->> 'id', o ->> 'type', (o ->> 'x')::int, (o ->> 'y')::int, o ->> 'color',
         coalesce(o -> 'state', '{}'), coalesce(o -> 'data', '{}')
  from jsonb_array_elements(p_objects) o;
  insert into public.zones (id, name, kind, x, y, w, h, meeting)
  select z ->> 'id', coalesce(z ->> 'name', ''), coalesce(z ->> 'kind', 'area'),
         (z ->> 'x')::int, (z ->> 'y')::int, (z ->> 'w')::int, (z ->> 'h')::int, coalesce((z ->> 'meeting')::boolean, false)
  from jsonb_array_elements(p_zones) z;
  return true;
end;
$$;

-- Troca o mapa antigo pelo v2 uma única vez (qualquer membro pode disparar; só age se a versão for antiga)
create or replace function public.upgrade_map(p_map jsonb, p_objects jsonb, p_zones jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_open boolean;
  v_ver int;
begin
  select open_edit, version into v_open, v_ver from public.maps where id = 'main';
  if v_ver is not null and v_ver >= coalesce((p_map ->> 'version')::int, 2) then
    return false;
  end if;
  delete from public.maps where id = 'main';
  perform public.ensure_map(p_map, p_objects, p_zones);
  update public.maps set open_edit = coalesce(v_open, false) where id = 'main';
  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- Mesas: cada pessoa reivindica uma e decora (o dono, não só editores)
-- ---------------------------------------------------------------------
create or replace function public.claim_desk(p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner jsonb;
  v_name text;
begin
  if public.is_guest() then
    raise exception 'convidados não podem reivindicar mesa';
  end if;
  select data -> 'owner' into v_owner from public.map_objects where id = p_id for update;
  if v_owner is not null and (v_owner ->> 'uid') <> auth.uid()::text then
    raise exception 'esta mesa já tem dono';
  end if;
  select name into v_name from public.profiles where id = auth.uid();
  -- libera a mesa anterior
  update public.map_objects set data = data - 'owner' - 'decor' - 'chair' - 'deskSkin' - 'deskColor'
   where map_id = 'main' and id <> p_id and data -> 'owner' ->> 'uid' = auth.uid()::text;
  update public.map_objects
     set data = jsonb_set(data, '{owner}', jsonb_build_object('uid', auth.uid(), 'name', coalesce(v_name, 'Alguém')))
   where id = p_id;
  return (select data from public.map_objects where id = p_id);
end;
$$;

create or replace function public.release_desk(p_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.map_objects set data = data - 'owner' - 'decor' - 'chair' - 'deskSkin' - 'deskColor'
   where id = p_id and (data -> 'owner' ->> 'uid' = auth.uid()::text or public.is_admin());
end;
$$;

create or replace function public.set_desk_decor(p_id text, p_decor jsonb, p_chair text default null, p_color text default null, p_skin text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if jsonb_typeof(p_decor) <> 'array' or jsonb_array_length(p_decor) > 60 then
    raise exception 'decoração inválida (máximo de 60 itens)';
  end if;
  update public.map_objects
     set data = data || jsonb_build_object('decor', p_decor)
                     || jsonb_build_object('chair', coalesce(p_chair, ''), 'deskColor', coalesce(p_color, ''), 'deskSkin', coalesce(p_skin, ''))
   where id = p_id and (data -> 'owner' ->> 'uid' = auth.uid()::text or public.is_admin());
  if not found then
    raise exception 'só o dono da mesa pode decorá-la';
  end if;
  return (select data from public.map_objects where id = p_id);
end;
$$;

-- ---------------------------------------------------------------------
-- Progresso de combate (nível de base/classe, pontos) no perfil
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists combat jsonb not null default '{}';
grant update (name, avatar, combat) on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- Anexos e planilhas/gráficos das reuniões
-- ---------------------------------------------------------------------
create table if not exists public.meeting_items (
  id uuid primary key default gen_random_uuid(),
  room text not null,                       -- id da área (sala) ou da mesa
  kind text not null check (kind in ('file', 'sheet', 'chart', 'link')),
  title text not null default '',
  url text,                                 -- link (planilha publicada, gráfico, arquivo)
  path text,                                -- caminho no Storage (arquivos enviados)
  size bigint,
  mime text,
  data jsonb not null default '{}',         -- dados do gráfico (CSV/colunas)
  created_by uuid default auth.uid(),
  created_name text,
  created_at timestamptz not null default now()
);
alter table public.meeting_items enable row level security;
drop policy if exists "itens de reuniao visiveis" on public.meeting_items;
create policy "itens de reuniao visiveis" on public.meeting_items for select to authenticated using (true);
drop policy if exists "anexar na reuniao" on public.meeting_items;
create policy "anexar na reuniao" on public.meeting_items for insert to authenticated with check (created_by = auth.uid() and not public.is_guest());
drop policy if exists "remover anexo" on public.meeting_items;
create policy "remover anexo" on public.meeting_items for delete to authenticated using (created_by = auth.uid() or public.is_admin());

do $$ begin
  alter publication supabase_realtime add table public.meeting_items;
exception when others then null; end $$;

-- Bucket privado para os arquivos (até 25 MB cada)
insert into storage.buckets (id, name, public, file_size_limit)
values ('meeting-files', 'meeting-files', false, 26214400)
on conflict (id) do nothing;

drop policy if exists "ler arquivos de reuniao" on storage.objects;
create policy "ler arquivos de reuniao" on storage.objects for select to authenticated using (bucket_id = 'meeting-files');
drop policy if exists "enviar arquivos de reuniao" on storage.objects;
create policy "enviar arquivos de reuniao" on storage.objects for insert to authenticated
  with check (bucket_id = 'meeting-files' and not public.is_guest());
drop policy if exists "apagar arquivos de reuniao" on storage.objects;
create policy "apagar arquivos de reuniao" on storage.objects for delete to authenticated
  using (bucket_id = 'meeting-files' and (owner = auth.uid() or public.is_admin()));

-- ---------------------------------------------------------------------
-- Notion: boards da empresa (admin) e individuais (cada pessoa)
-- O token da integração fica nos segredos da função "notion" (NOTION_TOKEN);
-- quem quiser usar um token próprio salva aqui, visível só para si.
-- ---------------------------------------------------------------------
create table if not exists public.notion_boards (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('company', 'user')),
  owner uuid default auth.uid(),
  title text not null default 'Board',
  database_id text not null,
  status_prop text,                 -- coluna de status (agrupa o board)
  person_prop text,                 -- coluna de pessoa (filtra o board individual)
  created_at timestamptz not null default now()
);
alter table public.notion_boards enable row level security;
drop policy if exists "boards visiveis" on public.notion_boards;
create policy "boards visiveis" on public.notion_boards for select to authenticated using (scope = 'company' or owner = auth.uid());
drop policy if exists "criar board" on public.notion_boards;
create policy "criar board" on public.notion_boards for insert to authenticated
  with check ((scope = 'company' and public.is_admin()) or (scope = 'user' and owner = auth.uid() and not public.is_guest()));
drop policy if exists "apagar board" on public.notion_boards;
create policy "apagar board" on public.notion_boards for delete to authenticated
  using ((scope = 'company' and public.is_admin()) or owner = auth.uid());

create table if not exists public.notion_tokens (
  owner uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  token text not null,
  updated_at timestamptz not null default now()
);
alter table public.notion_tokens enable row level security;
drop policy if exists "meu token" on public.notion_tokens;
create policy "meu token" on public.notion_tokens for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
