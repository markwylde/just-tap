# just-tap
A simple [tap](https://testanything.org) test runner that can be used in any client/server javascript app.

> **Archived**
>
> I'm archiving the project as it's now basically built into nodejs, and on npmjs too.
> 
> The only difference is it doesn't have plan.
> 
> If you want plan, look at my [assert-plan](https://github.com/markwylde/assert-plan) project.

## Installation
```
npm install --save-dev just-tap
```

## Usage
```javascript
import createTestSuite from 'just-tap';

const { test, run } = createTestSuite();

test('calculate 1 + 1 correctly', t => {
  t.plan(1);

  t.equal(1 + 1, 2);
});

test('calculate 1 + 1 wrong', t => {
  t.plan(1);

  t.equal(1 + 1, 3);
});

// How many tests will run at the same time?
// By default, all run at once.
const results = await run({ concurrency: Infinity });
// results === {
//   passed: 1, failed: 1, ok: 1, notOk: 1, skipped: 0, success: false
// }
```

### Console output
```
TAP version 14
# calculate 1 + 1 correctly:
ok 1 - expected "2" to equal "2"
# calculate 1 + 1 wrong:
not ok 2 - expected "2" to equal "3"

1..2
# tests 2
# pass  1
# fail  1
# skip  0
```

## API
The following options exist on the `t` object:

### t.plan(assertions: number) !optional
If provided, will wait until the specified number of assertions have been made before resolving the test.

It will also fail the test if too many assertions are made.

### t.timeout(milliseconds: number) !default: none
If you have an async task that is running for longer than the timeout, or you are waiting for planned assertions, then the test will fail.

### t.waitFor(fn: function, timeout: number)
A promise based function that will continuously try and execute the first argument until:
- no `notOk`'s are raised
- it does not throw

All assertions are discarded until the final pass.

### Cleanup
You can run a cleanup function when all `planned` tests have finished.

```javascript
test('cleanup', async t => {
  t.plan(1);

  const server = http.createServer((request, response) => {
    response.end('ok');
  }).listen(8080);

  fetch('http://localhost:8080')
    .then(response => response.text())
    .then(text => {
      t.equal(text, 'ok');
    });

  return () => {
    server.close();
  };
});
```

### Assertions
```javascript
t.pass('passed');
t.fail('failed');
t.equal(1, 1, 'expected "1" to equal "1"');
t.notEqual(1, 2, 'expected "1" to not equal "2"');
t.looseEqual(1, '1', 'expected "1" to loose equal "1"');
t.notLooseEqual(1, '2', 'expected "1" to not loose equal "2"');
t.deepEqual({ a: 1 }, { a: 1 }, 'expected {"a":1} to deep equal {"a":1}');
t.notDeepEqual({ a: 1 }, { a: 2 }, 'expected {"a":1} to not deep equal {"a":2}');
t.ok(true, 'expected "true" to be truthy');
t.notOk(false, 'expected "false" to be falsy');
t.match('hello world', /world/, 'string should match regex');
t.notMatch('hello world', /unicorn/, 'string should not match regex');
t.throws(() => { throw new Error('wopps') }, { message: 'woops' }, 'should throw error');
t.notThrows(() => 'test', 'should not throw error');
```

## Advanced Usage
The following options are default, and don't need to be included.

```javascript
const { test, run } = createTestSuite({
  // What function is used for streaming logs
  // By default logs are streamed to console.log
  logger: console.log,

  // This adds a small amount of color
  // You can override these `text => text`
  formatInfo: text => `\x1b[96m${text}\x1b[0m`,
  formatSource: text => `\x1b[90m${text}\x1b[0m`,
  formatDanger: text => `\x1b[91m${text}\x1b[0m`,
  formatSuccess: text => `\x1b[92m${text}\x1b[0m`,
  formatValue: (text, command, isOk) => JSON.stringify(text),
  formatDiffNormal: text => `\x1b[90m${text}\x1b[0m`,
  formatDiffAdded: text => `\x1b[92m${text}\x1b[0m`,
  formatDiffRemoved: text => `\x1b[91m${text}\x1b[0m`
});
```

But this means as the tests are run, the results are instantly outputted to the `console.log`. Depending on your use case, you may want to accumulate them instead.

```javascript
const log = [];
const { test, run } = createTestSuite({
  logger: (...args) => log.push(args),
});

// default concurrency is Infinity, meaning
// all tests will run at the same time
const results = await run({ concurrency: 1 });
if (!results.success) {
  console.log(log);
}
```

## Why another test runner?
Most test runners include a lot of features and do a lot of magic.

They automatically (magically?):
- search and include test files
- run the tests for you
- inject test methods like `describe`/`it`
- add a hooks system for managing `before`/`after` events
- use cli's to manage the auto inclusion of the test runner
- use event systems for capturing when tests fail/succeed/finish

These features can create a great foundation for writing and running tests, but they also come with their own management and overhead.

This library aims to provide a bare bones test runner with zero magic.

As such, it can run in a web browser, nodejs, deno or any other javascript interpreter.

It's also pretty fast, small and has zero dependencies;
