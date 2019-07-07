# electron-promise-ipc

[![Build Status](https://travis-ci.org/sibnerian/electron-promise-ipc.svg?branch=master)](https://travis-ci.org/sibnerian/electron-promise-ipc) [![Coverage Status](https://coveralls.io/repos/github/sibnerian/electron-promise-ipc/badge.svg?branch=master)](https://coveralls.io/github/sibnerian/electron-promise-ipc?branch=master) [![npm version](https://badge.fury.io/js/electron-promise-ipc.svg)](https://badge.fury.io/js/electron-promise-ipc)

#### Promise-y IPC calls in Electron.

## Installation

```sh
npm install --save electron-promise-ipc
```

## Usage

The most common use case: from the renderer, get data from the main process as a promise.

```js
// in main process
import promiseIpc from 'electron-promise-ipc';
import fsp from 'fs-promise';

promiseIpc.on('writeSettingsFile', (newSettings, event) => {
  return fsp.writeFile('~/.settings', newSettings);
});

// in renderer
import promiseIpc from 'electron-promise-ipc';

promiseIpc
  .send('writeSettingsFile', '{ "name": "Jeff" }')
  .then(() => console.log('You wrote the settings!'))
  .catch((e) => console.error(e));
```

You can also send data from the main process to a renderer, if you pass in its [WebContents](http://electron.atom.io/docs/api/web-contents) object.

```js
// in main process
import promiseIpc from 'electron-promise-ipc';

promiseIpc
  .send('getRendererData', webContentsForRenderer)
  .then((rendererData) => console.log(rendererData))
  .catch((e) => console.error(e));

// in renderer
import promiseIpc from 'electron-promise-ipc';

promiseIpc.on('getRendererData', (event) => {
  return getSomeSuperAwesomeRendererData();
});
```

Any arguments to `send()` will be passed directly to the event listener from `on()`, followed by the IPC [event](https://electronjs.org/docs/api/ipc-main#event-object) object. If there is an error thrown in the main process's listener, or if the listener returns a rejected promise (e.g., lack of permissions for a file read), then the `send()` promise is rejected with the same error.

Note that because this is IPC, only JSON-serializable values can be passed as arguments or data. Classes and functions will generally not survive a round of serialization/deserialization.

## Advanced usage

#### Timeouts

By default, the promise will wait forever for the other process to return it some data. If you want to set a timeout (after which the promise will be rejected automatically), you can create another instance of `PromiseIpc` like so:

```js
// main process code remains the same
import promiseIpc from 'electron-promise-ipc';

promiseIpc.on('someRoute', () => {
  return someOperationThatNeverCompletesUhOh();
});

// in renderer - timeout is specified on the side that requests the data
import { PromiseIpc } from 'electron-promise-ipc';

const promiseIpc = new PromiseIpc({ maxTimeoutMs: 2000 });

promiseIpc
  .send('someRoute', '{ "name": "Jeff" }')
  .then(() => console.log('You wrote the settings!'))
  .catch((e) => console.error(e)); // will error out after 2 seconds
```

#### Removing Listeners

You can remove a listener with the `off()` method. It's aliased to `removeListener()` as well.

```js
import promiseIpc from 'electron-promise-ipc';

promiseIpc.on('someRoute', () => {
  return something();
});

promiseIpc.off('someRoute'); // never mind
```

## License

MIT
