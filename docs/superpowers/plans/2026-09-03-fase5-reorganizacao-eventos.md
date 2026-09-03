# Fase 5 — Reorganização por Evento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "Evento" a first-class Firebase-backed entity and the app's primary navigation concept — operators pick/create an event before doing anything else, and every furniture loan, room check-in, and key/AC loan created afterward is automatically tied to it.

**Architecture:** New `eventos` Firebase collection (same granular per-ID write pattern as every other collection since Fase 1). A new `#panel-eventos` screen becomes the app's landing screen; entering an event sets an in-memory `currentEventoId` (persisted to `localStorage` so a refresh doesn't lose context) and reveals the existing 3 tabs, now scoped to that event. `loans`, `keyLoans`, `activeRoomsState`, and `roomInspections` records gain an `eventoId` field, replacing the free-text `evento` field they had before. Room/key physical-occupancy checks are explicitly NOT scoped by event — a room or key is a shared physical resource, not tied to one event.

**Tech Stack:** Vanilla JS, Firebase Realtime Database (compat SDK 10.8.0), no build tooling, no test framework.

## Global Constraints

- Spec source of truth: `docs/superpowers/specs/2026-09-03-fase5-reorganizacao-eventos-design.md`.
- Every new Firebase collection write goes through the existing `sanitize()` helper and uses granular per-ID writes (`db.ref(collection + '/' + id).set(...)`) — never a full-collection overwrite.
- Room/key occupancy checks (`activeRoomsState.find(r => r.id === roomId && r.statusSala === 'Em Uso')`, used both in the check-in race-guard and in the "available rooms" filter) must NEVER be filtered by `eventoId` — they must always see all events. Only the *rendering* of `activeRoomsState`/`keyLoans`/`loans`/`roomInspections` is scoped to `currentEventoId`.
- `predefinedRooms` and `roomInventories` are NOT touched by this phase — they stay global, unscoped catalogs.
- No automated test suite and no browser access for implementers/reviewers in this environment. Verification is code-level (grep, brace/paren balance, manual diff tracing) plus manual browser steps the human operator runs afterward.
- Follow existing code conventions exactly: 12-space (or deeper, matching nesting) indentation inside the `<script>` block, reuse of existing CSS classes (`.modal-overlay`/`.modal-content`, `.room-card`/`.rooms-grid`, `.form-group`, `.input-text`, `.btn-submit`/`.btn-secondary`) rather than inventing new component styles.
- **Not part of this plan, do not build it:** wiping `loans`/`keyLoans`/`keyHistory`/`activeRoomsState`/`roomInspections`/`auditLog` in production Firebase. Per the spec, that's a manual, one-time operational step the human does directly in the Firebase console after this branch merges — no button, no UI, no task in this plan touches it.

---

## File Structure

Single file, `index.html`. No new files. This phase touches: the `<style>` block (new `.event-card`/`.current-event-bar` rules, reusing existing tokens), the HTML body (new `#panel-eventos` screen, a "novo evento" modal, a new event-bar element, and edits to the 3 existing panels — removing the free-text event fields and relocating the finalize-event button), and the `<script>` block (new state/sync/render functions for `eventos`, and edits to every existing create/edit/render function that touched the old `evento` field).

## Task 1: `eventos` collection — state, sync, seeding, listener, name-lookup helper

**Files:**
- Modify: `index.html` (script only)

**Interfaces:**
- Produces: `let eventos` (array), `let currentEventoId` (string or `null`), `function syncEventoUpsert(evento)`, `function getEventoNome(eventoId)` → `string`. All later tasks call `getEventoNome` wherever the old `evento` text field used to be displayed, and read `currentEventoId` wherever the old `evento` text field used to be written on creation.
- This task's Firebase listener does NOT call any render function yet (the events screen doesn't exist until Task 3, which will add that call) — same pattern Fase 3 used for `auditLog`.

- [ ] **Step 1: Add the `eventos` and `currentEventoId` state**

In `index.html`, the `auditLog` state declaration currently reads:

```js
            let auditLog = [];
            try { auditLog = JSON.parse(localStorage.getItem('arena_audit_log')) || []; } catch(e) { auditLog = []; }
            if (!Array.isArray(auditLog)) auditLog = [];
```

Add right after it:

```js
            let auditLog = [];
            try { auditLog = JSON.parse(localStorage.getItem('arena_audit_log')) || []; } catch(e) { auditLog = []; }
            if (!Array.isArray(auditLog)) auditLog = [];

            let eventos = [];
            try { eventos = JSON.parse(localStorage.getItem('arena_eventos')) || []; } catch(e) { eventos = []; }
            if (!Array.isArray(eventos)) eventos = [];

            let currentEventoId = null;
            try { currentEventoId = localStorage.getItem('arena_current_evento_id') || null; } catch(e) { currentEventoId = null; }
```

- [ ] **Step 2: Add the sync helper and the name-lookup helper**

In `index.html`, right after `syncKeyLoanUpsert`:

```js
            function syncKeyLoanUpsert(loan) {
                db.ref('keyLoans/' + loan.id).set(sanitize(loan)).catch(err => console.error("Error saving key loan:", err));
            }
```

Add:

```js
            function syncKeyLoanUpsert(loan) {
                db.ref('keyLoans/' + loan.id).set(sanitize(loan)).catch(err => console.error("Error saving key loan:", err));
            }

            function syncEventoUpsert(evento) {
                db.ref('eventos/' + evento.id).set(sanitize(evento)).catch(err => console.error("Error saving evento:", err));
            }

            // Resolves an eventoId to its event's display name. Every loan/keyLoan/
            // inspection record stores only the id (eventoId), never the name, so any
            // screen that used to show a free-text "evento" field now looks it up here.
            function getEventoNome(eventoId) {
                const evento = eventos.find(e => e.id === eventoId);
                return evento ? evento.nome : '-';
            }
```

- [ ] **Step 3: Add the Firebase listener**

In `index.html`, inside `setupDatabaseListeners()`, the last listener is `auditLog`:

```js
                db.ref('auditLog').on('value', (snapshot) => {
                    const val = snapshot.val();
                    auditLog = val && typeof val === 'object' ? Object.values(val).filter(Boolean) : (Array.isArray(val) ? val : []);
                    localStorage.setItem('arena_audit_log', JSON.stringify(auditLog));
                    renderAuditLog();
                });
            }
```

Add a new listener before the closing `}` of the function:

```js
                db.ref('auditLog').on('value', (snapshot) => {
                    const val = snapshot.val();
                    auditLog = val && typeof val === 'object' ? Object.values(val).filter(Boolean) : (Array.isArray(val) ? val : []);
                    localStorage.setItem('arena_audit_log', JSON.stringify(auditLog));
                    renderAuditLog();
                });

                db.ref('eventos').on('value', (snapshot) => {
                    const val = snapshot.val();
                    eventos = val && typeof val === 'object' ? Object.values(val).filter(Boolean) : (Array.isArray(val) ? val : []);
                    localStorage.setItem('arena_eventos', JSON.stringify(eventos));
                });
            }
```

Note: this listener does **not** call a render function yet — the Eventos screen (and its `renderEventos()` function) doesn't exist until Task 3, which will add that call to this exact block.

- [ ] **Step 4: Add Firebase seeding**

In `index.html`, the last seed check is `auditLog`, right before `Promise.all(migrations)...`:

```js
                if (val.auditLog === undefined) {
                    console.log("Coleção 'auditLog' vazia no Firebase. Semeando com dados locais.");
                    db.ref('auditLog').set(toIdMap(auditLog)).catch(err => console.error("Error seeding auditLog:", err));
                }

                Promise.all(migrations).then(() => setupDatabaseListeners());
```

Add a new seed check before `Promise.all(migrations)...`:

```js
                if (val.auditLog === undefined) {
                    console.log("Coleção 'auditLog' vazia no Firebase. Semeando com dados locais.");
                    db.ref('auditLog').set(toIdMap(auditLog)).catch(err => console.error("Error seeding auditLog:", err));
                }
                if (val.eventos === undefined) {
                    console.log("Coleção 'eventos' vazia no Firebase. Semeando com dados locais.");
                    db.ref('eventos').set(toIdMap(eventos)).catch(err => console.error("Error seeding eventos:", err));
                }

                Promise.all(migrations).then(() => setupDatabaseListeners());
```

No array-to-map migration is needed for `eventos` — it's a brand-new collection with no legacy array-shaped data.

