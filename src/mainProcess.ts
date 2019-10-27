import { ipcMain, WebContents } from 'electron';
import PromiseIpcBase, { Options } from './base';

export class PromiseIpcMain extends PromiseIpcBase {
  public PromiseIpc?: any;
  public PromiseIpcMain?: any;

  constructor(opts?: Options) {
    super(opts, ipcMain);
  }

  // Send requires webContents -- see http://electron.atom.io/docs/api/ipc-main/
  public send(route: string, webContents: WebContents, ...dataArgs: any): Promise<unknown> {
    return super.send(route, webContents, ...dataArgs);
  }
}

type MainProcessExportType = PromiseIpcMain & {
  PromiseIpc?: PromiseIpcMain,
  PromiseIpcMain?: PromiseIpcMain
};

export const PromiseIpc = PromiseIpcMain;

const mainExport: MainProcessExportType = new PromiseIpcMain();
mainExport.PromiseIpc = PromiseIpcMain;
mainExport.PromiseIpcMain = PromiseIpcMain;

export default mainExport;
module.exports = mainExport;
