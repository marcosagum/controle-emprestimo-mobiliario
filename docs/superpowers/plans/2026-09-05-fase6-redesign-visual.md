# Fase 6 — Redesign Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the Empréstimos tab into "Novo Empréstimo"/"Histórico" sub-tabs, turn the check-in and check-out modals into 3-step wizards (Dados → Checklist → Fotos), and polish visual consistency (status badges, empty states, destructive-button styling, modal header spacing) across the rest of the app — all without touching the Rio Centro palette, data model, or business logic.

**Architecture:** Single-file app (`index.html`), no build tooling, no automated test suite. All changes are CSS + vanilla-JS DOM manipulation inside the existing `<style>` and `<script>` blocks. Verification is code-level (grep for exact strings, brace-balance checks, reading the diff) plus a manual browser checklist for the human operator — same convention as every prior phase (1-5) of this project.

**Tech Stack:** HTML/CSS/vanilla JS, Firebase Realtime Database (compat SDK), localStorage. No new dependencies.

## Global Constraints

- Do not change the CSS custom-property tokens (`--bg-color`, `--primary`, `--success`, `--text-primary`, `--text-secondary`, `--border-color`, `--border-radius-*`) or the "Onest" font — palette stays exactly as-is (per spec Decision 1).
- Do not change any Firebase read/write, `sanitize()` usage, or record shape — this phase is presentation-only (per spec "Fora de escopo").
- Do not add an `eventoId` filter (or remove one) anywhere — this phase doesn't touch the Fase 5 data model at all.
- Do not touch the 3 event-agnostic occupancy checks (`btnNewInspection`'s available-rooms filter at `activeRoomsState.filter(r => r.statusSala === 'Em Uso')`, the check-in race-guard `activeRoomsState.find(r => r.id === roomId && r.statusSala === 'Em Uso')`, the duplicate-active-key check in the key-loan submit handler) — unrelated to this phase, called out only so no task "cleans them up" by accident.
- No automated tests exist for this project. Each task's verification is: (a) grep/read to confirm the exact code landed correctly and braces/tags balance, (b) a manual browser checklist, written out in full, for the human operator to run — never skip writing it out just because it can't be run by the agent.
- Every new interactive element must reuse an existing CSS custom property for color — no new literal hex colors.

---

### Task 1: Sub-abas de Empréstimos ("Novo Empréstimo" / "Histórico")

**Files:**
- Modify: `index.html:1625-1837` (`#panel-loans` HTML — wrap existing sections in sub-panels, add sub-tab nav)
- Modify: `index.html` CSS block (near `.filter-tabs`/`.filter-tab`, ~line 648-676) — no new classes needed, reuse `.filter-tabs`/`.filter-tab` visually via a new `data-loan-subtab` attribute (same pattern already used for `data-evento-filter` after the Fase 5 review fix, so `.filter-tab` never collides across features)
- Modify: `index.html:2425-2432` (const declarations for `panelLoans` — add new consts alongside)
- Modify: `index.html:2461-2468` (`tabLoans.addEventListener`)
- Modify: `index.html:2814-2834` (`window.enterEvento`)
- Modify: `index.html:4642-4694` (`window.editLoan`)
- Modify: `index.html:4736-4833` (`submitBtn.addEventListener`, both create and edit branches)

**Interfaces:**
- Produces: `function switchLoanSubtab(tab)` — global-scope function (declared with `function`, hoisted, so later tasks/handlers anywhere in the same script block can call it), `tab` is `'new'` or `'history'`. Shows `#loan-subpanel-new` or `#loan-subpanel-history` (`display: 'block'`/`'none'`), hides the other, and toggles `.active` on the two buttons matched by `document.querySelectorAll('[data-loan-subtab]')`.
- Consumes: nothing from other tasks — this task is self-contained.

- [ ] **Step 1: Wrap the two existing sections in `#panel-loans` into sub-panels, and add the sub-tab nav**

In `index.html`, current structure (verified at `index.html:1625-1837`):
```html
<div id="panel-loans" style="display: none;">
    <!-- FORMULARIO DE EMPRESTIMO -->
<section class="section-card">
    <h2 class="section-title">Registrar Empréstimo</h2>
    ... (items grid, qty, origin, destination, responsibles, submit button) ...
</section>

<!-- HISTÓRICO DE EMPRÉSTIMOS -->
<section class="section-card">
    <div class="history-controls">
        ... (search input, filter tabs) ...
    </div>
    <div class="loans-list" id="loans-history-list">...</div>
    <div class="bottom-actions" ...>...</div>
</section>
</div> <!-- Close #panel-loans -->
```

Change it to (add a sub-tab nav right after the opening `<div id="panel-loans">`, and wrap each `<section class="section-card">` in its own subpanel `<div>`):
```html
<div id="panel-loans" style="display: none;">
    <div class="filter-tabs" style="margin-bottom: 16px;">
        <button type="button" class="filter-tab active" data-loan-subtab="new">Novo Empréstimo</button>
        <button type="button" class="filter-tab" data-loan-subtab="history">Histórico</button>
    </div>

    <div id="loan-subpanel-new">
    <!-- FORMULARIO DE EMPRESTIMO -->
<section class="section-card">
    <h2 class="section-title">Registrar Empréstimo</h2>
    ... (unchanged — items grid, qty, origin, destination, responsibles, submit button) ...
</section>
    </div>

    <div id="loan-subpanel-history" style="display: none;">
<!-- HISTÓRICO DE EMPRÉSTIMOS -->
<section class="section-card">
    <div class="history-controls">
        ... (unchanged — search input, filter tabs) ...
    </div>
    <div class="loans-list" id="loans-history-list">...</div>
    <div class="bottom-actions" ...>...</div>
</section>
    </div>
</div> <!-- Close #panel-loans -->
```
Do not touch anything inside either `<section class="section-card">` — only add the wrapping `<div>`s and the new nav block. Indentation of the untouched inner lines does not need to be fixed; only add the new wrapping lines.

- [ ] **Step 2: Add the new DOM consts, right after the existing `panelLoans`/`panelInspections` consts at `index.html:2425-2432`**

```javascript
const panelLoans = document.getElementById('panel-loans');
const panelInspections = document.getElementById('panel-inspections');
const loanSubpanelNew = document.getElementById('loan-subpanel-new');
const loanSubpanelHistory = document.getElementById('loan-subpanel-history');
const loanSubtabBtns = document.querySelectorAll('[data-loan-subtab]');
```
(keep every other existing line in that block unchanged — only insert the 3 new `const` lines after `panelLoans`/`panelInspections`).

- [ ] **Step 3: Define `switchLoanSubtab` and wire the two new buttons**

Add this new function and its wiring right after the `tabKeys.addEventListener(...)` block (`index.html:2481-2490`), before the `// Room Inspection Selectors` comment:

```javascript
function switchLoanSubtab(tab) {
    loanSubtabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-loan-subtab') === tab);
    });
    loanSubpanelNew.style.display = tab === 'new' ? 'block' : 'none';
    loanSubpanelHistory.style.display = tab === 'history' ? 'block' : 'none';
}

loanSubtabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchLoanSubtab(btn.getAttribute('data-loan-subtab')));
});
```

- [ ] **Step 4: Reset to "Novo Empréstimo" whenever the Empréstimos tab is (re)entered**

In `tabLoans.addEventListener` (`index.html:2461-2468`), add the call at the end:
```javascript
tabLoans.addEventListener('click', () => {
    tabLoans.classList.add('active');
    tabInspections.classList.remove('active');
    tabKeys.classList.remove('active');
    panelLoans.style.display = 'block';
    panelInspections.style.display = 'none';
    panelKeys.style.display = 'none';
    switchLoanSubtab('new');
});
```

In `window.enterEvento` (`index.html:2814-2834`), add the same call right after `panelLoans.style.display = 'block';`:
```javascript
tabLoans.classList.add('active');
tabInspections.classList.remove('active');
tabKeys.classList.remove('active');
panelLoans.style.display = 'block';
panelInspections.style.display = 'none';
panelKeys.style.display = 'none';
switchLoanSubtab('new');

renderHistory();
updateActiveCounter();
```

- [ ] **Step 5: Switch to "Histórico" after a successful register/update, and back to "Novo Empréstimo" when editing**

In `submitBtn.addEventListener` (`index.html:4736-4833`), the edit branch currently ends with:
```javascript
    // Reset editing state and form
    resetForm();
    showToast('Empréstimo atualizado com sucesso!', '✅');
```
Change to:
```javascript
    // Reset editing state and form
    resetForm();
    switchLoanSubtab('history');
    showToast('Empréstimo atualizado com sucesso!', '✅');
```

The create branch currently ends with:
```javascript
    // Clear Form UI
    resetForm();
    showToast('Empréstimo registrado com sucesso!', '✅');
```
Change to:
```javascript
    // Clear Form UI
    resetForm();
    switchLoanSubtab('history');
    showToast('Empréstimo registrado com sucesso!', '✅');
```

In `window.editLoan` (`index.html:4642-4694`), the function currently ends with:
```javascript
    // Change form submit UI to update
    submitBtnText.textContent = 'Atualizar Empréstimo';
    cancelEditBtn.style.display = 'flex';

    // Scroll smoothly to form top
    window.scrollTo({ top: 0, behavior: 'smooth' });
};
```
Change to (switch subtab before the scroll, so the scroll lands on the now-visible form):
```javascript
    // Change form submit UI to update
    submitBtnText.textContent = 'Atualizar Empréstimo';
    cancelEditBtn.style.display = 'flex';

    switchLoanSubtab('new');

    // Scroll smoothly to form top
    window.scrollTo({ top: 0, behavior: 'smooth' });
};
```

- [ ] **Step 6: Verify**

Run: a grep-based sanity check, no test runner exists.
```bash
grep -n "loan-subpanel-new\|loan-subpanel-history\|data-loan-subtab\|switchLoanSubtab" index.html
```
Expected: `loan-subpanel-new`/`loan-subpanel-history` each appear exactly twice (opening `<div id="...">` in HTML + `document.getElementById` in JS); `data-loan-subtab` appears 3 times (2 buttons + 1 `querySelectorAll`); `switchLoanSubtab` appears 6 times (1 function definition + 5 call sites: subtab click wiring, `tabLoans` handler, `enterEvento`, submit create branch, submit edit branch, `editLoan`) — recount carefully, it's fine if the exact count differs by one or two as long as every call site listed above is present.

Also open `index.html` in a browser (or use a static HTML validator) to confirm no unclosed `<div>` — the two new wrapping `<div>`s must each have a matching close.

Manual browser checklist (for the human operator, not the agent):
- Enter an event → Empréstimos tab opens on "Novo Empréstimo".
- Register a loan → automatically switches to "Histórico" and shows the new card.
- Click the pencil on a history card → switches back to "Novo Empréstimo" with the form filled in and scrolled to top.
- Click the main "Empréstimos" tab while on "Histórico" → clicking away and back always returns to "Novo Empréstimo".

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat: split Empréstimos tab into Novo Empréstimo / Histórico sub-tabs

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Passos do Check-in (wizard de 3 passos em `#checkin-modal`)

**Files:**
- Modify: `index.html` CSS block — add new step-wizard classes (near `.filter-tabs`, ~line 676)
- Modify: `index.html:2039-2088` (`#checkin-modal` HTML)
- Modify: `index.html:2496-2508` (const declarations for checkin modal fields — add new consts alongside)
- Modify: `index.html:3053-3093` (`btnNewInspection.addEventListener` — reset to step 1 on open)
- Modify: `index.html:3660-3703` (edit-mode check-in branch inside `window.triggerEditInspection` — reset to step 1 on open)
- Modify: `index.html:3248` area (`btnSubmitCheckin.addEventListener` — no logic change, just confirm the button stays reachable from step 3)

**Interfaces:**
- Produces: `function goToCheckinStep(step)` — global-scope function. `step` is `1`, `2`, or `3`. Shows the matching `.form-step[data-step="N"]` inside `#checkin-modal`, hides the other two, updates the 3 step-dots' `.active`/`.completed` classes, and toggles which footer button is visible (`Voltar` hidden on step 1, `Continuar` visible on steps 1-2, `Confirmar Entrada` visible only on step 3).
- Consumes: nothing from Task 1. Task 3 (check-out) reuses the CSS classes this task introduces but does not call `goToCheckinStep` — check-out gets its own `goToCheckoutStep` function with identical shape, kept separate because the two modals have separate DOM/state.

- [ ] **Step 1: Add the step-wizard CSS classes**

Add this block right after the `.filter-tab.active` rule (`index.html:671-675`):
```css
/* Multi-step form wizard (check-in / check-out modals) */
.form-steps-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-bottom: 20px;
}

.form-step-dot {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background-color: var(--bg-surface-elevated);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    font-weight: 700;
    flex-shrink: 0;
}

.form-step-dot.active {
    background-color: var(--primary);
    border-color: var(--primary);
    color: white;
}

.form-step-dot.completed {
    background-color: var(--success);
    border-color: var(--success);
    color: white;
}

.form-step-connector {
    flex: 1;
    max-width: 40px;
    height: 2px;
    background-color: var(--border-color);
}

.form-step {
    display: none;
}

.form-step.active {
    display: block;
}

.form-step-nav {
    display: flex;
    gap: 12px;
    margin-top: 24px;
}
```

- [ ] **Step 2: Reorganize `#checkin-modal`'s form into 3 `.form-step` blocks with a step indicator and nav footer**

Current structure (verified at `index.html:2039-2088`):
```html
<div id="checkin-modal" class="modal-overlay">
    <div class="modal-content" style="max-height: 90vh; overflow-y: auto;">
        <h3 style="margin-top: 0; color: var(--text-primary); font-size: 1.2rem; margin-bottom: 20px;">Check-in (Abertura de Sala & Chave)</h3>

        <form id="checkin-form">
            <div class="form-group" style="margin-bottom: 15px;">
                <label class="form-label" for="checkin-room-select">Selecionar Sala</label>
                <select id="checkin-room-select" ...>...</select>
            </div>

            <div class="form-group-grid">
                <div class="form-group">
                    <label class="form-label" for="checkin-resp-cliente">Responsável Cliente</label>
                    <input type="text" id="checkin-resp-cliente" ...>
                </div>
                <div class="form-group">
                    <label class="form-label" for="checkin-operador-arena">Operador Arena</label>
                    <input type="text" id="checkin-operador-arena" ...>
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Checklist de Inventário</label>
                <div class="inspection-checklist" id="checkin-checklist-container">...</div>
            </div>

            <div class="form-group">
                <label class="form-label">Evidências Fotográficas (Entrada)</label>
                <div class="photos-uploader-container">...</div>
            </div>

            <div style="display: flex; gap: 12px; margin-top: 24px;">
                <button type="button" class="btn-secondary" id="btn-close-checkin" style="flex: 1;">Cancelar</button>
                <button type="button" class="btn-submit" id="btn-submit-checkin" style="flex: 2;">Confirmar Entrada</button>
            </div>
        </form>
    </div>
</div>
```

Replace with (field contents inside each step are unchanged — only regrouped; `id` attributes on every existing input/select/container stay identical):
```html
<div id="checkin-modal" class="modal-overlay">
    <div class="modal-content" style="max-height: 90vh; overflow-y: auto;">
        <h3 style="margin-top: 0; color: var(--text-primary); font-size: 1.2rem; margin-bottom: 20px;">Check-in (Abertura de Sala & Chave)</h3>

        <div class="form-steps-indicator" id="checkin-steps-indicator">
            <span class="form-step-dot active" data-step-dot="1">1</span>
            <span class="form-step-connector"></span>
            <span class="form-step-dot" data-step-dot="2">2</span>
            <span class="form-step-connector"></span>
            <span class="form-step-dot" data-step-dot="3">3</span>
        </div>

        <form id="checkin-form">
            <div class="form-step active" data-step="1">
                <div class="form-group" style="margin-bottom: 15px;">
                    <label class="form-label" for="checkin-room-select">Selecionar Sala</label>
                    <select id="checkin-room-select" class="input-text" style="width: 100%; height: 44px; padding: 0 10px; background-color: var(--bg-surface-elevated); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 8px; font-family: inherit;">
                        <!-- Options filled dynamically via JS -->
                    </select>
                </div>

                <div class="form-group-grid">
                    <div class="form-group">
                        <label class="form-label" for="checkin-resp-cliente">Responsável Cliente</label>
                        <input type="text" id="checkin-resp-cliente" class="input-text" placeholder="Nome do Cliente" autocomplete="off">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="checkin-operador-arena">Operador Arena</label>
                        <input type="text" id="checkin-operador-arena" class="input-text" placeholder="Nome do Operador" autocomplete="off">
                    </div>
                </div>
            </div>

            <div class="form-step" data-step="2">
                <div class="form-group">
                    <label class="form-label">Checklist de Inventário</label>
                    <div class="inspection-checklist" id="checkin-checklist-container">
                        <!-- Items rendered dynamically via JS -->
                    </div>
                </div>
            </div>

            <div class="form-step" data-step="3">
                <div class="form-group">
                    <label class="form-label">Evidências Fotográficas (Entrada)</label>
                    <div class="photos-uploader-container">
                        <label class="btn-photo-capture" for="checkin-camera-input">
                            📸 Tirar Foto / Galeria
                        </label>
                        <input type="file" id="checkin-camera-input" accept="image/*" capture="environment" multiple style="display: none;">
                        <div class="photos-thumbnail-grid" id="checkin-photos-thumbnails">
                            <!-- Thumbnails rendered dynamically -->
                        </div>
                    </div>
                </div>
            </div>

            <div class="form-step-nav">
                <button type="button" class="btn-secondary" id="btn-close-checkin" style="flex: 1;">Cancelar</button>
                <button type="button" class="btn-secondary" id="btn-checkin-back" style="flex: 1; display: none;">Voltar</button>
                <button type="button" class="btn-submit" id="btn-checkin-next" style="flex: 2;">Continuar</button>
                <button type="button" class="btn-submit" id="btn-submit-checkin" style="flex: 2; display: none;">Confirmar Entrada</button>
            </div>
        </form>
    </div>
</div>
```

- [ ] **Step 3: Add the new DOM consts, right after the existing checkin modal consts (`index.html:2497-2508`)**

```javascript
const checkinModal = document.getElementById('checkin-modal');
// ... (existing lines unchanged) ...
const checkinStepDots = document.querySelectorAll('#checkin-steps-indicator [data-step-dot]');
const checkinFormSteps = document.querySelectorAll('#checkin-form [data-step]');
const btnCheckinBack = document.getElementById('btn-checkin-back');
const btnCheckinNext = document.getElementById('btn-checkin-next');
let checkinCurrentStep = 1;
```

- [ ] **Step 4: Define `goToCheckinStep` and wire Voltar/Continuar**

Add this right after the DOM consts block that ends the checkin-modal selectors (immediately before the `checkinRoomSelect.addEventListener('change', ...)` block, currently at `index.html:3096`):

```javascript
function goToCheckinStep(step) {
    checkinCurrentStep = step;
    checkinFormSteps.forEach(el => {
        el.classList.toggle('active', parseInt(el.getAttribute('data-step')) === step);
    });
    checkinStepDots.forEach(dot => {
        const dotStep = parseInt(dot.getAttribute('data-step-dot'));
        dot.classList.toggle('active', dotStep === step);
        dot.classList.toggle('completed', dotStep < step);
    });
    btnCheckinBack.style.display = step === 1 ? 'none' : 'flex';
    btnCheckinNext.style.display = step === 3 ? 'none' : 'flex';
    btnSubmitCheckin.style.display = step === 3 ? 'flex' : 'none';
}

btnCheckinBack.addEventListener('click', () => {
    if (checkinCurrentStep > 1) goToCheckinStep(checkinCurrentStep - 1);
});

btnCheckinNext.addEventListener('click', () => {
    const currentStepEl = document.querySelector(`#checkin-form [data-step="${checkinCurrentStep}"]`);
    const invalidField = Array.from(currentStepEl.querySelectorAll('input, select')).find(el => !el.checkValidity());
    if (invalidField) {
        invalidField.reportValidity();
        return;
    }
    if (checkinCurrentStep < 3) goToCheckinStep(checkinCurrentStep + 1);
});
```

- [ ] **Step 5: Reset to step 1 on both places the modal is opened**

In `btnNewInspection.addEventListener` (`index.html:3053-3093`), add `goToCheckinStep(1);` right before `checkinModal.classList.add('show');`:
```javascript
    goToCheckinStep(1);
    checkinModal.classList.add('show');
});
```

In the check-in branch of `window.triggerEditInspection` (`index.html:3660-3703`, the branch that ends `checkinModal.classList.add('show');` at line 3702), add the same call right before it:
```javascript
    goToCheckinStep(1);
    checkinModal.classList.add('show');
} else {
```

- [ ] **Step 6: Verify**

```bash
grep -n "goToCheckinStep\|checkinFormSteps\|checkinStepDots\|btn-checkin-back\|btn-checkin-next" index.html
```
Expected: `goToCheckinStep` appears 4 times (1 definition, 2 calls from Step 5, 1 call each from Voltar/Continuar handlers — recount by reading, not just counting); `data-step="1"`, `data-step="2"`, `data-step="3"` each appear once inside `#checkin-form`.

Read the modified `#checkin-modal` block back and confirm every original `id` (`checkin-room-select`, `checkin-resp-cliente`, `checkin-operador-arena`, `checkin-checklist-container`, `checkin-camera-input`, `checkin-photos-thumbnails`, `btn-close-checkin`, `btn-submit-checkin`) is still present exactly once — none renamed, none duplicated, none dropped.

Manual browser checklist:
- Click "Nova Vistoria (Check-in)" → modal opens on step 1 (room select + responsáveis), dot 1 highlighted.
- Try clicking "Continuar" with responsável cliente empty → browser's native validation message appears, stays on step 1 (only if that field is marked `required` today — if it isn't, this check is a no-op, that's fine, don't add new `required` attributes not already present).
- Fill step 1, click "Continuar" → step 2 (checklist) shows, dot 2 highlighted, dot 1 shows completed style.
- Click "Voltar" → back to step 1 with the same values still filled in.
- Advance to step 3 (fotos) → "Confirmar Entrada" button appears, "Continuar" is gone.
- Click "Confirmar Entrada" → check-in registers exactly as before (same toast, same room-card behavior).
- Close and reopen the modal → back on step 1.
- Edit an existing check-in (pencil icon on an occupied room card) → modal opens on step 1, not mid-wizard.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat: turn check-in modal into a 3-step wizard (Dados/Checklist/Fotos)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Passos do Check-out (mesmo padrão em `#checkout-modal`)

