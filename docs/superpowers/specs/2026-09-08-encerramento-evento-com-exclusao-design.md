# Encerramento de evento com exportação e exclusão definitiva

Projeto: Arena Mobília - Controle de Empréstimos (`index.html`, single-file app, Firebase Realtime Database + localStorage).

Esta é uma melhoria pontual pedida fora do roadmap original (Fases 1-9, já todas entregues e em produção). Segue o mesmo fluxo de trabalho: brainstorming → spec → plano → implementação.

## Contexto

O botão "Encerrar Evento" (`finalizeEventBtn`, função `proceedWithFinalization`, `index.html`) hoje: avisa sobre pendências (check-in aberto, chave não devolvida) mas deixa continuar mesmo assim; pergunta se quer marcar itens de mobília ativos como devolvidos; marca o evento como `status: 'encerrado'`. Nenhum dado é apagado — tudo continua no Firebase para sempre, incluindo fotos de vistoria em base64 dentro de `roomInspections`, que é o principal motivo do banco crescer sem limite (cada listener de tempo real baixa a coleção inteira, fotos incluídas, toda vez).

**Existe um spec relacionado, mais antigo, que foi explicitamente descartado pelo usuário em 2026-09-03** (`docs/superpowers/specs/2026-08-18-arquivar-evento-finalizado-design.md`) — aquele cobria só "esconder" registros de `loans` (pré-reorganização por evento), sem apagar de verdade. O usuário confirmou nesta conversa que quer a versão mais forte: exclusão real e definitiva, cobrindo todos os tipos de dado do evento, incluindo fotos.

**Existe também um segundo spec relacionado, nunca implementado** (`docs/superpowers/specs/2026-09-03-pdf-evento-vistorias-design.md`, imprimir todas as vistorias de um evento num PDF só) — o design de renderização desse spec é reaproveitado quase integralmente aqui, adaptado para o modelo por `eventoId` (que não existia quando aquele spec foi escrito).

## Decisões (confirmadas com o usuário)

1. **Gatilho:** automático, sempre, toda vez que "Encerrar Evento" é usado — não é uma ação separada/opcional.
2. **Pendências bloqueiam totalmente:** se o evento ainda tem sala com check-in aberto ou chave/controle não devolvido, o encerramento é bloqueado — precisa resolver tudo antes. Isso substitui o `confirm()` de hoje (que deixava continuar mesmo com pendência) por um bloqueio de verdade.
3. **Arquivos gerados:** 3 planilhas Excel separadas (Empréstimos, Vistorias, Chaves/Controles — mesmo método `.xls` via HTML já usado hoje, sem biblioteca nova) + 1 relatório HTML com todas as fotos de vistoria do evento (mesmo padrão `window.print()` já usado no resto do app).
4. **Senha mestre como confirmação final:** depois dos 4 arquivos baixados, pede a senha mestre (`gl@operacoes`, mesmo padrão já usado em outras ações destrutivas do app) antes de apagar. Cancelar a senha cancela a exclusão — nada é apagado, evento continua intacto.
5. **O que é apagado:** `loans`, `roomInspections` (fotos incluídas) e `keyHistory` daquele evento. O registro do evento em si (`eventos/<id>`) **não** é apagado — fica como índice permanente e leve. `activeRoomsState` e o catálogo (`predefinedRooms`/`roomInventories`) não são tocados.

## Design

### 1. Bloqueio de pendências

Dentro de `finalizeEventBtn`'s click handler, o bloco que hoje monta `pendingLines` e usa `confirm()` para deixar continuar mesmo com pendência vira um bloqueio: se `openInspectionsForEvent.length > 0 || activeKeysForEvent.length > 0`, mostra um `alert()` listando exatamente o que falta resolver (mesmo texto informativo de hoje, "sala(s) com check-in aberto", "chave(s)/controle(s) ainda não devolvidos") e **retorna sem prosseguir** — nenhum `proceedWithFinalization` é chamado. Empréstimos de mobiliário ativos continuam com o comportamento de hoje (pergunta se quer marcar como devolvidos automaticamente); esse fluxo não muda.

