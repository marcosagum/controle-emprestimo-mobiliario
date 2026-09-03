# Fase 5 — Reorganização por evento

Projeto: Arena Mobília - Controle de Empréstimos (`index.html`, single-file app, Firebase Realtime Database + localStorage).

Esta é a quinta fase deste ciclo de trabalho, seguindo:
1. Fase 1 (concluída, mesclada em `main`): correção de bugs e UX de chave/controle de ar.
2. Fase 2 (concluída, mesclada em `main`): redesign visual com a paleta do Rio Centro.
3. Fase 3 (concluída, mesclada em `main`): indicador de conexão, compressão de fotos, log de auditoria.
4. Fase 4 (concluída, mesclada em `main`): correção de 12 bugs de uma auditoria completa.
5. **Fase 5 (este documento):** reorganizar o app inteiro em torno do conceito de Evento.
6. Fase 6 (planejada, não iniciada): redesign visual completo ("200%"), navegação por abas.
7. Fase 7 (planejada, não iniciada): checklist de inventário livre no check-in de salas.
8. Fase 8 (planejada, não iniciada): registro de avaria na devolução de chave/controle de ar.

## Contexto

Hoje "evento" é um campo de texto livre presente em empréstimos de mobília, vistorias de sala e empréstimos de chave/controle de ar — cada um com o seu próprio texto, sem nenhuma ligação entre eles além de o nome bater (comparação case-insensitive já usada em vários pontos do código, ex: `btnFinalizeEvent`). O usuário quer que "Evento" vire o eixo central do app, no mesmo espírito do projeto irmão "credenciamento": criar/escolher um evento, e a partir daí tudo que for lançado (empréstimo de mobília, check-in/check-out de sala, empréstimo de chave/ar) fica automaticamente amarrado a esse evento.

## Decisões (confirmadas com o usuário)

- **Evento vira um cadastro próprio**, não mais um campo de texto livre: nova coleção Firebase `eventos`, com `nome`, `cliente`, `dataInicio`, `dataFim` e `status` (`'ativo'` | `'encerrado'`).
- **Navegação: evento primeiro.** Uma tela inicial "Eventos" antes das 3 abas atuais. Escolher/criar um evento "entra" nele; dentro, as mesmas 3 abas de hoje (Empréstimos / Check-in-Check-out de Salas / Chaves-Ar) ficam disponíveis, e tudo lançado ali carrega automaticamente o `eventoId` do evento atual.
- **Múltiplos eventos simultâneos são suportados** — o operador pode alternar livremente entre eventos ativos.
- **Salas e chaves continuam sendo recursos globais/físicos**, não pertencem a nenhum evento: o catálogo `predefinedRooms` e os checklists `roomInventories` não mudam de forma nem de escopo. A checagem de sala já ocupada (corrigida na Fase 4) continua olhando **todas as salas em uso em qualquer evento**, nunca só o evento atual — fisicamente uma sala não pode estar em uso por dois eventos ao mesmo tempo.
- **"Finalizar Evento" passa a encerrar o cadastro do Evento.** O fluxo de hoje (relatório de conferência + marcar itens ativos como devolvidos) continua existindo, roda de dentro do evento já selecionado (sem precisar digitar/escolher o nome de novo), e ao confirmar também muda `eventos/{id}.status` para `'encerrado'`.
- **Dados operacionais existentes são apagados** ao entrar em produção com esta fase: `loans`, `keyLoans`, `keyHistory`, `activeRoomsState`, `roomInspections`, `auditLog`. O usuário já tirou um backup em PDF das vistorias de sala antes de pedir isso. `predefinedRooms` e `roomInventories` **não são apagados** (são catálogo/infraestrutura, não dado de evento).
- **Fora de escopo desta fase:** redesenho visual da tela de Eventos e das 3 abas — aqui é só a estrutura funcionando, reaproveitando o visual Rio Centro já existente. O redesenho "200%" é a Fase 6.

