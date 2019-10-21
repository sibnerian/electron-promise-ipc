import isRenderer from 'is-electron-renderer';
import renderer from "./renderer";
import mainProcess from "./mainProcess";

if (isRenderer) {
  module.exports = renderer;
} else {
  module.exports = mainProcess;
}