### 2. As 3 planilhas Excel

`downloadExcelStyled(data, title)` (já existe, usado hoje pelo botão manual "Baixar Planilha (Excel)") é reaproveitada **sem alteração** para a planilha de Empréstimos — chamada com os `loans` do evento (já todos devolvidos nesse ponto do fluxo) e o nome do evento.

Duas novas funções seguem exatamente o mesmo padrão visual/técnico (tabela HTML com namespace do Excel, baixada como `.xls` via `Blob`), cada uma com suas próprias colunas:

- **`downloadInspectionsExcel(eventInspections, eventName)`** — uma linha por **item de checklist** de cada vistoria fechada do evento (não uma linha por vistoria, para ficar analisável no Excel): Sala, Data Check-in, Data Check-out, Responsável Abertura (Cliente/Arena), Responsável Fechamento (Cliente/Arena), Item, Qtd Entrada, Qtd Saída, Estado Entrada, Estado Saída, Observações.
- **`downloadKeyHistoryExcel(eventKeyHistory, eventName)`** — uma linha por registro de `keyHistory` do evento: Tipo (Chave/Controle de Ar), Sala (quando aplicável), Quantidade, Responsável Abertura, Responsável Fechamento, Data Retirada, Data Devolução, Avaria (Sim/Não), Descrição da Avaria.

Nome de arquivo de cada uma segue o padrão já usado (`relatorio_<tipo>_<nome-do-evento-em-minúsculo>.xls`).

### 3. Relatório de fotos

Nova função `buildInspectionReportBlockHTML(inspection)`, que recebe uma vistoria fechada e retorna uma **string HTML** com a mesma estrutura visual do `.comparison-container` já usado no modal "Relatório Comparativo" (`window.viewInspectionReport`) — meta-grid, tabela de checklist com `tr.divergence` nas linhas divergentes, grade de fotos de check-in/check-out — só que gerando markup em vez de popular os elementos fixos do modal (que só suportam uma vistoria por vez).

Novo container oculto no HTML, fora de qualquer modal: `<div id="event-report-print"></div>`. Ao concluir a exportação das 3 planilhas (ver seção 5), o app monta `eventReportPrint.innerHTML` com um cabeçalho (nome do evento + data de geração) seguido da concatenação de `buildInspectionReportBlockHTML(insp)` para cada vistoria fechada do evento (`roomInspections.filter(i => i.eventoId === evento.id && i.status !== 'Aberto')`), cada bloco com quebra de página antes dele (exceto o primeiro), e aciona `window.print()`.

O bloco `@media print` atual mostra `#comparison-modal` **incondicionalmente** (sem depender da classe `.show`) — um `Ctrl+P` acidental sem nenhum relatório aberto hoje já imprimiria esse modal vazio. Esta fase corrige isso de passagem, já que está mexendo nessa mesma regra: `#comparison-modal` passa a exigir `.show`, e uma regra irmã é adicionada para `#event-report-print.show`, garantindo que os dois alvos de impressão nunca aparecem juntos e nenhum aparece por engano. `#event-report-print` recebe `.show` imediatamente antes de `window.print()` e perde em `window.onafterprint`, mesmo ciclo de vida que os modais já usam.

### 4. Senha mestre e exclusão

Depois que os 4 downloads disparam (3 planilhas + `window.print()` do relatório de fotos), o app pede a senha mestre:
```javascript
const pass = prompt('Digite a senha mestre para confirmar a exclusão definitiva dos dados deste evento:');
if (pass !== 'gl@operacoes') {
    alert('Senha incorreta! Exclusão cancelada — os dados do evento continuam intactos.');
    return;
}
```
Só com a senha certa, o app remove do array em memória e sincroniza a remoção no Firebase para cada `loan`, `roomInspection` e `keyHistory` do evento — reaproveitando `syncLoanRemove`/`syncKeyHistoryRemove` (já existem) e uma nova `syncInspectionRemove(id)` (mesmo padrão de `db.ref('roomInspections/' + id).remove()`, ainda não existe no arquivo). `saveToLocalStorage()`/`saveRoomsToLocalStorage()` são chamados depois para manter o cache local coerente. O registro do evento (`eventos/<id>`) é atualizado para `status: 'encerrado'`, exatamente como hoje — não é removido.

