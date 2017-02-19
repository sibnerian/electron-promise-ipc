import { ipcRenderer } from 'electron'; // eslint-disable-line
import uuid from 'uuid/v4';
import Promise from 'bluebird';

export class PromiseIpcRenderer {
  constructor(opts) {
    if (opts) {
      this.maxTimeoutMs = opts.maxTimeoutMs;
    }
  }

  send(route, ...dataArgs) {
    return new Promise((resolve, reject) => {
      const replyChannel = `${route}#${uuid()}`;
      let timeout;
      let didTimeOut = false;

      // ipcMain will send a message back to replyChannel when it finishes calculating
      ipcRenderer.once(replyChannel, (event, status, returnData) => {
        clearTimeout(timeout);
        if (didTimeOut) {
          return null;
        }
        switch (status) {
          case 'success':
            return resolve(returnData);
          case 'failure':
            return reject(new Error(returnData));
          default:
            return reject(new Error(`Unexpected IPC call status "${status}" in ${route}`));
        }
      });
      ipcRenderer.send(route, replyChannel, ...dataArgs);

      if (this.maxTimeoutMs) {
        timeout = setTimeout(() => {
          didTimeOut = true;
          reject(new Error(`${route} timed out.`));
        }, this.maxTimeoutMs);
      }
    });
  }

  // If I ever implement `off`, then this method will actually use `this`.
  // eslint-disable-next-line class-methods-use-this
  on(route, listener) {
    ipcRenderer.on(route, (event, replyChannel, ...dataArgs) => {
      // Chaining off of Promise.resolve() means that listener can return a promise, or return
      // synchronously -- it can even throw. The end result will still be handled promise-like.
      Promise.resolve().then(() => listener(...dataArgs))
        .then((results) => {
          ipcRenderer.send(replyChannel, 'success', results);
        })
        .catch((e) => {
          const message = e && e.message ? e.message : e;
          ipcRenderer.send(replyChannel, 'failure', message);
        });
    });
  }
}

export const PromiseIpc = PromiseIpcRenderer;

export default new PromiseIpcRenderer();