**Files:**
- Modify: `index.html:2091-2136` (`#checkout-modal` HTML)
- Modify: `index.html:2509-2518` (const declarations for checkout modal fields)
- Modify: `index.html:3399-3447` (`window.openCheckoutModal` — reset to step 1 on open)
- Modify: `index.html:3704-3748` (edit-mode check-out branch inside `window.triggerEditInspection` — reset to step 1 on open)

**Interfaces:**
- Consumes: the `.form-steps-indicator`/`.form-step-dot`/`.form-step-connector`/`.form-step`/`.form-step-nav` CSS classes from Task 2 (already in the shared `<style>` block by the time this task runs) — no new CSS needed in this task.
- Produces: `function goToCheckoutStep(step)` — same shape as `goToCheckinStep` from Task 2, but operating on `#checkout-modal`'s own elements. Not consumed by any other task.

- [ ] **Step 1: Reorganize `#checkout-modal`'s form into 3 `.form-step` blocks**

Current structure (verified at `index.html:2091-2136`):
```html
<div id="checkout-modal" class="modal-overlay">
    <div class="modal-content" style="max-height: 90vh; overflow-y: auto;">
        <h3 style="margin-top: 0; color: var(--text-primary); font-size: 1.2rem; margin-bottom: 4px;">Check-out (Devolução & Vistoria)</h3>
        <p id="checkout-modal-room-name" style="color: var(--primary); font-weight: bold; margin-bottom: 20px; font-size: 0.95rem;">Sala: -</p>

        <form id="checkout-form">
            <input type="hidden" id="checkout-room-id">

            <div class="form-group-grid">
                <div class="form-group">
                    <label class="form-label" for="checkout-resp-cliente">Quem Devolveu</label>
                    <input type="text" id="checkout-resp-cliente" ...>
                </div>
                <div class="form-group">
                    <label class="form-label" for="checkout-operador-arena">Vistoriador Arena</label>
                    <input type="text" id="checkout-operador-arena" ...>
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Checklist de Integridade</label>
                <div class="inspection-checklist" id="checkout-checklist-container">...</div>
            </div>

            <div class="form-group">
                <label class="form-label">Evidências Fotográficas (Saída)</label>
                <div class="photos-uploader-container">...</div>
            </div>

            <div style="display: flex; gap: 12px; margin-top: 24px;">
                <button type="button" class="btn-secondary" id="btn-close-checkout" style="flex: 1;">Cancelar</button>
                <button type="button" class="btn-submit" id="btn-submit-checkout" style="flex: 2;">Confirmar Saída</button>
            </div>
        </form>
    </div>
</div>
```

