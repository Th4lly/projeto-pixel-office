// Objetos inteligentes: recebe webhooks (GitHub, Asana, HubSpot ou JSON genérico)
// e mostra a notificação em cima do objeto no mapa.
//
// URL: https://<projeto>.supabase.co/functions/v1/webhook?object=<id>&token=<token>
// O id e o token aparecem ao interagir com o objeto (mesa, caixa de correio...) no escritório.
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const cut = (s: unknown, n: number) => (typeof s === 'string' ? s.slice(0, n) : undefined);

type Item = { source: string; title: string; body?: string; url?: string };

// deno-lint-ignore no-explicit-any
function parse(req: Request, body: any): Item | null {
  const gh = req.headers.get('x-github-event');
  if (gh) {
    if (gh === 'ping') return { source: 'github', title: 'GitHub conectado ✔' };
    const repo = body?.repository?.full_name ?? '';
    if (gh === 'issues') return { source: 'github', title: `Issue ${body.action}: ${body.issue?.title}`, body: repo, url: body.issue?.html_url };
    if (gh === 'pull_request') return { source: 'github', title: `PR ${body.action}: ${body.pull_request?.title}`, body: repo, url: body.pull_request?.html_url };
    if (gh === 'push') {
      const n = body.commits?.length ?? 0;
      return { source: 'github', title: `${n} commit(s) em ${body.ref?.replace('refs/heads/', '')}`, body: `${repo} — ${body.head_commit?.message ?? ''}`, url: body.compare };
    }
    if (gh === 'issue_comment') return { source: 'github', title: `Comentário em: ${body.issue?.title}`, body: body.comment?.body, url: body.comment?.html_url };
    if (gh === 'workflow_run') return { source: 'github', title: `Workflow ${body.workflow_run?.name}: ${body.workflow_run?.conclusion ?? body.action}`, body: repo, url: body.workflow_run?.html_url };
    return { source: 'github', title: `GitHub: ${gh}`, body: repo };
  }
  // Asana envia { events: [...] }
  if (Array.isArray(body?.events)) {
    if (!body.events.length) return null;
    const e = body.events[0];
    return { source: 'asana', title: `Asana: ${e.resource?.resource_type ?? 'tarefa'} ${e.action ?? 'atualizada'}`, body: e.resource?.name, url: e.resource?.gid ? `https://app.asana.com/0/0/${e.resource.gid}` : undefined };
  }
  // HubSpot envia uma lista de eventos
  if (Array.isArray(body) && body[0]?.subscriptionType) {
    const e = body[0];
    return { source: 'hubspot', title: `HubSpot: ${e.subscriptionType}`, body: e.propertyName ? `${e.propertyName} = ${e.propertyValue}` : `objeto ${e.objectId}` };
  }
  // Genérico: { title, body, url } (Zapier, Make, n8n...)
  if (body && (body.title || body.text || body.message)) {
    return { source: cut(body.source, 30) ?? 'webhook', title: body.title ?? body.text ?? body.message, body: body.body ?? body.description, url: body.url };
  }
  return { source: 'webhook', title: 'Nova notificação', body: JSON.stringify(body).slice(0, 300) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
  if (req.method !== 'POST') return new Response('Use POST', { status: 405 });

  const url = new URL(req.url);
  const object = url.searchParams.get('object') ?? '';
  const token = url.searchParams.get('token') ?? '';
  const { data: row } = await supabase.from('webhook_tokens').select('token').eq('object_id', object).maybeSingle();
  if (!row || !token || row.token !== token) return new Response('token inválido', { status: 401 });

  // deno-lint-ignore no-explicit-any
  let body: any = null;
  const raw = await req.text();
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = { title: raw.slice(0, 200) };
  }

  // Handshake do Asana
  const secret = req.headers.get('x-hook-secret');
  if (secret) return new Response('ok', { headers: { 'X-Hook-Secret': secret } });

  const item = parse(req, body);
  if (!item) return new Response('ignorado');
  const { error } = await supabase.from('object_feed').insert({
    object_id: object,
    source: item.source,
    title: cut(String(item.title ?? 'Notificação'), 200),
    body: cut(item.body, 600),
    url: cut(item.url, 500),
  });
  if (error) return new Response(error.message, { status: 500 });

  // Mantém só as 30 últimas notificações por objeto
  const { data: old } = await supabase.from('object_feed').select('id').eq('object_id', object).order('created_at', { ascending: false }).range(30, 200);
  if (old?.length) await supabase.from('object_feed').delete().in('id', old.map((o) => o.id));
  return new Response('ok');
});
