const path = require('path');
const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');
const { loadConfig, saveConfig } = require('./src/shared/config-store');
const { ROWS, ALL_CODES, RESERVED_CODES } = require('./src/shared/keys');

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'mkv', 'm4v', 'webm'];

let config = null;
let mappingWindow = null;
let outputWindow = null;
let outputTargetDisplayId = null; // display we *want* output on, survives hotplug

function log(...args) {
  console.log('[main]', ...args);
}

// ---------------------------------------------------------------------------
// Window creation
// ---------------------------------------------------------------------------

function createMappingWindow() {
  mappingWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    title: 'DJ Media Console — Key Mapping',
    backgroundColor: '#111318',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mappingWindow.loadFile(path.join(__dirname, 'src', 'mapping', 'index.html'));
  mappingWindow.on('closed', () => {
    mappingWindow = null;
  });
}

function pickOutputDisplay() {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();

  if (config.outputDisplayId != null) {
    const preferred = displays.find((d) => d.id === config.outputDisplayId);
    if (preferred) return preferred;
  }
  const secondary = displays.find((d) => d.id !== primary.id);
  return secondary || primary;
}

function createOrMoveOutputWindow() {
  const target = pickOutputDisplay();
  outputTargetDisplayId = target.id;

  if (outputWindow && !outputWindow.isDestroyed()) {
    outputWindow.setFullScreen(false);
    outputWindow.setBounds(target.bounds);
    outputWindow.setFullScreen(true);
    outputWindow.show();
    return outputWindow;
  }

  outputWindow = new BrowserWindow({
    x: target.bounds.x,
    y: target.bounds.y,
    width: target.bounds.width,
    height: target.bounds.height,
    frame: false,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  outputWindow.loadFile(path.join(__dirname, 'src', 'output', 'index.html'));
  outputWindow.once('ready-to-show', () => {
    outputWindow.setFullScreen(true);
    outputWindow.show();
  });
  outputWindow.on('closed', () => {
    outputWindow = null;
  });
  return outputWindow;
}

// ---------------------------------------------------------------------------
// Display hotplug: if the projector drops, don't strand the window off in
// space; if it comes back, re-fullscreen without requiring a restart.
// ---------------------------------------------------------------------------

function handleDisplaysChanged() {
  if (!outputWindow || outputWindow.isDestroyed()) return;

  const displays = screen.getAllDisplays();
  const stillThere = displays.some((d) => d.id === outputTargetDisplayId);

  if (!stillThere) {
    log('output display disconnected, parking output window on primary');
    const primary = screen.getPrimaryDisplay();
    outputWindow.setFullScreen(false);
    outputWindow.setBounds({
      x: primary.bounds.x + 40,
      y: primary.bounds.y + 40,
      width: 960,
      height: 540,
    });
    notifyMapping('output:display-lost', {});
    return;
  }
}

function tryReclaimDisplay() {
  if (!outputWindow || outputWindow.isDestroyed()) return;
  if (config.outputDisplayId == null) return; // no explicit preference, nothing to reclaim onto

  const displays = screen.getAllDisplays();
  const reclaimed = displays.find((d) => d.id === config.outputDisplayId);
  if (reclaimed && outputTargetDisplayId !== reclaimed.id) {
    log('preferred output display reconnected, restoring fullscreen');
    createOrMoveOutputWindow();
    notifyMapping('output:display-restored', {});
  }
}

// ---------------------------------------------------------------------------
// IPC <-> mapping window
// ---------------------------------------------------------------------------

function notifyMapping(channel, payload) {
  if (mappingWindow && !mappingWindow.isDestroyed()) {
    mappingWindow.webContents.send(channel, payload);
  }
}

function notifyOutput(channel, payload) {
  if (outputWindow && !outputWindow.isDestroyed()) {
    outputWindow.webContents.send(channel, payload);
  }
}

function registerIpcHandlers() {
  ipcMain.handle('config:get', () => config);

  ipcMain.handle('keys:layout', () => ({ rows: ROWS, codes: ALL_CODES, reserved: RESERVED_CODES }));

  ipcMain.handle('config:set-mapping', (_evt, { code, file }) => {
    if (!ALL_CODES.includes(code)) throw new Error(`not a mappable key: ${code}`);
    config.mappings[code] = { file, loop: true };
    saveConfig(config);
    notifyOutput('config:sync', config);
    return config;
  });

  ipcMain.handle('config:remove-mapping', (_evt, { code }) => {
    delete config.mappings[code];
    saveConfig(config);
    notifyOutput('config:sync', config);
    return config;
  });

  ipcMain.handle('config:set-crossfade', (_evt, { ms }) => {
    config.crossfadeMs = Math.max(0, Math.min(2000, Number(ms) || 0));
    saveConfig(config);
    notifyOutput('config:sync', config);
    return config;
  });

  ipcMain.handle('config:set-display', (_evt, { displayId }) => {
    config.outputDisplayId = displayId;
    saveConfig(config);
    return config;
  });

  ipcMain.handle('dialog:pick-file', async () => {
    const result = await dialog.showOpenDialog(mappingWindow, {
      title: 'Choose a clip',
      properties: ['openFile'],
      filters: [{ name: 'Video', extensions: VIDEO_EXTENSIONS }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('displays:list', () => {
    const primary = screen.getPrimaryDisplay();
    return screen.getAllDisplays().map((d) => ({
      id: d.id,
      label: `${d.id === primary.id ? 'Primary' : 'Display'} ${d.bounds.width}x${d.bounds.height}`,
      isPrimary: d.id === primary.id,
      bounds: d.bounds,
    }));
  });

  ipcMain.handle('output:launch', () => {
    createOrMoveOutputWindow();
    return true;
  });

  ipcMain.on('output:exit-fullscreen', () => {
    if (outputWindow && !outputWindow.isDestroyed()) {
      outputWindow.setFullScreen(false);
    }
  });

  ipcMain.on('key:trigger', (_evt, { code }) => {
    const mapping = config.mappings[code];
    if (!mapping) return;
    notifyOutput('play-clip', { code, ...mapping, crossfadeMs: config.crossfadeMs });
    notifyMapping('key:feedback', { code });
  });

  ipcMain.on('blackout:toggle', () => {
    notifyOutput('blackout:toggle', {});
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  config = loadConfig();
  registerIpcHandlers();
  createMappingWindow();

  screen.on('display-removed', handleDisplaysChanged);
  screen.on('display-added', () => {
    handleDisplaysChanged();
    tryReclaimDisplay();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMappingWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