Replace with:
```html
<div id="checkout-modal" class="modal-overlay">
    <div class="modal-content" style="max-height: 90vh; overflow-y: auto;">
        <h3 style="margin-top: 0; color: var(--text-primary); font-size: 1.2rem; margin-bottom: 4px;">Check-out (Devolução & Vistoria)</h3>
        <p id="checkout-modal-room-name" style="color: var(--primary); font-weight: bold; margin-bottom: 20px; font-size: 0.95rem;">Sala: -</p>

        <div class="form-steps-indicator" id="checkout-steps-indicator">
            <span class="form-step-dot active" data-step-dot="1">1</span>
            <span class="form-step-connector"></span>
            <span class="form-step-dot" data-step-dot="2">2</span>
            <span class="form-step-connector"></span>
            <span class="form-step-dot" data-step-dot="3">3</span>
        </div>

        <form id="checkout-form">
            <input type="hidden" id="checkout-room-id">

            <div class="form-step active" data-step="1">
                <div class="form-group-grid">
                    <div class="form-group">
                        <label class="form-label" for="checkout-resp-cliente">Quem Devolveu</label>
                        <input type="text" id="checkout-resp-cliente" class="input-text" placeholder="Nome do Cliente" autocomplete="off">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="checkout-operador-arena">Vistoriador Arena</label>
                        <input type="text" id="checkout-operador-arena" class="input-text" placeholder="Nome do Vistoriador" autocomplete="off">
                    </div>
                </div>
            </div>

            <div class="form-step" data-step="2">
                <div class="form-group">
                    <label class="form-label">Checklist de Integridade</label>
                    <div class="inspection-checklist" id="checkout-checklist-container">
                        <!-- Items rendered dynamically via JS -->
                    </div>
                </div>
            </div>

            <div class="form-step" data-step="3">
                <div class="form-group">
                    <label class="form-label">Evidências Fotográficas (Saída)</label>
                    <div class="photos-uploader-container">
                        <label class="btn-photo-capture" for="checkout-camera-input">
                            📸 Tirar Foto / Galeria
                        </label>
                        <input type="file" id="checkout-camera-input" accept="image/*" capture="environment" multiple style="display: none;">
                        <div class="photos-thumbnail-grid" id="checkout-photos-thumbnails">
                            <!-- Thumbnails rendered dynamically -->
                        </div>
                    </div>
                </div>
            </div>

            <div class="form-step-nav">
                <button type="button" class="btn-secondary" id="btn-close-checkout" style="flex: 1;">Cancelar</button>
                <button type="button" class="btn-secondary" id="btn-checkout-back" style="flex: 1; display: none;">Voltar</button>
                <button type="button" class="btn-submit" id="btn-checkout-next" style="flex: 2;">Continuar</button>
                <button type="button" class="btn-submit" id="btn-submit-checkout" style="flex: 2; display: none;">Confirmar Saída</button>
            </div>
        </form>
    </div>
</div>
```

