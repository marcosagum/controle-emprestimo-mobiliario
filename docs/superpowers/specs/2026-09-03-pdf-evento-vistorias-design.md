# Impressão de PDF por evento — Histórico de Vistorias

Projeto: Arena Mobília - Controle de Empréstimos (`index.html`, single-file app, Firebase Realtime Database + localStorage).

Esta é a quinta fase deste ciclo de trabalho, seguindo:
1. Fase 1 (concluída, mesclada em `main`): correção de bugs e UX de chave/controle de ar.
2. Fase 2 (concluída, mesclada em `main`): redesign visual com a paleta do Rio Centro.
3. Fase 3 (concluída, mesclada em `main`): indicador de conexão, compressão de fotos, log de auditoria.
4. Fase 4 (concluída, mesclada em `main`): correção de 12 bugs de uma auditoria completa — incluiu a seção "Histórico de Vistorias".
5. **Fase 5 (este documento):** impressão de um PDF único com todas as vistorias de um evento.

## Contexto

A aba "Controle de check-in e check-out de salas" já tem um relatório comparativo por vistoria individual (modal com meta-dados, tabela de checklist com divergências, e fotos de check-in/check-out), imprimível via `window.print()`. A Fase 4 adicionou a seção "Histórico de Vistorias", listando todas as vistorias fechadas com um botão "Ver Relatório" por linha — mas ainda uma de cada vez.

O usuário quer imprimir, num único PDF, todas as vistorias fechadas de um evento específico, uma após a outra, com o mesmo conteúdo do relatório individual de hoje (incluindo fotos).

## Decisões (confirmadas com o usuário)

- Filtro é por **nome do evento** (não por período/data).
- O PDF inclui **todas** as vistorias fechadas daquele evento (não há seleção individual de quais entram).
- Fotos de check-in/check-out **são incluídas** em cada vistoria do PDF — mesmo conteúdo do relatório individual, só concatenado.
- Sem opção "imprimir tudo sem filtro" nesta fase — só por evento.

## Design

### UI

Na seção "Histórico de Vistorias" (`index.html`, dentro de `#panel-inspections`), acima da tabela existente, um novo bloco com:
- Um `<input type="text">` para o nome do evento, placeholder "Digite o nome do evento...".
- Um botão "🖨️ Imprimir PDF do Evento".

### Fluxo ao clicar

1. Lê o texto digitado, `trim()`. Se vazio, mostra toast "Informe o nome do evento." e não prossegue.
2. Filtra `roomInspections` por `status !== 'Aberto'` **e** `evento.trim().toLowerCase() === texto.toLowerCase()` (mesmo padrão de comparação já usado em `btnFinalizeEvent`/`returnKeyLoan` etc. no resto do arquivo).
3. Se zero resultados, mostra toast "Nenhuma vistoria encontrada para esse evento." e não prossegue.
4. Ordena as vistorias encontradas por `checkinDataHora` crescente (ordem cronológica de abertura, mais previsível para conferência do que a ordem reversa usada na tabela de histórico).
5. Monta o conteúdo de impressão (ver "Renderização" abaixo), aciona `window.print()`.

### Renderização

O relatório individual de hoje (`viewInspectionReport`) popula campos fixos dentro do modal `#comparison-modal` (`comp-room-name`, `comp-event-name`, `comparison-table-body`, etc.) — um único conjunto de elementos, reescrito a cada abertura. Isso não serve para N vistorias ao mesmo tempo.

Nova função `buildInspectionReportBlockHTML(inspection)`, que recebe uma vistoria e retorna uma **string HTML** com a mesma estrutura visual do bloco `.comparison-container` já existente (meta-grid + tabela de checklist com `tr.divergence` nas linhas divergentes + grid de fotos de check-in/check-out) — mesma lógica de `viewInspectionReport`, adaptada para gerar markup em vez de popular elementos fixos.

Novo container oculto no HTML, fora de qualquer modal, ex: `<div id="event-report-print"></div>`. Ao clicar em "Imprimir PDF do Evento": `eventReportPrint.innerHTML` recebe um cabeçalho (nome do evento + data de geração) seguido da concatenação de `buildInspectionReportBlockHTML(insp)` para cada vistoria encontrada, cada bloco com uma classe que força quebra de página antes dele (exceto o primeiro) via CSS de impressão.

### CSS de impressão

O bloco `@media print` atual mostra `#comparison-modal` **incondicionalmente** (não depende de estar com a classe `.show`) — ou seja, um Ctrl+P acidental sem nenhuma vistoria aberta já imprimiria esse modal (vazio/com "-"). Isso é corrigido nesta fase: a regra passa a exigir `#comparison-modal.show`, e uma regra irmã é adicionada para `#event-report-print.show` — assim os dois alvos de impressão nunca aparecem juntos na mesma página, e nenhum aparece por engano.

O container `#event-report-print` recebe a classe `.show` imediatamente antes de `window.print()` e a perde em `window.onafterprint` (evento padrão, disparado quando o diálogo de impressão fecha) — mesmo padrão de ciclo de vida que os modais já usam para a classe `.show`, só que disparado por impressão em vez de clique.

Cada bloco de vistoria dentro do container recebe `page-break-before: always` via CSS de impressão, exceto o primeiro — assim cada vistoria começa em uma página nova.

## Fora de escopo

- Filtro por período/data — só por nome do evento nesta fase.
- Seleção individual de quais vistorias do evento entram no PDF — todas as fechadas daquele evento entram.
- Geração de um arquivo `.pdf` de fato via biblioteca (jsPDF ou similar) — mantém o padrão já existente no app de usar `window.print()` e deixar o navegador salvar como PDF, sem adicionar dependência nova.
- Qualquer mudança no relatório individual existente (`viewInspectionReport`) além da correção do CSS de impressão condicional descrita acima.

## Testes

Sem suíte automatizada (mesma limitação das fases anteriores). Verificação manual:
- Fechar (check-out) duas ou mais vistorias do mesmo nome de evento, em salas diferentes. Digitar esse nome no novo campo e clicar em "Imprimir PDF do Evento" — confirmar que o diálogo de impressão mostra as duas vistorias, cada uma em página separada, com checklist e fotos.
- Digitar um nome de evento sem nenhuma vistoria fechada correspondente — confirmar o aviso e que nada abre.
- Deixar o campo vazio e clicar no botão — confirmar o aviso de campo obrigatório.
- Abrir o relatório individual de uma vistoria (botão "Ver Relatório" de sempre) e imprimir — confirmar que continua funcionando exatamente como antes, mostrando só aquela vistoria.
- Apertar Ctrl+P sem ter aberto nenhum relatório e sem ter clicado em "Imprimir PDF do Evento" — confirmar que a página em branco/normal do app aparece no preview de impressão, não mais o relatório vazio de antes.
