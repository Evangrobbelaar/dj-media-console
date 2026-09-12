let config = null;
let layout = null;
const keyEls = new Map(); // code -> element

const gridEl = document.getElementById('grid');
const crossfadeInput = document.getElementById('crossfade');
const crossfadeValue = document.getElementById('crossfade-value');
const displaySelect = document.getElementById('display-select');
const launchBtn = document.getElementById('launch-btn');
const exitBtn = document.getElementById('exit-fullscreen-btn');
const blackoutBtn = document.getElementById('blackout-btn');
const statusEl = document.getElementById('status');

function basename(p) {
  if (!p) return '';
  return p.split(/[\\/]/).pop();
}

function renderGrid() {
  gridEl.innerHTML = '';
  keyEls.clear();

  for (const row of layout.rows) {
    const rowEl = document.createElement('div');
    rowEl.className = 'key-row';

    for (const key of row) {
      const mapping = config.mappings[key.code];
      const keyEl = document.createElement('div');
      keyEl.className = 'key' + (mapping ? ' mapped' : '');
      keyEl.dataset.code = key.code;

      const labelEl = document.createElement('div');
      labelEl.className = 'label';
      labelEl.textContent = key.label;

      const clipEl = document.createElement('div');
      clipEl.className = 'clip-name';
      clipEl.textContent = mapping ? basename(mapping.file) : '— empty —';
      clipEl.title = mapping ? mapping.file : '';

      keyEl.appendChild(labelEl);
      keyEl.appendChild(clipEl);

      if (mapping) {
        const clearBtn = document.createElement('button');
        clearBtn.className = 'clear';
        clearBtn.textContent = 'clear ×';
        clearBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          config = await window.api.removeMapping(key.code);
          renderGrid();
        });
        keyEl.appendChild(clearBtn);
      }

      keyEl.addEventListener('click', () => assignClip(key.code));
      rowEl.appendChild(keyEl);
      keyEls.set(key.code, keyEl);
    }
    gridEl.appendChild(rowEl);
  }
}

async function assignClip(code) {
  const file = await window.api.pickFile();
  if (!file) return;
  config = await window.api.setMapping(code, file);
  renderGrid();
}

function flashKey(code) {
  const el = keyEls.get(code);
  if (!el) return;
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 150);
}

async function populateDisplays() {
  const displays = await window.api.listDisplays();
  displaySelect.innerHTML = '';

  const autoOpt = document.createElement('option');
  autoOpt.value = '';
  autoOpt.textContent = 'Auto (first non-primary)';
  displaySelect.appendChild(autoOpt);

  for (const d of displays) {
    const opt = document.createElement('option');
    opt.value = String(d.id);
    opt.textContent = d.label;
    displaySelect.appendChild(opt);
  }
  displaySelect.value = config.outputDisplayId != null ? String(config.outputDisplayId) : '';
}

function setStatus(text, ms = 3000) {
  statusEl.textContent = text;
  if (ms) setTimeout(() => { if (statusEl.textContent === text) statusEl.textContent = ''; }, ms);
}

async function init() {
  [config, layout] = await Promise.all([window.api.getConfig(), window.api.getKeyLayout()]);

  crossfadeInput.value = config.crossfadeMs;
  crossfadeValue.textContent = `${config.crossfadeMs}ms`;

  renderGrid();
  await populateDisplays();

  crossfadeInput.addEventListener('input', () => {
    crossfadeValue.textContent = `${crossfadeInput.value}ms`;
  });
  crossfadeInput.addEventListener('change', async () => {
    config = await window.api.setCrossfade(Number(crossfadeInput.value));
  });

  displaySelect.addEventListener('change', async () => {
    const val = displaySelect.value === '' ? null : Number(displaySelect.value);
    config = await window.api.setDisplay(val);
  });

  launchBtn.addEventListener('click', async () => {
    await window.api.launchOutput();
    setStatus('Output launched — fullscreen on projector display.');
  });

  exitBtn.addEventListener('click', () => window.api.exitFullscreen());
  blackoutBtn.addEventListener('click', () => window.api.toggleBlackout());

  window.api.onKeyFeedback(({ code }) => flashKey(code));
  window.api.onDisplayLost(() => setStatus('Output display disconnected — parked on laptop screen.', 6000));
  window.api.onDisplayRestored(() => setStatus('Output display reconnected — back to fullscreen.', 4000));

  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'SELECT') return;

    if (e.code === 'Space') {
      e.preventDefault();
      window.api.toggleBlackout();
      return;
    }
    if (config.mappings[e.code]) {
      flashKey(e.code);
      window.api.triggerKey(e.code);
    }
  });
}

init();
