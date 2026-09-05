# Fase 6 — Redesign visual (organização + execução)

Projeto: Arena Mobília - Controle de Empréstimos (`index.html`, single-file app, Firebase Realtime Database + localStorage).

Esta é a sexta fase deste ciclo de trabalho, seguindo:
1. Fase 1 (concluída, mesclada em `main`): correção de bugs e UX de chave/controle de ar.
2. Fase 2 (concluída, mesclada em `main`): redesign visual com a paleta do Rio Centro.
3. Fase 3 (concluída, mesclada em `main`): indicador de conexão, compressão de fotos, log de auditoria.
4. Fase 4 (concluída, mesclada em `main`): correção de 12 bugs de uma auditoria completa.
5. Fase 5 (concluída, mesclada em `main`, não publicada): reorganização por evento (`eventos` como coleção de primeira classe).
6. **Fase 6 (este documento):** redesign visual "200%" — organização e execução, sem mudar a paleta.
7. Fase 7 (próxima): checklist de inventário livre no check-in.
8. Fase 8 (próxima): avaria na devolução de chave/controle.

## Contexto

O usuário considera o frontend atual "feio" e "pouco funcional". Pediu uma melhoria de 200% no visual, mencionando especificamente navegação por abas no check-in/check-out. Depois de perguntas de esclarecimento, ficou definido que o foco é **organização e execução**, não rebranding — a paleta Rio Centro (tokens CSS já estabelecidos: `--bg-color`, `--primary: #e11518`, `--success: #0d9467`, `--text-primary`, `--text-secondary`, `--border-color`, `--border-radius-*`, fonte "Onest") é mantida sem alteração.

Das 4 telas do app (Eventos, Empréstimos, Vistorias de Sala, Chaves/Controles), a aba **Empréstimos** foi escolhida como a única tela que recebe reestruturação de navegação interna (sub-abas). As outras 3 recebem só polimento visual, sem mudança de estrutura.

## Decisões (confirmadas com o usuário, seção por seção)

### 1. Escopo geral
- Manter a paleta Rio Centro e a fonte Onest inalteradas.
- Foco em organização (hierarquia, agrupamento, estados) e execução (consistência, acabamento), não em identidade visual nova.
- Duas mudanças estruturais (Empréstimos em sub-abas; check-in/check-out em passos) + polimento visual leve no resto.

### 2. Empréstimos em sub-abas
Dentro da aba "Empréstimos" (uma das 3 abas principais dentro de um evento), navegação secundária com 2 sub-abas:
- **"Novo Empréstimo"** — só o formulário (grade de itens, quantidade, origem/destino, responsáveis, botão registrar). Ao registrar com sucesso, troca automaticamente para a sub-aba "Histórico".
- **"Histórico"** — busca, filtros (Ativos/Devolvidos/Todos), lista de cards, botões de ação no rodapé (Exportar Ativos, Log de Alterações).

Editar um empréstimo (lápis num card do histórico) leva de volta à sub-aba "Novo Empréstimo" com o formulário preenchido — o scroll automático de hoje vira uma troca de sub-aba.

### 3. Check-in/check-out em passos
Os modais `#checkin-modal` e `#checkout-modal` (dois modais distintos, não compartilhados) ganham cada um navegação interna em 3 passos, com indicador de progresso no topo:
1. **Dados** — no check-in: seleção de sala + responsável cliente + operador arena. No check-out: responsável (quem devolveu) + vistoriador arena (a sala já é fixa, mostrada no cabeçalho do modal). O evento é automático (`currentEventoId`, desde a Fase 5) — não há campo de evento neste passo.
2. **Checklist** — itens do inventário da sala, com quantidade e estado de integridade.
3. **Fotos** — captura/miniaturas das fotos obrigatórias.

Botões "Voltar"/"Continuar" entre os passos; o botão final ("Confirmar Check-in"/"Confirmar Check-out") só aparece no passo 3. Não muda nenhum dado ou validação — só a apresentação do formulário único de hoje, que rola tudo numa coluna só dentro do modal.

### 4. Polimento geral (Eventos, Vistorias, Chaves, componentes compartilhados)
Sem reestruturação de abas — só execução mais cuidada, reusando os tokens existentes:
- **Cards** (evento, sala, chave): título em destaque, metadados secundários menores/acinzentados, badge de status (Em Uso/Livre, Ativo/Encerrado, Ativa/Devolvida) com cor consistente em vez de texto solto.
- **Espaçamento e tipografia**: escala de espaçamento padronizada entre seções/cards; tamanhos de fonte por hierarquia (título de seção, título de card, corpo, legenda).
- **Botões**: hierarquia clara entre ação primária (preenchida, cor `--primary`/`--success`), secundária (outline) e destrutiva (vermelho).
- **Estados vazios**: telas como "nenhuma sala em uso" ou "nenhuma chave ativa" ganham um estado vazio simples (ícone + texto) em vez de área em branco.
- **Modais**: cabeçalho/rodapé fixos com padding consistente, botão de fechar sempre no mesmo lugar.

## Design técnico

### Sub-abas de Empréstimos

