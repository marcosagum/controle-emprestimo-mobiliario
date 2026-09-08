# Encerramento de Evento com Exportação e Exclusão Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When an event is closed via "Encerrar Evento", block the action entirely if anything is still pending, then export the event's complete history (3 Excel sheets + one photo-rich printable report) and, only after the master password confirms it, permanently delete the event's loans/inspections/key-history from Firebase — including the base64 photos that are the main source of the database's unbounded growth.

**Architecture:** Single-file app (`index.html`), no build tooling, no automated test suite. Two new export-generation functions (Excel) and one new print-report builder are self-contained and don't touch the finalize flow. A third task wires them together inside `proceedWithFinalization`, adds the pending-items hard block, the master-password gate, and the actual Firebase deletion.

**Tech Stack:** HTML/CSS/vanilla JS, Firebase Realtime Database (compat SDK), localStorage. No new dependencies — reuses the app's existing `.xls`-via-HTML export trick and `window.print()`-to-PDF pattern.

## Global Constraints

- Do not modify `downloadExcelStyled` or `getFilteredLoansForExport` — they keep serving the existing manual "Baixar Planilha (Excel)" button unchanged.
- Do not touch `activeRoomsState`, `predefinedRooms`, or `roomInventories` — only `loans`, `roomInspections`, and `keyHistory` records belonging to the closed event are deleted.
- The `eventos/<id>` record itself is never deleted — only its `status` field is updated to `'encerrado'`, exactly as today.
- Deletion must be gated by the master password (`gl@operacoes`), following the exact pattern already used elsewhere in this file (`prompt()` + `if (pass !== 'gl@operacoes') { alert(...); return; }`).
- If the event still has an open room inspection (`status === 'Aberto'`) or an active key/AC loan, closing the event must be **blocked entirely** — no export, no deletion, no status change. This replaces today's `confirm()` (which lets the user proceed anyway).
- No automated tests exist for this project. Verification is grep/read-based plus a manual browser checklist written out in full for the human operator.
- Every new function reuses existing helpers (`formatDate`, `getEventoNome`, `isAcTipo`) rather than re-deriving their logic.

---

### Task 1: Excel exports for Vistorias and Chaves/Controles

**Files:**
- Modify: `index.html:5651` area (right after the existing `downloadExcelStyled` function closes, before the `/* --- FINALIZE EVENT LOGIC --- */` comment)

**Interfaces:**
- Produces: `function downloadInspectionsExcel(eventInspections, eventName)` — `eventInspections` is an array of closed `roomInspections` records (each with `salaId`, `checkinDataHora`, `checkoutDataHora`, `checkinRespCliente`, `checkinOperador`, `checkoutRespCliente`, `checkoutOperador`, `checklist` — the same shape `viewInspectionReport` already consumes). Triggers a `.xls` file download, one row per checklist item across all inspections. No return value.
- Produces: `function downloadKeyHistoryExcel(eventKeyHistory, eventName)` — `eventKeyHistory` is an array of `keyHistory` records (each with `tipo`, `salaId`/`qtyKey` or `qtyAc`, `checkinRespCliente`, `checkinOperador`, `checkoutRespCliente`, `checkoutOperador`, `checkinDataHora`, `checkoutDataHora`, `avaria`, `avariaDescricao` — the shape established in Fase 8). Triggers a `.xls` file download, one row per record. No return value.
- Consumes: existing `formatDate(dateObj)` (`index.html:4988`), `isAcTipo(rec)` (`index.html:5817`), and the module-level `predefinedRooms` array — all already defined elsewhere in the file, unchanged by this task.

- [ ] **Step 1: Add `downloadInspectionsExcel`**

Insert this new function immediately after `downloadExcelStyled`'s closing `}` (currently `index.html:5651`, right before the blank line and the `/* --- FINALIZE EVENT LOGIC --- */` comment at `index.html:5653`):

