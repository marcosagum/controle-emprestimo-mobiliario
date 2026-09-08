# Cartões de Sala Clicáveis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make room cards in the Vistorias de Sala grid clickable (opening the existing comparison report even before check-out) and give them a status-tinted background instead of today's thin left-border accent.

**Architecture:** Single-file app (`index.html`), no build tooling, no automated test suite. `renderRoomsGrid()` already knows which inspection belongs to each card (open or closed); this plan wires that known inspection id into a click listener on the card element, reusing the existing `viewInspectionReport` modal unchanged. CSS changes swap the left-border accent for a background tint using tokens already used elsewhere in the file.

**Tech Stack:** HTML/CSS/vanilla JS. No new dependencies.

## Global Constraints

- Do not modify `window.viewInspectionReport` — it already renders correctly for both an open (no check-out yet) and a closed inspection; this plan only adds new call sites for it.
- Do not change `statusSala`, `archiveRoomCard`, or any other room-occupancy/lifecycle logic — only the card's presentation and click behavior change.
- Do not add new CSS custom-property tokens or literal colors — reuse `--success-glow`/`--primary-glow` (already used by `.room-status-badge.badge-available`/`.badge-occupied`) for the tint, and the existing `--transition-smooth` token already applied to `.room-card`.
- Clicking any of the card's existing action buttons (Realizar Check-out, Editar Check-in, Editar Vistoria, Remover Card da Tela) must never also trigger the new click-to-open-report behavior.
- A room card with no associated inspection at all (available, never used) must not become clickable and must not show a pointer cursor.
- No automated tests exist for this project. Verification is grep/read-based plus a manual browser checklist written out in full for the human operator.

---

### Task 1: Clickable, status-tinted room cards

**Files:**
- Modify: `index.html:1247-1252` (`.room-card.room-available`/`.room-card.room-occupied` CSS)
- Modify: `index.html:3136-3218` (the `roomsForEvento.forEach(room => {...})` card-building loop inside `renderRoomsGrid`)

**Interfaces:** None — this is the only task in this plan.

- [ ] **Step 1: Swap the left-border accent for a status-tinted background**

Current code (verified at `index.html:1247-1252`):
```css
        .room-card.room-available {
            border-left-color: var(--success);
        }
        .room-card.room-occupied {
            border-left-color: var(--primary);
        }
```
Change to:
```css
        .room-card.room-available {
            background-color: var(--success-glow);
        }
        .room-card.room-occupied {
            background-color: var(--primary-glow);
        }
```
(The base `.room-card` rule at `index.html:1233-1243` keeps its existing `border: 1px solid var(--border-color);` unchanged — only these two status-specific rules change from a border-left color to a background color.)

- [ ] **Step 2: Add the clickable-card CSS**

Add this new rule right after the `.room-card.room-occupied` rule from Step 1:
```css
        .room-card-clickable {
            cursor: pointer;
        }
        .room-card-clickable:active {
            transform: scale(0.98);
        }
```
(Mirrors the existing `.event-card`/`.event-card:active` pattern at `index.html:1153-1167` — no new transition needed since `.room-card` already has `transition: var(--transition-smooth);`.)

- [ ] **Step 3: Track which inspection each card should open, and remove the redundant button**

