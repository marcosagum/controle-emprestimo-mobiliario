// Functional test of the editable check-out checklist, driven through the real
// index.html in jsdom with Firebase, Sentry, Image and canvas stubbed out.
//
// Como rodar:
//   npm install jsdom
//   node tests/checkout-checklist.test.js
//
// O stub do Firebase guarda os dados em memória e só notifica os listeners do
// caminho escrito, como o Firebase real faz. Se ele notificar todos os
// listeners a cada escrita, o app recarrega o estado no meio de uma gravação e
// o teste falha por engano.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const APP = path.join(__dirname, '..', 'index.html');

let failures = 0;
function check(label, cond, extra) {
  if (cond) {
    console.log('  OK   ' + label);
  } else {
    failures++;
    console.log('  FAIL ' + label + (extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''));
  }
}

// Firebase drops null values instead of storing them.
function stripNulls(v) {
  if (Array.isArray(v)) return v.map(stripNulls);
  if (v && typeof v === 'object') {
    const out = {};
    Object.keys(v).forEach(k => {
      if (v[k] !== null && v[k] !== undefined) out[k] = stripNulls(v[k]);
    });
    return out;
  }
  return v;
}

const store = {
  loans: {},
  keyLoans: {},
  keyHistory: {},
  auditLog: {},
  eventos: {
    'evt-test': { id: 'evt-test', nome: 'Evento Teste', cliente: 'Cliente X', status: 'ativo', dataCriacao: '2026-09-27T09:00:00.000Z' }
  },
  predefinedRooms: [{ id: 'sala-1', name: 'Camarim 1', code: 'C-1' }],
  roomInventories: {
    'sala-1': [
      { mobiliarioId: 'mob-1', name: 'Cadeira', expectedQty: 4 },
      { mobiliarioId: 'mob-2', name: 'Mesa', expectedQty: 1 }
    ]
  },
  activeRoomsState: {
    'sala-1': { id: 'sala-1', name: 'Camarim 1', code: 'C-1', statusSala: 'Em Uso', currentInspectionId: 'insp-1', eventoId: 'evt-test' }
  },
  roomInspections: {
    'insp-1': {
      id: 'insp-1', salaId: 'sala-1', eventoId: 'evt-test',
      checkinDataHora: '2026-09-27T10:00:00.000Z',
      checkinRespCliente: 'Cliente A', checkinOperador: 'Operador A',
      status: 'Aberto',
      checklist: [
        { mobiliarioId: 'mob-1', name: 'Cadeira', expectedQty: 4, checkinQty: 4, checkinState: 'Inteiro', observacoes: '' },
        { mobiliarioId: 'mob-2', name: 'Mesa', expectedQty: 1, checkinQty: 1, checkinState: 'Inteiro', observacoes: '' }
      ],
      photosCheckin: [{ id: 'p1', url: 'data:image/jpeg;base64,AAA', timestamp: '2026-09-27T10:00:00.000Z' }],
      photosCheckout: []
    }
  }
};

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
    if (process.env.TRACE) {
      let detail = '';
      if (p.indexOf('roomInspections') === 0 && v && v.checklist) detail = ' checklist=' + v.checklist.length + ' status=' + v.status;
      console.log('    [db.set] ' + p + detail);
    }
    if (v === undefined || v === null) delete cur[last];
    else cur[last] = stripNulls(JSON.parse(JSON.stringify(v)));
    // Like real Firebase: only listeners on the written path, an ancestor of it,
    // or a descendant of it are notified.
    listeners.forEach(l => {
      const affected = l.path === p || p.indexOf(l.path + '/') === 0 || l.path.indexOf(p + '/') === 0;
      if (affected) l.cb(snap(getPath(l.path)));
    });
  }
  return {
    initializeApp() {},
    database() {
      return {
        ref(p = '') {
          const target = p;
          return {
            on(evt, cb) {
              if (target === '.info/connected') { cb(snap(true)); return cb; }
              listeners.push({ path: target, cb });
              cb(snap(getPath(target)));
              return cb;
            },
            once() { return Promise.resolve(snap(getPath(target))); },
            set(v) { setPath(target, v); return Promise.resolve(); },
            update(v) { setPath(target, Object.assign({}, getPath(target) || {}, v)); return Promise.resolve(); },
            remove() { setPath(target, undefined); return Promise.resolve(); },
            push(v) {
              const id = 'push-' + Math.random().toString(36).slice(2, 8);
              setPath(target + '/' + id, v);
              return Promise.resolve({ key: id });
            }
          };
        }
      };
    }
  };
}

