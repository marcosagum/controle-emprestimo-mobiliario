# Fase 1 — Bugs e UX de Chave/Controle de Ar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 8 verified bugs from the code scan and rework the key/AC-control loan data model so AC-control remotes are tracked per event/client instead of being duplicated per room, per the spec at `docs/superpowers/specs/2026-08-06-fase1-bugs-ux-design.md`.

**Architecture:** Single-file vanilla-JS app (`index.html`), no build step, no bundler, no test framework. All logic lives inside one `<script>` block after `DOMContentLoaded`. Firebase Realtime Database is used for cross-device sync; `localStorage` is a local cache written on every mutation. This plan keeps that structure — no framework introduced, no file splitting (out of scope for this phase).

**Tech Stack:** Vanilla JS (ES6+), Firebase 10.8.0 compat SDK (`firebase-app-compat.js`, `firebase-database-compat.js`), `localStorage`, no npm/build tooling.

## Global Constraints

- No automated test framework exists in this project. Every task's verification step is a manual, concrete browser/DevTools-console procedure — run it and confirm the described outcome before moving on.
- Do not introduce a build step, bundler, or external JS framework. All edits stay inside `index.html`.
- Keep Portuguese (pt-BR) strings for all user-facing text (toasts, labels, buttons), matching the existing app's language.
- Every `db.ref(...)` write must keep (or gain) a `.catch(err => console.error(...))` — never let a rejected Firebase write fail silently.
- Master-password-gated actions keep using the existing literal `'gl@operacoes'` check — do not change the auth mechanism (out of scope).
- File edited throughout: `C:\Users\marcos.agum\.gemini\antigravity\scratch\controle-emprestimo-mobiliario\index.html`. Line numbers referenced below are from the pre-Fase-1 version of the file; if earlier tasks in this plan shift line numbers, use the quoted code snippets (not the numbers) to relocate the edit point.

---

### Task 1: Fix main-loan ID collision risk (Bug #8)

**Files:**
- Modify: `index.html` (submit handler for the furniture loan form, `~line 4049`)

**Interfaces:**
- Produces: no new function; only changes the `id` value format for objects pushed into the `loans` array (was `Date.now().toString()`, becomes `Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5)`), matching the format already used by `keyLoans`, `roomInspections`, and photo objects elsewhere in the file.

- [ ] **Step 1: Locate and change the ID generation line**

Find (inside the `submitBtn.addEventListener('click', ...)` handler, "Create loan entry object" block):

```javascript
                    const newLoan = {
                        id: Date.now().toString(),
                        dataHora: new Date().toISOString(),
```

Replace with:

```javascript
                    const newLoan = {
                        id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5),
                        dataHora: new Date().toISOString(),
```

- [ ] **Step 2: Manual verification**

Open `index.html` directly in a browser (double-click or `file://` path). Register two furniture loans back-to-back as fast as possible (same item, mash the submit button twice within the same second). Open DevTools → Application → Local Storage → `arena_mobiliario_loans`, confirm the two entries have **different** `id` values (each ending in a random 5-char suffix, not just a raw timestamp).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "fix: append random suffix to furniture loan id to prevent collisions on rapid double-submit"
```

---

### Task 2: Guard export filtering against missing `item` field (Bug #5)

**Files:**
- Modify: `index.html` (`getFilteredLoansForExport`, `~line 4280`)

**Interfaces:**
- Produces: no signature change; `getFilteredLoansForExport()` becomes crash-safe on records lacking `item`.

- [ ] **Step 1: Add the null guard**

Find:

```javascript
                    const matchesSearch = 
                        !searchQuery ||
                        loan.item.toLowerCase().includes(searchQuery) ||
```

Replace with:

```javascript
                    const matchesSearch = 
                        !searchQuery ||
                        (loan.item || '').toLowerCase().includes(searchQuery) ||
```

- [ ] **Step 2: Manual verification**

Open the app in a browser, open DevTools console, and run:

```javascript
loans.push({id: 'test-broken', dataHora: new Date().toISOString(), quantidade: 1, evento: 'Teste', origem: 'A', destino: 'B', respArena: 'X', respCliente: 'Y', devolvido: false});
saveToLocalStorage();
renderHistory();
```

This pushes a record with no `item` field (simulating a partially-written record). Then type any text into the search box and click "Exportar" — confirm the export modal opens without a console error (previously this would throw `Cannot read properties of undefined (reading 'toLowerCase')`). Afterwards, run `location.reload()` to discard the test record (do not save it back to Firebase).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "fix: guard export filter against loans missing the item field"
```

---

### Task 3: Reset `editingInspectionId` on modal cancel (Bug #2)

**Files:**
- Modify: `index.html` (`btnCloseCheckin` handler `~line 2792`, `btnCloseCheckout` handler `~line 3009`)

**Interfaces:**
- Consumes: existing module-scoped `let editingInspectionId = null;` (declared `~line 2249`).
- Produces: guarantees `editingInspectionId` is `null` whenever both inspection modals are closed, not just on successful submit.

- [ ] **Step 1: Reset the flag when the check-in modal is cancelled**

Find:

```javascript
            btnCloseCheckin.addEventListener('click', () => {
                checkinModal.classList.remove('show');
            });
```

Replace with:

```javascript
            btnCloseCheckin.addEventListener('click', () => {
                editingInspectionId = null;
                checkinModal.classList.remove('show');
            });
```

- [ ] **Step 2: Reset the flag when the check-out modal is cancelled**

Find:

```javascript
            btnCloseCheckout.addEventListener('click', () => {
                checkoutModal.classList.remove('show');
            });
```

Replace with:

```javascript
            btnCloseCheckout.addEventListener('click', () => {
                editingInspectionId = null;
                checkoutModal.classList.remove('show');
            });
```

- [ ] **Step 3: Manual verification — reproduce the original bug scenario, confirm it's fixed**

In the app: go to the "Vistorias" tab. Pick any room that already has a **closed** inspection (or close one first via a normal check-in + check-out). Use "Editar Vistoria" (master password `gl@operacoes`) to open it in edit mode, then click the modal's **Cancelar/Fechar** button (not submit). Now go perform a completely normal check-out on a **different** room that's currently "Em Uso". Confirm: (a) the check-out submits successfully, (b) that other room's status flips to "Disponível" on the grid (not stuck "Em Uso"), and (c) the inspection record updated is the one for the room you just checked out, not the earlier room you cancelled editing on (verify via "Ver Relatório" showing the correct room name).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "fix: reset editingInspectionId on modal cancel to prevent checkout state corruption"
```

---

### Task 4: Split key vs. AC-control loan data model (Part A of spec)

**Files:**
- Modify: `index.html` — modal markup (`~line 1979-2062`), modal open/submit/edit/render logic (`~line 3230-3760`)

**Interfaces:**
- Produces: `keyLoans` and `keyHistory` array entries now carry a `tipo` field: `'chave'` (has `salaId`, `qtyKey`) or `'controle-ar'` (no `salaId`, has `qtyAc`, tied only to `evento`). Existing entries created before this change (which have both `hasKey`/`hasAc` on one record) are read as-is by the render functions — no migration.
- Consumes: existing `predefinedRooms` array (unchanged), existing `keyLoanRoomCheckboxes`/`keyLoanRoomSelect` DOM elements (unchanged), existing `keyLoanChkKey`/`keyLoanChkAc`/`keyLoanQtyKey`/`keyLoanQtyAc` DOM elements (unchanged).

- [ ] **Step 1: Update the create-mode submit logic to emit separate entries per type**

Find the create-mode block inside `btnSubmitKeyLoan.addEventListener('click', ...)`:

```javascript
                } else {
                    // Create mode - loop over selected rooms
                    roomIds.forEach(roomId => {
                        const newLoan = {
                            id: 'key-loan-' + Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5),
                            salaId: roomId,
                            hasKey,
                            qtyKey: hasKey ? qtyKey : 0,
                            hasAc,
                            qtyAc: hasAc ? qtyAc : 0,
                            evento: eventName,
                            checkinRespCliente: respCliente,
                            checkinOperador: operadorArena,
                            checkinDataHora: new Date().toISOString()
                        };
                        keyLoans.push(newLoan);
                    });
                    showToast('Empréstimos registrados!', '🔑');
                }
