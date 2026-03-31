// ══════════════════════════════════════════════════════
//  ScaleArch Rule Builder — script.js
// ══════════════════════════════════════════════════════

// ── STATE ──
let state = {
  severity: 'error',
  type: 'regex',
  nodeType: '',
  generated: '',
};


// ── BUILD NODE PICKER ──
function buildNodePicker() {
  const picker = document.getElementById('nodePicker');
  picker.innerHTML = AST_NODES.map(n => `
    <div class="node-pill" id="pill-${n.id}">
      <span class="node-pill-label" onclick="toggleNodeType('${n.id}')">${n.id}</span>
      <span class="node-pill-info" onclick="showNodeInfo('${n.id}')" title="Details">ⓘ</span>
    </div>
  `).join('');
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
  updateStepPills(2);
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
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('astCheck').addEventListener('change', function() {
    const v = this.value;
    const showThreshold = ['param-count','method-count','line-count'].includes(v);
    const showCallee    = ['callee-name','declared-name','method-name'].includes(v);

    const tf = document.getElementById('thresholdField');
    const cf = document.getElementById('calleeField');
    tf.style.display = showThreshold ? 'flex' : 'none';
    cf.style.display = showCallee    ? 'flex' : 'none';
    tf.style.flexDirection = 'column'; tf.style.gap = '8px';
    cf.style.flexDirection = 'column'; cf.style.gap = '8px';

    const labelEl = document.getElementById('calleeLabel');
    const inputEl = document.getElementById('astCallee');
    if (v === 'callee-name') {
      labelEl.textContent  = 'Function name being called';
      inputEl.placeholder  = 'e.g. fetch, eval, require';
    } else if (v === 'declared-name') {
      labelEl.textContent  = 'Function name being declared';
      inputEl.placeholder  = 'e.g. oldProv, legacyHelper';
    } else if (v === 'method-name') {
      labelEl.textContent  = 'Method name inside class';
      inputEl.placeholder  = 'e.g. oldMethod, deprecatedFn';
    }
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

  list.innerHTML = filtered.map((p, i) => `
    <div class="pat-item" onclick="usePattern(${PATTERN_LIBRARY.indexOf(p)})">
      <span class="pat-item-name">${p.name}</span>
      <span class="pat-item-cat ${p.category}">${p.category}</span>
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

  // Fill in pattern and context
  document.getElementById('regexPattern').value = p.pattern;
  document.getElementById('contextType').value  = p.context;

  // Show/hide multiline fields and fill them if the pattern uses multiline mode
  const isMulti = p.context && p.context.startsWith('multiline');
  const mf = document.getElementById('multilineFields');
  mf.style.display = isMulti ? 'flex' : 'none';

  if (isMulti) {
    if (p.multilineAnchor)    document.getElementById('multilineAnchor').value    = p.multilineAnchor;
    if (p.multilineCount)     document.getElementById('multilineCount').value      = p.multilineCount;
    if (p.multilineThreshold) document.getElementById('multilineThreshold').value  = p.multilineThreshold;
  }

  // Pre-fill message and hint if empty
  if (!document.getElementById('message').value.trim()) {
    document.getElementById('message').value = p.message;
  }
  if (!document.getElementById('hint').value.trim()) {
    document.getElementById('hint').value = p.hint;
  }

  // Auto-set category if not already set
  if (!document.getElementById('category').value) {
    document.getElementById('category').value = p.category;
  }

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

  // Show/hide multiline fields when context changes
  document.getElementById('contextType').addEventListener('change', function() {
    const isMulti = this.value.startsWith('multiline');
    const mf = document.getElementById('multilineFields');
    mf.style.display = isMulti ? 'flex' : 'none';

    // Pre-fill sensible defaults based on which multiline mode
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

  // Show loading state
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

  // Simulate processing time for better UX
  setTimeout(() => {
    const sev = state.severity;
    const sevMap = {
      error:   'vscode.DiagnosticSeverity.Error',
      warning: 'vscode.DiagnosticSeverity.Warning',
      info:    'vscode.DiagnosticSeverity.Information',
      hint:    'vscode.DiagnosticSeverity.Hint',
    };

    const code = state.type === 'regex'
      ? generateRegex(category, ruleName, message, hint, sevMap[sev])
      : generateAst(category, ruleName, message, hint, sevMap[sev]);

    state.generated = code;
    document.getElementById('verifyBtn').disabled = false;
    renderCode(syntaxHighlight(code));
    updateInstructions();
    updateStepPills(3);
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('codeWrap').style.display = 'block';
    document.getElementById('codeWrap').scrollIntoView({ behavior: 'smooth' });

    // Reset button
    btn.innerHTML = originalText;
    btn.disabled = false;
    btn.style.opacity = '1';

    // Success animation
    btn.style.transform = 'scale(1.05)';
    setTimeout(() => btn.style.transform = '', 200);
  }, 800);
}

// ── REGEX CODE GEN ──
function generateRegex(cat, name, msg, hint, sev) {
  const pattern   = document.getElementById('regexPattern').value.trim() || 'YOUR_PATTERN_HERE';
  const context   = document.getElementById('contextType').value;
  const anchor    = document.getElementById('multilineAnchor')?.value.trim() || 'SELECT';
  const countKw   = document.getElementById('multilineCount')?.value.trim()  || 'JOIN';
  const threshold = parseInt(document.getElementById('multilineThreshold')?.value) || 5;
  const id        = `${cat}/${name}`;

  let testFn = '';

  if (context === 'none') {
    // ── Simple single-line match ──
    testFn = `  test: (line) => /${pattern}/i.test(line),`;

  } else if (context === 'multiline-keyword') {
    // ── Multi-line: anchor on keyword, count target keyword in next 25 lines ──
    testFn =
`  test: (line, allLines, lineIndex) => {
    // Only trigger on lines containing the anchor keyword
    if (!/${anchor}/i.test(line)) return false;
    // Scan the next 25 lines as one string to catch multi-line queries
    const window = allLines.slice(lineIndex, lineIndex + 25).join(' ');
    const count  = (window.match(/${countKw}/gi) ?? []).length;
    return count > ${threshold};
  },`;

  } else if (context === 'multiline-count') {
    // ── Multi-line: count pattern occurrences across next 25 lines ──
    testFn =
`  test: (line, allLines, lineIndex) => {
    if (!/${anchor}/i.test(line)) return false;
    const window = allLines.slice(lineIndex, lineIndex + 25).join(' ');
    const count  = (window.match(/${pattern}/gi) ?? []).length;
    return count > ${threshold};
  },`;

  } else {
    // ── Single-line with look-back context (loop / async / class) ──
    const ctxPattern = {
      loop:  '\\b(for|while|forEach|map|reduce)\\b',
      async: '\\basync\\b',
      class: '\\bclass\\b',
    }[context];
    testFn =
`  test: (line, allLines, lineIndex) => {
    if (!/${pattern}/i.test(line)) return false;
    for (let i = Math.max(0, lineIndex - 5); i < lineIndex; i++) {
      if (/${ctxPattern}/.test(allLines[i])) return true;
    }
    return false;
  },`;
  }
  return `// ─── Rule: ${id} ───────────────────────────────────
// Category : ${cat}
// Severity : ${sev.replace('vscode.DiagnosticSeverity.', '')}
// Generated: ScaleArch Rule Builder

{
  id: '${id}',
  category: '${cat}',
  severity: ${sev},
  message: '${msg.replace(/'/g, "\\'")}',
  hint: '${(hint || msg).replace(/'/g, "\\'")}',
${testFn}
},`;
}

// ── AST CODE GEN ──
function generateAst(cat, name, msg, hint, sev) {
  const rawNodeTypes  = document.getElementById('astNodeType').value.trim() || 'FunctionDeclaration';
  const nodeTypeList  = rawNodeTypes.split('|').map(s => s.trim()).filter(Boolean);
  const checkType     = document.getElementById('astCheck').value;
  const threshold     = parseInt(document.getElementById('astThreshold').value) || 5;
  const callee        = document.getElementById('astCallee').value.trim() || 'targetFunction';
  const fnName        = toCamelCase('check-' + name);
  const id            = `${cat}/${name}`;

  const checkMap = {
    'empty-body':
`  const stmts = node.body?.body ?? node.body?.statements ?? [];
  if (stmts.length > 0) return null;`,
    'param-count':
`  const params = node.params ?? [];
  if (params.length <= ${threshold}) return null;`,
    'method-count':
`  const methods = (node.body?.body ?? []).filter(
    (m) => m.type === 'MethodDefinition' && m.kind !== 'constructor'
  );
  if (methods.length <= ${threshold}) return null;`,
    'line-count':
`  if (!node.loc) return null;
  const lines = node.loc.end.line - node.loc.start.line + 1;
  if (lines <= ${threshold}) return null;`,
    'callee-name':
`  const calleeName = node.callee?.name ?? node.callee?.property?.name ?? '';
  if (calleeName !== '${callee}') return null;`,
    'declared-name':
`  const declaredName = node.id?.name ?? '';
  if (declaredName !== '${callee}') return null;`,
    'method-name':
`  const methodName = node.key?.name ?? '';
  if (methodName !== '${callee}') return null;`,
    'custom-prop':
`  // TODO: add your custom property check here
  // Example: if (!node.async) return null;`,
  };

  const nodeTypesLiteral = nodeTypeList.map(t => `'${t}'`).join(', ');
  const nodeTypesComment = nodeTypeList.join(' | ');
  const guardLine = nodeTypeList.length === 1
    ? `  if (node.type !== '${nodeTypeList[0]}') return null;`
    : `  if (![${nodeTypesLiteral}].includes(node.type)) return null;`;

  return `// ─── Rule: ${id} ───────────────────────────────────
// Category : ${cat}
// Type     : AST — per-node check
// Nodes    : ${nodeTypesComment}
// Generated: ScaleArch Rule Builder

export function ${fnName}(node: any): RuleResult | null {
  // Only process ${nodeTypesComment} nodes
${guardLine}

${checkMap[checkType]}

  const s = node.loc?.start ?? { line: 0, column: 0 };
  const e = node.loc?.end   ?? { line: 0, column: 0 };
  const range = new vscode.Range(s.line - 1, s.column, e.line - 1, e.column);

  return {
    range,
    code: '${id}',
    message: '${msg.replace(/'/g, "\\'")}',
    hint: '${(hint || msg).replace(/'/g, "\\'")}',
    severity: ${sev},
  };
}

// ─── Register it ───────────────────────────────────
// Add to CUSTOM_AST_CHECKS array in customRules.ts:
// export const CUSTOM_AST_CHECKS = [
//   ...existing,
//   ${fnName},   // ← add this
// ];`;
}

