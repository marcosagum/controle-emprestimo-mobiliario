// Functional test of "Encerrar Evento": what the closure actually produces
// (3 spreadsheets + the photo report) and that nothing is deleted before the
// master password and the authorizer's name are given.
//
// Como rodar:
//   npm install jsdom
//   node tests/event-closure.test.js
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const APP = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(APP, 'utf8');

let failures = 0;
function check(label, cond, extra) {
  if (cond) console.log('  OK   ' + label);
  else { failures++; console.log('  FAIL ' + label + (extra !== undefined ? ' -> ' + JSON.stringify(extra) : '')); }
}

function stripNulls(v) {
  if (Array.isArray(v)) return v.map(stripNulls);
  if (v && typeof v === 'object') {
    const out = {};
    Object.keys(v).forEach(k => { if (v[k] !== null && v[k] !== undefined) out[k] = stripNulls(v[k]); });
    return out;
  }
  return v;
}

function seedStore() {
  const photo = (id) => ({ id: id, url: 'data:image/jpeg;base64,FOTO' + id, timestamp: '2026-09-28T14:00:00.000Z' });
  return {
    eventos: { 'evt-test': { id: 'evt-test', nome: 'Evento Teste', cliente: 'Cliente X', status: 'ativo' } },
    predefinedRooms: [
      { id: 'sala-1', name: 'Camarim 01', code: 'C-01' },
      { id: 'sala-2', name: 'Sala de Produção T-52', code: 'T-52' }
    ],
    roomInventories: { 'sala-1': [{ mobiliarioId: 'mob-1', name: 'Cadeira', expectedQty: 4 }] },
    activeRoomsState: {},
    keyLoans: {},           // nenhuma chave pendente -> encerramento liberado
    keyHistory: {
      'kh-1': { id: 'kh-1', eventoId: 'evt-test', tipo: 'chave', salaId: 'sala-1', quantidade: 1,
                respCliente: 'Cliente A', operadorArena: 'Op A', dataHora: '2026-09-28T10:00:00.000Z',
                dataDevolucao: '2026-09-28T18:00:00.000Z', avaria: true, avariaDescricao: 'Chave entortada' }
    },
    loans: {
      'loan-1': { id: 'loan-1', eventoId: 'evt-test', item: 'Mesa', quantidade: 2, origem: 'Depósito',
                  destino: 'Camarim 01', respArena: 'Op A', respCliente: 'Cliente A',
                  dataHora: '2026-09-28T10:00:00.000Z', devolvido: false }
    },
    auditLog: {},
    roomInspections: {
      'insp-1': {
        id: 'insp-1', salaId: 'sala-1', eventoId: 'evt-test', status: 'Fechado',
        checkinDataHora: '2026-09-28T09:00:00.000Z', checkoutDataHora: '2026-09-28T20:00:00.000Z',
        checkinRespCliente: 'Cliente A', checkinOperador: 'Op A',
        checkoutRespCliente: 'Cliente A', checkoutOperador: 'Op B',
        checklist: [{ mobiliarioId: 'mob-1', name: 'Cadeira', expectedQty: 4, checkinQty: 4, checkinState: 'Inteiro', checkoutQty: 4, checkoutState: 'Inteiro', observacoes: '' }],
        photosCheckin: [photo('a')], photosCheckout: [photo('b')]
      },
      'insp-2': {
        id: 'insp-2', salaId: 'sala-2', eventoId: 'evt-test', status: 'Divergente',
        checkinDataHora: '2026-09-28T09:30:00.000Z', checkoutDataHora: '2026-09-28T20:30:00.000Z',
        checkinRespCliente: 'Cliente A', checkinOperador: 'Op A',
        checkoutRespCliente: 'Cliente A', checkoutOperador: 'Op B',
        checklist: [
          { mobiliarioId: 'mob-9', name: 'Mesa branca grande', checkinQty: 2, checkinState: 'Inteiro', checkoutQty: 1, checkoutState: 'Danificado', observacoes: 'Tampo riscado' },
          // item adicionado durante o check-out (Firebase apaga o checkinState null)
          { mobiliarioId: 'co-123', name: 'Sofá do cliente', addedAtCheckout: true, checkinQty: 0, checkoutQty: 2, checkoutState: 'Inteiro', observacoes: '' }
        ],
        photosCheckin: [photo('c')], photosCheckout: [photo('d')]
      }
    }
  };
}

