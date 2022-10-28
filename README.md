# just-tap
A simple tap test runner that can be used in any client/server javascript app.

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

const results = await run();
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

### t.timeout(milliseconds: number) !default: 5000
If you have an async task that is running for longer than the timeout, or you are waiting for planned assertions, then the test will fail.

### Assertions
```javascript
t.equal(1, 1, 'expected "1" to equal "1"');
t.notEqual(1, 2, 'expected "1" to not equal "2"');
t.looseEqual(1, 1, 'expected "1" to loose equal "1"');
t.notLooseEqual(1, '2', 'expected "1" to not loose equal "2"');
t.deepEqual({ a: 1 }, { a: 1 }, 'expected {"a":1} to deep equal {"a":1}');
t.notDeepEqual({ a: 1 }, { a: 2 }, 'expected {"a":1} to not deep equal {"a":2}');
t.ok(true, 'expected "true" to be truthy');
t.notOk(false, 'expected "false" to be falsy');
```

## Advanced Usage
The following options are default, and don't need to be included.

```javascript
const { test, run } = createTestSuite({
  logger: console.log,
  formatInfo: text => `\x1b[96m${text}\x1b[39m\x1b[39m`,
  formatDanger: text => `\x1b[91m${text}\x1b[39m\x1b[39m`,
  formatSuccess: text => `\x1b[92m${text}\x1b[39m\x1b[39m`
});
```

But this means as the tests are run, the results are instantly outputted to the `console.log`. Depending on your use case, you may want to accumulate them instead.

```javascript
const log = [];
const { test, run } = createTestSuite({
  logger: (...args) => log.push(args),
});

const results = await run();
if (!results.success) {
  console.log(log);
}
```

## Why another test runner?
Most test runners do a load of magic and include a lot of features.

They magically/automatically:
- search and include test files
- run the tests
- inject test methods like describe/it
- add a hooks system for managing before/after events
- use cli's to manage the auto inclusion of the test runner
- use event systems for capturing when tests fail

These features can be create a great foundation for writing and running tests, but these features also come with their own burden.

This library aims to provide a bare bones test runner with zero magic.

As such, it can run in a web browser, nodejs, deno or any other javascript interpreter.

It's also pretty fast, small and has zero dependencies;
