// Notas de reunião com IA: recebe a transcrição e devolve um resumo com decisões e próximos passos.
// Configure UMA das chaves nos secrets do projeto (Edge Functions → Secrets):
//   ANTHROPIC_API_KEY  (opcional: ANTHROPIC_MODEL)
//   OPENAI_API_KEY     (opcional: OPENAI_MODEL)
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PROMPT = `Você recebe a transcrição automática (pode ter erros) de uma reunião de trabalho em português.
Escreva em português do Brasil, em Markdown, com estas seções:
## Resumo
(3 a 6 frases)
## Decisões
(lista; escreva "Nenhuma registrada" se não houver)
## Próximos passos
(lista no formato "- Responsável: tarefa — prazo", quando houver)
## Pontos em aberto
(lista curta)
Não invente informações que não estejam na transcrição.`;

async function anthropic(key: string, text: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-5-5',
      max_tokens: 1500,
      system: PROMPT,
      messages: [{ role: 'user', content: text }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? 'erro na Anthropic');
  return data.content.map((c: { text?: string }) => c.text ?? '').join('');
}

async function openai(key: string, text: string) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini',
      messages: [{ role: 'system', content: PROMPT }, { role: 'user', content: text }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? 'erro na OpenAI');
  return data.choices[0].message.content as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'content-type': 'application/json' } });

  // Só usuários logados
  const auth = req.headers.get('authorization') ?? '';
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return json({ error: 'login necessário' }, 401);

  const { transcript } = await req.json().catch(() => ({ transcript: '' }));
  const text = String(transcript ?? '').slice(0, 60000).trim();
  if (text.length < 20) return json({ error: 'Transcrição muito curta para resumir.' }, 400);

  try {
    const ak = Deno.env.get('ANTHROPIC_API_KEY');
    const ok = Deno.env.get('OPENAI_API_KEY');
    if (!ak && !ok) return json({ error: 'Nenhuma chave de IA configurada (ANTHROPIC_API_KEY ou OPENAI_API_KEY).' }, 501);
    const summary = ak ? await anthropic(ak, text) : await openai(ok!, text);
    return json({ summary });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
});
