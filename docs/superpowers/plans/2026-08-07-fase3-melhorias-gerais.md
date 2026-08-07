# Fase 3 — Melhorias Gerais Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three functionality improvements to the single-file Arena Mobília app: a Firebase connection status badge, client-side photo compression before saving inspection photos, and an audit log tracking who edited/deleted furniture loans.

**Architecture:** All changes land in `index.html` (no build step, no other files). The connection badge is a small CSS-driven UI element wired to Firebase's native `.info/connected` path. Photo compression is a pure canvas-based helper function inserted into the two existing camera-capture listeners. The audit log follows the exact granular-sync pattern established in Fase 1 (`db.ref('auditLog/' + id).set(...)`, id-keyed collection, `sanitize()` before every write) — a new Firebase collection, synced the same way as `loans`/`keyLoans`/etc., with a viewer modal reusing the existing `.comparison-table` / `.modal-overlay` CSS.

**Tech Stack:** Vanilla JS, Firebase Realtime Database (compat SDK 10.8.0), no build tooling, no test framework.

## Global Constraints

- Spec source of truth: `docs/superpowers/specs/2026-08-07-fase3-melhorias-gerais-design.md`.
- Master password for loan deletion stays `gl@operacoes`, unchanged. Deletion now **also** requires a non-empty authorizer name (second prompt, after the password succeeds).
- Editing a loan stays password-free. It now requires a non-empty editor name (one prompt, before saving) — no master password is added to the edit flow.
- Audit log covers **only** `entityType: 'emprestimo'` (furniture loan edit/delete). Room inspections and key/AC loans are explicitly out of scope this phase.
- Every new Firebase collection write goes through the existing `sanitize()` helper (`index.html`, function at line ~2421) and uses granular per-ID writes (`db.ref(collection + '/' + id).set(...)`) — never a full-array/full-collection overwrite. This is the exact bug class Fase 1 fixed; do not reintroduce it.
- Connection states are exactly three, driven only by `.info/connected`: **Conectado** (green), **Offline** (red), and a transient **Sincronizando...** (amber) shown for ~1.5s on the `false → true` transition only. No other "syncing" signal exists or should be invented.
- Photo compression: canvas resize to max 1280px on the longer side (preserve aspect ratio), export via `canvas.toDataURL('image/jpeg', 0.8)`. Applies to both `checkinCameraInput` and `checkoutCameraInput`.
- No automated test suite and no browser access for implementers/reviewers in this environment (same limitation as Fase 1/2). Verification is: (a) exact code-level tracing — grep for the inserted snippet, confirm brace/paren balance around edited blocks, confirm no other call site was missed — and (b) the manual browser steps listed per task, which the human operator runs afterward. Do not claim a task is "tested" beyond what code-level tracing can actually confirm.
- Follow existing code conventions: 12-space indentation inside the `<script>` block (matches surrounding code), template-literal HTML strings for dynamically rendered rows (matches `renderCheckinThumbnails`, `renderCheckoutThumbnails`, comparison table rendering elsewhere in the file) — do not add HTML-escaping that the rest of the file doesn't already do, that's a separate pre-existing app-wide concern out of scope for this phase.

---

## File Structure

Single file, `index.html`. No new files. Changes fall into three regions of the existing file:
- `<style>` block (~lines 17-1400): two small additions — one new CSS custom property, one new component's rules (`.connection-badge` / `.connection-dot`).
- HTML body (~lines 1400-2057): one new badge element in `<header>`, one new button in the loans tab's `bottom-actions`, one new modal (`#audit-log-modal`).
- `<script>` block (~lines 2058-4867), inside the single `DOMContentLoaded` handler: new state variables, new DOM element consts, one new helper function (`compressImage`), two new sync/log helpers (`syncAuditLogUpsert`, `logAuditEntry`), one new render function (`renderAuditLog`), modifications to `deleteLoan`, the `submitBtn` edit branch, both camera-input listeners, `setupDatabaseListeners()`, and the Firebase seeding block.

## Task 1: Connection status indicator

**Files:**
- Modify: `index.html` (`:root` CSS variables, header CSS, header HTML, script)

**Interfaces:**
- Produces: a `#connection-badge` element in the header and a `setConnectionState(stateClass, label)` closure-local function (not exposed on `window`, only used by the `.info/connected` listener in this same task). No other task depends on this one.

- [ ] **Step 1: Add the `--warning` color variable**

