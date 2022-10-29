import AnsiToHTML from 'ansi-to-html';
import debounce from 'debounce';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';

const codeInput = document.querySelector('#codeInput');
const codeOutput = document.querySelector('#codeOutput');

const editor = new EditorView({
  doc: `
const { test, run } = createTestSuite();

test('correct assertions', t => {
  t.equal(1, 1);
  t.notEqual(1, 2);
  t.looseEqual(1, '1');
  t.notLooseEqual(1, '2');
  t.deepEqual({ a: 1 }, { a : 1 });
  t.notDeepEqual({ a: 1 }, { a : 2 });
  t.ok(true);
  t.notOk(false);
});

test('wrong assertions', t => {
  t.equal(1, 2);
  t.notEqual(1, 1);
  t.looseEqual(1, '2');
  t.notLooseEqual(1, '1');
  t.deepEqual({ a: 1 }, { a : 2 });
  t.notDeepEqual({ a: 1 }, { a : 1 });
  t.ok(false);
  t.notOk(true);
});

test('planned async', t => {
  t.plan(1);

  setTimeout(() => {
    t.pass('will not complete test until this is called')
  }, 100)
});

const results = await run();
console.log(results);
`.slice(1),
  extensions: [basicSetup, javascript()],
  parent: codeInput
});

let worker;
async function execute () {
  const code = editor.state.doc.toString();

  const convert = new AnsiToHTML({
    newline: true,
    colors: {
      9: '#be0000',
      10: '#1b951e',
      14: '#0d6978'
    }
  });

  const stringify = what => {
    if (typeof what === 'object') {
      return JSON.stringify(what, null, 2);
    } else {
      return what;
    }
  };

  worker && worker.terminate();
  worker = new Worker('./worker.min.js');
  worker.postMessage(code);

  worker.addEventListener('message', event => {
    if (event.data[0] === 'log') {
      codeOutput.innerHTML = codeOutput.innerHTML +
        convert.toHtml(event.data[1].map(stringify).join(' ') + '\n');
      return;
    }

    if (event.data[0] === 'error') {
      codeOutput.classList.add('error');
      codeOutput.innerHTML = event.data[1];
    }
  });

  codeOutput.innerHTML = '';
  codeOutput.classList.remove('error');
}

execute();

const executeDebounce = debounce(execute, 500);
codeInput.addEventListener('input', executeDebounce);
codeInput.addEventListener('change', executeDebounce);
codeInput.addEventListener('keypress', executeDebounce);
codeInput.addEventListener('keyup', executeDebounce);
codeInput.addEventListener('paste', executeDebounce);
