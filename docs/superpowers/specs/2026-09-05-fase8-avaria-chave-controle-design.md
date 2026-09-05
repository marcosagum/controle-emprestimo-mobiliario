# Fase 8 — Avaria na devolução de chave/controle

Projeto: Arena Mobília - Controle de Empréstimos (`index.html`, single-file app, Firebase Realtime Database + localStorage).

Esta é a oitava e última fase deste ciclo de trabalho, seguindo:
1-4. Fases 1-4 (concluídas, mescladas em `main`): bugs, UX de chave/controle de ar, redesign visual Rio Centro, conexão/fotos/auditoria, 12-bug fix batch.
5. Fase 5 (concluída, mesclada em `main`, não publicada): reorganização por evento.
6. Fase 6 (concluída, mesclada em `main`, não publicada): redesign visual (sub-abas, wizards de check-in/check-out, polimento).
7. Fase 7 (concluída, mesclada em `main`, não publicada): checklist de inventário livre no check-in.
8. **Fase 8 (este documento):** avaria na devolução de chave/controle.

## Contexto

Hoje o fluxo de devolução de chave/controle de ar (`window.returnKeyLoan`, individual, e `window.returnAllKeyLoans`, em lote) não tem nenhum campo de avaria/dano — só coleta responsável e operador da devolução via `prompt()` do navegador (não usa modal, diferente do resto do app desde a Fase 6). O usuário quer poder registrar se houve avaria na chave ou no controle de ar no momento da devolução individual.

Cada registro de empréstimo (`keyLoans`/`keyHistory`) já é de um único tipo — `tipo: 'chave'` (com `salaId`/`qtyKey`) ou `tipo: 'ac'` (controle de ar, com `qtyAc`), nunca os dois combinados (confirmado em `isAcTipo(rec)`). Por isso "avaria na chave e/ou no controle" se traduz em uma única pergunta de avaria por devolução, cujo texto muda conforme o tipo do registro sendo devolvido.

## Decisões (confirmadas com o usuário)

1. **Registro**: sim/não + descrição opcional em texto livre — não é nível de gravidade.
2. **UI**: continua no estilo `confirm()`/`prompt()` já usado nesse fluxo específico — não vira um modal novo.
3. **Devolução em lote** (`returnAllKeyLoans`) **não** pergunta sobre avaria — continua rápida como hoje. Se algum item do lote teve avaria, o usuário devolve aquele item individualmente para registrar.
4. **Onde aparece**: só na tabela de Histórico de Chaves, dentro da célula de "Devolução" que já existe — sem coluna nova, sem badge/cor na linha inteira.
5. **Editável depois**: sim, no modal de editar histórico (`editKeyHistory` → `editKeyLoan(id, true)`), no mesmo bloco que já só aparece em modo histórico.

## Design

### Modelo de dado

Nenhuma coleção nova. `keyHistory`'s record (já existente, ver `index.html:4416-4427`) ganha dois campos:
- `avaria: boolean` — `true` se houve avaria, `false` caso contrário.
- `avariaDescricao: string` — texto livre, `''` quando `avaria` é `false` ou quando o usuário não descreveu nada.

`keyLoans` (empréstimos ativos, ainda não devolvidos) **não** ganha esses campos — avaria só existe a partir do momento da devolução, então só faz sentido em `keyHistory`.

### Fluxo de devolução individual (`window.returnKeyLoan`, `index.html:4394-4440`)

Depois dos dois `prompt()` existentes (responsável, operador) e antes de montar `historyRecord`:
```javascript
const isAcEntry = isAcTipo(loan);
const teveAvaria = confirm(`Houve avaria n${isAcEntry ? 'o controle de ar' : 'a chave'}?`);
let avariaDescricao = '';
if (teveAvaria) {
    const desc = prompt('Descreva a avaria (opcional):');
    avariaDescricao = (desc || '').trim();
}
```
`historyRecord` ganha `avaria: teveAvaria, avariaDescricao: avariaDescricao,` entre os campos já existentes.

`confirm()` cancelado (clicar "Cancelar" no próprio confirm) é tratado como `false` (comportamento nativo do `confirm()` — não há como distinguir "cancelou" de "respondeu não", e para este fluxo isso é aceitável: nenhum dos dois deve bloquear a devolução).

### `window.returnAllKeyLoans` (`index.html:4443-4494`)

Sem nenhuma mudança — não pergunta sobre avaria, e os `historyRecord`s que cria simplesmente não incluem `avaria`/`avariaDescricao` (ficam `undefined`, tratados como "sem avaria" em todo lugar que lê o campo, via `!!loan.avaria`).

### Exibição no Histórico de Chaves (`renderKeysHistory`, `index.html:4678` em diante)

Dentro do `<td>` que já mostra os dados de devolução (`checkoutRespCliente` + data, `index.html:4735-4738`), adiciona uma linha condicional:
```javascript
const avariaHTML = loan.avaria
    ? `<div style="color: var(--primary); font-weight: 600; font-size: 0.75rem; margin-top: 2px;" title="${(loan.avariaDescricao || 'Sem descrição').replace(/"/g, '&quot;')}">⚠️ Avaria</div>`
    : '';
