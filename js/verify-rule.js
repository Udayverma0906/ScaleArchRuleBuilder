function openVerification() {
  if (!state.generated) return;
  const astLang = document.getElementById('astLanguage')?.value || 'js-ts';
  const prompt = state.type === 'regex'
    ? generateVerificationPrompt()
    : astLang === 'python'
      ? generatePythonAstVerificationPrompt()
      : generateVerificationPrompt();

  // Copy prompt to clipboard then open Claude
  navigator.clipboard.writeText(prompt).then(() => {
    let countdown = 3;
    const baseMessage = '✓ Prompt copied. Opening Claude — paste it there to verify your code.';

    showNotif(`${baseMessage} ${countdown}`, false, true, 3000);

    const interval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        document.getElementById('notif-text').textContent = `${baseMessage} ${countdown}`;
      } else {
        clearInterval(interval);
        window.open('https://claude.ai/new', '_blank');
      }
    }, 1000);
  });
}

// ── GENERATE VERIFICATION PROMPT (router) ──
function generateVerificationPrompt() {
  const category = document.getElementById('category').value;
  const ruleName = document.getElementById('ruleName').value.trim();
  const message  = document.getElementById('message').value.trim();
  const hint     = document.getElementById('hint').value.trim();
  const sev      = state.severity;

  if (state.type === 'regex') {
    return generateRegexVerificationPrompt(category, ruleName, message, hint, sev);
  } else {
    return generateAstVerificationPrompt(category, ruleName, message, hint, sev);
  }
}

// ── SHARED HELPER: message/hint quality block ──
function buildMessageHintBlock(msg, hint) {
  const msgQuality  = !msg || msg.length < 10
    ? '⚠️ NOT PROVIDED or too short — please suggest a good one'
    : msg;
  const hintQuality = !hint || hint.length < 20
    ? '⚠️ NOT PROVIDED or too short — please suggest one that explains WHY this is a problem and HOW to fix it'
    : hint;

  return `Message   : ${msgQuality}
Hint      : ${hintQuality}

Message quality checklist (Claude should verify):
  ✓ Short (under 80 chars) — fits in VS Code squiggly tooltip without truncation
  ✓ Specific — says WHAT the problem is, not just "bad code"
  ✓ Actionable — implies what the fix direction is
  ✗ Bad example: "Performance issue detected"
  ✓ Good example: "SQL query inside a loop — N+1 problem"

Hint quality checklist (Claude should verify):
  ✓ Explains WHY this is a problem (consequence, not just the rule)
  ✓ Explains HOW to fix it — ideally with a concrete alternative
  ✓ Can be longer than message (shown on hover, not inline)
  ✗ Bad hint: "Do not use this pattern"
  ✓ Good hint: "Each loop iteration fires a separate DB round-trip. Use a JOIN or batch query instead."`;
}

// ── SHARED HELPER: regex vs AST decision guide ──
function buildRegexVsAstBlock(ruleType) {
  if (ruleType === 'regex') {
    return `═══════════════════════════════════════
REGEX vs AST — SHOULD THIS BE AN AST RULE INSTEAD?
═══════════════════════════════════════
This rule was built as a REGEX rule. Claude should check if it should actually be an AST rule.

Use REGEX when:
  ✓ The problem is visible on a single line
  ✓ You are detecting a specific string pattern, function call by name, or SQL keyword
  ✓ You want the rule to work across ALL languages (regex is language-agnostic)
  ✓ Speed matters — regex runs instantly, AST parsing takes a few hundred ms

Use AST instead when:
  ✗ You need to know how long a function is (regex cannot count lines reliably)
  ✗ You need to count methods in a class
  ✗ You need to check nesting depth or parameter count
  ✗ The pattern ONLY makes sense for JS/TS (use JS/TS AST) or Python (use Python AST)
  ✗ You are checking code structure, not text patterns

If this rule is attempting to detect something structural (function length, class size,
nesting depth) via a text pattern, Claude should flag it and suggest the AST equivalent.`;
  } else {
    return `═══════════════════════════════════════
AST vs REGEX — SHOULD THIS BE A REGEX RULE INSTEAD?
═══════════════════════════════════════
This rule was built as an AST rule. Claude should check if a simpler regex rule would suffice.

Use AST when (good reasons to keep as AST):
  ✓ You need function/class length in lines
  ✓ You need to count methods, parameters, or nested blocks
  ✓ You need to detect missing docstrings or type hints
  ✓ The structure of the code matters, not just the text

Switch to REGEX if:
  ✗ The rule just detects a function call by name (e.g. eval(), print()) — regex is simpler
  ✗ The rule just bans a specific import — regex handles this
  ✗ The rule detects a hardcoded string or SQL pattern — regex is faster
  ✗ The rule would work identically across all languages — use a regex with languages field

If this AST rule could be replaced by a one-line regex test function, Claude should
suggest the simpler regex version as an alternative.`;
  }
}

