import chai from 'chai';
// we are main process by default
const defaultExport = require('../build/index');

const expect = chai.expect;
const PromiseIpc = defaultExport.PromiseIpc;
const PromiseIpcMain = defaultExport.PromiseIpcMain;

describe('requiring the built module', () => {
  it('sets PromiseIpcMain function property on the export and PromiseIpc as an alias', () => {
    expect(typeof PromiseIpc).to.eql('function');
    expect(typeof PromiseIpcMain).to.eql('function');
    expect(PromiseIpc).to.eql(PromiseIpcMain);
  });

  it('exports an instance of PromiseIpcMain', () => {
    expect(defaultExport instanceof PromiseIpcMain).to.eql(true);
  });
});
