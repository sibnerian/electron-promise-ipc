import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import lolex from 'lolex';
import { fail } from 'assert';
import electronIpcMock from 'electron-ipc-mock';
import { IpcMessageEvent, WebContents } from 'electron';
import { MainProcessType } from '../src/index';

const proxyquire: any = require('proxyquire'); // eslint-disable-line

const { ipcRenderer, ipcMain } = electronIpcMock();

chai.use(chaiAsPromised);
const uuid = 'totally_random_uuid';

// Need a 2-layer proxyquire now because of the base class dependencies.
const Base = proxyquire('../src/base', {
  'uuid/v4': () => uuid,
});

const mainProcessDefault: MainProcessType = proxyquire('../src/mainProcess', {
  electron: { ipcMain },
  './base': Base,
});

const { PromiseIpc } = mainProcessDefault;

const generateRoute: { (): string } = (function generateRoute() {
  let i = 1;
  return () => `${i++}`; // eslint-disable-line no-plusplus
})();

describe('mainProcess', () => {
  it('exports a default that’s an instance of PromiseIpc', () => {
    expect(mainProcessDefault).to.be.an.instanceOf(PromiseIpc);
  });

  describe('on', () => {
    let mainProcess: MainProcessType;
    let route: string;

    beforeEach(() => {
      mainProcess = new PromiseIpc();
      route = generateRoute();
    });

    afterEach(() => {
      ipcMain.removeAllListeners();
      ipcRenderer.removeAllListeners();
    });

    it('when listener returns resolved promise, sends success + value to the renderer', (done) => {
      mainProcess.on(route, () => Promise.resolve('foober'));
      ipcRenderer.once('replyChannel', (event: IpcMessageEvent, status: string, result: string) => {
        expect([status, result]).to.eql(['success', 'foober']);
        done();
      });
      ipcRenderer.send(route, 'replyChannel', 'dataArg1');
    });

    it('overrides the previous listener when one is added on the same route', (done) => {
      mainProcess.on(route, () => Promise.resolve('foober'));
      mainProcess.on(route, () => Promise.resolve('goober'));
      ipcRenderer.once('replyChannel', (event: IpcMessageEvent, status: string, result: string) => {
        expect([status, result]).to.eql(['success', 'goober']);
        done();
      });
      ipcRenderer.send(route, 'replyChannel', 'dataArg1');
    });

    it('when listener synchronously returns, sends success + value to the renderer', (done) => {
      mainProcess.on(route, () => 'foober');
      ipcRenderer.once('replyChannel', (event: IpcMessageEvent, status: string, result: string) => {
        expect([status, result]).to.eql(['success', 'foober']);
        done();
      });
      ipcRenderer.send(route, 'replyChannel', 'dataArg1');
    });

    it('when listener returns rejected promise, sends failure + error to the renderer', (done) => {
      mainProcess.on(route, () => Promise.reject(new Error('foober')));
      ipcRenderer.once('replyChannel', (event: IpcMessageEvent, status: string, result: Error) => {
        expect(status).to.eql('failure');
        expect(result.name).to.eql('Error');
        expect(result.message).to.eql('foober');
        done();
      });
      ipcRenderer.send(route, 'replyChannel', 'dataArg1');
    });

    it('lets listener reject with a simple string', (done) => {
      // eslint-disable-next-line prefer-promise-reject-errors
      mainProcess.on(route, () => Promise.reject('goober'));
      ipcRenderer.once('replyChannel', (event: IpcMessageEvent, status: string, result: string) => {
        expect([status, result]).to.eql(['failure', 'goober']);
        done();
      });
      ipcRenderer.send(route, 'replyChannel', 'dataArg1');
    });

    it('lets a listener reject with a function', (done) => {
      // eslint-disable-next-line prefer-promise-reject-errors
      mainProcess.on(route, () => Promise.reject(() => 'yay!'));
      ipcRenderer.once('replyChannel', (event: IpcMessageEvent, status: string, result: string) => {
        expect([status, result]).to.eql(['failure', '[Function: anonymous]']);
        done();
      });
      ipcRenderer.send(route, 'replyChannel', 'dataArg1');
    });

    it('lets a listener reject with a custom error', (done) => {
      mainProcess.on(route, () => {
        const custom: Error & { [key: string]: any } = new Error('message');
        custom.obj = { foo: 'bar' };
        custom.array = ['one', 'two'];
        custom.func = () => 'yay!';
        custom.self = custom;
        return Promise.reject(custom);
      });
      ipcRenderer.once(
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
      ipcRenderer.send(route, 'replyChannel', 'dataArg1');
    });

    it('when listener throws, sends failure + error to the renderer', (done) => {
      mainProcess.on(route, () => {
        throw new Error('oh no');
      });
      ipcRenderer.once('replyChannel', (event: IpcMessageEvent, status: string, result: Error) => {
        expect(status).to.eql('failure');
        expect(result.name).to.eql('Error');
        expect(result.message).to.eql('oh no');
        done();
      });
      ipcRenderer.send(route, 'replyChannel', 'dataArg1');
    });

    it('passes the received data args to the listener', (done) => {
      //  Return all _data_ args, concatenated, but leave off the event arg.
      mainProcess.on(route, (...args) => args.slice(0, -1).join(','));
      ipcRenderer.once('replyChannel', (event: IpcMessageEvent, status: string, result: string) => {
        expect([status, result]).to.eql(['success', 'foo,bar,baz']);
        done();
      });
      ipcRenderer.send(route, 'replyChannel', 'foo', 'bar', 'baz');
    });

    it('passes the event to the listener after data args', (done) => {
      mainProcess.on(route, (foo: string, bar: string, baz: string, event: IpcMessageEvent) => {
        expect([foo, bar, baz]).to.eql(['foo', 'bar', 'baz']);
        expect(event.sender.send).to.be.instanceOf(Function);
        return null;
      });
      ipcRenderer.once('replyChannel', (event: IpcMessageEvent, status: string, result: string) => {
        // If there was an error, then that error will be stored in result.
        done(result);
      });
      ipcRenderer.send(route, 'replyChannel', 'foo', 'bar', 'baz');
    });

    it('lets you add the same listener twice and does not break', (done) => {
      const cb = () => Promise.resolve('foober');
      mainProcess.on(route, cb);
      mainProcess.on(route, cb);
      ipcRenderer.once('replyChannel', (event: IpcMessageEvent, status: string, result: string) => {
        expect([status, result]).to.eql(['success', 'foober']);
        done();
      });
      ipcRenderer.send(route, 'replyChannel', 'dataArg1');
    });
  });

  describe('send', () => {
    let mockWebContents: WebContents;
    const mainProcess = mainProcessDefault;
    before((done) => {
      ipcMain.once('saveMockWebContentsSend', (event: IpcMessageEvent) => {
        mockWebContents = event.sender;
        done();
      });
      ipcRenderer.send('saveMockWebContentsSend');
    });

    it('resolves to sent data on success', () => {
      const replyChannel = `route#${uuid}`;
      ipcRenderer.once('route', (event: IpcMessageEvent) => {
        event.sender.send(replyChannel, 'success', 'result');
      });
      const promise = mainProcess.send('route', mockWebContents, 'dataArg1', 'dataArg2');
      return expect(promise).to.eventually.eql('result');
    });

    it('sends the reply channel any additional arguments', () => {
      const replyChannel = `route#${uuid}`;
      let argumentsAfterEvent: unknown[];
      ipcRenderer.once('route', (event: IpcMessageEvent, ...rest) => {
        argumentsAfterEvent = rest;
        event.sender.send(replyChannel, 'success', 'result');
      });
      const promise = mainProcess.send('route', mockWebContents, 'dataArg1', 'dataArg2');
      return promise.then(() => {
        expect(argumentsAfterEvent).to.eql([replyChannel, 'dataArg1', 'dataArg2']);
      });
    });

    it('rejects with the IPC-passed message on failure', () => {
      const replyChannel = `route#${uuid}`;
      ipcRenderer.once('route', (event) => {
        event.sender.send(replyChannel, 'failure', new Error('an error message'));
      });
      const promise = mainProcess.send('route', mockWebContents, 'dataArg1', 'dataArg2');
      return expect(promise).to.be.rejectedWith(Error, 'an error message');
    });

    it('rejects if the IPC passes an unrecognized lifecycle event', () => {
      const replyChannel = `route#${uuid}`;
      ipcRenderer.once('route', (event: IpcMessageEvent) => {
        event.sender.send(replyChannel, 'unrecognized', 'an error message');
      });
      const promise = mainProcess.send('route', mockWebContents, 'dataArg1', 'dataArg2');
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
        const timeoutMainProcess = new PromiseIpc({ maxTimeoutMs: 5000 });
        const makePromise = () =>
          timeoutMainProcess.send('route', mockWebContents, 'dataArg1', 'dataArg2');

        const p = expect(makePromise()).to.be.rejectedWith(Error, 'route timed out.');
        clock.tick(5001);
        return p;
      });

      it('swallows a subsequent resolve if it timed out', () => {
        const replyChannel = `route#${uuid}`;
        ipcRenderer.once('route', (event) => {
          setTimeout(() => {
            event.sender.send(replyChannel, 'success', 'a message');
          }, 6000);
        });
        const timeoutMainProcess = new PromiseIpc({ maxTimeoutMs: 5000 });
        const makePromise = () =>
          timeoutMainProcess.send('route', mockWebContents, 'dataArg1', 'dataArg2');
        const p = expect(makePromise()).to.be.rejectedWith(Error, 'route timed out.');
        clock.tick(5001);
        clock.tick(1000);
        return p;
      });
    });
  });

  describe('off', () => {
    let mainProcess: MainProcessType;
    let route: string;

    beforeEach(() => {
      mainProcess = new PromiseIpc();
      route = generateRoute();
    });

    afterEach(() => {
      ipcMain.removeAllListeners();
      ipcRenderer.removeAllListeners();
    });

    it('Does not resolve the promise if .off() was called', (done) => {
      const listener = () => Promise.resolve('foober');
      mainProcess.on(route, listener);
      ipcRenderer.once('replyChannel', () => {
        fail('There should be no reply since ".off()" was called.');
      });
      mainProcess.off(route, listener);
      ipcRenderer.send(route, 'replyChannel', 'dataArg1');
      setTimeout(done, 20);
    });

    it('Allows you to call .off() >1 times with no ill effects', (done) => {
      const listener = () => Promise.resolve('foober');
      mainProcess.on(route, listener);
      ipcRenderer.once('replyChannel', () => {
        fail('There should be no reply since ".off()" was called.');
      });
      mainProcess.off(route, listener);
      mainProcess.off(route, listener);
      mainProcess.off(route, listener);
      ipcRenderer.send(route, 'replyChannel', 'dataArg1');
      setTimeout(done, 20);
    });

    it('Is aliased to removeListener', (done) => {
      const listener = () => Promise.resolve('foober');
      mainProcess.on(route, listener);
      ipcRenderer.once('replyChannel', () => {
        fail('There should be no reply since ".off()" was called.');
      });
      mainProcess.removeListener(route, listener);
      ipcRenderer.send(route, 'replyChannel', 'dataArg1');
      setTimeout(done, 20);
    });

    it('Does not remove listener for route if called with a different listener', (done) => {
      const listener = () => Promise.resolve('foober');
      mainProcess.on(route, listener);
      ipcRenderer.once('replyChannel', () => {
        done(); // should succeed
      });
      mainProcess.removeListener(route, () => {});
      ipcRenderer.send(route, 'replyChannel', 'dataArg1');
    });

    it('If called with just route, removes the listener', (done) => {
      const listener = () => Promise.resolve('foober');
      mainProcess.on(route, listener);
      ipcRenderer.once('replyChannel', () => {
        fail('There should be no reply since ".off()" was called.');
      });
      mainProcess.removeListener(route);
      ipcRenderer.send(route, 'replyChannel', 'dataArg1');
      setTimeout(done, 20);
    });
  });
});
