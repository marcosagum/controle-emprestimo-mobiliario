# Cartões de sala clicáveis + tingidos por status

Projeto: Arena Mobília - Controle de Empréstimos (`index.html`, single-file app, Firebase Realtime Database + localStorage).

Esta é uma melhoria pontual pedida fora do roadmap original (Fases 1-8, já todas entregues e em produção). Segue o mesmo fluxo de trabalho: brainstorming → spec → plano → implementação.

## Contexto

Na aba "Vistorias de Sala" (`#panel-inspections`), cada sala em uso ou com uma vistoria anterior aparece como um cartão em `renderRoomsGrid()`. Hoje:
- O cartão diferencia sala ocupada de disponível só por uma linha de 1px colorida na borda esquerda (`.room-card.room-occupied`/`.room-available`, `border-left-color`) — pouco perceptível.
- Não existe forma de ver os dados de um check-in (mobiliário, fotos, responsáveis) enquanto a sala ainda está ocupada — o "Relatório Comparativo" (`window.viewInspectionReport`) só é acionado pelo botão "Ver Vistoria Realizada", que só aparece em salas **disponíveis** com uma vistoria anterior fechada.

**Achado importante:** `viewInspectionReport` já lida corretamente com uma vistoria **ainda aberta** (sem check-out) — mostra "Aberto (Pendente Check-out)" no lugar da data de saída, o checklist com o lado de check-out em branco, e as fotos de check-in normalmente. Não é preciso criar nenhum modal novo nem alterar essa função — só passar a chamá-la também a partir de uma sala ocupada.

## Decisões (confirmadas com o usuário)

1. O cartão inteiro (tanto o de sala ocupada quanto o de sala disponível com vistoria anterior) vira clicável — clicar em qualquer um dos dois abre o Relatório Comparativo daquela vistoria (`viewInspectionReport`), mostrando mobiliário, fotos e responsáveis, mesmo antes do check-out acontecer.
2. Os dois estados (ocupada / disponível-com-histórico) são tratados de forma **uniforme** nessa funcionalidade — mesmo comportamento de clique, mesmo tratamento visual — sem tratar a diferença entre eles como algo relevante para o usuário no dia a dia.
3. O botão "Ver Vistoria Realizada" é removido — fica redundante com o clique no cartão.
4. Os cartões ganham um fundo levemente tingido (verde para disponível, vermelho para ocupada, reaproveitando os tokens `--success-glow`/`--primary-glow` já usados nos badges de status) no lugar da borda lateral fina de hoje.

## Design

### Clique no cartão

`renderRoomsGrid()` (`index.html:3121-3219`) já monta o objeto `room` e, dependendo do ramo (`if (!isAvailable && room.currentInspectionId)` vs. `else`), sabe exatamente qual vistoria está associada ao cartão — `inspection.id` (ocupada) ou `lastInspection.id` (disponível com histórico). Uma variável `reportInspectionId` é calculada em cada ramo e usada, depois de montar `card.innerHTML`, para decidir se o cartão recebe o clique:

```javascript
if (reportInspectionId) {
    card.classList.add('room-card-clickable');
    card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        viewInspectionReport(reportInspectionId);
    });
}
```

O `e.target.closest('button')` evita que clicar em "Realizar Check-out", "Editar Check-in", "Editar Vistoria" ou "Remover Card da Tela" também dispare a abertura do relatório — nenhum desses botões precisa de `stopPropagation()` nem de qualquer outra alteração.

Uma sala disponível **sem** nenhuma vistoria anterior (`lastInspection` não encontrado) não recebe `reportInspectionId` — o cartão continua sem clique, exatamente como hoje (não há nada pra mostrar).

### Remoção do botão "Ver Vistoria Realizada"

O bloco `if (lastInspection) { ... }` dentro do ramo `else` de `renderRoomsGrid` (`index.html:3184-3193`) perde o botão "📄 Ver Vistoria Realizada" — o botão "✏️ Editar Vistoria" continua.

### Cartões tingidos por status

Troca, em `.room-card.room-available`/`.room-card.room-occupied` (`index.html:1247-1252`), a propriedade `border-left-color` por `background-color`, usando os tokens já existentes (`--success-glow`/`--primary-glow`, as mesmas cores suaves já usadas nos badges `.room-status-badge.badge-available`/`.badge-occupied`). O `border` de 1px ao redor do cartão continua neutro (`var(--border-color)`), sem cor — só o fundo passa a carregar a cor do status.

### Affordance visual de "isso é clicável"

Nova classe `.room-card-clickable`, aplicada só nos cartões que recebem o listener de clique, reaproveitando o padrão já usado em `.event-card` (a tela de Eventos, que já é clicável hoje): `cursor: pointer` e `:active { transform: scale(0.98); }` para dar feedback tátil ao toque, sem precisar de um estado `:hover` separado (o `.room-card` já herda `transition: var(--transition-smooth)` da regra base).

## Fora de escopo

- Qualquer mudança no conteúdo do próprio Relatório Comparativo (`viewInspectionReport`) — ele já mostra tudo que é preciso, inclusive para vistoria aberta.
- Qualquer mudança no ciclo de vida de status da sala (`statusSala`, quando uma sala vira "Disponível", `archiveRoomCard`) — só a apresentação do cartão muda.
- Mudança de cor nos badges de status (`.room-status-badge`) — continuam iguais, só o fundo do cartão ao redor deles muda.
- Grade de Eventos, mural/histórico de Chaves, ou qualquer outra tela — só os cartões de `renderRoomsGrid` são afetados.

## Testes

Sem suíte automatizada (mesma limitação do resto do projeto). Verificação manual:
- Fazer check-in numa sala e, **antes** de fazer o check-out, clicar no cartão dela na grade — confirmar que abre o Relatório Comparativo mostrando o mobiliário e as fotos do check-in, com "Aberto (Pendente Check-out)" no lugar da data de saída.
- Clicar nos botões "Realizar Check-out" e "Editar Check-in" desse mesmo cartão — confirmar que cada um continua fazendo só o que já fazia, sem abrir o relatório junto.
- Fazer o check-out dessa vistoria e clicar no cartão (agora disponível, mostrando a vistoria anterior) — confirmar que o relatório abre normalmente, agora com os dados de check-out preenchidos.
- Confirmar que o botão "Ver Vistoria Realizada" não aparece mais em nenhum cartão, e que "Editar Vistoria"/"Remover Card da Tela" continuam funcionando.
- Numa sala disponível sem nenhuma vistoria anterior (recém-cadastrada, nunca usada), confirmar que o cartão não reage ao clique (sem cursor de mãozinha, sem abrir nada).
- Comparar visualmente uma sala ocupada e uma disponível na mesma grade — confirmar que o fundo de cada uma tem a cor certa (vermelho claro / verde claro) e que o texto continua legível por cima.
