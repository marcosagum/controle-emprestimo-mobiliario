# Fase 1 — Correção de bugs e UX de chave/controle de ar

Projeto: Arena Mobília - Controle de Empréstimos (`index.html`, single-file app, Firebase Realtime Database + localStorage).

Esta é a primeira de três fases planejadas para este ciclo de trabalho:
1. **Fase 1 (este documento):** bugs e UX de chave/controle de ar.
2. Fase 2: redesign visual aplicando a paleta do projeto Rio Centro (tema claro).
3. Fase 3: melhorias gerais de funcionamento (a definir).

Cada fase terá sua própria spec e plano de implementação.

## Contexto

O time de operações da Arena Mobília usa este app para controlar empréstimo de mobiliário, check-in/check-out de salas, e um mural de chaves e controles de ar-condicionado. Múltiplos dispositivos (operadores em campo) usam o app simultaneamente, sincronizando via Firebase Realtime Database, com localStorage como cache local.

Um scan de bugs no código (arquivo completo, ~4650 linhas) encontrou 8 problemas reais e verificáveis, e o usuário relatou um problema de UX no fluxo de empréstimo de chave/controle de ar que não é um bug de código, mas um problema de modelagem: controles de ar são um recurso compartilhado por evento/cliente (no máximo 2-3 unidades), não um item por sala como a chave.

## Parte A — Modelagem de chave vs. controle de ar

**Problema:** o modal de "Entrega de Chave/Controle" (`#key-loan-modal`) trata `hasKey` e `hasAc` como flags do mesmo registro por sala. Ao selecionar múltiplas salas e marcar "Controle de Ar Condicionado", o código de criação (`btnSubmitKeyLoan`, ~linha 3369) cria **um registro por sala selecionada**, cada um carregando a mesma quantidade de controles de ar informada — dando a impressão de que N controles foram emprestados por sala, quando na realidade os 2-3 controles existentes são compartilhados entre as salas do mesmo evento.

**Mudança de modelagem:**
- **Chave de sala** continua sendo um item por sala: multi-seleção de salas, um registro (`keyLoans` entry) por sala marcada, com sua própria quantidade de chaves no molho — sem mudança de comportamento aqui.
- **Controle de ar** passa a ser um item único vinculado ao evento/cliente, não replicado por sala. Ao marcar "Controle de Ar Condicionado" e informar a quantidade, é criado **um único registro** de controle de ar associado ao evento (campo `evento` do formulário), independente de quantas salas foram selecionadas para chave.
- No mural (`renderKeysMural`) e no histórico (`renderKeysHistory`), controle de ar aparece como um card/linha separado do(s) card(s) de chave, exibido uma vez por evento — não uma vez por sala.
- Devolução: como hoje, chave e controle podem ser devolvidos junto ou separadamente; a devolução de controle de ar não depende de quantas salas ainda têm chave ativa.

**Impacto no modelo de dados:** `keyLoans`/`keyHistory` deixam de ter um único formato "por sala com hasKey+hasAc". Passam a existir dois tipos de entrada nessas coleções: `tipo: 'chave'` (com `salaId`) e `tipo: 'controle-ar'` (sem `salaId` obrigatório, vinculado só ao `evento`). Registros antigos (formato atual, com `hasKey`/`hasAc` na mesma entrada) continuam sendo lidos e exibidos como estão — não há migração retroativa de histórico existente, só o fluxo de criação novo muda.

## Parte B — Correção dos 8 bugs encontrados

Todos os 8 serão corrigidos nesta fase.

1. **Sincronização Firebase "last write wins" (perda de dados).** Trocar `db.ref('loans'/'keyLoans'/'keyHistory'/'activeRoomsState'/'roomInspections').set(arrayInteiro)` por escritas granulares por ID (`db.ref('loans/' + id).set(...)` / `.update(...)` / `.remove(...)`), evitando que um dispositivo sobrescreva mudanças feitas por outro entre o snapshot local e o momento do write.
2. **`editingInspectionId` não é resetado ao cancelar.** Resetar essa flag (e equivalentes) em todo caminho de fechamento de modal de vistoria — não só no fluxo de sucesso, mas também nos botões de cancelar/fechar.
3. **Seed inicial só roda se a raiz inteira estiver vazia.** Checar e semear cada subárvore do Firebase individualmente (`loans`, `keyLoans`, `keyHistory`, `activeRoomsState`, `roomInspections`), não só a raiz.
4. **Catálogo de salas/inventário não sincroniza via Firebase.** Sincronizar `predefinedRooms` e `roomInventories` pelo Firebase também, do mesmo jeito que as outras coleções.
5. **Exportação quebra sem aviso se um registro não tem `item`.** Adicionar guarda nula (`(loan.item || '')`) em `getFilteredLoansForExport`, igual já existe em `renderHistory`.
6. **Editar registro já removido por outro dispositivo falha silenciosamente.** Mostrar toast de erro nesses casos (nos handlers de `keyLoan` e de checkout de vistoria).
7. **Sem aviso de empréstimo de chave duplicado pra mesma sala.** Antes de criar um novo registro de chave, checar se já existe um ativo pra aquela `salaId` e avisar via toast/confirmação.
8. **ID de empréstimo principal sem sufixo aleatório.** Igualar ao padrão já usado em `keyLoans`/`roomInspections`: `Date.now() + '-' + Math.random().toString(36).substr(2,5)`.

## Testes

Não há suíte automatizada neste projeto (single-file HTML sem build/test tooling). A verificação será manual, abrindo o app localmente:
- Cenário multi-dispositivo simulado (duas abas do navegador) para validar a correção #1 e #3.
- Fluxo completo de vistoria com cancelamento de edição, seguido de checkout normal em outra sala, pra validar #2.
- Registro de chave + controle de ar em múltiplas salas, conferindo mural e histórico, pra validar a Parte A.
- Exportação com um registro sem `item` (inserido manualmente via console) pra validar #5.

## Fora de escopo (fases futuras)

- Redesign visual (Fase 2).
- Qualquer melhoria de funcionamento não listada acima (Fase 3, a definir com o usuário).
