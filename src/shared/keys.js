// Keyboard layout used to render the mapping grid and to validate trigger
// keys. Keyed by KeyboardEvent.code (layout-independent), not e.key, so this
// works the same on QWERTY, AZERTY, etc.
//
// Space and Escape are reserved (blackout / exit-fullscreen) and deliberately
// excluded from the mappable grid.

const FUNCTION_ROW = [
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
].map((k) => ({ code: k, label: k }));

const NUMBER_ROW = [
  'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5',
  'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0',
  'Minus', 'Equal',
].map((k) => ({ code: k, label: k.replace('Digit', '').replace('Minus', '-').replace('Equal', '=') }));

const ROW_Q = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight']
  .map((k) => ({ code: k, label: k.replace('Key', '').replace('BracketLeft', '[').replace('BracketRight', ']') }));

const ROW_A = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote']
  .map((k) => ({ code: k, label: k.replace('Key', '').replace('Semicolon', ';').replace('Quote', "'") }));

const ROW_Z = ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash']
  .map((k) => ({ code: k, label: k.replace('Key', '').replace('Comma', ',').replace('Period', '.').replace('Slash', '/') }));

const ROWS = [FUNCTION_ROW, NUMBER_ROW, ROW_Q, ROW_A, ROW_Z];

const ALL_CODES = ROWS.flat().map((k) => k.code);

const RESERVED_CODES = ['Space', 'Escape'];

module.exports = { ROWS, ALL_CODES, RESERVED_CODES };
