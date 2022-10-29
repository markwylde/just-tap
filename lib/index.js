import waitUntil from './waitUntil.js';

const defaultOptions = {
  logger: console.log,
  concurrency: Infinity,
  formatInfo: text => `\x1b[96m${text}\x1b[0m`,
  formatDanger: text => `\x1b[91m${text}\x1b[0m`,
  formatSuccess: text => `\x1b[92m${text}\x1b[0m`
};

const runTest = async (context, test) => {
  const { options, stats } = context;

  let tracking = false;
  let notOkTracker = 0;
  const local = {
    log: [
      options.formatInfo(`# ${test.name}:`)
    ],
    failed: false,
    finished: false,
    planned: null,
    assertions: 0,
    timeout: null,
    notOk: (message) => {
      if (local.finished) {
        throw Object.assign(new Error('assertion was made on a finished test'), { testName: test.name });
      }
      notOkTracker = notOkTracker + 1;
      if (tracking) {
        return;
      }
      local.assertions = local.assertions + 1;
      stats.notOk = stats.notOk + 1;
      local.failed = true;
      local.log.push(`${options.formatDanger('not ok')} ${stats.ok + stats.notOk} - ${message}`);
    },
    ok: (message) => {
      if (local.finished) {
        throw Object.assign(new Error('assertion was made on a finished test'), { testName: test.name });
      }
      if (tracking) {
        return;
      }
      local.assertions = local.assertions + 1;
      stats.ok = stats.ok + 1;
      local.log.push(`${options.formatSuccess('ok')} ${stats.ok + stats.notOk} - ${message}`);
    }
  };

  const logComment = message => {
    local.log.push([
      '    ---', ...message.split('\n')
    ].join('\n    '));
  };

  await test.fn({
    plan: (newPlan) => {
      local.planned = newPlan;
    },
    timeout: (newTimeout) => {
      local.timeout = newTimeout;
    },
    waitFor: (fn, timeout) => {
      if (!timeout) {
        throw new Error('waitFor must be given a timeout');
      }

      const timeoutError = new Error('waitFor exceeded allowed timeout');
      return waitUntil(async () => {
        notOkTracker = 0;
        tracking = true;

        try {
          await fn();
          if (notOkTracker === 0) {
            tracking = false;
            await fn();
            return true;
          }
        } catch (error) {
          return false;
        }
      }, timeout).catch(async () => {
        tracking = false;
        await fn();
        logComment([
          'error: ' + timeoutError.message,
          'stack: |\n' + timeoutError.stack.split('\n').slice(1).join('\n')
        ].join('\n'));
        local.notOk('waitFor exceeded timeout');
      });
    },
    pass: (message) => {
      message = message || 'passed';
      local.ok(message);
    },
    fail: (message) => {
      message = message || 'failed';
      local.notOk(message);
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

  local.finished = true;
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

  const promises = [];
  let running = 0;
  for (const test of tests) {
    running = running + 1;

    promises.push(
      runTest(context, test).then(() => {
        running = running - 1;
      })
    );

    await waitUntil(() => running < options.concurrency);
  }

  await Promise.all(promises);

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
