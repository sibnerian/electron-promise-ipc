var _isElectronRenderer = require('is-electron-renderer');

var _isElectronRenderer2 = _interopRequireDefault(_isElectronRenderer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

if (_isElectronRenderer2['default']) {
  module.exports = require('./renderer');
} else {
  module.exports = require('./mainProcess');
}

//# sourceMappingURL=index.js.map