// ══════════════════════════════════════════════════════
//  REGEX VERIFICATION PROMPT
// ══════════════════════════════════════════════════════
function generateRegexVerificationPrompt(cat, name, msg, hint, sev) {
  const pattern   = document.getElementById('regexPattern').value.trim();
  const context   = document.getElementById('contextType').value;
  const anchor    = document.getElementById('multilineAnchor')?.value.trim();
  const countKw   = document.getElementById('multilineCount')?.value.trim();
  const threshold = document.getElementById('multilineThreshold')?.value.trim();
  const langValue = document.getElementById('ruleLanguage')?.value || 'all';

  const langLabels = {
    'all':    'All languages (JS, TS, Python, Java, C++)',
    'js-ts':  'JS / TS only',
    'python': 'Python only',
    'java':   'Java only',
    'cpp':    'C / C++ only',
  };
  const langArrays = {
    'all':    null,
    'js-ts':  "['typescript', 'javascript', 'typescriptreact', 'javascriptreact']",
    'python': "['python']",
    'java':   "['java']",
    'cpp':    "['cpp', 'c']",
  };

  const contextDescriptions = {
    'none':              'Single line — pattern must match on the same line',
    'loop':              'Single line — only flag if within 5 lines AFTER a for/while/forEach/map loop',
    'async':             'Single line — only flag if within 5 lines AFTER an async function',
    'class':             'Single line — only flag if within 5 lines AFTER a class declaration',
    'multiline-keyword': `Multi-line — anchor on "${anchor}", count "${countKw}" in next 25 lines, flag if count > ${threshold}`,
    'multiline-count':   `Multi-line — anchor on "${anchor}", count pattern in next 25 lines, flag if count > ${threshold}`,
  };

  const sevMap = {
    error: 'vscode.DiagnosticSeverity.Error',
    warning: 'vscode.DiagnosticSeverity.Warning',
    info: 'vscode.DiagnosticSeverity.Information',
    hint: 'vscode.DiagnosticSeverity.Hint',
  };

  const contextIsMultiline = context.startsWith('multiline');

  // Language mismatch detection
  const langMismatchWarning = (() => {
    if (langValue === 'all') return '';
    const signals = {
      'js-ts':  /console\.|JSON\.|typeof |===|!==|=>|async |await |\.then\(|require\(|import /,
      'python': /def |print\(|except|:\s*$|#/,
      'java':   /System\.|catch\s*\(|public |private |@Override/,
      'cpp':    /std::|cout|printf|#define|#include|delete |new /,
    };
    const labels = { 'js-ts': 'JS/TS', python: 'Python', java: 'Java', cpp: 'C/C++' };
    for (const [key, re] of Object.entries(signals)) {
      if (key !== langValue && re.test(pattern)) {
        return `\n⚠️  POSSIBLE LANGUAGE MISMATCH: pattern looks like ${labels[key]} but target is "${labels[langValue] || langValue}". Verify this is intentional.\n`;
      }
    }
    return '';
  })();

  return `You are verifying a VS Code linting rule for ScaleArch — a static analysis extension
supporting TypeScript, JavaScript, Python, Java, and C/C++.

═══════════════════════════════════════
RULE DETAILS
═══════════════════════════════════════
Category  : ${cat || '(not set)'}
Rule ID   : ${cat}/${name || '(not set)'}
Severity  : ${sevMap[sev]}
Pattern   : /${pattern || '(not set)'}/i
Context   : ${contextDescriptions[context] || context}
${contextIsMultiline ? `Anchor    : ${anchor}
Count kw  : ${countKw}
Threshold : ${threshold}` : ''}
Language  : ${langLabels[langValue] || 'All languages'}
${langMismatchWarning}
${buildMessageHintBlock(msg, hint)}

═══════════════════════════════════════
GENERATED CODE TO VERIFY
═══════════════════════════════════════
${state.generated || '(generate the rule first, then click Verify with AI)'}

${buildRegexVsAstBlock('regex')}

═══════════════════════════════════════
SCALEARCH RULE STRUCTURE — DO NOT CHANGE THIS FORMAT
═══════════════════════════════════════
{
  id: 'category/rule-name',
  category: 'database' | 'performance' | 'security' | 'solid' | 'code-quality',
  severity: vscode.DiagnosticSeverity.Error | .Warning | .Information | .Hint,
  message: 'short message shown in squiggly tooltip',
  hint: 'longer explanation shown on hover — WHY it is a problem and HOW to fix it',
  languages: ['python'],   // OPTIONAL — omit to run on all languages
  test: (line) => /pattern/i.test(line),
  // OR with context:
  test: (line, allLines, lineIndex) => {
    if (!/pattern/i.test(line)) return false;
    for (let i = Math.max(0, lineIndex - 5); i < lineIndex; i++) {
      if (/\b(for|while|forEach|map|reduce)\b/.test(allLines[i])) return true;
    }
    return false;
  },

  // FOR MULTI-LINE KEYWORD COUNT (context: multiline-keyword):
  test: (line, allLines, lineIndex) => {
    if (!/ANCHOR_KEYWORD/i.test(line)) return false;
    const window = allLines.slice(lineIndex, lineIndex + 25).join(' ');
    const count = (window.match(/COUNT_KEYWORD/gi) ?? []).length;
    return count > THRESHOLD;
  },

  // FOR MULTI-LINE PATTERN COUNT (context: multiline-count):
  test: (line, allLines, lineIndex) => {
    if (!/ANCHOR_KEYWORD/i.test(line)) return false;
    const window = allLines.slice(lineIndex, lineIndex + 25).join(' ');
    const count = (window.match(/pattern/gi) ?? []).length;
    return count > THRESHOLD;
  },
}

═══════════════════════════════════════
EXAMPLES OF CORRECT RULES (for reference)
═══════════════════════════════════════
// Example 1: JS/TS rule — flag SQL queries inside loops (N+1 problem)
// No languages field = runs on all supported languages
{
  id: 'database/query-in-loop',
  category: 'database',
  severity: vscode.DiagnosticSeverity.Error,
  message: 'SQL query inside a loop — classic N+1 problem',
  hint: 'Each iteration fires a separate DB round-trip. Use a JOIN or batch query instead.',
  test: (line, allLines, lineIndex) => {
    if (!/\bselect\b/i.test(line)) return false;
    for (let i = Math.max(0, lineIndex - 5); i < lineIndex; i++) {
      if (/\b(for|while|forEach|map|reduce)\b/.test(allLines[i])) return true;
   }
    return false;
  },
}

// Example 2: Python-only rule — bare except catches everything
{
  id: 'py/bare-except',
  category: 'code-quality',
  severity: vscode.DiagnosticSeverity.Warning,
  message: 'Bare except: catches everything including KeyboardInterrupt',
  hint: 'Specify the exception: except ValueError: or except (TypeError, ValueError):',
  languages: ['python'],
  test: (line) => /^\s*except\s*:/.test(line),
}

// Example 3: Java-only rule — System.out.println left in code
{
  id: 'java/system-out-println',
  category: 'performance',
  severity: vscode.DiagnosticSeverity.Information,
  message: 'System.out.println() left in code — use a logger instead',
  hint: 'System.out.println is synchronous and has no log levels. Use SLF4J or Log4j2.',
  languages: ['java'],
  test: (line) => /System\s*\.\s*out\s*\.\s*print(ln)?\s*\(/.test(line),
}

// Example 4: Multi-line rule — more than 5 JOINs in a query
{
  id: 'database/max-joins-five',
  category: 'database',
  severity: vscode.DiagnosticSeverity.Warning,
  message: 'More than 5 JOINs detected — consider refactoring',
  hint: 'Queries with 6+ JOINs are expensive. Add indexes or break into subqueries.',
  test: (line, allLines, lineIndex) => {
    if (!/SELECT/i.test(line)) return false;
    const window = allLines.slice(lineIndex, lineIndex + 25).join(' ');
    const count = (window.match(/JOIN/gi) ?? []).length;
    return count > 5;
  },
}

═══════════════════════════════════════
WHAT I NEED FROM YOU
═══════════════════════════════════════
1. PATTERN: Is /${pattern}/i correct? Give 3 examples that SHOULD trigger it and 2 that should NOT.

2. CONTEXT: Is the test function logic correct for context mode "${context}"?

3. LANGUAGE: Does the pattern make sense for "${langLabels[langValue] || 'all languages'}"?
   Generated field: ${langArrays[langValue] ? `languages: ${langArrays[langValue]}` : '(no languages field — fires on all)'}

4. MESSAGE & HINT: Are they clear, specific, and actionable?
   If weak or missing, suggest better versions following the quality checklists above.

5. REGEX vs AST: Should this be an AST rule instead? See the decision guide above.

6. If anything is wrong, provide the corrected rule in the EXACT format shown above.

7. One-line summary: VALID or NEEDS FIX, and why.`;
}

// ══════════════════════════════════════════════════════
//  JS/TS AST VERIFICATION PROMPT
// ══════════════════════════════════════════════════════
function generateAstVerificationPrompt(cat, name, msg, hint, sev) {
  const nodeTypes = document.getElementById('astNodeType').value.trim();
  const checkType = document.getElementById('astCheck').value;
  const threshold = document.getElementById('astThreshold')?.value.trim();
  const callee    = document.getElementById('astCallee')?.value.trim();

  const sevMap = {
    error: 'vscode.DiagnosticSeverity.Error',
    warning: 'vscode.DiagnosticSeverity.Warning',
    info: 'vscode.DiagnosticSeverity.Information',
    hint: 'vscode.DiagnosticSeverity.Hint',
  };

  const checkDescriptions = {
    'empty-body':        'Flag if the node body has zero statements',
    'param-count':       `Flag if the function has more than ${threshold} parameters`,
    'method-count':      `Flag if the class has more than ${threshold} methods (excluding constructor)`,
    'line-count':        `Flag if the function/class is longer than ${threshold} lines`,
    'missing-docstring': 'Flag if the function/class has no JSDoc comment block',
    'name-match':        `Flag if the node name matches "${callee}"`,
    'custom-prop':       'Custom property check — user defined',
  };

  return `You are verifying a JS/TS AST rule for ScaleArch — a VS Code static analysis extension.
Each AST rule receives one syntax tree node at a time and returns null (skip) or a RuleResult (flag it).

═══════════════════════════════════════
RULE DETAILS
═══════════════════════════════════════
Category    : ${cat || '(not set)'}
Rule ID     : ${cat}/${name || '(not set)'}
Severity    : ${sevMap[sev]}
Node type(s): ${nodeTypes || '(not set)'}
Check type  : ${checkDescriptions[checkType] || checkType}
${threshold ? `Threshold   : ${threshold}` : ''}
${callee    ? `Target name : ${callee}` : ''}

${buildMessageHintBlock(msg, hint)}

═══════════════════════════════════════
GENERATED CODE TO VERIFY
═══════════════════════════════════════
${state.generated || '(generate the rule first, then click Verify with AI)'}

${buildRegexVsAstBlock('ast')}

═══════════════════════════════════════
SCALEARCH AST RULE STRUCTURE — DO NOT CHANGE THIS FORMAT
═══════════════════════════════════════
export function checkRuleName(node: any): RuleResult | null {
  if (node.type !== 'FunctionDeclaration') return null;

  const params = node.params ?? [];
  if (params.length <= 4) return null;

  const s = node.loc?.start ?? { line: 0, column: 0 };
  const e = node.loc?.end   ?? { line: 0, column: 0 };
  const range = new vscode.Range(s.line - 1, s.column, e.line - 1, e.column);

  return {
    range,
    code: 'category/rule-name',
    message: 'short message shown in tooltip',
    hint: 'longer explanation on hover — WHY and HOW to fix',
    severity: vscode.DiagnosticSeverity.Warning,
  };
}

═══════════════════════════════════════
COMMON NODE PROPERTIES (for reference)
═══════════════════════════════════════
FunctionDeclaration / FunctionExpression / ArrowFunctionExpression:
  node.id?.name, node.params, node.params.length, node.async,
  node.loc.start.line, node.loc.end.line, node.body.body

ClassDeclaration: node.id?.name, node.body.body (MethodDefinitions)
MethodDefinition: node.key.name, node.kind ('constructor'|'method'|'get'|'set'), node.static
CallExpression:   node.callee.name, node.callee.property?.name, node.arguments
CatchClause:      node.body.body, node.body.body.length
Literal:          node.value, typeof node.value

═══════════════════════════════════════
WHAT I NEED FROM YOU
═══════════════════════════════════════
1. NODE TYPE: Is "${nodeTypes}" correct for: ${checkDescriptions[checkType] || checkType}?

2. PROPERTIES: Are the node properties being accessed correct for this node type?
   (e.g. node.params on FunctionDeclaration ✓ — node.params on ClassDeclaration ✗)

3. EXAMPLES: Give 2 TypeScript/JavaScript examples that SHOULD trigger this rule,
   and 1 example that should NOT (false positive check).

4. MESSAGE & HINT: Are they clear, specific, and actionable?
   If weak or missing, suggest better versions following the quality checklists above.

5. AST vs REGEX: Should this be a simpler regex rule instead? See the decision guide above.

6. If anything is wrong, provide the corrected function in the EXACT format shown above.

7. One-line summary: VALID or NEEDS FIX, and why.`;
}

// ══════════════════════════════════════════════════════
//  PYTHON AST VERIFICATION PROMPT
// ══════════════════════════════════════════════════════
function generatePythonAstVerificationPrompt() {
  const category  = document.getElementById('category').value       || '(not set)';
  const ruleName  = document.getElementById('ruleName').value.trim() || '(not set)';
  const message   = document.getElementById('message').value.trim() || '';
  const hint      = document.getElementById('hint').value.trim()    || '';
  const severity  = document.querySelector('.sev-btn.selected')?.dataset.sev || 'warning';
  const nodeTypes = document.getElementById('astNodeType').value    || '(not set)';
  const checkType = document.getElementById('astCheck').value       || '(not set)';
  const threshold = document.getElementById('astThreshold')?.value.trim();
  const callee    = document.getElementById('astCallee')?.value.trim();

  const checkDescriptions = {
    'line-count':        `Flag if function/class is longer than ${threshold} lines`,
    'method-count':      `Flag if class has more than ${threshold} methods`,
    'param-count':       `Flag if function has more than ${threshold} parameters (excl. self/cls)`,
    'empty-body':        'Flag if body contains only a Pass statement',
    'missing-docstring': 'Flag if first body statement is not a string Constant (docstring)',
    'name-match':        `Flag if node.name matches "${callee}"`,
    'custom-prop':       'Custom property check — user defined',
  };

  const sevMap = {
    error: 'vscode.DiagnosticSeverity.Error',
    warning: 'vscode.DiagnosticSeverity.Warning',
    info: 'vscode.DiagnosticSeverity.Information',
    hint: 'vscode.DiagnosticSeverity.Hint',
  };

  return `You are verifying a Python AST rule for ScaleArch — a VS Code static analysis extension.
Python AST rules use Python's built-in ast module, run via a child process, and receive
one AST node at a time. They use different property names than JS/TS AST rules.

═══════════════════════════════════════
RULE DETAILS
═══════════════════════════════════════
Category    : ${category}
Rule ID     : ${category}/${ruleName}
Severity    : ${sevMap[severity] || severity}
Node type(s): ${nodeTypes}
Check type  : ${checkDescriptions[checkType] || checkType}
${threshold ? `Threshold   : ${threshold}` : ''}
${callee    ? `Target name : ${callee}` : ''}

${buildMessageHintBlock(message, hint)}

═══════════════════════════════════════
GENERATED CODE TO VERIFY
═══════════════════════════════════════
${state.generated || '(generate the rule first, then click Verify with AI)'}

${buildRegexVsAstBlock('ast')}

═══════════════════════════════════════
PYTHON AST RULE STRUCTURE — DO NOT CHANGE THIS FORMAT
═══════════════════════════════════════
function checkPyRuleName(
  node,     // Python AST node — _type, lineno, end_lineno, name, body etc.
  cfg,      // VS Code workspace configuration
  makeDiag  // makeDiag(node, message, severity, code, hint?) => Diagnostic
) {
  if (node._type !== 'FunctionDef') return null;

  // your condition
  const lines = (node.end_lineno ?? node.lineno) - node.lineno + 1;
  if (lines <= 30) return null;

  return makeDiag(
    node,
    'Function is too long — split into smaller helpers',
    vscode.DiagnosticSeverity.Warning,
    'category/rule-name',
    'Functions over 30 lines are hard to test. Extract smaller helpers with single responsibilities.'
  );
}

KEY PYTHON vs JS/TS DIFFERENCES:
  ✓ node._type  (not node.type)
  ✓ node.lineno / node.end_lineno  (not node.loc.start.line)
  ✓ node.name  for function/class names  (not node.id?.name)
  ✓ node.args.args  for parameters  (not node.params)
  ✓ node.body  is a list of statement nodes  (not node.body.body)
  ✓ makeDiag takes hint as 5th optional argument

COMMON PYTHON NODE PROPERTIES:
  FunctionDef / AsyncFunctionDef:
    node.name, node.lineno, node.end_lineno,
    node.args.args (list, each has .arg string),
    node.body (list of statements), node.returns

  ClassDef:
    node.name, node.lineno, node.end_lineno,
    node.body (list — filter for FunctionDef to get methods),
    node.bases (list of base class nodes)

  ExceptHandler:
    node.type (exception class or null for bare except),
    node.body (list — check if only Pass)

═══════════════════════════════════════
WHAT I NEED FROM YOU
═══════════════════════════════════════
1. NODE TYPE: Is "${nodeTypes}" the correct Python AST _type for: ${checkDescriptions[checkType] || checkType}?

2. PROPERTIES: Are the Python node properties correct?
   (e.g. node.args.args ✓ for params — NOT node.params which is JS/TS)

3. EXAMPLES: Give 2 Python code examples that SHOULD trigger this rule,
   and 1 example that should NOT (false positive check).

4. MESSAGE & HINT: Are they clear and actionable for a Python developer?
   If weak or missing, suggest better versions following the quality checklists above.

5. HINT IN makeDiag: Is hint passed as the 5th argument to makeDiag?
   The signature is: makeDiag(node, message, severity, code, hint?)
   If hint is missing from the call, flag it.

6. AST vs REGEX: Could this be a simpler regex rule? See the decision guide above.

7. If anything is wrong, provide the corrected function in the EXACT format shown.

8. One-line summary: VALID or NEEDS FIX, and why.`;
}