```

Replace with:

```javascript
                } else {
                    // Create mode - key loans are one entry per selected room;
                    // the AC-control loan is a single entry tied to the event, not to any one room.
                    const nowIso = new Date().toISOString();
                    if (hasKey) {
                        roomIds.forEach(roomId => {
                            keyLoans.push({
                                id: 'key-loan-' + Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5),
                                tipo: 'chave',
                                salaId: roomId,
                                qtyKey,
                                evento: eventName,
                                checkinRespCliente: respCliente,
                                checkinOperador: operadorArena,
                                checkinDataHora: nowIso
                            });
                        });
                    }
                    if (hasAc) {
                        keyLoans.push({
                            id: 'ac-loan-' + Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5),
                            tipo: 'controle-ar',
                            salaId: null,
                            qtyAc,
                            evento: eventName,
                            checkinRespCliente: respCliente,
                            checkinOperador: operadorArena,
                            checkinDataHora: nowIso
                        });
                    }
                    showToast('Empréstimo(s) registrado(s)!', '🔑');
                }
```

- [ ] **Step 2: Update the edit-mode submit logic to preserve `tipo` and stop writing the field that doesn't apply**

Find the edit-mode (history) block:

```javascript
                    if (isHistory) {
                        // Edit history mode
                        const index = keyHistory.findIndex(h => h.id === loanId);
                        if (index > -1) {
                            const original = keyHistory[index];
                            keyHistory[index] = {
                                ...original,
                                hasKey,
                                qtyKey: hasKey ? qtyKey : 0,
                                hasAc,
                                qtyAc: hasAc ? qtyAc : 0,
                                evento: eventName,
                                checkinRespCliente: respCliente,
                                checkinOperador: operadorArena,
                                checkoutRespCliente: keyLoanCheckoutRespCliente.value.trim(),
                                checkoutOperador: keyLoanCheckoutOperadorArena.value.trim()
                            };
                            showToast('Histórico atualizado!', '📝');
                        }
                    } else {
                        // Edit active mode
                        const index = keyLoans.findIndex(l => l.id === loanId);
                        if (index > -1) {
                            const original = keyLoans[index];
                            keyLoans[index] = {
                                ...original,
                                hasKey,
                                qtyKey: hasKey ? qtyKey : 0,
                                hasAc,
                                qtyAc: hasAc ? qtyAc : 0,
                                evento: eventName,
                                checkinRespCliente: respCliente,
                                checkinOperador: operadorArena
                            };
                            showToast('Empréstimo atualizado!', '📝');
                        }
                    }
```

Replace with:

```javascript
                    if (isHistory) {
                        // Edit history mode
                        const index = keyHistory.findIndex(h => h.id === loanId);
                        if (index > -1) {
                            const original = keyHistory[index];
                            const isAcEntry = original.tipo === 'controle-ar';
                            keyHistory[index] = {
                                ...original,
                                qtyKey: isAcEntry ? original.qtyKey : qtyKey,
                                qtyAc: isAcEntry ? qtyAc : original.qtyAc,
                                evento: eventName,
                                checkinRespCliente: respCliente,
                                checkinOperador: operadorArena,
                                checkoutRespCliente: keyLoanCheckoutRespCliente.value.trim(),
                                checkoutOperador: keyLoanCheckoutOperadorArena.value.trim()
                            };
                            showToast('Histórico atualizado!', '📝');
                        } else {
                            showToast('Este registro não existe mais (pode ter sido removido em outro dispositivo).', '⚠️');
                        }
                    } else {
                        // Edit active mode
                        const index = keyLoans.findIndex(l => l.id === loanId);
                        if (index > -1) {
                            const original = keyLoans[index];
                            const isAcEntry = original.tipo === 'controle-ar';
                            keyLoans[index] = {
                                ...original,
                                qtyKey: isAcEntry ? original.qtyKey : qtyKey,
                                qtyAc: isAcEntry ? qtyAc : original.qtyAc,
                                evento: eventName,
                                checkinRespCliente: respCliente,
                                checkinOperador: operadorArena
                            };
                            showToast('Empréstimo atualizado!', '📝');
                        } else {
                            showToast('Este registro não existe mais (pode ter sido removido em outro dispositivo).', '⚠️');
                        }
                    }
```

(This step also implements Bug #6's fix for the key-loan modal — see Task 6 for the checkout-modal equivalent.)

- [ ] **Step 3: Update `editKeyLoan`/edit-open logic to read/write `tipo` instead of `hasKey`/`hasAc`**

Find (around `~line 3520-3535`, the function that populates the modal for editing a single existing entry — search for `keyLoanChkKey.checked = loan.hasKey;`):

```javascript
                keyLoanChkKey.checked = loan.hasKey;
