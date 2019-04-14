import { ipcMain } from 'electron'; // eslint-disable-line
import uuid from 'uuid/v4';
import Promise from 'bluebird';
import serializeError from 'serialize-error';
import Map from 'es6-map';

export class PromiseIpcMain {
  constructor(opts) {
    if (opts) {
      this.maxTimeoutMs = opts.maxTimeoutMs;
    }
    this.listenerMap = new Map();
  }

  // Send requires webContents -- see http://electron.atom.io/docs/api/ipc-main/
  send(route, webContents, ...dataArgs) {
    return new Promise((resolve, reject) => {
      const replyChannel = `${route}#${uuid()}`;
      let timeout;
      let didTimeOut = false;

      // ipcRenderer will send a message back to replyChannel when it finishes calculating
      ipcMain.once(replyChannel, (event, status, returnData) => {
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
      webContents.send(route, replyChannel, ...dataArgs);

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
    // This function _wraps_ the listener argument. We maintain a map of
    // listener -> wrapped listener in order to implement #off().
    const wrappedListener = (event, replyChannel, ...dataArgs) => {
      // Chaining off of Promise.resolve() means that listener can return a promise, or return
      // synchronously -- it can even throw. The end result will still be handled promise-like.
      Promise.resolve()
        .then(() => listener(...dataArgs))
        .then((results) => {
          event.sender.send(replyChannel, 'success', results);
        })
        .catch((e) => {
          event.sender.send(replyChannel, 'failure', serializeError(e));
        });
    };
    this.listenerMap.set(listener, wrappedListener);
    ipcMain.on(route, wrappedListener);
    return this;
  }

  off(route, listener) {
    const wrappedListener = this.listenerMap.get(listener);
    if (wrappedListener) {
      ipcMain.removeListener(route, wrappedListener);
      this.listenerMap.delete(listener);
    }
  }
}

export const PromiseIpc = PromiseIpcMain;

const mainExport = new PromiseIpcMain();
mainExport.PromiseIpc = PromiseIpcMain;
mainExport.PromiseIpcMain = PromiseIpcMain;

export default mainExport;
module.exports = mainExport;
