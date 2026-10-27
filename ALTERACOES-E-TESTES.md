# Versão revisada — 27/10/2026

## Como usar
Substitua os arquivos do repositório pelos conteúdos deste ZIP, mantendo a pasta
`crafter-pixel-office` e `.github` na raiz. Faça backup do mapa e do banco antes de
qualquer atualização. O pacote não altera o Supabase nem publica automaticamente.
O workflow existente continua responsável pela publicação após seu envio ao Git.

## Alterações implementadas
- Sinalização WebRTC sequencial por participante e retenção limitada de candidatos
  ICE recebidos antes da oferta. Recuperação de conexões que permanecem travadas.
- Aquisição de mídia protegida contra chamadas simultâneas, tratamento de falha
  ao trocar tracks e limpeza dos nós de áudio ao desconectar.
- Encerramento do estado ocupado quando todos recusam ou não atendem, proteção
  contra convites duplicados e mensagens direcionadas a outro participante.
- Barra de chamada distingue participação de conexão efetivamente estabelecida.
- Republicação de presença ao retornar à aba; descarte de eventos de canais
  Supabase antigos; limpeza dos listeners no modo local.
- Menus Mais e Reações, tema verde compartilhado, foco acessível e indicador
  Demo local/Online. Controles preservados; relógio menor e oculto em telas estreitas.
- Etiquetas com supressão quando não cabem na área ou colidem com outra etiqueta.
- Contraste reduzido em pisos internos estampados identificados pelo catálogo.
- NPCs sem metadados de animação usam pose estável, evitando ciclos de direções.
- Pets com correção do espaço transparente abaixo do sprite; sombra não salta
  junto com o corpo. Pets sem animação de caminhada ficam em seu local, sem deslizar.
- Portas automáticas usam abertura gradual, detecção antecipada e tempo de espera
  antes de fechar. Portas manuais (data.auto=false) preservam colisão pelo estado.
  O planejamento de caminho pode atravessar portas automáticas, que abrem por proximidade.
- Pontes retas recebem um deck pixelado que cobre as duas margens e o canal do
  modelo padrão. Pontes em arco e pontes rotacionadas preservam os assets originais.
- Pequeno reagrupamento da espera na recepção e centralização de mesas de reunião
  no modelo padrão. Mapas já salvos não recebem esses deslocamentos automaticamente.
- Removida substituição automática de mapas no início: o mapa da equipe é preservado.

## Verificação executada
- `npm run check`: 60 arquivos JavaScript sem erro de sintaxe.
- `node --test tests/realtime.test.mjs`: 6 testes aprovados (ICE antecipado,
  ordem da sinalização, liberação de chamadas, destinatário, portas automáticas/manuais).
- Catálogo de imagens e imports locais: nenhum arquivo referenciado ausente.

## Limites e pendências reais
O navegador de inspeção não conseguiu acessar localhost nesta sessão. Não foram
produzidas capturas antes/depois nem validado o acabamento em execução. Não foram
realizadas chamadas reais, testes em redes diferentes, dispositivos de câmera/mic,
servidor TURN ou reconexão com o Supabase de produção. Os testes unitários não
substituem essas verificações. Nenhum segredo, migração ou dado remoto foi alterado.

A perspectiva das portas ainda usa o sprite existente com abertura lateral; não
foram criadas artes direcionais novas. NPCs sem sequência identificada permanecem
estáticos. A arte em arco do poço precisa de revisão visual. A revisão completa
de iluminação e oclusão em todos os ambientes permanece como teste manual.

## Multiplayer real
O modo local usa BroadcastChannel: conecta apenas abas da mesma origem, perfil e
navegador. Não conecta computadores diferentes. Para multiplayer externo, configure
SUPABASE_URL e SUPABASE_ANON_KEY no fluxo já existente, aplique conscientemente as
migrações necessárias e confira a autenticação e o Realtime no painel Supabase.

STUN sozinho não garante chamadas em redes restritivas. Use TURN com credenciais
temporárias emitidas por um backend autenticado e inclua os servidores resultantes
na configuração de mídia antes de iniciar uma chamada. A provisão desse endpoint e
do serviço TURN depende da infraestrutura escolhida e NÃO está incluída neste ZIP.
Nunca coloque a chave administrativa do provedor TURN no frontend público.

## Revisão visual e de conexão
- A área privada não escurece mais o restante do cenário. O realce de mesas fica
  abaixo dos sprites. A área atual aparece na faixa superior; etiquetas de outras
  salas são ocultadas em zoom afastado e quando colidem com jogadores ou entre si.
- O fundo vazio e os tokens dos painéis seguem a paleta verde nos temas claro e
  escuro. A barra compacta as reações, transfere zoom e ações secundárias para
  “Mais” e mantém chamadas, mídia, pessoas e chat na área principal.