```

Read the surrounding ~10 lines above and below this line in the actual file before editing (this function also sets `keyLoanChkAc.checked`, quantity fields, and container visibility) and change the two checkbox/qty pairs so that for an entry with `tipo === 'chave'`, only the key checkbox+qty are populated and checked (AC checkbox stays unchecked, AC qty container stays hidden); for `tipo === 'controle-ar'`, only the AC checkbox+qty are populated and checked. Also switch the room-select population: `tipo === 'chave'` entries populate `keyLoanRoomSelect` from `loan.salaId` as before; `tipo === 'controle-ar'` entries have no `salaId`, so hide/skip the room-select field for that case (add a check: `if (loan.tipo === 'controle-ar') { keyLoanRoomSelectGroup.style.display = 'none'; } else { keyLoanRoomSelectGroup.style.display = 'block'; ... existing room population logic ...}` — reference the existing `key-loan-room-select-group` element via `document.getElementById('key-loan-room-select-group')`, add that as a new `const keyLoanRoomSelectGroup = document.getElementById('key-loan-room-select-group');` next to the other Key Loan Modal Selectors declared `~line 2151-2171`).

- [ ] **Step 4: Update `renderKeysMural` to show AC-control entries without a room card association**

Find (in `renderKeysMural`, `~line 3594-3663`):

```javascript
                keyLoans.forEach(loan => {
                    const room = predefinedRooms.find(r => r && r.id === loan.salaId);
                    const roomName = room ? room.name : 'Sala';
                    const roomCode = room ? room.code : 'Sala';
```

Replace with:

```javascript
                keyLoans.forEach(loan => {
                    const isAcEntry = loan.tipo === 'controle-ar';
                    const room = predefinedRooms.find(r => r && r.id === loan.salaId);
                    const roomName = isAcEntry ? 'Controle de Ar (Evento)' : (room ? room.name : 'Sala');
                    const roomCode = isAcEntry ? '' : (room ? room.code : 'Sala');
```

Then find the items-summary block just below it:

```javascript
                    let itemsHTML = '';
                    if (loan.hasKey) {
                        itemsHTML += `<div style="display:flex; align-items:center; gap:6px; font-weight:600; color:var(--text-primary); font-size:0.9rem; margin-bottom:4px;">
                            <span>🔑 Chave da Sala (molho com ${loan.qtyKey} un)</span>
                        </div>`;
                    }
                    if (loan.hasAc) {
                        itemsHTML += `<div style="display:flex; align-items:center; gap:6px; font-weight:600; color:var(--text-primary); font-size:0.9rem;">
                            <span>❄️ Controle de Ar (${loan.qtyAc} un)</span>
                        </div>`;
                    }

                    // Determine dynamic return button label
                    let returnBtnText = 'Devolver';
                    if (loan.hasKey && loan.hasAc) {
                        returnBtnText = 'Devolver Chave e Controle';
                    } else if (loan.hasKey) {
                        returnBtnText = 'Devolver Chave';
                    } else if (loan.hasAc) {
                        returnBtnText = 'Devolver Controle';
                    }
```

Replace with:

```javascript
                    let itemsHTML = '';
                    if (!isAcEntry) {
                        itemsHTML += `<div style="display:flex; align-items:center; gap:6px; font-weight:600; color:var(--text-primary); font-size:0.9rem; margin-bottom:4px;">
                            <span>🔑 Chave da Sala (molho com ${loan.qtyKey} un)</span>
                        </div>`;
                    } else {
                        itemsHTML += `<div style="display:flex; align-items:center; gap:6px; font-weight:600; color:var(--text-primary); font-size:0.9rem;">
                            <span>❄️ Controle de Ar (${loan.qtyAc} un)</span>
                        </div>`;
                    }

                    // Determine dynamic return button label
                    const returnBtnText = isAcEntry ? 'Devolver Controle' : 'Devolver Chave';
```

(Backward compatibility note: this replaces the combined-per-room `hasKey && hasAc` label because, going forward, a single `keyLoans` entry is never both at once — that's the whole point of the split. Pre-existing legacy entries that still have `hasKey`/`hasAc` both `true` on one record won't hit this new code path's "both" wording anymore, but they'll still render correctly as a single card showing whichever `itemsHTML` branch matches `loan.tipo` being `undefined` → falls into the `!isAcEntry` branch showing the key line; this is an acceptable minor display simplification for old records per the spec's "no retroactive migration" note.)

- [ ] **Step 5: Update `renderKeysHistory` items-badge logic the same way**

Find (in `renderKeysHistory`, `~line 3692-3699`):

```javascript
                    let itemsHTML = '<div style="display: flex; flex-direction: column; gap: 4px;">';
                    if (loan.hasKey) {
                        itemsHTML += `<span class="status-badge" style="background: rgba(255, 26, 60, 0.1); color: var(--primary); border: 1px solid rgba(255, 26, 60, 0.2); font-size: 0.75rem; padding: 2px 6px; border-radius: 6px; width: fit-content; white-space: nowrap; font-weight: 600;">Chave (${loan.qtyKey} un)</span>`;
                    }
                    if (loan.hasAc) {
                        itemsHTML += `<span class="status-badge" style="background: rgba(16, 185, 129, 0.1); color: var(--success); border: 1px solid rgba(16, 185, 129, 0.2); font-size: 0.75rem; padding: 2px 6px; border-radius: 6px; width: fit-content; white-space: nowrap; font-weight: 600;">Ar (${loan.qtyAc} un)</span>`;
                    }
                    itemsHTML += '</div>';
```

Replace with:

```javascript
                    const isAcEntry = loan.tipo === 'controle-ar';
                    let itemsHTML = '<div style="display: flex; flex-direction: column; gap: 4px;">';
                    if (!isAcEntry) {
                        itemsHTML += `<span class="status-badge" style="background: rgba(255, 26, 60, 0.1); color: var(--primary); border: 1px solid rgba(255, 26, 60, 0.2); font-size: 0.75rem; padding: 2px 6px; border-radius: 6px; width: fit-content; white-space: nowrap; font-weight: 600;">Chave (${loan.qtyKey} un)</span>`;
                    } else {
                        itemsHTML += `<span class="status-badge" style="background: rgba(16, 185, 129, 0.1); color: var(--success); border: 1px solid rgba(16, 185, 129, 0.2); font-size: 0.75rem; padding: 2px 6px; border-radius: 6px; width: fit-content; white-space: nowrap; font-weight: 600;">Ar (${loan.qtyAc} un)</span>`;
                    }
                    itemsHTML += '</div>';
```

Also update the room-name column just above it (`~line 3689-3690`) to show `'Evento'` instead of a room code for AC entries:

```javascript
                    const room = predefinedRooms.find(r => r && r.id === loan.salaId);
                    const roomName = room ? `(${room.code})` : 'Sala';
```

Replace with:

```javascript
                    const room = predefinedRooms.find(r => r && r.id === loan.salaId);
                    const roomName = loan.tipo === 'controle-ar' ? 'Evento' : (room ? `(${room.code})` : 'Sala');
```

- [ ] **Step 6: Manual verification**

Open the app, go to the "Chaves" tab, click "Registrar Empréstimo". Select 3 rooms via the checkboxes, check **both** "Chave de Sala" (qty 1) and "Controle de Ar Condicionado" (qty 2), fill event/names, submit. Confirm in the mural: **3 separate key cards** (one per room, each showing "🔑 Chave da Sala") **plus exactly 1** AC-control card (showing "❄️ Controle de Ar (2 un)", room label "Controle de Ar (Evento)") — not 3 AC cards. Devolver the AC-control card alone and confirm the 3 key cards remain active. Check the history table shows the returned AC entry with room column "Evento".

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: split key and AC-control loans into separate per-sala/per-evento entries"
```

---

### Task 5: Warn on duplicate active key loan for the same room (Bug #7)

**Files:**
- Modify: `index.html` (create-mode block inside `btnSubmitKeyLoan`, edited in Task 4 Step 1)

**Interfaces:**
- Consumes: `keyLoans` array (now with `tipo` field per Task 4), `roomIds` array already computed earlier in the same handler.

- [ ] **Step 1: Add the duplicate check before creating key entries**

Find the validation block (just above where `roomIds.length === 0` is checked, `~line 3300`):

```javascript
                if (roomIds.length === 0) {
                    showToast('Selecione pelo menos uma sala.', '⚠️');
                    return;
                }
```

Replace with:

```javascript
                if (roomIds.length === 0) {
                    showToast('Selecione pelo menos uma sala.', '⚠️');
                    return;
                }
                if (!loanId && hasKey) {
                    const alreadyActive = roomIds.filter(roomId =>
                        keyLoans.some(l => l.tipo === 'chave' && l.salaId === roomId)
                    );
                    if (alreadyActive.length > 0) {
                        const names = alreadyActive
                            .map(id => (predefinedRooms.find(r => r && r.id === id) || {}).name || id)
                            .join(', ');
                        if (!confirm(`Já existe empréstimo de chave ativo para: ${names}. Registrar mesmo assim?`)) {
                            return;
                        }
                    }
                }
```

(Placed after `loanId`/`hasKey`/`roomIds` are already defined earlier in the same handler — `loanId` from `keyLoanEditId.value`, `hasKey` from `keyLoanChkKey.checked`, both read at the top of the handler per the existing code.)

- [ ] **Step 2: Manual verification**

Register a key loan for "Sala T-40" (or any predefined room). Without returning it, open "Registrar Empréstimo" again, select the **same** room and check "Chave de Sala", fill the rest, submit. Confirm a browser `confirm()` dialog appears warning about the existing active loan; clicking Cancel aborts the submit (modal stays open, no duplicate created), clicking OK proceeds and creates the second entry. Register a loan for a **different**, non-duplicated room and confirm no dialog appears.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: warn before registering a duplicate active key loan for the same room"
```

---

### Task 6: Toast feedback on concurrently-deleted checkout record (Bug #6, checkout half)

**Files:**
- Modify: `index.html` (`btnSubmitCheckout` handler, `~line 2924-2929`)

**Interfaces:**
- No signature change; adds user-visible feedback when the target inspection or room no longer exists.

- [ ] **Step 1: Add toast feedback for the two early `return` cases**

Find:

```javascript
                const room = activeRoomsState.find(r => r.id === roomId);
                if (!room) return;

                const targetInspectionId = editingInspectionId || room.currentInspectionId;
                const inspectionIndex = roomInspections.findIndex(i => i.id === targetInspectionId);
                if (inspectionIndex === -1) return;
```

Replace with:

```javascript
                const room = activeRoomsState.find(r => r.id === roomId);
                if (!room) {
                    showToast('Esta sala não existe mais (pode ter sido removida em outro dispositivo).', '⚠️');
                    return;
                }

                const targetInspectionId = editingInspectionId || room.currentInspectionId;
                const inspectionIndex = roomInspections.findIndex(i => i.id === targetInspectionId);
                if (inspectionIndex === -1) {
                    showToast('Esta vistoria não existe mais (pode ter sido removida em outro dispositivo).', '⚠️');
                    return;
                }
```

- [ ] **Step 2: Manual verification**

Open the app in two browser tabs pointed at the same `index.html` (both connect to the same Firebase project). In Tab A, open the check-out modal for an occupied room but don't submit yet. In Tab B, use the master password to delete/reset that same room's state (or, simpler: in Tab B's console, run `activeRoomsState = activeRoomsState.filter(r => r.id !== '<that-room-id>'); saveRoomsToLocalStorage(); renderRoomsGrid();` — using the actual room id shown in Tab A's `checkout-room-id` hidden input). Back in Tab A, fill in the checkout form (name, operator, a photo) and submit. Confirm a toast reading "Esta sala não existe mais..." appears instead of the modal silently closing with no feedback.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "fix: show toast when submitting checkout for a room/inspection removed by another device"
```

---

### Task 7: Per-subtree Firebase seeding (Bug #3)

**Files:**
- Modify: `index.html` (seeding block, `~line 4598-4610`)

**Interfaces:**
- Produces: seeding now checks and fills each of the 5 top-level Firebase paths (`loans`, `keyLoans`, `keyHistory`, `activeRoomsState`, `roomInspections`) independently instead of gating everything behind one `!val` check on the database root.

- [ ] **Step 1: Replace the root-level seeding check with a per-path check**

Find:

```javascript
            // Firebase Seeding and Real-time Synchronization Setup
            db.ref().once('value').then((snapshot) => {
                const val = snapshot.val();
                if (!val) {
                    console.log("Banco de dados vazio no Firebase. Semeando dados locais.");
                    saveRoomsToLocalStorage();
                    saveToLocalStorage();
                }
                setupDatabaseListeners();
            }).catch(err => {
                console.warn("Falha ao inicializar semeadura automática do Firebase. Iniciando escutas diretamente:", err);
                setupDatabaseListeners();
            });
```

Replace with:

```javascript
            // Firebase Seeding and Real-time Synchronization Setup
            db.ref().once('value').then((snapshot) => {
                const val = snapshot.val() || {};
                if (val.loans === undefined) {
                    console.log("Coleção 'loans' vazia no Firebase. Semeando com dados locais.");
                    db.ref('loans').set(loans).catch(err => console.error("Error seeding loans:", err));
                }
                if (val.keyLoans === undefined) {
                    console.log("Coleção 'keyLoans' vazia no Firebase. Semeando com dados locais.");
                    db.ref('keyLoans').set(keyLoans).catch(err => console.error("Error seeding keyLoans:", err));
                }
                if (val.keyHistory === undefined) {
                    console.log("Coleção 'keyHistory' vazia no Firebase. Semeando com dados locais.");
                    db.ref('keyHistory').set(keyHistory).catch(err => console.error("Error seeding keyHistory:", err));
                }
                if (val.activeRoomsState === undefined) {
                    console.log("Coleção 'activeRoomsState' vazia no Firebase. Semeando com dados locais.");
                    db.ref('activeRoomsState').set(activeRoomsState).catch(err => console.error("Error seeding activeRoomsState:", err));
                }
                if (val.roomInspections === undefined) {
                    console.log("Coleção 'roomInspections' vazia no Firebase. Semeando com dados locais.");
                    db.ref('roomInspections').set(roomInspections).catch(err => console.error("Error seeding roomInspections:", err));
                }
                setupDatabaseListeners();
            }).catch(err => {
                console.warn("Falha ao inicializar semeadura automática do Firebase. Iniciando escutas diretamente:", err);
                setupDatabaseListeners();
            });
```

(Note: this task depends on Task 4 being done first only in the sense that `keyLoans`/`keyHistory` now contain `tipo`-tagged entries — the seeding logic itself is agnostic to the entry shape, so ordering relative to Task 4 doesn't matter functionally, but do this task after Task 4 to keep the diff sequence in this plan's order.)

- [ ] **Step 2: Manual verification**

This needs a Firebase Realtime Database console check (the project's Firebase console, under the "Realtime Database" section for this app's project). Before testing, note the current DB content. In DevTools console (with the app open), simulate a partially-migrated DB: `db.ref('roomInspections').remove()` (removes just that one subtree, leaving `loans`/`keyLoans`/etc. intact). Reload the page. Confirm in the Firebase console that `roomInspections` reappears populated with the local device's cached data (not left empty), and confirm in the app UI that the "Vistorias" tab still shows the expected rooms/inspections after reload — i.e., the local cache was NOT wiped out by an incorrectly-triggered full-wipe.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "fix: seed each Firebase collection independently instead of gating on the whole root"
```

---

### Task 8: Sync `predefinedRooms` and `roomInventories` via Firebase (Bug #4)

**Files:**
- Modify: `index.html` (`saveRoomsToLocalStorage`, `~line 2407-2420`; seeding block from Task 7; `setupDatabaseListeners`, `~line 4612-4648`)

**Interfaces:**
- Produces: `predefinedRooms` and `roomInventories` become Firebase-synced collections like the other 5, so room-catalog edits and inventory-quantity drift (written during checkout, `~line 2968-2976`) propagate across devices instead of staying local-only.

- [ ] **Step 1: Add the two new Firebase writes to `saveRoomsToLocalStorage`**

Find:

```javascript
            function saveRoomsToLocalStorage() {
                localStorage.setItem('arena_rooms_state', JSON.stringify(activeRoomsState));
                localStorage.setItem('arena_room_inspections', JSON.stringify(roomInspections));
                localStorage.setItem('arena_predefined_rooms', JSON.stringify(predefinedRooms));
                localStorage.setItem('arena_room_inventories', JSON.stringify(roomInventories));
                localStorage.setItem('arena_key_loans', JSON.stringify(keyLoans));
                localStorage.setItem('arena_key_loans_history', JSON.stringify(keyHistory));

                // Cloud Sync
                db.ref('activeRoomsState').set(activeRoomsState).catch(err => console.error("Error saving activeRoomsState:", err));
                db.ref('roomInspections').set(roomInspections).catch(err => console.error("Error saving roomInspections:", err));
                db.ref('keyLoans').set(keyLoans).catch(err => console.error("Error saving keyLoans:", err));
                db.ref('keyHistory').set(keyHistory).catch(err => console.error("Error saving keyHistory:", err));
            }
```

Replace with:

```javascript
            function saveRoomsToLocalStorage() {
                localStorage.setItem('arena_rooms_state', JSON.stringify(activeRoomsState));
                localStorage.setItem('arena_room_inspections', JSON.stringify(roomInspections));
                localStorage.setItem('arena_predefined_rooms', JSON.stringify(predefinedRooms));
                localStorage.setItem('arena_room_inventories', JSON.stringify(roomInventories));
                localStorage.setItem('arena_key_loans', JSON.stringify(keyLoans));
                localStorage.setItem('arena_key_loans_history', JSON.stringify(keyHistory));

                // Cloud Sync
                db.ref('activeRoomsState').set(activeRoomsState).catch(err => console.error("Error saving activeRoomsState:", err));
                db.ref('roomInspections').set(roomInspections).catch(err => console.error("Error saving roomInspections:", err));
                db.ref('keyLoans').set(keyLoans).catch(err => console.error("Error saving keyLoans:", err));
                db.ref('keyHistory').set(keyHistory).catch(err => console.error("Error saving keyHistory:", err));
                db.ref('predefinedRooms').set(predefinedRooms).catch(err => console.error("Error saving predefinedRooms:", err));
                db.ref('roomInventories').set(roomInventories).catch(err => console.error("Error saving roomInventories:", err));
            }
```

- [ ] **Step 2: Add the two new collections to the seeding block from Task 7**

In the same seeding block edited in Task 7, add two more `if` blocks following the same pattern, inserted right after the `roomInspections` one and before `setupDatabaseListeners();`:

```javascript
                if (val.predefinedRooms === undefined) {
                    console.log("Coleção 'predefinedRooms' vazia no Firebase. Semeando com dados locais.");
                    db.ref('predefinedRooms').set(predefinedRooms).catch(err => console.error("Error seeding predefinedRooms:", err));
                }
                if (val.roomInventories === undefined) {
                    console.log("Coleção 'roomInventories' vazia no Firebase. Semeando com dados locais.");
                    db.ref('roomInventories').set(roomInventories).catch(err => console.error("Error seeding roomInventories:", err));
                }
```

- [ ] **Step 3: Add listeners for the two new collections**

Find the end of `setupDatabaseListeners` (the `roomInspections` listener, immediately before the function's closing `}`):

```javascript
                db.ref('roomInspections').on('value', (snapshot) => {
                    const val = snapshot.val();
                    roomInspections = Array.isArray(val) ? val : [];
                    localStorage.setItem('arena_room_inspections', JSON.stringify(roomInspections));
                    renderRoomsGrid();
                });
            }
```

Replace with:

```javascript
                db.ref('roomInspections').on('value', (snapshot) => {
                    const val = snapshot.val();
                    roomInspections = Array.isArray(val) ? val : [];
                    localStorage.setItem('arena_room_inspections', JSON.stringify(roomInspections));
                    renderRoomsGrid();
                });

                db.ref('predefinedRooms').on('value', (snapshot) => {
                    const val = snapshot.val();
                    if (Array.isArray(val) && val.length > 0) {
                        predefinedRooms = val;
                        localStorage.setItem('arena_predefined_rooms', JSON.stringify(predefinedRooms));
                        renderRoomsGrid();
                    }
                });

                db.ref('roomInventories').on('value', (snapshot) => {
                    const val = snapshot.val();
                    if (val && typeof val === 'object') {
                        roomInventories = val;
                        localStorage.setItem('arena_room_inventories', JSON.stringify(roomInventories));
                    }
                });
            }
```

(The `predefinedRooms` listener guards against an empty/null array so a device that hasn't seeded yet doesn't briefly blank out the room catalog on first load; `roomInventories` is a plain object map keyed by room id, not an array, so its guard checks `typeof val === 'object'` instead of `Array.isArray`.)

- [ ] **Step 4: Manual verification**

Open the app in two browser tabs (two devices simulated), both loaded fresh so both seed from local data. In Tab A, do a checkout on a room that changes an item's quantity from its predefined expected value (e.g., check out with 5 chairs instead of the predefined 6). In Tab B, without reloading, wait a few seconds then start a **new** check-in on that same room — confirm the checklist's "Previsto" quantity for that item now shows 5 (Tab A's drift propagated to Tab B), not the original 6. Before this fix this would have stayed 6 in Tab B until Tab B independently did its own checkout.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: sync predefinedRooms and roomInventories via Firebase instead of localStorage only"
```

---

### Task 9: Convert `loans` collection to granular Firebase writes (Bug #1, part 1 of 3)

**Files:**
- Modify: `index.html` (`saveToLocalStorage`, `~line 3879-3884`; `submitBtn` create/edit branches, `~line 4024-4069`; `deleteLoan`, `~line 3965-3981`; `markAsReturned`, `~line 4099-4112`; `setupDatabaseListeners`'s `loans` listener, `~line 4613-4619`)

**Interfaces:**
- Produces: two new helper functions `syncLoanUpsert(loan)` and `syncLoanRemove(id)`, replacing the single full-array `db.ref('loans').set(loans)` call pattern for this collection. `loans` in-memory stays an array as before; only the Firebase wire format changes from "array" to "object map keyed by id" (`Object.values(val)` conversion happens in the listener).
- Consumes: nothing new — same `loans` array, same `id` field already used everywhere.

- [ ] **Step 1: Replace `saveToLocalStorage` with a localStorage-only function plus two granular sync helpers**

Find:

```javascript
            function saveToLocalStorage() {
                localStorage.setItem('arena_mobiliario_loans', JSON.stringify(loans));
                // Cloud Sync
                db.ref('loans').set(loans).catch(err => console.error("Error saving loans:", err));
            }
```

Replace with:

```javascript
            function saveToLocalStorage() {
                localStorage.setItem('arena_mobiliario_loans', JSON.stringify(loans));
            }

            function syncLoanUpsert(loan) {
                db.ref('loans/' + loan.id).set(loan).catch(err => console.error("Error saving loan:", err));
            }

            function syncLoanRemove(id) {
                db.ref('loans/' + id).remove().catch(err => console.error("Error removing loan:", err));
            }
```

- [ ] **Step 2: Call the granular helpers at each `loans` mutation site**

In `submitBtn`'s edit-mode branch, find:

```javascript
                if (editingLoanId) {
                    // Update existing loan
                    loans = loans.map(loan => {
                        if (loan.id === editingLoanId) {
                            return {
                                ...loan,
                                item: currentItem,
                                quantidade: currentQty,
                                evento: event,
                                origem: origin,
                                destino: destination,
                                respArena: respArena,
                                respCliente: respCliente
                            };
                        }
                        return loan;
                    });
                    saveToLocalStorage();
                    
                    // Reset editing state and form
                    resetForm();
                    showToast('Empréstimo atualizado com sucesso!', '✅');
                } else {
                    // Create loan entry object
                    const newLoan = {
                        id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5),
                        dataHora: new Date().toISOString(),
                        item: currentItem,
                        quantidade: currentQty,
                        evento: event,
                        origem: origin,
                        destino: destination,
                        respArena: respArena,
                        respCliente: respCliente,
                        devolvido: false,
                        dataDevolucao: null
                    };

                    // Add to array, save and update UI
                    loans.unshift(newLoan);
                    saveToLocalStorage();

                    // Clear Form UI
                    resetForm();
                    showToast('Empréstimo registrado com sucesso!', '✅');
                }
```

Replace with:

```javascript
                if (editingLoanId) {
                    // Update existing loan
                    let updatedLoan = null;
                    loans = loans.map(loan => {
                        if (loan.id === editingLoanId) {
                            updatedLoan = {
                                ...loan,
                                item: currentItem,
                                quantidade: currentQty,
                                evento: event,
                                origem: origin,
                                destino: destination,
                                respArena: respArena,
                                respCliente: respCliente
                            };
                            return updatedLoan;
                        }
                        return loan;
                    });
                    saveToLocalStorage();
                    if (updatedLoan) syncLoanUpsert(updatedLoan);
                    
                    // Reset editing state and form
                    resetForm();
                    showToast('Empréstimo atualizado com sucesso!', '✅');
                } else {
                    // Create loan entry object
                    const newLoan = {
                        id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5),
                        dataHora: new Date().toISOString(),
                        item: currentItem,
                        quantidade: currentQty,
                        evento: event,
                        origem: origin,
                        destino: destination,
                        respArena: respArena,
                        respCliente: respCliente,
                        devolvido: false,
                        dataDevolucao: null
                    };

                    // Add to array, save and update UI
                    loans.unshift(newLoan);
                    saveToLocalStorage();
                    syncLoanUpsert(newLoan);

                    // Clear Form UI
                    resetForm();
                    showToast('Empréstimo registrado com sucesso!', '✅');
                }
```

In `deleteLoan`, find:

```javascript
                if (pass === 'gl@operacoes') {
                    loans = loans.filter(l => l.id !== id);
                    saveToLocalStorage();
                    showToast('Registro excluído com sucesso!', '🗑️');
```

Replace with:

```javascript
                if (pass === 'gl@operacoes') {
                    loans = loans.filter(l => l.id !== id);
                    saveToLocalStorage();
                    syncLoanRemove(id);
                    showToast('Registro excluído com sucesso!', '🗑️');
```

In `markAsReturned`, find:

```javascript
            window.markAsReturned = function(id) {
                loans = loans.map(loan => {
                    if (loan.id === id) {
                        return {
                            ...loan,
                            devolvido: true,
                            dataDevolucao: new Date().toISOString()
                        };
                    }
                    return loan;
                });
                saveToLocalStorage();
                showToast('Mobiliário marcado como Devolvido!', '✅');
            };
```

Replace with:

```javascript
            window.markAsReturned = function(id) {
                let updatedLoan = null;
                loans = loans.map(loan => {
                    if (loan.id === id) {
                        updatedLoan = {
                            ...loan,
                            devolvido: true,
                            dataDevolucao: new Date().toISOString()
                        };
                        return updatedLoan;
                    }
                    return loan;
                });
                saveToLocalStorage();
                if (updatedLoan) syncLoanUpsert(updatedLoan);
                showToast('Mobiliário marcado como Devolvido!', '✅');
            };
```

- [ ] **Step 3: Update the `loans` listener to read an object map instead of an array**

Find:

```javascript
                db.ref('loans').on('value', (snapshot) => {
                    const val = snapshot.val();
                    loans = Array.isArray(val) ? val : [];
                    localStorage.setItem('arena_mobiliario_loans', JSON.stringify(loans));
                    renderHistory();
                    updateActiveCounter();
                });
```

Replace with:

```javascript
                db.ref('loans').on('value', (snapshot) => {
                    const val = snapshot.val();
                    loans = val && typeof val === 'object' ? Object.values(val) : (Array.isArray(val) ? val : []);
                    localStorage.setItem('arena_mobiliario_loans', JSON.stringify(loans));
                    renderHistory();
                    updateActiveCounter();
                });
```

(The `Array.isArray(val) ? val : []` fallback inside the ternary keeps this working during the transition, since Task 7's seeding step still does `db.ref('loans').set(loans)` with `loans` as a plain array on first-ever seed for a brand new Firebase project — Firebase stores an array set at a fresh path as an array-like structure, and `Object.values()` on an array also just returns the array's values, so this line is safe either way.)

- [ ] **Step 4: Manual verification**

Open the app in two tabs. In Tab A, register a new furniture loan. Confirm it appears in Tab B within a couple seconds (real-time listener still works). In Tab A, mark a different, pre-existing loan as returned; confirm Tab B updates it too, without any other loans in the list flickering/reordering unexpectedly. Then simulate the original race: in Tab A, open DevTools and pause on a breakpoint isn't practical here, so instead: in Tab A mark loan X as returned; **immediately** (within 1 second) in Tab B register a brand-new unrelated loan Y. After both actions settle (~2s), confirm in **both** tabs that loan X is still marked returned (not reverted) and loan Y exists — this is the scenario that was broken before (Task 1 of the bug list), now fixed because each device only writes its own changed record's path, not the whole array.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "fix: sync loans collection with per-record Firebase writes instead of full-array overwrites"
```

---

### Task 10: Convert `keyLoans` and `keyHistory` collections to granular Firebase writes (Bug #1, part 2 of 3)

**Files:**
- Modify: `index.html` (`saveRoomsToLocalStorage`, edited again here on top of Task 8's version; every `keyLoans`/`keyHistory` mutation site in the key-loan modal submit/edit/return/bulk-return handlers, `~line 3276-3550`; the two listeners for `keyLoans`/`keyHistory` in `setupDatabaseListeners`)

**Interfaces:**
- Produces: `syncKeyLoanUpsert(loan)`, `syncKeyLoanRemove(id)`, `syncKeyHistoryUpsert(record)`, `syncKeyHistoryRemove(id)` helpers, following the same pattern as Task 9.
- Consumes: `keyLoans`/`keyHistory` arrays with `tipo`-tagged entries from Task 4.

- [ ] **Step 1: Strip the full-array Firebase writes out of `saveRoomsToLocalStorage` for these two collections, add four granular helpers**

Find (the version left after Task 8):

```javascript
                // Cloud Sync
                db.ref('activeRoomsState').set(activeRoomsState).catch(err => console.error("Error saving activeRoomsState:", err));
                db.ref('roomInspections').set(roomInspections).catch(err => console.error("Error saving roomInspections:", err));
                db.ref('keyLoans').set(keyLoans).catch(err => console.error("Error saving keyLoans:", err));
                db.ref('keyHistory').set(keyHistory).catch(err => console.error("Error saving keyHistory:", err));
                db.ref('predefinedRooms').set(predefinedRooms).catch(err => console.error("Error saving predefinedRooms:", err));
                db.ref('roomInventories').set(roomInventories).catch(err => console.error("Error saving roomInventories:", err));
            }
```

Replace with:

```javascript
                // Cloud Sync
                db.ref('activeRoomsState').set(activeRoomsState).catch(err => console.error("Error saving activeRoomsState:", err));
                db.ref('roomInspections').set(roomInspections).catch(err => console.error("Error saving roomInspections:", err));
                db.ref('predefinedRooms').set(predefinedRooms).catch(err => console.error("Error saving predefinedRooms:", err));
                db.ref('roomInventories').set(roomInventories).catch(err => console.error("Error saving roomInventories:", err));
            }

            function syncKeyLoanUpsert(loan) {
                db.ref('keyLoans/' + loan.id).set(loan).catch(err => console.error("Error saving key loan:", err));
            }
            function syncKeyLoanRemove(id) {
                db.ref('keyLoans/' + id).remove().catch(err => console.error("Error removing key loan:", err));
            }
            function syncKeyHistoryUpsert(record) {
                db.ref('keyHistory/' + record.id).set(record).catch(err => console.error("Error saving key history:", err));
            }
            function syncKeyHistoryRemove(id) {
                db.ref('keyHistory/' + id).remove().catch(err => console.error("Error removing key history:", err));
            }
