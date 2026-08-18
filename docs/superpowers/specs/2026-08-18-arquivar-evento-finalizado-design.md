# Arquivar registros ao finalizar evento

Projeto: Arena Mobília - Controle de Empréstimos (`index.html`, single-file app).

## Contexto

Hoje o botão "Finalizar Evento" (`finalizeEventBtn`, função `proceedWithFinalization`):
1. Lista os eventos com itens ativos (não devolvidos), pede ao usuário para escolher um.
2. Gera um relatório de conferência de destino e copia para a área de transferência.
3. Pergunta (via `confirm()`) se deve marcar todos os itens ativos daquele evento como `devolvido: true`.
4. Se sim, marca os itens como devolvidos e sincroniza com o Firebase (`syncLoanUpsert`).

Os registros do evento continuam visíveis para sempre nas listas do site (`renderHistory()`, filtros Ativos/Devolvidos/Todos), agora só com status "Devolvido". A exportação para Excel (`downloadExcelStyled`, disparada pelo botão "Baixar Planilha (Excel)") é uma ação totalmente separada e manual — não tem ligação com o fluxo de finalizar evento.

O usuário quer que, ao finalizar um evento, os registros daquele evento sumam do site assim que tiverem sido passados para a planilha Excel — a planilha passa a ser o registro definitivo daquele evento, não mais o próprio site.

## Decisões (confirmadas com o usuário)

- **Gatilho da exportação:** automático. Ao finalizar o evento, o app já baixa a planilha Excel daquele evento sozinho (reaproveitando `downloadExcelStyled`, mesma função do botão manual) — o usuário não precisa exportar antes por conta própria.
- **Acesso depois de sumir:** só pela planilha Excel. Não haverá aba/filtro "Arquivados" dentro do app. Os registros continuam existindo no Firebase (não são apagados), só deixam de aparecer em qualquer lista do site.
- **Escopo dos itens arquivados:** o evento inteiro. Isso inclui tanto os itens que estavam ativos no momento de finalizar quanto os que já haviam sido devolvidos individualmente antes (pelo botão "Marcar como Devolvido" de cada item), desde que pertençam ao mesmo evento.
- **Quando o arquivamento acontece:** só quando o evento fica 100% devolvido como resultado da ação de finalizar. Se o usuário cancelar o `confirm()` de marcar itens como devolvidos (ainda há itens pendentes de conferência física), nada é exportado nem arquivado — comportamento atual mantido, evento continua aparecendo normalmente até ser finalizado de fato.
- **Fora de escopo:** a ação individual "Marcar como Devolvido" de um item avulso (fora do fluxo de finalizar evento) não muda — item continua aparecendo no histórico como "Devolvido" normalmente. Este ajuste é específico do fluxo de finalizar evento.

## Limitação aceita

Um evento cujos itens já foram TODOS devolvidos individualmente antes (zero itens ativos no momento de abrir "Finalizar Evento") não aparece na lista de eventos elegíveis do prompt (`activeEvents`, que já hoje só lista eventos com pelo menos um item não devolvido) — logo não há como finalizá-lo/arquivá-lo por essa tela. Essa restrição já existe no comportamento atual e não está sendo resolvida por este ajuste.

## Design

### 1. Novo campo de dado

Cada empréstimo (`loan`) ganha um campo opcional `arquivado: true` quando arquivado (ausente/`false` = não arquivado, sem necessidade de migração dos registros existentes). Sincroniza pelo mesmo caminho já usado por qualquer outra alteração de `loan` (`syncLoanUpsert` → `db.ref('loans/' + loan.id).set(sanitize(loan))`), sem novo helper de sync.

### 2. Ocultar registros arquivados em toda a UI

Três pontos que hoje enumeram `loans` para exibição/contagem/exportação manual passam a excluir `loan.arquivado === true` incondicionalmente, além do filtro atual (`currentFilter`):
- `renderHistory()` — lista de histórico (linha ~4592, dentro do `filter`).
- `getFilteredLoansForExport()` — usado pelo botão manual "Baixar Planilha (Excel)" (linha ~4746).
- `updateActiveCounter()` — contador de itens ativos (linha ~4297; já filtra por `!l.devolvido`, um item arquivado sempre estará `devolvido: true` também, mas adiciona a checagem por clareza/robustez caso isso mude no futuro).

Isso garante que um registro arquivado nunca aparece em nenhum filtro (Ativos/Devolvidos/Todos), busca, ou exportação manual subsequente — igual a se tivesse sido removido do site, mas os dados continuam no Firebase.

### 3. Fluxo de finalizar evento

Dentro de `proceedWithFinalization(eventName, activeLoans)`, no branch `if (confirmReturn)` (onde hoje os itens ativos são marcados como devolvidos):

1. Mantém a lógica atual de marcar `activeLoans` como `devolvido: true` + `dataDevolucao`.
2. Depois de atualizar `loans`, monta o conjunto completo do evento: todos os itens de `loans` cujo `evento` (trim + case-insensitive) bate com `eventName` — isso pega tanto os que acabaram de ser marcados quanto os que já estavam devolvidos antes.
3. Chama `downloadExcelStyled(eventLoans, eventName)` para baixar a planilha desse conjunto (mesma função usada pelo botão manual). Nome do arquivo usa o nome do evento (com espaços trocados por `_` para um nome de arquivo mais limpo, mesmo padrão de `.toLowerCase()` já usado hoje).
4. Marca cada item de `eventLoans` com `arquivado: true`, salva no `localStorage` e sincroniza cada um via `syncLoanUpsert` (mesmo padrão já usado para `updatedLoans.forEach(syncLoanUpsert)` logo abaixo).
5. Re-renderiza (`renderHistory()`, `updateActiveCounter()`) para os cards somerem imediatamente da tela.
6. Toast atualizado: algo como `"Evento finalizado! Planilha baixada e registros arquivados."` (troca a mensagem atual `"Evento finalizado! Todos os itens foram devolvidos."`).

Se o usuário cancelar o `confirm()` (branch `else`), nada muda em relação ao comportamento atual — só copia o relatório e mantém os itens ativos.

### 4. Testes / verificação

Sem framework de testes automatizados neste projeto (mesma limitação já registrada nas fases anteriores). Verificação por leitura de código (balanceamento de chaves, rastreamento manual do fluxo) + passos manuais no navegador entregues ao usuário: finalizar um evento com itens mistos (alguns já devolvidos antes, outros ainda ativos), confirmar que a planilha baixa com todos os itens do evento, confirmar que os cards do evento somem do Histórico em todos os filtros (Ativos/Devolvidos/Todos) e da busca, e confirmar no console do Firebase (ou reload da página) que os registros persistem com `arquivado: true`.