In `index.html`, in the `:root` block, `--success-glow` is currently followed directly by `--accent-teal`:

```css
            --success: #0d9467;
            --success-glow: rgba(13, 148, 103, 0.12);
            --accent-teal: #0b6e97;
```

Insert a new line between them:

```css
            --success: #0d9467;
            --success-glow: rgba(13, 148, 103, 0.12);
            --warning: #92400e;
            --accent-teal: #0b6e97;
```

**Step 2: Add the badge CSS**

Immediately after the `.btn-badge span { ... }` rule (ends right before the `/* App Body Layout */` comment), add:

```css
        .connection-badge {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--text-secondary);
        }

        .connection-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: var(--text-muted);
            flex-shrink: 0;
        }

        .connection-badge.state-connected .connection-dot {
            background-color: var(--success);
        }

        .connection-badge.state-offline .connection-dot {
            background-color: var(--primary);
        }

        .connection-badge.state-syncing .connection-dot {
            background-color: var(--warning);
        }
```

- [ ] **Step 3: Add the badge markup to the header**

In `index.html`, the header brand block currently reads:

```html
        <header>
            <div class="header-brand">
                <div class="header-logo-placeholder" id="header-logo-target">
                    <!-- Logo placeholder to move the splash logo to -->
                </div>
                <span class="header-title">ARENA MOBÍLIA</span>
            </div>
```

Add the badge right after the title span, still inside `.header-brand`:

```html
        <header>
            <div class="header-brand">
                <div class="header-logo-placeholder" id="header-logo-target">
                    <!-- Logo placeholder to move the splash logo to -->
                </div>
                <span class="header-title">ARENA MOBÍLIA</span>
                <span class="connection-badge state-connecting" id="connection-badge" title="Conectando..." aria-label="Conectando...">
                    <span class="connection-dot"></span>
                    <span id="connection-badge-text">Conectando...</span>
                </span>
            </div>
```

`state-connecting` has no dedicated CSS rule — it falls back to the base `.connection-dot` color (`--text-muted`), which is exactly the neutral "not yet known" look wanted before the JS listener reports the real state.

- [ ] **Step 4: Add DOM element references**

In the script's "Toast UI" section:

```js
            // Toast UI
            const toast = document.getElementById('toast-notification');
            const toastMsg = document.getElementById('toast-message');
            const toastIcon = document.getElementById('toast-icon');
```

Add right after it:

```js
            // Toast UI
            const toast = document.getElementById('toast-notification');
            const toastMsg = document.getElementById('toast-message');
            const toastIcon = document.getElementById('toast-icon');

            // Connection status badge
            const connectionBadge = document.getElementById('connection-badge');
            const connectionBadgeText = document.getElementById('connection-badge-text');
```

- [ ] **Step 5: Wire the `.info/connected` listener**

In the same location (right after the two consts just added in Step 4), add:

```js
            function setConnectionState(stateClass, label) {
                connectionBadge.classList.remove('state-connected', 'state-offline', 'state-syncing', 'state-connecting');
                connectionBadge.classList.add(stateClass);
                connectionBadgeText.textContent = label;
                connectionBadge.title = label;
                connectionBadge.setAttribute('aria-label', label);
            }

            let wasConnected = null;
            let syncingTimeout = null;
            db.ref('.info/connected').on('value', (snapshot) => {
                const connected = snapshot.val() === true;
                if (connected && wasConnected === false) {
                    setConnectionState('state-syncing', 'Sincronizando...');
                    clearTimeout(syncingTimeout);
                    syncingTimeout = setTimeout(() => {
                        setConnectionState('state-connected', 'Conectado');
                    }, 1500);
                } else if (connected) {
                    clearTimeout(syncingTimeout);
                    setConnectionState('state-connected', 'Conectado');
                } else {
                    clearTimeout(syncingTimeout);
                    setConnectionState('state-offline', 'Offline');
                }
                wasConnected = connected;
            });
```

`.info/connected` is a Firebase-managed special path (not application data) — this listener works independently of the seeding/migration Promise chain further down the file, so it's safe to register this early.

- [ ] **Step 6: Verify**

Code-level checks:
- Grep `index.html` for `--warning:` — exactly one match, inside `:root`.
- Grep for `connection-badge` — matches in: the new CSS rules, the header HTML element, the two JS consts, and inside `setConnectionState`'s `classList` calls. No orphaned references.
- Confirm brace balance in the new CSS block and the new JS block (every `{` has a matching `}`).
- Confirm `db.ref('.info/connected')` appears exactly once.

