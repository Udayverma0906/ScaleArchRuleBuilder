// ══════════════════════════════════════════════════════
//  ScaleArch Rule Builder — script.js
//  Orchestrator: state, UI, step pills, pattern library,
//  node picker, modals, and generate() routing.
//
//  Code generation is split across:
//    generators/regex.js      → generateRegex()
//    generators/ast-jsts.js   → generateAst()
//    generators/ast-python.js → generatePythonAst()
//  Syntax highlighting:
//    highlight.js             → syntaxHighlight(), renderCode()
// ══════════════════════════════════════════════════════

// ── STATE ──
let state = {
  severity: 'error',
  type: 'regex',
  nodeType: '',
  generated: '',
};

// ── BUILD NODE PICKER ──
// Filters AST_NODES by current astLanguage selection (js-ts or python)
function buildNodePicker() {
  const lang   = document.getElementById('astLanguage')?.value || 'js-ts';
  const picker = document.getElementById('nodePicker');
  const filtered = AST_NODES.filter(n => (n.language || 'js-ts') === lang);
  picker.innerHTML = filtered.map(n => `
    <div class="node-pill" id="pill-${n.id}">
      <span class="node-pill-label" onclick="toggleNodeType('${n.id}')">${n.id}</span>
      <span class="node-pill-info" onclick="showNodeInfo('${n.id}')" title="Details">ⓘ</span>
    </div>
  `).join('');
}

// Called when AST language toggle changes — clears selection, rebuilds
// node picker AND the "What to check" dropdown for the active language.
window.rebuildNodePicker = function() {
  selectedNodes.clear();
  document.getElementById('astNodeType').value = '';
  state.nodeType = '';
  buildNodePicker();
  rebuildAstCheckDropdown();
};

