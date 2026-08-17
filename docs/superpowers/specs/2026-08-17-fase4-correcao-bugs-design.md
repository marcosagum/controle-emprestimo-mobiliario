# Fase 4 — Correção de bugs encontrados em auditoria completa

Projeto: Arena Mobília - Controle de Empréstimos (`index.html`, single-file app, Firebase Realtime Database + localStorage).

Esta é a quarta fase deste ciclo de trabalho, seguindo:
1. Fase 1 (concluída, mesclada em `main`): correção de bugs e UX de chave/controle de ar.
2. Fase 2 (concluída, mesclada em `main`): redesign visual com a paleta do Rio Centro.
3. Fase 3 (concluída, mesclada em `main`): indicador de conexão, compressão de fotos, log de auditoria de empréstimos.
4. **Fase 4 (este documento):** correção de 12 bugs encontrados numa auditoria de código cobrindo todos os fluxos do app (empréstimo de mobiliário, chaves/ar-condicionado, check-in/check-out de salas, exportações, splash screen, bootstrap do Firebase).

## Contexto

Após a Fase 3, o usuário pediu uma análise completa de "todos os caminhos do sistema" em busca de bugs. A auditoria (um passe de code-review focado na Fase 3 + três revisões paralelas cobrindo chaves/ar, vistorias de sala, e exportações/splash/bootstrap, todas com achados verificados manualmente linha a linha antes de reportar) encontrou 12 problemas reais, nenhum hipotético. O usuário optou por corrigir todos.

Um 13º achado do passe inicial ("chaves/ar não têm log de auditoria") foi descartado por não ser bug — é exclusão de escopo explícita da Fase 3 (spec `2026-08-07-fase3-melhorias-gerais-design.md`, seção "Fora de escopo": *"Rastreamento de autoria para vistorias de sala ou chaves/controles de ar (só empréstimo de mobiliário nesta fase)"*).

## Decisões (confirmadas com o usuário)

- Race de check-in simultâneo: bloquear e avisar no submit, revalidando a ocupação da sala, em vez de sobrescrever silenciosamente.
- Card de vistoria arquivado: criar uma seção "Histórico de Vistorias" (em vez de apenas confirmar antes de arquivar) — os dados continuam acessíveis pela UI depois de arquivados.
- Quantidade "Previsto" do checklist: parar de reescrevê-la a cada checkout — ela fica fixa como o padrão real da sala, e divergências continuam aparecendo no relatório comparativo.
- Registros de chave/ar sem `tipo`: usar em todo lugar o mesmo fallback (`hasKey`/`hasAc`) que já funciona corretamente em `editKeyLoan`, e travar os checkboxes de tipo durante edição de um registro existente (em vez de fazer o tipo virar editável).

## Design

### 1. Race de check-in simultâneo (Crítico)

**Local:** `btnSubmitCheckin` handler, branch de nova vistoria (`index.html:2937` em diante, próximo a onde `activeRoomsState` é lido/escrito).

Hoje, a lista de salas disponíveis no dropdown é calculada uma única vez, ao abrir o modal (`index.html:2688-2693`), filtrando `activeRoomsState` pelo snapshot local naquele momento. Se outro dispositivo ocupar a mesma sala enquanto o modal está aberto, o submit atual sobrescreve `activeRoomsState[roomId]` sem checar de novo, órfãozando a vistoria do outro dispositivo (ela continua em `roomInspections`, mas nada mais aponta pra ela).

**Fluxo novo, mirando o mesmo padrão já usado no checkout (`index.html:3125-3129`):** no momento do submit (branch de vistoria nova, não a de edição), antes de criar/atualizar `activeRoomsState`, revalidar:

```js
const alreadyOccupied = activeRoomsState.find(r => r.id === roomId && r.statusSala === 'Em Uso');
if (alreadyOccupied) {
    showToast('Esta sala já foi ocupada por outro dispositivo. Feche este check-in e tente novamente.', '⚠️');
    return;
}
```

Isso vai logo após as validações de campo obrigatório já existentes e antes de `roomInspections.push(newInspection)`, para não gravar a inspeção nem gastar a compressão de foto de graça se o submit vai ser abortado. Como o roomId só é conhecido na hora do clique (não muda depois de aberto o modal, já que trocar a sala reabre o checklist mas não fecha o modal), a checagem cobre exatamente a janela de risco.

