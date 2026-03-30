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


// ══════════════════════════════════════════════════════
//  AST NODE DEFINITIONS
//  Each entry: id, label, description, example code, useful props
// ══════════════════════════════════════════════════════
const AST_NODES = [
  {
    id: 'FunctionDeclaration',
    desc: 'A named function defined with the function keyword at the statement level.',
    example: 'function greet(name) {\n  return "Hello " + name;\n}',
    props: ['node.id.name (fn name)', 'node.params (param list)', 'node.body (block)', 'node.async', 'node.loc (line numbers)'],
  },
  {
    id: 'ArrowFunctionExpression',
    desc: 'An arrow function assigned to a variable or passed as a callback. Has no own "this".',
    example: 'const greet = (name) => {\n  return "Hello " + name;\n};\n\nconst add = (a, b) => a + b;',
    props: ['node.params', 'node.body', 'node.async', 'node.expression (true if body is not a block)'],
  },
  {
    id: 'FunctionExpression',
    desc: 'A function assigned to a variable or used as a value (not a declaration).',
    example: 'const greet = function(name) {\n  return "Hello " + name;\n};',
    props: ['node.id.name (optional name)', 'node.params', 'node.body', 'node.async'],
  },
  {
    id: 'ClassDeclaration',
    desc: 'A class defined at the statement level with a name.',
    example: 'class OrderService {\n  constructor(repo) {\n    this.repo = repo;\n  }\n  getOrder(id) { ... }\n}',
    props: ['node.id.name (class name)', 'node.body.body (method list)', 'node.superClass'],
  },
  {
    id: 'MethodDefinition',
    desc: 'A method inside a class body — including constructor, getters, setters, and regular methods.',
    example: 'class Foo {\n  myMethod() { ... }  // ← MethodDefinition\n  get value() { ... } // ← MethodDefinition (kind: "get")\n}',
    props: ['node.key.name (method name)', 'node.kind ("constructor"|"method"|"get"|"set")', 'node.static', 'node.value (the function)'],
  },
  {
    id: 'CatchClause',
    desc: 'The catch block of a try/catch statement. Useful for detecting empty or silent catches.',
    example: 'try {\n  riskyOp();\n} catch (e) {     // ← CatchClause\n  // empty — bad!\n}',
    props: ['node.param (the error variable, e.g. e)', 'node.body.body (statements inside catch)'],
  },
  {
    id: 'CallExpression',
    desc: 'Any function or method call — e.g. fetch(), console.log(), obj.method(). Most common for banning specific API calls.',
    example: 'fetch("/api/users")       // ← CallExpression\nconsole.log("debug")      // ← CallExpression\nobj.dangerousMethod()     // ← CallExpression',
    props: ['node.callee.name (fn name, e.g. "fetch")', 'node.callee.property.name (method name)', 'node.arguments (arg list)'],
  },
  {
    id: 'NewExpression',
    desc: 'A constructor call using the new keyword.',
    example: 'const repo = new OrderRepository();\nconst d    = new Date();',
    props: ['node.callee.name (class name)', 'node.arguments'],
  },
  {
    id: 'Literal',
    desc: 'Any literal value in the source — string, number, boolean, null, or regex. Good for detecting magic numbers or repeated strings.',
    example: 'const x = 42;           // Literal (number)\nconst s = "hello";      // Literal (string)\nconst b = true;         // Literal (boolean)',
    props: ['node.value (the actual value)', 'node.raw (the raw source text)', 'typeof node.value for type check'],
  },
  {
    id: 'BlockStatement',
    desc: 'Any block of code wrapped in curly braces — function bodies, if/else bodies, loop bodies.',
    example: 'if (condition) {\n  doThing(); // ← inside a BlockStatement\n}',
    props: ['node.body (array of statements inside)', 'node.body.length (count statements)'],
  },
  {
    id: 'IfStatement',
    desc: 'An if/else conditional statement. Useful for complexity checks.',
    example: 'if (a > 0) {\n  ...\n} else if (b > 0) {\n  ...\n}',
    props: ['node.test (the condition)', 'node.consequent (if body)', 'node.alternate (else body, or null)'],
  },
  {
    id: 'ImportDeclaration',
    desc: 'An ES module import statement. Use to count imports or detect banned dependencies.',
    example: 'import React from "react";\nimport { db } from "@company/db";',
    props: ['node.source.value (the module path, e.g. "@company/db")', 'node.specifiers (what is imported)'],
  },
  {
    id: 'VariableDeclaration',
    desc: 'A variable declaration using let, const, or var.',
    example: 'const x = 10;     // VariableDeclaration (kind: "const")\nlet name = "foo"; // VariableDeclaration (kind: "let")',
    props: ['node.kind ("const"|"let"|"var")', 'node.declarations (array of declarators)'],
  },
];

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