// Rebuild "What to check" dropdown from the active generator's checks array.
// JS/TS → JSTS_AST_CHECKS   Python → PYTHON_AST_CHECKS   Java → JAVA_AST_CHECKS (future)
function rebuildAstCheckDropdown() {
  const lang = document.getElementById('astLanguage')?.value || 'js-ts';
  const checksMap = {
    'js-ts':  typeof JSTS_AST_CHECKS   !== 'undefined' ? JSTS_AST_CHECKS   : [],
    'python': typeof PYTHON_AST_CHECKS !== 'undefined' ? PYTHON_AST_CHECKS : [],
    // 'java': typeof JAVA_AST_CHECKS !== 'undefined' ? JAVA_AST_CHECKS : [],
  };
  const checks = checksMap[lang] ?? [];
  if (checks.length === 0) return;

  const menu   = document.getElementById('astCheckDropdownMenu');
  const label  = document.getElementById('astCheckDropdownLabel');
  const hidden = document.getElementById('astCheck');

  // Rebuild menu options
  menu.innerHTML = checks.map((c, i) => {
    // Escape single quotes in label for safe inline onclick attribute
    const safeLabel = c.label.replace(/'/g, "\'");
    return `<button type="button" class="cdd-option${i === 0 ? ' cdd-selected' : ''}"
      data-value="${c.value}"
      onclick="selectDropdown('astCheckDropdown','astCheck',this,'${safeLabel}')"
    >${c.label}</button>`;
  }).join('');

  // Reset to first option
  hidden.value      = checks[0].value;
  label.textContent = checks[0].label;

  // Show/hide threshold and name fields based on first option config
  applyCheckFieldVisibility(checks[0]);
}

// Show/hide threshold and callee fields based on a check config object
function applyCheckFieldVisibility(checkConfig) {
  const tf = document.getElementById('thresholdField');
  const cf = document.getElementById('calleeField');
  if (!tf || !cf) return;

  tf.style.display       = checkConfig.hasThreshold ? 'flex' : 'none';
  tf.style.flexDirection = 'column';
  tf.style.gap           = '8px';

  cf.style.display       = checkConfig.hasName ? 'flex' : 'none';
  cf.style.flexDirection = 'column';
  cf.style.gap           = '8px';
}

// ── SEVERITY ──
function setSev(s) {
  state.severity = s;
  document.querySelectorAll('.sev-btn').forEach(b => b.classList.remove('selected'));
  document.querySelector(`.sev-btn[data-sev="${s}"]`).classList.add('selected');
  updateStepPills(2);
}

// ── RULE TYPE ──
function setType(t) {
  state.type = t;
  document.getElementById('btn-regex').classList.toggle('selected', t === 'regex');
  document.getElementById('btn-ast').classList.toggle('selected', t === 'ast');
  document.getElementById('regex-section').style.display = t === 'regex' ? 'flex' : 'none';
  document.getElementById('ast-section').style.display   = t === 'ast'   ? 'flex' : 'none';
  if (t === 'ast') document.getElementById('ast-section').style.flexDirection = 'column';
  document.getElementById('regex-section').style.flexDirection = 'column';
  checkDetectionComplete();
}

// ── AST NODE SELECTION (multi) ──
const selectedNodes = new Set();

function toggleNodeType(id) {
  const pill = document.getElementById('pill-' + id);
  if (selectedNodes.has(id)) {
    selectedNodes.delete(id);
    pill.classList.remove('selected');
  } else {
    selectedNodes.add(id);
    pill.classList.add('selected');
  }
  document.getElementById('astNodeType').value = [...selectedNodes].join(' | ');
  state.nodeType = document.getElementById('astNodeType').value;
}

// ── NODE INFO CARD ──
function showNodeInfo(id) {
  const node = AST_NODES.find(n => n.id === id);
  if (!node) return;

  document.getElementById('nicName').textContent    = node.id;
  document.getElementById('nicDesc').textContent    = node.desc;
  document.getElementById('nicExample').textContent = node.example;

  const propsEl = document.getElementById('nicProps');
  propsEl.innerHTML = node.props.map(p =>
    `<span class="nic-prop-chip">${p}</span>`
  ).join('');

  const card = document.getElementById('nodeInfoCard');
  card.style.display = 'block';
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeNodeInfo() {
  document.getElementById('nodeInfoCard').style.display = 'none';
}

// ── AST CHECK CHANGE ──
// Reads field visibility config from the active language's checks array
// instead of hardcoded value lists — so new languages just work automatically.
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('astCheck').addEventListener('change', function() {
    const v    = this.value;
    const lang = document.getElementById('astLanguage')?.value || 'js-ts';
    const checksMap = {
      'js-ts':  typeof JSTS_AST_CHECKS   !== 'undefined' ? JSTS_AST_CHECKS   : [],
      'python': typeof PYTHON_AST_CHECKS !== 'undefined' ? PYTHON_AST_CHECKS : [],
    };
    const checks = checksMap[lang] ?? [];
    const config = checks.find(c => c.value === v);
    if (config) applyCheckFieldVisibility(config);
  });
});

let activeCategory = 'all';
let activeSearch   = '';

function buildPatternList() {
  const list = document.getElementById('patList');
  const filtered = PATTERN_LIBRARY.filter(p => {
    const catMatch  = activeCategory === 'all' || p.category === activeCategory;
    const term      = activeSearch.toLowerCase();
    const textMatch = !term ||
      p.name.toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term) ||
      p.pattern.toLowerCase().includes(term) ||
      p.message.toLowerCase().includes(term);
    return catMatch && textMatch;
  });

  if (filtered.length === 0) {
    list.innerHTML = '<div class="pat-empty">No patterns match your search.</div>';
    return;
  }

  const langBadgeLabel = { all: 'all', 'js-ts': 'JS/TS', python: 'Python', java: 'Java', cpp: 'C/C++' };

  list.innerHTML = filtered.map((p, i) => `
    <div class="pat-item" onclick="usePattern(${PATTERN_LIBRARY.indexOf(p)})">
      <span class="pat-item-name">${p.name}</span>
      <div class="pat-item-meta">
        <span class="pat-item-cat ${p.category}">${p.category}</span>
        <span class="pat-item-lang pat-lang-${p.language || 'all'}">${langBadgeLabel[p.language || 'all']}</span>
      </div>
      <span class="pat-item-pattern">${escapeHtml(p.pattern)}</span>
      <button class="pat-item-use" onclick="event.stopPropagation();usePattern(${PATTERN_LIBRARY.indexOf(p)})">Use →</button>
    </div>
  `).join('');
}

