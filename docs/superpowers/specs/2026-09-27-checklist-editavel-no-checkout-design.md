# Checklist editável no check-out

**Data:** 2026-09-27
**Status:** Aprovado pelo usuário

## Problema

Hoje o checklist do check-out é fixo: ele só lista os itens que foram registrados no
check-in. Quando o cliente devolve a sala com mobiliário que não estava lá na entrega
(ele muda o layout, traz móveis próprios, traz itens de outra sala), o operador não tem
como registrar isso no check-out.

O contorno que o operador vinha usando: abrir "Editar Check-in", adicionar o item novo lá,
zerar a quantidade de entrada dele, e só então o item aparecia no check-out. Isso é
retrabalho e adultera o registro da vistoria de entrada.

## Objetivo

Permitir adicionar itens novos (e remover itens adicionados por engano) durante o
check-out, sem tocar no registro do check-in.

## Decisões

| Questão | Decisão |
|---|---|
| Como o item novo aparece no relatório | Qtd Entrada = 0, Integridade Entrada = "—", destacado como divergência. A vistoria fica com status `Divergente`. |
| Item novo entra no catálogo da sala | Não. São itens do cliente daquele evento; o próximo check-in da sala continua com o inventário da Arena. |
| Editar a quantidade de ENTRADA pela tela de check-out | Não. A entrada continua sendo o registro histórico do check-in; para corrigi-la existe o botão "Editar Check-in". |
| Remover item que veio do check-in | Não. Item que não voltou é registrado com quantidade 0 / Ausente — é isso que gera a divergência. Só o item adicionado no próprio check-out tem botão de remover. |

## Comportamento

### Passo 2 do check-out (Checklist de Saída)

- No fim da lista, um campo de texto + botão **+ Adicionar**, igual ao que já existe no
  check-in.
- O item adicionado entra com quantidade 1, estado `Inteiro`, campo de observação e um
  botão **×** para removê-lo.
- No cabeçalho da linha, em vez de "Check-in: N (Estado)", aparece o selo
  **"Novo no check-out"**.
- Nome vazio → toast "Informe o nome do item." e nada é adicionado.

### Relatórios e exportações

Para um item adicionado no check-out:

- Qtd Entrada: `0`
- Integridade Entrada: `—`
- Qtd Saída / Integridade Saída: o que foi registrado
- A linha é destacada como divergência (a regra atual já cobre isso: `checkinQty` 0 ≠
  `checkoutQty`), e a vistoria fica `Divergente`.

Vale para os três lugares que renderizam a integridade de entrada: relatório na tela,
relatório de impressão (PDF do evento) e o Excel de vistorias.

### Edição posterior

Ao reabrir uma vistoria fechada em "Editar Vistoria", o item adicionado no check-out
aparece na lista com seus valores de saída e o selo, e continua removível.

## Modelo de dados

Item do checklist adicionado no check-out:

```js
{
  mobiliarioId: 'co-<timestamp>-<rand>',
  name: '<nome digitado>',
  addedAtCheckout: true,
  expectedQty: null,
  checkinQty: 0,
  checkinState: null,
  checkoutQty: <contado>,
  checkoutState: 'Inteiro' | 'Danificado' | 'Ausente',
  observacoes: '<texto>'
}
```

`roomInventories` (catálogo da sala) não é alterado pelo check-out.

## Mudanças no código (`index.html`)

1. **`buildCheckoutChecklistRowElement(item)` — nova função.** A linha do checklist de
   saída hoje é montada com código duplicado em `openCheckoutModal` (~3792) e em
   `triggerEditInspection` (~4084). Os dois passam a usar a mesma função. Sem isso, o item
   novo apareceria ao abrir o check-out e desapareceria ao editar a vistoria depois.
   A linha guarda em `data-*` o que o submit precisa preservar: `data-mobiliario-id`,
   `data-name`, `data-expected-qty`, `data-checkin-qty`, `data-checkin-state`,
   `data-added-at-checkout`.

2. **Campo de adicionar item** no HTML do passo 2 do `checkout-modal`, espelhando o do
   check-in, com handler que cria a linha via a função acima.

3. **`removeCheckoutChecklistItem(mobiliarioId)`** — remove a linha do DOM (só existe nas
   linhas adicionadas no check-out).

4. **Submit do check-out** (`btnSubmitCheckout`, ~3945): deixa de mapear
   `inspection.checklist` e passa a compilar a lista a partir das linhas presentes no DOM,
   como o check-in já faz (~3599), lendo os valores de entrada dos `data-*`. A detecção de
   divergência continua comparando entrada × saída.

5. **Tolerar `checkinState` nulo** em: relatório na tela (~4321), relatório de impressão
   (~4140) e export Excel (~5901) — imprimir `—` e não quebrar o `<span>` de estado.

## Teste manual (navegador)

1. Check-in de uma sala com 3 itens.
2. Check-out: adicionar "Sofá do cliente" com quantidade 2; conferir o selo e o ×.
3. Confirmar saída → relatório na tela mostra o item com Entrada 0 / "—" e linha de
   divergência; status da vistoria `Divergente`.
4. Exportar Excel de vistorias e o PDF do evento → item presente nos dois.
5. "Editar Vistoria" na sala → item continua listado com os valores de saída.
6. Novo check-in da mesma sala → o item adicionado no check-out **não** aparece.
