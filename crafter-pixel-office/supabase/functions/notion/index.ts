// Ponte com o Notion: o navegador não pode chamar a API do Notion direto (CORS + token).
// Board da empresa → usa o segredo NOTION_TOKEN (Edge Functions → Secrets).
// Board individual  → usa o token salvo pela própria pessoa (tabela notion_tokens, só ela lê),
//                     ou o NOTION_TOKEN se ela não tiver um.
// Ações: schema | query | move | create
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const NOTION = 'https://api.notion.com/v1';
const VERSION = '2022-06-28';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

async function notion(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${NOTION}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Notion-Version': VERSION, 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.message ?? 'erro no Notion';
    throw new Error(/Could not find/i.test(msg) ? 'O Notion não achou a base. Compartilhe a página com a integração (••• → Conexões).' : msg);
  }
  return data;
}

// deno-lint-ignore no-explicit-any
function plain(prop: any): string {
  if (!prop) return '';
  switch (prop.type) {
    case 'title': return prop.title.map((t: { plain_text: string }) => t.plain_text).join('');
    case 'rich_text': return prop.rich_text.map((t: { plain_text: string }) => t.plain_text).join('');
    case 'status': return prop.status?.name ?? '';
    case 'select': return prop.select?.name ?? '';
    case 'multi_select': return prop.multi_select.map((s: { name: string }) => s.name).join(', ');
    case 'people': return prop.people.map((p: { name?: string }) => p.name ?? '').join(', ');
    case 'date': return prop.date?.start ?? '';
    case 'number': return prop.number == null ? '' : String(prop.number);
    case 'checkbox': return prop.checkbox ? '✔' : '';
    case 'url': return prop.url ?? '';
    default: return '';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return json({ error: 'faça login' }, 401);
    const body = await req.json();
    const { data: board } = await sb.from('notion_boards').select('*').eq('id', body.board).maybeSingle();
    if (!board) return json({ error: 'board não encontrado' }, 404);
    let token = Deno.env.get('NOTION_TOKEN') ?? '';
    if (board.scope === 'user') {
      const { data: t } = await sb.from('notion_tokens').select('token').maybeSingle();
      if (t?.token) token = t.token;
    }
    if (!token) return json({ error: 'Configure o segredo NOTION_TOKEN na função "notion" ou salve seu token pessoal.' }, 400);
    const db = String(board.database_id).replace(/-/g, '');

    if (body.action === 'schema') {
      const meta = await notion(token, `/databases/${db}`);
      // deno-lint-ignore no-explicit-any
      const props = Object.entries(meta.properties).map(([name, p]: [string, any]) => ({
        name, type: p.type, options: (p.status?.options ?? p.select?.options ?? []).map((o: { name: string; color: string }) => ({ name: o.name, color: o.color })),
      }));
      return json({ title: meta.title?.map((t: { plain_text: string }) => t.plain_text).join('') ?? '', props });
    }

    if (body.action === 'query') {
      const meta = await notion(token, `/databases/${db}`);
      // deno-lint-ignore no-explicit-any
      const entries = Object.entries(meta.properties) as [string, any][];
      const statusProp = board.status_prop || entries.find(([, p]) => p.type === 'status')?.[0] || entries.find(([, p]) => p.type === 'select')?.[0];
      const titleProp = entries.find(([, p]) => p.type === 'title')?.[0];
      const personProp = board.person_prop || entries.find(([, p]) => p.type === 'people')?.[0];
      const columns = statusProp ? (meta.properties[statusProp].status?.options ?? meta.properties[statusProp].select?.options ?? []).map((o: { name: string; color: string }) => ({ name: o.name, color: o.color })) : [];
      const pages = [];
      let cursor: string | undefined;
      for (let i = 0; i < 5; i++) {
        const r = await notion(token, `/databases/${db}/query`, { method: 'POST', body: JSON.stringify({ page_size: 100, start_cursor: cursor }) });
        pages.push(...r.results);
        if (!r.has_more) break;
        cursor = r.next_cursor;
      }
      const email = (u.user.email ?? '').toLowerCase();
      const cards = pages
        // deno-lint-ignore no-explicit-any
        .filter((p: any) => {
          if (!personProp || !body.mine) return true;
          const people = p.properties[personProp]?.people ?? [];
          // deno-lint-ignore no-explicit-any
          return people.some((x: any) => (x.person?.email ?? '').toLowerCase() === email);
        })
        // deno-lint-ignore no-explicit-any
        .map((p: any) => ({
          id: p.id, url: p.url,
          title: titleProp ? plain(p.properties[titleProp]) : '(sem título)',
          status: statusProp ? plain(p.properties[statusProp]) : '',
          people: personProp ? plain(p.properties[personProp]) : '',
          // deno-lint-ignore no-explicit-any
          extra: entries.filter(([n, pp]: [string, any]) => n !== titleProp && n !== statusProp && n !== personProp && ['date', 'select', 'multi_select', 'number'].includes(pp.type))
            .slice(0, 3).map(([n]) => [n, plain(p.properties[n])]).filter(([, v]) => v),
        }));
      return json({ title: meta.title?.map((t: { plain_text: string }) => t.plain_text).join('') ?? board.title, statusProp, statusType: statusProp ? meta.properties[statusProp].type : null, columns, cards });
    }

    if (body.action === 'move') {
      const type = body.statusType === 'select' ? 'select' : 'status';
      await notion(token, `/pages/${body.page}`, { method: 'PATCH', body: JSON.stringify({ properties: { [body.statusProp]: { [type]: { name: body.to } } } }) });
      return json({ ok: true });
    }

    if (body.action === 'create') {
      const meta = await notion(token, `/databases/${db}`);
      // deno-lint-ignore no-explicit-any
      const titleProp = (Object.entries(meta.properties) as [string, any][]).find(([, p]) => p.type === 'title')?.[0];
      // deno-lint-ignore no-explicit-any
      const props: Record<string, any> = { [titleProp!]: { title: [{ text: { content: String(body.title).slice(0, 200) } }] } };
      if (body.statusProp && body.status) props[body.statusProp] = { [body.statusType === 'select' ? 'select' : 'status']: { name: body.status } };
      const page = await notion(token, '/pages', { method: 'POST', body: JSON.stringify({ parent: { database_id: db }, properties: props }) });
      return json({ ok: true, id: page.id, url: page.url });
    }

    return json({ error: 'ação desconhecida' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
