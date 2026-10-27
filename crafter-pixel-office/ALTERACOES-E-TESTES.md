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