Current code (verified at `index.html:3136-3201`, the full per-room card-building loop body before `card.innerHTML` is set):
```javascript
                roomsForEvento.forEach(room => {
                    const card = document.createElement('div');
                    card.className = `room-card ${room.statusSala === 'Disponível' ? 'room-available' : 'room-occupied'}`;
                    
                    const isAvailable = room.statusSala === 'Disponível';
                    const badgeClass = isAvailable ? 'badge-available' : 'badge-occupied';
                    
                    let detailsHTML = '';
                    let actionButtonsHTML = '';
                    
                    if (!isAvailable && room.currentInspectionId) {
                        const inspection = roomInspections.find(i => i.id === room.currentInspectionId);
                        if (inspection) {
                            const date = new Date(inspection.checkinDataHora);
                            const formattedDate = `${date.getDate().toString().padStart(2,'0')}/${(date.getMonth()+1).toString().padStart(2,'0')} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
                            
                            detailsHTML = `
                                <div class="room-details">
                                    <div class="room-details-row">
                                        <span class="room-details-label">Evento:</span>
                                        <span class="room-details-value">${getEventoNome(inspection.eventoId)}</span>
                                    </div>
                                    <div class="room-details-row">
                                        <span class="room-details-label">Cliente:</span>
                                        <span class="room-details-value">${inspection.checkinRespCliente}</span>
                                    </div>
                                    <div class="room-details-row">
                                        <span class="room-details-label">Entrada:</span>
                                        <span class="room-details-value">${formattedDate}</span>
                                    </div>
                                </div>
                            `;
                            
                            actionButtonsHTML = `
                                <button type="button" class="btn-submit" onclick="openCheckoutModal('${room.id}')" style="margin-top: 10px; background-color: var(--primary); justify-content: center; width: 100%;">
                                    📋 Realizar Check-out (Saída)
                                </button>
                                <button type="button" class="btn-secondary" onclick="triggerEditInspection('${room.id}')" style="margin-top: 6px; justify-content: center; width: 100%; border-color: var(--border-color); color: var(--text-primary);">
                                    ✏️ Editar Check-in
                                </button>
                            `;
                        }
                    } else {
                        // Room is available. Check if there was a previous inspection to allow viewing its summary.
                        const lastInspection = roomInspections.slice().reverse().find(i => i.salaId === room.id && i.status !== 'Aberto');
                        
                        actionButtonsHTML = ``;
                        
                        if (lastInspection) {
                            actionButtonsHTML += `
                                <button type="button" class="btn-secondary" onclick="viewInspectionReport('${lastInspection.id}')" style="margin-top: 8px; justify-content: center; width: 100%;">
                                    📄 Ver Vistoria Realizada
                                </button>
                                <button type="button" class="btn-secondary" onclick="triggerEditInspection('${room.id}', '${lastInspection.id}')" style="margin-top: 6px; justify-content: center; width: 100%; border-color: var(--border-color); color: var(--text-primary);">
                                    ✏️ Editar Vistoria
                                </button>
                            `;
                        }
                        
                        // Add "Remover Card" button to clear screen
                        actionButtonsHTML += `
                            <button type="button" class="btn-danger" onclick="archiveRoomCard('${room.id}')" style="margin-top: 8px; width: 100%;">
                                ❌ Remover Card da Tela
                            </button>
                        `;
                    }
