import uuid from 'uuid/v4';
import Promise from 'bluebird';
import serializeError from 'serialize-error';
import Map from 'es6-map';
import { ipcMain } from 'electron'; // eslint-disable-line

export default class PromiseIpcBase {
  constructor(opts, eventEmitter) {
    if (opts) {
      this.maxTimeoutMs = opts.maxTimeoutMs;
    }
    // either ipcRenderer or ipcMain
    this.eventEmitter = eventEmitter;
    this.routeListenerMap = new Map();
    this.listenerMap = new Map();
  }

  send(route, sender, ...dataArgs) {
    return new Promise((resolve, reject) => {
      const replyChannel = `${route}#${uuid()}`;
      let timeout;
      let didTimeOut = false;

      // ipcRenderer will send a message back to replyChannel when it finishes calculating
      this.eventEmitter.once(replyChannel, (event, status, returnData) => {
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
      sender.send(route, replyChannel, ...dataArgs);

      if (this.maxTimeoutMs) {
        timeout = setTimeout(() => {
          didTimeOut = true;
          reject(new Error(`${route} timed out.`));
        }, this.maxTimeoutMs);
      }
    });
  }

  on(route, listener) {
    const prevListener = this.routeListenerMap.get(route);
    // If listener has already been added for this route, don't add it again.
    if (prevListener === listener) {
      return this;
    }
    // Only one listener may be active for a given route.
    // If two are active promises it won't work correctly - that's a race condition.
    if (this.routeListenerMap.has(route)) {
      this.off(route, prevListener);
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
    this.routeListenerMap.set(route, listener);
    this.listenerMap.set(listener, wrappedListener);
    this.eventEmitter.on(route, wrappedListener);
    return this;
  }

  off(route, listener) {
    const registeredListener = this.routeListenerMap.get(route);
    if (listener && listener !== registeredListener) {
      return; // trying to remove the wrong listener, so do nothing.
    }
    const wrappedListener = this.listenerMap.get(registeredListener);
    this.eventEmitter.removeListener(route, wrappedListener);
    this.listenerMap.delete(registeredListener);
    this.routeListenerMap.delete(route);
  }

  removeListener(route, listener) {
    this.off(route, listener);
  }
}
