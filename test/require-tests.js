const { expect } = require('chai'); // eslint-disable-line
// we are main process by default
const defaultExport = require('../build/index'); // eslint-disable-line

const { PromiseIpc, PromiseIpcMain } = defaultExport;

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
