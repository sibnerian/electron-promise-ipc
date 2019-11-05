import { expect } from 'chai';
// we are main process by default
import defaultExport, { MainProcessType } from '../src/index';

const { PromiseIpc, PromiseIpcMain } = defaultExport as MainProcessType;

describe('importing the built module', () => {
  it('exports a PromiseIpcMain function and PromiseIpc as an alias', () => {
    expect(typeof PromiseIpc).to.eql('function');
    expect(typeof PromiseIpcMain).to.eql('function');
    expect(PromiseIpc).to.eql(PromiseIpcMain);
  });

  it('exports an instance of PromiseIpcMain as a default', () => {
    expect(defaultExport instanceof PromiseIpcMain).to.eql(true);
  });
});