Manual verification (for the human operator, after this task lands):
- Load the app with dev tools open. Badge should read "Conectado" (green dot) within a second or two of load.
- Use dev tools' network throttling → "Offline", confirm the badge switches to "Offline" (red dot) generally within a few seconds (Firebase's own timeout, not app logic).
- Restore network, confirm the badge shows "Sincronizando..." (amber dot) briefly, then reverts to "Conectado" (green dot) after ~1.5s.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: add Firebase connection status badge to header"
```

## Task 2: Photo compression before saving

**Files:**
- Modify: `index.html` (script only)

**Interfaces:**
- Produces: `compressImage(dataUrl, maxDimension = 1280, quality = 0.8)` → `Promise<string>` (resolves to a compressed JPEG data URL). Used by both camera-input listeners in this same task; no other task depends on it.
- Consumes: nothing new — operates purely on the `base64Data` string already produced by the existing `FileReader.readAsDataURL()` calls.

- [ ] **Step 1: Add the `compressImage` helper**

In `index.html`, immediately before the `// Check-in photo capture` comment (which precedes `checkinCameraInput.addEventListener('change', ...)`), add:

```js
            // Resizes and re-encodes a captured photo before it's stored — raw
            // camera captures can be several MB each, and base64 in Firebase RTDB
            // gets no server-side compression, so this keeps the database from
            // growing unbounded as inspections accumulate.
            function compressImage(dataUrl, maxDimension = 1280, quality = 0.8) {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        let width = img.width;
                        let height = img.height;
                        if (width > maxDimension || height > maxDimension) {
                            if (width > height) {
                                height = Math.round(height * (maxDimension / width));
                                width = maxDimension;
                            } else {
                                width = Math.round(width * (maxDimension / height));
                                height = maxDimension;
                            }
                        }
                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                        resolve(canvas.toDataURL('image/jpeg', quality));
                    };
                    img.onerror = reject;
                    img.src = dataUrl;
                });
            }

            // Check-in photo capture
```

- [ ] **Step 2: Use it in the check-in listener**

Current code:

```js
            checkinCameraInput.addEventListener('change', (e) => {
                const files = Array.from(e.target.files);
                files.forEach(file => {
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        const base64Data = event.target.result;
                        const photoObj = {
                            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                            url: base64Data,
                            timestamp: new Date().toISOString()
                        };
                        checkinPhotosList.push(photoObj);
                        renderCheckinThumbnails();
                    };
                    reader.readAsDataURL(file);
                });
            });
```

Replace with:

```js
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

- [ ] **Step 3: Use it in the check-out listener**

Current code:

```js
            checkoutCameraInput.addEventListener('change', (e) => {
                const files = Array.from(e.target.files);
                files.forEach(file => {
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        const base64Data = event.target.result;
                        const photoObj = {
                            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                            url: base64Data,
                            timestamp: new Date().toISOString()
                        };
                        checkoutPhotosList.push(photoObj);
                        renderCheckoutThumbnails();
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

- [ ] **Step 4: Verify**

Code-level checks:
- Grep for `compressImage` — exactly one function definition, two `.then(` call sites (check-in and check-out listeners).
- Confirm `checkinPhotosList.push` and `checkoutPhotosList.push` now happen inside the respective `.then()` callback, not directly inside `reader.onload`.
- Confirm both listeners still call `renderCheckinThumbnails()` / `renderCheckoutThumbnails()` after pushing (unchanged behavior, just moved one closure level in).
- Confirm no other code path still assigns `url: base64Data` directly for these two photo lists (grep `url: base64Data` should now find zero matches).

Manual verification:
- Open a check-in flow, capture a photo from a phone/webcam. Confirm the thumbnail appears and the damage/detail in the photo is still legible.
- In dev tools console, compare `JSON.stringify(checkinPhotosList[0].url).length` before/after this change (or inspect the Firebase console entry for `roomInspections`) — the compressed value should be dramatically smaller than a raw multi-MB camera capture.
- Repeat for check-out.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: compress inspection photos client-side before saving"
```

## Task 3: Audit log data layer

**Files:**
- Modify: `index.html` (script only)

**Interfaces:**
- Produces: `let auditLog` (array, mirrors the `loans`/`keyLoans` state pattern), `syncAuditLogUpsert(entry)`, `logAuditEntry(action, entityId, snapshot, authorizedBy)`. Task 4 and Task 5 call `logAuditEntry`. Task 6 reads `auditLog` and modifies the listener added in this task.
- `logAuditEntry` entry shape (matches the spec verbatim):
  ```js
  {
    id: string,
    action: 'editar' | 'excluir',
    entityType: 'emprestimo',
    entityId: string,
    snapshot: object,
    authorizedBy: string,
    timestamp: string // ISO 8601
  }
  ```

- [ ] **Step 1: Add the `auditLog` state variable**

In `index.html`, right after the `keyHistory` local-storage load block:

```js
            let keyHistory = [];
            try { keyHistory = JSON.parse(localStorage.getItem('arena_key_loans_history')) || []; } catch(e) { keyHistory = []; }
            if (!Array.isArray(keyHistory)) keyHistory = [];
```

Add:

```js
            let keyHistory = [];
            try { keyHistory = JSON.parse(localStorage.getItem('arena_key_loans_history')) || []; } catch(e) { keyHistory = []; }
            if (!Array.isArray(keyHistory)) keyHistory = [];

            let auditLog = [];
            try { auditLog = JSON.parse(localStorage.getItem('arena_audit_log')) || []; } catch(e) { auditLog = []; }
            if (!Array.isArray(auditLog)) auditLog = [];
```

- [ ] **Step 2: Add the sync helper**

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

            function syncAuditLogUpsert(entry) {
                db.ref('auditLog/' + entry.id).set(sanitize(entry)).catch(err => console.error("Error saving audit log entry:", err));
            }
```

- [ ] **Step 3: Add the `logAuditEntry` helper**

In `index.html`, right after `saveToLocalStorage`:

```js
            function saveToLocalStorage() {
                localStorage.setItem('arena_mobiliario_loans', JSON.stringify(loans));
                updateActiveCounter();
                renderHistory();
            }
```

Add:

```js
            function saveToLocalStorage() {
                localStorage.setItem('arena_mobiliario_loans', JSON.stringify(loans));
                updateActiveCounter();
                renderHistory();
            }

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

- [ ] **Step 4: Add the Firebase listener**

In `setupDatabaseListeners()`, the last listener is `roomInventories`:

```js
                db.ref('roomInventories').on('value', (snapshot) => {
                    const val = snapshot.val();
                    if (val && typeof val === 'object') {
                        roomInventories = val;
                        localStorage.setItem('arena_room_inventories', JSON.stringify(roomInventories));
                    }
                });
            }
```

Add a new listener before the closing `}` of the function:

```js
                db.ref('roomInventories').on('value', (snapshot) => {
                    const val = snapshot.val();
                    if (val && typeof val === 'object') {
                        roomInventories = val;
                        localStorage.setItem('arena_room_inventories', JSON.stringify(roomInventories));
                    }
                });

                db.ref('auditLog').on('value', (snapshot) => {
                    const val = snapshot.val();
                    auditLog = val && typeof val === 'object' ? Object.values(val).filter(Boolean) : (Array.isArray(val) ? val : []);
                    localStorage.setItem('arena_audit_log', JSON.stringify(auditLog));
                });
            }
```

Note: this listener does **not** call a render function yet — the audit log viewer UI (and its `renderAuditLog` function) doesn't exist until Task 6. Task 6 will add the `renderAuditLog();` call to this exact block.

- [ ] **Step 5: Add Firebase seeding**

In the seeding block inside `db.ref().once('value').then(...)`, the last seed check is `roomInventories`:

```js
                if (val.roomInventories === undefined) {
                    console.log("Coleção 'roomInventories' vazia no Firebase. Semeando com dados locais.");
                    db.ref('roomInventories').set(roomInventories).catch(err => console.error("Error seeding roomInventories:", err));
                }

                Promise.all(migrations).then(() => setupDatabaseListeners());
```

Add a new seed check before `Promise.all(migrations)...`:

```js
                if (val.roomInventories === undefined) {
                    console.log("Coleção 'roomInventories' vazia no Firebase. Semeando com dados locais.");
                    db.ref('roomInventories').set(roomInventories).catch(err => console.error("Error seeding roomInventories:", err));
                }
                if (val.auditLog === undefined) {
                    console.log("Coleção 'auditLog' vazia no Firebase. Semeando com dados locais.");
                    db.ref('auditLog').set(toIdMap(auditLog)).catch(err => console.error("Error seeding auditLog:", err));
                }

                Promise.all(migrations).then(() => setupDatabaseListeners());
```

No array-to-map migration is needed for `auditLog` (unlike `loans`/`keyLoans`/etc. in Fase 1) — this is a brand-new collection that has never existed in Firebase in array form, so there's no legacy shape to migrate.

- [ ] **Step 6: Verify**

Code-level checks:
- Grep for `auditLog` across the file — confirm it now appears in: the state declaration, `syncAuditLogUpsert`, `logAuditEntry`, the new listener in `setupDatabaseListeners`, and the new seed check. No stray references.
- Confirm `toIdMap(auditLog)` uses the existing `toIdMap` helper (defined earlier in the file, ~line 4731) — do not redefine it.
- Confirm the new listener and seed-check blocks are each balanced (matching braces/parens) and placed inside their correct enclosing function/callback.

Manual verification (via browser dev tools console, after this task lands):
- Run `logAuditEntry('editar', 'test-id', {item: 'Teste'}, 'Verificação Manual')` in the console.
- Confirm `auditLog[0]` now holds the new entry, `localStorage.getItem('arena_audit_log')` includes it, and the Firebase console (or the RTDB REST endpoint) shows a new `auditLog/<id>` record with the same fields.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: add auditLog Firebase collection and sync helpers"
```

## Task 4: Delete-loan audit trail

**Files:**
- Modify: `index.html` (script only)

**Interfaces:**
- Consumes: `logAuditEntry(action, entityId, snapshot, authorizedBy)` from Task 3.

- [ ] **Step 1: Add the authorizer-name prompt and audit logging to `deleteLoan`**

Current code:

```js
            // Delete Loan function (requiring password "gl@operacoes")
            window.deleteLoan = function(id) {
                const pass = prompt('Digite a senha mestre para remover este empréstimo:');
                if (pass === null) return; // Action cancelled
                
                if (pass === 'gl@operacoes') {
                    loans = loans.filter(l => l.id !== id);
                    saveToLocalStorage();
                    syncLoanRemove(id);
                    showToast('Registro excluído com sucesso!', '🗑️');
                    
                    // If we were editing this particular loan, cancel editing
                    if (editingLoanId === id) {
                        cancelEditing();
                    }
                } else {
                    showToast('Senha incorreta! Acesso negado.', '❌');
                }
            };
```

Replace with:

```js
            // Delete Loan function (requiring password "gl@operacoes" + authorizer name)
            window.deleteLoan = function(id) {
                const pass = prompt('Digite a senha mestre para remover este empréstimo:');
                if (pass === null) return; // Action cancelled
                
                if (pass === 'gl@operacoes') {
                    const authorizedBy = prompt('Digite o nome de quem autoriza a exclusão:');
                    if (!authorizedBy || !authorizedBy.trim()) {
                        showToast('Exclusão cancelada: nome não informado.', '⚠️');
                        return;
                    }

                    const loanToDelete = loans.find(l => l.id === id);
                    if (loanToDelete) {
                        logAuditEntry('excluir', id, loanToDelete, authorizedBy.trim());
                    }

                    loans = loans.filter(l => l.id !== id);
                    saveToLocalStorage();
                    syncLoanRemove(id);
                    showToast('Registro excluído com sucesso!', '🗑️');
                    
                    // If we were editing this particular loan, cancel editing
                    if (editingLoanId === id) {
                        cancelEditing();
                    }
                } else {
                    showToast('Senha incorreta! Acesso negado.', '❌');
                }
            };
```

The snapshot (`loanToDelete`) is captured and logged **before** `loans = loans.filter(...)` removes it — the full record only exists in-memory up to that point, since Fase 1's `syncLoanRemove` deletes the Firebase record entirely.

- [ ] **Step 2: Verify**

Code-level checks:
- Grep for `logAuditEntry('excluir'` — exactly one call site, inside `deleteLoan`.
- Confirm `logAuditEntry(...)` is called before `loans = loans.filter(...)` in this function (ordering matters — snapshot must be captured pre-removal).
- Confirm the early-return on empty/cancelled name happens before any mutation of `loans` or call to `saveToLocalStorage`/`syncLoanRemove` — cancelling the name prompt must abort the deletion entirely, not just skip logging.

Manual verification:
- Attempt to delete a loan, enter the correct master password, then cancel or leave empty the name prompt. Confirm the loan is **not** deleted (still present in the history list).
- Repeat, this time entering a name. Confirm the loan is deleted, and confirm (via the console or, once Task 6 lands, the audit log viewer) that an `excluir` entry now exists with that loan's full data as `snapshot` and the entered name as `authorizedBy`.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: require authorizer name and log audit entry on loan deletion"
```

## Task 5: Edit-loan audit trail

**Files:**
- Modify: `index.html` (script only)

**Interfaces:**
- Consumes: `logAuditEntry(action, entityId, snapshot, authorizedBy)` from Task 3.

- [ ] **Step 1: Add the editor-name prompt and audit logging to the `submitBtn` edit branch**

Current code:

```js
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
```

Replace the `if (editingLoanId) { ... }` block with:

```js
                if (editingLoanId) {
                    const authorizedBy = prompt('Digite o nome de quem está editando este empréstimo:');
                    if (!authorizedBy || !authorizedBy.trim()) {
                        showToast('Edição cancelada: nome não informado.', '⚠️');
                        return;
                    }

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

                    if (updatedLoan) logAuditEntry('editar', editingLoanId, updatedLoan, authorizedBy.trim());

                    saveToLocalStorage();
                    if (updatedLoan) syncLoanUpsert(updatedLoan);

                    // Reset editing state and form
                    resetForm();
                    showToast('Empréstimo atualizado com sucesso!', '✅');
                } else {
```

(The `} else { ... }` create-new-loan branch below is unchanged — leave it exactly as-is.)

The audit entry logs `updatedLoan` — the post-edit state, per spec ("snapshot do empréstimo após a edição") — computed by the existing `loans.map` before any save/sync call.

- [ ] **Step 2: Verify**

Code-level checks:
- Grep for `logAuditEntry('editar'` — exactly one call site, inside the `submitBtn` handler's `editingLoanId` branch.
- Confirm the name prompt and its early-return happen at the very top of the `if (editingLoanId)` block, before `loans.map(...)` runs — cancelling must leave `loans` completely untouched and the form still populated with the in-progress edit.
- Confirm the `else` (create-new-loan) branch was not modified — grep the file for `const newLoan = {` and confirm it's still reached without any name prompt.

Manual verification:
- Click "Editar" on an existing loan, change a field, click the submit/update button, then cancel or leave empty the name prompt. Confirm the loan is unchanged in the history list and the form is still showing the in-progress edit (not reset).
- Repeat, entering a name. Confirm the loan updates normally, and confirm (via console or, once Task 6 lands, the audit log viewer) an `editar` entry exists with the post-edit field values and the entered name.
- Register a brand-new loan (not editing). Confirm no name prompt appears — this flow is unaffected.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: require editor name and log audit entry on loan edit"
```

## Task 6: Audit log viewer modal

**Files:**
- Modify: `index.html` (HTML + script)

**Interfaces:**
- Consumes: `auditLog` (array, from Task 3), `formatDate` (existing helper, ~line 4003).
- Produces: `renderAuditLog()` — also wired into the Task 3 listener so live Firebase updates refresh the modal if it's open.

- [ ] **Step 1: Add the "Log de Alterações" button**

In `index.html`, the loans tab's bottom-actions currently has two buttons:

```html
                <div class="bottom-actions" style="display: flex; gap: 12px; width: 100%; flex-wrap: wrap; margin-top: 15px;">
                    <button class="btn-secondary" id="btn-export-active" style="flex: 1; min-width: 150px; justify-content: center;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span id="export-btn-label">Exportar Ativos</span>
                    </button>
                    <button class="btn-secondary" id="btn-finalize-event" style="flex: 1; min-width: 150px; justify-content: center; background-color: rgba(225, 21, 24, 0.06); border-color: var(--primary); color: var(--primary);">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        Finalizar Evento
                    </button>
                </div>
```

Add a third button:

```html
                <div class="bottom-actions" style="display: flex; gap: 12px; width: 100%; flex-wrap: wrap; margin-top: 15px;">
                    <button class="btn-secondary" id="btn-export-active" style="flex: 1; min-width: 150px; justify-content: center;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span id="export-btn-label">Exportar Ativos</span>
                    </button>
                    <button class="btn-secondary" id="btn-view-audit-log" style="flex: 1; min-width: 150px; justify-content: center;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                        </svg>
                        Log de Alterações
                    </button>
                    <button class="btn-secondary" id="btn-finalize-event" style="flex: 1; min-width: 150px; justify-content: center; background-color: rgba(225, 21, 24, 0.06); border-color: var(--primary); color: var(--primary);">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        Finalizar Evento
                    </button>
                </div>
```

- [ ] **Step 2: Add the modal HTML**

In `index.html`, the export modal closes right before the check-in modal opens:

```html
            <button type="button" class="btn-secondary" id="btn-close-export-modal" style="width: 100%;">
                Cancelar
            </button>
        </div>
    </div>

    <!-- Check-in Modal -->
    <div id="checkin-modal" class="modal-overlay">
```

Insert the new modal between them:

```html
            <button type="button" class="btn-secondary" id="btn-close-export-modal" style="width: 100%;">
                Cancelar
            </button>
        </div>
    </div>

    <!-- Audit Log Modal -->
    <div id="audit-log-modal" class="modal-overlay">
        <div class="modal-content" style="max-width: 600px; max-height: 90vh; overflow-y: auto;">
            <h3 style="margin-top: 0; color: var(--text-primary); font-size: 1.2rem; margin-bottom: 16px;">Log de Alterações de Empréstimos</h3>

            <div class="comparison-table-wrapper">
                <table class="comparison-table">
                    <thead>
                        <tr>
                            <th>Ação</th>
                            <th>Autorizado por</th>
                            <th>Data/Hora</th>
                            <th>Empréstimo</th>
                        </tr>
                    </thead>
                    <tbody id="audit-log-table-body">
                        <!-- Rows rendered dynamically via JS -->
                    </tbody>
                </table>
            </div>

            <button type="button" class="btn-secondary" id="btn-close-audit-log" style="width: 100%; margin-top: 20px;">
                Fechar
            </button>
        </div>
    </div>

    <!-- Check-in Modal -->
    <div id="checkin-modal" class="modal-overlay">
```

- [ ] **Step 3: Add DOM element references**

In `index.html`, the export modal's element consts:

```js
            const exportModal = document.getElementById('export-modal');
            const exportModalSubtitle = document.getElementById('export-modal-subtitle');
            const exportTextBtn = document.getElementById('btn-export-text');
            const exportExcelBtn = document.getElementById('btn-export-excel');
            const closeExportModalBtn = document.getElementById('btn-close-export-modal');
```

Add right after:

```js
            const exportModal = document.getElementById('export-modal');
            const exportModalSubtitle = document.getElementById('export-modal-subtitle');
            const exportTextBtn = document.getElementById('btn-export-text');
            const exportExcelBtn = document.getElementById('btn-export-excel');
            const closeExportModalBtn = document.getElementById('btn-close-export-modal');
            const auditLogModal = document.getElementById('audit-log-modal');
            const auditLogTableBody = document.getElementById('audit-log-table-body');
            const btnViewAuditLog = document.getElementById('btn-view-audit-log');
            const btnCloseAuditLog = document.getElementById('btn-close-audit-log');
```

- [ ] **Step 4: Add the `renderAuditLog` function**

In `index.html`, right after `formatDate`:

```js
            function formatDate(dateObj) {
                if (!dateObj) return '-';
                const d = new Date(dateObj);
                if (isNaN(d.getTime())) return '-';
                const pad = (n) => n.toString().padStart(2, '0');
                return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
            }
```

Add:

```js
            function formatDate(dateObj) {
                if (!dateObj) return '-';
                const d = new Date(dateObj);
                if (isNaN(d.getTime())) return '-';
                const pad = (n) => n.toString().padStart(2, '0');
                return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
            }

            function renderAuditLog() {
                if (!auditLogTableBody) return;
                const sorted = [...auditLog].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                if (sorted.length === 0) {
                    auditLogTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--text-secondary);">Nenhum registro ainda.</td></tr>';
                    return;
                }
                auditLogTableBody.innerHTML = sorted.map(entry => {
                    const s = entry.snapshot || {};
                    const resumo = `${s.item || '-'} · ${s.evento || '-'} · ${s.respArena || s.responsavel || '-'}`;
                    const acaoLabel = entry.action === 'excluir' ? 'Exclusão' : 'Edição';
                    return `
                        <tr>
                            <td>${acaoLabel}</td>
                            <td>${entry.authorizedBy || '-'}</td>
                            <td>${formatDate(entry.timestamp)}</td>
                            <td>${resumo}</td>
                        </tr>
                    `;
                }).join('');
            }
```

- [ ] **Step 5: Wire the button and modal open/close, and hook the Task 3 listener**

In `index.html`, the export modal's close-button wiring:

```js
            closeExportModalBtn.addEventListener('click', () => {
                exportModal.classList.remove('show');
            });

            // Close modal when tapping outside content
            exportModal.addEventListener('click', (e) => {
                if (e.target === exportModal) {
                    exportModal.classList.remove('show');
                }
            });
```

Add right after:

```js
            closeExportModalBtn.addEventListener('click', () => {
                exportModal.classList.remove('show');
            });

            // Close modal when tapping outside content
            exportModal.addEventListener('click', (e) => {
                if (e.target === exportModal) {
                    exportModal.classList.remove('show');
                }
            });

            btnViewAuditLog.addEventListener('click', () => {
                renderAuditLog();
                auditLogModal.classList.add('show');
            });

            btnCloseAuditLog.addEventListener('click', () => {
                auditLogModal.classList.remove('show');
            });

            auditLogModal.addEventListener('click', (e) => {
                if (e.target === auditLogModal) {
                    auditLogModal.classList.remove('show');
                }
            });
```

Then, in `setupDatabaseListeners()`, find the `auditLog` listener added in Task 3:

```js
                db.ref('auditLog').on('value', (snapshot) => {
                    const val = snapshot.val();
                    auditLog = val && typeof val === 'object' ? Object.values(val).filter(Boolean) : (Array.isArray(val) ? val : []);
                    localStorage.setItem('arena_audit_log', JSON.stringify(auditLog));
                });
```

Add a `renderAuditLog()` call so the modal (if open) reflects live updates from other devices:

```js
                db.ref('auditLog').on('value', (snapshot) => {
                    const val = snapshot.val();
                    auditLog = val && typeof val === 'object' ? Object.values(val).filter(Boolean) : (Array.isArray(val) ? val : []);
                    localStorage.setItem('arena_audit_log', JSON.stringify(auditLog));
                    renderAuditLog();
                });
```

- [ ] **Step 6: Verify**

Code-level checks:
- Grep for `audit-log-modal` — matches the HTML div id, the JS const, and the two `classList` toggles.
- Grep for `renderAuditLog` — one function definition, one call in `btnViewAuditLog`'s click handler, one call in the `setupDatabaseListeners` listener.
- Confirm `renderAuditLog` is a plain function declaration (hoisted), so its placement relative to the `setupDatabaseListeners` function body doesn't matter for correctness — but confirm it's defined before `document.addEventListener('DOMContentLoaded', ...)`'s synchronous code finishes running (it is — everything here lives inside that same handler).
- Confirm the new modal HTML is a sibling of the other `.modal-overlay` divs (not nested inside one), matching the existing modal markup pattern.

Manual verification:
- Click "Log de Alterações" with no edits/deletions yet performed. Confirm the modal opens and shows "Nenhum registro ainda."
- Perform a loan edit (Task 5) and a loan deletion (Task 4), each with a name entered. Reopen the log. Confirm both entries appear, most recent first, with correct ação/nome/data/resumo columns.
- Tap outside the modal content and confirm it closes; reopen and click "Fechar", confirm it closes.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: add audit log viewer modal for loan edits/deletions"
```

---

## Self-Review Notes

Spec coverage check against `docs/superpowers/specs/2026-08-07-fase3-melhorias-gerais-design.md`:
- §1 Indicador de conexão → Task 1 (all three states, transient syncing, badge placement, `title`/`aria-label`).
- §2 Compressão de fotos → Task 2 (both capture points, 1280px cap, JPEG 0.8, no UI change).
- §3 Log de auditoria → Tasks 3–6 (collection + granular sync, delete flow with password+name, edit flow with name only, viewer modal with correct columns and reverse-chronological order).
- "Fora de escopo" items (room inspections/keys audit, dashboard, password-gated editing, fabricated syncing signals) — none of the six tasks touch those areas; confirmed by scope of each task's file/line targets.

Type/name consistency verified across tasks: `logAuditEntry(action, entityId, snapshot, authorizedBy)` signature is identical at its Task 3 definition and both Task 4/5 call sites; `auditLog` variable name is consistent everywhere; `renderAuditLog()` takes no arguments everywhere it's referenced (Task 6 definition, Task 6 click handler, Task 3's listener as amended by Task 6).