```

(`activeRoomsState`/`roomInspections`/`predefinedRooms`/`roomInventories` keep their full-array/full-object sync here — they're addressed in Task 11 and were already granular-enough for `predefinedRooms`/`roomInventories` per Task 8's rarity of concurrent edits; only `keyLoans`/`keyHistory`, the collections with the highest write frequency from the field, are being converted in this task.)

- [ ] **Step 2: Call the granular helpers in `btnSubmitKeyLoan`'s create branch (from Task 4's version)**

Find (the version left after Task 4 Step 1):

```javascript
                } else {
                    // Create mode - key loans are one entry per selected room;
                    // the AC-control loan is a single entry tied to the event, not to any one room.
                    const nowIso = new Date().toISOString();
                    if (hasKey) {
                        roomIds.forEach(roomId => {
                            keyLoans.push({
                                id: 'key-loan-' + Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5),
                                tipo: 'chave',
                                salaId: roomId,
                                qtyKey,
                                evento: eventName,
                                checkinRespCliente: respCliente,
                                checkinOperador: operadorArena,
                                checkinDataHora: nowIso
                            });
                        });
                    }
                    if (hasAc) {
                        keyLoans.push({
                            id: 'ac-loan-' + Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5),
                            tipo: 'controle-ar',
                            salaId: null,
                            qtyAc,
                            evento: eventName,
                            checkinRespCliente: respCliente,
                            checkinOperador: operadorArena,
                            checkinDataHora: nowIso
                        });
                    }
                    showToast('Empréstimo(s) registrado(s)!', '🔑');
                }

                saveRoomsToLocalStorage();
                renderKeysMural();
                renderKeysHistory();
                keyLoanModal.classList.remove('show');
            });