// ══════════════════════════════════════════════════════
//  PATTERN LIBRARY
// ══════════════════════════════════════════════════════
const PATTERN_LIBRARY = [

  // ── DATABASE ──
  {
    name: 'SELECT *',
    category: 'database',
    pattern: 'select\\s+\\*',
    message: 'Avoid SELECT * — fetch only the columns you need',
    hint: 'SELECT * fetches all columns including unused ones, wastes bandwidth and prevents index-only scans.',
    context: 'none',
  },
  {
    name: 'SELECT without WHERE',
    category: 'database',
    pattern: 'select\\s+[\\w\\s,*]+from\\s+\\w+\\s*[`;]',
    message: 'SELECT without WHERE — possible full table scan',
    hint: 'Without a WHERE clause every row is scanned. Add a filter or ensure this is intentional.',
    context: 'none',
  },
  {
    name: 'No LIMIT clause',
    category: 'database',
    pattern: '\\bselect\\b(?!.*\\blimit\\b)(?!.*count\\s*\\()',
    message: 'No LIMIT clause — risk of fetching a huge result set',
    hint: 'Always paginate results. Add LIMIT (and OFFSET) to control how many rows are returned.',
    context: 'none',
  },
  {
    name: 'Leading wildcard LIKE',
    category: 'database',
    pattern: 'like\\s+[\x27\x22%]%',
    message: "Leading wildcard LIKE '%...' disables index usage",
    hint: "A leading % forces a full scan. Use full-text search or a search engine for this pattern.",
    context: 'none',
  },
  {
    name: 'Subquery inside IN clause',
    category: 'database',
    pattern: '\\bIN\\s*\\(\\s*SELECT\\b',
    message: 'Subquery inside IN() — consider EXISTS or a JOIN instead',
    hint: 'IN (SELECT ...) is often slower than EXISTS() or a JOIN, especially on large datasets. The optimizer may execute the subquery once per row.',
    context: 'none',
  },
  {
    name: 'SQL query in a loop (N+1)',
    category: 'database',
    pattern: '\\bselect\\b',
    message: 'SQL query inside a loop — classic N+1 problem',
    hint: 'Each iteration fires a separate DB round-trip. Use a JOIN, batch query (WHERE id IN (...)), or a dataloader instead.',
    context: 'loop',
  },
  {
    name: 'DELETE without WHERE',
    category: 'database',
    pattern: '\\bDELETE\\s+FROM\\s+\\w+\\s*[`;]',
    message: 'DELETE without WHERE — this will wipe the entire table',
    hint: 'A DELETE without a WHERE clause deletes every row. Always add a WHERE clause unless you explicitly want to truncate.',
    context: 'none',
  },
  {
    name: 'UPDATE without WHERE',
    category: 'database',
    pattern: '\\bUPDATE\\s+\\w+\\s+SET\\b(?!.*\\bWHERE\\b)',
    message: 'UPDATE without WHERE — will update every row in the table',
    hint: 'A WHERE clause is almost always required on UPDATE. Double-check this is intentional.',
    context: 'none',
  },

  // ── SECURITY ──
  {
    name: 'Hardcoded API key or secret',
    category: 'security',
    pattern: '(password|secret|api_key|apikey|token|auth)\\s*[:=]\\s*[\x27\x22][^\x27\x22]{6,}',
    message: 'Possible hardcoded secret detected',
    hint: 'Move secrets to environment variables or a secrets manager (AWS SSM, HashiCorp Vault).',
    context: 'none',
  },
  {
    name: 'eval() usage',
    category: 'security',
    pattern: '\\beval\\s*\\(',
    message: 'eval() is a security risk — avoid it',
    hint: 'eval() executes arbitrary code and can be exploited via injection. Use JSON.parse() for data or restructure the logic.',
    context: 'none',
  },
  {
    name: 'Hardcoded IP address',
    category: 'security',
    pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b',
    message: 'Hardcoded IP address detected',
    hint: 'Hardcoded IPs make deployments fragile and may expose internal infrastructure. Use environment variables or service discovery.',
    context: 'none',
  },
  {
    name: 'MD5 hashing (weak)',
    category: 'security',
    pattern: '\\bmd5\\s*\\(',
    message: 'MD5 is cryptographically broken — use SHA-256 or bcrypt',
    hint: 'MD5 collisions are trivial to generate. Use crypto.subtle.digest("SHA-256", ...) for hashing or bcrypt for passwords.',
    context: 'none',
  },
  {
    name: 'console.log with sensitive words',
    category: 'security',
    pattern: '(password|secret|api_key|apikey|token|auth)\\s*[:=]\\s*[\x27\x22][^\x27\x22]{6,}',
    message: 'Logging potentially sensitive data',
    hint: 'Logging secrets or credentials can expose them in log aggregators. Redact sensitive fields before logging.',
    context: 'none',
  },
  {
    name: 'SQL string concatenation (injection risk)',
    category: 'security',
    pattern: '(SELECT|INSERT|UPDATE|DELETE).*\\+\\s*(\\w+|[\x27\x22])',
    message: 'SQL built with string concatenation — injection risk',
    hint: 'Building SQL with + opens the door to SQL injection. Use parameterised queries or a query builder with bound parameters.',
    context: 'none',
  },

  // ── PERFORMANCE ──
  {
    name: 'Synchronous fs call',
    category: 'performance',
    pattern: '\\bfs\\.(readFileSync|writeFileSync|existsSync|readdirSync|mkdirSync)\\b',
    message: 'Synchronous fs call blocks the event loop',
    hint: 'Use the async version: readFileSync → readFile, writeFileSync → writeFile. Sync calls block all other requests.',
    context: 'none',
  },
  {
    name: 'JSON.parse in a loop',
    category: 'performance',
    pattern: 'JSON\\.parse\\s*\\(',
    message: 'JSON.parse() inside a loop — expensive repeated parsing',
    hint: 'Parse once outside the loop and reuse the result.',
    context: 'loop',
  },
  {
    name: 'setTimeout with 0ms',
    category: 'performance',
    pattern: 'setTimeout\\s*\\(.*,\\s*0\\s*\\)',
    message: 'setTimeout(fn, 0) is unreliable — use queueMicrotask()',
    hint: '0ms delay is not guaranteed to be immediate and adds scheduler overhead. Use queueMicrotask() for microtask scheduling.',
    context: 'none',
  },
  {
    name: 'new object inside loop',
    category: 'performance',
    pattern: '(new\\s+\\w+\\(|\\[\\s*\\]|\\{\\s*\\})',
    message: 'Object/array created inside a loop — GC pressure',
    hint: 'Allocate outside the loop and reuse or clear per iteration to reduce garbage collection overhead.',
    context: 'loop',
  },
  {
    name: 'await inside loop (serial)',
    category: 'performance',
    pattern: '\\bawait\\b',
    message: 'await inside a loop runs promises serially — use Promise.all()',
    hint: 'Each await blocks the next iteration. Collect promises in an array and resolve with Promise.all([...]) for parallel execution.',
    context: 'loop',
  },
  {
    name: 'console.log left in code',
    category: 'performance',
    pattern: 'console\\.(log|warn|info)\\s*\\(',
    message: 'console.log() left in code — remove before production',
    hint: 'Use a proper logger (winston, pino) that can be disabled in production via log level.',
    context: 'none',
  },

  // ── CODE QUALITY ──
  {
    name: 'TODO / FIXME comment',
    category: 'code-quality',
    pattern: '\\b(TODO|FIXME|HACK|XXX)\\b',
    message: 'TODO/FIXME comment left in code',
    hint: 'Track outstanding work in your issue tracker, not in code comments. TODOs in code often get forgotten.',
    context: 'none',
  },
  {
    name: 'Debugger statement',
    category: 'code-quality',
    pattern: '\\bdebugger\\b',
    message: 'debugger statement left in code',
    hint: 'Remove debugger statements before committing. They pause execution in any browser with DevTools open.',
    context: 'none',
  },
  {
    name: 'var declaration',
    category: 'code-quality',
    pattern: '\\bvar\\s+',
    message: 'Avoid var — use const or let instead',
    hint: 'var is function-scoped and hoisted, leading to subtle bugs. Use const by default and let when reassignment is needed.',
    context: 'none',
  },
  {
    name: 'Double equals (==)',
    category: 'code-quality',
    pattern: '(?<!=)={2}(?!=)',
    message: 'Loose equality (==) — use strict equality (===) instead',
    hint: '== performs type coercion which leads to unexpected results (e.g. 0 == "" is true). Always use === for comparisons.',
    context: 'none',
  },
  {
    name: 'Magic number',
    category: 'code-quality',
    pattern: '(?<![a-zA-Z0-9_.])(?!0\b|1\b|-1\b)\d{2,}(?![a-zA-Z0-9_])',
    message: 'Magic number detected — extract to a named constant',
    hint: 'Numbers with no explanation make code hard to understand. Extract to: const MAX_RETRIES = 5 and reference the constant.',
    context: 'none',
  },
  {
    name: 'Raw fetch() call',
    category: 'code-quality',
    pattern: '\\bfetch\\s*\\(',
    message: 'Raw fetch() — use your internal HttpClient wrapper instead',
    hint: 'Direct fetch() calls bypass auth token injection, retry logic, and error logging. Use the shared HttpClient from your core library.',
    context: 'none',
  },
];

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

  // Scroll to the pattern field
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
  document.getElementById('aiPrompt').addEventListener('keydown', e => {
    if (e.key === 'Enter') generateRegexWithAI();
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
  renderCode(syntaxHighlight(code));
  updateInstructions();
  updateStepPills(3);
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('codeWrap').style.display = 'block';
  document.getElementById('codeWrap').scrollIntoView({ behavior: 'smooth' });
}

// ── REGEX CODE GEN ──
function generateRegex(cat, name, msg, hint, sev) {
  const pattern = document.getElementById('regexPattern').value.trim() || 'YOUR_PATTERN_HERE';
  const context = document.getElementById('contextType').value;
  const id      = `${cat}/${name}`;

  let testFn = '';
  if (context === 'none') {
    testFn = `  test: (line) => /${pattern}/i.test(line),`;
  } else {
    const ctxPattern = {
      loop:  '\\\\b(for|while|forEach|map|reduce)\\\\b',
      async: '\\\\basync\\\\b',
      class: '\\\\bclass\\\\b',
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
function showNotif(msg, isWarn) {
  const n = document.getElementById('notif');
  n.textContent = msg;
  n.style.borderColor = isWarn ? 'var(--warn)' : 'var(--accent3)';
  n.style.color       = isWarn ? 'var(--warn)' : 'var(--accent3)';
  n.classList.add('show');
  setTimeout(() => n.classList.remove('show'), 2500);
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

  // Init
  setType('regex');
});