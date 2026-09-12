const { contextBridge, ipcRenderer } = require('electron');
const { pathToFileURL } = require('url');

contextBridge.exposeInMainWorld('api', {
  toFileUrl: (filePath) => pathToFileURL(filePath).href,
  getConfig: () => ipcRenderer.invoke('config:get'),
  getKeyLayout: () => ipcRenderer.invoke('keys:layout'),
  setMapping: (code, file) => ipcRenderer.invoke('config:set-mapping', { code, file }),
  removeMapping: (code) => ipcRenderer.invoke('config:remove-mapping', { code }),
  setCrossfade: (ms) => ipcRenderer.invoke('config:set-crossfade', { ms }),
  setDisplay: (displayId) => ipcRenderer.invoke('config:set-display', { displayId }),
  pickFile: () => ipcRenderer.invoke('dialog:pick-file'),
  listDisplays: () => ipcRenderer.invoke('displays:list'),
  launchOutput: () => ipcRenderer.invoke('output:launch'),
  exitFullscreen: () => ipcRenderer.send('output:exit-fullscreen'),
  triggerKey: (code) => ipcRenderer.send('key:trigger', { code }),
  toggleBlackout: () => ipcRenderer.send('blackout:toggle'),

  onKeyFeedback: (cb) => ipcRenderer.on('key:feedback', (_evt, payload) => cb(payload)),
  onDisplayLost: (cb) => ipcRenderer.on('output:display-lost', () => cb()),
  onDisplayRestored: (cb) => ipcRenderer.on('output:display-restored', () => cb()),

  onPlayClip: (cb) => ipcRenderer.on('play-clip', (_evt, payload) => cb(payload)),
  onBlackoutToggle: (cb) => ipcRenderer.on('blackout:toggle', () => cb()),
  onConfigSync: (cb) => ipcRenderer.on('config:sync', (_evt, payload) => cb(payload)),
});
