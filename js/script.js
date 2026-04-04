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

// Called when AST language toggle changes — clears selection and rebuilds
window.rebuildNodePicker = function() {
  selectedNodes.clear();
  document.getElementById('astNodeType').value = '';
  state.nodeType = '';
  buildNodePicker();
};

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

  document.getElementById('message').value = p.message;
  document.getElementById('hint').value = p.hint;

  // Use setCustomSelect to sync both hidden input and pill/dropdown UI state
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

   const langValue = document.getElementById('ruleLanguage').value;
  const langMap = {
    'all':    null,   // no languages field — runs on everything
    'js-ts':  `['typescript', 'javascript', 'typescriptreact', 'javascriptreact']`,
    'python': `['python']`,
    'java':   `['java']`,
    'cpp':    `['cpp', 'c']`,
  };
  const languagesLine = langMap[langValue]
    ? `  languages: ${langMap[langValue]},\n`
    : '';

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
${languagesLine}${testFn}
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

// ── PYTHON AST CODE GEN ──
function generatePythonAst(cat, name, msg, hint, sev) {
  const rawNodeTypes = document.getElementById('astNodeType').value.trim() || 'FunctionDef';
  const nodeTypeList = rawNodeTypes.split('|').map(s => s.trim()).filter(Boolean);
  const fnName       = toCamelCase('checkPy-' + name);
  const id           = `${cat}/${name}`;

  const nodeTypesLiteral = nodeTypeList.map(t => `'${t}'`).join(', ');
  const nodeTypesComment = nodeTypeList.join(' | ');
  const guardLine = nodeTypeList.length === 1
    ? `  if (node._type !== '${nodeTypeList[0]}') return null;`
    : `  if (![${nodeTypesLiteral}].includes(node._type)) return null;`;

  const sevLabel = sev.replace('vscode.DiagnosticSeverity.', '');

  return `// ─── Rule: ${id} ───────────────────────────────────
// Category  : ${cat}
// Type      : Python AST — per-node check
// Nodes     : ${nodeTypesComment}
// Severity  : ${sevLabel}
// Generated : ScaleArch Rule Builder

function ${fnName}(
  node,     // current Python AST node (_type, lineno, col_offset etc.)
  cfg,      // VS Code workspace configuration (for reading thresholds)
  makeDiag  // helper: makeDiag(node, message, severity, code)
) {
  // Only process ${nodeTypesComment} nodes
${guardLine}

  // ── Your check goes here ──────────────────────────
  // Examples:
  //   node.name          → function/class name string
  //   node.body          → list of child statement nodes
  //   node.args.args     → list of parameter nodes
  //   node.lineno        → start line (1-based)
  //   node.end_lineno    → end line (1-based)

  // TODO: replace this condition with your actual check
  const shouldFlag = false;
  if (!shouldFlag) return null;

  return makeDiag(
    node,
    '${msg.replace(/'/g, "\'")}',
    ${sev},
    '${id}'
  );
}

// ─── Register it ───────────────────────────────────
// Add to CUSTOM_PYTHON_AST_RULES in customRules.ts:
// export const CUSTOM_PYTHON_AST_RULES: PythonRuleCheck[] = [
//   ...existing,
//   ${fnName},   // ← add this
// ];
//
// Tip: run python3 -c "import ast; print(ast.dump(ast.parse('your code')))"
// to see exact node shapes for your Python code.`;
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

// ── COPY — goes through confirmation modal ──
function copyCode() {
  if (!state.generated) return;
  openConfirmModal();
}

// ── CONFIRMATION MODAL ──────────────────────────────
// Reusable. Call openConfirmModal(onYes, onNo) with optional
// callbacks. Defaults: yes = copy code, no = show verify step.

let _confirmOnYes = null;
let _confirmOnNo  = null;

function openConfirmModal(onYes, onNo) {
  _confirmOnYes = onYes || null;
  _confirmOnNo  = onNo  || null;

  // Reset to step 1
  const s1 = document.getElementById('confirmStep1');
  const s2 = document.getElementById('confirmStep2');
  if (!s1 || !s2) {
    console.error('[ScaleArch] confirmModal steps not found — is confirmModal HTML in index.html?');
    return;
  }
  s1.style.display = 'block';
  s2.style.display = 'none';

  // Quality gate — warn if hint/message are weak
  const hint    = document.getElementById('hint').value.trim();
  const message = document.getElementById('message').value.trim();
  const qEl     = document.getElementById('confirmQualityCheck');
  const issues  = [];
  if (!hint || hint.length < 20)    issues.push(`⚠️ Your <b>hint</b> is empty or very short — developers won't know how to fix the issue.`);
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

function closeConfirmModal() {
  Popup.close('confirmModal');
}

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
// ────────────────────────────────────────────────────

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


// ══ CUSTOM SELECT COMPONENTS ══════════════════════════
// Replaces native <select> elements for consistent cross-platform UI.
// All three components (category, language, context) write their
// value to a hidden <input> so the rest of the code reads them
// identically to before via document.getElementById('...').value

// ── Pill grid (category + language) ──
// selectPill(btn) — called by onclick on each pill button
window.selectPill = function(btn) {
  const targetId = btn.dataset.target;
  const value    = btn.dataset.value;

  // Update hidden input
  document.getElementById(targetId).value = value;

  // Update selected state within same group
  const group = btn.closest('.custom-pill-grid');
  group.querySelectorAll('.cpill').forEach(p => p.classList.remove('cpill-selected'));
  btn.classList.add('cpill-selected');

  // Fire input event so existing listeners (step pills, category sync) still work
  document.getElementById(targetId).dispatchEvent(new Event('input', { bubbles: true }));
  document.getElementById(targetId).dispatchEvent(new Event('change', { bubbles: true }));
};

// ── Custom dropdown (context type) ──
window.toggleDropdown = function(dropdownId) {
  const wrapper = document.getElementById(dropdownId);
  const menu    = wrapper.querySelector('.cdd-menu');
  const isOpen  = menu.style.display !== 'none';

  // Close all other open dropdowns first
  document.querySelectorAll('.cdd-menu').forEach(m => m.style.display = 'none');
  document.querySelectorAll('.custom-dropdown').forEach(d => {
    d.classList.remove('cdd-open', 'cdd-up');
  });

  if (!isOpen) {
    menu.style.display = 'block';
    wrapper.classList.add('cdd-open');

    // Detect if menu overflows viewport below → open upward instead
    const rect    = menu.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    if (spaceBelow < 20 && spaceAbove > rect.height) {
      wrapper.classList.add('cdd-up');
    }
  }
};

window.selectDropdown = function(dropdownId, targetId, btn, label) {
  const value = btn.dataset.value;

  // Update hidden input
  document.getElementById(targetId).value = value;

  // Update trigger label
  document.getElementById(dropdownId).querySelector('.cdd-value').textContent = label;

  // Update selected state in menu
  btn.closest('.cdd-menu').querySelectorAll('.cdd-option').forEach(o => o.classList.remove('cdd-selected'));
  btn.classList.add('cdd-selected');

  // Close menu
  btn.closest('.cdd-menu').style.display = 'none';
  document.getElementById(dropdownId).classList.remove('cdd-open');

  // Fire change event so contextType listener fires (shows/hides multiline fields)
  document.getElementById(targetId).dispatchEvent(new Event('change', { bubbles: true }));
};

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.custom-dropdown')) {
    document.querySelectorAll('.cdd-menu').forEach(m => m.style.display = 'none');
    document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('cdd-open'));
  }
});

