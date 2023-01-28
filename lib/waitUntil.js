const waitUntil = async function (fn, timeout) {
  const result = await fn();
  if (result) {
    return result;
  }

  const timeoutError = new Error('test timed out');

  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const attempt = async () => {
      if (Date.now() - startTime > timeout) {
        reject(timeoutError);
        return;
      }

      let result;
      try {
        result = await fn();
      } catch (error) {}

      if (!result) {
        setTimeout(attempt);
        return;
      }
      resolve(result);
    };

    attempt();
  });
};

export default waitUntil;
