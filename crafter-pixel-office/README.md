# Crafter Pixel Office — escritório virtual estilo RPG

Escritório virtual multiplayer inspirado no Gather, com visual de RPG anime em pixel art (arte **original**, desenhada em código). O site roda no **GitHub Pages** (grátis, sem servidor) e o **Supabase** cuida de login, banco, tempo real e funções.

## O que tem

**Comunicação por proximidade**
- Câmera e microfone conectam sozinhos quando você chega perto de alguém que também ligou os dele, e desconectam quando você se afasta.
- **Áudio espacial:** o volume cai com a distância e o som vem do lado (esquerdo/direito) onde a pessoa está.
- **Áreas privadas** 🔒: conversa (vídeo e chat "perto") só entre quem está dentro.
- **Palco / Destaque** 📢: quem fala lá dentro é ouvido pelo escritório inteiro.

**Reuniões**
- Compartilhamento de tela, reações, acenar 👋 para chamar alguém, vídeos ampliáveis e indicador de quem está falando.
- **Notas de reunião com IA:** transcrição ao vivo, em que cada pessoa autoriza a transcrição da própria fala. A ata sai com resumo, decisões e próximos passos, e os próximos passos viram quests com um clique.
- **Quadro branco** colaborativo em tempo real, ou um quadro do Miro/FigJam incorporado.
- **Modo mini:** janela flutuante com os vídeos (Chrome/Edge).

**Presença e foco**
- Status (Disponível, Ocupado, Ausente).
- Status automático pela agenda (Google Agenda ou Outlook).
- Relógio Pomodoro: 25 minutos com status Ocupado.

**Personalização**
- Avatares com cabelo, olhos, pele, roupas de "classe" (Mago, Cavaleiro, Arqueiro, Clérigo, Mercador…), capas e 13 enfeites de cabeça.
- Editor de cenário com pisos, paredes e cerca de 60 objetos com cor. Áreas e permissões ficam com o administrador.
- Tema claro e escuro.

**Quests:** as tarefas da empresa viram missões.
- Cada quest tem dificuldade, XP, responsáveis, prazo, link e registro de progresso.
- Fluxo: Disponível → Em andamento → Em revisão → Concluída.
- Concluir dá XP e sobe de nível; há ranking de heróis.
- Dá para importar issues do GitHub como quests.

**Integrações**
- **Google Agenda e Outlook:** mudam o status automaticamente durante reuniões.
- **GitHub:** importa issues como quests.
- **Spotify:** mostra o que você está ouvindo.
- **Objetos inteligentes:** uma mesa ou caixa de notificações recebe webhooks do GitHub, Asana, HubSpot, n8n ou Zapier e mostra as notificações no mapa.

**Todo móvel faz algo**
- Sentar em cadeiras, sofás e bancos.
- Acender luzes e lareira; abrir portas.
- Regar plantas, que crescem e florescem.
- Café, chá e poções dão "buffs" divertidos.
- Fonte dos desejos, boneco de treino que mostra dano, portais de teletransporte.
- Piano, fliperama (cobrinha e memória, com placar), jogo da velha multiplayer e jukebox.
- Estante de links, mural de avisos, baú de anotações e guarda-roupa.

---

## Publicar (passo a passo)

### 1. Suba o projeto no GitHub
Crie um repositório vazio e envie **o conteúdo** desta pasta para a raiz (incluindo `.github/workflows/deploy.yml`). A branch padrão deve ser `main`, pois o workflow publica automaticamente a cada envio para essa branch.

### 2. Crie o projeto no Supabase
O projeto usado por este jogo é `efzyfwqgcahvftgbmvpy` (`https://efzyfwqgcahvftgbmvpy.supabase.co`). No painel desse projeto, abra **SQL Editor**, cole o conteúdo de `supabase/migrations/20261022000000_pixeloffice.sql` e execute. Sem essa migração, o banco não terá as tabelas necessárias e o jogo avisará ao iniciar.

### 3. Configure os segredos do GitHub
No repositório, abra **Settings → Secrets and variables → Actions → New repository secret** e adicione:

| Segredo | Valor | Necessário para |
| --- | --- | --- |
| `SUPABASE_URL` | Project URL em **Supabase → Project Settings → API** | Conectar o site |
| `SUPABASE_ANON_KEY` | Chave `anon`/public em **Supabase → Project Settings → API** | Conectar o site |
| `SUPABASE_ACCESS_TOKEN` | Token criado em **Supabase → Account → Access Tokens** | Publicar banco e funções |
| `SUPABASE_PROJECT_ID` | Referência do projeto em **Project Settings → General** | Publicar banco e funções |
| `SUPABASE_DB_PASSWORD` | Senha do banco definida ao criar o projeto | Publicar migrações |

As chaves da primeira e segunda linhas são públicas por natureza no frontend; nunca adicione uma `service_role`/secret key ao site. Sem os três segredos de CLI, o Pages ainda publica, mas a migração e as funções precisam ser aplicadas manualmente.