// Programmatic setter — used by usePattern() to sync pill/dropdown state
// when a pattern is applied from the library
window.setCustomSelect = function(targetId, value) {
  const el = document.getElementById(targetId);
  if (!el) return;
  el.value = value;

  // Sync pill grid if present
  const pills = document.querySelectorAll(`.cpill[data-target="${targetId}"]`);
  if (pills.length > 0) {
    pills.forEach(p => p.classList.toggle('cpill-selected', p.dataset.value === value));
    return;
  }

  // Sync custom dropdown if present
  const dd = document.querySelector(`.custom-dropdown:has(#${targetId})`);
  if (!dd) {
    // fallback: find dropdown wrapping hidden input
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
  }
};
// ══════════════════════════════════════════════════════
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

  // ── Load data files — critical, must succeed ──
  Promise.all([
    fetch('data/pattern-library.json').then(r => r.json()),
    fetch('data/ast-nodes.json').then(r => r.json()),
  ])
  .then(([patterns, astNodes]) => {
    window.PATTERN_LIBRARY = patterns;
    window.AST_NODES       = astNodes;
    buildNodePicker();
    buildPatternList();
  })
  .catch(err => console.error('[ScaleArch] Failed to load data:', err));

  // ── Load help modal — optional, failure does not block UI ──
  fetch('modals/help-modal.html')
    .then(r => r.text())
    .then(html => {
      document.body.insertAdjacentHTML('beforeend', html);
      Popup.register('helpModal', {
        onOpen: () => {
          // All section IDs — numeric + string for Python AST section
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
    .catch(() => console.warn('[ScaleArch] help-modal.html not found — help button disabled'));

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
  updateStepPills(1);
});

// ── HELP MODAL ACCORDION ──
// On window so onclick="toggleHelpSection()" in the
// dynamically-fetched modal HTML can resolve it.
window.toggleHelpSection = function(index) {
  const body    = document.getElementById('helpSectionBody' + index);
  const section = document.getElementById('helpSection' + index);
  if (!body) return;
  const toggle  = section?.querySelector('.help-section-toggle');
  const isOpen  = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  toggle?.setAttribute('aria-expanded', String(!isOpen));
};