function filterCategory(cat, btn) {
  activeCategory = cat;
  document.querySelectorAll('.pat-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  buildPatternList();
}

function filterPatterns(val) {
  activeSearch = val;
  buildPatternList();
}

function usePattern(idx) {
  const p = PATTERN_LIBRARY[idx];
  if (!p) return;

  document.getElementById('regexPattern').value = p.pattern;
  document.getElementById('contextType').value  = p.context;

  const isMulti = p.context && p.context.startsWith('multiline');
  const mf = document.getElementById('multilineFields');
  mf.style.display = isMulti ? 'flex' : 'none';

  if (isMulti) {
    if (p.multilineAnchor)    document.getElementById('multilineAnchor').value    = p.multilineAnchor;
    if (p.multilineCount)     document.getElementById('multilineCount').value      = p.multilineCount;
    if (p.multilineThreshold) document.getElementById('multilineThreshold').value  = p.multilineThreshold;
  }

  document.getElementById('message').value = p.message;
  document.getElementById('hint').value    = p.hint;

  setCustomSelect('category', p.category);
  if (p.language) setCustomSelect('ruleLanguage', p.language);
  setCustomSelect('contextType', p.context || 'none');

  showNotif(`✓ Pattern applied — "${p.name}"`);
  document.getElementById('regexPattern').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}

// ── TEST REGEX ──
function testRegex() {
  const pattern = document.getElementById('regexPattern').value.trim();
  const line    = document.getElementById('testLine').value;
  const result  = document.getElementById('testResult');
  if (!pattern || !line) return;
  try {
    const re = new RegExp(pattern, 'i');
    const matched = re.test(line);
    result.style.display = 'block';
    result.className = 'test-result ' + (matched ? 'match' : 'no-match');
    result.textContent = matched
      ? '✓ Pattern matches — rule would fire on this line'
      : '✗ No match — rule would not fire on this line';
  } catch(e) {
    result.style.display = 'block';
    result.className = 'test-result no-match';
    result.textContent = '✗ Invalid regex: ' + e.message;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('testLine').addEventListener('keydown', e => {
    if (e.key === 'Enter') testRegex();
  });

  document.getElementById('contextType').addEventListener('change', function() {
    const isMulti = this.value.startsWith('multiline');
    const mf = document.getElementById('multilineFields');
    mf.style.display = isMulti ? 'flex' : 'none';

    if (this.value === 'multiline-keyword') {
      document.getElementById('multilineAnchor').placeholder = 'e.g. SELECT (anchor line keyword)';
      document.getElementById('multilineCount').placeholder  = 'e.g. JOIN (keyword to count)';
    } else if (this.value === 'multiline-count') {
      document.getElementById('multilineAnchor').placeholder = 'e.g. import (anchor line keyword)';
      document.getElementById('multilineCount').placeholder  = 'e.g. import (keyword to count)';
    }
  });
});

// ── GENERATE RULE CODE ──
function generate() {
  const category = document.getElementById('category').value;
  const ruleName = document.getElementById('ruleName').value.trim();
  const message  = document.getElementById('message').value.trim();
  const hint     = document.getElementById('hint').value.trim();

  if (!category || !ruleName || !message) {
    showNotif('⚠ Fill in category, rule name, and message first', true);
    return;
  }
  if (!validateRuleName(ruleName)) {
    showNotif('⚠ Rule name must be kebab-case: lowercase letters and hyphens only', true);
    return;
  }

  const btn = document.querySelector('.generate-btn');
  const originalText = btn.innerHTML;
  btn.innerHTML = `
    <svg class="spinner" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="8" cy="8" r="6" stroke-linecap="round" stroke-dasharray="20 20" stroke-dashoffset="20">
        <animate attributeName="stroke-dashoffset" values="20;0" dur="1s" repeatCount="indefinite"/>
      </circle>
    </svg>
    Generating...
  `;
  btn.disabled = true;
  btn.style.opacity = '0.8';

  setTimeout(() => {
    const sev = state.severity;
    const sevMap = {
      error:   'vscode.DiagnosticSeverity.Error',
      warning: 'vscode.DiagnosticSeverity.Warning',
      info:    'vscode.DiagnosticSeverity.Information',
      hint:    'vscode.DiagnosticSeverity.Hint',
    };

    const astLang = document.getElementById('astLanguage')?.value || 'js-ts';
    const code = state.type === 'regex'
      ? generateRegex(category, ruleName, message, hint, sevMap[sev])
      : astLang === 'python'
        ? generatePythonAst(category, ruleName, message, hint, sevMap[sev])
        : generateAst(category, ruleName, message, hint, sevMap[sev]);

    state.generated = code;
    document.getElementById('verifyBtn').disabled = false;
    renderCode(syntaxHighlight(code));
    updateInstructions();
    updateStepPills(4);
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('codeWrap').style.display = 'block';
    document.getElementById('codeWrap').scrollIntoView({ behavior: 'smooth' });

    btn.innerHTML = originalText;
    btn.disabled  = false;
    btn.style.opacity = '1';

    btn.style.transform = 'scale(1.05)';
    setTimeout(() => btn.style.transform = '', 200);
  }, 800);
}

// ── COPY ──
function copyCode() {
  if (!state.generated) return;
  openConfirmModal();
}

// ── CONFIRMATION MODAL ──
let _confirmOnYes = null;
let _confirmOnNo  = null;

function openConfirmModal(onYes, onNo) {
  _confirmOnYes = onYes || null;
  _confirmOnNo  = onNo  || null;

  const s1 = document.getElementById('confirmStep1');
  const s2 = document.getElementById('confirmStep2');
  if (!s1 || !s2) {
    console.error('[ScaleArch] confirmModal steps not found');
    return;
  }
  s1.style.display = 'block';
  s2.style.display = 'none';

  const hint    = document.getElementById('hint').value.trim();
  const message = document.getElementById('message').value.trim();
  const qEl     = document.getElementById('confirmQualityCheck');
  const issues  = [];
  if (!hint || hint.length < 20)       issues.push(`⚠️ Your <b>hint</b> is empty or very short — developers won't know how to fix the issue.`);
  if (!message || message.length < 10) issues.push(`⚠️ Your <b>message</b> is too short — it's what appears in the squiggly tooltip.`);

  if (issues.length > 0) {
    qEl.innerHTML = issues.map(i => `<div class="confirm-quality-issue">${i}</div>`).join('');
    qEl.style.display = 'block';
  } else {
    qEl.innerHTML = '';
    qEl.style.display = 'none';
  }

  Popup.open('confirmModal');
}

function closeConfirmModal() { Popup.close('confirmModal'); }

function confirmCopy() {
  closeConfirmModal();
  if (_confirmOnYes) { _confirmOnYes(); return; }
  navigator.clipboard.writeText(state.generated).then(() => {
    const btn = document.getElementById('copyBtn');
    btn.textContent = '✓ Copied!';
    btn.classList.add('copied');
    showNotif('✓ Rule code copied to clipboard');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
  });
}

function showConfirmStep2() {
  if (_confirmOnNo) { closeConfirmModal(); _confirmOnNo(); return; }
  const cs1 = document.getElementById('confirmStep1');
  const cs2 = document.getElementById('confirmStep2');
  if (cs1) cs1.style.display = 'none';
  if (cs2) cs2.style.display = 'block';
}

function confirmVerify() {
  closeConfirmModal();
  openVerification();
}

// ── TAB SWITCH ──
function switchTab(tab, btn) {
  document.getElementById('tab-code').style.display         = tab === 'code'         ? 'flex' : 'none';
  document.getElementById('tab-instructions').style.display = tab === 'instructions' ? 'block' : 'none';
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ── INSTRUCTIONS ──
function updateInstructions() {
  const isAst = state.type === 'ast';
  document.getElementById('instrStep3').style.display = isAst ? 'flex' : 'none';
  document.getElementById('finalStep').textContent    = isAst ? '4' : '3';

  const astLang = document.getElementById('astLanguage')?.value || 'js-ts';
  if (isAst && astLang === 'python') {
    document.getElementById('instrStep2Title').textContent = 'Paste the function into customRules.ts';
    document.getElementById('instrStep2Body').innerHTML =
      'Find <span class="inline-code">// Section 4</span> in <span class="inline-code">customRules.ts</span> and paste the generated function above the export array.';
    const s3t = document.getElementById('instrStep3Title');
    const s3b = document.getElementById('instrStep3Body');
    if (s3t) s3t.textContent = 'Register in CUSTOM_PYTHON_AST_RULES';
    if (s3b) s3b.innerHTML = 'Add your function name to the <span class="inline-code">CUSTOM_PYTHON_AST_RULES</span> array at the bottom of Section 4.';
  } else if (isAst) {
    document.getElementById('instrStep2Title').textContent = 'Paste the function into customRules.ts';
    document.getElementById('instrStep2Body').innerHTML =
      'Find <span class="inline-code">// Section 2</span> in <span class="inline-code">customRules.ts</span> and paste the generated function above the export array.';
    const s3t = document.getElementById('instrStep3Title');
    const s3b = document.getElementById('instrStep3Body');
    if (s3t) s3t.textContent = 'Register in CUSTOM_AST_CHECKS';
    if (s3b) s3b.innerHTML = 'Add your function name to the <span class="inline-code">CUSTOM_AST_CHECKS</span> array at the bottom of Section 2.';
  } else {
    document.getElementById('instrStep2Title').textContent = 'Add to CUSTOM_REGEX_RULES array';
    document.getElementById('instrStep2Body').innerHTML =
      'Find the <span class="inline-code">CUSTOM_REGEX_RULES</span> array in Section 1 and paste the generated object inside it.';
  }
}

// ── STEP PILLS ──
function updateStepPills(activeStep) {
  for (let i = 1; i <= 4; i++) {
    document.getElementById(`pill-${i}`).classList.toggle('active', i <= activeStep);
  }
}

// ── DETECTION COMPLETE CHECK ──
function checkDetectionComplete() {
  const cat = document.getElementById('category').value;
  const nm  = document.getElementById('ruleName').value.trim();
  const msg = document.getElementById('message').value.trim();
  if (!cat || !nm || !msg) return;

  if (state.type === 'regex') {
    const pattern = document.getElementById('regexPattern').value.trim();
    if (pattern) updateStepPills(3);
  } else {
    const nodeType = document.getElementById('astNodeType').value.trim();
    if (nodeType) updateStepPills(3);
  }
}

// ── NOTIFICATION ──
let notifTimeout;
let progressTimeout;

function showNotif(msg, isWarn = false, withProgress = false, duration = 3000) {
  const n = document.getElementById('notif');
  const textEl = document.getElementById('notif-text');
  const progressEl = document.getElementById('notif-progress');

  if (!n || !textEl || !progressEl) return;

  // Clear previous timers
  clearTimeout(notifTimeout);
  clearTimeout(progressTimeout);

  // Reset notification state
  n.classList.remove('show', 'warn');

  // Force progress reset properly
  progressEl.style.transition = 'none';
  progressEl.style.width = '0%';
  progressEl.style.background = '';

  // Force reflow so browser applies reset before animating again
  void progressEl.offsetWidth;

  // Set new message
  textEl.textContent = msg;

  // Add warn class if needed
  if (isWarn) {
    n.classList.add('warn');
  }

  // Show notification
  n.classList.add('show');

  // Progress bar animation
  if (withProgress) {
    progressEl.style.background = isWarn ? 'var(--warn)' : '';

    progressTimeout = setTimeout(() => {
      progressEl.style.transition = `width ${duration}ms linear`;
      progressEl.style.width = '100%';
    }, 20);
  }

  // Hide notification
  notifTimeout = setTimeout(() => {
    n.classList.remove('show', 'warn');

    progressEl.style.transition = 'none';
    progressEl.style.width = '0%';
    progressEl.style.background = '';
  }, duration);
}

// ══ CUSTOM SELECT COMPONENTS ══════════════════════════
window.selectPill = function(btn) {
  const targetId = btn.dataset.target;
  const value    = btn.dataset.value;

  document.getElementById(targetId).value = value;

  const group = btn.closest('.custom-pill-grid');
  group.querySelectorAll('.cpill').forEach(p => p.classList.remove('cpill-selected'));
  btn.classList.add('cpill-selected');

  document.getElementById(targetId).dispatchEvent(new Event('input',  { bubbles: true }));
  document.getElementById(targetId).dispatchEvent(new Event('change', { bubbles: true }));
};

window.toggleDropdown = function(dropdownId) {
  const wrapper = document.getElementById(dropdownId);
  const menu    = wrapper.querySelector('.cdd-menu');
  const isOpen  = menu.style.display !== 'none';

  document.querySelectorAll('.cdd-menu').forEach(m => m.style.display = 'none');
  document.querySelectorAll('.custom-dropdown').forEach(d => {
    d.classList.remove('cdd-open', 'cdd-up');
  });

  if (!isOpen) {
    menu.style.display = 'block';
    wrapper.classList.add('cdd-open');

    const rect       = menu.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    if (spaceBelow < 20 && spaceAbove > rect.height) {
      wrapper.classList.add('cdd-up');
    }
  }
};

window.selectDropdown = function(dropdownId, targetId, btn, label) {
  const value = btn.dataset.value;

  document.getElementById(targetId).value = value;
  document.getElementById(dropdownId).querySelector('.cdd-value').textContent = label;

  btn.closest('.cdd-menu').querySelectorAll('.cdd-option').forEach(o => o.classList.remove('cdd-selected'));
  btn.classList.add('cdd-selected');

  btn.closest('.cdd-menu').style.display = 'none';
  document.getElementById(dropdownId).classList.remove('cdd-open');

  document.getElementById(targetId).dispatchEvent(new Event('change', { bubbles: true }));
};

document.addEventListener('click', (e) => {
  if (!e.target.closest('.custom-dropdown')) {
    document.querySelectorAll('.cdd-menu').forEach(m => m.style.display = 'none');
    document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('cdd-open'));
  }
});

window.setCustomSelect = function(targetId, value) {
  const el = document.getElementById(targetId);
  if (!el) return;
  el.value = value;

  const pills = document.querySelectorAll(`.cpill[data-target="${targetId}"]`);
  if (pills.length > 0) {
    pills.forEach(p => p.classList.toggle('cpill-selected', p.dataset.value === value));
    return;
  }

  const hidden = document.getElementById(targetId);
  if (hidden) {
    const parent = hidden.closest('.custom-dropdown');
    if (parent) {
      const opt = parent.querySelector(`.cdd-option[data-value="${value}"]`);
      if (opt) {
        const label = opt.dataset.label || opt.textContent.trim();
        parent.querySelector('.cdd-value').textContent = label;
        parent.querySelectorAll('.cdd-option').forEach(o => o.classList.remove('cdd-selected'));
        opt.classList.add('cdd-selected');
      }
    }
  }
};

// ── HELPERS ──
function toCamelCase(str) {
  return str
    .replace(/[^a-zA-Z0-9-]/g, '')
    .replace(/-+([a-zA-Z0-9])/g, (_, c) => c.toUpperCase())
    .replace(/^[0-9]+/, '');
}

function validateRuleName(name) {
  return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name);
}