- [ ] **Step 2: Add the new DOM consts, right after the existing checkout modal consts (`index.html:2509-2518`)**

```javascript
const checkoutModal = document.getElementById('checkout-modal');
// ... (existing lines unchanged) ...
const checkoutStepDots = document.querySelectorAll('#checkout-steps-indicator [data-step-dot]');
const checkoutFormSteps = document.querySelectorAll('#checkout-form [data-step]');
const btnCheckoutBack = document.getElementById('btn-checkout-back');
const btnCheckoutNext = document.getElementById('btn-checkout-next');
let checkoutCurrentStep = 1;
```

- [ ] **Step 3: Define `goToCheckoutStep` and wire Voltar/Continuar**

Add right after the checkout modal consts block, before `window.openCheckoutModal`'s definition (`index.html:3399`):

```javascript
function goToCheckoutStep(step) {
    checkoutCurrentStep = step;
    checkoutFormSteps.forEach(el => {
        el.classList.toggle('active', parseInt(el.getAttribute('data-step')) === step);
    });
    checkoutStepDots.forEach(dot => {
        const dotStep = parseInt(dot.getAttribute('data-step-dot'));
        dot.classList.toggle('active', dotStep === step);
        dot.classList.toggle('completed', dotStep < step);
    });
    btnCheckoutBack.style.display = step === 1 ? 'none' : 'flex';
    btnCheckoutNext.style.display = step === 3 ? 'none' : 'flex';
    btnSubmitCheckout.style.display = step === 3 ? 'flex' : 'none';
}

btnCheckoutBack.addEventListener('click', () => {
    if (checkoutCurrentStep > 1) goToCheckoutStep(checkoutCurrentStep - 1);
});

btnCheckoutNext.addEventListener('click', () => {
    const currentStepEl = document.querySelector(`#checkout-form [data-step="${checkoutCurrentStep}"]`);
    const invalidField = Array.from(currentStepEl.querySelectorAll('input, select')).find(el => !el.checkValidity());
    if (invalidField) {
        invalidField.reportValidity();
        return;
    }
    if (checkoutCurrentStep < 3) goToCheckoutStep(checkoutCurrentStep + 1);
});
```

- [ ] **Step 4: Reset to step 1 on both places the modal is opened**

In `window.openCheckoutModal` (`index.html:3399-3447`), add `goToCheckoutStep(1);` right before `checkoutModal.classList.add('show');`:
```javascript
    goToCheckoutStep(1);
    checkoutModal.classList.add('show');
};
```

In the check-out branch of `window.triggerEditInspection` (`index.html:3704-3748`, ends `checkoutModal.classList.add('show');` at line 3747), add the same call right before it:
```javascript
    goToCheckoutStep(1);
    checkoutModal.classList.add('show');
}
```

- [ ] **Step 5: Verify**

```bash
grep -n "goToCheckoutStep\|checkoutFormSteps\|checkoutStepDots\|btn-checkout-back\|btn-checkout-next" index.html
```
Read the modified `#checkout-modal` block back and confirm every original `id` (`checkout-room-id`, `checkout-resp-cliente`, `checkout-operador-arena`, `checkout-checklist-container`, `checkout-camera-input`, `checkout-photos-thumbnails`, `btn-close-checkout`, `btn-submit-checkout`) is still present exactly once.

