# Fase 4 — Correção de Bugs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 12 real defects found in a full-system audit of `index.html`, spanning room inspections, key/AC control, furniture-loan exports, and photo capture.

**Architecture:** All changes are inline edits to the single existing `index.html` file (no build tooling, no new files), inside the existing `DOMContentLoaded` handler and its nested functions. Each of the 11 tasks below is an independent, surgical fix — no task depends on another task's code (though several touch the same functional area).

**Tech Stack:** Vanilla JS, Firebase Realtime Database (compat SDK 10.8.0), no build tooling, no test framework.

## Global Constraints

- Spec source of truth: `docs/superpowers/specs/2026-08-17-fase4-correcao-bugs-design.md`.
- No automated test suite and no browser access for implementers/reviewers in this environment (same limitation as Fases 1-3). Verification is code-level — grep for the inserted snippet, confirm brace/paren balance around edited blocks, confirm no other call site was missed — plus the manual browser steps listed per task, which the human operator runs afterward. Do not claim a task is "tested" beyond what code-level tracing can actually confirm.
- Follow existing code conventions exactly: 12-space (or deeper, matching nesting) indentation inside the `<script>` block, template-literal HTML strings for dynamically rendered rows, reuse of existing CSS classes (`.comparison-table`/`.comparison-table-wrapper` for any new table) rather than inventing new table styles.
- Master password `gl@operacoes` is not touched by this phase — no task in this plan changes any password-gated flow's password requirement.
- Race-condition fix (Task 1) is detect-and-warn, not a real lock — there is no backend to enforce mutual exclusion, so the fix only prevents *silently* overwriting another device's in-progress work; it cannot make the race physically impossible.
- Genuinely ambiguous legacy key/AC records (both `hasKey`/`hasAc` true, or neither) fall back to `'chave'` by design (Task 6) — this matches today's silent default and is an intentional, accepted limitation, not a gap to fix in this phase.

---

## File Structure

Single file, `index.html`. No new files. Task 2 adds one new HTML section (inside the existing `#panel-inspections` panel), one new render function, and one new hoisted DOM const — everything else is a localized edit to existing functions/listeners.

## Task 1: Race-guard on check-in submit