```

Replace with:

```javascript
                } else {
                    // Create mode - key loans are one entry per selected room;
                    // the AC-control loan is a single entry tied to the event, not to any one room.
                    const nowIso = new Date().toISOString();
                    const newEntries = [];
                    if (hasKey) {
                        roomIds.forEach(roomId => {
                            const entry = {
                                id: 'key-loan-' + Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5),
                                tipo: 'chave',
                                salaId: roomId,
                                qtyKey,
                                evento: eventName,
                                checkinRespCliente: respCliente,
                                checkinOperador: operadorArena,
                                checkinDataHora: nowIso
                            };
                            keyLoans.push(entry);
                            newEntries.push(entry);
                        });
                    }
                    if (hasAc) {
                        const acEntry = {
                            id: 'ac-loan-' + Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5),
                            tipo: 'controle-ar',
                            salaId: null,
                            qtyAc,
                            evento: eventName,
                            checkinRespCliente: respCliente,
                            checkinOperador: operadorArena,
                            checkinDataHora: nowIso
                        };
                        keyLoans.push(acEntry);
                        newEntries.push(acEntry);
                    }
                    saveRoomsToLocalStorage();
                    newEntries.forEach(syncKeyLoanUpsert);
                    showToast('Empréstimo(s) registrado(s)!', '🔑');
                    renderKeysMural();
                    renderKeysHistory();
                    keyLoanModal.classList.remove('show');
                    return;
                }

                saveRoomsToLocalStorage();
                renderKeysMural();
                renderKeysHistory();
                keyLoanModal.classList.remove('show');
            });
