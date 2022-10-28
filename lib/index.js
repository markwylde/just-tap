import waitUntil from './waitUntil.js';

const defaultOptions = {
  logger: console.log,
  formatInfo: text => `\x1b[96m${text}\x1b[39m\x1b[39m`,
  formatDanger: text => `\x1b[91m${text}\x1b[39m\x1b[39m`,
  formatSuccess: text => `\x1b[92m${text}\x1b[39m\x1b[39m`
};

const runTest = async (context, test) => {
  const { options, stats } = context;

  const local = {
    log: [
      options.formatInfo(`# ${test.name}:`)
    ],
    failed: false,
    planned: null,
    assertions: 0,
    timeout: 5000,
    notOk: (message) => {
      local.assertions = local.assertions + 1;
      stats.notOk = stats.notOk + 1;
      local.failed = true;
      local.log.push(`${options.formatDanger('not ok')} ${stats.ok + stats.notOk} - ${message}`);
    },
    ok: (message) => {
      local.assertions = local.assertions + 1;
      stats.ok = stats.ok + 1;
      local.log.push(`${options.formatSuccess('ok')} ${stats.ok + stats.notOk} - ${message}`);
    }
  };

  await test.fn({
    plan: (newPlan) => {
      local.planned = newPlan;
    },
    timeout: (newTimeout) => {
      local.timeout = newTimeout;
    },
    equal: (a, b, message) => {
      message = message || `expected "${a}" to equal "${b}"`;
      if (a === b) {
        local.ok(message);
      } else {
        local.notOk(message);
      }
    },
    notEqual: (a, b, message) => {
      message = message || `expected "${a}" to not equal "${b}"`;
      if (a !== b) {
        local.ok(message);
      } else {
        local.notOk(message);
      }
    },
    looseEqual: (a, b, message) => {
      message = message || `expected "${a}" to loose equal "${b}"`;
      if (a == b) {
        local.ok(message);
      } else {
        local.notOk(message);
      }
    },
    notLooseEqual: (a, b, message) => {
      message = message || `expected "${a}" to not loose equal "${b}"`;
      if (a != b) {
        local.ok(message);
      } else {
        local.notOk(message);
      }
    },
    deepEqual: (a, b, message) => {
      const stringA = JSON.stringify(a);
      const stringB = JSON.stringify(b);
      message = message || `expected ${stringA} to deep equal ${stringB}`;
      if (stringA === stringB) {
        local.ok(message);
      } else {
        local.notOk(message);
      }
    },
    notDeepEqual: (a, b, message) => {
      const stringA = JSON.stringify(a);
      const stringB = JSON.stringify(b);
      message = message || `expected ${stringA} to not deep equal ${stringB}`;
      if (stringA !== stringB) {
        local.ok(message);
      } else {
        local.notOk(message);
      }
    },
    ok: (result, message) => {
      message = message || `expected "${result}" to be truthy`;
      if (result) {
        local.ok(message);
      } else {
        local.notOk(message);
      }
    },
    notOk: (result, message) => {
      message = message || `expected "${result}" to be falsy`;
      if (!result) {
        local.ok(message);
      } else {
        local.notOk(message);
      }
    }
  });

  try {
    local.planned && await waitUntil(() => {
      return local.assertions >= local.planned;
    }, local.timeout);

    if (local.planned && local.assertions !== local.planned) {
      local.notOk(`expected assertions to be as planned (planned="${local.planned}", assertions="${local.assertions}")`);
    }
  } catch (error) {
    local.notOk(`timed out waiting for assertions to be as planned (planned="${local.planned}", assertions="${local.assertions}")`);
  }

  if (local.failed) {
    stats.failed = stats.failed + 1;
  } else {
    stats.passed = stats.passed + 1;
  }

  options.logger(local.log.join('\n'));
};

const run = async (context) => {
  const options = context.options;
  options.logger('TAP version 14');

  context.stats = {
    passed: 0,
    failed: 0,
    ok: 0,
    notOk: 0,
    skipped: context.skipped.length
  };

  const tests = context.only.length > 0 ? context.only : context.tests;

  await Promise.all(
    tests.map(runTest.bind(null, context))
  );

  options.logger('');
  options.logger('1..' + (context.stats.ok + context.stats.notOk));
  options.logger('# tests ' + (context.stats.ok + context.stats.notOk));
  options.logger('# pass  ' + (context.stats.ok));
  options.logger('# fail  ' + (context.stats.notOk));
  options.logger('# skip  ' + (context.stats.skipped));

  context.stats.success = context.stats.notOk === 0 && context.stats.failed === 0;

  return context.stats;
};

export default function createTestSuite (options = {}) {
  options = { ...defaultOptions, ...options };

  const context = {
    options,
    tests: [],
    only: [],
    skipped: []
  };

  const test = (name, fn) => {
    context.tests.push({ name, fn });
  };

  test.skip = (name, fn) => {
    context.skipped.push({ name, fn });
  };

  test.only = (name, fn) => {
    context.only.push({ name, fn });
  };

  return {
    test,
    run: run.bind(null, context)
  };
}
