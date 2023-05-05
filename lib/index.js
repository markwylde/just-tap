import deepEqual from 'deep-equal';
import * as Diff from 'diff';
import waitUntil from './waitUntil.js';

const defaultOptions = {
  logger: console.log,
  formatInfo: text => `\x1b[96m${text}\x1b[0m`,
  formatSource: text => `\x1b[90m${text}\x1b[0m`,
  formatDanger: text => `\x1b[91m${text}\x1b[0m`,
  formatSuccess: text => `\x1b[92m${text}\x1b[0m`,
  formatValue: text => JSON.stringify(text),
  formatDiffNormal: text => `\x1b[90m${text}\x1b[0m`,
  formatDiffAdded: text => `\x1b[92m${text}\x1b[0m`,
  formatDiffRemoved: text => `\x1b[91m${text}\x1b[0m`
};

Error.stackTraceLimit = Infinity;
const getStack = (error) => {
  const lines = error.stack.split('\n');
  const line = lines.find(line => line.includes('(eval at '));

  const splitted = line.split('(eval at ');
  const anonymousSplits = line.split('<anonymous>');
  const mixedPosition = anonymousSplits[anonymousSplits.length - 1];
  const [, lineNumber, charNumber] = mixedPosition.slice(0, -1).split(':');
  return `${splitted[0]}(<sandbox>:${lineNumber - 17}:${charNumber})`.trim();
}
function getSourcePath () {
  if (typeof process === 'undefined') {
    const error = new Error('for stack trace');
    const stack = getStack(error);
    return stack;
  }
  const rootSourcePath = `file://${process.cwd()}`;
  try {
    const error = new Error('for stack trace');
    const definePath = error.stack.split('\n').filter(definePath => {
      return !definePath.includes('(node:internal');
    }).slice(-1)[0];
    const sourcePath = definePath.split(' at ')[1].replace(rootSourcePath, '.');
    const getFileFromSourcePath = sourcePath => {
      const [, ...parts] = sourcePath.split(' (');
      return parts.join('').slice(0, -1);
    };
    return sourcePath.includes(' (') ? getFileFromSourcePath(sourcePath) : sourcePath;
  } catch (error) {
    return 'unknown file path';
  }
}