```
Inserida logo após a `<div>` da data de devolução, dentro do mesmo `<td>`. Quando `loan.avaria` é `false`/`undefined`, a célula fica idêntica a hoje.

### Editar depois (`editKeyLoan`, `index.html:4498` em diante, e `#key-loan-modal`)

Novo bloco de campos dentro de `#key-loan-checkout-edit-fields` (`index.html:2436-2448`, o bloco que só aparece quando `isHistory` é `true`), logo após o grid de responsável/operador de devolução:
```html
<div class="form-group" style="margin-top: 12px;">
    <label class="form-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
        <input type="checkbox" id="key-loan-checkout-avaria">
        Houve avaria?
    </label>
    <textarea id="key-loan-checkout-avaria-desc" class="input-text" rows="2" placeholder="Descreva a avaria (opcional)" style="margin-top: 8px; resize: vertical;" disabled></textarea>
</div>
```
O textarea de descrição começa desabilitado; um listener no checkbox habilita/desabilita e limpa o valor ao desmarcar:
```javascript
keyLoanCheckoutAvaria.addEventListener('change', () => {
    keyLoanCheckoutAvariaDesc.disabled = !keyLoanCheckoutAvaria.checked;
    if (!keyLoanCheckoutAvaria.checked) keyLoanCheckoutAvariaDesc.value = '';
});
```

`editKeyLoan`'s branch `if (isHistory) { ... }` (`index.html:4553-4556`) passa a também popular esses dois campos a partir do registro:
```javascript
keyLoanCheckoutAvaria.checked = !!loan.avaria;
keyLoanCheckoutAvariaDesc.value = loan.avariaDescricao || '';
keyLoanCheckoutAvariaDesc.disabled = !loan.avaria;
```
E o branch `else` (edição de empréstimo ativo, sem campos de devolução, `index.html:4557-4560`) reseta:
```javascript
keyLoanCheckoutAvaria.checked = false;
keyLoanCheckoutAvariaDesc.value = '';
keyLoanCheckoutAvariaDesc.disabled = true;
```

No handler de submit (`btnSubmitKeyLoan.addEventListener`, `index.html:4229` em diante), dentro do branch `if (isHistory) { ... }` que atualiza `keyHistory[index]` (`index.html:4306-4321`), o objeto ganha:
```javascript
avaria: keyLoanCheckoutAvaria.checked,
avariaDescricao: keyLoanCheckoutAvaria.checked ? keyLoanCheckoutAvariaDesc.value.trim() : ''
```
O branch de edição de empréstimo ativo (`else`, `index.html:4325-4342`) não é tocado — `keyLoans` nunca tem avaria.

### CSS

Nenhuma classe nova — o indicador de avaria usa `var(--primary)` (já o vermelho padrão de alerta/destrutivo no arquivo) e tamanhos de fonte inline consistentes com o resto da célula.

## Fora de escopo

- Devolução em lote perguntar sobre avaria — decisão explícita de não fazer.
- Qualquer mudança visual maior (modal novo, badge na linha inteira, coluna nova na tabela) — descartado a favor de manter o padrão `confirm()`/`prompt()` já usado nesse fluxo e a célula de "Devolução" já existente.
- Avaria em `keyLoans` (empréstimos ainda ativos, não devolvidos) — o campo só existe a partir da devolução.
- Filtro/exportação por avaria (ex: "exportar só os que tiveram avaria") — não pedido.

## Testes

Sem suíte automatizada (mesma limitação das fases anteriores). Verificação manual:
- Devolver uma chave individualmente, responder "Sim" no confirm de avaria e descrever algo — confirmar que o registro salvo no Histórico de Chaves mostra "⚠️ Avaria" na célula de Devolução, com a descrição aparecendo ao passar o mouse (tooltip).
- Devolver um controle de ar individualmente, respondendo "Não" no confirm de avaria — confirmar que a célula de Devolução fica igual a antes desta fase (sem nenhum indicador).
- Devolver uma chave respondendo "Sim" mas deixando a descrição em branco no prompt — confirmar que salva `avaria: true` com descrição vazia, e que o indicador ainda aparece (com "Sem descrição" no tooltip).
- Usar "Devolver Todas as Chaves" (lote) com pelo menos um item ativo — confirmar que nenhuma pergunta de avaria aparece, e que os registros criados no histórico não mostram o indicador de avaria.
- Editar (senha mestre) um registro do histórico que teve avaria — confirmar que o checkbox vem marcado e a descrição pré-preenchida; desmarcar o checkbox, salvar, e confirmar que o indicador de avaria desaparece daquele registro na tabela.
- Editar um registro do histórico que **não** teve avaria — marcar o checkbox, escrever uma descrição, salvar — confirmar que o indicador passa a aparecer.
- Editar um empréstimo **ativo** (ainda não devolvido, via o mesmo modal em modo não-histórico) — confirmar que os campos de avaria continuam ocultos/resetados e que salvar não introduz `avaria`/`avariaDescricao` nesse registro ativo.
