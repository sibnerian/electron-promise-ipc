import isRenderer from 'is-electron-renderer';

if (isRenderer) {
  module.exports = require('./renderer');
} else {
  module.exports = require('./mainProcess');
}