```javascript
            function downloadInspectionsExcel(eventInspections, eventName) {
                let html = `
                <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                <head>
                <meta charset="utf-8">
                <!--[if gte mso 9]>
                <xml>
                <x:ExcelWorkbook>
                  <x:ExcelWorksheets>
                    <x:ExcelWorksheet>
                      <x:Name>Vistorias</x:Name>
                      <x:WorksheetOptions>
                        <x:DisplayGridlines/>
                      </x:WorksheetOptions>
                    </x:ExcelWorksheet>
                  </x:ExcelWorksheets>
                </x:ExcelWorkbook>
                </xml>
                <![endif]-->
                <style>
                    table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11pt; }
                    th { background-color: #B31F24; color: #FFFFFF; font-weight: bold; border: 1px solid #D9D9D9; padding: 8px; text-align: left; }
                    td { border: 1px solid #D9D9D9; padding: 6px; }
                    .header-title { font-size: 16pt; font-weight: bold; color: #B31F24; padding-bottom: 10px; }
                </style>
                </head>
                <body>
                <table>
                    <tr>
                        <td colspan="11" class="header-title" style="border:none;">GL events | Relatório de Vistorias (${eventName})</td>
                    </tr>
                    <tr>
                        <th>Sala</th>
                        <th>Data Check-in</th>
                        <th>Data Check-out</th>
                        <th>Resp. Abertura</th>
                        <th>Resp. Fechamento</th>
                        <th>Item</th>
                        <th>Qtd Entrada</th>
                        <th>Qtd Saída</th>
                        <th>Estado Entrada</th>
                        <th>Estado Saída</th>
                        <th>Observações</th>
                    </tr>
                `;

                eventInspections.forEach(insp => {
                    const room = predefinedRooms.find(r => r && r.id === insp.salaId);
                    const roomLabel = room ? `${room.name} (${room.code})` : (insp.salaId || '-');
                    const respAbertura = `${insp.checkinRespCliente || ''} / ${insp.checkinOperador || ''}`;
                    const respFechamento = `${insp.checkoutRespCliente || ''} / ${insp.checkoutOperador || ''}`;
                    const items = (insp.checklist && insp.checklist.length > 0) ? insp.checklist : [null];

                    items.forEach(item => {
                        html += `
                        <tr>
                            <td style="mso-number-format:'\\@';">${roomLabel}</td>
                            <td>${formatDate(insp.checkinDataHora)}</td>
                            <td>${formatDate(insp.checkoutDataHora)}</td>
                            <td>${respAbertura}</td>
                            <td>${respFechamento}</td>
                            <td>${item ? item.name : '-'}</td>
                            <td>${item ? item.checkinQty : '-'}</td>
                            <td>${item && item.checkoutQty !== null ? item.checkoutQty : '-'}</td>
                            <td>${item ? item.checkinState : '-'}</td>
                            <td>${item && item.checkoutState ? item.checkoutState : '-'}</td>
                            <td>${item && item.observacoes ? item.observacoes : ''}</td>
                        </tr>
                        `;
                    });
                });

                html += `
                </table>
                </body>
                </html>
                `;

                const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.setAttribute("download", `relatorio_vistorias_${eventName.toLowerCase()}.xls`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                showToast('Planilha de Vistorias baixada!', '📊');
            }
```

- [ ] **Step 2: Add `downloadKeyHistoryExcel`**

Insert this immediately after `downloadInspectionsExcel`'s closing `}` from Step 1:

```javascript
            function downloadKeyHistoryExcel(eventKeyHistory, eventName) {
                let html = `
                <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                <head>
                <meta charset="utf-8">
                <!--[if gte mso 9]>
                <xml>
                <x:ExcelWorkbook>
                  <x:ExcelWorksheets>
                    <x:ExcelWorksheet>
                      <x:Name>Chaves e Controles</x:Name>
                      <x:WorksheetOptions>
                        <x:DisplayGridlines/>
                      </x:WorksheetOptions>
                    </x:ExcelWorksheet>
                  </x:ExcelWorksheets>
                </x:ExcelWorkbook>
                </xml>
                <![endif]-->
                <style>
                    table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11pt; }
                    th { background-color: #B31F24; color: #FFFFFF; font-weight: bold; border: 1px solid #D9D9D9; padding: 8px; text-align: left; }
                    td { border: 1px solid #D9D9D9; padding: 6px; }
                    .header-title { font-size: 16pt; font-weight: bold; color: #B31F24; padding-bottom: 10px; }
                </style>
                </head>
                <body>
                <table>
                    <tr>
                        <td colspan="9" class="header-title" style="border:none;">GL events | Relatório de Chaves e Controles (${eventName})</td>
                    </tr>
                    <tr>
                        <th>Tipo</th>
                        <th>Sala</th>
                        <th>Quantidade</th>
                        <th>Resp. Abertura</th>
                        <th>Resp. Fechamento</th>
                        <th>Data Retirada</th>
                        <th>Data Devolução</th>
                        <th>Avaria</th>
                        <th>Descrição da Avaria</th>
                    </tr>
                `;

                eventKeyHistory.forEach(rec => {
                    const isAc = isAcTipo(rec);
                    const room = !isAc ? predefinedRooms.find(r => r && r.id === rec.salaId) : null;
                    const roomLabel = isAc ? '-' : (room ? `${room.name} (${room.code})` : (rec.salaId || '-'));
                    const qty = isAc ? rec.qtyAc : rec.qtyKey;

                    html += `
                    <tr>
                        <td>${isAc ? 'Controle de Ar' : 'Chave'}</td>
                        <td style="mso-number-format:'\\@';">${roomLabel}</td>
                        <td>${qty}</td>
                        <td>${rec.checkinRespCliente || ''} / ${rec.checkinOperador || ''}</td>
                        <td>${rec.checkoutRespCliente || ''} / ${rec.checkoutOperador || ''}</td>
                        <td>${formatDate(rec.checkinDataHora)}</td>
                        <td>${formatDate(rec.checkoutDataHora)}</td>
                        <td>${rec.avaria ? 'Sim' : 'Não'}</td>
                        <td>${rec.avariaDescricao || ''}</td>
                    </tr>
                    `;
                });

                html += `
                </table>
                </body>
                </html>
                `;

                const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.setAttribute("download", `relatorio_chaves_${eventName.toLowerCase()}.xls`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                showToast('Planilha de Chaves e Controles baixada!', '📊');
            }
```

- [ ] **Step 3: Verify**

```bash
grep -n "function downloadInspectionsExcel\|function downloadKeyHistoryExcel" index.html
```
Expected: each appears exactly once (the definition — neither is called anywhere yet, that's Task 3's job).

Read both functions back in full and confirm: (a) each follows the exact `.xls`-via-HTML pattern used by `downloadExcelStyled` (same `xmlns`/`ExcelWorkbook` preamble shape, same `Blob`/anchor-download mechanism), (b) `downloadInspectionsExcel`'s `colspan` is `11` matching its 11 `<th>` columns, `downloadKeyHistoryExcel`'s is `9` matching its 9 columns, (c) neither references `predefinedRooms`, `formatDate`, or `isAcTipo` incorrectly (all three already exist elsewhere in the file, unmodified).

Manual browser checklist (for the human operator — since these functions aren't wired to any button yet, test them from the browser console):
- Open the app, open the browser console, and run `downloadInspectionsExcel(roomInspections.filter(i => i.status !== 'Aberto').slice(0, 3), 'Teste')` — confirm a `.xls` file downloads, opens in Excel with one row per checklist item, and the header shows "Relatório de Vistorias (Teste)".
- Run `downloadKeyHistoryExcel(keyHistory.slice(0, 3), 'Teste')` — confirm a `.xls` file downloads with one row per key/AC history record, showing "Chave" or "Controle de Ar" correctly per row, and avaria showing "Sim"/"Não" correctly.
- Run `downloadInspectionsExcel([], 'Vazio')` and `downloadKeyHistoryExcel([], 'Vazio')` — confirm both still download a valid (header-only) `.xls` file without throwing an error.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat: add Excel exports for room inspections and key/AC history

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Photo-rich print report for all of an event's inspections

**Files:**
- Modify: `index.html:1592-1650` (`@media print` block)
- Modify: `index.html:2382` area (right after `#comparison-modal`'s closing `</div>`, before the "Entrega de Chave/Controle Modal" comment)
- Modify: `index.html:4104` area (right before `window.viewInspectionReport`'s definition)

**Interfaces:**
- Produces: `function buildInspectionReportBlockHTML(inspection)` — takes one closed `roomInspections` record, returns an HTML string (not a DOM mutation) with the same visual structure as `#comparison-modal`'s `.comparison-container` (meta grid, checklist table with `tr.divergence` on mismatched rows, check-in/check-out photo grids).
- Produces: `function printEventInspectionsReport(eventInspections, eventName)` — takes an array of closed inspections and the event's name, builds a concatenated multi-page report inside `#event-report-print`, and triggers `window.print()`. A no-op (returns immediately) if `eventInspections` is empty.
- Consumes: existing `predefinedRooms`, `getEventoNome(eventoId)` (`index.html:2977`) — unchanged.

- [ ] **Step 1: Add the `#event-report-print` container and fix the print CSS**

Current print CSS (verified at `index.html:1592-1650`):
```css
        @media print {
            body * {
                visibility: hidden;
            }
            #comparison-modal, #comparison-modal * {
                visibility: visible;
            }
            #comparison-modal {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                height: auto;
                background-color: #fff !important;
                color: #000 !important;
            }
```
Change the opening of that block to:
```css
        @media print {
            body * {
                visibility: hidden;
            }
            #comparison-modal.show, #comparison-modal.show *,
            #event-report-print.show, #event-report-print.show * {
                visibility: visible;
            }
            #comparison-modal.show, #event-report-print.show {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                height: auto;
                background-color: #fff !important;
                color: #000 !important;
            }
```
(Everything else inside the `@media print` block — the `.modal-overlay`, `.modal-content`, `.comparison-meta`, `.comparison-table`, `.comparison-photo-img` rules — stays exactly as it is. `#event-report-print` is a bare `<div>`, not a `.modal-overlay`, so those rules don't apply to it and don't need to; it reuses the already-print-styled `.comparison-meta`/`.comparison-table`/`.comparison-photo-img` classes directly since `buildInspectionReportBlockHTML` — Step 3 below — emits markup with those same class names.)

This also fixes a pre-existing bug: today `#comparison-modal, #comparison-modal *` has no `.show` requirement, so an accidental `Ctrl+P` with no report open would print that modal empty. Requiring `.show` on both selectors closes that gap for both print targets at once.

Add this new rule in the base (non-print) `<style>` block, right after the `.comparison-container` rule (search for `.comparison-container {` — add the new rule immediately after its closing `}`):
```css
        #event-report-print {
            display: none;
        }
```

Add the container itself in the HTML, right after `#comparison-modal`'s closing `</div>` (verified at `index.html:2382`, immediately before the `<!-- Entrega de Chave/Controle Modal -->` comment):
```html
      </div>

      <div id="event-report-print"></div>

      <!-- Entrega de Chave/Controle Modal -->
      <div id="key-loan-modal" class="modal-overlay">
```

- [ ] **Step 2: Add the DOM const for the new container**

Add this line near the other `comparison`-related consts (search for `const comparisonModal = document.getElementById('comparison-modal');` — add the new const on the next line):
```javascript
            const comparisonModal = document.getElementById('comparison-modal');
            const eventReportPrint = document.getElementById('event-report-print');
```

- [ ] **Step 3: Add `buildInspectionReportBlockHTML`**

Add this function right before `window.viewInspectionReport`'s definition (search for `// View comparison report` / `window.viewInspectionReport = function`, insert immediately above that comment):

```javascript
            function buildInspectionReportBlockHTML(inspection) {
                const room = predefinedRooms.find(r => r && r.id === inspection.salaId);
                const roomLabel = room ? `${room.name} (${room.code})` : '-';
                const eventName = getEventoNome(inspection.eventoId);

                const checkinDate = new Date(inspection.checkinDataHora);
                const checkinTime = `${checkinDate.getDate().toString().padStart(2,'0')}/${(checkinDate.getMonth()+1).toString().padStart(2,'0')}/${checkinDate.getFullYear()} ${checkinDate.getHours().toString().padStart(2,'0')}:${checkinDate.getMinutes().toString().padStart(2,'0')}`;

                let checkoutTime = 'Aberto (Pendente Check-out)';
                if (inspection.checkoutDataHora) {
                    const checkoutDate = new Date(inspection.checkoutDataHora);
                    checkoutTime = `${checkoutDate.getDate().toString().padStart(2,'0')}/${(checkoutDate.getMonth()+1).toString().padStart(2,'0')}/${checkoutDate.getFullYear()} ${checkoutDate.getHours().toString().padStart(2,'0')}:${checkoutDate.getMinutes().toString().padStart(2,'0')}`;
                }

                const respOpen = `${inspection.checkinRespCliente} (Cliente) / ${inspection.checkinOperador} (Arena)`;
                const respClose = inspection.checkoutDataHora ? `${inspection.checkoutRespCliente} (Cliente) / ${inspection.checkoutOperador} (Arena)` : '-';

                let tableRowsHTML = '';
                inspection.checklist.forEach(item => {
                    const isDivergent = item.checkoutQty !== null && (item.checkinQty !== item.checkoutQty || item.checkinState !== item.checkoutState);
                    const checkinStateSpan = `<span class="checklist-state-btn selected" data-state="${item.checkinState}" style="padding: 2px 6px; font-size: 0.7rem; pointer-events: none;">${item.checkinState}</span>`;
                    const checkoutStateSpan = item.checkoutState ? `<span class="checklist-state-btn selected" data-state="${item.checkoutState}" style="padding: 2px 6px; font-size: 0.7rem; pointer-events: none;">${item.checkoutState}</span>` : '-';
                    tableRowsHTML += `
                        <tr class="${isDivergent ? 'divergence' : ''}">
                            <td style="font-weight: bold;">
                                ${item.name}
                                ${item.observacoes ? `<div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: normal; margin-top: 4px;">Obs: ${item.observacoes}</div>` : ''}
                            </td>
                            <td>${item.checkinQty}</td>
                            <td>${item.checkoutQty !== null ? item.checkoutQty : '-'}</td>
                            <td>${checkinStateSpan}</td>
                            <td>${checkoutStateSpan}</td>
                        </tr>
                    `;
                });

                const buildPhotosHTML = (photos) => {
                    if (!photos || photos.length === 0) {
                        return '<div style="color: var(--text-secondary); font-size: 0.85rem; padding: 10px;">Nenhuma foto registrada.</div>';
                    }
                    return photos.map(photo => {
                        const date = new Date(photo.timestamp);
                        const formattedTime = `${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
                        return `
                            <div class="comparison-photo-item">
                                <img class="comparison-photo-img" src="${photo.url}">
                                <div class="comparison-photo-time">Enviada às ${formattedTime}</div>
                            </div>
                        `;
                    }).join('');
                };

                return `
                    <div class="comparison-container">
                        <div class="comparison-meta">
                            <div class="comparison-meta-item">
                                <span class="comparison-meta-label">Sala</span>
                                <span class="comparison-meta-val">${roomLabel}</span>
                            </div>
                            <div class="comparison-meta-item">
                                <span class="comparison-meta-label">Evento / Contrato</span>
                                <span class="comparison-meta-val">${eventName}</span>
                            </div>
                            <div class="comparison-meta-item">
                                <span class="comparison-meta-label">Data Check-in</span>
                                <span class="comparison-meta-val">${checkinTime}</span>
                            </div>
                            <div class="comparison-meta-item">
                                <span class="comparison-meta-label">Data Check-out</span>
                                <span class="comparison-meta-val">${checkoutTime}</span>
                            </div>
                            <div class="comparison-meta-item">
                                <span class="comparison-meta-label">Resp. Abertura</span>
                                <span class="comparison-meta-val">${respOpen}</span>
                            </div>
                            <div class="comparison-meta-item">
                                <span class="comparison-meta-label">Resp. Fechamento</span>
                                <span class="comparison-meta-val">${respClose}</span>
                            </div>
                        </div>

                        <div class="comparison-table-wrapper">
                            <table class="comparison-table">
                                <thead>
                                    <tr>
                                        <th>Item</th>
                                        <th>Qtd Entrada</th>
                                        <th>Qtd Saída</th>
                                        <th>Integridade Entrada</th>
                                        <th>Integridade Saída</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableRowsHTML}
                                </tbody>
                            </table>
                        </div>

                        <div class="comparison-photos-grid">
                            <div class="comparison-photo-column">
                                <span class="comparison-photo-title title-checkin">Fotos Check-in</span>
                                <div class="comparison-photo-list">
                                    ${buildPhotosHTML(inspection.photosCheckin)}
                                </div>
                            </div>
                            <div class="comparison-photo-column">
                                <span class="comparison-photo-title title-checkout">Fotos Check-out</span>
                                <div class="comparison-photo-list">
                                    ${buildPhotosHTML(inspection.photosCheckout)}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
```

- [ ] **Step 4: Add `printEventInspectionsReport` and the print-cleanup handler**

Add this right after `buildInspectionReportBlockHTML`'s closing `}` from Step 3:

```javascript
            function printEventInspectionsReport(eventInspections, eventName) {
                if (eventInspections.length === 0) return;
                const today = new Date();
                const dateStr = `${today.getDate().toString().padStart(2,'0')}/${(today.getMonth()+1).toString().padStart(2,'0')}/${today.getFullYear()}`;
                let printHTML = `<h2 style="color: var(--primary);">Relatório de Vistorias — ${eventName}</h2><p>Gerado em ${dateStr}</p>`;
                eventInspections.forEach((insp, idx) => {
                    const pageBreakStyle = idx > 0 ? 'page-break-before: always;' : '';
                    printHTML += `<div style="${pageBreakStyle}">${buildInspectionReportBlockHTML(insp)}</div>`;
                });
                eventReportPrint.innerHTML = printHTML;
                eventReportPrint.classList.add('show');
                window.print();
            }

            window.onafterprint = function() {
                eventReportPrint.classList.remove('show');
            };
```

- [ ] **Step 5: Verify**

```bash
grep -n "event-report-print\|buildInspectionReportBlockHTML\|printEventInspectionsReport\|onafterprint" index.html
```
Expected: `event-report-print` appears 4 times (the CSS `display: none` rule's selector, the HTML `<div id="...">`, the `getElementById` const, and the print-media `.show` selector — recount by reading, since the print block's selector also contains the substring); `buildInspectionReportBlockHTML` appears 2 times (definition + 1 call inside `printEventInspectionsReport`); `printEventInspectionsReport` appears once (the definition — not called anywhere yet, that's Task 3's job); `onafterprint` appears once.

Read back the full `@media print` block and confirm: (a) both `#comparison-modal` selectors now require `.show`, (b) the new `#event-report-print.show` selectors are present and correctly paired, (c) no other rule in that block was altered. Read back `buildInspectionReportBlockHTML` and confirm every class name it emits (`comparison-container`, `comparison-meta`, `comparison-meta-item`, `comparison-table`, `divergence`, `comparison-photos-grid`, `comparison-photo-column`, `comparison-photo-list`, `comparison-photo-item`, `comparison-photo-img`) matches exactly what `#comparison-modal`'s existing HTML and `window.viewInspectionReport` already use — no typos, no renamed classes.

Manual browser checklist (for the human operator — not wired to any button yet, test from the browser console):
- Open the app, open the browser console, and run `printEventInspectionsReport(roomInspections.filter(i => i.status !== 'Aberto').slice(0, 2), 'Teste')` — confirm the print dialog opens showing 2 vistorias, each on its own page, with checklist and photos, matching what "Ver Relatório" shows for an individual vistoria.
- Close the print dialog (cancel) and confirm the page returns to normal (the report content is hidden again, not left visible on screen).
- Open an individual vistoria's "Ver Relatório" (the existing button) and print it — confirm it still shows only that one vistoria, unaffected by this change.
- Press `Ctrl+P` with neither a report open nor `printEventInspectionsReport` triggered — confirm the normal app page shows in the print preview, not an empty comparison report (this is the pre-existing bug this task also fixes).
- Run `printEventInspectionsReport([], 'Vazio')` — confirm nothing happens (no print dialog, no error in the console).

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat: add multi-inspection photo report, print all of an event's vistorias

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Wire export + master-password-gated deletion into "Encerrar Evento"

**Files:**
- Modify: `index.html:5655-5678` (`finalizeEventBtn`'s click handler — the pending-items block)
- Modify: `index.html:5730-5769` (`function proceedWithFinalization`)
- Modify: `index.html:3124` area (add `syncInspectionRemove`, right after `syncKeyHistoryRemove`)

**Interfaces:**
- Consumes: `downloadInspectionsExcel(eventInspections, eventName)` and `downloadKeyHistoryExcel(eventKeyHistory, eventName)` from Task 1; `printEventInspectionsReport(eventInspections, eventName)` from Task 2; the existing `downloadExcelStyled(data, title)`, `syncLoanRemove(id)` (`index.html:4979`), `syncKeyHistoryRemove(id)` (`index.html:3124`), `saveToLocalStorage()`, `saveRoomsToLocalStorage()`, `syncEventoUpsert(evento)`, `exitEvento()` — all pre-existing, unchanged.
- Produces: `function syncInspectionRemove(id)` — consumed only within this task (the deletion step below).

- [ ] **Step 1: Block finalization entirely when the event has pending items**

Current code (verified at `index.html:5655-5678`):
```javascript
            finalizeEventBtn.addEventListener('click', () => {
                const evento = eventos.find(e => e.id === currentEventoId);
                if (!evento) return;

                const openInspectionsForEvent = roomInspections.filter(i => i.eventoId === currentEventoId && i.status === 'Aberto');
                const activeKeysForEvent = keyLoans.filter(l => l.eventoId === currentEventoId);

                if (openInspectionsForEvent.length > 0 || activeKeysForEvent.length > 0) {
                    const pendingLines = [];
                    if (openInspectionsForEvent.length > 0) {
                        const roomNames = openInspectionsForEvent.map(insp => {
                            const room = predefinedRooms.find(r => r && r.id === insp.salaId);
                            return room ? `${room.name} (${room.code})` : (insp.salaId || 'Sala desconhecida');
                        }).join(', ');
                        pendingLines.push(`• ${openInspectionsForEvent.length} sala(s) com check-in aberto: ${roomNames}`);
                    }
                    if (activeKeysForEvent.length > 0) {
                        pendingLines.push(`• ${activeKeysForEvent.length} chave(s)/controle(s) ainda não devolvidos`);
                    }
                    const proceedAnyway = confirm(
                        `Atenção: este evento ainda tem pendências que não serão fechadas automaticamente:\n\n${pendingLines.join('\n')}\n\nEssas salas/chaves continuarão marcadas como em uso globalmente até serem devolvidas manualmente. Deseja continuar encerrando o evento mesmo assim?`
                    );
                    if (!proceedAnyway) return;
                }
```
Change to (the `alert()` replaces the `confirm()`, and the function always `return`s afterward instead of only when the user declines):
```javascript
            finalizeEventBtn.addEventListener('click', () => {
                const evento = eventos.find(e => e.id === currentEventoId);
                if (!evento) return;

                const openInspectionsForEvent = roomInspections.filter(i => i.eventoId === currentEventoId && i.status === 'Aberto');
                const activeKeysForEvent = keyLoans.filter(l => l.eventoId === currentEventoId);

                if (openInspectionsForEvent.length > 0 || activeKeysForEvent.length > 0) {
                    const pendingLines = [];
                    if (openInspectionsForEvent.length > 0) {
                        const roomNames = openInspectionsForEvent.map(insp => {
                            const room = predefinedRooms.find(r => r && r.id === insp.salaId);
                            return room ? `${room.name} (${room.code})` : (insp.salaId || 'Sala desconhecida');
                        }).join(', ');
                        pendingLines.push(`• ${openInspectionsForEvent.length} sala(s) com check-in aberto: ${roomNames}`);
                    }
                    if (activeKeysForEvent.length > 0) {
                        pendingLines.push(`• ${activeKeysForEvent.length} chave(s)/controle(s) ainda não devolvidos`);
                    }
                    alert(
                        `Não é possível encerrar este evento ainda — existem pendências que precisam ser resolvidas primeiro:\n\n${pendingLines.join('\n')}\n\nDevolva as chaves/controles e faça o check-out das salas listadas, depois tente encerrar novamente.`
                    );
                    return;
                }
```
(Everything below this block — the furniture-loan handling and the call to `proceedWithFinalization` — is unchanged in this step.)

- [ ] **Step 2: Add `syncInspectionRemove`**

Add this right after `syncKeyHistoryRemove`'s closing `}` (currently `index.html:3124-3126`):
```javascript
            function syncKeyHistoryRemove(id) {
                db.ref('keyHistory/' + id).remove().catch(err => console.error("Error removing key history:", err));
            }
            function syncInspectionRemove(id) {
                db.ref('roomInspections/' + id).remove().catch(err => console.error("Error removing inspection:", err));
            }
```

- [ ] **Step 3: Rewrite `proceedWithFinalization` to export, gate on the master password, and delete**

Current code (verified at `index.html:5730-5769`):
```javascript
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
Change to (the furniture-loan-marking block at the top is untouched; everything from the `const eventoIndex = ...` line onward is replaced):
```javascript
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

                // Gather the event's complete data set — includes items returned/closed
                // long before this finalization call, not just the ones just marked above.
                const eventLoans = loans.filter(l => l.eventoId === evento.id);
                const eventInspections = roomInspections.filter(i => i.eventoId === evento.id && i.status !== 'Aberto');
                const eventKeyHistory = keyHistory.filter(k => k.eventoId === evento.id);

                downloadExcelStyled(eventLoans, evento.nome);
                downloadInspectionsExcel(eventInspections, evento.nome);
                downloadKeyHistoryExcel(eventKeyHistory, evento.nome);
                printEventInspectionsReport(eventInspections, evento.nome);

                const pass = prompt('Digite a senha mestre para confirmar a exclusão definitiva dos dados deste evento:');
                if (pass !== 'gl@operacoes') {
                    alert('Senha incorreta! Exclusão cancelada — os dados do evento continuam intactos.');
                    return;
                }

                const eventLoanIds = eventLoans.map(l => l.id);
                const eventInspectionIds = eventInspections.map(i => i.id);
                const eventKeyHistoryIds = eventKeyHistory.map(k => k.id);

                loans = loans.filter(l => !eventLoanIds.includes(l.id));
                roomInspections = roomInspections.filter(i => !eventInspectionIds.includes(i.id));
                keyHistory = keyHistory.filter(k => !eventKeyHistoryIds.includes(k.id));

                saveToLocalStorage();
                saveRoomsToLocalStorage();
                eventLoanIds.forEach(syncLoanRemove);
                eventInspectionIds.forEach(syncInspectionRemove);
                eventKeyHistoryIds.forEach(syncKeyHistoryRemove);

                const eventoIndex = eventos.findIndex(e => e.id === evento.id);
                if (eventoIndex > -1) {
                    eventos[eventoIndex] = { ...eventos[eventoIndex], status: 'encerrado' };
                    localStorage.setItem('arena_eventos', JSON.stringify(eventos));
                    syncEventoUpsert(eventos[eventoIndex]);
                }

                showToast('Evento encerrado! Planilhas baixadas e dados excluídos.', '✅');
                exitEvento();
            }
```
Note `roomInspections`/`keyHistory` are reassigned here with `let`-declared module-level bindings (matching how `loans` is already reassigned a few lines above in the untouched block, and how other finalize/edit flows in this file reassign these same three arrays elsewhere) — do not use `const` for them.

- [ ] **Step 4: Verify**

```bash
grep -n "syncInspectionRemove\|downloadInspectionsExcel(\|downloadKeyHistoryExcel(\|printEventInspectionsReport(\|eventLoanIds\|eventInspectionIds\|eventKeyHistoryIds" index.html
```
Expected: `syncInspectionRemove` appears 2 times (its own definition from Step 2, plus the `.forEach(syncInspectionRemove)` call here); `downloadInspectionsExcel(`, `downloadKeyHistoryExcel(`, and `printEventInspectionsReport(` each appear exactly twice (their Task 1/2 definitions + one call site each, here); `eventLoanIds`/`eventInspectionIds`/`eventKeyHistoryIds` each appear 3 times (declaration, the `.filter(... !ids.includes...)` reassignment, the `.forEach(syncXRemove)` call).

Read back the full `proceedWithFinalization` function and confirm: (a) the export calls (3 Excel downloads + the print report) all happen *before* the password prompt, (b) every line that mutates `loans`/`roomInspections`/`keyHistory` or calls a `syncXRemove` function sits *after* the `if (pass !== 'gl@operacoes') { ...; return; }` guard — a wrong password or a cancelled prompt must leave every array and every Firebase record untouched, (c) the `eventos[eventoIndex].status = 'encerrado'` update and `exitEvento()` call still only happen once, at the very end, unchanged in spirit from before this task. Also re-read `finalizeEventBtn`'s handler in full to confirm Step 1's block-instead-of-confirm change didn't disturb the furniture-loan-handling code below it.

Manual browser checklist (for the human operator):
- Create a test event with a furniture loan, a closed room inspection (with photos), and a returned key loan (with avaria set on at least one). Try "Encerrar Evento" with a check-in still open on another room of the same event — confirm the alert blocks it and nothing downloads.
- Return/close everything, click "Encerrar Evento" again — confirm the furniture-loan confirm still works as before, then 3 `.xls` files download plus the print dialog opens showing the room's vistoria with photos.
- At the password prompt, click Cancel — confirm no toast, no data removed (reopen the same event and confirm the loan/inspection/key history are all still there, the event is still `ativo`).
- Repeat and enter the wrong password — confirm the "Senha incorreta!" alert and, again, that nothing was deleted.
- Repeat and enter `gl@operacoes` — confirm the final toast, that the event now shows as "Encerrado" in the Eventos screen, and that reloading the page shows no loans/inspections/key-history left for that event (while the event itself still appears in the "Encerrados" filter).
- Test an event with only a furniture loan (no vistorias, no keys) — confirm the Vistorias/Chaves `.xls` files and the print dialog still trigger without error (empty datasets), and deletion still completes correctly for the loan.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat: wire event export and password-gated permanent deletion into Encerrar Evento

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