Manual browser checklist:
- Click "Realizar Check-out" on an occupied room card → modal opens on step 1 (quem devolveu / vistoriador), dot 1 highlighted, room name still shown correctly above the steps.
- Fill step 1, "Continuar" → step 2 (checklist de integridade). "Voltar" returns to step 1 with values intact.
- Advance to step 3 (fotos) → "Confirmar Saída" appears.
- Click "Confirmar Saída" → check-out completes exactly as before (comparison report still generates correctly afterward via "Ver Relatório").
- Close and reopen on a different room → step 1 again, and the room name/pre-filled "quem devolveu" from that room's check-in is still correct.
- Edit an existing check-out (via `triggerEditInspection`) → opens on step 1.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat: turn check-out modal into a 3-step wizard (Dados/Checklist/Fotos)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Polimento visual (badges, estados vazios, botão destrutivo, cabeçalhos de modal)

**Files:**
- Modify: `index.html` CSS block — add `.btn-danger` class, near `.btn-secondary` (~line 911-932)
- Modify: `index.html` CSS block — add `.modal-title` class, near `.filter-tab.active`
- Modify: `index.html:2917-3014` (`renderRoomsGrid` — fix empty-state check to use the filtered list, and use the "Remover Card" destructive button's new class)
- Modify: `index.html:3016-3037` (`renderInspectionsHistory` — styled empty state instead of a plain text row)
- Modify: `index.html:4354-4373` (`renderKeysHistory` — styled empty state instead of a plain text row)
- Modify: 7 modal `<h3>` headers (`index.html` lines 1915, 1956, 1977, 2004, 2041, 2093, 2141, 2221 — export, audit-log, novo-evento, checkin, checkout, comparison, key-loan modals) — replace inconsistent inline `style="margin-top: 0; ...; margin-bottom: Npx;"` with a shared `.modal-title` class

**Interfaces:** none — this task touches only presentation of existing, already-correct data; no new functions consumed by other tasks.

- [ ] **Step 1: Add `.btn-danger` and `.modal-title` CSS classes**

Add right after `.btn-secondary:active` (`index.html:928-932`):
```css
.btn-danger {
    background-color: var(--bg-surface-elevated);
    border: 1px solid var(--primary);
    color: var(--primary);
    padding: 14px;
    border-radius: var(--border-radius-pill);
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: var(--transition-smooth);
}

.btn-danger:active {
    background-color: var(--primary);
    color: white;
    transform: scale(0.98);
}
```

Add right after it:
```css
.modal-title {
    margin-top: 0;
    margin-bottom: 16px;
    color: var(--text-primary);
    font-size: 1.2rem;
    font-weight: 700;
}
```

- [ ] **Step 2: Fix `renderRoomsGrid`'s empty-state check to match what's actually rendered**

Current code (verified at `index.html:2917-2931`) checks the unfiltered array length but renders the filtered-by-event list — so with rooms active in other events but none in the current one, it silently renders nothing instead of the empty state:
```javascript
function renderRoomsGrid() {
    roomsListGrid.innerHTML = '';

    if (activeRoomsState.length === 0) {
        roomsListGrid.innerHTML = `...`;
        return;
    }

    activeRoomsState.filter(room => room.eventoId === currentEventoId).forEach(room => {
```
Change to:
```javascript
function renderRoomsGrid() {
    roomsListGrid.innerHTML = '';
    const roomsForEvento = activeRoomsState.filter(room => room.eventoId === currentEventoId);

    if (roomsForEvento.length === 0) {
        roomsListGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: var(--text-secondary); background: rgba(0, 0, 0, 0.02); border: 1px dashed var(--border-color); border-radius: 12px;">
                <span style="font-size: 2.5rem; display: block; margin-bottom: 12px;">🛋️</span>
                <span style="font-weight: 600; display: block; margin-bottom: 4px; color: var(--text-primary);">Nenhuma vistoria de sala ativa no momento</span>
                <span style="font-size: 0.85rem;">Clique no botão "Nova Vistoria (Check-in)" no topo para registrar uma nova vistoria.</span>
            </div>
        `;
        return;
    }

    roomsForEvento.forEach(room => {
```
(the closing `});` at the end of the loop, `index.html:3013`, is unchanged — `forEach` still closes the same way, only its receiver changed from `activeRoomsState.filter(...)` inline to the new `roomsForEvento` variable declared above).

- [ ] **Step 3: Use `.btn-danger` for the "Remover Card" button in `renderRoomsGrid`**

Current code (verified, inside the same function, the "Room is available" branch):
```javascript
actionButtonsHTML += `
    <button type="button" class="btn-secondary" onclick="archiveRoomCard('${room.id}')" style="margin-top: 8px; border-color: rgba(225, 21, 24, 0.3); color: rgba(225, 21, 24, 0.85); justify-content: center; width: 100%;">
        ❌ Remover Card da Tela
    </button>
`;
```
Change to:
```javascript
actionButtonsHTML += `
    <button type="button" class="btn-danger" onclick="archiveRoomCard('${room.id}')" style="margin-top: 8px; width: 100%;">
        ❌ Remover Card da Tela
    </button>
`;
```

- [ ] **Step 4: Give `renderInspectionsHistory` a styled empty state matching the rest of the app**

Current code (verified at `index.html:3016-3021`):
```javascript
function renderInspectionsHistory() {
    if (!inspectionsHistoryTableBody) return;
    const closed = roomInspections.filter(i => i.status !== 'Aberto' && i.eventoId === currentEventoId);
    if (closed.length === 0) {
        inspectionsHistoryTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-secondary);">Nenhuma vistoria concluída ainda.</td></tr>';
        return;
    }
