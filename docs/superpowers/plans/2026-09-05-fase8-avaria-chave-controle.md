# Fase 8 — Avaria na Devolução de Chave/Controle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the individual key/AC-remote return flow capture whether there was damage ("avaria") and an optional free-text description, show it in the Histórico de Chaves table, and let it be corrected afterward via the existing history-edit modal.

**Architecture:** Single-file app (`index.html`), no build tooling, no automated test suite. Task 1 adds the capture (a `confirm()`/`prompt()` pair in the existing return flow) and display (a conditional line inside an existing table cell) — a complete, independently testable feature on its own. Task 2 layers on the ability to view/correct that data afterward through the existing password-gated history-edit modal.

**Tech Stack:** HTML/CSS/vanilla JS, Firebase Realtime Database (compat SDK), localStorage. No new dependencies.

## Global Constraints

- Only individual return (`window.returnKeyLoan`) captures avaria — bulk return (`window.returnAllKeyLoans`) is explicitly out of scope and must not be touched.
- Avaria only ever exists on `keyHistory` records (post-return). `keyLoans` (still-active loans) never gets an `avaria`/`avariaDescricao` field — the edit-active-loan branch of the key-loan modal's submit handler must not be touched.
- No new modal — stay with the existing `confirm()`/`prompt()` browser-dialog style already used in this specific return flow.
- No new CSS classes or color tokens — reuse `var(--primary)` (already the file's standard alert/destructive color) for the avaria indicator.
- Display change is confined to the existing "Devolução" table cell in `renderKeysHistory` — no new table column, no whole-row highlight/badge.
- No automated tests exist for this project. Verification is grep/read-based plus a manual browser checklist written out in full for the human operator.

---

### Task 1: Capture avaria on individual return, show it in Histórico de Chaves

**Files:**
- Modify: `index.html:4394-4440` (`window.returnKeyLoan`)
- Modify: `index.html:4735-4738` (the "Devolução" `<td>` template inside `renderKeysHistory`)

**Interfaces:**
- Produces: two new fields on any `keyHistory` record created from now on — `avaria: boolean` and `avariaDescricao: string` (empty string when `avaria` is `false` or no description was given). Consumed by Task 2's edit-modal prefill and by this same task's own display code.
- Consumes: the existing `isAcTipo(rec)` function (unchanged, defined elsewhere in the file) to phrase the confirm prompt correctly for a "chave" vs. an "ac" (controle de ar) record.

- [ ] **Step 1: Capture avaria in `window.returnKeyLoan`**

Current code (verified at `index.html:4394-4429`):
```javascript
            window.returnKeyLoan = function(loanId) {
                const loanIndex = keyLoans.findIndex(l => l.id === loanId);
                if (loanIndex === -1) return;

                const loan = keyLoans[loanIndex];
                
                // Prompt checkout inputs
                const respDevolucao = prompt('Nome de quem está devolvendo os itens (Cliente):');
                if (respDevolucao === null) return; // Cancelled
                if (!respDevolucao.trim()) {
                    alert('Nome do responsável é obrigatório!');
                    return;
                }

                const operadorDevolucao = prompt('Nome do Operador Arena que está recebendo:');
                if (operadorDevolucao === null) return; // Cancelled
                if (!operadorDevolucao.trim()) {
                    alert('Nome do vistoriador/operador é obrigatório!');
                    return;
                }

                // Add to history
                const historyRecord = {
                    id: loan.id,
                    tipo: loan.tipo,
                    ...(isAcTipo(loan) ? { qtyAc: loan.qtyAc } : { salaId: loan.salaId, qtyKey: loan.qtyKey }),
                    eventoId: loan.eventoId,
                    checkinRespCliente: loan.checkinRespCliente,
                    checkinOperador: loan.checkinOperador,
                    checkinDataHora: loan.checkinDataHora,
                    checkoutRespCliente: respDevolucao.trim(),
                    checkoutOperador: operadorDevolucao.trim(),
                    checkoutDataHora: new Date().toISOString()
                };

                keyHistory.push(historyRecord);
```
Change to (insert the avaria prompt between the two existing `prompt()` validations and the `historyRecord` construction, and add the two new fields to that object):
```javascript
            window.returnKeyLoan = function(loanId) {
                const loanIndex = keyLoans.findIndex(l => l.id === loanId);
                if (loanIndex === -1) return;

                const loan = keyLoans[loanIndex];
                
                // Prompt checkout inputs
                const respDevolucao = prompt('Nome de quem está devolvendo os itens (Cliente):');
                if (respDevolucao === null) return; // Cancelled
                if (!respDevolucao.trim()) {
                    alert('Nome do responsável é obrigatório!');
                    return;
                }

                const operadorDevolucao = prompt('Nome do Operador Arena que está recebendo:');
                if (operadorDevolucao === null) return; // Cancelled
                if (!operadorDevolucao.trim()) {
                    alert('Nome do vistoriador/operador é obrigatório!');
                    return;
                }

                const isAcEntry = isAcTipo(loan);
                const teveAvaria = confirm(`Houve avaria n${isAcEntry ? 'o controle de ar' : 'a chave'}?`);
                let avariaDescricao = '';
                if (teveAvaria) {
                    const desc = prompt('Descreva a avaria (opcional):');
                    avariaDescricao = (desc || '').trim();
                }

                // Add to history
                const historyRecord = {
                    id: loan.id,
                    tipo: loan.tipo,
                    ...(isAcEntry ? { qtyAc: loan.qtyAc } : { salaId: loan.salaId, qtyKey: loan.qtyKey }),
                    eventoId: loan.eventoId,
                    checkinRespCliente: loan.checkinRespCliente,
                    checkinOperador: loan.checkinOperador,
                    checkinDataHora: loan.checkinDataHora,
                    checkoutRespCliente: respDevolucao.trim(),
                    checkoutOperador: operadorDevolucao.trim(),
                    checkoutDataHora: new Date().toISOString(),
                    avaria: teveAvaria,
                    avariaDescricao: avariaDescricao
                };

                keyHistory.push(historyRecord);
```
Note the pre-existing `isAcTipo(loan)` call inside the `...(isAcTipo(loan) ? ... : ...)` spread was replaced with the new `isAcEntry` variable — same value, computed once and reused, avoiding a redundant second call.

- [ ] **Step 2: Show the avaria indicator in the "Devolução" cell**

Current code (verified at `index.html:4735-4738`, inside `renderKeysHistory`'s row-building `forEach`):
```javascript
                        <td style="padding: 12px 16px; font-size: 0.82rem; line-height: 1.35; white-space: nowrap;">
                            <div style="font-weight: 600; color: var(--text-primary);">${loan.checkoutRespCliente}</div>
                            <div style="color: var(--text-muted); font-size: 0.75rem; margin-top: 2px;">${formatOut}</div>
                        </td>
```
Change to:
```javascript
                        <td style="padding: 12px 16px; font-size: 0.82rem; line-height: 1.35; white-space: nowrap;">
                            <div style="font-weight: 600; color: var(--text-primary);">${loan.checkoutRespCliente}</div>
                            <div style="color: var(--text-muted); font-size: 0.75rem; margin-top: 2px;">${formatOut}</div>
                            ${loan.avaria ? `<div style="color: var(--primary); font-weight: 600; font-size: 0.75rem; margin-top: 2px;" title="${(loan.avariaDescricao || 'Sem descrição').replace(/"/g, '&quot;')}">⚠️ Avaria</div>` : ''}
                        </td>
