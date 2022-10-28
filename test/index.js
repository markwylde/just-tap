import createTestSuite from '../lib/index.js';

const { test, run } = createTestSuite();

test('all assertions', t => {
  t.equal(1, 1);
  t.notEqual(1, 2);
  t.looseEqual(1, '1');
  t.notLooseEqual(1, '2');
  t.deepEqual({ a: 1 }, { a : 1 });
  t.notDeepEqual({ a: 1 }, { a : 2 });
  t.ok(true);
  t.notOk(false);
});

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

const results = await run();
console.log(results);
