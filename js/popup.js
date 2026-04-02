// ══════════════════════════════════════════════════════
//  ScaleArch — Popup.js
//  Base modal system. All modals in the site use this.
//
//  API:
//    Popup.register(id, options?)   — set up a modal
//    Popup.open(id)                 — open it
//    Popup.close(id)                — close it
//    Popup.closeAll()               — close whatever is open
//
//  Options:
//    onOpen()   — called after modal opens
//    onClose()  — called after modal closes
//
//  Usage example:
//    Popup.register('infoModal');
//    Popup.open('infoModal');
//    Popup.close('infoModal');
// ══════════════════════════════════════════════════════

const Popup = (() => {

  // ── Internal registry ──
  const _registry = new Map();
  let   _current  = null;   // id of the currently open modal

  // ── Register ──────────────────────────────────────
  function register(id, options = {}) {
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`[Popup] No element found with id "${id}"`);
      return;
    }

    _registry.set(id, {
      el,
      onOpen:  options.onOpen  || null,
      onClose: options.onClose || null,
    });

    // Wire up any [data-popup-close] buttons inside this modal
    el.querySelectorAll('[data-popup-close]').forEach(btn => {
      btn.addEventListener('click', () => close(id));
    });

    // Backdrop click — click outside modal-content closes it
    el.addEventListener('click', (e) => {
      if (e.target === el) close(id);
    });
  }

  // ── Open ──────────────────────────────────────────
  function open(id) {
    // Close whatever is already open first
    if (_current && _current !== id) close(_current);

    const entry = _registry.get(id);
    if (!entry) {
      console.warn(`[Popup] "${id}" is not registered. Call Popup.register("${id}") first.`);
      return;
    }

    entry.el.style.display = 'block';
    document.body.style.overflow = 'hidden';   // prevent background scroll
    _current = id;

    if (entry.onOpen) entry.onOpen();
  }

  // ── Close ──────────────────────────────────────────
  function close(id) {
    const entry = _registry.get(id);
    if (!entry) return;

    entry.el.style.display = 'none';
    document.body.style.overflow = '';
    if (_current === id) _current = null;

    if (entry.onClose) entry.onClose();
  }

  // ── Close all ──────────────────────────────────────
  function closeAll() {
    if (_current) close(_current);
  }

  // ── Global Escape key handler ──────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _current) close(_current);
  });

  // ── Public API ────────────────────────────────────
  return { register, open, close, closeAll };

})();