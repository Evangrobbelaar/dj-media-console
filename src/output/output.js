let config = null;
const badFiles = new Set();

const decks = {
  A: document.getElementById('deckA'),
  B: document.getElementById('deckB'),
};
let activeDeck = 'A';

const blackoutEl = document.getElementById('blackout');
const loadingEl = document.getElementById('loading');
const loadingTextEl = document.getElementById('loading-text');
const loadingBarFillEl = document.getElementById('loading-bar-fill');

function log(...args) {
  console.log('[output]', ...args);
}

function setTransitionDuration(ms) {
  decks.A.style.transitionDuration = `${ms}ms`;
  decks.B.style.transitionDuration = `${ms}ms`;
  blackoutEl.style.transitionDuration = `${ms}ms`;
}

// Probe every mapped file up front: catches missing/corrupt clips before the
// set starts instead of on first trigger, and warms the OS file cache.
// MediaError.code values, per the HTML spec, for readable diagnostics.
const MEDIA_ERROR_NAMES = {
  1: 'MEDIA_ERR_ABORTED',
  2: 'MEDIA_ERR_NETWORK',
  3: 'MEDIA_ERR_DECODE (usually an unsupported codec, e.g. HEVC/H.265)',
  4: 'MEDIA_ERR_SRC_NOT_SUPPORTED (bad path, or a container/codec Chromium cannot open at all)',
};

function describeMediaError(videoEl, file) {
  const err = videoEl.error;
  if (!err) return `unknown error loading ${file}`;
  const name = MEDIA_ERROR_NAMES[err.code] || `code ${err.code}`;
  return `${file} -> ${name}${err.message ? ` (${err.message})` : ''}`;
}

function validateClip(file) {
  return new Promise((resolve) => {
    const probe = document.createElement('video');
    probe.muted = true;
    probe.preload = 'auto';

    const timer = setTimeout(() => {
      cleanup();
      resolve({ ok: false, reason: `${file} -> timed out probing (5s)` });
    }, 5000);

    function cleanup() {
      clearTimeout(timer);
      probe.removeAttribute('src');
      probe.load();
    }

    probe.addEventListener('loadedmetadata', () => { cleanup(); resolve({ ok: true }); }, { once: true });
    probe.addEventListener('error', () => {
      const reason = describeMediaError(probe, file);
      cleanup();
      resolve({ ok: false, reason });
    }, { once: true });

    try {
      probe.src = window.api.toFileUrl(file);
    } catch (err) {
      cleanup();
      resolve({ ok: false, reason: `${file} -> ${err.message}` });
    }
  });
}

async function validateAllClips() {
  const files = [...new Set(Object.values(config.mappings).map((m) => m.file))];
  if (files.length === 0) {
    loadingTextEl.textContent = 'No clips mapped yet';
    loadingBarFillEl.style.width = '100%';
    return;
  }

  const failures = [];
  let done = 0;
  for (const file of files) {
    loadingTextEl.textContent = `Validating clips… ${done + 1}/${files.length}`;
    const result = await validateClip(file);
    if (!result.ok) {
      badFiles.add(file);
      failures.push(result.reason);
      console.error('[output] clip failed, will be skipped:', result.reason);
    }
    done += 1;
    loadingBarFillEl.style.width = `${Math.round((done / files.length) * 100)}%`;
  }

  if (failures.length > 0) {
    // Show the actual reason on screen - press F12 for the full console too,
    // but this is enough to diagnose most cases (bad codec vs bad path)
    // without needing devtools open.
    loadingTextEl.innerHTML =
      `${failures.length} of ${files.length} clip(s) failed:<br>` +
      failures.map((f) => `<span style="font-size:12px">${f}</span>`).join('<br>') +
      '<br>Continuing with the rest.';
    await new Promise((r) => setTimeout(r, 6000));
  }
}

function playClip({ file, loop, crossfadeMs }) {
  if (!file) return;
  if (badFiles.has(file)) {
    log('skipping known-bad file:', file);
    return;
  }

  const idleKey = activeDeck === 'A' ? 'B' : 'A';
  const activeEl = decks[activeDeck];
  const idleEl = decks[idleKey];

  if (activeEl.dataset.file === file) {
    // Retrigger of the currently live clip: restart in place, no crossfade.
    activeEl.currentTime = 0;
    activeEl.play().catch((err) => log('play() failed:', err.message));
    return;
  }

  setTransitionDuration(crossfadeMs != null ? crossfadeMs : config.crossfadeMs);

  const onReady = () => {
    idleEl.removeEventListener('canplay', onReady);
    idleEl.removeEventListener('error', onError);
    idleEl.currentTime = 0;
    idleEl.play().catch((err) => log('play() failed:', err.message));

    requestAnimationFrame(() => {
      idleEl.style.opacity = '1';
      activeEl.style.opacity = '0';
    });

    const fadeMs = crossfadeMs != null ? crossfadeMs : config.crossfadeMs;
    setTimeout(() => {
      activeEl.pause();
      activeEl.removeAttribute('src');
      activeEl.removeAttribute('data-file');
      activeEl.load();
    }, fadeMs + 60);

    activeDeck = idleKey;
  };

  const onError = () => {
    idleEl.removeEventListener('canplay', onReady);
    idleEl.removeEventListener('error', onError);
    badFiles.add(file);
    console.error('[output] failed to load clip, skipping:', file);
  };

  idleEl.addEventListener('canplay', onReady, { once: true });
  idleEl.addEventListener('error', onError, { once: true });
  idleEl.loop = !!loop;
  idleEl.dataset.file = file;
  idleEl.src = window.api.toFileUrl(file);
}

let blackoutOn = false;
function toggleBlackout() {
  blackoutOn = !blackoutOn;
  setTransitionDuration(config.crossfadeMs);
  blackoutEl.style.opacity = blackoutOn ? '1' : '0';
}

async function init() {
  config = await window.api.getConfig();
  setTransitionDuration(config.crossfadeMs);

  await validateAllClips();
  loadingEl.style.opacity = '0';
  setTimeout(() => { loadingEl.style.display = 'none'; }, 320);

  window.api.onPlayClip((payload) => playClip(payload));
  window.api.onBlackoutToggle(() => toggleBlackout());
  window.api.onConfigSync((updated) => {
    // Mid-set edits from the mapping window (new mapping, crossfade change)
    // take effect immediately, no restart needed.
    config = updated;
  });

  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Escape') {
      window.api.exitFullscreen();
      return;
    }
    if (e.code === 'Space') {
      toggleBlackout();
      return;
    }
    const mapping = config.mappings[e.code];
    if (mapping) playClip({ ...mapping, crossfadeMs: config.crossfadeMs });
  });
}

init();
