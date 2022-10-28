import AnsiToHTML from 'ansi-to-html';
import debounce from 'debounce';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import realCreateTestSuite from '../';

window.realCreateTestSuite = realCreateTestSuite;
window.AnsiToHTML = AnsiToHTML;

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

const results = await run();
console.log(results);
`.slice(1),
  extensions: [basicSetup, javascript()],
  parent: codeInput
});

async function execute () {
  codeOutput.innerHTML = '';
  codeOutput.classList.remove('error');
  try {
    const code = editor.state.doc.toString();
    await (0, eval)(`
      (async () => {
        const convert = new AnsiToHTML({
          newline: true,
          colors: {
            9: '#be0000',
            10: '#1b951e',
            14: '#0d6978',
          }
        });

        const stringify = what => {
          if (typeof what === 'object') {
            return JSON.stringify(what, null, 2);
          } else {
            return what;
          }
        }
        const console = {
          log: (...args) => {
            codeOutput.innerHTML = codeOutput.innerHTML +
              convert.toHtml(args.map(stringify).join(' ') + '\\n')
          }
        };

        const createTestSuite = (options) => {
          return realCreateTestSuite({
            logger: console.log,
            ...options
          })
        }

        ${code}
      })();
    `);
  } catch (error) {
    codeOutput.classList.add('error');
    codeOutput.innerHTML = error;
  }
}

execute();

const executeDebounce = debounce(execute, 150);
codeInput.addEventListener('input', executeDebounce);
codeInput.addEventListener('change', executeDebounce);
codeInput.addEventListener('keypress', executeDebounce);
codeInput.addEventListener('keyup', executeDebounce);
codeInput.addEventListener('paste', executeDebounce);