function makeFirebase(store) {
  const listeners = [];
  const snap = (val) => ({ val: () => val, exists: () => val !== null && val !== undefined });
  function getPath(p) {
    if (!p) return store;
    let cur = store;
    for (const part of p.split('/').filter(Boolean)) {
      if (cur === null || typeof cur !== 'object') return null;
      cur = cur[part];
      if (cur === undefined) return null;
    }
    return cur === undefined ? null : cur;
  }
  function setPath(p, v) {
    const parts = p.split('/').filter(Boolean);
    let cur = store;
    for (let i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] === null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    const last = parts[parts.length - 1];
    if (v === undefined || v === null) delete cur[last];
    else cur[last] = stripNulls(JSON.parse(JSON.stringify(v)));
    listeners.forEach(l => {
      if (l.path === p || p.indexOf(l.path + '/') === 0 || l.path.indexOf(p + '/') === 0) l.cb(snap(getPath(l.path)));
    });
  }
  return {
    initializeApp() {},
    database() {
      return {
        ref(p = '') {
          return {
            on(evt, cb) {
              if (p === '.info/connected') { cb(snap(true)); return cb; }
              listeners.push({ path: p, cb });
              cb(snap(getPath(p)));
              return cb;
            },
            once() { return Promise.resolve(snap(getPath(p))); },
            set(v) { setPath(p, v); return Promise.resolve(); },
            update(v) { setPath(p, Object.assign({}, getPath(p) || {}, v)); return Promise.resolve(); },
            remove() { setPath(p, undefined); return Promise.resolve(); },
            push(v) { const id = 'p-' + Math.random().toString(36).slice(2, 8); setPath(p + '/' + id, v); return Promise.resolve({ key: id }); }
          };
        }
      };
    }
  };
}

// Boots the app with its own in-memory database and captures every download.
function boot(promptAnswers) {
  const store = seedStore();
  const downloads = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', () => {}); // blob: navigation from link.click() is expected
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://localhost/',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.Sentry = { init() {}, captureException() {} };
      window.firebase = makeFirebase(store);
      window.HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {} });
      window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/jpeg;base64,COMPRESSED';
      window.print = () => {};
      window.alert = (msg) => { alerts.push(msg); };
      window.confirm = () => true;
      let i = 0;
      window.prompt = () => promptAnswers[i++];
      window.document.execCommand = () => true;
      const blobs = new Map();
      window.URL.createObjectURL = (blob) => {
        const url = 'blob:fake/' + blobs.size;
        blobs.set(url, blob);
        return url;
      };
      window.URL.revokeObjectURL = () => {};
      const realClick = window.HTMLAnchorElement.prototype.click;
      window.HTMLAnchorElement.prototype.click = function () {
        if (this.href && this.href.indexOf('blob:') === 0) {
          downloads.push({ name: this.getAttribute('download'), blob: blobs.get(this.href) });
          return; // não navega
        }
        return realClick.call(this);
      };
    }
  });
  const alerts = [];
  dom.window.__alerts = alerts;
  return { dom, store, downloads, alerts };
}

const tick = (ms = 300) => new Promise(r => setTimeout(r, ms));

