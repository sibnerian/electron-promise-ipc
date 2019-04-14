import { ipcMain } from 'electron';
import PromiseIpcBase from './base';

export class PromiseIpcMain extends PromiseIpcBase {
  constructor(opts) {
    super(opts, ipcMain);
  }

  // Send requires webContents -- see http://electron.atom.io/docs/api/ipc-main/
  send(route, webContents, ...dataArgs) {
    return super.send(route, webContents, ...dataArgs);
  }
}

export const PromiseIpc = PromiseIpcMain;

const mainExport = new PromiseIpcMain();
mainExport.PromiseIpc = PromiseIpcMain;
mainExport.PromiseIpcMain = PromiseIpcMain;

export default mainExport;
module.exports = mainExport;