```
When `loan.avaria` is falsy (`false`, `undefined` — e.g. every record created by `returnAllKeyLoans`, which this task does not touch), the cell renders exactly as before this task.

- [ ] **Step 3: Verify**

```bash
grep -n "teveAvaria\|avariaDescricao\|Houve avaria" index.html
```
Expected: `teveAvaria` appears 3 times (declaration + 2 uses: the `if` check and the `historyRecord` field); `avariaDescricao` appears in `returnKeyLoan` (declaration + assignment inside the `if` + the `historyRecord` field = 3 occurrences there) plus once more inside `renderKeysHistory`'s new line (the `loan.avariaDescricao` read) — 4 total; `Houve avaria` appears once (the confirm string).

Read back the full `window.returnKeyLoan` function and the modified `<td>` template to confirm: (a) the avaria prompt sits after both existing validations and before `historyRecord` is built, (b) `historyRecord` has exactly the two new fields added, nothing else changed, (c) the display line only appears once and stays inside the existing `<td>`.

Manual browser checklist (for the human operator, not the agent):
- Devolver uma chave individualmente, respondendo "Sim" no confirm de avaria e escrevendo uma descrição — confirmar que a linha "⚠️ Avaria" aparece na célula de Devolução do Histórico de Chaves, com a descrição no tooltip (passar o mouse).
- Devolver um controle de ar individualmente respondendo "Não" — confirmar que a célula fica exatamente como antes desta fase (sem nenhum indicador), e que o texto do confirm dizia "Houve avaria no controle de ar?" (não "na chave").
- Devolver uma chave respondendo "Sim" mas deixando a descrição em branco — confirmar que o indicador ainda aparece, com "Sem descrição" no tooltip.
- Usar "Devolver Todas as Chaves" (lote) com pelo menos um item ativo — confirmar que nenhuma pergunta de avaria aparece e que os registros criados não mostram o indicador.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat: capture avaria on individual key/AC return and show it in history

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Edit avaria afterward via the existing history-edit modal

**Files:**
- Modify: `index.html:2436-2448` (`#key-loan-checkout-edit-fields` HTML block inside `#key-loan-modal`)
- Modify: `index.html:2617-2619` area (const declarations for the key-loan modal's checkout-edit fields — add 2 new consts + wire the checkbox listener)
- Modify: `index.html:4553-4561` (the `if (isHistory) { ... } else { ... }` branch inside `window.editKeyLoan` that shows/hides and populates `#key-loan-checkout-edit-fields`)
- Modify: `index.html:4306-4321` (the `if (isHistory)` branch inside `btnSubmitKeyLoan.addEventListener` that saves an edited history record)

**Interfaces:**
- Consumes: the `avaria`/`avariaDescricao` fields Task 1 added to `keyHistory` records.
- Produces: nothing consumed by any later task — this is the last task in this phase (and this project's confirmed roadmap).

- [ ] **Step 1: Add the avaria checkbox + description field to the checkout-edit block**

Current code (verified at `index.html:2436-2448`):
```html
                  <div id="key-loan-checkout-edit-fields" style="display: none; border-top: 1px dashed var(--border-color); padding-top: 15px; margin-top: 15px;">
                      <h4 style="margin-top: 0; color: var(--primary); font-size: 0.95rem; margin-bottom: 12px;">Dados da Devolução</h4>
                      <div class="form-group-grid">
                          <div class="form-group">
                              <label class="form-label" for="key-loan-checkout-resp-cliente">Responsável Cliente (Devolveu)</label>
                              <input type="text" id="key-loan-checkout-resp-cliente" class="input-text" placeholder="Nome de quem devolveu" autocomplete="off">
                          </div>
                          <div class="form-group">
                              <label class="form-label" for="key-loan-checkout-operador-arena">Operador Arena (Recebeu)</label>
                              <input type="text" id="key-loan-checkout-operador-arena" class="input-text" placeholder="Nome do Operador" autocomplete="off">
                          </div>
                      </div>
                  </div>
```
Change to (add the new field block right after the closing `</div>` of `.form-group-grid`, still inside `#key-loan-checkout-edit-fields`):
```html
                  <div id="key-loan-checkout-edit-fields" style="display: none; border-top: 1px dashed var(--border-color); padding-top: 15px; margin-top: 15px;">
                      <h4 style="margin-top: 0; color: var(--primary); font-size: 0.95rem; margin-bottom: 12px;">Dados da Devolução</h4>
                      <div class="form-group-grid">
                          <div class="form-group">
                              <label class="form-label" for="key-loan-checkout-resp-cliente">Responsável Cliente (Devolveu)</label>
                              <input type="text" id="key-loan-checkout-resp-cliente" class="input-text" placeholder="Nome de quem devolveu" autocomplete="off">
                          </div>
                          <div class="form-group">
                              <label class="form-label" for="key-loan-checkout-operador-arena">Operador Arena (Recebeu)</label>
                              <input type="text" id="key-loan-checkout-operador-arena" class="input-text" placeholder="Nome do Operador" autocomplete="off">
                          </div>
                      </div>
                      <div class="form-group" style="margin-top: 12px;">
                          <label class="form-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                              <input type="checkbox" id="key-loan-checkout-avaria">
                              Houve avaria?
                          </label>
                          <textarea id="key-loan-checkout-avaria-desc" class="input-text" rows="2" placeholder="Descreva a avaria (opcional)" style="margin-top: 8px; resize: vertical;" disabled></textarea>
                      </div>
                  </div>
```

- [ ] **Step 2: Add the new DOM consts and the checkbox's enable/disable listener**

Current code (verified at `index.html:2617-2619`):
```javascript
            const keyLoanCheckoutEditFields = document.getElementById('key-loan-checkout-edit-fields');
            const keyLoanCheckoutRespCliente = document.getElementById('key-loan-checkout-resp-cliente');
            const keyLoanCheckoutOperadorArena = document.getElementById('key-loan-checkout-operador-arena');
```
Change to:
```javascript
            const keyLoanCheckoutEditFields = document.getElementById('key-loan-checkout-edit-fields');
            const keyLoanCheckoutRespCliente = document.getElementById('key-loan-checkout-resp-cliente');
            const keyLoanCheckoutOperadorArena = document.getElementById('key-loan-checkout-operador-arena');
            const keyLoanCheckoutAvaria = document.getElementById('key-loan-checkout-avaria');
            const keyLoanCheckoutAvariaDesc = document.getElementById('key-loan-checkout-avaria-desc');

            keyLoanCheckoutAvaria.addEventListener('change', () => {
                keyLoanCheckoutAvariaDesc.disabled = !keyLoanCheckoutAvaria.checked;
                if (!keyLoanCheckoutAvaria.checked) keyLoanCheckoutAvariaDesc.value = '';
            });
```

- [ ] **Step 3: Populate/reset the avaria fields in `window.editKeyLoan`**

Current code (verified at `index.html:4553-4561`):
```javascript
                if (isHistory) {
                    keyLoanCheckoutEditFields.style.display = 'block';
                    keyLoanCheckoutRespCliente.value = loan.checkoutRespCliente || '';
                    keyLoanCheckoutOperadorArena.value = loan.checkoutOperador || '';
                } else {
                    keyLoanCheckoutEditFields.style.display = 'none';
                    keyLoanCheckoutRespCliente.value = '';
                    keyLoanCheckoutOperadorArena.value = '';
                }
```
Change to:
```javascript
                if (isHistory) {
                    keyLoanCheckoutEditFields.style.display = 'block';
                    keyLoanCheckoutRespCliente.value = loan.checkoutRespCliente || '';
                    keyLoanCheckoutOperadorArena.value = loan.checkoutOperador || '';
                    keyLoanCheckoutAvaria.checked = !!loan.avaria;
                    keyLoanCheckoutAvariaDesc.value = loan.avariaDescricao || '';
                    keyLoanCheckoutAvariaDesc.disabled = !loan.avaria;
                } else {
                    keyLoanCheckoutEditFields.style.display = 'none';
                    keyLoanCheckoutRespCliente.value = '';
                    keyLoanCheckoutOperadorArena.value = '';
                    keyLoanCheckoutAvaria.checked = false;
                    keyLoanCheckoutAvariaDesc.value = '';
                    keyLoanCheckoutAvariaDesc.disabled = true;
                }
```

- [ ] **Step 4: Save the avaria fields on submit**

Current code (verified at `index.html:4306-4321`, inside `btnSubmitKeyLoan.addEventListener`'s `if (loanId) { if (isHistory) { ... } }` branch):
```javascript
                    if (isHistory) {
                        // Edit history mode
                        const index = keyHistory.findIndex(h => h.id === loanId);
                        if (index > -1) {
                            const original = keyHistory[index];
                            const isAcEntry = isAcTipo(original);
                            keyHistory[index] = {
                                ...original,
                                ...(isAcEntry ? { qtyAc } : { qtyKey }),
                                checkinRespCliente: respCliente,
                                checkinOperador: operadorArena,
                                checkoutRespCliente: keyLoanCheckoutRespCliente.value.trim(),
                                checkoutOperador: keyLoanCheckoutOperadorArena.value.trim()
                            };
                            syncKeyHistoryUpsert(keyHistory[index]);
                            showToast('Histórico atualizado!', '📝');
                        } else {
                            showToast('Este registro não existe mais (pode ter sido removido em outro dispositivo).', '⚠️');
                        }
                    } else {
```
Change to:
```javascript
                    if (isHistory) {
                        // Edit history mode
                        const index = keyHistory.findIndex(h => h.id === loanId);
                        if (index > -1) {
                            const original = keyHistory[index];
                            const isAcEntry = isAcTipo(original);
                            keyHistory[index] = {
                                ...original,
                                ...(isAcEntry ? { qtyAc } : { qtyKey }),
                                checkinRespCliente: respCliente,
                                checkinOperador: operadorArena,
                                checkoutRespCliente: keyLoanCheckoutRespCliente.value.trim(),
                                checkoutOperador: keyLoanCheckoutOperadorArena.value.trim(),
                                avaria: keyLoanCheckoutAvaria.checked,
                                avariaDescricao: keyLoanCheckoutAvaria.checked ? keyLoanCheckoutAvariaDesc.value.trim() : ''
                            };
                            syncKeyHistoryUpsert(keyHistory[index]);
                            showToast('Histórico atualizado!', '📝');
                        } else {
                            showToast('Este registro não existe mais (pode ter sido removido em outro dispositivo).', '⚠️');
                        }
                    } else {
```
The `else` branch immediately following (edit-active-loan mode, unchanged) must not be touched — `keyLoans` records never get `avaria`/`avariaDescricao`.

- [ ] **Step 5: Verify**

```bash
grep -n "key-loan-checkout-avaria\|keyLoanCheckoutAvaria" index.html
```
Expected: `key-loan-checkout-avaria` (the checkbox id) appears 2 times (HTML + `getElementById`); `key-loan-checkout-avaria-desc` appears 2 times; `keyLoanCheckoutAvaria` (the checkbox const) appears in: 1 declaration, 1 `addEventListener` receiver + 2 reads inside its own listener body, 1 read in `editKeyLoan`'s isHistory branch, 1 reset in the else branch, 2 reads in the submit handler's `keyHistory[index]` object — recount by reading, not by trusting an exact number, since the same identifier is both declared and read multiple times across 4 different code regions.

Read back all 4 touched regions (the HTML block, the const/listener block, `editKeyLoan`'s isHistory/else branches, and the submit handler's isHistory branch) to confirm they agree on field names and that the edit-active-loan (`else`) branches in both `editKeyLoan` and the submit handler remain untouched beyond Step 3's addition.

Manual browser checklist:
- Editar (senha mestre `gl@operacoes`) um registro do Histórico de Chaves que teve avaria (criado via Task 1's flow) — confirmar que o checkbox "Houve avaria?" vem marcado, a descrição pré-preenchida e o campo de texto habilitado.
- Desmarcar o checkbox e salvar — confirmar que o indicador "⚠️ Avaria" desaparece daquele registro na tabela, e que reabrir o mesmo registro para editar mostra o checkbox desmarcado e a descrição vazia.
- Editar um registro do histórico que **não** teve avaria — marcar o checkbox, escrever uma descrição, salvar — confirmar que o indicador passa a aparecer na tabela com a nova descrição no tooltip.
- Editar um empréstimo **ativo** (ainda não devolvido, mesmo modal em modo não-histórico) — confirmar que o bloco inteiro de "Dados da Devolução" (incluindo os novos campos de avaria) fica oculto, e que salvar essa edição não introduz `avaria`/`avariaDescricao` no registro ativo correspondente em `keyLoans`.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat: allow editing avaria on a key/AC history record after the fact

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