```
Change to (adds a `reportInspectionId` variable, set in both branches; removes the "Ver Vistoria Realizada" button):
```javascript
                roomsForEvento.forEach(room => {
                    const card = document.createElement('div');
                    card.className = `room-card ${room.statusSala === 'Disponível' ? 'room-available' : 'room-occupied'}`;
                    
                    const isAvailable = room.statusSala === 'Disponível';
                    const badgeClass = isAvailable ? 'badge-available' : 'badge-occupied';
                    
                    let detailsHTML = '';
                    let actionButtonsHTML = '';
                    let reportInspectionId = null;
                    
                    if (!isAvailable && room.currentInspectionId) {
                        const inspection = roomInspections.find(i => i.id === room.currentInspectionId);
                        if (inspection) {
                            reportInspectionId = inspection.id;
                            const date = new Date(inspection.checkinDataHora);
                            const formattedDate = `${date.getDate().toString().padStart(2,'0')}/${(date.getMonth()+1).toString().padStart(2,'0')} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
                            
                            detailsHTML = `
                                <div class="room-details">
                                    <div class="room-details-row">
                                        <span class="room-details-label">Evento:</span>
                                        <span class="room-details-value">${getEventoNome(inspection.eventoId)}</span>
                                    </div>
                                    <div class="room-details-row">
                                        <span class="room-details-label">Cliente:</span>
                                        <span class="room-details-value">${inspection.checkinRespCliente}</span>
                                    </div>
                                    <div class="room-details-row">
                                        <span class="room-details-label">Entrada:</span>
                                        <span class="room-details-value">${formattedDate}</span>
                                    </div>
                                </div>
                            `;
                            
                            actionButtonsHTML = `
                                <button type="button" class="btn-submit" onclick="openCheckoutModal('${room.id}')" style="margin-top: 10px; background-color: var(--primary); justify-content: center; width: 100%;">
                                    📋 Realizar Check-out (Saída)
                                </button>
                                <button type="button" class="btn-secondary" onclick="triggerEditInspection('${room.id}')" style="margin-top: 6px; justify-content: center; width: 100%; border-color: var(--border-color); color: var(--text-primary);">
                                    ✏️ Editar Check-in
                                </button>
                            `;
                        }
                    } else {
                        // Room is available. Check if there was a previous inspection to allow viewing its summary.
                        const lastInspection = roomInspections.slice().reverse().find(i => i.salaId === room.id && i.status !== 'Aberto');
                        
                        actionButtonsHTML = ``;
                        
                        if (lastInspection) {
                            reportInspectionId = lastInspection.id;
                            actionButtonsHTML += `
                                <button type="button" class="btn-secondary" onclick="triggerEditInspection('${room.id}', '${lastInspection.id}')" style="margin-top: 6px; justify-content: center; width: 100%; border-color: var(--border-color); color: var(--text-primary);">
                                    ✏️ Editar Vistoria
                                </button>
                            `;
                        }
                        
                        // Add "Remover Card" button to clear screen
                        actionButtonsHTML += `
                            <button type="button" class="btn-danger" onclick="archiveRoomCard('${room.id}')" style="margin-top: 8px; width: 100%;">
                                ❌ Remover Card da Tela
                            </button>
                        `;
                    }
```
Note the entire `<button ... onclick="viewInspectionReport('${lastInspection.id}')">📄 Ver Vistoria Realizada</button>` block (3 lines) was removed from inside the `if (lastInspection) { ... }` branch — only "✏️ Editar Vistoria" remains there.

- [ ] **Step 4: Attach the click handler after the card is built**

Current code (verified at `index.html:3203-3218`, immediately following the code from Step 3):
```javascript
                    card.innerHTML = `
                        <div class="room-card-header">
                            <div>
                                <span class="room-title">${room.name}</span>
                                <span class="room-code" style="margin-left: 8px;">${room.code}</span>
                            </div>
                            <span class="room-status-badge ${badgeClass}">${room.statusSala || 'Em Uso'}</span>
                        </div>
                        ${detailsHTML}
                        <div style="display: flex; flex-direction: column; gap: 4px; width: 100%;">
                            ${actionButtonsHTML}
                        </div>
                    `;
                    
                    roomsListGrid.appendChild(card);
                });
```
Change to (adds the click-wiring block between `card.innerHTML = ...` and `roomsListGrid.appendChild(card)`):
```javascript
                    card.innerHTML = `
                        <div class="room-card-header">
                            <div>
                                <span class="room-title">${room.name}</span>
                                <span class="room-code" style="margin-left: 8px;">${room.code}</span>
                            </div>
                            <span class="room-status-badge ${badgeClass}">${room.statusSala || 'Em Uso'}</span>
                        </div>
                        ${detailsHTML}
                        <div style="display: flex; flex-direction: column; gap: 4px; width: 100%;">
                            ${actionButtonsHTML}
                        </div>
                    `;

                    if (reportInspectionId) {
                        card.classList.add('room-card-clickable');
                        card.addEventListener('click', (e) => {
                            if (e.target.closest('button')) return;
                            viewInspectionReport(reportInspectionId);
                        });
                    }
                    
                    roomsListGrid.appendChild(card);
                });
```

- [ ] **Step 5: Verify**

```bash
grep -n "reportInspectionId\|room-card-clickable\|Ver Vistoria Realizada" index.html
```
Expected: `reportInspectionId` appears 4 times (declaration + 2 assignments in the two branches + 1 read inside the click listener); `room-card-clickable` appears 3 times (the `.room-card-clickable { cursor: pointer; }` rule, the `.room-card-clickable:active { ... }` rule — both selectors contain the substring — and the one `classList.add('room-card-clickable')` call); `Ver Vistoria Realizada` no longer appears anywhere in the file (0 matches — it existed exactly once before this task).

Read back the full `roomsForEvento.forEach(...)` loop to confirm: (a) `reportInspectionId` is declared once per iteration (`let reportInspectionId = null;`) alongside `detailsHTML`/`actionButtonsHTML`, (b) it's set in both the occupied branch (inside the `if (inspection) {...}` block) and the available branch (inside `if (lastInspection) {...}`), (c) the click listener is added after `card.innerHTML` is assigned and before `roomsListGrid.appendChild(card)`, (d) no other part of the loop changed.

Manual browser checklist (for the human operator, not the agent):
- Fazer check-in numa sala e, antes do check-out, clicar no cartão dela — confirmar que abre o Relatório Comparativo com "Aberto (Pendente Check-out)", o mobiliário e as fotos do check-in.
- Nesse mesmo cartão, clicar em "Realizar Check-out" e depois (num check-in diferente) em "Editar Check-in" — confirmar que cada botão continua fazendo só o que já fazia, sem abrir o relatório junto.
- Fazer o check-out dessa vistoria e clicar no cartão (agora disponível) — confirmar que o relatório abre com os dados de check-out preenchidos.
- Confirmar visualmente que "Ver Vistoria Realizada" não aparece mais em nenhum cartão, e que "Editar Vistoria"/"Remover Card da Tela" continuam funcionando normalmente.
- Numa sala disponível sem nenhuma vistoria anterior (nunca usada), confirmar que o cartão não tem cursor de mãozinha e não reage ao clique.
- Comparar visualmente um cartão ocupado e um disponível na mesma grade — confirmar o fundo vermelho-claro/verde-claro e que todo o texto (título, código, badge, detalhes) continua legível por cima.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat: make room cards clickable to view check-in report, tint by status

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
