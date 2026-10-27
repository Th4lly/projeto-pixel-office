# Crafter Pixel Office — escritório virtual estilo RPG

Escritório virtual multiplayer inspirado no Gather, com visual de RPG em pixel art no estilo **Ragnarok Online**. Todo o gráfico vem da pasta de sprites `Pixel office` (personagens, monstros e efeitos do Ragnarok, tilesets e móveis de vários pacotes, interface "Paper UI", ícones de apps). O site roda no **GitHub Pages** e o **Supabase** cuida de login, banco, tempo real e funções.

> **Uso pessoal e de estudo.** Os sprites do Ragnarok são da Gravity e vários pacotes da pasta têm licença própria (veja `docs/assets/licenses`). Mantenha o repositório/site privado e não use comercialmente.

## O que tem

**Visual novo (v2)**
- Avatares do Ragnarok: 49 classes (masc./fem.), 900+ cabelos em 9 cores, 600+ acessórios de cabeça, 600+ armas e mascotes que seguem você.
- Pisos, paredes e mais de 1.800 objetos recortados da pasta (escritório pixel, móveis modernos, nobres em 8 cores, café, cantinho de leitura, masmorra, natureza…).
- Botões e molduras com o Paper UI, cursor do Ragnarok e **relógio com o horário local** (canto inferior direito) com o ciclo de dia e noite.
- `docs/assets/USO.md` lista cada arquivo da pasta e onde ele é usado.

**Telefone e chamadas**
- Botão de **telefone** na barra: escolha com quem quer se conectar (uma ou várias pessoas), de qualquer lugar do mapa. A pessoa recebe a chamada e atende ou recusa.
- Ligue **da sua mesa** ou do **telefone das salas de reunião**: quem atende entra na reunião com todos que estão na sala, sem precisar ir até lá.
- Na reunião: **anexos** (arrastar e soltar, até 25 MB), **planilhas conectadas** (Google Sheets, Excel Online, Airtable — aparecem ao vivo) e **gráficos** (barras, linhas ou pizza) feitos de uma planilha ou de dados colados.

**Mesa própria**
- Cada mesa tem a sua área. Reivindique uma e decore livremente: objetos **em cima** e **em volta**, adesivos de apps, cor (matiz, saturação, brilho), tamanho e espelho de cada item, **modelo/cor da mesa** e **cadeira**. Aba "Minha mesa" na personalização (ou botão da mesa na barra).