### 5. Sequência dentro de `proceedWithFinalization`

Ordem completa, depois que a lógica de marcar empréstimos ativos como devolvidos (inalterada) roda: (1) montar os 3 conjuntos de dados do evento — `eventLoans = loans.filter(l => l.eventoId === evento.id)` (**todos** os empréstimos do evento, não só os que acabaram de ser marcados como devolvidos nesta mesma chamada — inclui também os que já haviam sido devolvidos individualmente antes, pelo botão "Marcar como Devolvido" de cada item), `eventInspections = roomInspections.filter(i => i.eventoId === evento.id && i.status !== 'Aberto')`, `eventKeyHistory = keyHistory.filter(k => k.eventoId === evento.id)`; (2) baixar as 3 planilhas; (3) montar e imprimir o relatório de fotos; (4) pedir a senha mestre; (5) se confirmada, apagar os 3 conjuntos do Firebase e do estado local; (6) marcar o evento como encerrado (como hoje); (7) toast final e `exitEvento()`.

Se o evento não tiver nenhuma vistoria fechada ou nenhum histórico de chave (ex: evento só de empréstimo de mobília), as planilhas/relatório correspondentes simplesmente saem vazias (mesmo padrão de "Nenhum X registrado" já usado em outras exportações) — não é motivo para pular nenhuma etapa.

## Fora de escopo

- Qualquer mudança no botão manual "Baixar Planilha (Excel)" (`downloadExcelStyled` continua sendo chamada por ele exatamente como hoje) ou em `getFilteredLoansForExport()`.
- Qualquer mudança em `activeRoomsState`, `predefinedRooms`, `roomInventories` ou no catálogo de salas.
- Qualquer mudança no fluxo de marcar empréstimos de mobília ativos como devolvidos, já existente.
- Qualquer forma de desfazer a exclusão depois de confirmada com a senha — é definitiva.
- Filtro/seleção de quais vistorias ou registros entram nos arquivos — sempre todos os do evento.
- Geração de arquivo `.xlsx`/`.pdf` de verdade via biblioteca — mantém os dois padrões já existentes no app (`.xls` via HTML, `window.print()` para PDF).

## Testes

Sem suíte automatizada (mesma limitação do resto do projeto). Verificação manual:
- Tentar encerrar um evento com uma sala em check-in aberto — confirmar que bloqueia com o aviso, sem baixar nada nem apagar nada.
- Tentar encerrar um evento com uma chave não devolvida — mesma confirmação.
- Encerrar um evento "limpo" (tudo devolvido/fechado) com empréstimos, vistorias e chaves variados — confirmar que os 4 arquivos baixam (3 `.xls` + o diálogo de impressão do relatório de fotos), com os dados certos em cada um.
- Na tela de senha, cancelar ou errar a senha — confirmar que nada é apagado (evento e registros continuam existindo, visíveis reabrindo o evento).
- Repetir com a senha certa — confirmar que `loans`/`roomInspections`/`keyHistory` daquele evento somem do Firebase (reload da página ou console do Firebase) e o evento aparece como "Encerrado" na tela de Eventos, sem itens dentro.
- Encerrar um evento que só tem empréstimo de mobília (sem nenhuma vistoria nem chave) — confirmar que as planilhas de Vistorias/Chaves saem vazias e o relatório de fotos não trava nem mostra erro.
- Apertar `Ctrl+P` sem ter aberto nenhum relatório e sem ter encerrado nenhum evento — confirmar que aparece a página normal do app no preview de impressão, não mais o relatório comparativo vazio de antes.