### 4. Ajuste o login no Supabase
Em **Authentication**:
- **Sign In / Providers → Allow anonymous sign-ins:** ative (é o "Entrar como convidado").
- **Sign In / Providers → Allow manual linking:** ative (necessário para as integrações).
- **Email → Confirm email:** desative se não quiser que o time precise confirmar o e-mail.
Depois do primeiro deploy, em **Authentication → URL Configuration**, coloque o endereço do site em **Site URL** e **Redirect URLs**, por exemplo `https://SEU-USUARIO.github.io/SEU-REPO/`.

### 5. Ative o GitHub Pages
No repositório, vá a **Settings → Pages → Build and deployment → Source** e escolha **GitHub Actions**. Envie um commit para `main` (ou execute o workflow em **Actions → Deploy Pixel Office → Run workflow**). O workflow verifica o JavaScript, gera a configuração do frontend, publica `/docs` e, se os segredos do CLI estiverem presentes, aplica as migrações e publica as funções.

### 6. Primeiro acesso
Abra o link e **cadastre-se primeiro**: a primeira conta vira **administradora** (modo Construir e configurações). No painel Construir dá para liberar a edição para todos os membros.

---

## Opcionais

**Notas de reunião com IA**
1. Publique as funções: automático pela integração do GitHub, ou pelo CLI com `supabase functions deploy summarize` e `supabase functions deploy webhook --no-verify-jwt`.
2. Em **Edge Functions → Secrets**, adicione `ANTHROPIC_API_KEY` ou `OPENAI_API_KEY`.

Sem chave de IA, a ata é salva com um resumo automático simples. A transcrição de voz funciona no Chrome e no Edge.

**Integrações (Google, Microsoft, GitHub, Spotify):** ative cada provedor em **Authentication → Providers**. Em cada um, crie o app OAuth no site do provedor usando o callback `https://SEU-PROJETO.supabase.co/auth/v1/callback`.
- **Google:** no Google Cloud, crie um "OAuth client" e ative a **Google Calendar API**.
- **Microsoft:** o provedor se chama **Azure** no Supabase.
- **GitHub:** crie um "OAuth App" em Settings → Developer settings.
- **Spotify:** crie um app no Spotify for Developers.

Para desligar uma integração, ponha `false` em `INTEGRATIONS` no `config.js`.

**Objetos inteligentes:** interaja com uma mesa (ou com a caixa de notificações) e clique em **Mostrar link de webhook**. Cole esse link no GitHub (Settings → Webhooks, tipo JSON), Asana, HubSpot, n8n ou Zapier. Formato genérico: `{"title": "...", "body": "...", "url": "..."}`.

**Vídeo em redes corporativas:** se o vídeo não conectar, adicione um servidor TURN em `ICE_SERVERS` no `config.js`.

---

## Testar localmente
Sem configurar nada, o site abre em **modo demonstração**: os dados ficam no navegador e cada aba aberta vira uma pessoa diferente.

Para usar outro projeto Supabase localmente, copie `.env.example` para `.env` e preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY`. O `.env` é ignorado pelo Git. `docs/js/runtime-config.js` contém a URL e a chave pública (`anon`/`publishable`) usadas pelo site; essa chave é pública por natureza e nunca deve ser substituída por uma chave `service_role`/`secret`.

```bash
npm start        # http://localhost:8080 (não precisa instalar nada)
npm run check    # verifica a sintaxe de todo o código
```

`docs/dev/sprites.html` mostra a folha com todos os avatares, móveis e pisos.

## Estrutura

```
docs/                      site (GitHub Pages)
  index.html               login + escritório
  css/                     base (temas), login, jogo, painéis
  js/
    config.js              ← configuração do app
    runtime-config.js      ← gerado por npm start / workflow; não versionado
    main.js · app.js       inicialização e orquestração
    backend/               supabase.js (produção) · local.js (demonstração)
    art/                   pixel art em código: pisos, móveis, avatares
    game/                  mundo, jogadores, renderização, mapa padrão
    ui/                    login, barra, chat, pessoas, editor de avatar, construção
    features/              quests, notas/IA, quadro branco, jogos, integrações, modo mini, objetos
    media/rtc.js           vídeo por proximidade, áudio espacial, palco, tela
  vendor/supabase.js       cliente do Supabase (local, sem CDN)
  vendor/fonts/            fontes Pixelify Sans e Nunito (licença OFL)
supabase/
  migrations/              banco, regras de segurança e funções SQL
  functions/webhook        objetos inteligentes
  functions/summarize      ata por IA
  config.toml
```

**Adicionar um móvel:** crie uma entrada em `OBJECTS` em `docs/js/art/objects.js`, com tamanho, função `draw` e o tipo de `interact`. Ele aparece sozinho no modo Construir.

## Observações
- O chat "Perto de mim" é filtrado no navegador de cada pessoa. Para assuntos sensíveis, use uma área privada com vídeo e áudio, que vão direto entre os participantes.
- Os sprites são originais, inspirados no estilo chibi dos RPGs online. Não há arte de jogos de terceiros.