// ── SYNTAX HIGHLIGHT ──
function syntaxHighlight(code) {
  return code
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/(\/\/[^\n]*)/g, '<span class="tok-comment">$1</span>')
    .replace(/\b(export|function|const|let|return|if|for|null|true|false|new)\b/g, '<span class="tok-keyword">$1</span>')
    .replace(/\b(RuleResult|vscode|DiagnosticSeverity)\b/g, '<span class="tok-type">$1</span>')
    .replace(/'([^']*)'/g, '<span class="tok-string">\'$1\'</span>')
    .replace(/\b(\d+)\b(?![^<]*>)/g, '<span class="tok-num">$1</span>');
}

function renderCode(html) {
  document.getElementById('codeOutput').innerHTML = html;
}

// ── COPY ──
function copyCode() {
  if (!state.generated) return;
  navigator.clipboard.writeText(state.generated).then(() => {
    const btn = document.getElementById('copyBtn');
    btn.textContent = '✓ Copied!';
    btn.classList.add('copied');
    showNotif('✓ Rule code copied to clipboard');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
  });
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

  if (isAst) {
    document.getElementById('instrStep2Title').textContent = 'Paste the function into customRules.ts';
    document.getElementById('instrStep2Body').innerHTML =
      'Find <span class="inline-code">// Section 2</span> in <span class="inline-code">customRules.ts</span> and paste the generated function above the export array.';
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

// ── NOTIFICATION ──
function showNotif(msg, isWarn, withProgress = false, duration = 3000) {
  const n = document.getElementById('notif');
  const textEl = document.getElementById('notif-text');
  const progressEl = document.getElementById('notif-progress');
  
  textEl.textContent = msg;
  n.className = 'notif' + (isWarn ? ' warn' : '');
  n.classList.add('show');
  
  if (withProgress) {
    progressEl.style.width = '0%';
    progressEl.style.transition = `width ${duration}ms linear`;
    setTimeout(() => {
      progressEl.style.width = '100%';
    }, 10); // small delay to trigger transition
  } else {
    progressEl.style.width = '0%';
  }
  
  setTimeout(() => {
    n.classList.remove('show');
  }, duration);
}

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

  // Rule name validation
  document.getElementById('ruleName').addEventListener('input', function() {
    const name = this.value.trim();
    this.classList.toggle('invalid', !validateRuleName(name) && name !== '');
  });

  // Modal
  document.getElementById('infoBtn').addEventListener('click', () => {
    document.getElementById('infoModal').style.display = 'block';
  });
  document.querySelector('.close').addEventListener('click', () => {
    document.getElementById('infoModal').style.display = 'none';
  });
  window.addEventListener('click', (event) => {
    if (event.target === document.getElementById('infoModal')) {
      document.getElementById('infoModal').style.display = 'none';
    }
  });

  // Build AST node picker and pattern library
  buildNodePicker();
  buildPatternList();

  // Theme toggle
  const themeToggle = document.getElementById('themeToggle');
  const savedTheme = localStorage.getItem('theme') || 'dark';
  
  if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
  }
  
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
  });

  // Init
  setType('regex');
});