## Design

### 1. Coleção `eventos`

Nova coleção Firebase, sincronizada com o mesmo padrão de escrita granular por ID já usado em todas as outras coleções desde a Fase 1 (`db.ref('eventos/' + id).set(sanitize(evento))`, nunca sobrescrita de coleção inteira).

Formato de cada registro:
```
{
  id: string,
  nome: string,
  cliente: string,
  dataInicio: string,   // ISO 8601 (data, sem hora)
  dataFim: string,      // ISO 8601 (data, sem hora)
  status: 'ativo' | 'encerrado',
  criadoEm: string       // ISO 8601 (timestamp de criação)
}
```

### 2. `eventoId` nos registros operacionais

`loans`, `keyLoans`, `activeRoomsState` e `roomInspections` ganham um novo campo `eventoId` (string, referencia `eventos/{id}`), preenchido automaticamente a partir do evento atualmente selecionado no momento em que o registro é criado. O campo `evento` (texto livre) que existe hoje nesses registros é **removido** dos formulários de criação — deixa de ser digitado; passa a ser derivado (quando precisar exibir o nome do evento em algum lugar, busca-se `eventos/{eventoId}.nome`).

`keyHistory` (histórico de devolução de chave/ar) também ganha `eventoId`, copiado do registro original no momento da devolução — mesmo padrão já usado hoje pra copiar `tipo`/`salaId`/etc. de `keyLoans` pra `keyHistory` em `returnKeyLoan`/`returnAllKeyLoans`.

### 3. Estado "evento atual" e navegação

Novo estado em memória (`let currentEventoId = null;`, carregado/persistido em `localStorage` pra sobreviver a um F5) guarda qual evento está selecionado. Toda a UI existente das 3 abas (`#panel-loans`, `#panel-inspections`, `#panel-keys`) só fica visível quando `currentEventoId` está setado; sem evento selecionado, mostra a nova tela de Eventos.

**Tela de Eventos** (`#panel-eventos`, nova):
- Lista de cards dos eventos com `status: 'ativo'`, ordenados por `dataInicio`. Cada card mostra nome, cliente, período, e uma contagem rápida (nº de empréstimos ativos + chaves ativas + vistorias em aberto daquele evento — soma simples, sem quebrar por tipo).
- Aba/filtro separado listando eventos com `status: 'encerrado'` (mesmo layout de card, sem a contagem "ativos" fazendo sentido — mostra só nome/cliente/período).
- Botão "Novo Evento" abre um formulário simples (nome, cliente, data início, data fim) — ao salvar, cria o registro em `eventos` com `status: 'ativo'` e já entra nele (seta `currentEventoId`).
- Clicar num card ativo seta `currentEventoId` e mostra as 3 abas de sempre.

**Barra do evento atual:** enquanto dentro de um evento, um elemento fixo próximo ao header mostra o nome do evento atual e um link "Trocar de Evento" que zera `currentEventoId` (volta pra tela de Eventos, sem apagar nada).

### 4. Formulários de criação passam a usar o evento atual

- **Novo empréstimo de mobília** (`submitBtn`): `newLoan.eventoId = currentEventoId` no lugar de ler um campo de texto `evento` do formulário. O campo de texto "Evento" do formulário (`event-input`) é removido do HTML.
- **Novo check-in de sala** (`btnSubmitCheckin`, branch de nova vistoria): mesma troca — `newInspection.eventoId = currentEventoId`, campo de texto `checkin-event-input` removido.
- **Novo empréstimo de chave/ar** (`btnSubmitKeyLoan`, branch de criação): mesma troca — `eventoId: currentEventoId` em cada entrada criada, campo de texto `key-loan-event` removido.

Em todos os três, se por algum motivo `currentEventoId` estiver vazio no momento do submit (não deveria acontecer, já que os formulários só ficam visíveis dentro de um evento, mas é uma checagem barata de sanidade), bloqueia o envio com um aviso — não deixa criar um registro órfão sem evento.

