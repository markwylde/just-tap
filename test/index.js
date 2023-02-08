import createTestSuite from '../lib/index.js';

const { test, run } = createTestSuite();

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('correct assertions', t => {
  t.equal(1, 1);
  t.notEqual(1, 2);
  t.looseEqual(1, '1');
  t.notLooseEqual(1, '2');
  t.deepEqual({ a: 1 }, { a: 1 });
  t.notDeepEqual({ a: 1 }, { a: 2 });
  t.ok(true);
  t.notOk(false);
  t.pass();
});

test('wrong assertions', t => {
  t.equal(1, 2);
  t.notEqual(1, 1);
  t.looseEqual(1, '2');
  t.notLooseEqual(1, '1');
  t.deepEqual({ a: 1 }, { a: 2 });
  t.notDeepEqual({ a: 1 }, { a: 1 });
  t.ok(false);
  t.notOk(true);
  t.fail();
});

test('custom message', t => {
  t.equal(1, 1, 'custom message');
  t.notEqual(1, 2, 'custom message');
  t.looseEqual(1, '1', 'custom message');
  t.notLooseEqual(1, '2', 'custom message');
  t.deepEqual({ a: 1 }, { a: 1 }, 'custom message');
  t.notDeepEqual({ a: 1 }, { a: 2 }, 'custom message');
  t.ok(true, 'custom message');
  t.notOk(false, 'custom message');
  t.pass('custom message');
});


test('wrong assertions with custom message', t => {
  t.equal(1, 2, 'custom message');
  t.notEqual(1, 1, 'custom message');
  t.looseEqual(1, '2', 'custom message');
  t.notLooseEqual(1, '1', 'custom message');
  t.deepEqual({ a: 1 }, { a: 2 }, 'custom message');
  t.notDeepEqual({ a: 1 }, { a: 1 }, 'custom message');
  t.ok(false, 'custom message');
  t.notOk(true, 'custom message');
  t.fail('custom message');
});

test('waitFor', async t => {
  t.plan(1);
  let a = 0;

  setTimeout(() => { a = 1; }, 200);

  await t.waitFor(() => {
    t.equal(a, 1);
  }, 500);
});

test('waitFor times out', async t => {
  t.plan(1);
  const a = 0;

  await t.waitFor(() => {
    t.equal(a, 1);
  }, 500);
});

test('async waitFor', async t => {
  t.plan(1);
  let counter = 0;
  await t.waitFor(async () => {
    counter = counter + 1;
    t.equal(counter, 5);
    await sleep(50);
  }, 500);
});

test.todo('waitFor - only outputs last error');

test.skip('waitFor - only outputs last error', () => {});

test('with delay', async t => {
  t.plan(1);

  await new Promise(resolve => setTimeout(resolve, 1));

  t.ok(true);
});

test('throws', async t => {
  t.plan(1);

  try {
    throw new Error('oh no');
  } catch (error) {
    t.equal(error.message, 'oh no');
  }
});

for (let i = 0; i < 5; i++) {
  test('for concurrency ' + i, async t => {
    t.plan(1);
    await new Promise(resolve => setTimeout(resolve, 500));
    t.ok(true);
  });
}

const results = await run({ concurrency: 5 });
console.log(results);

if (JSON.stringify(results) !== JSON.stringify(
  {
    passed: 11,
    failed: 3,
    ok: 27,
    notOk: 19,
    skipped: 1,
    todo: 1,
    success: false
  }
)) {
  throw new Error('Test results were not as expected');
}