- [ ] **Step 5: Verify**

Code-level checks:
- Grep for `eventos` across the file — confirm it now appears in: the state declaration, `syncEventoUpsert`, `getEventoNome`, the new listener, and the new seed check. No stray references yet (this task adds no UI).
- Grep for `getEventoNome(` — exactly one match (the function definition itself; no call sites yet, those come in later tasks).
- Confirm `toIdMap(eventos)` reuses the existing `toIdMap` helper — do not redefine it.
- Confirm brace/paren balance around every block touched.

Manual verification (via browser dev tools console, after this task lands):
- Run `syncEventoUpsert({id: 'test-1', nome: 'Teste', cliente: 'Cliente Teste', dataInicio: '2026-09-01', dataFim: '2026-09-02', status: 'ativo'})` in the console. Confirm `eventos` now contains it, `localStorage.getItem('arena_eventos')` includes it, and the Firebase console shows a new `eventos/test-1` record.
- Run `getEventoNome('test-1')` — confirm it returns `'Teste'`. Run `getEventoNome('nao-existe')` — confirm it returns `'-'`.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add eventos Firebase collection, sync helper, and name-lookup helper"
```

## Task 2: Eventos screen — HTML and CSS

**Files:**
- Modify: `index.html` (HTML + CSS)

**Interfaces:**
- Produces: `#panel-eventos` (new top-level panel, sibling of `#panel-loans`/`#panel-inspections`/`#panel-keys`), `#novo-evento-modal` (new modal), `#current-event-bar` (new element between `.app-navigation` and `<main>`). All DOM ids referenced here are consumed by Task 3's JS.
- No JS in this task — pure markup/CSS. `#panel-loans` gains `style="display: none;"` (it's visible by default today; from this phase on, nothing is visible until an event is entered) and `.app-navigation` gains `style="display: none;"` too, for the same reason.

- [ ] **Step 1: Hide the loans panel and nav tabs by default**

In `index.html`, the app navigation and loans panel currently read:

```html
        <!-- App Navigation Tabs -->
        <div class="app-navigation">
            <button type="button" class="nav-tab-btn active" id="tab-loans" data-panel="loans">
                Controle de empréstimo de mobiliário
            </button>
            <button type="button" class="nav-tab-btn" id="tab-inspections" data-panel="inspections">
                Controle de check-in e check-out de salas
            </button>
            <button type="button" class="nav-tab-btn" id="tab-keys" data-panel="keys">
                Controle de chaves e ar condicionado
            </button>
        </div>

        <main>
            <div id="panel-loans">
```

Replace with:

```html
        <!-- App Navigation Tabs -->
        <div class="app-navigation" id="app-navigation" style="display: none;">
            <button type="button" class="nav-tab-btn active" id="tab-loans" data-panel="loans">
                Controle de empréstimo de mobiliário
            </button>
            <button type="button" class="nav-tab-btn" id="tab-inspections" data-panel="inspections">
                Controle de check-in e check-out de salas
            </button>
            <button type="button" class="nav-tab-btn" id="tab-keys" data-panel="keys">
                Controle de chaves e ar condicionado
            </button>
        </div>

        <!-- Current Event Bar (shown only while inside an event) -->
        <div class="current-event-bar" id="current-event-bar" style="display: none;">
            <div class="current-event-bar-info">
                <span class="current-event-bar-label">Evento atual</span>
                <span class="current-event-bar-name" id="current-event-bar-name">-</span>
            </div>
            <div class="current-event-bar-actions">
                <button type="button" class="btn-secondary" id="btn-finalize-event" style="border-color: var(--primary); color: var(--primary);">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    Encerrar Evento
                </button>
                <button type="button" class="btn-secondary" id="btn-exit-evento">
                    Trocar de Evento
                </button>
            </div>
        </div>

        <main>
            <div id="panel-eventos">
                <section class="section-card">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 15px;">
                        <div>
                            <h2 class="section-title" style="margin-bottom: 4px;">Eventos</h2>
                            <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">
                                Escolha um evento ativo para continuar, ou crie um novo.
                            </p>
                        </div>
                        <button type="button" class="btn-submit" id="btn-new-evento" style="justify-content: center; min-width: 200px; margin: 0;">
                            + Novo Evento
                        </button>
                    </div>

                    <div class="filter-tabs" style="margin-bottom: 20px;">
                        <button class="filter-tab active" data-evento-filter="ativo">Ativos</button>
                        <button class="filter-tab" data-evento-filter="encerrado">Encerrados</button>
                    </div>

                    <div class="rooms-grid" id="eventos-grid">
                        <!-- Rendered Dynamically via JS -->
                    </div>
                </section>
            </div>

            <div id="panel-loans" style="display: none;">
```

- [ ] **Step 2: Add the "Novo Evento" modal**

In `index.html`, the audit log modal closes right before the check-in modal opens (search for `<!-- Check-in Modal -->`). Insert the new modal right before that comment:

```html
    <!-- Novo Evento Modal -->
    <div id="novo-evento-modal" class="modal-overlay">
        <div class="modal-content">
            <h3 style="margin-top: 0; color: var(--text-primary); font-size: 1.2rem; margin-bottom: 20px;">Novo Evento</h3>

            <div class="form-group" style="margin-bottom: 15px;">
                <label class="form-label" for="novo-evento-nome">Nome do Evento</label>
                <input type="text" id="novo-evento-nome" class="input-text" placeholder="Ex: Show do Coldplay, Jogo de Basquete..." autocomplete="off">
            </div>

            <div class="form-group" style="margin-bottom: 15px;">
                <label class="form-label" for="novo-evento-cliente">Cliente</label>
                <input type="text" id="novo-evento-cliente" class="input-text" placeholder="Nome do cliente/responsável" autocomplete="off">
            </div>

            <div class="form-group-grid" style="margin-bottom: 20px;">
                <div class="form-group">
                    <label class="form-label" for="novo-evento-data-inicio">Data Início</label>
                    <input type="date" id="novo-evento-data-inicio" class="input-text" style="width: 100%; height: 44px; padding: 0 10px; background-color: var(--bg-surface-elevated); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 8px; font-family: inherit;">
                </div>
                <div class="form-group">
                    <label class="form-label" for="novo-evento-data-fim">Data Fim</label>
                    <input type="date" id="novo-evento-data-fim" class="input-text" style="width: 100%; height: 44px; padding: 0 10px; background-color: var(--bg-surface-elevated); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 8px; font-family: inherit;">
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button type="button" class="btn-submit" id="btn-save-evento" style="justify-content: center;">
                    Criar e Entrar no Evento
                </button>
                <button type="button" class="btn-secondary" id="btn-close-novo-evento" style="justify-content: center;">
                    Cancelar
                </button>
            </div>
        </div>
    </div>

    <!-- Check-in Modal -->
```

- [ ] **Step 3: Add CSS for the event card and the current-event bar**

In `index.html`, in the `<style>` block, add these new rules right after the `.room-card` / `.rooms-grid` rules end (search for the CSS rule `.rooms-grid {` and add after the whole block of `.room-card*` rules that follow it — if unsure exactly where that block ends, it's safe to add these new rules anywhere inside the `<style>` block after `.rooms-grid`'s definition, since none of these selectors overlap with existing ones):

```css
        .event-card {
            background-color: var(--bg-surface);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius-md);
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            cursor: pointer;
            transition: var(--transition-smooth);
        }

        .event-card:active {
            transform: scale(0.98);
        }

        .event-card-nome {
            font-size: 1.05rem;
            font-weight: 700;
            color: var(--text-primary);
        }

        .event-card-cliente {
            font-size: 0.85rem;
            color: var(--text-secondary);
        }

        .event-card-datas {
            font-size: 0.8rem;
            color: var(--text-muted);
        }

        .event-card-badge {
            align-self: flex-start;
            font-size: 0.7rem;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: var(--border-radius-pill);
            background-color: var(--success-glow);
            color: var(--success);
            border: 1px solid rgba(13, 148, 103, 0.2);
        }

        .current-event-bar {
            background-color: var(--bg-surface);
            border-bottom: 1px solid var(--border-color);
            padding: 12px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
        }

        .current-event-bar-info {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .current-event-bar-label {
            text-transform: uppercase;
            letter-spacing: 0.05em;
            font-size: 0.68rem;
            font-weight: 700;
            color: var(--text-muted);
        }

        .current-event-bar-name {
            font-size: 1rem;
            font-weight: 800;
            color: var(--text-primary);
        }

        .current-event-bar-actions {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
```

- [ ] **Step 4: Verify**

Code-level checks:
- Grep for `panel-eventos` — matches the new panel's `id` and (in Task 3) its JS reference.
- Grep for `id="app-navigation"` — exactly one match (the nav div now has this new id, needed so Task 3's JS can toggle its visibility).
- Grep for `btn-finalize-event` — exactly one match, now inside `#current-event-bar`, not inside `#panel-loans` anymore.
- Confirm `#panel-loans` now has `style="display: none;"` in its opening tag.
- Confirm HTML nesting is valid: `#panel-eventos`, `#panel-loans`, `#panel-inspections`, `#panel-keys` are all siblings directly inside `<main>`.
- Confirm the new modal is a sibling `.modal-overlay` div, not nested inside another modal.

Manual verification: none yet — this task has no JS wiring, so nothing is interactive. The Eventos screen will visibly render (as an empty grid) once the app loads, but the "Novo Evento" button won't do anything until Task 3.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add Eventos screen, novo-evento modal, and current-event bar markup"
```

## Task 3: Eventos screen — render, create, enter/exit navigation

**Files:**
- Modify: `index.html` (script only)

**Interfaces:**
- Consumes: `eventos`, `currentEventoId`, `syncEventoUpsert`, `getEventoNome` (Task 1); `#panel-eventos`, `#eventos-grid`, `#novo-evento-modal` and its fields, `#current-event-bar`, `#app-navigation`, `#btn-new-evento`, `#btn-exit-evento` (Task 2).
- Produces: `function renderEventos()` (also wired into Task 1's `eventos` Firebase listener, mirroring how Fase 3's audit log listener got its render call added in the task that built the viewer), `function enterEvento(eventoId)`, `function exitEvento()`. Tasks 4-7 don't call these directly, but rely on `currentEventoId` being correctly set/cleared by them.

- [ ] **Step 1: Add DOM element references**

In `index.html`, the audit log modal's element consts currently read:

```js
            const auditLogModal = document.getElementById('audit-log-modal');
            const auditLogTableBody = document.getElementById('audit-log-table-body');
            const btnViewAuditLog = document.getElementById('btn-view-audit-log');
            const btnCloseAuditLog = document.getElementById('btn-close-audit-log');
```

Add right after:

```js
            const auditLogModal = document.getElementById('audit-log-modal');
            const auditLogTableBody = document.getElementById('audit-log-table-body');
            const btnViewAuditLog = document.getElementById('btn-view-audit-log');
            const btnCloseAuditLog = document.getElementById('btn-close-audit-log');

            // Eventos screen
            const appNavigation = document.getElementById('app-navigation');
            const panelEventos = document.getElementById('panel-eventos');
            const eventosGrid = document.getElementById('eventos-grid');
            const eventoFilterTabs = document.querySelectorAll('[data-evento-filter]');
            const btnNewEvento = document.getElementById('btn-new-evento');
            const novoEventoModal = document.getElementById('novo-evento-modal');
            const novoEventoNome = document.getElementById('novo-evento-nome');
            const novoEventoCliente = document.getElementById('novo-evento-cliente');
            const novoEventoDataInicio = document.getElementById('novo-evento-data-inicio');
            const novoEventoDataFim = document.getElementById('novo-evento-data-fim');
            const btnSaveEvento = document.getElementById('btn-save-evento');
            const btnCloseNovoEvento = document.getElementById('btn-close-novo-evento');
            const currentEventBar = document.getElementById('current-event-bar');
            const currentEventBarName = document.getElementById('current-event-bar-name');
            const btnExitEvento = document.getElementById('btn-exit-evento');
            let currentEventoFilter = 'ativo';
```

- [ ] **Step 2: Add `renderEventos()`**

In `index.html`, right after `getEventoNome`'s definition (from Task 1):

```js
            function getEventoNome(eventoId) {
                const evento = eventos.find(e => e.id === eventoId);
                return evento ? evento.nome : '-';
            }
```

Add:

```js
            function getEventoNome(eventoId) {
                const evento = eventos.find(e => e.id === eventoId);
                return evento ? evento.nome : '-';
            }

            function countActiveItemsForEvento(eventoId) {
                const activeLoans = loans.filter(l => l.eventoId === eventoId && !l.devolvido).length;
                const activeKeys = keyLoans.filter(l => l.eventoId === eventoId).length;
                const openInspections = roomInspections.filter(i => i.eventoId === eventoId && i.status === 'Aberto').length;
                return activeLoans + activeKeys + openInspections;
            }

            function renderEventos() {
                if (!eventosGrid) return;
                const filtered = eventos.filter(e => e.status === currentEventoFilter);
                if (filtered.length === 0) {
                    eventosGrid.innerHTML = `
                        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: var(--text-secondary); background: rgba(0, 0, 0, 0.02); border: 1px dashed var(--border-color); border-radius: 12px;">
                            <span style="font-size: 2.5rem; display: block; margin-bottom: 12px;">🎪</span>
                            <span style="font-weight: 600; display: block; margin-bottom: 4px; color: var(--text-primary);">${currentEventoFilter === 'ativo' ? 'Nenhum evento ativo' : 'Nenhum evento encerrado'}</span>
                            <span style="font-size: 0.85rem;">${currentEventoFilter === 'ativo' ? 'Clique em "+ Novo Evento" para começar.' : ''}</span>
                        </div>
                    `;
                    return;
                }
                const sorted = filtered.slice().sort((a, b) => new Date(b.dataInicio) - new Date(a.dataInicio));
                eventosGrid.innerHTML = sorted.map(evento => {
                    const countLabel = evento.status === 'ativo' ? `<span class="event-card-badge">${countActiveItemsForEvento(evento.id)} ativo(s)</span>` : '';
                    return `
                        <div class="event-card" onclick="enterEvento('${evento.id}')">
                            <span class="event-card-nome">${evento.nome}</span>
                            <span class="event-card-cliente">${evento.cliente || '-'}</span>
                            <span class="event-card-datas">${evento.dataInicio || '-'} a ${evento.dataFim || '-'}</span>
                            ${countLabel}
                        </div>
                    `;
                }).join('');
            }

            eventoFilterTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    eventoFilterTabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    currentEventoFilter = tab.getAttribute('data-evento-filter');
                    renderEventos();
                });
            });
```

`enterEvento` is defined as `window.enterEvento` in Step 4 below (needs to be global since it's called from an inline `onclick`).

- [ ] **Step 3: Wire the Firebase listener to call `renderEventos()`**

In `index.html`, find the `eventos` listener added in Task 1:

```js
                db.ref('eventos').on('value', (snapshot) => {
                    const val = snapshot.val();
                    eventos = val && typeof val === 'object' ? Object.values(val).filter(Boolean) : (Array.isArray(val) ? val : []);
                    localStorage.setItem('arena_eventos', JSON.stringify(eventos));
                });
```

Add a `renderEventos();` call:

```js
                db.ref('eventos').on('value', (snapshot) => {
                    const val = snapshot.val();
                    eventos = val && typeof val === 'object' ? Object.values(val).filter(Boolean) : (Array.isArray(val) ? val : []);
                    localStorage.setItem('arena_eventos', JSON.stringify(eventos));
                    renderEventos();
                });
```

- [ ] **Step 4: Add `enterEvento`/`exitEvento` and wire the buttons**

In `index.html`, right after the `eventoFilterTabs.forEach(...)` block from Step 2, add:

```js
            window.enterEvento = function(eventoId) {
                currentEventoId = eventoId;
                try { localStorage.setItem('arena_current_evento_id', eventoId); } catch (e) {}

                const evento = eventos.find(e => e.id === eventoId);
                currentEventBarName.textContent = evento ? evento.nome : '-';
                currentEventBar.style.display = 'flex';

                panelEventos.style.display = 'none';
                appNavigation.style.display = 'flex';

                tabLoans.classList.add('active');
                tabInspections.classList.remove('active');
                tabKeys.classList.remove('active');
                panelLoans.style.display = 'block';
                panelInspections.style.display = 'none';
                panelKeys.style.display = 'none';

                renderHistory();
                updateActiveCounter();
            };

            function exitEvento() {
                currentEventoId = null;
                try { localStorage.removeItem('arena_current_evento_id'); } catch (e) {}

                currentEventBar.style.display = 'none';
                appNavigation.style.display = 'none';
                panelLoans.style.display = 'none';
                panelInspections.style.display = 'none';
                panelKeys.style.display = 'none';

                panelEventos.style.display = 'block';
                renderEventos();
            }

            btnExitEvento.addEventListener('click', exitEvento);

            btnNewEvento.addEventListener('click', () => {
                novoEventoNome.value = '';
                novoEventoCliente.value = '';
                novoEventoDataInicio.value = '';
                novoEventoDataFim.value = '';
                novoEventoModal.classList.add('show');
            });

            btnCloseNovoEvento.addEventListener('click', () => {
                novoEventoModal.classList.remove('show');
            });

            novoEventoModal.addEventListener('click', (e) => {
                if (e.target === novoEventoModal) {
                    novoEventoModal.classList.remove('show');
                }
            });

            btnSaveEvento.addEventListener('click', () => {
                const nome = novoEventoNome.value.trim();
                const cliente = novoEventoCliente.value.trim();
                const dataInicio = novoEventoDataInicio.value;
                const dataFim = novoEventoDataFim.value;

                if (!nome) {
                    showToast('Informe o nome do evento.', '⚠️');
                    return;
                }

                const novoEvento = {
                    id: 'evt-' + Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5),
                    nome: nome,
                    cliente: cliente,
                    dataInicio: dataInicio,
                    dataFim: dataFim,
                    status: 'ativo',
                    criadoEm: new Date().toISOString()
                };

                eventos.unshift(novoEvento);
                localStorage.setItem('arena_eventos', JSON.stringify(eventos));
                syncEventoUpsert(novoEvento);

                novoEventoModal.classList.remove('show');
                showToast('Evento criado!', '🎪');
                enterEvento(novoEvento.id);
            });
```

- [ ] **Step 5: Auto-restore the current event on load, or show the Eventos screen**

In `index.html`, find:

```js
            // Initial calculations and rendering
            updateActiveCounter();
            renderHistory();
```

Replace with:

```js
            // Initial calculations and rendering
            updateActiveCounter();
            renderHistory();

            // Restore whichever event was open before the last reload, if it's
            // still active; otherwise land on the Eventos screen.
            if (currentEventoId) {
                const restoredEvento = eventos.find(e => e.id === currentEventoId && e.status === 'ativo');
                if (restoredEvento) {
                    enterEvento(currentEventoId);
                } else {
                    currentEventoId = null;
                    try { localStorage.removeItem('arena_current_evento_id'); } catch (e) {}
                }
            }
```

This runs once, synchronously, right after the initial `loans`/`eventos` arrays are loaded from `localStorage` at the top of `DOMContentLoaded` — before the Firebase listeners potentially update them again. If `currentEventoId` was persisted but the event can't be found yet (e.g. `eventos` hasn't loaded from `localStorage` because this is the very first run on a fresh browser), the `else` branch clears the stale id and the user lands on the Eventos screen — no worse than today's behavior of always landing on the loans tab.

- [ ] **Step 6: Verify**

Code-level checks:
- Grep for `window.enterEvento` — exactly one definition; grep for `enterEvento(` — matches the definition plus call sites in the event-card `onclick`, `btnSaveEvento`'s handler, and the auto-restore block.
- Grep for `exitEvento` — one function definition, one `addEventListener` wiring, no stray references.
- Confirm `renderEventos()` is called in exactly 3 places: inside itself is not a call, so: the Task 1 Firebase listener (Step 3 above), `eventoFilterTabs`' click handler, and `exitEvento()`.
- Confirm the auto-restore block in Step 5 sits after `renderHistory()` and before the file's closing `});` — read the surrounding ~15 lines to confirm no brace mismatch was introduced.
- Confirm `panelLoans`, `panelInspections`, `panelKeys`, `tabLoans`, `tabInspections`, `tabKeys` (all declared earlier in the file, unrelated to this task) are referenced by name correctly and not redeclared.

Manual verification:
- Load the app fresh (clear `localStorage` first). Confirm the Eventos screen shows, with an empty "Ativos" list and the "+ Novo Evento" button.
- Click "+ Novo Evento", fill the form, save. Confirm it enters the event immediately: the 3 tabs appear, the current-event bar shows the event's name, and you land on the Empréstimos tab.
- Click "Trocar de Evento". Confirm you're back on the Eventos screen, and the event you just created now shows as a card under "Ativos".
- Reload the page (F5) while inside an event. Confirm you land back inside that same event, not on the Eventos screen.
- Reload the page after clicking "Trocar de Evento" (i.e. with no event selected). Confirm you land on the Eventos screen, not inside any event.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: add Eventos screen render/create/enter/exit logic and event persistence across reloads"
```

## Task 4: Furniture loans use the current event

**Files:**
- Modify: `index.html` (HTML + script)

**Interfaces:**
- Consumes: `currentEventoId`, `getEventoNome` (Task 1); `enterEvento`'s guarantee that the loans panel is never visible without a `currentEventoId` set (Task 3).

- [ ] **Step 1: Remove the free-text event field from the loan form**

In `index.html`, the loan form currently has:

```html
                <!-- 5. Evento -->
                <div class="form-group">
                    <label class="form-label" for="event-input">Evento</label>
                    <input type="text" id="event-input" class="input-text" placeholder="Ex: Show do Coldplay, Jogo de Basquete, Convenção..." autocomplete="off">
                </div>

                <!-- 6. Responsáveis pelo Empréstimo -->
```

Delete the `<!-- 5. Evento -->` comment and its `<div class="form-group">...</div>` block entirely, leaving:

```html
                <!-- 6. Responsáveis pelo Empréstimo -->
```

as the next line after the section that precedes it.

- [ ] **Step 2: Update `submitBtn`'s validation and both branches**

In `index.html`, `submitBtn`'s handler currently reads:

```js
            submitBtn.addEventListener('click', () => {
                const origin = originInput.value.trim();
                const destination = destinationInput.value.trim();
                const respArena = respArenaInput.value.trim();
                const respCliente = respClienteInput.value.trim();
                const event = eventInput.value.trim();

                // Read exact qty from input
                currentQty = parseInt(qtyInput.value) || 1;

                // Validations
                if (!currentItem) {
                    showToast('Selecione um mobiliário na grade.', '⚠️');
                    return;
                }
                if (currentQty < 1) {
                    showToast('Quantidade inválida.', '⚠️');
                    return;
                }
                if (!origin) {
                    showToast('Informe o local de origem.', '⚠️');
                    return;
                }
                if (!destination) {
                    showToast('Informe o local de destino.', '⚠️');
                    return;
                }
                if (!event) {
                    showToast('Informe o nome do Evento.', '⚠️');
                    return;
                }
                if (!respArena) {
```

Replace with:

```js
            submitBtn.addEventListener('click', () => {
                const origin = originInput.value.trim();
                const destination = destinationInput.value.trim();
                const respArena = respArenaInput.value.trim();
                const respCliente = respClienteInput.value.trim();

                // Read exact qty from input
                currentQty = parseInt(qtyInput.value) || 1;

                // Validations
                if (!currentEventoId) {
                    showToast('Nenhum evento selecionado.', '⚠️');
                    return;
                }
                if (!currentItem) {
                    showToast('Selecione um mobiliário na grade.', '⚠️');
                    return;
                }
                if (currentQty < 1) {
                    showToast('Quantidade inválida.', '⚠️');
                    return;
                }
                if (!origin) {
                    showToast('Informe o local de origem.', '⚠️');
                    return;
                }
                if (!destination) {
                    showToast('Informe o local de destino.', '⚠️');
                    return;
                }
                if (!respArena) {
```

Then, in the edit branch, remove `evento: event,` from the spread:

```js
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
```

becomes:

```js
                            updatedLoan = {
                                ...loan,
                                item: currentItem,
                                quantidade: currentQty,
                                origem: origin,
                                destino: destination,
                                respArena: respArena,
                                respCliente: respCliente
                            };
```

(`...loan` already carries whatever `eventoId` the loan was created with — editing a loan never changes which event it belongs to, per the spec.)

Then, in the create branch:

```js
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
```

becomes:

```js
                    const newLoan = {
                        id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5),
                        dataHora: new Date().toISOString(),
                        item: currentItem,
                        quantidade: currentQty,
                        eventoId: currentEventoId,
                        origem: origin,
                        destino: destination,
                        respArena: respArena,
                        respCliente: respCliente,
                        devolvido: false,
                        dataDevolucao: null
                    };
```

- [ ] **Step 3: Remove the event field from `editLoan` and the `eventInput` const**

In `index.html`, `window.editLoan` currently has:

```js
                // Set responsible names and event
                respArenaInput.value = loan.respArena || loan.responsavel || '';
                respClienteInput.value = loan.respCliente || '';
                eventInput.value = loan.evento || '';
```

Replace with:

```js
                // Set responsible names
                respArenaInput.value = loan.respArena || loan.responsavel || '';
                respClienteInput.value = loan.respCliente || '';
```

And remove the now-unused `const eventInput = document.getElementById('event-input');` const declaration (search for it near the other form-element consts).

- [ ] **Step 4: Filter and re-label the history list**

In `index.html`, `renderHistory()`'s filter currently reads:

```js
                const filteredLoans = loans.filter(loan => {
                    if (!loan) return false;
                    
                    const matchesFilter = 
                        currentFilter === 'all' || 
                        (currentFilter === 'active' && !loan.devolvido) ||
                        (currentFilter === 'returned' && loan.devolvido);

                    const itemStr = (loan.item || '').toLowerCase();
                    const eventStr = (loan.evento || '').toLowerCase();
                    const respArenaStr = (loan.respArena || loan.responsavel || '').toLowerCase();
                    const respClienteStr = (loan.respCliente || '').toLowerCase();
                    const originStr = (loan.origem || '').toLowerCase();
                    const destStr = (loan.destino || '').toLowerCase();

                    const matchesSearch = 
                        !searchQuery ||
                        itemStr.includes(searchQuery) ||
                        eventStr.includes(searchQuery) ||
                        respArenaStr.includes(searchQuery) ||
                        respClienteStr.includes(searchQuery) ||
                        originStr.includes(searchQuery) ||
                        destStr.includes(searchQuery);

                    return matchesFilter && matchesSearch;
                });
```

Replace with:

```js
                const filteredLoans = loans.filter(loan => {
                    if (!loan) return false;
                    if (loan.eventoId !== currentEventoId) return false;

                    const matchesFilter = 
                        currentFilter === 'all' || 
                        (currentFilter === 'active' && !loan.devolvido) ||
                        (currentFilter === 'returned' && loan.devolvido);

                    const itemStr = (loan.item || '').toLowerCase();
                    const respArenaStr = (loan.respArena || loan.responsavel || '').toLowerCase();
                    const respClienteStr = (loan.respCliente || '').toLowerCase();
                    const originStr = (loan.origem || '').toLowerCase();
                    const destStr = (loan.destino || '').toLowerCase();

                    const matchesSearch = 
                        !searchQuery ||
                        itemStr.includes(searchQuery) ||
                        respArenaStr.includes(searchQuery) ||
                        respClienteStr.includes(searchQuery) ||
                        originStr.includes(searchQuery) ||
                        destStr.includes(searchQuery);

                    return matchesFilter && matchesSearch;
                });
```

Then, in the same function's card template:

```js
                            <div class="detail-item" style="grid-column: span 2;">
                                <span class="detail-label">Evento</span>
                                <span class="detail-val" style="color: var(--text-primary); font-weight: bold;">${loan.evento || '-'}</span>
                            </div>
```

becomes:

```js
                            <div class="detail-item" style="grid-column: span 2;">
                                <span class="detail-label">Evento</span>
                                <span class="detail-val" style="color: var(--text-primary); font-weight: bold;">${getEventoNome(loan.eventoId)}</span>
                            </div>
```

- [ ] **Step 5: Verify**

Code-level checks:
- Grep for `id="event-input"` and `eventInput` — zero matches remaining anywhere in the file.
- Grep for `loan.evento` — zero matches remaining (everywhere it was read is now either removed or replaced with `getEventoNome(loan.eventoId)`).
- Grep for `loan.eventoId` — matches in: the create branch, the `renderHistory` filter, the `renderHistory` card template's `getEventoNome` call. Confirm the edit branch's spread (`...loan`) is the only place the edit path touches `eventoId`, i.e. no explicit `eventoId:` assignment was added there.
- Confirm the `if (!event)` validation block is gone and a `if (!currentEventoId)` check was added in its place, positioned as the *first* validation check (before `!currentItem`), matching the brief.

Manual verification:
- Inside an event, register a new furniture loan. Confirm it's created without ever being asked for an event name, and appears in the history list showing the current event's name under "Evento".
- Edit that loan (change origem/destino). Confirm the event name shown afterward is unchanged.
- Switch to a different event (or create a second one) and confirm the loan from the first event does NOT appear in this event's history list.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: tie furniture loans to the current event instead of a free-text field"
```

## Task 5: Room check-ins use the current event

**Files:**
- Modify: `index.html` (HTML + script)

**Interfaces:**
- Consumes: `currentEventoId`, `getEventoNome` (Task 1).
- Global constraint reminder: the occupancy checks in this task's file (`activeRoomsState.find(r => r.id === roomId && r.statusSala === 'Em Uso')`, both in `btnNewInspection`'s available-rooms filter and in the check-in submit's race-guard) must NOT be touched to add an `eventoId` filter — they stay global by design.

- [ ] **Step 1: Remove the free-text event field from the check-in form**

In `index.html`:

```html
                <div class="form-group">
                    <label class="form-label" for="checkin-event-input">Evento / Contrato</label>
                    <input type="text" id="checkin-event-input" class="input-text" placeholder="Ex: Show do Djavan, Jogo de Basquete..." autocomplete="off">
                </div>

                <div class="form-group-grid">
```

Delete the `<div class="form-group">...</div>` block (the one containing `checkin-event-input`), leaving `<div class="form-group-grid">` as the next line.

- [ ] **Step 2: Update `btnSubmitCheckin`'s validation and both branches**

In `index.html`:

```js
            btnSubmitCheckin.addEventListener('click', () => {
                const roomId = checkinRoomSelect.value;
                const eventName = checkinEventInput.value.trim();
                const respCliente = checkinRespCliente.value.trim();
                const operadorArena = checkinOperadorArena.value.trim();

                if (!roomId) {
                    showToast('Selecione uma sala.', '⚠️');
                    return;
                }
                if (!eventName) {
                    showToast('Informe o Evento/Contrato.', '⚠️');
                    return;
                }
                if (!respCliente) {
```

Replace with:

```js
            btnSubmitCheckin.addEventListener('click', () => {
                const roomId = checkinRoomSelect.value;
                const respCliente = checkinRespCliente.value.trim();
                const operadorArena = checkinOperadorArena.value.trim();

                if (!currentEventoId) {
                    showToast('Nenhum evento selecionado.', '⚠️');
                    return;
                }
                if (!roomId) {
                    showToast('Selecione uma sala.', '⚠️');
                    return;
                }
                if (!respCliente) {
```

Then, in the `editingInspectionId` (edit) branch, remove `evento: eventName,`:

```js
                        roomInspections[inspectionIndex] = {
                            ...originalInspection,
                            evento: eventName,
                            checkinRespCliente: respCliente,
                            checkinOperador: operadorArena,
```

becomes:

```js
                        roomInspections[inspectionIndex] = {
                            ...originalInspection,
                            checkinRespCliente: respCliente,
                            checkinOperador: operadorArena,
```

Then, in the new-inspection branch, replace `evento: eventName,` with `eventoId: currentEventoId,`:

```js
                    const newInspection = {
                        id: inspectionId,
                        salaId: roomId,
                        evento: eventName,
                        checkinDataHora: new Date().toISOString(),
```

becomes:

```js
                    const newInspection = {
                        id: inspectionId,
                        salaId: roomId,
                        eventoId: currentEventoId,
                        checkinDataHora: new Date().toISOString(),
```

Then, still in the new-inspection branch, add `eventoId: currentEventoId` to `roomStateObj` so `activeRoomsState` entries carry it too (needed for Step 3's rendering filter):

```js
                    const roomStateObj = {
                        id: roomId,
                        name: predefinedRoom ? predefinedRoom.name : 'Sala',
                        code: predefinedRoom ? predefinedRoom.code : 'Sala',
                        statusSala: 'Em Uso',
                        currentInspectionId: inspectionId
                    };
```

becomes:

```js
                    const roomStateObj = {
                        id: roomId,
                        name: predefinedRoom ? predefinedRoom.name : 'Sala',
                        code: predefinedRoom ? predefinedRoom.code : 'Sala',
                        statusSala: 'Em Uso',
                        currentInspectionId: inspectionId,
                        eventoId: currentEventoId
                    };
```

- [ ] **Step 3: Remove the now-unused `checkinEventInput` const**

Search for `const checkinEventInput = document.getElementById('checkin-event-input');` and delete it.

- [ ] **Step 4: Filter the rooms grid and inspections history by event**

In `index.html`, `renderRoomsGrid()`'s render loop currently reads:

```js
                activeRoomsState.forEach(room => {
```

Replace with:

```js
                activeRoomsState.filter(room => room.eventoId === currentEventoId).forEach(room => {
```

Do NOT touch the empty-state check (`if (activeRoomsState.length === 0) { ... }`) in this task — leave it as-is (it's a Minor pre-existing quirk that the empty-state message can show even when `activeRoomsState` has entries for other events but none for this one; out of scope for this plan).

In the same function, the room-detail template currently reads:

```js
                                    <div class="room-details-row">
                                        <span class="room-details-label">Evento:</span>
                                        <span class="room-details-value">${inspection.evento}</span>
                                    </div>
```

Replace with:

```js
                                    <div class="room-details-row">
                                        <span class="room-details-label">Evento:</span>
                                        <span class="room-details-value">${getEventoNome(inspection.eventoId)}</span>
                                    </div>
```

In `renderInspectionsHistory()`, the filter currently reads:

```js
                const closed = roomInspections.filter(i => i.status !== 'Aberto');
```

Replace with:

```js
                const closed = roomInspections.filter(i => i.status !== 'Aberto' && i.eventoId === currentEventoId);
```

And in the same function's row template:

```js
                            <td>${insp.evento || '-'}</td>
```

becomes:

```js
                            <td>${getEventoNome(insp.eventoId)}</td>
```

- [ ] **Step 5: Verify**

Code-level checks:
- Grep for `id="checkin-event-input"` and `checkinEventInput` — zero matches remaining.
- Grep for `inspection.evento` and `insp.evento` — zero matches remaining.
- Grep for `activeRoomsState.find(r => r.id === roomId && r.statusSala === 'Em Uso')` — this exact expression (the occupancy check) must still exist, UNCHANGED, in both its call sites (`btnNewInspection` and the check-in submit's race-guard) — confirm neither now has an `eventoId` filter appended.
- Grep for `eventoId: currentEventoId` — matches in `newInspection`, `roomStateObj`, and (from Task 4) `newLoan`.

Manual verification:
- Inside Event A, start a check-in on Room X. Confirm no event name is asked for, and the room card shows Event A's name.
- Switch to Event B (create it if needed). Confirm Room X does NOT appear as occupied in Event B's grid — but if you try to check in Room X from Event B too, the "sala já ocupada" warning from Fase 4 still fires (proving the occupancy check is still global, not scoped to Event B).
- Close Room X's check-in (check-out) from Event A. Confirm it shows up in Event A's "Histórico de Vistorias", and does NOT show up if you switch to Event B's history.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: tie room check-ins to the current event, keep occupancy checks global"
```

## Task 6: Key/AC loans use the current event

**Files:**
- Modify: `index.html` (HTML + script)

**Interfaces:**
- Consumes: `currentEventoId`, `getEventoNome` (Task 1).

- [ ] **Step 1: Remove the free-text event field from the key/AC loan form**

In `index.html`:

```html
                  <div class="form-group">
                      <label class="form-label" for="key-loan-event">Evento / Contrato</label>
                      <input type="text" id="key-loan-event" class="input-text" placeholder="Ex: Show do Djavan, Jogo de Basquete..." autocomplete="off">
                  </div>

                  <div class="form-group-grid">
```

Delete the `<div class="form-group">...</div>` block (the one containing `key-loan-event`), leaving `<div class="form-group-grid">` as the next line.

- [ ] **Step 2: Update `btnSubmitKeyLoan`'s validation, edit branches, and create branch**

In `index.html`:

```js
            btnSubmitKeyLoan.addEventListener('click', () => {
                const loanId = keyLoanEditId.value;
                const isHistory = keyLoanEditIsHistory.value === 'true';
                const hasKey = keyLoanChkKey.checked;
                const qtyKey = parseInt(keyLoanQtyKey.value) || 1;
                const hasAc = keyLoanChkAc.checked;
                const qtyAc = parseInt(keyLoanQtyAc.value) || 1;
                const eventName = keyLoanEvent.value.trim();
                const respCliente = keyLoanRespCliente.value.trim();
                const operadorArena = keyLoanOperadorArena.value.trim();
```

Replace with:

```js
            btnSubmitKeyLoan.addEventListener('click', () => {
                const loanId = keyLoanEditId.value;
                const isHistory = keyLoanEditIsHistory.value === 'true';
                const hasKey = keyLoanChkKey.checked;
                const qtyKey = parseInt(keyLoanQtyKey.value) || 1;
                const hasAc = keyLoanChkAc.checked;
                const qtyAc = parseInt(keyLoanQtyAc.value) || 1;
                const respCliente = keyLoanRespCliente.value.trim();
                const operadorArena = keyLoanOperadorArena.value.trim();

                if (!currentEventoId) {
                    showToast('Nenhum evento selecionado.', '⚠️');
                    return;
                }
```

(This new check goes right after the const declarations, before the existing `if (hasKey && roomIds.length === 0)` block — it doesn't depend on `roomIds`, which is computed after.)

Then remove the now-orphaned validation:

```js
                if (!eventName) {
                    showToast('Informe o Evento/Contrato.', '⚠️');
                    return;
                }
```

Delete this block entirely (it's currently positioned after the `!hasKey && !hasAc` check).

Then, in the "edit history" branch, remove `evento: eventName,`:

```js
                            keyHistory[index] = {
                                ...original,
                                ...(isAcEntry ? { qtyAc } : { qtyKey }),
                                evento: eventName,
                                checkinRespCliente: respCliente,
```

becomes:

```js
                            keyHistory[index] = {
                                ...original,
                                ...(isAcEntry ? { qtyAc } : { qtyKey }),
                                checkinRespCliente: respCliente,
```

Then, in the "edit active" branch, remove `evento: eventName,`:

```js
                            keyLoans[index] = {
                                ...original,
                                ...(isAcEntry ? { qtyAc } : { qtyKey }),
                                evento: eventName,
                                checkinRespCliente: respCliente,
                                checkinOperador: operadorArena
                            };
```

becomes:

```js
                            keyLoans[index] = {
                                ...original,
                                ...(isAcEntry ? { qtyAc } : { qtyKey }),
                                checkinRespCliente: respCliente,
                                checkinOperador: operadorArena
                            };
```

Then, in the create branch, replace both `evento: eventName,` occurrences with `eventoId: currentEventoId,`:

```js
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
```

becomes:

```js
                            const entry = {
                                id: 'key-loan-' + Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5),
                                tipo: 'chave',
                                salaId: roomId,
                                qtyKey,
                                eventoId: currentEventoId,
                                checkinRespCliente: respCliente,
                                checkinOperador: operadorArena,
                                checkinDataHora: nowIso
                            };
```

and:

```js
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
```

becomes:

```js
                        const acEntry = {
                            id: 'ac-loan-' + Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5),
                            tipo: 'controle-ar',
                            salaId: null,
                            qtyAc,
                            eventoId: currentEventoId,
                            checkinRespCliente: respCliente,
                            checkinOperador: operadorArena,
                            checkinDataHora: nowIso
                        };
```

- [ ] **Step 3: Remove the now-unused `keyLoanEvent` const**

Search for `const keyLoanEvent = document.getElementById('key-loan-event');` and delete it.

- [ ] **Step 4: Copy `eventoId` into history on return**

In `index.html`, `window.returnKeyLoan`'s history-record construction currently reads:

```js
                const historyRecord = {
                    id: loan.id,
                    tipo: loan.tipo,
                    ...(isAcTipo(loan) ? { qtyAc: loan.qtyAc } : { salaId: loan.salaId, qtyKey: loan.qtyKey }),
                    evento: loan.evento,
                    checkinRespCliente: loan.checkinRespCliente,
```

Replace with:

```js
                const historyRecord = {
                    id: loan.id,
                    tipo: loan.tipo,
                    ...(isAcTipo(loan) ? { qtyAc: loan.qtyAc } : { salaId: loan.salaId, qtyKey: loan.qtyKey }),
                    eventoId: loan.eventoId,
                    checkinRespCliente: loan.checkinRespCliente,
```

`window.returnAllKeyLoans` has the identical `historyRecord` construction inside its `keyLoans.forEach` loop — apply the same one-line change there too (`evento: loan.evento,` → `eventoId: loan.eventoId,`).

- [ ] **Step 5: Filter the mural and history table by event**

In `index.html`, `renderKeysMural()`'s render loop currently reads:

```js
                const sortedKeyLoans = [...keyLoans].sort((a, b) => new Date(a.checkinDataHora) - new Date(b.checkinDataHora));
```

Replace with:

```js
                const sortedKeyLoans = keyLoans.filter(l => l.eventoId === currentEventoId).sort((a, b) => new Date(a.checkinDataHora) - new Date(b.checkinDataHora));
```

(`[...keyLoans]` was only there to avoid mutating `keyLoans` via `.sort()` — `.filter()` already returns a new array, so the spread is no longer needed.)

In the same function's card template:

```js
                            <div class="room-details-row">
                                <span class="room-details-label">Evento:</span>
                                <span class="room-details-value">${loan.evento}</span>
                            </div>
```

becomes:

```js
                            <div class="room-details-row">
                                <span class="room-details-label">Evento:</span>
                                <span class="room-details-value">${getEventoNome(loan.eventoId)}</span>
                            </div>
```

In `renderKeysHistory()`, the filter currently reads:

```js
                const filtered = keyHistory.filter(loan => {
                    const room = predefinedRooms.find(r => r && r.id === loan.salaId);
                    const roomName = room ? room.name.toLowerCase() : '';
                    const roomCode = room ? room.code.toLowerCase() : '';
                    const eventName = loan.evento.toLowerCase();
                    return roomName.includes(query) || roomCode.includes(query) || eventName.includes(query);
                });
```

Replace with:

```js
                const filtered = keyHistory.filter(loan => {
                    if (loan.eventoId !== currentEventoId) return false;
                    const room = predefinedRooms.find(r => r && r.id === loan.salaId);
                    const roomName = room ? room.name.toLowerCase() : '';
                    const roomCode = room ? room.code.toLowerCase() : '';
                    return roomName.includes(query) || roomCode.includes(query);
                });
```

(The old code matched the search box against the event name too; since every visible row now already belongs to the same current event, that comparison stopped being a useful discriminator — dropped along with the field it depended on.)

In the same function's row template:

```js
                        <td style="padding: 12px 16px; color: var(--text-primary); font-weight: 500; white-space: nowrap;">${loan.evento}</td>
```

becomes:

```js
                        <td style="padding: 12px 16px; color: var(--text-primary); font-weight: 500; white-space: nowrap;">${getEventoNome(loan.eventoId)}</td>
```

- [ ] **Step 6: Verify**

Code-level checks:
- Grep for `id="key-loan-event"` and `keyLoanEvent` — zero matches remaining.
- Grep for `loan.evento` — zero matches remaining anywhere in the file (this is the last of the three creation flows to migrate; after this task, no code should read a bare `.evento` property from a loan/keyLoan/inspection record anywhere).
- Grep for `eventoId: loan.eventoId` — exactly 2 matches (`returnKeyLoan` and `returnAllKeyLoans`).
- Confirm the duplicate-active-key `confirm()` dialog logic (`keyLoans.some(l => l.tipo === 'chave' && l.salaId === roomId)`) was NOT touched — it's unrelated to event scoping (a physical key conflict, like the room-occupancy check, should also arguably be global, and this task doesn't change its existing global behavior either way, so leave it exactly as-is).

Manual verification:
- Inside an event, register a key loan and an AC-control loan. Confirm neither asks for an event name, and both show the current event's name in the mural.
- Return one of them. Confirm it appears in "Histórico de Devoluções" under the current event, showing the correct event name, and does NOT appear when viewing a different event's history.
- Switch events and confirm the mural is empty for a fresh event (no bleed-through from the other event's active key loans).

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: tie key/AC loans to the current event instead of a free-text field"
```

## Task 7: "Encerrar Evento" — event-scoped finalize flow

**Files:**
- Modify: `index.html` (script only — the button's HTML already moved into `#current-event-bar` in Task 2)

**Interfaces:**
- Consumes: `currentEventoId`, `eventos`, `syncEventoUpsert` (Task 1); `exitEvento()` (Task 3); `finalizeEventBtn` (existing const, now pointing at the relocated button from Task 2).

- [ ] **Step 1: Rewrite `finalizeEventBtn`'s click handler**

In `index.html`, the handler currently reads:

```js
            finalizeEventBtn.addEventListener('click', () => {
                // Get unique active events names (that have non-returned items)
                const activeEvents = [...new Set(
                    loans.filter(l => !l.devolvido && l.evento)
                         .map(l => l.evento.trim())
                )];

                if (activeEvents.length === 0) {
                    showToast('Não há eventos com itens ativos pendentes!', '⚠️');
                    return;
                }

                // Show prompt listing all active events
                const eventsListStr = activeEvents.join('\n• ');
                const chosenEvent = prompt(
                    `Eventos com mobiliários ativos pendentes:\n\n• ${eventsListStr}\n\nDigite o nome do evento que deseja encerrar:`
                );

                if (chosenEvent === null) return; // Action cancelled
                const trimmedChosenEvent = chosenEvent.trim();
                if (!trimmedChosenEvent) {
                    showToast('Nome do evento inválido!', '⚠️');
                    return;
                }

                // Check matches (case insensitive)
                const activeLoansForEvent = loans.filter(l => 
                    !l.devolvido && 
                    l.evento && 
                    l.evento.trim().toLowerCase() === trimmedChosenEvent.toLowerCase()
                );

                if (activeLoansForEvent.length === 0) {
                    showToast(`Nenhum item ativo encontrado para o evento: "${trimmedChosenEvent}"`, '⚠️');
                    return;
                }

                // Generate conference report
                const today = new Date();
                const pad = (n) => n.toString().padStart(2, '0');
                const dateStr = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;
                
                let reportText = `📋 RELATÓRIO DE CONFERÊNCIA DE ENCERRAMENTO\n`;
                reportText += `EVENTO: ${activeLoansForEvent[0].evento.toUpperCase()}\n`;
                reportText += `DATA DO FECHAMENTO: ${dateStr}\n`;
                reportText += `===============================================\n`;
                reportText += `Verifique os seguintes itens ativos nos locais indicados:\n\n`;

                activeLoansForEvent.forEach((loan, idx) => {
                    const dtStr = formatDate(loan.dataHora);
                    reportText += `${idx + 1}. [${loan.item}] - Qtd: ${loan.quantidade}\n`;
                    reportText += `   📍 LOCALIZAR EM (Destino): ${(loan.destino || '-').toUpperCase()}\n`;
                    reportText += `   • Retirado de (Origem): ${loan.origem || '-'}\n`;
                    reportText += `   • Resp. Arena: ${loan.respArena || '-'}\n`;
                    reportText += `   • Resp. Cliente: ${loan.respCliente || '-'}\n`;
                    reportText += `   • Retirado em: ${dtStr}\n`;
                    reportText += `-----------------------------------------------\n`;
                });

                reportText += `Total de itens pendentes: ${activeLoansForEvent.length}\n`;
                reportText += `Por favor, faça a conferência física dos itens nos locais de destino.\n`;
                reportText += `Gerado pelo app Arena Mobília.`;

                // Copy report to clipboard
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(reportText).then(() => {
                        proceedWithFinalization(trimmedChosenEvent, activeLoansForEvent);
                    }).catch(err => {
                        console.error('Erro ao copiar: ', err);
                        fallbackCopy(reportText);
                        proceedWithFinalization(trimmedChosenEvent, activeLoansForEvent);
                    });
                } else {
                    fallbackCopy(reportText);
                    proceedWithFinalization(trimmedChosenEvent, activeLoansForEvent);
                }
            });
```

Replace the entire handler with:

```js
            finalizeEventBtn.addEventListener('click', () => {
                const evento = eventos.find(e => e.id === currentEventoId);
                if (!evento) return;

                const activeLoansForEvent = loans.filter(l => l.eventoId === currentEventoId && !l.devolvido);

                if (activeLoansForEvent.length === 0) {
                    if (confirm(`Não há itens de mobília ativos pendentes para "${evento.nome}". Encerrar o evento mesmo assim?`)) {
                        proceedWithFinalization(evento, activeLoansForEvent);
                    }
                    return;
                }

                // Generate conference report
                const today = new Date();
                const pad = (n) => n.toString().padStart(2, '0');
                const dateStr = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;
                
                let reportText = `📋 RELATÓRIO DE CONFERÊNCIA DE ENCERRAMENTO\n`;
                reportText += `EVENTO: ${evento.nome.toUpperCase()}\n`;
                reportText += `DATA DO FECHAMENTO: ${dateStr}\n`;
                reportText += `===============================================\n`;
                reportText += `Verifique os seguintes itens ativos nos locais indicados:\n\n`;

                activeLoansForEvent.forEach((loan, idx) => {
                    const dtStr = formatDate(loan.dataHora);
                    reportText += `${idx + 1}. [${loan.item}] - Qtd: ${loan.quantidade}\n`;
                    reportText += `   📍 LOCALIZAR EM (Destino): ${(loan.destino || '-').toUpperCase()}\n`;
                    reportText += `   • Retirado de (Origem): ${loan.origem || '-'}\n`;
                    reportText += `   • Resp. Arena: ${loan.respArena || '-'}\n`;
                    reportText += `   • Resp. Cliente: ${loan.respCliente || '-'}\n`;
                    reportText += `   • Retirado em: ${dtStr}\n`;
                    reportText += `-----------------------------------------------\n`;
                });

                reportText += `Total de itens pendentes: ${activeLoansForEvent.length}\n`;
                reportText += `Por favor, faça a conferência física dos itens nos locais de destino.\n`;
                reportText += `Gerado pelo app Arena Mobília.`;

                // Copy report to clipboard
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(reportText).then(() => {
                        proceedWithFinalization(evento, activeLoansForEvent);
                    }).catch(err => {
                        console.error('Erro ao copiar: ', err);
                        fallbackCopy(reportText);
                        proceedWithFinalization(evento, activeLoansForEvent);
                    });
                } else {
                    fallbackCopy(reportText);
                    proceedWithFinalization(evento, activeLoansForEvent);
                }
            });
```

- [ ] **Step 2: Rewrite `proceedWithFinalization`**

In `index.html`:

```js
            function proceedWithFinalization(eventName, activeLoans) {
                // Prompt user if they want to bulk-return these items
                const confirmReturn = confirm(
                    `📋 Relatório de conferência de destino copiado para a área de transferência!\n\nForam identificados ${activeLoans.length} itens ativos pendentes para o evento "${eventName}".\n\nDeseja marcar todos esses itens como DEVOLVIDOS automaticamente para encerrar o evento?`
                );

                if (confirmReturn) {
                    // Mark all active loans of this event as returned
                    const nowStr = new Date().toISOString();
                    const updatedLoans = [];
                    loans = loans.map(loan => {
                        const matchesEvent = loan.evento && loan.evento.trim().toLowerCase() === eventName.toLowerCase();
                        if (matchesEvent && !loan.devolvido) {
                            const updatedLoan = {
                                ...loan,
                                devolvido: true,
                                dataDevolucao: nowStr
                            };
                            updatedLoans.push(updatedLoan);
                            return updatedLoan;
                        }
                        return loan;
                    });
                    saveToLocalStorage();
                    updatedLoans.forEach(syncLoanUpsert);
                    showToast('Evento finalizado! Todos os itens foram devolvidos.', '✅');
                } else {
                    showToast('Relatório copiado! Itens mantidos ativos para conferência.', '📋');
                }
            }
```

Replace with:

```js
            function proceedWithFinalization(evento, activeLoans) {
                if (activeLoans.length > 0) {
                    const confirmReturn = confirm(
                        `📋 Relatório de conferência de destino copiado para a área de transferência!\n\nForam identificados ${activeLoans.length} itens ativos pendentes para o evento "${evento.nome}".\n\nDeseja marcar todos esses itens como DEVOLVIDOS automaticamente para encerrar o evento?`
                    );

                    if (!confirmReturn) {
                        showToast('Relatório copiado! Itens mantidos ativos para conferência.', '📋');
                        return;
                    }

                    // Mark all active loans of this event as returned
                    const nowStr = new Date().toISOString();
                    const updatedLoans = [];
                    loans = loans.map(loan => {
                        if (loan.eventoId === evento.id && !loan.devolvido) {
                            const updatedLoan = {
                                ...loan,
                                devolvido: true,
                                dataDevolucao: nowStr
                            };
                            updatedLoans.push(updatedLoan);
                            return updatedLoan;
                        }
                        return loan;
                    });
                    saveToLocalStorage();
                    updatedLoans.forEach(syncLoanUpsert);
                }

                const eventoIndex = eventos.findIndex(e => e.id === evento.id);
                if (eventoIndex > -1) {
                    eventos[eventoIndex] = { ...eventos[eventoIndex], status: 'encerrado' };
                    localStorage.setItem('arena_eventos', JSON.stringify(eventos));
                    syncEventoUpsert(eventos[eventoIndex]);
                }

                showToast('Evento encerrado!', '✅');
                exitEvento();
            }
```

Note the behavior change from the spec's zero-active-loans branch (Step 1 above): when there's nothing to return, the human is asked a *different* confirm question (skipping the report-copy step, since there's nothing to report) and, on confirming, `proceedWithFinalization` is called with `activeLoans` as an empty array — the `if (activeLoans.length > 0)` guard at the top of `proceedWithFinalization` then correctly skips the bulk-return sub-flow and goes straight to closing the event.

- [ ] **Step 3: Verify**

Code-level checks:
- Grep for `loan.evento` and `l.evento` — zero matches remaining anywhere in the file (this confirms Task 4/5/6/7 collectively removed every reference to the old free-text field).
- Grep for `proceedWithFinalization(` — 3 call sites (two inside `finalizeEventBtn`'s handler's success/catch branches for the clipboard copy, one in the zero-active-loans branch) all passing `evento` (the object, not a string) as the first argument — confirm none still pass `trimmedChosenEvent` or any string.
- Confirm `proceedWithFinalization`'s signature changed from `(eventName, activeLoans)` to `(evento, activeLoans)` and every internal reference to the old `eventName` parameter was updated to `evento.nome` or `evento.id` as appropriate.
- Confirm `exitEvento()` (from Task 3) is called at the very end of `proceedWithFinalization`, after the `eventos` update — not before.

Manual verification:
- Inside an event with active furniture loans, click "Encerrar Evento". Confirm the report is copied, the confirm dialog appears, and confirming marks all loans returned, sets the event to encerrado, and takes you back to the Eventos screen (where the event now appears under "Encerrados").
- Cancelling that confirm dialog: confirm the event stays active and you remain on the current screen (not kicked out).
- Inside an event with zero active furniture loans, click "Encerrar Evento". Confirm you get the simpler "encerrar mesmo assim?" prompt (no report-copy step), and confirming closes the event the same way.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: scope Encerrar Evento to the current event and close its record on confirm"
```

---

## Self-Review Notes

Spec coverage check against `docs/superpowers/specs/2026-09-03-fase5-reorganizacao-eventos-design.md`:
- §1 Coleção `eventos` → Task 1.
- §2 `eventoId` nos registros operacionais → Tasks 4, 5, 6 (loans, roomInspections/activeRoomsState, keyLoans/keyHistory respectively).
- §3 Estado "evento atual" e navegação → Tasks 2 (markup) and 3 (logic).
- §4 Formulários de criação usam o evento atual → Tasks 4, 5, 6.
- §5 Filtro por evento nas listas, com checagem de sala ocupada permanecendo global → Tasks 4, 5, 6 (each task's render-filtering step explicitly preserves the global occupancy check where relevant).
- §6 "Finalizar Evento" → Task 7.
- §7 Reset de dados de produção → explicitly NOT a task in this plan (documented in Global Constraints as a manual, out-of-band operational step).
- "Fora de escopo" items (redesign visual, checklist livre, avaria, migração automática, editar/excluir evento, validação de datas) — none of the 7 tasks touch those areas.

Type/name consistency verified across tasks: `currentEventoId` is read (never reassigned except by `enterEvento`/`exitEvento`/the auto-restore block, all in Task 3) consistently by name in Tasks 4, 5, 6, 7. `getEventoNome(eventoId)` signature and return type (`string`) are identical at its Task 1 definition and every call site in Tasks 3, 4, 5, 6. `eventoId` as a field name is spelled identically on `loans`, `keyLoans`, `keyHistory`, `activeRoomsState`, and `roomInspections` records across all tasks that write it. `proceedWithFinalization`'s signature change (Task 7) is self-contained — no other task calls it.