### 5. Filtro por evento nas listas/telas existentes

- **Histórico de Empréstimos** (`renderHistory`): passa a filtrar por `loan.eventoId === currentEventoId`, além dos filtros de status/busca que já existem.
- **Grid de Salas / Histórico de Vistorias** (`renderRoomsGrid`, `renderInspectionsHistory`): mesma coisa, filtra por `eventoId === currentEventoId` — mas a **checagem de sala ocupada** (`activeRoomsState.find(r => r.id === roomId && r.statusSala === 'Em Uso')`, usada tanto na Fase 4 quanto no `btnNewInspection`) continua olhando `activeRoomsState` **sem filtrar por evento**, porque essa checagem é sobre o recurso físico, não sobre o evento.
- **Mural de Chaves/Ar** (`renderKeysMural`, `renderKeysHistory`): mesma troca, filtra por `eventoId === currentEventoId`.

### 6. "Finalizar Evento"

O botão some do meio da lista de empréstimos e vira uma ação dentro da barra do evento atual (ex: "Encerrar Evento", próximo ao nome do evento/link de trocar). O fluxo interno muda pouco:
- Não pergunta mais qual evento (já se sabe, é o `currentEventoId`).
- Gera o mesmo relatório de conferência de hoje, filtrado pelos empréstimos ativos daquele `eventoId`.
- Ao confirmar a devolução em massa: além de marcar os itens como devolvidos (comportamento atual, inalterado), atualiza `eventos/{currentEventoId}.status = 'encerrado'` e volta o usuário pra tela de Eventos (já que o evento saiu da lista de ativos).
- Se o usuário cancelar a devolução em massa (ainda tem item pra conferir fisicamente), o evento **não** é encerrado — comportamento equivalente ao de hoje, só que aplicado ao novo campo `status`.

### 7. Reset de dados de produção

Ação separada, feita manualmente no Firebase (ou por um script pontual) no momento de subir esta fase pra produção — **não é uma funcionalidade do app**, não tem botão nem UI. Remove `loans`, `keyLoans`, `keyHistory`, `activeRoomsState`, `roomInspections` e `auditLog` inteiros. Mantém `predefinedRooms` e `roomInventories`. Feito uma única vez, depois do merge desta fase, antes de anunciar o app pros operadores.

## Fora de escopo

- Redesenho visual da tela de Eventos e das 3 abas existentes — Fase 6.
- Checklist de inventário livre no check-in — Fase 7.
- Avaria na devolução de chave/controle — Fase 8.
- Migração automática de dados antigos pro modelo novo — decidido zerar em vez de migrar.
- Editar/excluir um Evento depois de criado (mudar nome/cliente/datas) — só criar e encerrar nesta fase. Se necessário, corrigir direto no Firebase por enquanto.
- Qualquer limite ou validação sobre datas de evento (ex: impedir datas sobrepostas, obrigar dataFim depois de dataInicio) — os campos existem só pra exibição/organização nesta fase.

## Testes

Sem suíte automatizada (mesma limitação das fases anteriores). Verificação manual:
- Criar dois eventos, entrar no primeiro, registrar um empréstimo de mobília, um check-in de sala e um empréstimo de chave. Trocar para o segundo evento e confirmar que nenhum desses três aparece lá.
- Tentar ocupar a mesma sala em dois eventos diferentes (check-in na sala X no Evento A, depois tentar novo check-in na mesma sala X no Evento B) — confirmar que o aviso de "sala já ocupada" (Fase 4) dispara mesmo estando em outro evento.
- Finalizar um evento com itens ativos, confirmar a devolução em massa, e confirmar que ele passa a aparecer na lista de "Encerrados" e some da lista de ativos.
- Cancelar a devolução em massa ao finalizar — confirmar que o evento continua "ativo".
- Voltar pra tela de Eventos ("Trocar de Evento") e confirmar que nada foi apagado, só a seleção mudou.
