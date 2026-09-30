# Painel de arquivos do encerramento + trava de versão em cache

**Data:** 2026-09-30
**Status:** Aprovado pelo usuário

## Problema

Dois problemas que se combinaram e quase custaram os dados de dois eventos.

1. **O operador nunca sabe se os arquivos foram salvos.** O encerramento dispara 4
   downloads seguidos e, logo depois, pede a senha que libera a exclusão definitiva. O
   navegador não informa à página se algum download foi salvo (e vários bloqueiam do
   segundo em diante, em silêncio). O operador ficava sem saber se podia continuar.
2. **O navegador serve uma cópia velha do app.** O app é um arquivo estático único; o
   cache do navegador manteve por dias uma versão antiga. Em 30/09 o evento "Hotwheels"
   foi encerrado por essa versão antiga, que não gera relatório nenhum — o evento ficou
   marcado como encerrado sem nenhum arquivo. Diagnóstico confirmado pelos três sinais
   no banco: nenhum registro de auditoria, nenhum dado apagado, mas `status: encerrado`
   (comportamento exclusivo do código antigo).

## Decisões

| Questão | Decisão |
|---|---|
| Forma do aviso | Painel com a lista dos arquivos e botão "Baixar de novo" por arquivo |
| Liberação da exclusão | Só depois de marcar "confirmo que os arquivos estão salvos" |
| Impressão do relatório de fotos | Deixa de abrir sozinha; vira botão no painel |
| Versão em cache | O app confere a versão publicada e se recarrega uma vez |

## Comportamento

### Painel de arquivos (`#closure-files-modal`)

Ao encerrar um evento, os 4 arquivos são gerados e baixados como antes, mas agora sem
toasts empilhados e sem abrir a impressão. Em seguida abre o painel com:

- uma linha por arquivo: rótulo do que é, nome do arquivo e **Baixar de novo**;
- no relatório de fotos, um botão extra **Imprimir / PDF**;
- a nota de onde procurar (pasta de downloads do navegador);
- a caixa "Confirmo que todos os arquivos acima estão salvos", que habilita o botão
  **Continuar para a exclusão**;
- **Cancelar**, que fecha tudo sem apagar nada.

Só ao continuar é que vêm a senha mestre, o nome do autorizador e a exclusão — o fluxo
antigo, agora em `finalizeEventDeletion()`. Se o evento não tiver vistoria fechada, o
painel diz isso e lista os 3 arquivos existentes.

As URLs dos blobs continuam vivas enquanto o painel está aberto; é o que permite baixar
de novo sem refazer o encerramento.

### Trava de versão

`APP_VERSION` é declarado no topo do script. Ao abrir, o app busca o próprio arquivo com
`cache: 'no-store'`, lê o `APP_VERSION` publicado e, se for diferente, recarrega a página
uma vez (marcando `sessionStorage` para não entrar em loop). Se na segunda vez ainda
estiver diferente, mostra um aviso pedindo para fechar e abrir o navegador.

A checagem inteira é opcional por construção: sem `fetch`, ou em qualquer erro, o app
inicia normalmente. **Essa trava nunca pode ser o motivo de o app não abrir** — a
primeira versão dela quebrou a inicialização inteira quando `fetch` não existia, e foi o
teste que pegou.

**Ao publicar qualquer alteração, atualize o `APP_VERSION`** — é ele que dispara a
atualização nos navegadores dos operadores.

## Mudanças no código (`index.html`)

1. `triggerDownload(blob, filename, label)` — centraliza o par blob+âncora e devolve
   `{name, url, label}` para o painel.
2. As 4 funções de exportação passam a devolver esse descritor e a aceitar `silent`
   (sem toast) quando chamadas pelo encerramento.
3. `printEventInspectionsReport` devolve também o HTML do relatório (`printHTML`) e só
   imprime sozinha fora do encerramento; `printReportBody()` foi extraída.
4. `proceedWithFinalization` junta os descritores e chama `showClosureFilesPanel()`;
   tudo o que vinha depois da senha virou `finalizeEventDeletion()`.
5. `APP_VERSION` + checagem de versão logo após a inicialização do Firebase.

## Testes

- `tests/event-closure.test.js` — painel abre, lista os 4 arquivos, botão bloqueado até a
  confirmação, cancelar não apaga nada, senha errada não apaga nada, e o caminho completo
  apaga e audita.
- `tests/version-guard.test.js` — mesma versão não recarrega; versão nova recarrega uma
  vez; segunda divergência avisa em vez de entrar em loop; sem `fetch` o app inicia igual.
