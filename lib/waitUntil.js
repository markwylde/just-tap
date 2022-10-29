const waitUntil = async function (fn, timeout) {
  const result = await fn();
  if (result) {
    return result;
  }

  return new Promise((resolve, reject) => {
    const timeoutTimer = timeout && setTimeout(() => finish(null, true), timeout);
    const retryTimer = setInterval(async () => {
      try {
        const result = await fn();
        if (result) {
          finish(result, false);
        }
      } catch (error) {}
    });

    function finish (result, didTimeOut) {
      clearTimeout(timeoutTimer);
      clearInterval(retryTimer);
      if (didTimeOut) {
        reject(new Error('test timed out'));
      } else {
        resolve(result);
      }
    }
  });
};

export default waitUntil;