- O ciclo do relógio pré-carrega os próximos frames. Falhas de permissão de
  microfone/câmera e de conexão WebRTC recebem mensagens mais específicas.
- O Supabase só considera a sala pronta depois de confirmar a presença. Uma
  presença que não responde em oito segundos inicia a reconexão com backoff;
  os broadcasts aguardam confirmação do Realtime. A barra distingue conexão
  estabelecida, inicialização e reconexão.
- Não foram movidos móveis nem gravados mapas: o mundo ativo é persistido e
  identificado como versão antiga; nenhuma migração ou substituição automática
  foi executada.

## Verificação desta revisão
Os testes unitários agora também verificam que uma chamada não solicita
dispositivos enquanto o Realtime está desconectado e que a sala Supabase recusa
envios sem canal ativo. Isso não comprova presença nem mídia entre jogadores
reais. Duas abas independentes no modo demonstração local foram abertas no
mesmo navegador e a segunda presença apareceu na primeira. Isso não comprova
conexão entre computadores. Permissões de dispositivos, TURN e testes com duas
sessões no Supabase e redes diferentes continuam pendentes; os dados remotos não
foram alterados.

## Checklist antes de publicar
1. Execute npm start e teste as telas em zoom 50%, 100% e 150%, janela larga e estreita.
2. Confira menus, nomes de salas, contraste, portas e pets em todos os ambientes.
3. Atravesse cada ponte pelos dois sentidos; confira margens e bloqueio da água.
4. Teste chamadas aceitas, recusadas, sem resposta, canceladas e com permissão negada.
5. Teste duas sessões autenticadas em dispositivos e redes diferentes com Supabase.
6. Desconecte e reconecte a rede; suspenda e retorne à aba; confira presença e mídia.
7. Confira áudio por proximidade, áreas privadas, sala de reunião e chamada distante.
8. Confirme preservação do mapa salvo, mesas e decorações. Só restaure o modelo padrão
   pelo editor se quiser substituir o layout existente e tiver backup.

## Revisão visual do mapa padrão v7
- O escritório do chefe agora usa uma mesa funcional com cadeira alinhada; o corredor
  entre a porta e a mesa fica livre. O percurso foi testado com colisões reais do catálogo.
- As antigas salas A e B agora identificam Design e SEO. Cada sala mantém uma única mesa
  grande de reunião com oito cadeiras, telefone, tela/quadro e plantas, em piso de madeira
  clara menos contrastante; as estações extras foram removidas.
- Na biblioteca, a lareira foi para a parede lateral e rotacionada para ficar voltada à
  sala. O cantinho de leitura agora tem dois sofás frente a frente e uma mesa de centro.
- A cafeteria trocou o xadrez repetitivo por madeira clara, reservou porcelanato cinza à
  cozinha e reduziu as banquetas e mesas para deixar o percurso mais legível.
- O deck ganhou uma borda de apoio, escada de três tiles e continuação direta do caminho.
  A caverna decorativa/portal do jardim foi removida; o portal de saída do calabouço volta
  à escadaria existente no quartel.
- O calabouço mantém paredes de pedra escura, com reforço da iluminação e estandartes
  nas salas de pedra; os novos adornos ficam fora do eixo principal de passagem.
- O avatar do mundo foi reduzido em 10%, sem redimensionar os assets nem alterar dados
  dos jogadores. A nova escala mantém o ponto dos pés e as sombras no chão.
- O modelo padrão passou à versão 7. Isso apenas sinaliza que há um modelo mais recente:
  mapas salvos continuam preservados e não são substituídos automaticamente.

### Validação do mapa v7
- `npm run check`: 61 arquivos JavaScript aprovados.
- `npm test`: 12 testes aprovados, incluindo rota até o posto do chefe, a escada do
  terraço e o acesso ao calabouço; confirmação das equipes, dos pisos e do destino do portal.
- Inspeção local em modo demonstração: foram renderizados o escritório de Design e o
  terraço, confirmando a escala dos avatares e a ligação do deck à fachada. A faixa de
  grama sob os degraus foi corrigida depois da captura; a captura final dessa correção e
  comparações antes/depois continuam pendentes.
- Testes do modelo padrão também confirmam uma única mesa de reunião com oito cadeiras
  por sala e os sofás, mesa de centro e lareira orientada na biblioteca.
- O painel de combate das arenas pode ser recolhido pelo botão “−” e reaberto pela aba
  “Combate”; a aba aparece apenas dentro das arenas e tem rótulos acessíveis.
- Ainda falta revisão visual em enquadramentos próprios para cafeteria, jardim e calabouço,
  além de comparar capturas de antes/depois com o mesmo zoom. Nenhuma publicação foi feita.
