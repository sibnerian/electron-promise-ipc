import { ipcRenderer } from 'electron'; // eslint-disable-line
import PromiseIpcBase, { Options } from './base';

export class PromiseIpcRenderer extends PromiseIpcBase {
  constructor(opts?: Options) {
    super(opts, ipcRenderer);
  }

  public send(route: string, ...dataArgs: unknown[]): Promise<unknown> {
    return super.send(route, ipcRenderer, ...dataArgs);
  }
}

export type RendererProcessType = PromiseIpcRenderer & {
  PromiseIpc?: typeof PromiseIpcRenderer;
  PromiseIpcRenderer?: typeof PromiseIpcRenderer;
};

export const PromiseIpc = PromiseIpcRenderer;

const rendererExport: RendererProcessType = new PromiseIpcRenderer();
rendererExport.PromiseIpc = PromiseIpcRenderer;
rendererExport.PromiseIpcRenderer = PromiseIpcRenderer;

module.exports = rendererExport;
export default rendererExport;
