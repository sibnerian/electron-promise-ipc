import proxyquire from 'proxyquire';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

const { ipcRenderer, ipcMain } = require('electron-ipc-mock')();

chai.use(chaiAsPromised);
const expect = chai.expect;
const uuid = 'totally_random_uuid';

const { default: renderer, PromiseIpc } = proxyquire('../renderer', {
  electron: { ipcRenderer },
  'uuid/v4': () => uuid,
});

describe('renderer', () => {
  it('exports a default that’s an instance of PromiseIpc', () => {
    expect(renderer).to.be.an.instanceOf(PromiseIpc);
  });

  describe('send', () => {
    it('resolves to sent data on success', () => {
      const replyChannel = `route#${uuid}`;
      ipcMain.once('route', (event) => {
        event.sender.send(replyChannel, 'success', 'result');
      });
      const promise = renderer.send('route', 'dataArg1', 'dataArg2');
      return expect(promise).to.eventually.eql('result');
    });

    it('sends the reply channel and any additional arguments', () => {
      const replyChannel = `route#${uuid}`;
      let argumentsAfterEvent;
      ipcMain.once('route', (event, ...rest) => {
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
      ipcMain.once('route', (event) => {
        event.sender.send(replyChannel, 'failure', 'an error message');
      });
      const promise = renderer.send('route', 'dataArg1', 'dataArg2');
      return expect(promise).to.be.rejectedWith(Error, 'an error message');
    });
  });
});