**Files:**
- Modify: `index.html` (script only, inside `btnSubmitCheckin`'s new-inspection branch)

**Interfaces:**
- No new functions produced or consumed. Purely additive validation inside an existing handler.

- [ ] **Step 1: Add the re-validation check**

In `index.html`, the new-inspection branch of `btnSubmitCheckin`'s handler currently reads:

```js
                } else {
                    const inspectionId = 'insp-' + Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5);
                    const newInspection = {
                        id: inspectionId,
                        salaId: roomId,
                        evento: eventName,
                        checkinDataHora: new Date().toISOString(),
                        checkinRespCliente: respCliente,
                        checkinOperador: operadorArena,
                        checkoutDataHora: null,
                        checkoutRespCliente: null,
                        checkoutOperador: null,
                        status: 'Aberto',
                        checklist: checklist,
                        photosCheckin: checkinPhotosList,
                        photosCheckout: []
                    };

                    // Add to list of inspections
                    roomInspections.push(newInspection);
                    inspectionToSync = newInspection;
```

Insert a re-validation check right after the `} else {` line, before `const inspectionId = ...`:

```js
                } else {
                    const alreadyOccupied = activeRoomsState.find(r => r.id === roomId && r.statusSala === 'Em Uso');
                    if (alreadyOccupied) {
                        showToast('Esta sala já foi ocupada por outro dispositivo. Feche este check-in e tente novamente.', '⚠️');
                        return;
                    }

                    const inspectionId = 'insp-' + Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5);
                    const newInspection = {
                        id: inspectionId,
                        salaId: roomId,
                        evento: eventName,
                        checkinDataHora: new Date().toISOString(),
                        checkinRespCliente: respCliente,
                        checkinOperador: operadorArena,
                        checkoutDataHora: null,
                        checkoutRespCliente: null,
                        checkoutOperador: null,
                        status: 'Aberto',
                        checklist: checklist,
                        photosCheckin: checkinPhotosList,
                        photosCheckout: []
                    };

                    // Add to list of inspections
                    roomInspections.push(newInspection);
                    inspectionToSync = newInspection;
```

This check only applies to the **new-inspection** branch (the `else` of `if (editingInspectionId)`) — editing an in-progress check-in you already started is unaffected, since `editingInspectionId` being set means you're not creating a new occupancy record for the room.

- [ ] **Step 2: Verify**

Code-level checks:
- Grep for `alreadyOccupied` — exactly one match.
- Confirm the new block sits between `} else {` and `const inspectionId =`, with correct brace/paren balance for the whole `btnSubmitCheckin` handler (count `{`/`}` before and after your edit — they must match).
- Confirm the `if (editingInspectionId)` branch (the check-in **edit** path, earlier in the same handler) was not touched.

Manual verification:
- Open two browser tabs/devices. In both, click "Nova Vistoria" and pick the same room. Submit in the first tab — succeeds normally. Submit in the second tab (without reloading) — should show the new warning toast and NOT create a second inspection or overwrite the room's active state.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "fix: re-validate room availability before creating a check-in to prevent silent overwrite"
```

## Task 2: Histórico de Vistorias section

**Files:**
- Modify: `index.html` (HTML + script)

**Interfaces:**
- Produces: `renderInspectionsHistory()` — no arguments, no return value. Called from every existing call site of `renderRoomsGrid()` (see Step 4) so the two stay in sync.
- Consumes: `roomInspections` (existing state array), `predefinedRooms` (existing state array), `formatDate` (existing helper), `window.viewInspectionReport` (existing global function, unchanged, reused as-is for the "Ver Relatório" button).

- [ ] **Step 1: Add the HTML section**

In `index.html`, the rooms panel currently ends like this:

```html
                    <!-- Grid de Salas -->
                    <div class="rooms-grid" id="rooms-list-grid">
                        <!-- Rendered Dynamically via JS -->
                    </div>
                </section>
            </div>

            <div id="panel-keys" style="display: none;">
```

Insert a new section between the closing `</section>` and the closing `</div>` of `#panel-inspections`:

```html
                    <!-- Grid de Salas -->
                    <div class="rooms-grid" id="rooms-list-grid">
                        <!-- Rendered Dynamically via JS -->
                    </div>
                </section>

                <!-- Histórico de Vistorias -->
                <section class="section-card" style="margin-top: 20px;">
                    <h2 class="section-title" style="margin-bottom: 15px;">Histórico de Vistorias</h2>
                    <div class="comparison-table-wrapper">
                        <table class="comparison-table">
                            <thead>
                                <tr>
                                    <th>Sala</th>
                                    <th>Evento</th>
                                    <th>Check-in</th>
                                    <th>Check-out</th>
                                    <th>Status</th>
                                    <th>Relatório</th>
                                </tr>
                            </thead>
                            <tbody id="inspections-history-table-body">
                                <!-- Rendered Dynamically via JS -->
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            <div id="panel-keys" style="display: none;">
```

`.comparison-table`/`.comparison-table-wrapper` are existing CSS classes already used elsewhere in this file (the comparison report and the Fase 3 audit-log modal) — no new CSS is added by this task.

- [ ] **Step 2: Add the hoisted DOM const**

In `index.html`, the Room Inspection Selectors section currently reads:

```js
            // Room Inspection Selectors
            const roomsListGrid = document.getElementById('rooms-list-grid');
```

Add the new const right after it:

```js
            // Room Inspection Selectors
            const roomsListGrid = document.getElementById('rooms-list-grid');
            const inspectionsHistoryTableBody = document.getElementById('inspections-history-table-body');
```

- [ ] **Step 3: Add the `renderInspectionsHistory` function**

In `index.html`, right after the closing brace of `function renderRoomsGrid() { ... }` (search for the function and find where it ends — the closing `}` immediately precedes the check-in selectors comment block), add:

```js
            function renderInspectionsHistory() {
                if (!inspectionsHistoryTableBody) return;
                const closed = roomInspections.filter(i => i.status !== 'Aberto');
                if (closed.length === 0) {
                    inspectionsHistoryTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-secondary);">Nenhuma vistoria concluída ainda.</td></tr>';
                    return;
                }
                const sorted = closed.slice().sort((a, b) => new Date(b.checkoutDataHora) - new Date(a.checkoutDataHora));
                inspectionsHistoryTableBody.innerHTML = sorted.map(insp => {
                    const room = predefinedRooms.find(r => r && r.id === insp.salaId);
                    const roomLabel = room ? `${room.name} (${room.code})` : (insp.salaId || '-');
                    return `
                        <tr>
                            <td>${roomLabel}</td>
                            <td>${insp.evento || '-'}</td>
                            <td>${formatDate(insp.checkinDataHora)}</td>
                            <td>${formatDate(insp.checkoutDataHora)}</td>
                            <td>${insp.status}</td>
                            <td style="text-align:center;">
                                <button type="button" class="card-action-icon-btn" onclick="viewInspectionReport('${insp.id}')" title="Ver Relatório">📋</button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
```

`formatDate` already handles `null`/invalid dates by returning `'-'` (see its definition elsewhere in the file), so no separate null-check is needed for `insp.checkoutDataHora`.

- [ ] **Step 4: Call `renderInspectionsHistory()` everywhere `renderRoomsGrid()` is called**

There are 7 existing call sites of `renderRoomsGrid();` in `index.html`. At each one, add `renderInspectionsHistory();` immediately after it. Find each occurrence with a search for `renderRoomsGrid();` and add the line right after — for example, the tab-switch handler currently reads:

```js
            tabInspections.addEventListener('click', () => {
                tabInspections.classList.add('active');
                tabLoans.classList.remove('active');
                tabKeys.classList.remove('active');
                panelLoans.style.display = 'none';
                panelInspections.style.display = 'block';
                panelKeys.style.display = 'none';
                renderRoomsGrid();
            });
```

becomes:

```js
            tabInspections.addEventListener('click', () => {
                tabInspections.classList.add('active');
                tabLoans.classList.remove('active');
                tabKeys.classList.remove('active');
                panelLoans.style.display = 'none';
                panelInspections.style.display = 'block';
                panelKeys.style.display = 'none';
                renderRoomsGrid();
                renderInspectionsHistory();
            });
```

Apply the identical pattern (add `renderInspectionsHistory();` on the line directly after `renderRoomsGrid();`) at every other call site: inside `window.archiveRoomCard`, inside the check-in submit handler's end (after `renderRoomsGrid();` near `checkinModal.classList.remove('show');`), inside the checkout submit handler's end (near `checkoutModal.classList.remove('show');`), and inside the three Firebase listeners in `setupDatabaseListeners()` that call `renderRoomsGrid()` (the `activeRoomsState` listener, the `roomInspections` listener, and the `predefinedRooms` listener). That's 7 call sites total — confirm the count via Step 5's grep before committing.

- [ ] **Step 5: Verify**

Code-level checks:
- Grep for `renderRoomsGrid();` — count the matches (should be 7 as of this plan being written; if the implementer's grep finds a different count, add `renderInspectionsHistory();` after every one of them, not just 7).
- Grep for `renderInspectionsHistory();` (the call, not the definition) — must match the same count as `renderRoomsGrid();` from the check above.
- Grep for `inspections-history-table-body` — exactly 2 matches (the HTML `id` attribute and the JS `getElementById` call).
- Confirm brace/paren balance around the new function and the new HTML block.

Manual verification:
- Complete a check-in and check-out cycle for a room. Open the "Controle de check-in e check-out de salas" tab and confirm the new "Histórico de Vistorias" table shows the closed inspection with correct room/evento/datas/status.
- Click "📋 Ver Relatório" in the history table and confirm the existing comparison-report modal opens with the correct data.
- Click "Remover Card da Tela" on that room's active card (if still shown) and confirm the inspection **remains visible** in the Histórico de Vistorias table afterward (this is the bug being fixed — previously it became inaccessible).

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add Histórico de Vistorias section so archived inspections stay accessible"
```

## Task 3: Freeze the "Previsto" baseline on checkout

**Files:**
- Modify: `index.html` (script only)

**Interfaces:**
- No new functions. Removes one existing block and one existing call site.

- [ ] **Step 1: Remove the `expectedQty` overwrite block**

In `index.html`, inside `btnSubmitCheckout`'s handler, the following block currently exists right after the inspection object is updated:

```js
                // Checklist propagation: update roomInventories config with actual checkoutQty
                if (roomInventories[room.id]) {
                    roomInventories[room.id] = roomInventories[room.id].map(item => {
                        const checkedOutItem = updatedChecklist.find(ci => ci.mobiliarioId === item.mobiliarioId);
                        return {
                            ...item,
                            expectedQty: checkedOutItem ? checkedOutItem.checkoutQty : item.expectedQty
                        };
                    });
                }

                let updatedRoomState = null;
```

Delete the whole `// Checklist propagation...` block (the `if (roomInventories[room.id]) { ... }` statement and its comment), leaving:

```js
                let updatedRoomState = null;
```

directly after the inspection-object update block that precedes it.

- [ ] **Step 2: Remove the now-pointless sync call**

In `index.html`, later in the same handler:

```js
                saveRoomsToLocalStorage();
                syncInspectionUpsert(roomInspections[inspectionIndex]);
                if (updatedRoomState) syncRoomStateUpsert(updatedRoomState);
                if (roomInventories[room.id]) syncInventoryUpsert(room.id, roomInventories[room.id]);
                renderRoomsGrid();
                checkoutModal.classList.remove('show');
```

Remove the `if (roomInventories[room.id]) syncInventoryUpsert(room.id, roomInventories[room.id]);` line — `roomInventories` is no longer mutated by this handler, so there's nothing new to sync:

```js
                saveRoomsToLocalStorage();
                syncInspectionUpsert(roomInspections[inspectionIndex]);
                if (updatedRoomState) syncRoomStateUpsert(updatedRoomState);
                renderRoomsGrid();
                checkoutModal.classList.remove('show');
```

Leave the `syncInventoryUpsert` function definition itself untouched (it becomes unused after this task, which is expected and acceptable — it's not dead in the sense of being unreachable, it's just no longer called anywhere in this version; don't delete the function definition, that's out of scope for this task).

- [ ] **Step 3: Verify**

Code-level checks:
- Grep for `expectedQty: checkedOutItem` — zero matches (the overwrite block is gone).
- Grep for `syncInventoryUpsert` — exactly 2 matches remaining (the function definition and the comment referencing it near `roomInventories`' declaration), down from 3 before this change.
- Confirm brace/paren balance around the edited handler.
- Confirm `roomInventories[roomId]` is still read (not written) at `updateCheckinChecklist` (used to populate the "Previsto" label and default check-in quantities) — this task must not touch that read path.

Manual verification:
- Check out a room with fewer items than the catalog's expected quantity (e.g. catalog says 4 chairs, only checkout 2). Start a new check-in for the same room afterward and confirm "Previsto" still shows the original catalog value (4), not the reduced value (2).
- Confirm the comparison report for that checkout still correctly flags the divergence (2 vs 4) — this task doesn't touch the divergence-detection logic (`hasDivergencies`), only the `roomInventories` write.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "fix: stop overwriting the room inventory baseline with each checkout's observed count"
```

## Task 4: Clear check-in photos when the room selection changes

**Files:**
- Modify: `index.html` (script only)

**Interfaces:**
- No new functions. Modifies one existing listener.

- [ ] **Step 1: Clear photos in the room-change listener**

In `index.html`:

```js
            // Update checkin checklist dynamically based on selected option
            checkinRoomSelect.addEventListener('change', (e) => {
                updateCheckinChecklist(e.target.value);
            });
```

Replace with:

```js
            // Update checkin checklist dynamically based on selected option
            checkinRoomSelect.addEventListener('change', (e) => {
                if (checkinPhotosList.length > 0) {
                    checkinPhotosList = [];
                    checkinPhotosThumbnails.innerHTML = '';
                    showToast('Sala alterada — fotos anexadas foram removidas, anexe novamente.', '⚠️');
                }
                updateCheckinChecklist(e.target.value);
            });
```

The toast only fires when there were photos to clear, so switching rooms before attaching anything stays silent.

- [ ] **Step 2: Verify**

Code-level checks:
- Grep for `Sala alterada` — exactly one match.
- Confirm the `if (checkinPhotosList.length > 0)` block runs before `updateCheckinChecklist(e.target.value)`, not after.
- Confirm no other listener (e.g. `checkoutRoomIdInput` or any checkout equivalent) was touched — this task is check-in-only, since checkout doesn't have a room-select dropdown (the room is fixed once checkout starts).

Manual verification:
- Start a new check-in, attach a photo, then change the selected room in the dropdown. Confirm the photo thumbnail disappears and the warning toast appears. Confirm switching rooms with zero photos attached shows no toast.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "fix: clear attached check-in photos when the selected room changes"
```

## Task 5: Conditional toast on check-in edit when the record is gone

**Files:**
- Modify: `index.html` (script only)

**Interfaces:**
- No new functions. Modifies one existing branch.

- [ ] **Step 1: Guard the success toast behind the existence check**

In `index.html`, the `if (editingInspectionId)` branch of `btnSubmitCheckin`'s handler currently reads:

```js
                if (editingInspectionId) {
                    // Update existing inspection
                    const inspectionIndex = roomInspections.findIndex(i => i.id === editingInspectionId);
                    if (inspectionIndex > -1) {
                        const originalInspection = roomInspections[inspectionIndex];
                        roomInspections[inspectionIndex] = {
                            ...originalInspection,
                            evento: eventName,
                            checkinRespCliente: respCliente,
                            checkinOperador: operadorArena,
                            checklist: checklist.map(newItem => {
                                const oldItem = originalInspection.checklist.find(oi => oi.mobiliarioId === newItem.mobiliarioId);
                                if (oldItem) {
                                    return {
                                        ...newItem,
                                        checkoutQty: oldItem.checkoutQty,
                                        checkoutState: oldItem.checkoutState,
                                        observacoes: oldItem.observacoes
                                    };
                                }
                                return newItem;
                            }),
                            photosCheckin: checkinPhotosList
                        };
                        inspectionToSync = roomInspections[inspectionIndex];
                    }
                    editingInspectionId = null;
                    showToast('Check-in atualizado com sucesso!', '📝');
                } else {
```

Replace with:

```js
                if (editingInspectionId) {
                    // Update existing inspection
                    const inspectionIndex = roomInspections.findIndex(i => i.id === editingInspectionId);
                    if (inspectionIndex > -1) {
                        const originalInspection = roomInspections[inspectionIndex];
                        roomInspections[inspectionIndex] = {
                            ...originalInspection,
                            evento: eventName,
                            checkinRespCliente: respCliente,
                            checkinOperador: operadorArena,
                            checklist: checklist.map(newItem => {
                                const oldItem = originalInspection.checklist.find(oi => oi.mobiliarioId === newItem.mobiliarioId);
                                if (oldItem) {
                                    return {
                                        ...newItem,
                                        checkoutQty: oldItem.checkoutQty,
                                        checkoutState: oldItem.checkoutState,
                                        observacoes: oldItem.observacoes
                                    };
                                }
                                return newItem;
                            }),
                            photosCheckin: checkinPhotosList
                        };
                        inspectionToSync = roomInspections[inspectionIndex];
                        editingInspectionId = null;
                        showToast('Check-in atualizado com sucesso!', '📝');
                    } else {
                        editingInspectionId = null;
                        showToast('Esta vistoria não existe mais (pode ter sido removida em outro dispositivo).', '⚠️');
                        return;
                    }
                } else {
```

The `return` in the new `else` branch prevents the handler from falling through to `saveRoomsToLocalStorage(); if (inspectionToSync) syncInspectionUpsert(inspectionToSync); ...` at the end of the function — though `inspectionToSync` would stay `null` and those calls would be harmless no-ops anyway, the early `return` also skips `renderRoomsGrid()`/`checkinModal.classList.remove('show')`, matching how the checkout handler's equivalent guard (`index.html:3133-3136`) already behaves, so the modal stays open with the stale data visible rather than silently closing.

- [ ] **Step 2: Verify**

Code-level checks:
- Grep for `Esta vistoria não existe mais` — should now match 2 occurrences (the pre-existing one in the checkout handler, and this new one in the check-in handler).
- Confirm the new `else` branch's `return` is inside the `if (editingInspectionId)` block, not accidentally closing over the outer function early for the `else` (new-inspection) branch too — re-read the full `if/else if/else` structure after editing to confirm indentation and brace nesting are correct.

Manual verification:
- Start editing a check-in, then (from Firebase console or another device) delete that inspection record. Submit the edit form. Confirm the "não existe mais" warning appears instead of "atualizado com sucesso", and the modal stays open rather than closing.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "fix: show accurate feedback when editing a check-in whose record was removed elsewhere"
```

## Task 6: `isAcTipo` helper for legacy key/AC records

**Files:**
- Modify: `index.html` (script only)

**Interfaces:**
- Produces: `isAcTipo(rec)` → `boolean`. Used at 8 call sites within this same task (no other task depends on it).

- [ ] **Step 1: Add the helper function**

In `index.html`, right after `backfillKeyTipo`'s definition (search for `function backfillKeyTipo`, and its closing `}`), add:

```js
            // Resolves whether a key/AC record is an AC-control entry, falling back to the
            // legacy hasKey/hasAc flags for records that predate the `tipo` field and were
            // never migrated (see backfillKeyTipo above — genuinely ambiguous records, with
            // both flags true or neither, fall back to `false`/chave, matching today's
            // silent default; this is a deliberate, low-stakes choice given how rare an
            // untyped-and-ambiguous record is).
            function isAcTipo(rec) {
                return rec.tipo ? rec.tipo === 'controle-ar' : !!rec.hasAc && !rec.hasKey;
            }
```

- [ ] **Step 2: Replace every direct `tipo === 'controle-ar'` comparison**

Search for `.tipo === 'controle-ar'` across `index.html`. As of this plan being written there are 8 occurrences (the implementer's grep is the source of truth — if the count differs, replace every one found, not just 8):

1. In the key-loan submit handler's "edit history" branch: `const isAcEntry = original.tipo === 'controle-ar';` → `const isAcEntry = isAcTipo(original);`
2. In the key-loan submit handler's "edit active" branch: `const isAcEntry = original.tipo === 'controle-ar';` → `const isAcEntry = isAcTipo(original);`
3. In `window.returnKeyLoan`, inside the history-record spread: `...(loan.tipo === 'controle-ar' ? { qtyAc: loan.qtyAc } : { salaId: loan.salaId, qtyKey: loan.qtyKey }),` → `...(isAcTipo(loan) ? { qtyAc: loan.qtyAc } : { salaId: loan.salaId, qtyKey: loan.qtyKey }),`
4. In `window.returnAllKeyLoans`, the identical spread inside the `keyLoans.forEach` loop: same replacement as #3, using `loan` (the loop variable).
5. In `window.editKeyLoan`: `const isAcEntry = loan.tipo === 'controle-ar';` → `const isAcEntry = isAcTipo(loan);`
6. In `renderKeysMural`: `const isAcEntry = loan.tipo === 'controle-ar';` → `const isAcEntry = isAcTipo(loan);`
7. In `renderKeysHistory`, the room-name line: `const roomName = loan.tipo === 'controle-ar' ? 'Evento' : (room ? `(${room.code})` : 'Sala');` → `const roomName = isAcTipo(loan) ? 'Evento' : (room ? `(${room.code})` : 'Sala');`
8. In `renderKeysHistory`, the badge line: `const isAcEntry = loan.tipo === 'controle-ar';` → `const isAcEntry = isAcTipo(loan);`

Do not change any comparison that reads `.tipo === 'chave'` (a different, unambiguous literal check used for other purposes, e.g. the duplicate-active-loan warning in the submit handler) — only `=== 'controle-ar'` comparisons are in scope here.

- [ ] **Step 3: Simplify `editKeyLoan`'s existing inline fallback to reuse the helper**

In `index.html`, `window.editKeyLoan` currently has (after Step 2's replacement of its first `isAcEntry` line):

```js
                // Set inputs - a given entry is only ever 'chave' or 'controle-ar' (legacy records
                // without `tipo` may still have both hasKey/hasAc set; fall back to those flags)
                const showKey = loan.tipo ? !isAcEntry : !!loan.hasKey;
                const showAc = loan.tipo ? isAcEntry : !!loan.hasAc;
```

Leave this exactly as-is — `isAcEntry` here is already the corrected value from Step 2's replacement (`isAcTipo(loan)`), so `showKey`/`showAc` are already consistent with the helper. No further edit needed in this spot; it's called out here only so the implementer doesn't second-guess it during Step 4's verification.

- [ ] **Step 4: Verify**

Code-level checks:
- Grep for `.tipo === 'controle-ar'` — zero matches remaining anywhere in the file.
- Grep for `isAcTipo(` — 8 call sites (one per replacement above) plus the one definition = 9 total matches.
- Confirm every replaced line still has correct surrounding syntax (no stray parens/braces from the substitution).
- Re-read `window.editKeyLoan` in full after editing to confirm `showKey`/`showAc` still compute correctly using the now-corrected `isAcEntry`.

Manual verification:
- In the Firebase console (or by editing localStorage directly for a local test), create a `keyLoans` entry with `hasAc: true, hasKey: false` and no `tipo` field. Reload the app and confirm: it displays as an AC-control entry in the mural (not as a key loan), editing it shows the AC checkbox checked, and returning it correctly preserves `qtyAc` in the history record (not a lost/undefined value).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "fix: use isAcTipo() fallback consistently so legacy untyped key/AC records classify correctly"
```

## Task 7: Lock tipo checkboxes during key/AC edit

**Files:**
- Modify: `index.html` (script only)

**Interfaces:**
- No new functions. Modifies `window.editKeyLoan` and `btnNewKeyLoan`'s click handler.

- [ ] **Step 1: Disable the checkboxes when opening edit mode**

In `index.html`, `window.editKeyLoan` sets up the room-select lock like this:

```js
                    keyLoanRoomSelect.disabled = true; // Lock room during edit
```

Right after the full `if (isAcEntry) { ... } else { ... }` block that contains this line (i.e., after that block's closing `}`, still inside `editKeyLoan`, before the `// Set inputs...` comment), add:

```js
                keyLoanChkKey.disabled = true;
                keyLoanChkAc.disabled = true;
```

The full surrounding context should read:

```js
                if (isAcEntry) {
                    // AC-control entries are tied to the event, not to a room - hide room field entirely
                    keyLoanRoomSelectGroup.style.display = 'none';
                } else {
                    keyLoanRoomSelectGroup.style.display = 'block';

                    // Show dropdown select, hide checkboxes
                    keyLoanRoomSelect.style.display = 'block';
                    keyLoanRoomCheckboxes.style.display = 'none';

                    // Set dropdown select
                    keyLoanRoomSelect.innerHTML = '';
                    const room = predefinedRooms.find(r => r && r.id === loan.salaId);
                    const opt = document.createElement('option');
                    opt.value = loan.salaId;
                    opt.textContent = room ? `${room.name} (${room.code})` : 'Sala';
                    keyLoanRoomSelect.appendChild(opt);
                    keyLoanRoomSelect.disabled = true; // Lock room during edit
                }

                keyLoanChkKey.disabled = true;
                keyLoanChkAc.disabled = true;

                // Set inputs - a given entry is only ever 'chave' or 'controle-ar' (legacy records
```

- [ ] **Step 2: Re-enable the checkboxes when opening create mode**

In `index.html`, `btnNewKeyLoan`'s click handler currently reads:

```js
            btnNewKeyLoan.addEventListener('click', () => {
                keyLoanEditId.value = '';
                keyLoanEditIsHistory.value = 'false';
                keyLoanCheckoutEditFields.style.display = 'none';
                keyLoanForm.reset();
                keyLoanQtyKeyContainer.style.display = 'none';
                keyLoanQtyAcContainer.style.display = 'none';
```

`keyLoanForm.reset()` resets checkbox `checked` state but does **not** reset the `disabled` property (that's a DOM property set via script, not part of native form reset). Add explicit re-enabling right after `keyLoanForm.reset();`:

```js
            btnNewKeyLoan.addEventListener('click', () => {
                keyLoanEditId.value = '';
                keyLoanEditIsHistory.value = 'false';
                keyLoanCheckoutEditFields.style.display = 'none';
                keyLoanForm.reset();
                keyLoanChkKey.disabled = false;
                keyLoanChkAc.disabled = false;
                keyLoanQtyKeyContainer.style.display = 'none';
                keyLoanQtyAcContainer.style.display = 'none';
```

- [ ] **Step 3: Verify**

Code-level checks:
- Grep for `keyLoanChkKey.disabled` and `keyLoanChkAc.disabled` — each should have exactly 2 matches (one `= true` in `editKeyLoan`, one `= false` in `btnNewKeyLoan`'s handler).
- Confirm the `= true` lines sit inside `editKeyLoan`, after the `if/else` block that ends with `keyLoanRoomSelect.disabled = true;`, and before the `const showKey = ...` line.
- Confirm the `= false` lines sit inside `btnNewKeyLoan`'s handler, immediately after `keyLoanForm.reset();`.

Manual verification:
- Click "Registrar Empréstimo" (create mode) in the Chaves/Ar tab — confirm the "Chave"/"Ar" checkboxes are clickable.
- Click the edit icon on an existing key or AC loan — confirm the checkboxes now appear visually disabled (grayed out) and cannot be toggled.
- Close that edit modal and click "Registrar Empréstimo" again — confirm the checkboxes are clickable again (not stuck disabled from the previous edit).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "fix: lock chave/ar checkboxes during key loan edit to match the already-locked room field"
```

## Task 8: Minimum-quantity validation for key/AC loans

**Files:**
- Modify: `index.html` (script only)

**Interfaces:**
- No new functions. Adds validation to the existing `btnSubmitKeyLoan` handler.

- [ ] **Step 1: Add the validation checks**

In `index.html`, `btnSubmitKeyLoan`'s handler currently validates like this:

```js
                if (hasKey && roomIds.length === 0) {
                    showToast('Selecione pelo menos uma sala.', '⚠️');
                    return;
                }
```

Insert new checks right after that block, before the `if (!loanId && hasKey)` duplicate-check block that follows it:

```js
                if (hasKey && roomIds.length === 0) {
                    showToast('Selecione pelo menos uma sala.', '⚠️');
                    return;
                }
                if (hasKey && qtyKey < 1) {
                    showToast('Quantidade de chaves inválida.', '⚠️');
                    return;
                }
                if (hasAc && qtyAc < 1) {
                    showToast('Quantidade de controles inválida.', '⚠️');
                    return;
                }
```

- [ ] **Step 2: Verify**

Code-level checks:
- Grep for `Quantidade de chaves inválida` and `Quantidade de controles inválida` — one match each.
- Confirm both new checks sit before any other validation that could show a toast and return first for unrelated reasons (order matters only in that both must run before the loan is actually created/updated further down — their exact position relative to the OTHER unrelated checks, like `!eventName`, doesn't matter functionally, but keep them grouped with the other `hasKey`/`hasAc`-related checks for readability, as shown above).

Manual verification:
- Try registering a key loan with quantity `-1` typed directly into the quantity field. Confirm it's blocked with the new toast instead of being saved.
- Try registering a key loan with quantity `1` (default/valid) — confirm it still saves normally.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "fix: validate minimum quantity of 1 for key/AC loans, matching furniture-loan validation"
```

## Task 9: Fallback `'-'` for Origem/Destino

**Files:**
- Modify: `index.html` (script only)

**Interfaces:**
- No new functions. Adds a fallback to 3 existing template-literal interpolations.

- [ ] **Step 1: Fix the on-screen history card**

In `index.html`, the loan-history card template currently reads:

```js
                            <div class="detail-item">
                                <span class="detail-label">Origem</span>
                                <span class="detail-val">${loan.origem}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Destino</span>
                                <span class="detail-val">${loan.destino}</span>
                            </div>
```

Replace with:

```js
                            <div class="detail-item">
                                <span class="detail-label">Origem</span>
                                <span class="detail-val">${loan.origem || '-'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Destino</span>
                                <span class="detail-val">${loan.destino || '-'}</span>
                            </div>
```

- [ ] **Step 2: Fix the text export**

In `index.html`, `generateTextReport` currently reads:

```js
                    text += `   • Origem: ${loan.origem}\n`;
                    text += `   • Destino: ${loan.destino}\n`;
```

Replace with:

```js
                    text += `   • Origem: ${loan.origem || '-'}\n`;
                    text += `   • Destino: ${loan.destino || '-'}\n`;
```

- [ ] **Step 3: Fix the Excel export**

In `index.html`, the Excel export's row template currently reads:

```js
                        <td>${loan.origem}</td>
                        <td>${loan.destino}</td>
```

Replace with:

```js
                        <td>${loan.origem || '-'}</td>
                        <td>${loan.destino || '-'}</td>
```

- [ ] **Step 4: Verify**

Code-level checks:
- Grep for `${loan.origem}` and `${loan.destino}` (without the `|| '-'` fallback) — zero matches remaining.
- Grep for `${loan.origem || '-'}` and `${loan.destino || '-'}` — one match each, at the three locations above.

Manual verification:
- In the Firebase console (or localStorage for a local test), create/edit a `loans` entry with `origem`/`destino` set to `null` or removed entirely. Confirm the history card, the copied text report, and the downloaded Excel file all show `-` for those fields instead of the literal word "undefined".

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "fix: fall back to '-' for missing origem/destino, matching evento/responsável fields"
```

## Task 10: `logAuditEntry` doesn't block on a full localStorage

**Files:**
- Modify: `index.html` (script only)

**Interfaces:**
- No signature change to `logAuditEntry(action, entityId, snapshot, authorizedBy)` — same callers, same behavior on success.

- [ ] **Step 1: Wrap the localStorage write in try/catch**

In `index.html`, `logAuditEntry` currently reads:

```js
            function logAuditEntry(action, entityId, snapshot, authorizedBy) {
                const entry = {
                    id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5),
                    action: action,
                    entityType: 'emprestimo',
                    entityId: entityId,
                    snapshot: snapshot,
                    authorizedBy: authorizedBy,
                    timestamp: new Date().toISOString()
                };
                auditLog.unshift(entry);
                localStorage.setItem('arena_audit_log', JSON.stringify(auditLog));
                syncAuditLogUpsert(entry);
            }
```

Replace with:

```js
            function logAuditEntry(action, entityId, snapshot, authorizedBy) {
                const entry = {
                    id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5),
                    action: action,
                    entityType: 'emprestimo',
                    entityId: entityId,
                    snapshot: snapshot,
                    authorizedBy: authorizedBy,
                    timestamp: new Date().toISOString()
                };
                auditLog.unshift(entry);
                try {
                    localStorage.setItem('arena_audit_log', JSON.stringify(auditLog));
                } catch (err) {
                    console.error("Error caching audit log locally (localStorage full?):", err);
                }
                syncAuditLogUpsert(entry);
            }
```

- [ ] **Step 2: Verify**

Code-level checks:
- Grep for `Error caching audit log locally` — exactly one match.
- Confirm `syncAuditLogUpsert(entry);` still runs unconditionally after the `try/catch` (i.e., it's outside the `try` block, at the same indentation level, not accidentally nested inside it or skipped).
- Confirm the function signature (`function logAuditEntry(action, entityId, snapshot, authorizedBy)`) is unchanged — both existing call sites (`deleteLoan` and the `submitBtn` edit branch) require no changes.

Manual verification:
- In DevTools, fill `localStorage` to capacity for the app's origin (e.g. via a console loop writing large strings) or simulate the exception directly in the console (`localStorage.setItem = () => { throw new DOMException('quota'); }` temporarily). Delete a loan with the master password and a name. Confirm the loan is still deleted successfully (toast "Registro excluído com sucesso!" still appears) despite the simulated localStorage failure — check the console for the new caught-error log instead of an uncaught exception.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "fix: don't let a full localStorage block loan deletion/editing via the audit log write"
```

## Task 11: Photo-pending guard + fallback-to-original on compress failure

**Files:**
- Modify: `index.html` (script only)

**Interfaces:**
- Produces: `checkinPhotosPending` and `checkoutPhotosPending` (module-scope `let` counters, mirroring `checkinPhotosList`/`checkoutPhotosList`). No other task depends on them.

- [ ] **Step 1: Add the pending counters**

In `index.html`, the photo-list state declarations currently read:

```js
            let checkinPhotosList = [];
            let checkoutPhotosList = [];
```

Add the two counters right after:

```js
            let checkinPhotosList = [];
            let checkoutPhotosList = [];
            let checkinPhotosPending = 0;
            let checkoutPhotosPending = 0;
```

- [ ] **Step 2: Update the check-in camera listener**

In `index.html`:

```js
            // Check-in photo capture
            checkinCameraInput.addEventListener('change', (e) => {
                const files = Array.from(e.target.files);
                files.forEach(file => {
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        const base64Data = event.target.result;
                        compressImage(base64Data).then((compressedUrl) => {
                            const photoObj = {
                                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                                url: compressedUrl,
                                timestamp: new Date().toISOString()
                            };
                            checkinPhotosList.push(photoObj);
                            renderCheckinThumbnails();
                        }).catch((err) => {
                            console.error('Erro ao comprimir foto:', err);
                            showToast('Erro ao processar foto.', '❌');
                        });
                    };
                    reader.readAsDataURL(file);
                });
            });
```

Replace with:

```js
            // Check-in photo capture
            checkinCameraInput.addEventListener('change', (e) => {
                const files = Array.from(e.target.files);
                files.forEach(file => {
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        const base64Data = event.target.result;
                        checkinPhotosPending++;
                        compressImage(base64Data).then((compressedUrl) => {
                            const photoObj = {
                                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                                url: compressedUrl,
                                timestamp: new Date().toISOString()
                            };
                            checkinPhotosList.push(photoObj);
                            renderCheckinThumbnails();
                        }).catch((err) => {
                            console.error('Erro ao comprimir foto, salvando original sem compressão:', err);
                            const photoObj = {
                                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                                url: base64Data,
                                timestamp: new Date().toISOString()
                            };
                            checkinPhotosList.push(photoObj);
                            renderCheckinThumbnails();
                            showToast('Foto salva sem compressão (formato não suportado para otimização).', '⚠️');
                        }).finally(() => {
                            checkinPhotosPending--;
                        });
                    };
                    reader.readAsDataURL(file);
                });
            });
```

- [ ] **Step 3: Update the check-out camera listener**

In `index.html`:

```js
            checkoutCameraInput.addEventListener('change', (e) => {
                const files = Array.from(e.target.files);
                files.forEach(file => {
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        const base64Data = event.target.result;
                        compressImage(base64Data).then((compressedUrl) => {
                            const photoObj = {
                                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                                url: compressedUrl,
                                timestamp: new Date().toISOString()
                            };
                            checkoutPhotosList.push(photoObj);
                            renderCheckoutThumbnails();
                        }).catch((err) => {
                            console.error('Erro ao comprimir foto:', err);
                            showToast('Erro ao processar foto.', '❌');
                        });
                    };
                    reader.readAsDataURL(file);
                });
            });
```

Replace with:

```js
            checkoutCameraInput.addEventListener('change', (e) => {
                const files = Array.from(e.target.files);
                files.forEach(file => {
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        const base64Data = event.target.result;
                        checkoutPhotosPending++;
                        compressImage(base64Data).then((compressedUrl) => {
                            const photoObj = {
                                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                                url: compressedUrl,
                                timestamp: new Date().toISOString()
                            };
                            checkoutPhotosList.push(photoObj);
                            renderCheckoutThumbnails();
                        }).catch((err) => {
                            console.error('Erro ao comprimir foto, salvando original sem compressão:', err);
                            const photoObj = {
                                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                                url: base64Data,
                                timestamp: new Date().toISOString()
                            };
                            checkoutPhotosList.push(photoObj);
                            renderCheckoutThumbnails();
                            showToast('Foto salva sem compressão (formato não suportado para otimização).', '⚠️');
                        }).finally(() => {
                            checkoutPhotosPending--;
                        });
                    };
                    reader.readAsDataURL(file);
                });
            });
```

- [ ] **Step 4: Guard the check-in submit validation**

In `index.html`, `btnSubmitCheckin`'s handler currently reads:

```js
                if (checkinPhotosList.length === 0) {
                    showToast('Anexo de foto é obrigatório para check-in!', '⚠️');
                    return;
                }
```

Replace with:

```js
                if (checkinPhotosPending > 0) {
                    showToast('Aguarde o processamento da(s) foto(s) antes de confirmar.', '⏳');
                    return;
                }
                if (checkinPhotosList.length === 0) {
                    showToast('Anexo de foto é obrigatório para check-in!', '⚠️');
                    return;
                }
```

- [ ] **Step 5: Guard the check-out submit validation**

In `index.html`, `btnSubmitCheckout`'s handler currently reads:

```js
                if (checkoutPhotosList.length === 0) {
                    showToast('Anexo de foto é obrigatório para check-out!', '⚠️');
                    return;
                }
```

Replace with:

```js
                if (checkoutPhotosPending > 0) {
                    showToast('Aguarde o processamento da(s) foto(s) antes de confirmar.', '⏳');
                    return;
                }
                if (checkoutPhotosList.length === 0) {
                    showToast('Anexo de foto é obrigatório para check-out!', '⚠️');
                    return;
                }
```

- [ ] **Step 6: Verify**

Code-level checks:
- Grep for `checkinPhotosPending` and `checkoutPhotosPending` — each should appear 4 times (declaration, `++`, `--` inside `.finally()`, and the `> 0` submit check).
- Grep for `Aguarde o processamento` — exactly 2 matches (check-in and check-out).
- Grep for `salvando original sem compressão` — exactly 2 matches (the two `.catch()` console messages).
- Confirm each `.catch()` block still ends with `.finally(() => { ...Pending--; })` chained after it — the `.finally()` must run whether `.then()` or `.catch()` fired, so it must be chained after both, not nested inside either.
- Confirm the `url: base64Data` fallback inside each `.catch()` reuses the exact same `base64Data` variable already in scope from `reader.onload`'s parameter (not `compressedUrl`, which is undefined in the `.catch()` branch).

Manual verification:
- Attach a photo, then—if your device/browser is fast enough that the compression race is hard to trigger naturally—temporarily add `await new Promise(r => setTimeout(r, 3000));` at the top of `compressImage`'s `img.onload` handler (a throwaway local edit, revert before committing) to simulate a slow device; confirm submitting immediately after attaching a photo now shows the "aguarde" toast instead of proceeding without the photo. Revert the throwaway delay before running Step 7.
- Attach a photo in a format your current browser can't decode as an `<img>` (or temporarily make `compressImage` always reject, as a throwaway local test, then revert): confirm the photo still appears as a thumbnail and gets saved, with the new "sem compressão" toast, instead of being dropped.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "fix: wait for pending photo compression before submit, and keep uncompressed photos on decode failure"
```

---

## Self-Review Notes

Spec coverage check against `docs/superpowers/specs/2026-08-17-fase4-correcao-bugs-design.md`:
- §1 Race de check-in → Task 1.
- §2 Histórico de Vistorias → Task 2.
- §3 Previsto fixo → Task 3.
- §4 Fotos limpas ao trocar sala → Task 4.
- §5 Toast condicionado no check-in editado → Task 5.
- §6 Fallback `isAcTipo` → Task 6.
- §7 Travar checkboxes de tipo → Task 7.
- §8 Validação de quantidade mínima → Task 8.
- §9 Fallback `'-'` em Origem/Destino → Task 9.
- §10 `logAuditEntry` não trava → Task 10.
- §11 + §12 Validação de foto pendente + fallback sem compressão → Task 11 (both covered by the same code change, as the spec itself notes).
- "Fora de escopo" items (migração retroativa de registros ambíguos, permitir arquivar vistoria em aberto, lock distribuído real, log de auditoria para chaves/vistorias, redesenho visual) — none of the 11 tasks touch those areas.

Type/name consistency verified: `isAcTipo(rec)` parameter name and return type are consistent between its Task 6 definition and all 8 call sites (all pass an existing loan/record variable already named `loan`/`original` in their local scope — no renaming needed at any call site). `checkinPhotosPending`/`checkoutPhotosPending` are used identically in Task 11's two listeners and two submit-guards. `renderInspectionsHistory()` takes no arguments everywhere it's referenced in Task 2 (definition and all 7 call sites).
