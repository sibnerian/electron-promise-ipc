import { expect } from 'chai';

const proxyquire = require('proxyquire').noPreserveCache();

const renderer = { renderer: true };
const mainProcess = { mainProcess: true };

describe('index', () => {
  it('imports the renderer promiseIpc in the renderer environment', () => {
    const promiseIpc = proxyquire('../src/index', {
      './renderer': renderer,
      './mainProcess': mainProcess,
      'is-electron-renderer': true,
    });
    expect(promiseIpc).to.eql(renderer);
  });

  it('imports the main process promiseIpc in the mainProcess environment', () => {
    const promiseIpc = proxyquire('../src/index', {
      './renderer': renderer,
      './mainProcess': mainProcess,
      'is-electron-renderer': false,
    });
    expect(promiseIpc).to.eql(mainProcess);
  });
});
