-- PixelOffice v5: troca de mapa preservando as mesas reivindicadas.
-- Rode depois das migrações v2 e v3. Ao trocar o escritório padrão por uma versão nova,
-- o dono, a decoração e a cadeira de cada mesa passam para a mesa nova da MESMA área
-- (zonas "z-mesa-N"); assim ninguém perde a própria mesa numa atualização.

create or replace function public.upgrade_map(p_map jsonb, p_objects jsonb, p_zones jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_open boolean;
  v_ver int;
  v_keep jsonb;
begin
  select open_edit, version into v_open, v_ver from public.maps where id = 'main';
  if v_ver is not null and v_ver >= coalesce((p_map ->> 'version')::int, 2) then
    return false;
  end if;
  -- dados das mesas com dono, por área de mesa
  select coalesce(jsonb_object_agg(z.id, jsonb_strip_nulls(jsonb_build_object(
           'owner', o.data -> 'owner', 'decor', o.data -> 'decor', 'chair', o.data -> 'chair',
           'deskSkin', o.data -> 'deskSkin', 'deskColor', o.data -> 'deskColor'))), '{}'::jsonb)
    into v_keep
  from public.map_objects o
  join public.zones z on z.map_id = o.map_id and z.kind = 'desk'
   and o.x between z.x and z.x + z.w - 1 and o.y between z.y and z.y + z.h - 1
  where o.map_id = 'main' and o.data ? 'owner';

  delete from public.maps where id = 'main';
  perform public.ensure_map(p_map, p_objects, p_zones);
  update public.maps set open_edit = coalesce(v_open, false) where id = 'main';

  -- devolve cada mesa ao dono, na mesa nova da mesma área
  update public.map_objects o
     set data = o.data || (v_keep -> z.id)
    from public.zones z
   where z.map_id = o.map_id and z.kind = 'desk' and v_keep ? z.id
     and o.data ? 'slot'
     and o.x between z.x and z.x + z.w - 1 and o.y between z.y and z.y + z.h - 1;
  return true;
end;
$$;

grant execute on function public.upgrade_map(jsonb, jsonb, jsonb) to authenticated;