### 2. Histórico de Vistorias (Importante)

**Local:** nova seção HTML na aba "Controle de check-in e check-out de salas" (`#panel-inspections`), abaixo do grid de salas ativas; novo botão em cada card ativo trocando "Remover Card da Tela" por uma ação que move a vistoria para o histórico.

Hoje `archiveRoomCard` (`index.html:2670-2676`) só remove a sala de `activeRoomsState` — como toda leitura de `roomInspections` para exibição (relatório comparativo, fotos) passa por um card em `activeRoomsState`, arquivar torna a vistoria inacessível pela UI mesmo que os dados continuem em Firebase/localStorage.

**Novo comportamento:** `archiveRoomCard` continua removendo o card do grid ativo (mesma função, sem mudança), mas a vistoria mais recente daquela sala em `roomInspections` (a que tinha `status !== 'Aberto'`, isto é, uma vistoria já fechada/divergente, nunca uma em aberto — arquivar uma sala com vistoria em aberto continua proibido, ver "Fora de escopo") passa a aparecer numa nova lista, renderizada por uma função `renderInspectionsHistory()`, seguindo visualmente o mesmo padrão de `renderKeysHistory()` (tabela simples: sala, evento, datas de check-in/check-out, status, botão "Ver Relatório"). O botão "Ver Relatório" reabre o mesmo modal de comparação (`comparisonModal`) já usado hoje, passando o `inspectionId`.

A fonte de dados do histórico é `roomInspections` filtrado por `status !== 'Aberto'`, ordenado por `checkoutDataHora` decrescente (mais recente primeiro) — não depende de `activeRoomsState` nem de ter sido "arquivado" explicitamente, então toda vistoria fechada aparece lá automaticamente, arquivada ou não. Isso significa que uma vistoria fechada continua visível tanto no card ativo (se ainda não foi removido da tela) quanto no histórico — duplicação visual aceitável, dado que o histórico é a fonte de verdade permanente e o card ativo é só conveniência de tela.

### 3. Previsto fixo no checklist (Importante)

**Local:** `index.html:3174-3183`, dentro do handler de submit do checkout.

Remove o bloco inteiro que reescreve `roomInventories[room.id]` com o `checkoutQty` observado:

```js
// REMOVER:
if (roomInventories[room.id]) {
    roomInventories[room.id] = roomInventories[room.id].map(item => {
        const checkedOutItem = updatedChecklist.find(ci => ci.mobiliarioId === item.mobiliarioId);
        return {
            ...item,
            expectedQty: checkedOutItem ? checkedOutItem.checkoutQty : item.expectedQty
        };
    });
}
```

Sem chamada a `syncInventoryUpsert` para esse caso (ela deixa de ser necessária aqui — `roomInventories` só muda por edição manual do catálogo, que já não existe nesta versão do app; se não houver nenhum outro call site de `syncInventoryUpsert`, a função pode ficar sem uso, o que é aceitável). O "Previsto" exibido em check-ins futuros (`index.html:2736`, `Previsto: ${item.expectedQty}`) volta a refletir sempre o catálogo original da sala, e divergências entre o previsto e o que realmente saiu continuam sendo sinalizadas pelo `hasDivergencies`/relatório comparativo a cada vistoria, sem "esconder" a perda redefinindo o padrão.

### 4. Fotos limpas ao trocar de sala no check-in (Importante)

**Local:** `checkinRoomSelect.addEventListener('change', ...)`, `index.html:2723-2725`.

```js
checkinRoomSelect.addEventListener('change', (e) => {
    if (checkinPhotosList.length > 0) {
        checkinPhotosList = [];
        checkinPhotosThumbnails.innerHTML = '';
        showToast('Sala alterada — fotos anexadas foram removidas, anexe novamente.', '⚠️');
    }
    updateCheckinChecklist(e.target.value);
});
```

O toast só aparece se havia fotos para limpar (evita ruído em troca de sala sem fotos ainda anexadas).

### 5. Toast de sucesso condicionado no check-in editado (Importante)

**Local:** `index.html:2909-2936`, branch `if (editingInspectionId)` do submit de check-in.

Move `editingInspectionId = null;` e o toast de sucesso para dentro do `if (inspectionIndex > -1)`, e adiciona um `else` espelhando exatamente a mensagem já usada no checkout (`index.html:3134`):

