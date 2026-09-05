# Fase 7 — Checklist de inventário livre no check-in

Projeto: Arena Mobília - Controle de Empréstimos (`index.html`, single-file app, Firebase Realtime Database + localStorage).

Esta é a sétima fase deste ciclo de trabalho, seguindo:
1-4. Fases 1-4 (concluídas, mescladas em `main`): bugs, UX de chave/controle de ar, redesign visual Rio Centro, conexão/fotos/auditoria, 12-bug fix batch.
5. Fase 5 (concluída, mesclada em `main`, não publicada): reorganização por evento (`eventos` como coleção de primeira classe).
6. Fase 6 (concluída, mesclada em `main`, não publicada): redesign visual — sub-abas de Empréstimos, wizard de 3 passos no check-in/check-out, polimento geral.
7. **Fase 7 (este documento):** checklist de inventário livre no check-in.
8. Fase 8 (próxima): avaria na devolução de chave/controle.

## Contexto

Hoje, ao fazer check-in de uma sala, o checklist de inventário é travado ao catálogo pré-definido daquela sala (`roomInventories[roomId]`, um array de `{mobiliarioId, name, expectedQty}` semeado uma única vez no código e sem nenhuma tela de edição). `updateCheckinChecklist(roomId)` renderiza uma linha por item do catálogo, cada uma com um ajustador de quantidade (chips `-`/`+`) e um seletor de estado (Inteiro/Danificado/Ausente). Ao confirmar o check-in, o array `checklist` salvo na vistoria é montado iterando esse mesmo catálogo (`roomInventories[roomId].forEach(...)`), lendo a quantidade/estado atual de cada linha pelo DOM.

O usuário quer poder inserir livremente quais itens e quantas unidades quiser durante o check-in, sem ficar limitado a esse catálogo fixo.

