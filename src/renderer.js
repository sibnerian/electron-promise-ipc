import { ipcRenderer } from 'electron'; // eslint-disable-line
import PromiseIpcBase from './base';

export class PromiseIpcRenderer extends PromiseIpcBase {
  constructor(opts) {
    super(opts, ipcRenderer);
  }

  send(route, ...dataArgs) {
    return super.send(route, ipcRenderer, ...dataArgs);
  }
}

export const PromiseIpc = PromiseIpcRenderer;

const mainExport = new PromiseIpcRenderer();
mainExport.PromiseIpc = PromiseIpcRenderer;
mainExport.PromiseIpcRenderer = PromiseIpcRenderer;

export default mainExport;
module.exports = mainExport;
