// Tests the cached-version guard: the app compares its own APP_VERSION with the
// published file and reloads once when the browser is running a stale copy.
//
// Como rodar:
//   npm install jsdom
//   node tests/version-guard.test.js
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

const firebaseStub = {
  initializeApp() {},
  database() {
    const snap = { val: () => null, exists: () => false };
    return { ref() { return { on(e, cb) { cb(snap); }, once() { return Promise.resolve(snap); }, set() { return Promise.resolve(); }, update() { return Promise.resolve(); }, remove() { return Promise.resolve(); } }; } };
  }
};

// served: what the "server" returns for the cache check. null = fetch unavailable.
function boot(served, sessionSeed) {
  const state = { reloads: 0, toasts: [] };
  // jsdom refuses to let location.reload be replaced, but it reports the attempt
  // as a "not implemented: navigation" error — that is our reload signal.
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', err => {
    if (/navigation/i.test(err.message || '')) state.reloads++;
  });
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://localhost/',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.Sentry = { init() {}, captureException() {} };
      window.firebase = firebaseStub;
      window.HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {} });
      window.print = () => {};
      window.alert = () => {};
      if (sessionSeed) {
        try { window.sessionStorage.setItem('arena_app_reloaded', sessionSeed); } catch (e) {}
      }
      if (served === null) {
        delete window.fetch;
      } else {
        window.fetch = () => Promise.resolve({ ok: true, text: () => Promise.resolve(served) });
      }
    }
  });
  return { dom, state };
}

const running = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1];
const tick = (ms = 200) => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log('\nversao rodando: ' + running);
  check('index.html declara uma APP_VERSION', !!running);

  console.log('\n1. Servidor com a MESMA versao — nao recarrega');
  {
    const { dom, state } = boot(html);
    await tick();
    check('nao recarregou', state.reloads === 0, state.reloads);
    check('app iniciou normalmente', typeof dom.window.enterEvento === 'function');
    dom.window.close();
  }

  console.log('\n2. Servidor com versao MAIS NOVA — recarrega uma vez');
  {
    const novo = html.replace(/const APP_VERSION = '[^']+'/, "const APP_VERSION = '9999-99-99-9'");
    const { dom, state } = boot(novo);
    await tick();
    check('recarregou a pagina', state.reloads === 1, state.reloads);
    check('marcou na sessao para nao entrar em loop',
      dom.window.sessionStorage.getItem('arena_app_reloaded') === running,
      dom.window.sessionStorage.getItem('arena_app_reloaded'));
    dom.window.close();
  }

  console.log('\n3. Ja recarregou e o servidor continua velho — avisa, nao entra em loop');
  {
    const novo = html.replace(/const APP_VERSION = '[^']+'/, "const APP_VERSION = '9999-99-99-9'");
    const { dom, state } = boot(novo, running);
    await tick();
    check('nao recarregou de novo', state.reloads === 0, state.reloads);
    const msg = dom.window.document.getElementById('toast-message').textContent;
    check('avisou na tela', /versão mais nova/i.test(msg), msg);
    dom.window.close();
  }

  console.log('\n4. Navegador sem fetch — app inicia igual, sem quebrar');
  {
    const { dom, state } = boot(null);
    await tick();
    check('app iniciou normalmente', typeof dom.window.enterEvento === 'function');
    check('nao recarregou', state.reloads === 0, state.reloads);
    dom.window.close();
  }

  console.log('\n' + (failures === 0 ? 'TODOS OS TESTES PASSARAM' : failures + ' TESTE(S) FALHARAM'));
  process.exit(failures === 0 ? 0 : 1);
})().catch(err => { console.error('ERRO NO TESTE:', err); process.exit(2); });