```js
if (editingInspectionId) {
    const inspectionIndex = roomInspections.findIndex(i => i.id === editingInspectionId);
    if (inspectionIndex > -1) {
        // ...corpo existente de atualização do roomInspections[inspectionIndex]...
        inspectionToSync = roomInspections[inspectionIndex];
        editingInspectionId = null;
        showToast('Check-in atualizado com sucesso!', '📝');
    } else {
        editingInspectionId = null;
        showToast('Esta vistoria não existe mais (pode ter sido removida em outro dispositivo).', '⚠️');
        return;
    }
}
```

### 6. Fallback correto para registros de chave/ar sem `tipo` (Importante)

**Local:** todo comparador direto `X.tipo === 'controle-ar'` fora de `editKeyLoan`, especificamente `index.html:3566`, `3586`, `3675-3676`, `3728-3729` (a lista exata será confirmada pelo implementador via grep antes de editar, já que a auditoria pode não ter pego 100% dos call sites).

Adiciona um helper único, próximo a `backfillKeyTipo` (`index.html:4972-4982`):

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

Substitui cada comparador direto por `isAcTipo(record)`. `editKeyLoan` (`index.html:3792-3793`) passa a usar o mesmo helper em vez de repetir a lógica inline, para não ter duas implementações do mesmo fallback divergindo no futuro.

### 7. Travar checkboxes de tipo durante edição (Importante)

**Local:** `editKeyLoan` (`index.html:3754-3821`), próximo de onde `keyLoanRoomSelect.disabled = true` já trava o campo de sala (`index.html:3787`).

```js
keyLoanChkKey.disabled = true;
keyLoanChkAc.disabled = true;
```

E ao fechar o modal / voltar para modo de criação (`btnNewKeyLoan` handler, que já reseta outros campos), reabilitar:

```js
keyLoanChkKey.disabled = false;
keyLoanChkAc.disabled = false;
```

Como os checkboxes ficam desabilitados, `hasKey`/`hasAc` lidos deles no submit (`index.html:3495, 3497`) continuam corretos (valor atual, travado) — nenhuma mudança necessária na lógica de submit além do que a Fase 4 já muda no item 6.

### 8. Validação de quantidade mínima em chave/ar (Menor)

**Local:** `btnSubmitKeyLoan` handler, logo após ler `qtyKey`/`qtyAc` (`index.html:3496, 3498`), espelhando a validação já existente para empréstimo de mobiliário (`index.html:4322-4325`).

```js
if (hasKey && qtyKey < 1) {
    showToast('Quantidade de chaves inválida.', '⚠️');
    return;
}
if (hasAc && qtyAc < 1) {
    showToast('Quantidade de controles inválida.', '⚠️');
    return;
}
```

### 9. Fallback `'-'` em Origem/Destino (Importante)

**Local:** card de histórico (`index.html:4555, 4559`), relatório texto (`index.html:4721-4724`), export Excel (`index.html:4817-4821`).

Cada `${loan.origem}`/`${loan.destino}` interpolado direto vira `${loan.origem || '-'}`/`${loan.destino || '-'}`, igual ao padrão já usado para `evento`/`respArena`/`respCliente` nos mesmos templates.

### 10. `logAuditEntry` não trava a operação se o localStorage estiver cheio (Importante)

**Local:** `logAuditEntry`, `index.html:4153-4166`.

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

`syncAuditLogUpsert` continua rodando mesmo se o `try` falhar — a gravação no Firebase (a fonte de verdade real) não depende do cache local. `deleteLoan`/o branch de edição do `submitBtn`, que chamam `logAuditEntry` antes de mutar `loans`, deixam de correr risco de nunca chegar em `loans.filter`/`saveToLocalStorage`/`syncLoanUpsert` por causa de uma quota estourada nesse ponto.

### 11. Validação de foto obrigatória espera compressão pendente (Importante)

**Local:** os dois listeners de captura de foto (`index.html:2816-2837` e o par simétrico do checkout) e os dois handlers de submit (`btnSubmitCheckin`/`btnSubmitCheckout`, nos checks `checkinPhotosList.length === 0`/`checkoutPhotosList.length === 0`).

Adiciona dois contadores de estado, junto de `checkinPhotosList`/`checkoutPhotosList`:

```js
let checkinPhotosPending = 0;
let checkoutPhotosPending = 0;
```