**Arenas (combate d20 do guia "Ragnarok d20")**
- Ao lado do jardim fica a **Ala das Arenas**: Arena dos Monstros, Covil do Chefe (MvP Bafomé), Sala de Treino e a **Arena PvP** — o único lugar onde jogadores podem lutar entre si.
- Atributos FOR/AGI/VIT/INT/DES/SOR, CA = 10 + AGI + Hard DEF, ataque d20 + DES + BAB, Soft DEF, crítico por SOR, esquiva perfeita, ASPD, elementos, status (Atordoamento, Congelamento, Petrificação, Maldição, Silêncio, Envenenamento) com testes de resistência, níveis de base e de classe.
- A classe vem do avatar (Cavaleiro, Bruxo, Algoz, Sacerdote + Arqueiro, Mercador, Aprendiz). Habilidades: Impacto de Tyr, Nevasca, Lâminas Destruidoras, Magnificat, Curar… Teclas **F** (atacar), **R**/**T** (habilidades), **G** (Amplificação Mística).

**Notion**
- Botão do Notion na barra: board **da empresa** (o administrador conecta) e boards **individuais**, com a opção "só os meus cards". Arraste cards entre colunas e crie cards novos.

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

### 1. Repositório público
O código está em [github.com/Th4lly/projeto-pixel-office](https://github.com/Th4lly/projeto-pixel-office), com o jogo na pasta `crafter-pixel-office`.

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

### 5. Publicação automática
O workflow `.github/workflows/deploy-pages.yml` publica `crafter-pixel-office/docs` no GitHub Pages a cada envio para `main`. No primeiro deploy, confirme em **Settings → Pages → Build and deployment** que a fonte é **GitHub Actions**. O endereço público será `https://th4lly.github.io/projeto-pixel-office/`.

### 6. Primeiro acesso
Abra o link e **cadastre-se primeiro**: a primeira conta vira **administradora** (modo Construir e configurações). No painel Construir dá para liberar a edição para todos os membros.

---

## Atualizar para a v2 (visual com sprites, arenas, mesas, Notion)

1. No **SQL Editor** do Supabase, rode `supabase/migrations/20261024000000_pixeloffice_v2.sql` (depois da migração original). Ela cria as mesas próprias, o progresso de combate, os anexos de reunião (bucket `meeting-files`) e as tabelas do Notion.
2. Abra o jogo: o escritório antigo é trocado automaticamente pelo novo (uma vez, para todos).
3. **Notion (opcional):** publique a função `notion` (`supabase functions deploy notion`) e, em **Edge Functions → Secrets**, crie `NOTION_TOKEN` com o token de uma integração interna (notion.so/my-integrations). No Notion, compartilhe a base com a integração (••• → Conexões).

### Regerar os gráficos a partir da pasta de sprites
```bash
pip install pillow numpy scipy
python3 tools/build_assets.py "C:/Users/Thallyta/Downloads/Pixel office"
```
O script copia todas as imagens para `docs/assets`, limpa as folhas do Ragnarok (fundo, divisórias e rótulos), recorta folhas em quadros/animações e gera `docs/assets/catalog.json`, `usage.json` e `USO.md`. Fontes `.aseprite`, licenças e leia-mes vão para `assets-src/`.

## Atualizar para a v3 (construção, camadas, rotação, NPCs com função)

1. No **SQL Editor** do Supabase, rode `supabase/migrations/20261026000000_pixeloffice_v3.sql` (depois da v2). Ela adiciona as camadas `fg`/`fx`/fundo ao mapa, `rot`/`flip` aos objetos, o inventário no perfil, a tabela `custom_objects` e o bucket público `map-assets`.
2. Abra o jogo: o mapa v2 é trocado pelo v3 uma vez, para todos. **As mesas reivindicadas e a decoração delas são zeradas** (as mesas mudaram de lugar); cada pessoa reivindica de novo.

### Novidades da v3
- **Sem NPC decorativo.** Cada NPC tem uma função e abre um diálogo com X: recepcionista (leva você a lugares, acha mesa livre, liga para alguém), Kafra (teletransporte), Mestre da Arena (cura, ficha d20, solta monstros, ranking PvP), Mercador (compra e venda com zeny), Barista (bebidas com bônus), Mestra das Quests e Assistente do Notion. No modo Construir dá para criar NPCs (aba Objetos → NPCs) e trocar função, nome, fala e aparência.
- **Todo móvel interage.** Cadeiras, sofás e bancos: sentar (o avatar vira para onde o assento aponta). Plantas: regar. Telas: abrir site. Estantes: links. Armários e baús: anotações. Quadros, janelas, luminárias, impressoras, relógios, portas… Botão direito em qualquer móvel abre o painel dele.
- **Rotação em todos os ângulos.** No painel do objeto: 8 direções, ±15° ou livre (0–359°), espelhar e "Alinhar ½" (desloca meio tile para centralizar cadeiras em mesas de 2 tiles). Móveis com arte direcional (cadeiras de escritório, cadeiras e sofás do café) trocam de sprite; os outros giram. No modo Construir, **R** / **Shift+R** gira o objeto antes de colocar.
- **Personagens em 8 direções** (setas combinadas andam na diagonal).
- **Camadas do mapa (grade de 32 px):**
  - *Pisos/Paredes* (fundo) · *Frente* (telhados, arcos, copas: ficam por cima do avatar e ficam translúcidos quando você passa por baixo) · *Objetos* · *Efeitos*.
  - *Efeitos de tile*: Intransitável, Passável, Área privada (por ID: só quem está na mesma área se ouve), Destaque (palco), Portal (dois cliques: origem e destino) e Spawn. Ficam invisíveis no jogo; marque "Mostrar efeitos sempre" para vê-los.
- **Inventário e hotbar.** Teclas 1–9 escolhem o item, **I** abre o inventário. Fora do modo Criativo, colocar consome o item e guardar devolve. Zeny vem da arena; o Mercador vende móveis. Membros constroem dentro da área da própria mesa; editores, em qualquer lugar.
- **Importar (aba Importar):**
  - *Objeto próprio*: envie um PNG; ele é ajustado à grade de 32 px (tamanho em tiles, camada, sólido ou não) e vai para "Meus objetos".
  - *Fundo do mapa*: envie uma imagem feita no Tiled, Icograms ou Aseprite (múltiplos de 32 px). Pode limpar os pisos e depois pintar colisão e áreas privadas por cima na aba Efeitos.
  - *Frente*: PNG transparente que fica por cima dos avatares.

### Controles
| Tecla | Ação |
|---|---|
| Setas / WASD | andar (8 direções) |
| X | interagir |
| Botão direito | painel do objeto (girar, ação própria, guardar) |
| B | modo Construir |
| 1–9 | item da hotbar |
| R / Shift+R | girar o item a colocar |
| I | inventário |
| Insert / C | sentar no chão |
| Botão direito num colega | seguir |

## v6: mapa novo (desenho do Thally), visual LPC, mesas com 7 espaços e pets

Não precisa rodar migração nova: o computador escolhido e a privacidade da mesa vão junto com a decoração (já gravada pela `set_desk_decor` da v2).

- **Mapa redesenhado** a partir do desenho por cores: quartel à esquerda (arena dos monstros, arena dos filhotes, PvP com ringues, escritório do chefe, sala de descanso, arquivos e refeitório ampliado), jardim interno ligado à recepção, recepção com balcão grande, escritório com 12 mesas, cabines de foco, 2 salas de reunião, cafeteria, biblioteca, auditório, terraço com deck de madeira e escada para o jardim externo, e o calabouço refeito com canal e pontes.
- **Texturas e móveis LPC** (Liberated Pixel Cup, OGA-BY/CC-BY — créditos em `docs/assets/lpc/CREDITOS.txt`): grama, terra e água com bordas orgânicas (autotile), 12 tipos de árvore, moitas, flores, pedras, cogumelos, bancos de madeira, postes e arandelas (no lugar do fogo), portas que abrem sozinhas quando alguém chega perto.
- **Sem NPCs genéricos e sem minimapa.** Ficaram só NPCs com função: a secretária atrás do balcão da recepção (achar mesa, me leve até, ligar, loja, quests, agenda, ajuda) e guias de informação nos jardins no lugar da prancheta flutuante.
- **Portal novo**: pedra com anel que pulsa, faíscas e um clarão ao atravessar.
- **Cantinhos de convivência** (áreas rosa): sofá, poltronas, mesa de centro, plantas, abajur e vitrola que abre a música (Spotify).
- **Mesa pessoal**: depois de reivindicar, a área da mesa fica destacada com o nome do dono e vira **área privada** (dá para deixar aberta). O editor tem o **computador** (monitor, dois monitores, ultrawide, all-in-one, notebook, PC gamer RGB, retrô ou nenhum), **7 espaços de decoração** em cima da mesa — cada item é ajustado ao espaço, na escala da mesa —, a **cadeira** e o **modelo da mesa**.
- **Bichinhos**: gato, cachorro, porquinho, sapo, coelho e gatinho, cada um com 4–5 pelagens. Passeiam, cochilam e respondem a carinho, petisco e brincadeira; dá para adotar como companheiro do avatar.
- **Personagem**: corrigido o cabelo que aparecia de costas (o rosto "sumia") — cada linha das folhas de cabeça do RO é um penteado só; e os acessórios não descem mais sobre os olhos. O editor mostra um retrato grande e as miniaturas de cabelo/acessório em busto.
- Para refazer os sprites LPC: `python3 tools/lpc_assets.py <pasta do repositório ElizaWy/LPC>`; para corrigir um catálogo antigo de cabeças: `python3 tools/fix_heads.py`.

## v5: cafeteria com minijogo, quartel com arenas anexas, calabouço e bosque

1. No Supabase, rode `supabase/migrations/20261027000000_pixeloffice_v5.sql`. A partir dela, **trocar o mapa não apaga mais as mesas**: o dono, a decoração e a cadeira passam para a mesa nova da mesma área. O modo demonstração (local) faz o mesmo.
2. Abra o jogo: o mapa é trocado para a versão 5 uma vez, para todos (ele agora tem 78×84 tiles).

- **Cafeteria:** inspirada nas referências, com a cozinha ao fundo em piso frio (forno a lenha, fogão industrial, pia e adega), o balcão de madeira com banquetas vermelhas, cabines estofadas, mesas redondas para 4 e um terraço no bosque.
  - **Minijogo de preparo:** em cada etapa, pare o ponteiro na faixa verde (Espaço). Cada estação tem as suas receitas: balcão (espresso, cappuccino, latte, chocolate, chá, suco), forno (pizza, pão de queijo), grelha (espetinho, hambúrguer), fogão (panquecas, sopa) e bancada (salada, sanduíche). Na pia você lava a louça por gorjeta em zeny.
  - **Comer sentado:** o que você prepara vai para a bandeja. Sente-se e aperte X na mesa: o prato aparece na mesa para todos por um minuto, e sentado o bônus dura 50% a mais. A barista também oferece o minijogo e o cardápio.
- **Quartel:** paredes de pedra separam cada espaço.
  - Arena dos Monstros, com a Arena dos Filhotes anexa.
  - Arena PvP, com dois Ringues de Duelo anexos.
  - Salas de convivência: refeitório, sala de descanso e alojamento.
  - Campo de Treino e corredor central com escada para o calabouço.
- **Calabouço:** masmorra no formato da referência. Capela do altar, sala do tesouro, canal em L com pontes, poço central, depósito e salão do MvP com trono. Sai pela caverna do bosque.
- **Jardim e bosque:**
  - grama e trilhas de terra do pacote Mana Seed, com bordas orgânicas;
  - árvores frondosas, moitas, pedras e flores;
  - o lago tem brilho animado;
  - trilhas que ligam o jardim ao escritório e o bosque à cafeteria, ao cantinho de leitura e ao auditório.
- **Paredes e delimitação dos espaços:**
  - as paredes foram redesenhadas em pixel, com friso, rodapé, contorno nas bordas, topo pontilhado e sombra no chão;
  - há frisos entre pisos diferentes e uma soleira nas passagens;
  - as cabines de foco agora têm paredes próprias.
- **Recepção:** o balcão azul curvo saiu e entrou um balcão de madeira em pixel.

## v4: arena de treino, estilo Ragnarok e gameplay RO/Gather

Não precisa de migração nova (use a v3). O mapa padrão sobe para a versão 4 e é trocado uma vez para todos; como na v3, **as mesas reivindicadas são zeradas**.

- **Itens no estilo RO.** Todo móvel é redesenhado na mesma densidade de pixel dos personagens (1 pixel da arte = 1 pixel do mundo), com cores suavizadas e contorno escuro de 1 pixel. A rotação continua funcionando. O código fica em `docs/js/art/rostyle.js`.
- **Escala simétrica.** O tamanho de cada item vem do tamanho real em relação ao personagem (~1,70 m). Por exemplo: cadeira ≈ 1,1 m, mesa com PC ≈ 1,4 m, estante ≈ 2 m e árvore ≈ 3,5 m. A tabela `SIZES` fica em `rostyle.js`. Itens grandes não passam da área no chão, para manter o alinhamento das mesas.
- **Arena com objetos interativos espalhados** (folha nova em `assets-src/extras/arena-props.png`):
  - *Campo de Treino*:
    - alvos de arco e flecha: d20 + DES; uma série de 3 flechas rende zeny;
    - racks de espadas, lanças e machados: a arma aparece no personagem e dá +1 no acerto por 10 min;
    - suportes de escudos e o monte de equipamentos: +2 CA;
    - pilha de elmos: +1 CA;
    - bonecos, caixotes e sacos.
  - *Arena PvP*: camarote real no alto (dá para sentar e assistir), ringue cercado, bancos e estandartes de equipe. Na mesma equipe ninguém se ataca, e o nome fica com a cor da equipe.
- **Gameplay estilo RO/Gather:**
  - números de dano pulando em arco;
  - drops que caem no chão (clique no item ou passe por cima; venda os drops ao Mercador);
  - marcador de clique no chão;
  - sentar no chão com **Insert** ou **C** (regeneração em dobro);
  - **minimapa** no canto superior direito (clique para andar; **M** esconde);
  - botão direito num colega para **seguir** (Esc para parar).
- **Plantas novas no vaso** (`assets-src/extras/plantas-tailside.png`).
- `tools/extra_assets.py` recorta essas folhas e limpa do catálogo as "armas" que eram só letras dos rótulos das folhas do RO. Ele também roda no fim de `tools/build_assets.py`.

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
No modo demonstração, anexos de reunião ficam no navegador (até 2,5 MB) e o Notion não funciona (precisa da função do Supabase).

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
