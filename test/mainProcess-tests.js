import proxyquire from 'proxyquire';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import Promise from 'bluebird';
import lolex from 'lolex';

const { ipcRenderer, ipcMain } = require('electron-ipc-mock')();

chai.use(chaiAsPromised);
const expect = chai.expect;
const uuid = 'totally_random_uuid';

const { default: mainProcessDefault, PromiseIpc } = proxyquire('../mainProcess', {
  electron: { ipcMain },
  'uuid/v4': () => uuid,
});

const generateRoute = (function generateRoute() {
  let i = 1;
  return () => i++; // eslint-disable-line no-plusplus
}());

describe('mainProcess', () => {
  it('exports a default that’s an instance of PromiseIpc', () => {
    expect(mainProcessDefault).to.be.an.instanceOf(PromiseIpc);
  });

  describe('on', () => {
    let mainProcess;
    let route = generateRoute();

    beforeEach(() => {
      mainProcess = new PromiseIpc();
    });

    afterEach(() => {
      // why not remove all listeners? a bug in the library of course...
      // https://github.com/jsantell/electron-ipc-mock/pull/4
      // ipcMain.removeAllListeners();
      // instead we'll generate new routes for now, until the PR goes through.
      route = generateRoute();
    });

    it('when listener returns resolved promise, sends success + value to the renderer', (done) => {
      mainProcess.on(route, () => Promise.resolve('foober'));
      ipcRenderer.once('replyChannel', (event, status, result) => {
        expect([status, result]).to.eql(['success', 'foober']);
        done();
      });
      ipcRenderer.send(route, 'replyChannel', 'dataArg1');
    });

    it('when listener synchronously returns, sends success + value to the renderer', (done) => {
      mainProcess.on(route, () => 'foober');
      ipcRenderer.once('replyChannel', (event, status, result) => {
        expect([status, result]).to.eql(['success', 'foober']);
        done();
      });
      ipcRenderer.send(route, 'replyChannel', 'dataArg1');
    });

    it('when listener returns rejected promise, sends failure + error to the renderer', (done) => {
      mainProcess.on(route, () => Promise.reject(new Error('foober')));
      ipcRenderer.once('replyChannel', (event, status, result) => {
        expect([status, result]).to.eql(['failure', 'foober']);
        done();
      });
      ipcRenderer.send(route, 'replyChannel', 'dataArg1');
    });

    it('when listener throws, sends failure + error to the renderer', (done) => {
      mainProcess.on(route, () => {
        throw new Error('oh no');
      });
      ipcRenderer.once('replyChannel', (event, status, result) => {
        expect([status, result]).to.eql(['failure', 'oh no']);
        done();
      });
      ipcRenderer.send(route, 'replyChannel', 'dataArg1');
    });

    it('passes the received data args to the listener', (done) => {
      mainProcess.on(route, (...args) => args.join(','));
      ipcRenderer.once('replyChannel', (event, status, result) => {
        expect([status, result]).to.eql(['success', 'foo,bar,baz']);
        done();
      });
      ipcRenderer.send(route, 'replyChannel', 'foo', 'bar', 'baz');
    });
  });

  describe('send', () => {
    let mockWebContents;
    const mainProcess = mainProcessDefault;
    before((done) => {
      ipcMain.once('saveMockWebContentsSend', (event) => {
        mockWebContents = event.sender;
        done();
      });
      ipcRenderer.send('saveMockWebContentsSend');
    });

    it('resolves to sent data on success', () => {
      const replyChannel = `route#${uuid}`;
      ipcRenderer.once('route', (event) => {
        event.sender.send(replyChannel, 'success', 'result');
      });
      const promise = mainProcess.send('route', mockWebContents, 'dataArg1', 'dataArg2');
      return expect(promise).to.eventually.eql('result');
    });

    it('sends the reply channel and any additional arguments', () => {
      const replyChannel = `route#${uuid}`;
      let argumentsAfterEvent;
      ipcRenderer.once('route', (event, ...rest) => {
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
        event.sender.send(replyChannel, 'failure', 'an error message');
      });
      const promise = mainProcess.send('route', mockWebContents, 'dataArg1', 'dataArg2');
      return expect(promise).to.be.rejectedWith(Error, 'an error message');
    });

    it('rejects if the IPC passes an unrecognized lifecycle event', () => {
      const replyChannel = `route#${uuid}`;
      ipcRenderer.once('route', (event) => {
        event.sender.send(replyChannel, 'unrecognized', 'an error message');
      });
      const promise = mainProcess.send('route', mockWebContents, 'dataArg1', 'dataArg2');
      return expect(promise).to.be.rejectedWith(Error, 'Unexpected IPC call status "unrecognized" in route');
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
        const promise = timeoutMainProcess.send('route', mockWebContents, 'dataArg1', 'dataArg2');
        clock.tick(5001);
        return expect(promise).to.be.rejectedWith(Error, 'route timed out.');
      });

      it('swallows a subsequent resolve if it timed out', () => {
        const replyChannel = `route#${uuid}`;
        ipcRenderer.once('route', (event) => {
          setTimeout(() => {
            event.sender.send(replyChannel, 'success', 'a message');
          }, 6000);
        });
        const timeoutMainProcess = new PromiseIpc({ maxTimeoutMs: 5000 });
        const promise = timeoutMainProcess.send('route', mockWebContents, 'dataArg1', 'dataArg2');
        clock.tick(5001);
        clock.tick(1000);
        return expect(promise).to.be.rejectedWith(Error, 'route timed out.');
      });
    });
  });
});
