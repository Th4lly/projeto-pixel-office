-- =====================================================================
-- PixelOffice — esquema do banco (Supabase)
-- Tabelas, segurança (RLS), funções e tempo real.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Perfis
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default 'Aventureiro',
  avatar jsonb,
  is_admin boolean not null default false,
  xp integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "perfis visiveis" on public.profiles;
create policy "perfis visiveis" on public.profiles
  for select to authenticated using (true);

drop policy if exists "editar o proprio perfil" on public.profiles;
create policy "editar o proprio perfil" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Usuário só pode mudar nome e avatar; XP e admin mudam via funções.
revoke update on public.profiles from authenticated, anon;
grant update (name, avatar) on public.profiles to authenticated;

-- Cria o perfil automaticamente. A primeira conta não-anônima vira administradora.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_anon boolean := coalesce(new.is_anonymous, false);
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Aventureiro'
  );
  insert into public.profiles (id, name, is_admin)
  values (
    new.id,
    left(v_name, 24),
    (not v_anon) and not exists (select 1 from public.profiles where is_admin)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Configuração do escritório e permissões
-- ---------------------------------------------------------------------
create table if not exists public.maps (
  id text primary key default 'main',
  width integer not null,
  height integer not null,
  floor jsonb not null,
  spawn jsonb not null default '{"x": 1, "y": 1}',
  open_edit boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.maps enable row level security;

drop policy if exists "mapa visivel" on public.maps;
create policy "mapa visivel" on public.maps for select to authenticated using (true);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_guest()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

create or replace function public.can_edit()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
      or (not public.is_guest() and coalesce((select open_edit from public.maps where id = 'main'), false));
$$;

-- ---------------------------------------------------------------------
-- Objetos e áreas do mapa
-- ---------------------------------------------------------------------
create table if not exists public.map_objects (
  id text primary key,
  map_id text not null default 'main' references public.maps (id) on delete cascade,
  type text not null,
  x integer not null,
  y integer not null,
  color text,
  state jsonb not null default '{}',
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists map_objects_map_idx on public.map_objects (map_id);
alter table public.map_objects enable row level security;

drop policy if exists "objetos visiveis" on public.map_objects;
create policy "objetos visiveis" on public.map_objects for select to authenticated using (true);
drop policy if exists "editores criam objetos" on public.map_objects;
create policy "editores criam objetos" on public.map_objects for insert to authenticated with check (public.can_edit());
drop policy if exists "editores removem objetos" on public.map_objects;
create policy "editores removem objetos" on public.map_objects for delete to authenticated using (public.can_edit());
-- Qualquer pessoa pode mudar o ESTADO (acender luz, regar planta, abrir porta)
drop policy if exists "todos interagem" on public.map_objects;
create policy "todos interagem" on public.map_objects for update to authenticated using (true) with check (true);
revoke update on public.map_objects from authenticated, anon;
grant update (state) on public.map_objects to authenticated;

create table if not exists public.zones (
  id text primary key,
  map_id text not null default 'main' references public.maps (id) on delete cascade,
  name text not null default '',
  kind text not null default 'area' check (kind in ('area', 'private', 'spotlight')),
  x integer not null,
  y integer not null,
  w integer not null check (w > 0),
  h integer not null check (h > 0)
);
alter table public.zones enable row level security;
drop policy if exists "areas visiveis" on public.zones;
create policy "areas visiveis" on public.zones for select to authenticated using (true);
drop policy if exists "editores mudam areas" on public.zones;
create policy "editores mudam areas" on public.zones for all to authenticated
  using (public.can_edit()) with check (public.can_edit());

-- Cria o escritório padrão na primeira vez (qualquer usuário pode chamar; só age se estiver vazio)
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
  insert into public.maps (id, width, height, floor, spawn)
  values ('main', (p_map ->> 'width')::int, (p_map ->> 'height')::int, p_map -> 'floor', coalesce(p_map -> 'spawn', '{"x":1,"y":1}'));
  insert into public.map_objects (id, type, x, y, color, state, data)
  select o ->> 'id', o ->> 'type', (o ->> 'x')::int, (o ->> 'y')::int, o ->> 'color',
         coalesce(o -> 'state', '{}'), coalesce(o -> 'data', '{}')
  from jsonb_array_elements(p_objects) o;
  insert into public.zones (id, name, kind, x, y, w, h)
  select z ->> 'id', coalesce(z ->> 'name', ''), coalesce(z ->> 'kind', 'area'),
         (z ->> 'x')::int, (z ->> 'y')::int, (z ->> 'w')::int, (z ->> 'h')::int
  from jsonb_array_elements(p_zones) z;
  return true;
end;
$$;

-- Restaura o escritório padrão (apenas editores)
create or replace function public.reset_map(p_map jsonb, p_objects jsonb, p_zones jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_open boolean;
begin
  if not public.can_edit() then
    raise exception 'sem permissão';
  end if;
  select open_edit into v_open from public.maps where id = 'main';
  delete from public.maps where id = 'main';
  perform public.ensure_map(p_map, p_objects, p_zones);
  update public.maps set open_edit = coalesce(v_open, false) where id = 'main';
end;
$$;

-- Pinta pisos/paredes: p_cells = [[x, y, "tipo"], ...]
create or replace function public.paint_floor(p_cells jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_w int;
  v_h int;
  v_floor jsonb;
  c jsonb;
  v_x int;
  v_y int;
begin
  if not public.can_edit() then
    raise exception 'sem permissão';
  end if;
  select width, height, floor into v_w, v_h, v_floor from public.maps where id = 'main' for update;
  for c in select * from jsonb_array_elements(p_cells) loop
    v_x := (c ->> 0)::int;
    v_y := (c ->> 1)::int;
    if v_x >= 0 and v_y >= 0 and v_x < v_w and v_y < v_h and (c ->> 2) ~ '^[a-z_]{2,24}$' then
      v_floor := jsonb_set(v_floor, array[(v_y * v_w + v_x)::text], to_jsonb(c ->> 2));
    end if;
  end loop;
  update public.maps set floor = v_floor, updated_at = now() where id = 'main';
end;
$$;

create or replace function public.set_map_settings(p_spawn jsonb default null, p_open_edit boolean default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_open_edit is not null and not public.is_admin() then
    raise exception 'apenas administradores';
  end if;
  if not public.can_edit() then
    raise exception 'sem permissão';
  end if;
  update public.maps
     set spawn = coalesce(p_spawn, spawn),
         open_edit = coalesce(p_open_edit, open_edit),
         updated_at = now()
   where id = 'main';
end;
$$;

-- Editores alteram textos/links dos objetos (placas, quadros, portais)
create or replace function public.set_object_data(p_id text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_edit() then
    raise exception 'sem permissão';
  end if;
  update public.map_objects set data = coalesce(p_data, '{}') where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Conteúdo compartilhado dos objetos (quadro branco, estante de links, mural, jukebox...)
-- ---------------------------------------------------------------------
create table if not exists public.object_docs (
  object_id text primary key,
  content jsonb not null default '{}',
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.object_docs enable row level security;
drop policy if exists "docs visiveis" on public.object_docs;
create policy "docs visiveis" on public.object_docs for select to authenticated using (true);

-- Acrescenta um item numa lista do documento (mantém no máximo p_max itens)
create or replace function public.doc_append(p_object text, p_key text, p_item jsonb, p_max int default 500)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_list jsonb;
begin
  if auth.uid() is null then raise exception 'login necessário'; end if;
  insert into public.object_docs (object_id) values (p_object) on conflict do nothing;
  select coalesce(content -> p_key, '[]') into v_list from public.object_docs where object_id = p_object for update;
  v_list := v_list || jsonb_build_array(p_item);
  while jsonb_array_length(v_list) > greatest(p_max, 1) loop
    v_list := v_list - 0;
  end loop;
  update public.object_docs
     set content = jsonb_set(content, array[p_key], v_list), updated_by = auth.uid(), updated_at = now()
   where object_id = p_object;
end;
$$;

-- Define uma chave inteira do documento (ex.: limpar o quadro, trocar a playlist)
create or replace function public.doc_set(p_object text, p_key text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'login necessário'; end if;
  insert into public.object_docs (object_id) values (p_object) on conflict do nothing;
  update public.object_docs
     set content = jsonb_set(content, array[p_key], coalesce(p_value, 'null'::jsonb)), updated_by = auth.uid(), updated_at = now()
   where object_id = p_object;
end;
$$;

-- Remove da lista o item cujo campo "id" é p_item_id
create or replace function public.doc_remove(p_object text, p_key text, p_item_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'login necessário'; end if;
  update public.object_docs
     set content = jsonb_set(content, array[p_key], coalesce((
           select jsonb_agg(e) from jsonb_array_elements(coalesce(content -> p_key, '[]')) e
           where e ->> 'id' is distinct from p_item_id), '[]')),
         updated_by = auth.uid(), updated_at = now()
   where object_id = p_object;
end;
$$;

-- ---------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists messages_created_idx on public.messages (created_at desc);
alter table public.messages enable row level security;
drop policy if exists "chat visivel" on public.messages;
create policy "chat visivel" on public.messages for select to authenticated using (true);
drop policy if exists "enviar mensagem" on public.messages;
create policy "enviar mensagem" on public.messages for insert to authenticated with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Quests (tarefas da empresa)
-- ---------------------------------------------------------------------
create table if not exists public.quests (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 120),
  description text not null default '',
  difficulty integer not null default 1 check (difficulty between 1 and 5),
  reward_xp integer not null default 50 check (reward_xp between 0 and 1000),
  status text not null default 'aberta' check (status in ('aberta', 'andamento', 'revisao', 'concluida')),
  category text not null default 'geral',
  assignees uuid[] not null default '{}',
  due_date date,
  link text,
  created_by uuid not null default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid
);
alter table public.quests enable row level security;
drop policy if exists "quests visiveis" on public.quests;
create policy "quests visiveis" on public.quests for select to authenticated using (true);
drop policy if exists "criar quest" on public.quests;
create policy "criar quest" on public.quests for insert to authenticated
  with check (created_by = auth.uid() and not public.is_guest());
drop policy if exists "atualizar quest" on public.quests;
create policy "atualizar quest" on public.quests for update to authenticated
  using (not public.is_guest()) with check (not public.is_guest());
drop policy if exists "apagar quest" on public.quests;
create policy "apagar quest" on public.quests for delete to authenticated
  using (created_by = auth.uid() or public.is_admin());
-- A conclusão (e o XP) só acontece via complete_quest
revoke update on public.quests from authenticated, anon;
grant update (title, description, difficulty, reward_xp, status, category, assignees, due_date, link, updated_at)
  on public.quests to authenticated;

create or replace function public.quests_guard()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'concluida' and old.status is distinct from 'concluida' and current_setting('pixeloffice.completing', true) is distinct from 'on' then
    raise exception 'use complete_quest para concluir';
  end if;
  if old.status = 'concluida' and current_setting('pixeloffice.completing', true) is distinct from 'on' then
    new.reward_xp := old.reward_xp; -- XP já pago não muda
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists quests_guard on public.quests;
create trigger quests_guard before update on public.quests
  for each row execute function public.quests_guard();

create or replace function public.complete_quest(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quests;
  v_targets uuid[];
begin
  if auth.uid() is null or public.is_guest() then raise exception 'convidados não concluem quests'; end if;
  select * into q from public.quests where id = p_id for update;
  if not found then raise exception 'quest não encontrada'; end if;
  if q.status = 'concluida' then return 0; end if;
  v_targets := case when cardinality(q.assignees) > 0 then q.assignees else array[auth.uid()] end;
  perform set_config('pixeloffice.completing', 'on', true);
  update public.quests set status = 'concluida', completed_at = now(), completed_by = auth.uid() where id = p_id;
  perform set_config('pixeloffice.completing', 'off', true);
  update public.profiles set xp = xp + q.reward_xp where id = any (v_targets);
  return q.reward_xp;
end;
$$;

create or replace function public.reopen_quest(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quests;
  v_targets uuid[];
begin
  if not public.is_admin() then raise exception 'apenas administradores reabrem quests concluídas'; end if;
  select * into q from public.quests where id = p_id for update;
  if q.status <> 'concluida' then return; end if;
  v_targets := case when cardinality(q.assignees) > 0 then q.assignees else array[q.completed_by] end;
  perform set_config('pixeloffice.completing', 'on', true);
  update public.quests set status = 'andamento', completed_at = null, completed_by = null where id = p_id;
  perform set_config('pixeloffice.completing', 'off', true);
  update public.profiles set xp = greatest(0, xp - q.reward_xp) where id = any (v_targets);
end;
$$;

create table if not exists public.quest_comments (
  id bigint generated always as identity primary key,
  quest_id uuid not null references public.quests (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  text text not null check (char_length(text) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.quest_comments enable row level security;
drop policy if exists "comentarios visiveis" on public.quest_comments;
create policy "comentarios visiveis" on public.quest_comments for select to authenticated using (true);
drop policy if exists "comentar" on public.quest_comments;
create policy "comentar" on public.quest_comments for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "apagar comentario" on public.quest_comments;
create policy "apagar comentario" on public.quest_comments for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- Objetos inteligentes: notificações via webhook
-- ---------------------------------------------------------------------
create table if not exists public.object_feed (
  id bigint generated always as identity primary key,
  object_id text not null,
  source text not null default 'webhook',
  title text not null,
  body text,
  url text,
  created_at timestamptz not null default now()
);
create index if not exists object_feed_obj_idx on public.object_feed (object_id, created_at desc);
alter table public.object_feed enable row level security;
drop policy if exists "feed visivel" on public.object_feed;
create policy "feed visivel" on public.object_feed for select to authenticated using (true);
drop policy if exists "dispensar feed" on public.object_feed;
create policy "dispensar feed" on public.object_feed for delete to authenticated using (not public.is_guest());
-- Inserções só pela edge function (service role)

create table if not exists public.webhook_tokens (
  object_id text primary key,
  token text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);
alter table public.webhook_tokens enable row level security;
-- Sem políticas: ninguém lê direto. Editores obtêm o token pela função abaixo.

create or replace function public.webhook_token(p_object text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v text;
begin
  if not public.can_edit() then raise exception 'sem permissão'; end if;
  insert into public.webhook_tokens (object_id) values (p_object) on conflict do nothing;
  select token into v from public.webhook_tokens where object_id = p_object;
  return v;
end;
$$;

-- ---------------------------------------------------------------------
-- Notas de reunião
-- ---------------------------------------------------------------------
create table if not exists public.meeting_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Reunião',
  room text,
  participants text[] not null default '{}',
  transcript text not null default '',
  summary text,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.meeting_notes enable row level security;
drop policy if exists "notas visiveis" on public.meeting_notes;
create policy "notas visiveis" on public.meeting_notes for select to authenticated using (true);
drop policy if exists "criar notas" on public.meeting_notes;
create policy "criar notas" on public.meeting_notes for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "editar notas" on public.meeting_notes;
create policy "editar notas" on public.meeting_notes for update to authenticated using (created_by = auth.uid());
drop policy if exists "apagar notas" on public.meeting_notes;
create policy "apagar notas" on public.meeting_notes for delete to authenticated using (created_by = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- Fliperama: placar
-- ---------------------------------------------------------------------
create table if not exists public.game_scores (
  id bigint generated always as identity primary key,
  game text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  score integer not null check (score >= 0 and score < 1000000),
  created_at timestamptz not null default now()
);
create index if not exists game_scores_idx on public.game_scores (game, score desc);
alter table public.game_scores enable row level security;
drop policy if exists "placar visivel" on public.game_scores;
create policy "placar visivel" on public.game_scores for select to authenticated using (true);
drop policy if exists "registrar pontos" on public.game_scores;
create policy "registrar pontos" on public.game_scores for insert to authenticated with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Tempo real (mudanças no banco chegam ao navegador)
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['quests', 'quest_comments', 'object_feed', 'object_docs', 'profiles'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

grant execute on all functions in schema public to authenticated;
