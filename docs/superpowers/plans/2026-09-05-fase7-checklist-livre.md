# Fase 7 — Checklist Livre no Check-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the check-in checklist accept freely added items (any name, any quantity) instead of being locked to the room's pre-defined catalog, while still pre-populating from that catalog as a starting point, and make the room's catalog "learn" newly added items for future check-ins.

**Architecture:** Single-file app (`index.html`), no build tooling, no automated test suite. The change moves the checklist's source of truth from an external array (`roomInventories[roomId]`) to the DOM itself: each checklist row carries its own item data as attributes, so add/remove/submit all read from what's actually on screen. A small persistence step then folds newly-added items back into the room's catalog.

**Tech Stack:** HTML/CSS/vanilla JS, Firebase Realtime Database (compat SDK), localStorage. No new dependencies.

## Global Constraints

- Check-out (`#checkout-modal`, `openCheckoutModal`, `triggerEditInspection`'s check-out branch) is genuinely unaffected by this phase — it already builds its checklist from `inspection.checklist` (the array saved at check-in), not from `roomInventories`. Do not touch check-out code.
- Adding an item during check-in updates `roomInventories[roomId]` permanently (via the existing `syncInventoryUpsert(roomId, items)` at `index.html:2884-2886`) so it pre-populates on future check-ins of that room.
- Removing an item during check-in must NOT touch `roomInventories` — removal only excludes the item from the current inspection; the room's catalog (including that item) is untouched and will pre-populate again on the next check-in.
- No new item-picker grid — adding an item is a free-text name field, no catalog/grid of choices.
- No quantity field in the "add item" form — a newly added item starts at quantity 1 and is adjusted with the same `-`/`+` chips every other item already uses.
- Do not change the CSS custom-property tokens or introduce new literal colors — reuse `--text-secondary`, `--primary`, `--transition-smooth`, etc.
- Do not change any check-in field validation, Firebase collection names, or the shape of a saved inspection record beyond what's specified here.
- No automated tests exist for this project. Verification is grep/read-based plus a manual browser checklist written out in full for the human operator.

---

### Task 1: Free-form checklist UI (add/remove items) and DOM-driven submit assembly

**Files:**
- Modify: `index.html` CSS block (new rules near `.checklist-item-expected`, ~line 1340-1343)
- Modify: `index.html:2171-2173` (`#checkin-modal`'s step-2 HTML — add the "add item" mini-form)
- Modify: `index.html:2650` area (const declarations for check-in modal fields — add 2 new consts)
- Modify: `index.html:3299-3327` (`updateCheckinChecklist` — use the new shared row-builder)
- Modify: `index.html:3478-3498` (`btnSubmitCheckin`'s checklist-assembly block — read from DOM rows, not `roomInventories`)
- Modify: `index.html:3909-3933` (the check-in branch of `window.triggerEditInspection` — use the new shared row-builder)

**Interfaces:**
- Produces: `function buildCheckinChecklistRowElement(item)` — global-scope function. `item` is `{mobiliarioId, name, expectedQty, checkinQty, checkinState}` (`expectedQty` may be `null` for a freely-added item). Returns an `HTMLDivElement` (`.checklist-item-row`) with `data-mobiliario-id`, `data-name`, `data-expected-qty` attributes set on the row itself, ready to `appendChild` into `checkinChecklistContainer`. Consumed by `updateCheckinChecklist`, the check-in branch of `triggerEditInspection`, and the new "add item" click handler (all in this task).
- Produces: `window.removeCheckinChecklistItem(mobiliarioId)` — removes the matching `.checklist-item-row` from `checkinChecklistContainer`. Not consumed by any later task (only referenced from the `onclick` markup this task also writes).
- Consumes: existing `window.adjustCheckinQty(itemId, delta)` and `window.setCheckinState(itemId, state)` (unchanged, already defined elsewhere in the file) — the new row markup wires `onclick` to these exactly as the old markup did.
- Task 2 consumes: the `checklist` array this task's rewritten submit-assembly block produces (same shape as before: `{mobiliarioId, name, expectedQty, checkinQty, checkinState, checkoutQty, checkoutState, observacoes}`), and reads `roomId` (already in scope in the handler from `const roomId = checkinRoomSelect.value;`).

- [ ] **Step 1: Add the new CSS rules**

Add this block right after the `.checklist-item-expected` rule (currently `index.html:1340-1343`):
```css
.checklist-add-item-row {
    display: flex;
    gap: 8px;
    margin-top: 4px;
}

.checklist-add-item-row .input-text {
    flex: 1;
}

.checklist-item-remove-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 1.1rem;
    line-height: 1;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 50%;
    transition: var(--transition-smooth);
}

.checklist-item-remove-btn:active {
    background-color: rgba(225, 21, 24, 0.1);
    color: var(--primary);
}
```

- [ ] **Step 2: Add the "add item" mini-form to `#checkin-modal`'s step 2**

Current structure (verified at `index.html:2168-2175`):
```html
<div class="form-step" data-step="2">
    <div class="form-group">
        <label class="form-label">Checklist de Inventário</label>
        <div class="inspection-checklist" id="checkin-checklist-container">
            <!-- Items rendered dynamically via JS -->
        </div>
    </div>
</div>
```
Change to:
```html
<div class="form-step" data-step="2">
    <div class="form-group">
        <label class="form-label">Checklist de Inventário</label>
        <div class="inspection-checklist" id="checkin-checklist-container">
            <!-- Items rendered dynamically via JS -->
        </div>
        <div class="checklist-add-item-row">
            <input type="text" id="checkin-new-item-name" class="input-text" placeholder="Nome do item (ex: Puff, Espelho...)">
            <button type="button" class="btn-secondary" id="btn-checkin-add-item" style="flex: 0 0 auto;">+ Adicionar</button>
        </div>
    </div>
</div>
```
Do not touch `#checkout-checklist-container` (the equivalent block inside `#checkout-modal`, ~`index.html:2232-2238`) — check-out is out of scope for this phase.

- [ ] **Step 3: Add the new DOM consts**

Add these two lines right after the existing check-in modal consts block (after `const btnNewInspection = document.getElementById('btn-new-inspection');`, currently `index.html:2650`):
```javascript
const checkinNewItemName = document.getElementById('checkin-new-item-name');
const btnCheckinAddItem = document.getElementById('btn-checkin-add-item');
```

- [ ] **Step 4: Define `buildCheckinChecklistRowElement`**

Add this function right before `function updateCheckinChecklist(roomId) {` (currently `index.html:3299`):
```javascript
function buildCheckinChecklistRowElement(item) {
    const row = document.createElement('div');
    row.className = 'checklist-item-row';
    row.setAttribute('data-mobiliario-id', item.mobiliarioId);
    row.setAttribute('data-name', item.name);
    row.setAttribute('data-expected-qty', (item.expectedQty !== null && item.expectedQty !== undefined) ? item.expectedQty : '');
    const expectedLabel = (item.expectedQty !== null && item.expectedQty !== undefined) ? `Previsto: ${item.expectedQty}` : 'Adicionado';
    row.innerHTML = `
        <div class="checklist-item-header">
            <span class="checklist-item-name">${item.name}</span>
            <span class="checklist-item-expected">${expectedLabel}</span>
            <button type="button" class="checklist-item-remove-btn" onclick="removeCheckinChecklistItem('${item.mobiliarioId}')" aria-label="Remover item">×</button>
        </div>
        <div class="checklist-item-controls">
            <div style="display: flex; align-items: center; gap: 8px;">
                <button type="button" class="chip-btn" style="padding: 2px 8px;" onclick="adjustCheckinQty('${item.mobiliarioId}', -1)">-</button>
                <span id="checkin-qty-${item.mobiliarioId}" style="font-weight: bold; font-size: 0.95rem;">${item.checkinQty}</span>
                <button type="button" class="chip-btn" style="padding: 2px 8px;" onclick="adjustCheckinQty('${item.mobiliarioId}', 1)">+</button>
            </div>
            <div class="checklist-state-selector" data-item="${item.mobiliarioId}">
                <button type="button" class="checklist-state-btn ${item.checkinState === 'Inteiro' ? 'selected' : ''}" data-state="Inteiro" onclick="setCheckinState('${item.mobiliarioId}', 'Inteiro')">Inteiro</button>
                <button type="button" class="checklist-state-btn ${item.checkinState === 'Danificado' ? 'selected' : ''}" data-state="Danificado" onclick="setCheckinState('${item.mobiliarioId}', 'Danificado')">Danificado</button>
                <button type="button" class="checklist-state-btn ${item.checkinState === 'Ausente' ? 'selected' : ''}" data-state="Ausente" onclick="setCheckinState('${item.mobiliarioId}', 'Ausente')">Ausente</button>
            </div>
        </div>
    `;
    return row;
}

window.removeCheckinChecklistItem = function(mobiliarioId) {
    const row = checkinChecklistContainer.querySelector(`.checklist-item-row[data-mobiliario-id="${mobiliarioId}"]`);
    if (row) row.remove();
};
```

- [ ] **Step 5: Rewrite `updateCheckinChecklist` to use the shared builder**

Current code (verified at `index.html:3299-3327`):
```javascript
function updateCheckinChecklist(roomId) {
    const inventory = roomInventories[roomId] || [];
    checkinChecklistContainer.innerHTML = '';
    inventory.forEach(item => {
        const row = document.createElement('div');
        row.className = 'checklist-item-row';
        row.innerHTML = `
            <div class="checklist-item-header">
                <span class="checklist-item-name">${item.name}</span>
                <span class="checklist-item-expected">Previsto: ${item.expectedQty}</span>
            </div>
            <div class="checklist-item-controls">
                <!-- Qty selector -->
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button type="button" class="chip-btn" style="padding: 2px 8px;" onclick="adjustCheckinQty('${item.mobiliarioId}', -1)">-</button>
                    <span id="checkin-qty-${item.mobiliarioId}" style="font-weight: bold; font-size: 0.95rem;">${item.expectedQty}</span>
                    <button type="button" class="chip-btn" style="padding: 2px 8px;" onclick="adjustCheckinQty('${item.mobiliarioId}', 1)">+</button>
                </div>
                <!-- State selector -->
                <div class="checklist-state-selector" data-item="${item.mobiliarioId}">
                    <button type="button" class="checklist-state-btn selected" data-state="Inteiro" onclick="setCheckinState('${item.mobiliarioId}', 'Inteiro')">Inteiro</button>
                    <button type="button" class="checklist-state-btn" data-state="Danificado" onclick="setCheckinState('${item.mobiliarioId}', 'Danificado')">Danificado</button>
                    <button type="button" class="checklist-state-btn" data-state="Ausente" onclick="setCheckinState('${item.mobiliarioId}', 'Ausente')">Ausente</button>
                </div>
            </div>
        `;
        checkinChecklistContainer.appendChild(row);
    });
}
```
Change to:
```javascript
function updateCheckinChecklist(roomId) {
    const inventory = roomInventories[roomId] || [];
    checkinChecklistContainer.innerHTML = '';
    inventory.forEach(item => {
        const row = buildCheckinChecklistRowElement({
            mobiliarioId: item.mobiliarioId,
            name: item.name,
            expectedQty: item.expectedQty,
            checkinQty: item.expectedQty,
            checkinState: 'Inteiro'
        });
        checkinChecklistContainer.appendChild(row);
    });
}
```
(a fresh catalog item starts with `checkinQty` equal to its `expectedQty` and state `'Inteiro'` — exactly the values the old inline markup hard-coded).

- [ ] **Step 6: Wire the "add item" button**

Add this right after the `btnCheckinAddItem` const (from Step 3) — a natural spot is right after `updateCheckinChecklist`'s closing `}` (end of Step 5's function, currently right before the `// Checklist action handlers` comment at `index.html:3328`):
```javascript
btnCheckinAddItem.addEventListener('click', () => {
    const name = checkinNewItemName.value.trim();
    if (!name) {
        showToast('Informe o nome do item.', '⚠️');
        return;
    }
    const mobiliarioId = 'custom-' + Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5);
    const row = buildCheckinChecklistRowElement({
        mobiliarioId: mobiliarioId,
        name: name,
        expectedQty: null,
        checkinQty: 1,
        checkinState: 'Inteiro'
    });
    checkinChecklistContainer.appendChild(row);
    checkinNewItemName.value = '';
});
```

- [ ] **Step 7: Rewrite the submit handler's checklist-assembly block to read from the DOM**

Current code (verified at `index.html:3478-3498`, inside `btnSubmitCheckin.addEventListener`):
```javascript
                // Compile checklist data
                const inventory = roomInventories[roomId] || [];
                const checklist = [];
                inventory.forEach(item => {
                    const qtyEl = document.getElementById(`checkin-qty-${item.mobiliarioId}`);
                    const qty = parseInt(qtyEl.textContent) || 0;
                    const selector = document.querySelector(`.checklist-state-selector[data-item="${item.mobiliarioId}"]`);
                    const selectedBtn = selector.querySelector('.checklist-state-btn.selected');
                    const state = selectedBtn ? selectedBtn.getAttribute('data-state') : 'Inteiro';

                    checklist.push({
                        mobiliarioId: item.mobiliarioId,
                        name: item.name,
                        expectedQty: item.expectedQty,
                        checkinQty: qty,
                        checkinState: state,
                        checkoutQty: null,
                        checkoutState: null,
                        observacoes: ''
                    });
                });
```
Change to:
```javascript
                // Compile checklist data from the rows actually present in the DOM —
                // reflects any freely added/removed items, not just the room's catalog.
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

                    checklist.push({
                        mobiliarioId: mobiliarioId,
                        name: name,
                        expectedQty: expectedQty,
                        checkinQty: qty,
                        checkinState: state,
                        checkoutQty: null,
                        checkoutState: null,
                        observacoes: ''
                    });
                });
```
The rest of the handler (the `if (editingInspectionId) { ... } else { ... }` branches immediately following, currently `index.html:3500` onward) is unchanged — it already consumes `checklist` by name and by shape, both preserved here.

- [ ] **Step 8: Update the check-in branch of `window.triggerEditInspection` to use the shared builder**

Current code (verified at `index.html:3909-3933`, inside the `if (inspection.status === 'Aberto') { ... }` branch):
```javascript
                    // Load checklist
                    checkinChecklistContainer.innerHTML = '';
                    inspection.checklist.forEach(item => {
                        const row = document.createElement('div');
                        row.className = 'checklist-item-row';
                        row.innerHTML = `
                            <div class="checklist-item-header">
                                <span class="checklist-item-name">${item.name}</span>
                                <span class="checklist-item-expected">Previsto: ${item.expectedQty}</span>
                            </div>
                            <div class="checklist-item-controls">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <button type="button" class="chip-btn" style="padding: 2px 8px;" onclick="adjustCheckinQty('${item.mobiliarioId}', -1)">-</button>
                                    <span id="checkin-qty-${item.mobiliarioId}" style="font-weight: bold; font-size: 0.95rem;">${item.checkinQty}</span>
                                    <button type="button" class="chip-btn" style="padding: 2px 8px;" onclick="adjustCheckinQty('${item.mobiliarioId}', 1)">+</button>
                                </div>
                                <div class="checklist-state-selector" data-item="${item.mobiliarioId}">
                                    <button type="button" class="checklist-state-btn ${item.checkinState === 'Inteiro' ? 'selected' : ''}" data-state="Inteiro" onclick="setCheckinState('${item.mobiliarioId}', 'Inteiro')">Inteiro</button>
                                    <button type="button" class="checklist-state-btn ${item.checkinState === 'Danificado' ? 'selected' : ''}" data-state="Danificado" onclick="setCheckinState('${item.mobiliarioId}', 'Danificado')">Danificado</button>
                                    <button type="button" class="checklist-state-btn ${item.checkinState === 'Ausente' ? 'selected' : ''}" data-state="Ausente" onclick="setCheckinState('${item.mobiliarioId}', 'Ausente')">Ausente</button>
                                </div>
                            </div>
                        `;
                        checkinChecklistContainer.appendChild(row);
                    });
```
Change to:
```javascript
                    // Load checklist
                    checkinChecklistContainer.innerHTML = '';
                    inspection.checklist.forEach(item => {
                        const row = buildCheckinChecklistRowElement({
                            mobiliarioId: item.mobiliarioId,
                            name: item.name,
                            expectedQty: item.expectedQty,
                            checkinQty: item.checkinQty,
                            checkinState: item.checkinState
                        });
                        checkinChecklistContainer.appendChild(row);
                    });
```
This also fixes a small pre-existing display bug: the old inline markup always showed `Previsto: ${item.expectedQty}` even when `expectedQty` was `undefined` (there was no way to reach that state before this phase, but from now on freely-added items have `expectedQty: null`); the shared builder correctly shows "Adicionado" instead for those.

- [ ] **Step 9: Verify**

```bash
grep -n "buildCheckinChecklistRowElement\|removeCheckinChecklistItem\|checkin-new-item-name\|btn-checkin-add-item\|checklist-add-item-row" index.html
```
Expected: `buildCheckinChecklistRowElement` appears 4 times (1 definition + 3 call sites: `updateCheckinChecklist`, the add-item handler, `triggerEditInspection`'s check-in branch); `removeCheckinChecklistItem` appears 2 times (1 definition via `window.removeCheckinChecklistItem = function` + 1 reference inside the builder's `onclick` template string); `checkin-new-item-name`/`btn-checkin-add-item` each appear twice (HTML + `getElementById`).

Read back `updateCheckinChecklist`, the add-item click handler, `triggerEditInspection`'s check-in branch, and the submit handler's checklist-assembly block in full to confirm each reads/writes consistently with `buildCheckinChecklistRowElement`'s attribute contract (`data-mobiliario-id`, `data-name`, `data-expected-qty`).

Manual browser checklist (for the human operator, not the agent):
- Start a check-in on a room with a non-empty catalog (e.g. one with "Pranchões"/"Cadeiras de quadra") — confirm both pre-populate with their usual quantities.
- Type a new item name (e.g. "Puff") and click "+ Adicionar" — confirm a new row appears with quantity 1, state "Inteiro", and label "Adicionado" (not "Previsto: ...").
- Adjust that new item's quantity with the `-`/`+` chips and change its state — confirm it behaves exactly like a catalog item.
- Click the "×" on a catalog item (e.g. "Cadeiras de quadra") — confirm the row disappears.
- Try clicking "+ Adicionar" with the name field empty — confirm the "Informe o nome do item." toast and no row is added.
- Complete the check-in — confirm no errors, and that the toast/flow otherwise behaves exactly as before this phase.
- Open the check-out for that same room — confirm "Puff" appears in the check-out checklist with quantity 1 and "Inteiro" shown as the check-in reference, and that "Cadeiras de quadra" (removed at check-in) does NOT appear.
- Open the comparison report for that inspection after check-out — confirm "Puff" appears in the table correctly.
- Edit an open check-in (pencil icon before check-out) on a room that already has a freely-added item from a prior step — confirm it loads with the correct quantity/state, and that adding/removing items in edit mode also works.

- [ ] **Step 10: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat: allow freely adding/removing checklist items during check-in

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Catalog learns newly added items (persist to `roomInventories`)

**Files:**
- Modify: `index.html:3498` area (right after the checklist-assembly block Task 1 rewrote, inside `btnSubmitCheckin.addEventListener`, before `let inspectionToSync = null;`)

**Interfaces:**
- Consumes: the `checklist` array produced by Task 1's rewritten assembly block (shape: `{mobiliarioId, name, expectedQty, checkinQty, checkinState, checkoutQty, checkoutState, observacoes}`); the existing `roomId` local variable (from `const roomId = checkinRoomSelect.value;`, already in scope); the existing global `roomInventories` object and `function syncInventoryUpsert(roomId, items)` (`index.html:2884-2886`).
- Produces: nothing consumed by any later task — this is the last task in this phase.

- [ ] **Step 1: Add the catalog-persistence block**

Insert this immediately after Task 1's rewritten checklist-assembly `forEach` block closes (right before the existing `let inspectionToSync = null;` line, currently `index.html:3500`):
```javascript
                // Fase 7: items added freely during check-in become part of the
                // room's permanent catalog, so they pre-populate on future
                // check-ins of this room. Removed items are NOT un-learned —
                // removing only excludes an item from this specific inspection.
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
Note: since a fresh catalog item's `mobiliarioId` is always `mob-*` (seeded format) and a freely-added item's is always `custom-*` (from Task 1's add-item handler), `catalogIds.has(item.mobiliarioId)` correctly identifies "new" items as exactly the ones that didn't exist in the catalog before this submit — including on the *edit* path (`editingInspectionId` truthy), where an item added during editing an already-open check-in is just as new to the catalog as one added on first creation.

- [ ] **Step 2: Verify**

```bash
grep -n "currentCatalog\|newCatalogItems" index.html
```
Expected: both appear exactly 3 times each (declaration + 2 further uses for `currentCatalog`; declaration + 2 further uses for `newCatalogItems`), all inside the block just added.

Read back the full `btnSubmitCheckin.addEventListener` handler after this change to confirm: (a) this new block sits between the checklist-assembly `forEach` and `let inspectionToSync = null;`, (b) nothing in the `if (editingInspectionId) { ... } else { ... }` branches below it was altered, (c) the block only ever *adds* to `roomInventories[roomId]`, never removes an existing entry.

Manual browser checklist:
- Repeat the "Puff" scenario from Task 1 (add it during check-in, complete the check-in).
- Start a **new** check-in on the **same room** — confirm "Puff" is now pre-populated in the catalog (proof the catalog "learned").
- In that new check-in, remove "Puff" from the list and complete the check-in without it — confirm the saved inspection's checklist does not include "Puff".
- Start yet another check-in on the same room afterward — confirm "Puff" is **still** pre-populated (proof that removing during check-in did not un-learn it from the catalog).
- Add a freely-named item while **editing** an already-open check-in (via the pencil/edit path) and complete the edit — confirm a subsequent new check-in on that room also pre-populates that item.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat: persist freely added checklist items to the room's catalog

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