```

(An early `return` is added at the end of the `else` create-branch so the generic tail `saveRoomsToLocalStorage(); renderKeysMural(); ...` below — which still correctly serves the two `if (loanId)` edit branches — doesn't double-fire for the create path, which now has its own render/close calls right after `syncKeyLoanUpsert`.)

- [ ] **Step 3: Call the granular helpers in the edit-mode branches (from Task 4's version)**

Find (Task 4's Step 2 version):

```javascript
                    if (isHistory) {
                        // Edit history mode
                        const index = keyHistory.findIndex(h => h.id === loanId);
                        if (index > -1) {
                            const original = keyHistory[index];
                            const isAcEntry = original.tipo === 'controle-ar';
                            keyHistory[index] = {
                                ...original,
                                qtyKey: isAcEntry ? original.qtyKey : qtyKey,
                                qtyAc: isAcEntry ? qtyAc : original.qtyAc,
                                evento: eventName,
                                checkinRespCliente: respCliente,
                                checkinOperador: operadorArena,
                                checkoutRespCliente: keyLoanCheckoutRespCliente.value.trim(),
                                checkoutOperador: keyLoanCheckoutOperadorArena.value.trim()
                            };
                            showToast('Histórico atualizado!', '📝');
                        } else {
                            showToast('Este registro não existe mais (pode ter sido removido em outro dispositivo).', '⚠️');
                        }
                    } else {
                        // Edit active mode
                        const index = keyLoans.findIndex(l => l.id === loanId);
                        if (index > -1) {
                            const original = keyLoans[index];
                            const isAcEntry = original.tipo === 'controle-ar';
                            keyLoans[index] = {
                                ...original,
                                qtyKey: isAcEntry ? original.qtyKey : qtyKey,
                                qtyAc: isAcEntry ? qtyAc : original.qtyAc,
                                evento: eventName,
                                checkinRespCliente: respCliente,
                                checkinOperador: operadorArena
                            };
                            showToast('Empréstimo atualizado!', '📝');
                        } else {
                            showToast('Este registro não existe mais (pode ter sido removido em outro dispositivo).', '⚠️');
                        }
                    }
