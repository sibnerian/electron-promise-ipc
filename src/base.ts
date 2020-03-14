import uuid from 'uuid/v4';
import { serializeError } from 'serialize-error';
import { IpcMain, IpcRenderer, WebContents, IpcMessageEvent } from 'electron';
import 'object.entries/auto'; // Shim Object.entries. Required to use serializeError.

/**
 * For backwards compatibility, event is the (optional) LAST argument to a listener function.
 * This leads to the following verbose overload type for a listener function.
 */
export type Listener =
  | { (event?: IpcMessageEvent): void }
  | { (arg1?: unknown, event?: IpcMessageEvent): void }
  | { (arg1?: unknown, arg2?: unknown, event?: IpcMessageEvent): void }
  | { (arg1?: unknown, arg2?: unknown, arg3?: unknown, event?: IpcMessageEvent): void }
  | {
      (
        arg1?: unknown,
        arg2?: unknown,
        arg3?: unknown,
        arg4?: unknown,
        event?: IpcMessageEvent,
      ): void;
    }
  | {
      (
        arg1?: unknown,
        arg2?: unknown,
        arg3?: unknown,
        arg4?: unknown,
        arg5?: unknown,
        event?: IpcMessageEvent,
      ): void;
    };
export type Options = { maxTimeoutMs?: number };
// There's an `any` here it's the only way that the typescript compiler allows you to call listener(...dataArgs, event).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WrappedListener = { (event: IpcMessageEvent, replyChannel: string, ...dataArgs: any[]): void };

export default class PromiseIpcBase {
  private eventEmitter: IpcMain | IpcRenderer;

  private maxTimeoutMs: number;

  private routeListenerMap: Map<string, Listener>;

  private listenerMap: Map<Listener, WrappedListener>;

  constructor(opts: { maxTimeoutMs?: number } | undefined, eventEmitter: IpcMain | IpcRenderer) {
    if (opts && opts.maxTimeoutMs) {
      this.maxTimeoutMs = opts.maxTimeoutMs;
    } // either ipcRenderer or ipcMain

    this.eventEmitter = eventEmitter;
    this.routeListenerMap = new Map();
    this.listenerMap = new Map();
  }

  public send(
    route: string,
    sender: WebContents | IpcRenderer,
    ...dataArgs: unknown[]
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const replyChannel = `${route}#${uuid()}`;
      let timeout: NodeJS.Timeout;
      let didTimeOut = false; // ipcRenderer will send a message back to replyChannel when it finishes calculating

      this.eventEmitter.once(
        replyChannel,
        (event: IpcMessageEvent, status: string, returnData: unknown) => {
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
        },
      );
      sender.send(route, replyChannel, ...dataArgs);
      if (this.maxTimeoutMs) {
        timeout = setTimeout(() => {
          didTimeOut = true;
          reject(new Error(`${route} timed out.`));
        }, this.maxTimeoutMs);
      }
    });
  }

  public on(route: string, listener: Listener): PromiseIpcBase {
    const prevListener = this.routeListenerMap.get(route); // If listener has already been added for this route, don't add it again.
    if (prevListener === listener) {
      return this;
    } // Only one listener may be active for a given route. // If two are active promises it won't work correctly - that's a race condition.
    if (this.routeListenerMap.has(route)) {
      this.off(route, prevListener);
    } // This function _wraps_ the listener argument. We maintain a map of // listener -> wrapped listener in order to implement #off().
    const wrappedListener: WrappedListener = (event, replyChannel, ...dataArgs): void => {
      // Chaining off of Promise.resolve() means that listener can return a promise, or return
      // synchronously -- it can even throw. The end result will still be handled promise-like.
      Promise.resolve()
        .then(() => listener(...dataArgs, event))
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

  public off(route: string, listener?: Listener): void {
    const registeredListener = this.routeListenerMap.get(route);
    if (listener && listener !== registeredListener) {
      return; // trying to remove the wrong listener, so do nothing.
    }
    const wrappedListener = this.listenerMap.get(registeredListener);
    this.eventEmitter.removeListener(route, wrappedListener);
    this.listenerMap.delete(registeredListener);
    this.routeListenerMap.delete(route);
  }

  public removeListener(route: string, listener?: Listener): void {
    this.off(route, listener);
  }
}