(async () => {
  // ---------------------------------------------------------------- caso 1
  console.log('\nCASO 1 — painel de arquivos, cancelar no painel nao apaga nada');
  {
    const { dom, store, downloads } = boot([]);
    const doc = dom.window.document;
    await tick();
    dom.window.enterEvento('evt-test');
    doc.getElementById('btn-finalize-event').click();
    await tick();

    check('gerou 4 arquivos', downloads.length === 4, downloads.map(d => d.name));
    const panel = doc.getElementById('closure-files-modal');
    check('painel de arquivos abriu', panel.classList.contains('show'));
    const rows = doc.querySelectorAll('#closure-files-list .closure-file-row');
    check('painel lista os 4 arquivos', rows.length === 4, rows.length);
    check('cada arquivo tem link para baixar de novo',
      doc.querySelectorAll('#closure-files-list a[download]').length === 4);
    check('relatorio de fotos tem botao de imprimir',
      Array.from(doc.querySelectorAll('#closure-files-list button')).some(b => /Imprimir/.test(b.textContent)));
    check('painel mostra o nome de cada arquivo',
      Array.from(rows).every(r => /\.(xls|html)$/.test(r.querySelector('.closure-file-name').textContent.trim())));
    check('continuar comeca bloqueado', doc.getElementById('btn-closure-continue').disabled === true);

    doc.getElementById('closure-files-confirm').checked = true;
    doc.getElementById('closure-files-confirm').dispatchEvent(new dom.window.Event('change'));
    check('marcar a confirmacao libera o continuar', doc.getElementById('btn-closure-continue').disabled === false);

    doc.getElementById('btn-closure-cancel').click();
    await tick(50);
    check('painel fechou ao cancelar', !panel.classList.contains('show'));
    check('nenhuma vistoria apagada', Object.keys(store.roomInspections).length === 2,
      Object.keys(store.roomInspections));
    check('historico de chaves intacto', Object.keys(store.keyHistory).length === 1);
    check('evento continua ativo', store.eventos['evt-test'].status === 'ativo', store.eventos['evt-test'].status);
    dom.window.close();
  }

  // ---------------------------------------------------------------- caso 1b
  console.log('\nCASO 1b — senha errada depois do painel: nada e apagado');
  {
    const { dom, store } = boot(['senha-errada']);
    const doc = dom.window.document;
    await tick();
    dom.window.enterEvento('evt-test');
    doc.getElementById('btn-finalize-event').click();
    await tick();
    doc.getElementById('closure-files-confirm').checked = true;
    doc.getElementById('closure-files-confirm').dispatchEvent(new dom.window.Event('change'));
    doc.getElementById('btn-closure-continue').click();
    await tick(50);

    check('nenhuma vistoria apagada', Object.keys(store.roomInspections).length === 2,
      Object.keys(store.roomInspections));
    check('evento continua ativo', store.eventos['evt-test'].status === 'ativo', store.eventos['evt-test'].status);
    dom.window.close();
  }

  // ---------------------------------------------------------------- caso 2
  console.log('\nCASO 2 — encerramento completo com senha e autorizador');
  const { dom, store, downloads } = boot(['gl@operacoes', 'Marcos Agum']);
  const doc2 = dom.window.document;
  await tick();
  dom.window.enterEvento('evt-test');
  doc2.getElementById('btn-finalize-event').click();
  await tick();

  check('nada apagado enquanto o painel esta aberto', Object.keys(store.roomInspections).length === 2,
    Object.keys(store.roomInspections));
  doc2.getElementById('closure-files-confirm').checked = true;
  doc2.getElementById('closure-files-confirm').dispatchEvent(new dom.window.Event('change'));
  doc2.getElementById('btn-closure-continue').click();
  await tick();

  const names = downloads.map(d => d.name);
  console.log('    arquivos: ' + names.join(', '));
  check('4 arquivos gerados', downloads.length === 4, names);
  check('planilha de emprestimos', names.some(n => /emprestimo|mobiliario|arena/i.test(n)), names);
  check('planilha de vistorias', names.some(n => /vistoria/i.test(n)), names);
  check('planilha de chaves', names.some(n => /chave/i.test(n)), names);
  check('relatorio de fotos (.html)', names.some(n => /\.html$/i.test(n)), names);

  const texts = {};
  for (const d of downloads) texts[d.name] = await d.blob.text();

  const reportName = names.find(n => /\.html$/i.test(n));
  const report = texts[reportName] || '';
  check('relatorio traz as 2 salas', /Camarim 01/.test(report) && /T-52/.test(report));
  check('relatorio traz as fotos de check-in e check-out',
    (report.match(/data:image\/jpeg;base64,FOTO/g) || []).length === 4,
    (report.match(/data:image\/jpeg;base64,FOTO/g) || []).length);
  check('relatorio traz o item adicionado no check-out', /Sofá do cliente/.test(report));
  check('relatorio marca "Novo no check-out"', /Novo no check-out/.test(report));
  check('relatorio nao imprime "null" na integridade de entrada', !/>null</.test(report));
  check('relatorio traz a observacao do item divergente', /Tampo riscado/.test(report));

  const inspXls = texts[names.find(n => /vistoria/i.test(n))] || '';
  check('planilha de vistorias traz o item novo marcado', /Sofá do cliente \(novo no check-out\)/.test(inspXls));
  check('planilha de vistorias traz a sala e o responsavel', /Camarim 01/.test(inspXls) && /Op B/.test(inspXls));
  const keyXls = texts[names.find(n => /chave/i.test(n))] || '';
  check('planilha de chaves traz a avaria', /Chave entortada/.test(keyXls));

  check('vistorias do evento apagadas do banco', Object.keys(store.roomInspections).length === 0,
    Object.keys(store.roomInspections));
  check('historico de chaves do evento apagado', Object.keys(store.keyHistory).length === 0,
    Object.keys(store.keyHistory));
  check('emprestimos do evento apagados', Object.keys(store.loans).length === 0, Object.keys(store.loans));
  check('evento marcado como encerrado', store.eventos['evt-test'].status === 'encerrado',
    store.eventos['evt-test'].status);
  const audit = Object.values(store.auditLog)[0];
  check('registro de auditoria gravado', !!audit && audit.entityType === 'evento', audit);
  check('auditoria guarda quem autorizou', audit && audit.authorizedBy === 'Marcos Agum', audit && audit.authorizedBy);
  check('auditoria lista as vistorias apagadas', audit && audit.snapshot.inspectionIds.length === 2,
    audit && audit.snapshot.inspectionIds);

  console.log('\n' + (failures === 0 ? 'TODOS OS TESTES PASSARAM' : failures + ' TESTE(S) FALHARAM'));
  process.exit(failures === 0 ? 0 : 1);
})().catch(err => { console.error('ERRO NO TESTE:', err); process.exit(2); });