No listener de captura, incrementa antes de chamar `compressImage` e decrementa em `.then()`/`.catch()` (ambos os ramos, sempre):

```js
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

(Mesmo padrão espelhado para `checkoutCameraInput`/`checkoutPhotosPending`.) Note que este bloco já cobre o item 12 (fallback pra foto original em vez de descartar) na mesma edição, já que ambos tocam exatamente o mesmo `.then()/.catch()`.

No submit, antes do check de `length === 0`:

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

(Mesmo padrão espelhado para o checkout.)

### 12. Foto não decodificável salva sem compressão em vez de descartada (Importante)

Coberto integralmente pelo bloco de código do item 11 acima (o `.catch()` de `compressImage` passa a fazer fallback para `url: base64Data` — a imagem original, sem compressão — em vez de só mostrar um toast de erro e descartar a foto).

## Fora de escopo

- Migração retroativa de registros de chave/ar "genuinely ambiguous" (ambos `hasKey`/`hasAc` verdadeiros, ou nenhum) para um tipo definitivo — continuam caindo no fallback padrão (`chave`) do helper `isAcTipo`, igual ao comportamento silencioso de hoje. Não há UI nova para resolver manualmente esses poucos registros residuais.
- Permitir arquivar uma sala com vistoria **em aberto** (sem checkout feito) — isso já não é permitido hoje (o botão "Remover Card da Tela" só aparece pra vistorias fechadas/divergentes, conforme o card renderizado) e esta fase não muda essa regra.
- Qualquer trava real (lock distribuído) contra a race de check-in do item 1 — a correção é detectar e avisar no submit, não impedir que dois usuários abram o mesmo modal ao mesmo tempo (impossível de garantir sem um mecanismo de lock server-side, fora de escopo para um app sem backend próprio).
- Log de auditoria para chaves/ar-condicionado ou vistorias de sala — segue fora de escopo, como já definido na Fase 3.
- Qualquer redesenho visual do histórico de chaves/vistorias além de replicar o padrão de tabela já existente.

## Testes

Sem suíte automatizada (mesma limitação das fases anteriores). Verificação manual, por item:

1. Abrir o mesmo check-in em duas abas/dispositivos para a mesma sala; salvar em uma, confirmar que a outra recebe o aviso de bloqueio ao tentar salvar.
2. Fechar uma vistoria (checkout completo), clicar em "Remover Card da Tela", confirmar que ela aparece na nova seção de Histórico de Vistorias com acesso ao relatório e fotos.
3. Fazer um checkout com quantidade menor que o previsto (item faltando); abrir um novo check-in na mesma sala depois e confirmar que o "Previsto" continua sendo o valor original do catálogo, não o valor reduzido do checkout anterior.
4. Iniciar um check-in, anexar foto, trocar a sala selecionada, confirmar que as fotos somem e apareça o aviso.
5. Editar um check-in cujo registro foi removido via Firebase console (ou por outro dispositivo) antes de salvar; confirmar que aparece o aviso de "não existe mais" em vez de "sucesso".
6. Criar/editar um registro de chave ou controle sem o campo `tipo` diretamente no Firebase console (simulando dado legado); confirmar que aparece com o tipo certo no mural, no histórico, e ao editar/devolver — inclusive que devolver preserva a quantidade certa.
7. Editar um empréstimo de chave existente; confirmar que os checkboxes "Chave"/"Ar" aparecem desabilitados (visualmente e ao clicar).
8. Tentar registrar um empréstimo de chave/ar com quantidade 0 ou negativa; confirmar que é bloqueado com aviso.
9. Criar um empréstimo de mobiliário sem preencher Origem/Destino diretamente no Firebase console; confirmar que aparece "-" (não "undefined") no card e nas exportações.
10. Em um dispositivo com `localStorage` propositalmente cheio (ou simulando via DevTools), excluir um empréstimo com senha mestre; confirmar que a exclusão ocorre normalmente mesmo que o cache local do log falhe.
11. Em conexão lenta (DevTools throttling), anexar uma foto e tocar em "Confirmar" muito rápido; confirmar que aparece o aviso de "aguarde" em vez de submeter sem a foto.
12. Anexar uma foto em formato não suportado pelo navegador atual (ex: HEIC fora do Safari); confirmar que a foto é salva mesmo assim (sem compressão), com aviso, em vez de descartada.
