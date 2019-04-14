import { ipcRenderer } from 'electron'; // eslint-disable-line
import uuid from 'uuid/v4';
import Promise from 'bluebird';
import serializeError from 'serialize-error';
import Map from 'es6-map';

export class PromiseIpcRenderer {
  constructor(opts) {
    if (opts) {
      this.maxTimeoutMs = opts.maxTimeoutMs;
    }
    this.listenerMap = new Map();
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
            return reject(returnData);
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

  on(route, listener) {
    // If listener has already been added, don't add it again.
    if (this.listenerMap.has(listener)) {
      return this;
    }
    const wrappedListener = (event, replyChannel, ...dataArgs) => {
      // Chaining off of Promise.resolve() means that listener can return a promise, or return
      // synchronously -- it can even throw. The end result will still be handled promise-like.
      Promise.resolve()
        .then(() => listener(...dataArgs))
        .then((results) => {
          ipcRenderer.send(replyChannel, 'success', results);
        })
        .catch((e) => {
          ipcRenderer.send(replyChannel, 'failure', serializeError(e));
        });
    };
    this.listenerMap.set(listener, wrappedListener);
    ipcRenderer.on(route, wrappedListener);
    return this;
  }

  off(route, listener) {
    const wrappedListener = this.listenerMap.get(listener);
    if (wrappedListener) {
      ipcRenderer.removeListener(route, wrappedListener);
      this.listenerMap.delete(listener);
    }
  }
}

export const PromiseIpc = PromiseIpcRenderer;

const mainExport = new PromiseIpcRenderer();
mainExport.PromiseIpc = PromiseIpcRenderer;
mainExport.PromiseIpcRenderer = PromiseIpcRenderer;

export default mainExport;
module.exports = mainExport;