```
Change the empty-state line to:
```javascript
    if (closed.length === 0) {
        inspectionsHistoryTableBody.innerHTML = `
            <tr><td colspan="6" style="padding: 0;">
                <div class="empty-state" style="padding: 32px 20px;">
                    <span style="font-size: 2rem;">📋</span>
                    <span style="font-weight: 600; color: var(--text-primary);">Nenhuma vistoria concluída ainda</span>
                    <span style="font-size: 0.85rem;">Vistorias aparecem aqui após o check-out.</span>
                </div>
            </td></tr>
        `;
        return;
    }
```
(`colspan="6"` matches this table's `<thead>` at `index.html:1865-1874`: Sala/Evento/Check-in/Check-out/Status/Relatório — 6 columns, unchanged from today).

- [ ] **Step 5: Give `renderKeysHistory` a styled empty state matching the rest of the app**

Current code (verified at `index.html:4366-4373`):
```javascript
if (filtered.length === 0) {
    keysHistoryTableBody.innerHTML = `
        <tr>
            <td colspan="5" style="text-align: center; padding: 20px; color: var(--text-secondary);">Nenhum histórico encontrado.</td>
        </tr>
    `;
    return;
}
```
Change to (also fixes a pre-existing off-by-one: the table's `<thead>`, at `index.html:1927-1936`, has 6 columns — Sala/Itens/Evento/Retirada/Devolução/Ações — but the empty-state cell above uses `colspan="5"`, one short):
```javascript
if (filtered.length === 0) {
    keysHistoryTableBody.innerHTML = `
        <tr><td colspan="6" style="padding: 0;">
            <div class="empty-state" style="padding: 32px 20px;">
                <span style="font-size: 2rem;">🔑</span>
                <span style="font-weight: 600; color: var(--text-primary);">Nenhum histórico encontrado</span>
                <span style="font-size: 0.85rem;">Devoluções de chave/controle aparecem aqui.</span>
            </div>
        </td></tr>
    `;
    return;
}
```

- [ ] **Step 6: Standardize the 7 modal headers to use `.modal-title`**

For each of these 7 lines, replace the inline-styled `<h3 style="...">` with `<h3 class="modal-title">`, keeping the exact text content unchanged. Read each line first to copy its exact current text before editing (some have a second inline-styled element right after, like `#checkout-modal-room-name` at `index.html:2094` — do not touch that second element, only the `<h3>` itself):

