import isRenderer from 'is-electron-renderer';
import renderer, { RendererProcessType } from './renderer';
import mainProcess, { MainProcessType } from './mainProcess';

const exportedModule: RendererProcessType | MainProcessType = isRenderer ? renderer : mainProcess;
module.exports = exportedModule;
export default exportedModule;

// Re-export the renderer and main process types for consumer modules to access
export { RendererProcessType } from './renderer';
export { MainProcessType } from './mainProcess';