**Achado importante durante o design:** o check-out **já é genérico** — ele monta seu próprio checklist a partir do array `checklist` salvo na vistoria (`inspection.checklist`), não do catálogo. Um item adicionado livremente no check-in já aparece normalmente no check-out e no relatório comparativo, sem qualquer mudança nesses dois pontos. O mesmo vale para a edição de uma vistoria já aberta (`triggerEditInspection`'s check-in branch): ela já renderiza a partir de `inspection.checklist`, não do catálogo — então a mesma UI de adicionar/remover se aplica ali automaticamente.

## Decisões (confirmadas com o usuário)

1. **O catálogo da sala continua pré-populando o checklist** no início do check-in (como hoje) — ele vira só um ponto de partida editável, não a lista final.
2. **Adicionar item é por texto livre** (nome digitado), sem grade de ícones pré-definidos — máxima liberdade.
3. **Adicionar um item novo atualiza o catálogo da sala** (`roomInventories[roomId]`) — da próxima vez que essa sala for usada em um check-in, o item novo já vem pré-populado.
4. **Remover um item do checklist não mexe no catálogo** — só tira aquele item dessa vistoria específica; o catálogo da sala continua com o item, que volta a aparecer pré-populado no próximo check-in. (Decisão assimétrica e deliberada: adicionar "ensina" o catálogo, remover não "desaprende" — evita que uma remoção pontual apague de vez um item real do catálogo.)

## Design

### Modelo de dado

Nenhuma mudança na forma de um item do checklist salvo na vistoria: `{mobiliarioId, name, expectedQty, checkinQty, checkinState, checkoutQty, checkoutState, observacoes}`.

Um item adicionado livremente recebe:
- `mobiliarioId`: gerado (`'custom-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5)`) — independente do nome digitado, para servir com segurança de chave em `getElementById`/`querySelector` sem depender de sanitizar o texto do usuário.
- `name`: o texto digitado.
- `expectedQty`: `null` (não existe "previsto" para um item que não vinha do catálogo).
- `checkinQty`: `1` (quantidade inicial; ajustável pelos mesmos chips `-`/`+` que os demais itens).
- `checkinState`: `'Inteiro'` (mesmo padrão inicial dos itens de catálogo).

### UI: adicionar item

Abaixo da lista de linhas do checklist (dentro de `#checkin-checklist-container`, tanto no fluxo de check-in novo quanto na edição de um check-in aberto), um novo bloco fixo:
```html
<div class="checklist-add-item-row">
    <input type="text" id="checkin-new-item-name" class="input-text" placeholder="Nome do item (ex: Puff, Espelho...)">
    <button type="button" class="btn-secondary" id="btn-checkin-add-item">+ Adicionar</button>
</div>
```
Ao clicar "+ Adicionar": lê o texto, `trim()`; se vazio, mostra toast "Informe o nome do item." e não prossegue. Caso contrário, gera o `mobiliarioId`, monta um objeto de item como descrito acima, renderiza uma nova linha de checklist para ele (reaproveitando a mesma função que renderiza as linhas do catálogo — ver "Renderização" abaixo) e limpa o campo de texto.

Sem quantidade no formulário de adicionar — o item entra com `checkinQty: 1` e o usuário ajusta com os chips `-`/`+` já existentes, exatamente como faria com um item de catálogo. Isso evita um segundo componente de quantidade só para esse formulário.

### UI: remover item

Cada linha do checklist (venha do catálogo ou tenha sido adicionada na hora) ganha um botão "×" no cabeçalho da linha:
```html
<div class="checklist-item-header">
    <span class="checklist-item-name">${item.name}</span>
    <span class="checklist-item-expected">${item.expectedQty !== null ? 'Previsto: ' + item.expectedQty : 'Adicionado'}</span>
    <button type="button" class="checklist-item-remove-btn" onclick="removeCheckinChecklistItem('${item.mobiliarioId}')" aria-label="Remover item">×</button>
</div>
```
`window.removeCheckinChecklistItem(mobiliarioId)` remove do DOM a linha correspondente (`.checklist-item-row` cujo `data-mobiliario-id` bate). Não toca em `roomInventories` — a remoção vale só para a tela atual; ao fechar e reabrir um novo check-in dessa sala, o catálogo (incluindo o item removido) volta a pré-popular normalmente.

### Renderização

`updateCheckinChecklist(roomId)` (usada no fluxo de check-in novo) e a branch de check-in de `triggerEditInspection` (usada ao editar um check-in aberto) já constroem, cada uma, uma linha de checklist a partir de um objeto de item — a única mudança estrutural é que cada linha (`<div class="checklist-item-row">`) passa a carregar `data-mobiliario-id="${item.mobiliarioId}"`, `data-name="${item.name}"` e `data-expected-qty="${item.expectedQty !== null ? item.expectedQty : ''}"` no próprio elemento — hoje esses dados só existem "de fora" (no array `roomInventories[roomId]`/`inspection.checklist` usado para gerar a linha), e depois de qualquer adição/remoção livre esse array externo deixa de refletir com precisão o que está na tela. Com os atributos no próprio elemento, a montagem do checklist final (no submit) passa a ler cada linha diretamente do DOM, e não mais do catálogo.

O bloco de adicionar item (`#btn-checkin-add-item`'s handler) usa essa mesma lógica de criação de linha — extraída se necessário numa função compartilhada (ex: `buildChecklistRowElement(item, mode)`, `mode` distinguindo `'checkin'` de `'checkout'` já que os dois modais têm handlers de estado/quantidade distintos) — para não duplicar o template HTML entre "renderizar catálogo" e "adicionar item novo".

### Montagem do checklist no submit

A montagem atual (dentro de `btnSubmitCheckin`'s handler) itera `roomInventories[roomId]`:
```javascript
const inventory = roomInventories[roomId] || [];
const checklist = [];
inventory.forEach(item => {
    const qtyEl = document.getElementById(`checkin-qty-${item.mobiliarioId}`);
    ...
    checklist.push({ mobiliarioId: item.mobiliarioId, name: item.name, expectedQty: item.expectedQty, checkinQty: qty, checkinState: state, ... });
});
```
Passa a iterar as linhas realmente presentes no DOM:
```javascript
const checklist = [];
checkinChecklistContainer.querySelectorAll('.checklist-item-row').forEach(row => {
    const mobiliarioId = row.getAttribute('data-mobiliario-id');
    const name = row.getAttribute('data-name');
    const expectedQtyRaw = row.getAttribute('data-expected-qty');
    const expectedQty = expectedQtyRaw === '' ? null : parseInt(expectedQtyRaw);
    const qtyEl = document.getElementById(`checkin-qty-${mobiliarioId}`);
    const qty = parseInt(qtyEl.textContent) || 0;
    const selector = document.querySelector(`.checklist-state-selector[data-item="${mobiliarioId}"]`);
    const selectedBtn = selector.querySelector('.checklist-state-btn.selected');
    const state = selectedBtn ? selectedBtn.getAttribute('data-state') : 'Inteiro';

    checklist.push({ mobiliarioId, name, expectedQty, checkinQty: qty, checkinState: state, checkoutQty: null, checkoutState: null, observacoes: '' });
});
```
Isso automaticamente reflete qualquer item removido (a linha simplesmente não existe mais no DOM) e qualquer item adicionado (a linha existe, com os atributos preenchidos na hora da criação).

A lógica de edição de vistoria aberta (o branch `if (editingInspectionId)`, que faz merge com `checkoutQty`/`checkoutState`/`observacoes` do item antigo por `mobiliarioId`) continua igual — ela já funciona por `mobiliarioId`, que continua existindo tanto para itens de catálogo quanto para os adicionados livremente.

### Atualização do catálogo da sala

Depois de montar `checklist` e antes de finalizar o submit (tanto no branch de criação quanto no de edição), identifica quais itens são novos em relação ao catálogo atual:
```javascript
const currentCatalog = roomInventories[roomId] || [];
const catalogIds = new Set(currentCatalog.map(i => i.mobiliarioId));
const newCatalogItems = checklist
    .filter(item => !catalogIds.has(item.mobiliarioId))
    .map(item => ({ mobiliarioId: item.mobiliarioId, name: item.name, expectedQty: item.checkinQty }));

if (newCatalogItems.length > 0) {
    roomInventories[roomId] = [...currentCatalog, ...newCatalogItems];
    localStorage.setItem('arena_room_inventories', JSON.stringify(roomInventories));
    syncInventoryUpsert(roomId, roomInventories[roomId]);
}
```
`syncInventoryUpsert(roomId, items)` já existe (`index.html:2884-2886`, `db.ref('roomInventories/' + roomId).set(items)`) — escrita granular por sala, criada numa fase anterior especificamente para este caso de uso (o comentário em `saveRoomsToLocalStorage()`, `index.html:2876-2881`, já apontava para ela como o jeito certo de sincronizar uma mudança pontual de inventário, evitando a condição de corrida de duas salas sendo escritas ao mesmo tempo por dispositivos diferentes que uma escrita de coleção inteira causaria).

Itens removidos da tela (que existiam no catálogo mas não estão mais entre as linhas do checklist final) **não** disparam nenhuma mudança em `roomInventories` — por decisão explícita, remover é só "não incluir dessa vez".

### CSS

Sem tokens novos. `.checklist-item-remove-btn`: botão pequeno, texto/cor `--text-secondary`, reaproveitando o padrão visual de outros ícones de ação já existentes no arquivo (ex.: `.card-action-icon-btn`). `.checklist-add-item-row`: `display: flex; gap: 8px;` simples, alinhando o input de texto com o botão "+ Adicionar".

## Fora de escopo

- Qualquer mudança no check-out — já é genérico e não precisa de nenhum ajuste.
- Escolher itens de uma grade/catálogo compartilhado (como a grade de mobiliário da aba Empréstimos) — decisão do usuário foi texto livre.
- Tela de administração para editar/remover itens do catálogo diretamente (fora do fluxo de check-in) — não pedido.
- Definir quantidade no momento de adicionar o item — entra com 1 e se ajusta pelos chips já existentes.
- Fase 8 (avaria na devolução de chave/controle) — fase seguinte, não tocada aqui.

## Testes

Sem suíte automatizada (mesma limitação das fases anteriores). Verificação manual:
- Iniciar um check-in numa sala com catálogo (ex. com "Pranchões" e "Cadeiras de quadra"): confirmar que os dois já vêm pré-populados.
- Adicionar um item novo (ex. "Puff"), confirmar que aparece na lista com quantidade 1 e estado "Inteiro", ajustar a quantidade pelos chips e confirmar o check-in.
- Fazer o check-out dessa mesma vistoria: confirmar que "Puff" aparece normalmente no checklist de checkout, com a quantidade/estado de check-in corretos como referência.
- Abrir o relatório comparativo dessa vistoria: confirmar que "Puff" aparece na tabela normalmente.
- Iniciar um **novo** check-in na mesma sala: confirmar que "Puff" agora vem pré-populado no catálogo (prova de que o catálogo "aprendeu").
- Nesse novo check-in, remover "Puff" da lista e confirmar o check-in sem ele: confirmar que a vistoria salva não tem "Puff" no checklist, mas que abrir um *outro* check-in dessa sala depois ainda mostra "Puff" pré-populado (prova de que remover não afeta o catálogo).
- Editar um check-in já aberto (antes do check-out): confirmar que dá para adicionar/remover itens do mesmo jeito, e que o resultado é salvo corretamente.
- Remover todos os itens do checklist e tentar confirmar o check-in: confirmar que isso é permitido (uma vistoria sem nenhum item no checklist não deve travar o submit — comportamento já implícito, mas vale checar).