- `index.html:1915` — Histórico de Devoluções
- `index.html:1956` — Exportar Relatório
- `index.html:1977` — Log de Alterações de Empréstimos
- `index.html:2004` — Novo Evento
- `index.html:2041` — Check-in (Abertura de Sala & Chave)
- `index.html:2093` — Check-out (Devolução & Vistoria)
- `index.html:2141` — Relatório Comparativo de Vistoria
- `index.html:2221` — Registrar Entrega de Chave / Controle

Example (line 1956, before → after):
```html
<h3 style="margin-top: 0; color: var(--text-primary); font-size: 1.2rem; margin-bottom: 8px;">Exportar Relatório</h3>
```
→
```html
<h3 class="modal-title">Exportar Relatório</h3>
```

Note the checkin/checkout modal titles (lines 2041, 2093) got new content in Task 2/3 (the step indicator was inserted right after them) — if Tasks 2-3 already ran, these two `<h3>` tags still exist unchanged just above the step indicator; apply the same class swap to them too.

- [ ] **Step 7: Verify**

```bash
grep -c "class=\"modal-title\"" index.html
```
Expected: 8 (the 7 listed above — some plans list 8 lines, double check by counting the actual list above; if it's 8 lines, expect 8 matches).

```bash
grep -n "btn-danger\|roomsForEvento" index.html
```
Expected: `.btn-danger`/`.btn-danger:active` CSS rules + the one HTML usage in `renderRoomsGrid`; `roomsForEvento` appears 3 times (declaration, the `.length === 0` check, the `.forEach`).

Read back `renderInspectionsHistory` and `renderKeysHistory` in full to confirm the rest of each function (the non-empty-state render path) is byte-for-byte unchanged.

Manual browser checklist:
- With an event that has zero room check-ins and zero completed inspections: Vistorias tab shows the existing dashed-border empty state for the active-rooms grid, and the new icon+message empty state (not a plain text row) for "Histórico de Vistorias".
- With an event that has zero active key loans and zero key history: Chaves tab shows the existing empty state for the mural and the new icon+message empty state for the history table.
- On an available room card, "Remover Card da Tela" now renders as an outlined red pill button (same visual family as other secondary buttons, but clearly marked destructive) instead of a `.btn-secondary` with ad-hoc inline color overrides.
- Open every modal in the app (Histórico de Devoluções, Exportar Relatório, Log de Alterações, Novo Evento, Check-in, Check-out, Relatório Comparativo, Registrar Entrega de Chave) — all 7-8 titles now have identical spacing below them.
- Enter an event that DOES have active rooms in another event but none in the current one (if reachable in your test data) — confirm the empty state now shows instead of a blank grid.

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
style: consistent empty states, destructive-button class, and modal titles

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