const html = fs.readFileSync(APP, 'utf8');
const { VirtualConsole } = require('jsdom');
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', err => console.log('  [jsdomError] ' + err.message + '\n' + (err.detail && err.detail.stack || '')));
virtualConsole.on('error', (...args) => console.log('  [page error] ' + args.join(' ')));
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'https://localhost/',
  pretendToBeVisual: true,
  virtualConsole,
  beforeParse(window) {
    window.Sentry = { init() {}, captureException() {}, captureMessage() {} };
    window.firebase = makeFirebase(store);
    window.HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {} });
    window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/jpeg;base64,COMPRESSED';
    class FakeImage {
      set src(v) { this._src = v; setTimeout(() => { if (this.onload) this.onload(); }, 0); }
      get src() { return this._src; }
      get width() { return 800; }
      get height() { return 600; }
    }
    window.Image = FakeImage;
    window.print = () => {};
    window.alert = () => {};
    window.scrollTo = () => {};
  }
});

const { window } = dom;
const doc = window.document;
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));

(async () => {
  await tick(300); // let DOMContentLoaded, seeding and listeners settle

  console.log('\n1. Abrir check-out de uma sala em uso');
  window.enterEvento('evt-test');
  window.openCheckoutModal('sala-1');
  const container = doc.getElementById('checkout-checklist-container');
  check('checklist carregou os 2 itens do check-in', container.querySelectorAll('.checklist-item-row').length === 2,
    container.querySelectorAll('.checklist-item-row').length);
  check('itens do check-in NAO tem botao de remover', container.querySelectorAll('.checklist-item-remove-btn').length === 0);

  console.log('\n2. Adicionar item novo no check-out');
  doc.getElementById('checkout-resp-cliente').value = 'Cliente B';
  doc.getElementById('checkout-operador-arena').value = 'Operador B';
  doc.getElementById('checkout-new-item-name').value = 'Sofá do cliente';
  doc.getElementById('btn-checkout-add-item').click();
  const rows = container.querySelectorAll('.checklist-item-row');
  check('checklist agora tem 3 linhas', rows.length === 3, rows.length);
  const addedRow = container.querySelector('.checklist-item-row[data-added-at-checkout="true"]');
  check('linha nova existe e esta marcada', !!addedRow);
  check('nome da linha nova', addedRow && addedRow.querySelector('.checklist-item-name').textContent === 'Sofá do cliente',
    addedRow && addedRow.querySelector('.checklist-item-name').textContent);
  check('selo "Novo no check-out"', addedRow && /Novo no check-out/.test(addedRow.textContent));
  check('linha nova tem botao de remover', addedRow && !!addedRow.querySelector('.checklist-item-remove-btn'));
  check('campo de nome foi limpo', doc.getElementById('checkout-new-item-name').value === '');

  console.log('\n3. Adicionar item sem nome nao cria linha');
  doc.getElementById('checkout-new-item-name').value = '   ';
  doc.getElementById('btn-checkout-add-item').click();
  check('continua com 3 linhas', container.querySelectorAll('.checklist-item-row').length === 3,
    container.querySelectorAll('.checklist-item-row').length);

  console.log('\n4. Contar 2 unidades do item novo e anexar foto');
  const addedId = addedRow.getAttribute('data-mobiliario-id');
  window.adjustCheckoutQty(addedId, 1);
  check('quantidade do item novo = 2', doc.getElementById('checkout-qty-' + addedId).textContent === '2',
    doc.getElementById('checkout-qty-' + addedId).textContent);

  // Mesa volta danificada, para checar que a divergencia normal continua funcionando
  window.setCheckoutState('mob-2', 'Danificado');

  const fileInput = doc.getElementById('checkout-camera-input');
  const file = new window.File(['dados-da-foto'], 'foto.jpg', { type: 'image/jpeg' });
  Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
  fileInput.dispatchEvent(new window.Event('change'));
  await tick(200);
  check('1 foto de check-out anexada', doc.getElementById('checkout-photos-thumbnails').children.length === 1,
    doc.getElementById('checkout-photos-thumbnails').children.length);

  console.log('\n5. Confirmar saida');
  doc.getElementById('btn-submit-checkout').click();
  await tick(150);

  const saved = store.roomInspections['insp-1'];
  check('vistoria salva no banco', !!saved);
  check('checklist salvo com 3 itens', saved.checklist.length === 3, saved.checklist.length);
  const savedAdded = saved.checklist.find(i => i.addedAtCheckout === true);
  check('item novo persistido com addedAtCheckout', !!savedAdded);
  check('item novo: checkinQty = 0', savedAdded && savedAdded.checkinQty === 0, savedAdded && savedAdded.checkinQty);
  check('item novo: sem checkinState (null apagado pelo Firebase)', savedAdded && savedAdded.checkinState === undefined,
    savedAdded && savedAdded.checkinState);
  check('item novo: checkoutQty = 2', savedAdded && savedAdded.checkoutQty === 2, savedAdded && savedAdded.checkoutQty);
  check('item novo: nome preservado', savedAdded && savedAdded.name === 'Sofá do cliente', savedAdded && savedAdded.name);
  const savedChair = saved.checklist.find(i => i.mobiliarioId === 'mob-1');
  check('item do check-in preservou entrada 4/Inteiro',
    savedChair && savedChair.checkinQty === 4 && savedChair.checkinState === 'Inteiro' && savedChair.checkoutQty === 4,
    savedChair);
  check('status da vistoria = Divergente', saved.status === 'Divergente', saved.status);
  check('sala voltou para Disponivel', store.activeRoomsState['sala-1'].statusSala === 'Disponível',
    store.activeRoomsState['sala-1'].statusSala);
  check('catalogo da sala NAO aprendeu o item novo',
    store.roomInventories['sala-1'].length === 2 && !JSON.stringify(store.roomInventories['sala-1']).includes('Sofá'),
    store.roomInventories['sala-1']);

  console.log('\n6. Relatorio na tela');
  const reportBody = doc.querySelector('#comparison-modal tbody');
  const reportText = reportBody ? reportBody.textContent : '';
  check('relatorio mostra o item novo', /Sofá do cliente/.test(reportText));
  check('relatorio marca "Novo no check-out"', /Novo no check-out/.test(reportText));
  check('relatorio mostra travessao na integridade de entrada', /—/.test(reportText));
  const reportRows = reportBody ? reportBody.querySelectorAll('tr') : [];
  check('relatorio com 3 linhas', reportRows.length === 3, reportRows.length);
  const addedReportRow = Array.from(reportRows).find(tr => /Sofá do cliente/.test(tr.textContent));
  check('linha do item novo destacada como divergencia', addedReportRow && addedReportRow.className.includes('divergence'),
    addedReportRow && addedReportRow.className);

  console.log('\n7. Reabrir vistoria fechada em modo edicao');
  window.prompt = () => 'gl@operacoes';
  container.innerHTML = '<div>marcador-dom-velho</div>'; // garante que o teste veja o DOM reconstruido
  window.triggerEditInspection('sala-1', 'insp-1');
  check('modal de edicao foi realmente reconstruido', !/marcador-dom-velho/.test(container.innerHTML));
  const editRows = container.querySelectorAll('.checklist-item-row');
  check('edicao carregou 3 linhas', editRows.length === 3, editRows.length);
  const editAdded = container.querySelector('.checklist-item-row[data-added-at-checkout="true"]');
  check('item novo continua marcado na edicao', !!editAdded);
  check('item novo mantem quantidade de saida 2',
    editAdded && doc.getElementById('checkout-qty-' + editAdded.getAttribute('data-mobiliario-id')).textContent === '2',
    editAdded && doc.getElementById('checkout-qty-' + editAdded.getAttribute('data-mobiliario-id')).textContent);
  check('item novo continua removivel na edicao', editAdded && !!editAdded.querySelector('.checklist-item-remove-btn'));
  const mesaRow = Array.from(editRows).find(r => r.getAttribute('data-mobiliario-id') === 'mob-2');
  check('Mesa reabre com estado Danificado selecionado',
    mesaRow && mesaRow.querySelector('.checklist-state-btn.selected').getAttribute('data-state') === 'Danificado',
    mesaRow && mesaRow.querySelector('.checklist-state-btn.selected').getAttribute('data-state'));

  console.log('\n8. Remover o item novo na edicao');
  window.removeCheckoutChecklistItem(editAdded.getAttribute('data-mobiliario-id'));
  check('voltou para 2 linhas', container.querySelectorAll('.checklist-item-row').length === 2,
    container.querySelectorAll('.checklist-item-row').length);

  console.log('\n9. Novo check-in da sala nao traz o item do cliente');
  doc.getElementById('btn-new-inspection') && doc.getElementById('btn-new-inspection').click();
  const checkinContainer = doc.getElementById('checkin-checklist-container');
  const checkinText = checkinContainer ? checkinContainer.textContent : '';
  check('checklist de entrada sem o item do cliente', !/Sofá do cliente/.test(checkinText));

  console.log('\n' + (failures === 0 ? 'TODOS OS TESTES PASSARAM' : failures + ' TESTE(S) FALHARAM'));
  process.exit(failures === 0 ? 0 : 1);
})().catch(err => {
  console.error('ERRO NO TESTE:', err);
  process.exit(2);
});

