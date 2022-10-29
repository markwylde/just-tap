import realCreateTestSuite from '../';

self.realCreateTestSuite = realCreateTestSuite;

self.addEventListener('error', error => {
  self.postMessage(['error', error.message]);
});

self.addEventListener('message', async event => {
  try {
    const pre = `
      const realConsole = self.console;
      const console = {
        log: (...args) => {
          realConsole.log(...args);
          self.postMessage(['log', args]);
        }
      };
      
      const createTestSuite = (options) => {
        return realCreateTestSuite({
          logger: console.log,
          ...options
        })
      }
    `;

    await (0, eval)(`
      (async () => {
        ${pre + event.data}
      })();
    `);
    self.postMessage(['finish']);
  } catch (error) {
    self.postMessage(['error', error.message]);
  }
});