- Novo par de botões de navegação secundária dentro de `#panel-loans`, acima do conteúdo atual, ex. `#loan-subtab-new` / `#loan-subtab-history`, reutilizando o padrão visual já usado pela navegação principal (`.app-navigation` / `.nav-tab`), como uma variante secundária (`.sub-nav-tab` ou similar, herdando os mesmos tokens de cor/borda).
- O formulário de novo empréstimo (`#new-loan-form` e afins) e a seção de histórico/exportação (busca, filtros, lista, botões de rodapé) já existem como blocos HTML dentro de `#panel-loans` — a mudança é envolver cada bloco num container próprio (`#loan-subpanel-new`, `#loan-subpanel-history`) e alternar `display` entre eles via uma função `switchLoanSubtab(tab)`, no mesmo padrão de `enterEvento`/`exitEvento` (mostrar um, esconder outro, marcar botão ativo).
- `submitBtn`'s handler (registro de novo empréstimo), ao concluir com sucesso, chama `switchLoanSubtab('history')` em vez de (ou além de) qualquer scroll manual existente.
- `editLoan()` chama `switchLoanSubtab('new')` antes de popular o formulário.
- Estado da sub-aba não precisa persistir entre sessões — sempre abre em "Novo Empréstimo" ao entrar num evento ou trocar de aba principal (mesmo padrão hoje de `enterEvento` sempre abrir na aba "Empréstimos").

### Passos do check-in/check-out

- Em `#checkin-modal` e, separadamente, em `#checkout-modal`, os campos existentes de cada um são reagrupados em 3 containers (`.form-step`), cada um com `data-step="1|2|3"` — a mesma marcação e o mesmo comportamento de passos são aplicados independentemente em cada modal (são dois formulários distintos, `#checkin-form` e `#checkout-form`, cada um com seus próprios 3 passos).
- Um indicador de progresso simples no topo de cada modal (3 marcadores, o atual destacado com `--primary`).
- Botões "Voltar" (oculto no passo 1) / "Continuar" (troca para "Confirmar Entrada"/"Confirmar Saída" no passo 3, disparando o mesmo listener de submit que já existe em `btn-submit-checkin`/`btn-submit-checkout`).
- Nenhuma validação de campo muda — a única regra nova é que "Continuar" do passo 1→2 e 2→3 roda a validação HTML5 nativa (`checkValidity()`) só dos campos visíveis naquele passo, para não deixar avançar com campo obrigatório vazio; a validação final de submit (já existente) continua cobrindo tudo no passo 3.
- Ao fechar/reabrir qualquer um dos dois modais, sempre reseta para o passo 1 (mesmo padrão de reset de formulário já existente).

### Polimento geral

- Sem novos componentes de JS — mudanças são majoritariamente CSS (classes existentes ganham regras mais consistentes; algumas novas classes utilitárias como `.status-badge`, `.empty-state`, `.btn-secondary` para padronizar o que hoje é feito ad-hoc com estilo inline ou classes divergentes).
- Onde hoje um card usa texto solto pra indicar status (`Em Uso` / `Livre` / `Ativa` / `Devolvida` / `Ativo` / `Encerrado`), esse texto passa a ser envolvido num `<span class="status-badge status-badge--{cor}">`, com a cor (verde `--success`, vermelho `--primary`, cinza neutro) mapeada por estado.
- Estados vazios: cada `render*()` que hoje pode gerar uma lista vazia (`renderRoomsGrid`, `renderKeysMural`, `renderHistory`, `renderInspectionsHistory`, `renderKeysHistory`, `renderEventos`) ganha um `if (lista.length === 0) { container.innerHTML = '<div class="empty-state">...</div>'; return; }` no início, com texto e ícone apropriados ao contexto.
- Modais existentes (`#novo-evento-modal`, `#comparison-modal`, modal de check-in/check-out, etc.) recebem uma revisão de CSS para cabeçalho/rodapé fixos com padding consistente — sem mudar a estrutura HTML de nenhum, só as regras de `.modal-header`/`.modal-footer`/`.modal-close` já existentes (ou introduzidas onde ainda não há uma classe compartilhada).

## Fora de escopo

- Qualquer mudança na paleta de cores, fonte ou identidade visual da marca.
- Reestruturação de navegação nas abas Eventos, Vistorias de Sala e Chaves/Controles — essas recebem só polimento CSS.
- Qualquer mudança de dado, validação ou regra de negócio — Fase 6 é puramente apresentação.
- Checklist livre de inventário no check-in (Fase 7) e avaria na devolução de chave/controle (Fase 8) — fases seguintes, não tocadas aqui.
- Responsividade mobile como projeto novo — se algo já funciona em telas pequenas, deve continuar funcionando, mas não é objetivo desta fase introduzir um layout mobile dedicado.

## Testes

Sem suíte automatizada (mesma limitação das fases anteriores). Verificação manual:
- Entrar num evento, ir para "Empréstimos": confirmar que abre em "Novo Empréstimo"; registrar um empréstimo e confirmar troca automática para "Histórico" mostrando o item recém-criado; clicar no lápis de um card e confirmar volta para "Novo Empréstimo" com o formulário preenchido.
- Abrir um check-in: confirmar os 3 passos, navegação Voltar/Continuar, bloqueio de avanço com campo obrigatório vazio no passo atual, e que "Confirmar Check-in" só aparece no passo 3 e funciona como hoje. Repetir para check-out.
- Fechar o modal de check-in no meio do passo 2 e reabrir: confirmar que volta ao passo 1.
- Com uma sala livre, sem eventos e sem chaves ativas: confirmar que Eventos, mural de Chaves e grade de Salas mostram estado vazio em vez de área em branco.
- Conferir visualmente os badges de status em cards de sala, chave e empréstimo — cores consistentes com o estado real.
- Abrir cada modal do app e conferir cabeçalho/rodapé com padding consistente e botão de fechar no mesmo lugar.
