import { ipcMain, WebContents } from 'electron';
import PromiseIpcBase, { Options } from './base';

export class PromiseIpcMain extends PromiseIpcBase {
  public PromiseIpc?: any;
  public PromiseIpcMain?: any;

  constructor(opts?: Options) {
    super(opts, ipcMain);
  }

  // Send requires webContents -- see http://electron.atom.io/docs/api/ipc-main/
  public send(route: string, webContents: WebContents, ...dataArgs: any): Promise<void> {
    return super.send(route, webContents, ...dataArgs);
  }
}

export const PromiseIpc = PromiseIpcMain;

const mainExport = new PromiseIpcMain({});
mainExport.PromiseIpc = PromiseIpcMain;
mainExport.PromiseIpcMain = PromiseIpcMain;

export default mainExport;
module.exports = mainExport;
