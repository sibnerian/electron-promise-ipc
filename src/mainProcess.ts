import { ipcMain, WebContents } from 'electron';
import PromiseIpcBase, { Options } from './base';

export class PromiseIpcMain extends PromiseIpcBase {
  constructor(opts?: Options) {
    super(opts, ipcMain);
  }

  // Send requires webContents -- see http://electron.atom.io/docs/api/ipc-main/
  public send(route: string, webContents: WebContents, ...dataArgs: unknown[]): Promise<unknown> {
    return super.send(route, webContents, ...dataArgs);
  }
}

export type MainProcessType = PromiseIpcMain & {
  PromiseIpc?: typeof PromiseIpcMain;
  PromiseIpcMain?: typeof PromiseIpcMain;
};

export const PromiseIpc = PromiseIpcMain;

const mainExport: MainProcessType = new PromiseIpcMain();
mainExport.PromiseIpc = PromiseIpcMain;
mainExport.PromiseIpcMain = PromiseIpcMain;

module.exports = mainExport;
export default mainExport;
