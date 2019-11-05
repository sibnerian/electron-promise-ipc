import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import lolex from 'lolex';
import { fail } from 'assert';
import electronIpcMock from 'electron-ipc-mock';
import { IpcMessageEvent, WebContents } from 'electron';
import { RendererProcessType } from '../src/index';

const proxyquire: any = require('proxyquire'); // eslint-disable-line

const { ipcRenderer, ipcMain } = electronIpcMock();

chai.use(chaiAsPromised);
const uuid = 'totally_random_uuid';

const generateRoute: { (): string } = (function generateRoute() {
  let i = 1;
  return () => `${i++}`; // eslint-disable-line no-plusplus
})();

// Need a 2-layer proxyquire now because of the base class dependencies.
const Base = proxyquire('../src/base', {
  'uuid/v4': () => uuid,
});

const renderer: RendererProcessType = proxyquire('../src/renderer', {
  electron: { ipcRenderer },
  './base': Base,
});

const { PromiseIpc } = renderer;

describe('renderer', () => {
  it('exports a default that’s an instance of PromiseIpc', () => {
    expect(renderer).to.be.an.instanceOf(PromiseIpc);
  });

  describe('send', () => {
    it('resolves to sent data on success', () => {
      const replyChannel = `route#${uuid}`;
      ipcMain.once('route', (event: IpcMessageEvent) => {
        event.sender.send(replyChannel, 'success', 'result');
      });
      const promise = renderer.send('route', 'dataArg1', 'dataArg2');
      return expect(promise).to.eventually.eql('result');
    });

    it('sends the reply channel and any additional arguments', () => {
      const replyChannel = `route#${uuid}`;
      let argumentsAfterEvent: string[];
      ipcMain.once('route', (event: IpcMessageEvent, ...rest: string[]) => {
        argumentsAfterEvent = rest;
        event.sender.send(replyChannel, 'success', 'result');
      });
      const promise = renderer.send('route', 'dataArg1', 'dataArg2');
      return promise.then(() => {
        expect(argumentsAfterEvent).to.eql([replyChannel, 'dataArg1', 'dataArg2']);
      });
    });

    it('rejects with the IPC-passed message on failure', () => {
      const replyChannel = `route#${uuid}`;
      ipcMain.once('route', (event: IpcMessageEvent) => {
        event.sender.send(replyChannel, 'failure', new Error('an error message'));
      });
      const promise = renderer.send('route', 'dataArg1', 'dataArg2');
      return expect(promise).to.be.rejectedWith(Error, 'an error message');
    });

    it('rejects if the IPC passes an unrecognized lifecycle event', () => {
      const replyChannel = `route#${uuid}`;
      ipcMain.once('route', (event: IpcMessageEvent) => {
        event.sender.send(replyChannel, 'unrecognized', 'an error message');
      });
      const promise = renderer.send('route', 'dataArg1', 'dataArg2');
      return expect(promise).to.be.rejectedWith(
        Error,
        'Unexpected IPC call status "unrecognized" in route',
      );
    });
    describe('timeouts', () => {
      let clock;

      beforeEach(() => {
        clock = lolex.install();
      });

      afterEach(() => {
        clock.uninstall();
      });

      it('fails if it times out', () => {
        const timeoutRenderer = new PromiseIpc({ maxTimeoutMs: 5000 });
        const makePromise = () => timeoutRenderer.send('route', 'dataArg1', 'dataArg2');
        const p = expect(makePromise()).to.be.rejectedWith(Error, 'route timed out.');
        clock.tick(5001);
        return p;
      });

      it('swallows a subsequent resolve if it timed out', () => {
        const replyChannel = `route#${uuid}`;
        ipcMain.once('route', (event: IpcMessageEvent) => {
          setTimeout(() => {
            event.sender.send(replyChannel, 'success', 'a message');
          }, 6000);
        });
        const timeoutRenderer = new PromiseIpc({ maxTimeoutMs: 5000 });
        const makePromise = () => timeoutRenderer.send('route', 'dataArg1', 'dataArg2');
        const p = expect(makePromise()).to.be.rejectedWith(Error, 'route timed out.');
        clock.tick(5001);
        clock.tick(1000);
        return p;
      });
    });
  });

  describe('on', () => {
    let route: string;
    let mockWebContents: WebContents;
    before((done) => {
      ipcMain.once('saveMockWebContentsSend', (event: IpcMessageEvent) => {
        mockWebContents = event.sender;
        done();
      });
      ipcRenderer.send('saveMockWebContentsSend');
    });

    beforeEach(() => {
      route = generateRoute();
    });

    afterEach(() => {
      ipcMain.removeAllListeners();
      ipcRenderer.removeAllListeners();
    });

    it('when listener returns resolved promise, sends success + value to the main process', (done) => {
      renderer.on(route, () => Promise.resolve('foober'));
      ipcMain.once('replyChannel', (event: IpcMessageEvent, status: string, result: string) => {
        expect([status, result]).to.eql(['success', 'foober']);
        done();
      });
      mockWebContents.send(route, 'replyChannel', 'dataArg1');
    });

    it('overrides the previous listener when one is added on the same route', (done) => {
      renderer.on(route, () => Promise.resolve('foober'));
      renderer.on(route, () => Promise.resolve('goober'));
      ipcMain.once('replyChannel', (event: IpcMessageEvent, status: string, result: string) => {
        expect([status, result]).to.eql(['success', 'goober']);
        done();
      });
      mockWebContents.send(route, 'replyChannel', 'dataArg1');
    });

    it('when listener synchronously returns, sends success + value to the main process', (done) => {
      renderer.on(route, () => Promise.resolve('foober'));
      ipcMain.once('replyChannel', (event: IpcMessageEvent, status: string, result: string) => {
        expect([status, result]).to.eql(['success', 'foober']);
        done();
      });
      mockWebContents.send(route, 'replyChannel', 'dataArg1');
    });

    it('when listener returns rejected promise, sends failure + error to the main process', (done) => {
      renderer.on(route, () => Promise.reject(new Error('foober')));
      ipcMain.once('replyChannel', (event: IpcMessageEvent, status: string, result: Error) => {
        expect(status).to.eql('failure');
        expect(result.name).to.eql('Error');
        expect(result.message).to.eql('foober');
        done();
      });
      mockWebContents.send(route, 'replyChannel', 'dataArg1');
    });

    it('lets a listener reject with a simple string', (done) => {
      // eslint-disable-next-line prefer-promise-reject-errors
      renderer.on(route, () => Promise.reject('goober'));
      ipcMain.once('replyChannel', (event: IpcMessageEvent, status: string, result: Error) => {
        expect([status, result]).to.eql(['failure', 'goober']);
        done();
      });
      mockWebContents.send(route, 'replyChannel', 'dataArg1');
    });

    it('lets a listener reject with a function', (done) => {
      // eslint-disable-next-line prefer-promise-reject-errors
      renderer.on(route, () => Promise.reject(() => 'yay!'));
      ipcMain.once('replyChannel', (event: IpcMessageEvent, status: string, result: string) => {
        expect([status, result]).to.eql(['failure', '[Function: anonymous]']);
        done();
      });
      mockWebContents.send(route, 'replyChannel', 'dataArg1');
    });

    it('lets a listener reject with a custom error', (done) => {
      renderer.on(route, () => {
        const custom: Error & { [key: string]: any } = new Error('message');
        custom.obj = { foo: 'bar' };
        custom.array = ['one', 'two'];
        custom.func = () => 'yay!';
        custom.self = custom;
        return Promise.reject(custom);
      });
      ipcMain.once(
        'replyChannel',
        (event: IpcMessageEvent, status: string, result: Error & { [key: string]: any }) => {
          expect(status).to.eql('failure');
          expect(result.message).to.eql('message');
          expect(result.obj).to.eql({ foo: 'bar' });
          expect(result.array).to.eql(['one', 'two']);
          expect(result.func).to.eql(undefined);
          expect(result.self).to.eql('[Circular]');
          done();
        },
      );
      mockWebContents.send(route, 'replyChannel', 'dataArg1');
    });

    it('when listener throws, sends failure + error to the main process', (done) => {
      renderer.on(route, () => {
        throw new Error('oh no');
      });
      ipcMain.once('replyChannel', (event: IpcMessageEvent, status: string, result: Error) => {
        expect(status).to.eql('failure');
        expect(result.name).to.eql('Error');
        expect(result.message).to.eql('oh no');
        done();
      });
      mockWebContents.send(route, 'replyChannel', 'dataArg1');
    });

    it('passes the received data args to the listener', (done) => {
      //  Return all _data_ args, concatenated, but leave off the event arg.
      renderer.on(route, (...args) => args.slice(0, -1).join(','));
      ipcMain.once('replyChannel', (event: IpcMessageEvent, status: string, result: string) => {
        expect([status, result]).to.eql(['success', 'foo,bar,baz']);
        done();
      });
      mockWebContents.send(route, 'replyChannel', 'foo', 'bar', 'baz');
    });

    it('passes the event to the listener after data args', (done) => {
      renderer.on(route, (foo: string, bar: string, baz: string, event: IpcMessageEvent) => {
        expect([foo, bar, baz]).to.eql(['foo', 'bar', 'baz']);
        expect(event.sender.send).to.be.instanceOf(Function);
        return null;
      });
      ipcMain.once('replyChannel', (event: IpcMessageEvent, status: string, result: string) => {
        // If there was an error, then that error will be stored in result.
        done(result);
      });
      mockWebContents.send(route, 'replyChannel', 'foo', 'bar', 'baz');
    });

    it('lets you add the same listener twice and does not break', (done) => {
      const cb = () => Promise.resolve('foober');
      renderer.on(route, cb);
      renderer.on(route, cb);
      ipcMain.once('replyChannel', (event: IpcMessageEvent, status: string, result: string) => {
        expect([status, result]).to.eql(['success', 'foober']);
        done();
      });
      mockWebContents.send(route, 'replyChannel', 'dataArg1');
    });
  });

  describe('off', () => {
    let route: string;
    let mockWebContents: WebContents;
    before((done) => {
      ipcMain.once('saveMockWebContentsSend', (event: IpcMessageEvent) => {
        mockWebContents = event.sender;
        done();
      });
      ipcRenderer.send('saveMockWebContentsSend');
    });

    beforeEach(() => {
      route = generateRoute();
    });

    afterEach(() => {
      ipcMain.removeAllListeners();
      ipcRenderer.removeAllListeners();
    });

    it('Does not resolve the promise if .off() was called', (done) => {
      const listener = () => Promise.resolve('foober');
      renderer.on(route, listener);
      ipcMain.once('replyChannel', () => {
        fail('There should be no reply since ".off()" was called.');
      });
      renderer.off(route, listener);
      mockWebContents.send(route, 'replyChannel', 'dataArg1');
      setTimeout(done, 20);
    });

    it('Allows you to call .off() >1 times with no ill effects', (done) => {
      const listener = () => Promise.resolve('foober');
      renderer.on(route, listener);
      ipcMain.once('replyChannel', () => {
        fail('There should be no reply since ".off()" was called.');
      });
      renderer.off(route, listener);
      renderer.off(route, listener);
      renderer.off(route, listener);
      mockWebContents.send(route, 'replyChannel', 'dataArg1');
      setTimeout(done, 20);
    });

    it('Is aliased to removeListener', (done) => {
      const listener = () => Promise.resolve('foober');
      renderer.on(route, listener);
      ipcMain.once('replyChannel', () => {
        fail('There should be no reply since ".off()" was called.');
      });
      renderer.removeListener(route, listener);
      mockWebContents.send(route, 'replyChannel', 'dataArg1');
      setTimeout(done, 20);
    });

    it('Does not remove listener for route if called with a different listener', (done) => {
      const listener = () => Promise.resolve('foober');
      renderer.on(route, listener);
      ipcMain.once('replyChannel', () => {
        done(); // should succeed
      });
      renderer.removeListener(route, () => {});
      mockWebContents.send(route, 'replyChannel', 'dataArg1');
    });

    it('If called with just route, removes the listener', (done) => {
      const listener = () => Promise.resolve('foober');
      renderer.on(route, listener);
      ipcMain.once('replyChannel', () => {
        fail('There should be no reply since ".off()" was called.');
      });
      renderer.removeListener(route);
      mockWebContents.send(route, 'replyChannel', 'dataArg1');
      setTimeout(done, 20);
    });
  });
});
