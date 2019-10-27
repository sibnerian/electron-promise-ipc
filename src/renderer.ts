import { ipcRenderer } from 'electron'; // eslint-disable-line
import PromiseIpcBase, { Options } from './base';

export class PromiseIpcRenderer extends PromiseIpcBase {
  public PromiseIpc?: any;
  public PromiseIpcRenderer?: any;

  constructor(opts?: Options) {
    super(opts, ipcRenderer);
  }
  public send(route: string, ...dataArgs: any): Promise<unknown> {
    return super.send(route, ipcRenderer, ...dataArgs);
  }
}

export const PromiseIpc = PromiseIpcRenderer;

const mainExport = new PromiseIpcRenderer();
mainExport.PromiseIpc = PromiseIpcRenderer;
mainExport.PromiseIpcRenderer = PromiseIpcRenderer;

export default mainExport;
module.exports = mainExport;