```

Replace with:

```javascript
                    if (isHistory) {
                        // Edit history mode
                        const index = keyHistory.findIndex(h => h.id === loanId);
                        if (index > -1) {
                            const original = keyHistory[index];
                            const isAcEntry = original.tipo === 'controle-ar';
                            keyHistory[index] = {
                                ...original,
                                qtyKey: isAcEntry ? original.qtyKey : qtyKey,
                                qtyAc: isAcEntry ? qtyAc : original.qtyAc,
                                evento: eventName,
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
                        // Edit active mode
                        const index = keyLoans.findIndex(l => l.id === loanId);
                        if (index > -1) {
                            const original = keyLoans[index];
                            const isAcEntry = original.tipo === 'controle-ar';
                            keyLoans[index] = {
                                ...original,
                                qtyKey: isAcEntry ? original.qtyKey : qtyKey,
                                qtyAc: isAcEntry ? qtyAc : original.qtyAc,
                                evento: eventName,
                                checkinRespCliente: respCliente,
                                checkinOperador: operadorArena
                            };
                            syncKeyLoanUpsert(keyLoans[index]);
                            showToast('Empréstimo atualizado!', '📝');
                        } else {
                            showToast('Este registro não existe mais (pode ter sido removido em outro dispositivo).', '⚠️');
                        }
                    }
```

- [ ] **Step 4: Call the granular helpers in `returnKeyLoan` (single return) and `returnAllKeyLoans` (bulk return)**

Find (in `window.returnKeyLoan`):

```javascript
                keyHistory.push(historyRecord);

                // Remove from active
                keyLoans.splice(loanIndex, 1);

                saveRoomsToLocalStorage();
                renderKeysMural();
                renderKeysHistory();
                showToast('Devolução concluída!', '✅');
            };
```

Replace with:

```javascript
                keyHistory.push(historyRecord);

                // Remove from active
                keyLoans.splice(loanIndex, 1);

                saveRoomsToLocalStorage();
                syncKeyHistoryUpsert(historyRecord);
                syncKeyLoanRemove(loan.id);
                renderKeysMural();
                renderKeysHistory();
                showToast('Devolução concluída!', '✅');
            };
```

Read the actual `window.returnAllKeyLoans` body (`~line 3446-3496`) in the file before editing it — it loops `keyLoans.forEach(loan => {...})` building history records and then clears `keyLoans = []` at `~line 3491`. Change that loop to also call `syncKeyHistoryUpsert(historyRecord)` for each record it builds (inside the same `forEach`, right after pushing to `keyHistory`), and after the `keyLoans = []` line, add a loop over the **original** (pre-clear) list of loan ids to call `syncKeyLoanRemove(id)` for each — capture the ids into a local array (e.g. `const clearedIds = keyLoans.map(l => l.id);`) before reassigning `keyLoans = []`, since after that reassignment the original entries are no longer reachable from the `keyLoans` variable.

- [ ] **Step 5: Update the `keyLoans`/`keyHistory` listeners to read object maps**

Find:

```javascript
                db.ref('keyLoans').on('value', (snapshot) => {
                    const val = snapshot.val();
                    keyLoans = Array.isArray(val) ? val : [];
                    localStorage.setItem('arena_key_loans', JSON.stringify(keyLoans));
                    renderKeysMural();
                });

                db.ref('keyHistory').on('value', (snapshot) => {
                    const val = snapshot.val();
                    keyHistory = Array.isArray(val) ? val : [];
                    localStorage.setItem('arena_key_loans_history', JSON.stringify(keyHistory));
                    renderKeysHistory();
                });
```

Replace with:

```javascript
                db.ref('keyLoans').on('value', (snapshot) => {
                    const val = snapshot.val();
                    keyLoans = val && typeof val === 'object' ? Object.values(val) : (Array.isArray(val) ? val : []);
                    localStorage.setItem('arena_key_loans', JSON.stringify(keyLoans));
                    renderKeysMural();
                });

                db.ref('keyHistory').on('value', (snapshot) => {
                    const val = snapshot.val();
                    keyHistory = val && typeof val === 'object' ? Object.values(val) : (Array.isArray(val) ? val : []);
                    localStorage.setItem('arena_key_loans_history', JSON.stringify(keyHistory));
                    renderKeysHistory();
                });
