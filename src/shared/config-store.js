const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULT_CONFIG = {
  crossfadeMs: 400,
  outputDisplayId: null,
  mappings: {},
};

// Dev: <repo>/config/config.json
// Packaged: next to the exe, so a USB stick / different drive letter works.
// (Phase 5 packaging will also make media paths relative to this same dir.)
function getConfigPath() {
  const base = app.isPackaged ? path.dirname(process.execPath) : app.getAppPath();
  return path.join(base, app.isPackaged ? 'config.json' : 'config', 'config.json');
}

function loadConfig() {
  const configPath = getConfigPath();
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed, mappings: { ...(parsed.mappings || {}) } };
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`[config] failed to read ${configPath}, falling back to defaults:`, err.message);
    }
    const fresh = { ...DEFAULT_CONFIG };
    saveConfig(fresh);
    return fresh;
  }
}

function saveConfig(config) {
  const configPath = getConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

module.exports = { DEFAULT_CONFIG, getConfigPath, loadConfig, saveConfig };