// ── LIVE STEP PILL UPDATE ──
document.addEventListener('DOMContentLoaded', () => {
  ['category','ruleName','message'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      const cat = document.getElementById('category').value;
      const nm  = document.getElementById('ruleName').value.trim();
      const msg = document.getElementById('message').value.trim();
      if (cat && nm && msg) updateStepPills(2);
      else updateStepPills(1);
    });
  });

  document.getElementById('ruleName').addEventListener('input', function() {
    const name = this.value.trim();
    this.classList.toggle('invalid', !validateRuleName(name) && name !== '');
  });

  // Advance to pill 3 when detection is configured
  document.getElementById('regexPattern').addEventListener('input', checkDetectionComplete);
  document.getElementById('astNodeType').addEventListener('input', checkDetectionComplete);

  // ── Register modals ──
  Popup.register('infoModal');
  Popup.register('confirmModal', {
    onClose: () => {
      const s1 = document.getElementById('confirmStep1');
      const s2 = document.getElementById('confirmStep2');
      if (s1) s1.style.display = 'block';
      if (s2) s2.style.display = 'none';
    },
  });
  document.getElementById('infoBtn').addEventListener('click', () => Popup.open('infoModal'));

  // ── Load data files ──
  Promise.all([
    fetch('data/pattern-library.json').then(r => r.json()),
    fetch('data/ast-nodes.json').then(r => r.json()),
  ])
  .then(([patterns, astNodes]) => {
    window.PATTERN_LIBRARY = patterns;
    window.AST_NODES       = astNodes;
    buildNodePicker();
    rebuildAstCheckDropdown(); // populate check dropdown for default lang (js-ts)
    buildPatternList();
  })
  .catch(err => console.error('[ScaleArch] Failed to load data:', err));

  // ── Load help modal ──
  fetch('modals/help-modal.html')
    .then(r => r.text())
    .then(html => {
      document.body.insertAdjacentHTML('beforeend', html);
      Popup.register('helpModal', {
        onOpen: () => {
          [0, 1, 2, '3b', 4].forEach(i => {
            const body   = document.getElementById('helpSectionBody' + i);
            const toggle = document.querySelector('#helpSection' + i + ' .help-section-toggle');
            if (!body) return;
            body.style.display = (i === 0) ? 'block' : 'none';
            toggle?.setAttribute('aria-expanded', String(i === 0));
          });
        },
      });
      const helpBtn = document.getElementById('helpBtn');
      if (helpBtn) helpBtn.addEventListener('click', () => Popup.open('helpModal'));
    })
    .catch(() => console.warn('[ScaleArch] help-modal.html not found'));

  // Theme toggle
  const themeToggle = document.getElementById('themeToggle');
  const savedTheme  = localStorage.getItem('theme') || 'dark';
  if (savedTheme === 'light') document.body.classList.add('light-mode');
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
  });

  // Init
  setType('regex');
  updateStepPills(1);
});

// ── HELP MODAL ACCORDION ──
window.toggleHelpSection = function(index) {
  const body    = document.getElementById('helpSectionBody' + index);
  const section = document.getElementById('helpSection' + index);
  if (!body) return;
  const toggle  = section?.querySelector('.help-section-toggle');
  const isOpen  = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  toggle?.setAttribute('aria-expanded', String(!isOpen));
};

function resetRuleForm() {
  
  // text inputs / textarea
  ['ruleName', 'message', 'hint'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  // hidden category reset
  document.getElementById('category').value = '';

  // remove selected category pills
  document.querySelectorAll('#categoryPills .cpill').forEach(btn => {
    btn.classList.remove('cpill-selected');
  });

  // reset step pill
  document.getElementById('pill-2')?.classList.remove('active');

  // severity reset
  document.querySelectorAll('.sev-btn').forEach(btn => {
    btn.classList.remove('selected');
  });
  document.querySelector('[data-sev="error"]')?.classList.add('selected');

  // success notif
  if (typeof showNotif === 'function') {
    showNotif('Rule Identity Form Reset',false,true,2000);
  }
}