```

- [ ] **Step 6: Manual verification**

Open two tabs. In Tab A register a key loan for one room. Confirm it syncs to Tab B. In Tab A devolver that loan; confirm it moves to history in Tab B too. Repeat the race test from Task 9 Step 4: in Tab A devolver an existing key loan for Room X while, within 1 second, Tab B registers a brand-new key loan for a different Room Y. After settling, confirm both tabs show Room X's loan in history (not reverted to active) and Room Y's new loan present in the mural. Also test bulk return: register 2-3 key loans, use "Devolver Todas as Chaves e Controles" with the master password, confirm all move to history correctly and the mural is empty afterward, in both tabs.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "fix: sync keyLoans and keyHistory collections with per-record Firebase writes"
```

---

### Task 11: Convert `activeRoomsState` and `roomInspections` to granular Firebase writes (Bug #1, part 3 of 3)

**Files:**
- Modify: `index.html` (`saveRoomsToLocalStorage`, final version; check-in submit handler `~line 2740-2790`; check-out submit handler `~line 2906-3007`)

**Interfaces:**
- Produces: `syncRoomStateUpsert(roomState)`, `syncInspectionUpsert(inspection)` helpers. `activeRoomsState` entries are always upserted (never removed — rooms persist as "Disponível", never deleted from the collection during normal flow), so no `Remove` helper is needed for this collection. `roomInspections` entries also only ever get created/updated in the reviewed code paths (no delete flow exists for inspections), so likewise no `Remove` helper needed here.

- [ ] **Step 1: Strip the full-array writes for these two collections out of `saveRoomsToLocalStorage`, add the two granular helpers**

Find (the version left after Task 10):

```javascript
                // Cloud Sync
                db.ref('activeRoomsState').set(activeRoomsState).catch(err => console.error("Error saving activeRoomsState:", err));
                db.ref('roomInspections').set(roomInspections).catch(err => console.error("Error saving roomInspections:", err));
                db.ref('predefinedRooms').set(predefinedRooms).catch(err => console.error("Error saving predefinedRooms:", err));
                db.ref('roomInventories').set(roomInventories).catch(err => console.error("Error saving roomInventories:", err));
            }
```

Replace with:

```javascript
                // Cloud Sync
                db.ref('predefinedRooms').set(predefinedRooms).catch(err => console.error("Error saving predefinedRooms:", err));
                db.ref('roomInventories').set(roomInventories).catch(err => console.error("Error saving roomInventories:", err));
            }

            function syncRoomStateUpsert(roomState) {
                db.ref('activeRoomsState/' + roomState.id).set(roomState).catch(err => console.error("Error saving room state:", err));
            }
            function syncInspectionUpsert(inspection) {
                db.ref('roomInspections/' + inspection.id).set(inspection).catch(err => console.error("Error saving inspection:", err));
            }
```

- [ ] **Step 2: Call the granular helpers in the check-in submit handler**

Read the actual check-in submit handler body (`~line 2740-2790`, ending at the `btnCloseCheckin` listener you already touched in Task 3) before editing — it builds `roomStateObj`, either updates `activeRoomsState[existingActiveIndex]` or pushes it, pushes/updates a `roomInspections` entry (the inspection object being created for the check-in), then calls `saveRoomsToLocalStorage(); renderRoomsGrid(); checkinModal.classList.remove('show');`. Add `syncRoomStateUpsert(roomStateObj)` and `syncInspectionUpsert(<the inspection object variable used in that handler>)` calls right after `saveRoomsToLocalStorage()` and before `renderRoomsGrid()`, using the exact local variable names already present in that function (do not rename them).

- [ ] **Step 3: Call the granular helpers in the check-out submit handler**

Find:

```javascript
                if (editingInspectionId) {
                    editingInspectionId = null;
                    showToast('Vistoria de check-out atualizada com sucesso!', '📝');
                } else {
                    // Revert room state to available
                    activeRoomsState = activeRoomsState.map(r => {
                        if (r.id === roomId) {
                            return {
                                ...r,
                                statusSala: 'Disponível',
                                currentInspectionId: null
                            };
                        }
                        return r;
                    });

                    if (hasDivergencies) {
                        showToast('Vistoria concluída! Divergências encontradas no inventário.', '⚠️');
                    } else {
                        showToast('Vistoria de check-out finalizada com sucesso!', '✅');
                    }
                }

                saveRoomsToLocalStorage();
                renderRoomsGrid();
                checkoutModal.classList.remove('show');

                // Instantly open comparison modal to show summary report
                viewInspectionReport(inspection.id);
            });
```

Replace with:

```javascript
                let updatedRoomState = null;
                if (editingInspectionId) {
                    editingInspectionId = null;
                    showToast('Vistoria de check-out atualizada com sucesso!', '📝');
                } else {
                    // Revert room state to available
                    activeRoomsState = activeRoomsState.map(r => {
                        if (r.id === roomId) {
                            updatedRoomState = {
                                ...r,
                                statusSala: 'Disponível',
                                currentInspectionId: null
                            };
                            return updatedRoomState;
                        }
                        return r;
                    });

                    if (hasDivergencies) {
                        showToast('Vistoria concluída! Divergências encontradas no inventário.', '⚠️');
                    } else {
                        showToast('Vistoria de check-out finalizada com sucesso!', '✅');
                    }
                }

                saveRoomsToLocalStorage();
                syncInspectionUpsert(roomInspections[inspectionIndex]);
                if (updatedRoomState) syncRoomStateUpsert(updatedRoomState);
                renderRoomsGrid();
                checkoutModal.classList.remove('show');

                // Instantly open comparison modal to show summary report
                viewInspectionReport(inspection.id);
            });
```

- [ ] **Step 4: Update the `activeRoomsState`/`roomInspections` listeners to read object maps**

Find:

```javascript
                db.ref('activeRoomsState').on('value', (snapshot) => {
                    const val = snapshot.val();
                    activeRoomsState = Array.isArray(val) ? val : [];
                    localStorage.setItem('arena_rooms_state', JSON.stringify(activeRoomsState));
                    renderRoomsGrid();
                });

                db.ref('roomInspections').on('value', (snapshot) => {
                    const val = snapshot.val();
                    roomInspections = Array.isArray(val) ? val : [];
                    localStorage.setItem('arena_room_inspections', JSON.stringify(roomInspections));
                    renderRoomsGrid();
                });
```

Replace with:

```javascript
                db.ref('activeRoomsState').on('value', (snapshot) => {
                    const val = snapshot.val();
                    activeRoomsState = val && typeof val === 'object' ? Object.values(val) : (Array.isArray(val) ? val : []);
                    localStorage.setItem('arena_rooms_state', JSON.stringify(activeRoomsState));
                    renderRoomsGrid();
                });

                db.ref('roomInspections').on('value', (snapshot) => {
                    const val = snapshot.val();
                    roomInspections = val && typeof val === 'object' ? Object.values(val) : (Array.isArray(val) ? val : []);
                    localStorage.setItem('arena_room_inspections', JSON.stringify(roomInspections));
                    renderRoomsGrid();
                });
```

- [ ] **Step 5: Manual verification**

Open two tabs. In Tab A do a full check-in on an available room. Confirm the room shows "Em Uso" in Tab B within a couple seconds. In Tab A do the checkout for that room. Confirm Tab B shows it back as "Disponível". Race test: in Tab A start and submit a check-in for Room X; within 1 second, in Tab B do a checkout on a **different**, already-occupied Room Y. After settling, confirm in both tabs: Room X shows "Em Uso" (not reverted to "Disponível") and Room Y shows "Disponível" (not stuck "Em Uso") — both changes survived instead of one clobbering the other's full-array write.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "fix: sync activeRoomsState and roomInspections collections with per-record Firebase writes"
```

---

## Post-plan check

After Task 11, re-read the spec's "Testes" section and confirm each scenario listed there was covered by a task's manual verification step above: multi-device race conditions (Tasks 9, 10, 11), inspection-edit-cancel then unrelated checkout (Task 3), key+AC multi-room registration (Task 4), export with a record missing `item` (Task 2). All four are covered.