const runTest = async (context, test) => {
  const { options, stats } = context;

  let trackingPaused = false;
  let trackingLog = [];
  const track = (fn) => {
    if (trackingPaused) {
      trackingLog.push(fn);
      return;
    }

    fn();
  };
  const clearTrackingLog = () => {
    trackingLog = [];
  };

  const pauseTracking = (paused) => {
    trackingPaused = paused;
    if (!trackingPaused) {
      trackingLog.forEach(fn => fn());
      clearTrackingLog();
    }
  };
  let notOkTracker = 0;
  const local = {
    logData: [],
    log: line => {
      if (context.concurrency === 1 || context.remaining === 1) {
        local.logFlush();
        options.logger(line);
        return;
      }
      local.logData.push(line);
    },
    logFlush: () => {
      if (local.logData.length > 0) {
        options.logger(local.logData.join('\n'));
        local.logData = [];
      }
    },
    failed: false,
    finished: false,
    planned: null,
    assertions: 0,
    timeout: 1000000000,
    notOk: (message) => {
      if (local.finished) {
        throw Object.assign(new Error('assertion was made on a finished test'), { testName: test.name });
      }
      notOkTracker = notOkTracker + 1;
      track(() => {
        local.assertions = local.assertions + 1;
        stats.notOk = stats.notOk + 1;
        local.failed = true;

        local.log(`${options.formatDanger('not ok')} ${stats.ok + stats.notOk} - ${message}`);
      });
    },
    ok: (message) => {
      if (local.finished) {
        throw Object.assign(new Error('assertion was made on a finished test'), { testName: test.name });
      }
      track(() => {
        local.assertions = local.assertions + 1;
        stats.ok = stats.ok + 1;

        local.log(`${options.formatSuccess('ok')} ${stats.ok + stats.notOk} - ${message}`);
      });
    }
  };

  local.log(options.formatInfo(`# ${test.name}:`));
  local.log(test.sourcePath && options.formatSource('# ' + test.sourcePath));

  const logComment = message => {
    local.log([
      '    ---', ...message.split('\n')
    ].join('\n    '));
  };

  const diffObjects = (a, b) => {
    const diff = Diff.diffJson(a, b);

    let debug = '';
    diff.forEach((part, index, array) => {
      const lines = part.value.split('\n');
      const isLastPart = index === array.length - 1;

      if (part.added) {
        lines.forEach(line => {
          if (line) {
            debug += options.formatDiffAdded('+ ' + line) + '\n';
          }
        });
        return;
      }

      if (part.removed) {
        lines.forEach(line => {
          if (line) {
            debug += options.formatDiffRemoved('- ' + line) + '\n';
          }
        });
        return;
      }

      lines.forEach((line, lineIndex) => {
        if (line) {
          debug += options.formatDiffNormal('  ' + line) + '\n';
        } else if (isLastPart && lineIndex === lines.length - 1) {
          debug += options.formatDiffNormal('}') + '\n';
        }
      });
    });

    return debug;
  };

  const cleanup = await test.fn({
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
        pauseTracking(true);
        try {
          const result = await fn();
          if (notOkTracker > 0) {
            clearTrackingLog();
            return false;
          }
          return result || true;
        } catch (error) {
          clearTrackingLog();
          return false;
        } finally {
          pauseTracking(false);
        }
      }, timeout).catch(async () => {
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
      const ok = a === b;
      const defaultMessage = `expected ${options.formatValue(a, 'equal', ok)} to equal ${options.formatValue(b, 'equal', ok)}`;
      if (ok) {
        local.ok(message || defaultMessage);
      } else {
        local.notOk((message ? message + ' - ' : '') + defaultMessage);
      }
    },
    notEqual: (a, b, message) => {
      const ok = a !== b;
      const defaultMessage = `expected ${options.formatValue(a, 'notEqual', ok)} to not equal ${options.formatValue(b, 'notEqual', ok)}`;
      if (ok) {
        local.ok(message || defaultMessage);
      } else {
        local.notOk((message ? message + ' - ' : '') + defaultMessage);
      }
    },
    looseEqual: (a, b, message) => {
      const ok = a == b;
      const defaultMessage = `expected ${options.formatValue(a, 'looseEqual', ok)} to loose equal ${options.formatValue(b, 'looseEqual', ok)}`;
      if (ok) {
        local.ok(message || defaultMessage);
      } else {
        local.notOk((message ? message + ' - ' : '') + defaultMessage);
      }
    },
    notLooseEqual: (a, b, message) => {
      const ok = a != b;
      const defaultMessage = `expected ${options.formatValue(a, 'notLooseEqual', ok)} to not loose equal ${options.formatValue(b, 'notLooseEqual', ok)}`;
      if (ok) {
        local.ok(message || defaultMessage);
      } else {
        local.notOk((message ? message + ' - ' : '') + defaultMessage);
      }
    },
    deepEqual: (a, b, message) => {
      const ok = deepEqual(a, b, { strict: true });
      const defaultMessage = 'expected objects to deeply equal';
      if (ok) {
        local.ok(message || defaultMessage);
      } else {
        local.notOk((message ? message + ' - ' : '') + defaultMessage);
        logComment(diffObjects(a, b));
      }
    },
    notDeepEqual: (a, b, message) => {
      const ok = !deepEqual(a, b, { strict: true });
      const defaultMessage = 'expected objects not to deeply equal';
      if (ok) {
        local.ok(message || defaultMessage);
      } else {
        local.notOk((message ? message + ' - ' : '') + defaultMessage);
        logComment(diffObjects(a, b));
      }
    },
    ok: (result, message) => {
      const ok = !!result;
      const defaultMessage = `expected ${options.formatValue(result, 'ok', ok)} to be truthy`;
      if (ok) {
        local.ok(message || defaultMessage);
      } else {
        local.notOk((message ? message + ' - ' : '') + defaultMessage);
      }
    },
    notOk: (result, message) => {
      const ok = !result;
      const defaultMessage = `expected ${options.formatValue(result, 'notOk', ok)} to be falsy`;
      if (ok) {
        local.ok(message || defaultMessage);
      } else {
        local.notOk((message ? message + ' - ' : '') + defaultMessage);
      }
    },
    match: (str, regex, message) => {
      const ok = regex.test(str);
      const defaultMessage = `expected ${options.formatValue(str, 'match', ok)} to match ${options.formatValue(regex, 'match', ok)}`;
      if (ok) {
        local.ok(message || defaultMessage);
      } else {
        local.notOk((message ? message + ' - ' : '') + defaultMessage);
      }
    },
    notMatch: (str, regex, message) => {
      const ok = !regex.test(str);
      const defaultMessage = `expected ${options.formatValue(str, 'notMatch', ok)} to not match ${options.formatValue(regex, 'notMatch', ok)}`;
      if (ok) {
        local.ok(message || defaultMessage);
      } else {
        local.notOk((message ? message + ' - ' : '') + defaultMessage);
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
  } finally {
    cleanup instanceof Function && await cleanup();
  }

  if (local.failed) {
    stats.failed = stats.failed + 1;
  } else {
    stats.passed = stats.passed + 1;
  }

  local.finished = true;
  local.logFlush();
};

const run = async (context, { concurrency } = { concurrency: Infinity }) => {
  const options = context.options;
  options.logger('TAP version 14');

  context.concurrency = concurrency;
  context.stats = {
    passed: 0,
    failed: 0,
    ok: 0,
    notOk: 0,
    skipped: context.skipped.length,
    todo: context.todo.length
  };
  context.running = 0;
  context.tests = context.only.length > 0 ? context.only : context.tests;
  context.remaining = context.tests.length;

  const promises = [];
  for (const test of context.tests) {
    context.running = context.running + 1;

    promises.push(
      runTest(context, test).then(() => {
        context.remaining = context.remaining - 1;
        context.running = context.running - 1;
      })
    );

    await waitUntil(() => context.running < concurrency);
  }

  await Promise.all(promises);

  options.logger('');
  options.logger('1..' + (context.stats.ok + context.stats.notOk));
  options.logger('# tests ' + (context.stats.ok + context.stats.notOk));
  options.logger('# pass  ' + (context.stats.ok));
  options.logger('# fail  ' + (context.stats.notOk));
  options.logger('# skip  ' + (context.stats.skipped));
  options.logger('# todo  ' + (context.stats.todo));

  context.stats.success = context.stats.notOk === 0 && context.stats.failed === 0;

  return context.stats;
};

export default function createTestSuite (options = {}) {
  const context = {
    options: {
      ...defaultOptions,
      ...options
    },
    tests: [],
    only: [],
    skipped: [],
    todo: []
  };

  const test = (name, fn) => {
    const sourcePath = getSourcePath();
    context.tests.push({
      name,
      fn,
      sourcePath
    });
  };

  test.skip = (name, fn) => {
    const sourcePath = getSourcePath();
    context.skipped.push({
      name,
      fn,
      sourcePath
    });
  };

  test.todo = (name, fn) => {
    const sourcePath = getSourcePath();
    context.todo.push({
      name,
      fn,
      sourcePath
    });
  };

  test.only = (name, fn) => {
    const sourcePath = getSourcePath();
    context.only.push({
      name,
      fn,
      sourcePath
    });
  };

  return {
    test,
    run: run.bind(null, context),
    context
  };
}
