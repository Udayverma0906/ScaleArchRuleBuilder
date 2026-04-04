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

// ── GENERATE VERIFICATION PROMPT ──
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

function generateRegexVerificationPrompt(cat, name, msg, hint, sev) {
  const pattern   = document.getElementById('regexPattern').value.trim();
  const context   = document.getElementById('contextType').value;
  const anchor    = document.getElementById('multilineAnchor')?.value.trim();
  const countKw   = document.getElementById('multilineCount')?.value.trim();
  const threshold = document.getElementById('multilineThreshold')?.value.trim();

  // Language targeting (v0.2)
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
    'none':               'Single line — the pattern must match on the same line',
    'loop':               'Single line — only flag if the pattern appears within 5 lines AFTER a for/while/forEach/map loop',
    'async':              'Single line — only flag if the pattern appears within 5 lines AFTER an async function',
    'class':              'Single line — only flag if the pattern appears within 5 lines AFTER a class declaration',
    'multiline-keyword':  `Multi-line — trigger ONLY on lines containing anchor keyword "${anchor}", then count occurrences of "${countKw}" in the next 25 lines. Flag if count > ${threshold}`,
    'multiline-count':    `Multi-line — trigger ONLY on lines containing anchor keyword "${anchor}", then count occurrences of the pattern in the next 25 lines. Flag if count > ${threshold}`,
  };

  const sevMap = {
    error: 'vscode.DiagnosticSeverity.Error',
    warning: 'vscode.DiagnosticSeverity.Warning',
    info: 'vscode.DiagnosticSeverity.Information',
    hint: 'vscode.DiagnosticSeverity.Hint',
  };

  // Language mismatch detection — give Claude a clear signal
  const contextIsMultiline  = context.startsWith('multiline');
  const langMismatchWarning = (() => {
    if (langValue === 'all') return '';
    const jsPatternSignals   = /console\.|JSON\.|typeof |===|!==|=>|async |await |\.then\(|require\(|import /;
    const pyPatternSignals   = /def |print\(|except|import |:\s*$|#/;
    const javaPatternSignals = /System\.|catch\s*\(|public |private |@Override/;
    const cppPatternSignals  = /std::|cout|printf|#define|#include|delete |new /;

    const checks = {
      'js-ts':  { test: jsPatternSignals,   label: 'JS/TS' },
      'python': { test: pyPatternSignals,   label: 'Python' },
      'java':   { test: javaPatternSignals, label: 'Java' },
      'cpp':    { test: cppPatternSignals,  label: 'C/C++' },
    };

    const selected = checks[langValue];
    if (!selected) return '';

    // Check if pattern looks like it belongs to a different language
    for (const [key, check] of Object.entries(checks)) {
      if (key !== langValue && check.test.test(pattern)) {
        return `\n⚠️  POSSIBLE LANGUAGE MISMATCH DETECTED\n` +
               `The pattern contains signals that look like ${check.label} code,\n` +
               `but the target language is set to "${selected.label}".\n` +
               `Please verify this is intentional.\n`;
      }
    }
    return '';
  })();

  return `You are verifying a VS Code linting rule for a tool called ScaleArch.
ScaleArch is a VS Code extension that runs static analysis on code files.
As of v0.2, ScaleArch supports: TypeScript, JavaScript, Python, Java, and C/C++.
Rules can be scoped to specific languages using the optional "languages" field.

I built this rule using the ScaleArch Rule Builder UI. Please verify:
1. The regex pattern is correct and does what I intend
2. The test function logic matches the context mode I selected
3. The languages field matches the pattern (wrong language = rule never fires OR fires on wrong files)
4. The message and hint are clear enough for a developer to understand and act on
5. Point out any false positives or false negatives
6. If anything is wrong, give the corrected version in the EXACT same format

═══════════════════════════════════════
RULE DETAILS (filled in by user)
═══════════════════════════════════════
Category  : ${cat || '(not set)'}
Rule ID   : ${cat}/${name || '(not set)'}
Message   : ${msg || '⚠️ NOT PROVIDED — please suggest a good one'}
Hint      : ${hint || '⚠️ NOT PROVIDED — please suggest a good one that explains WHY this is a problem and HOW to fix it'}
Severity  : ${sevMap[sev]}
Pattern   : /${pattern || '(not set)'}/i
Context   : ${contextDescriptions[context] || context}
${contextIsMultiline ? `Anchor    : ${anchor}
Count kw  : ${countKw}
Threshold : ${threshold}` : ''}
Language  : ${langLabels[langValue] || 'All languages'}
${langMismatchWarning}

═══════════════════════════════════════
GENERATED CODE TO VERIFY
═══════════════════════════════════════
${state.generated || '(generate the rule first, then click Verify with AI)'}

═══════════════════════════════════════
SCALEARCH RULE STRUCTURE — DO NOT CHANGE THIS FORMAT
═══════════════════════════════════════
A valid ScaleArch regex rule object looks like this:

{
  id: 'category/rule-name',
  category: 'database' | 'performance' | 'security' | 'solid' | 'code-quality',
  severity: vscode.DiagnosticSeverity.Error | .Warning | .Information | .Hint,
  message: 'short message shown in squiggly tooltip',
  hint: 'longer explanation shown on hover',

  // OPTIONAL — omit to run on ALL languages.
  // Include to restrict the rule to specific file types.
  // Valid values: 'typescript' | 'javascript' | 'typescriptreact' | 'javascriptreact'
  //               'python' | 'java' | 'cpp' | 'c'
  languages: ['python'],          // example: Python only
  // languages: ['java'],         // example: Java only
  // languages: ['cpp', 'c'],     // example: C and C++
  // languages: ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'], // JS/TS only

  // FOR SINGLE LINE (context: none):
  test: (line) => /pattern/i.test(line),

  // FOR SINGLE LINE WITH LOOK-BACK (context: loop/async/class):
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
1. Is the regex pattern /${pattern}/i correct for what the rule intends?
   - Give 3 code examples that SHOULD trigger it (written in: ${langLabels[langValue] || 'any language'})
   - Give 2 code examples that should NOT trigger it (false positives check)

2. Is the test function logic correct for context mode "${context}"?

3. Is the languages field correct?
   - Selected language: ${langLabels[langValue] || 'All languages'}
   - Generated field: ${langArrays[langValue] ? `languages: ${langArrays[langValue]}` : '(no languages field — fires on all languages)'}
   - Does the pattern actually make sense for this language? If not, what should the language be?

4. Are the message and hint good quality?
   - Message: "${msg || '(not provided)'}"
   - Hint: "${hint || '(not provided)'}"
   - A good message is short, specific, and actionable (e.g. "Raw SQL detected — use QueryBuilder instead")
   - A good hint explains WHY it is a problem and exactly HOW to fix it
   - If either is missing or weak, suggest a better version

5. If anything is wrong, provide the corrected rule in the EXACT format shown above.
   Do NOT change the structure — only fix what is incorrect.

6. One-line summary: VALID or NEEDS FIX, and why.`;
}

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
    'empty-body':     'Flag if the node body has zero statements',
    'param-count':    `Flag if the function has more than ${threshold} parameters`,
    'method-count':   `Flag if the class has more than ${threshold} methods (excluding constructor)`,
    'line-count':     `Flag if the function is longer than ${threshold} lines`,
    'callee-name':    `Flag if the function being CALLED is named "${callee}"`,
    'declared-name':  `Flag if the function being DECLARED is named "${callee}"`,
    'method-name':    `Flag if the class METHOD is named "${callee}"`,
    'custom-prop':    'Custom property check — user defined',
  };

  return `You are verifying a VS Code linting rule for a tool called ScaleArch.
ScaleArch analyzes TypeScript/JavaScript code using AST (Abstract Syntax Tree) rules.
Each rule is a function that receives one AST node at a time and returns null (skip) or a RuleResult (flag it).

I have built an AST rule using a Rule Builder UI. Please verify that:
1. The correct AST node type(s) are being checked
2. The condition logic is correct
3. The property being checked (e.g. node.id.name, node.params) is correct for this node type
4. Point out any issues and provide a corrected version if needed

═══════════════════════════════════════
RULE DETAILS (filled in by user)
═══════════════════════════════════════
Category    : ${cat || '(not set)'}
Rule ID     : ${cat}/${name || '(not set)'}
Message     : ${msg || '(not set)'}
Hint        : ${hint || '(same as message)'}
Severity    : ${sevMap[sev]}
Node type(s): ${nodeTypes || '(not set)'}
Check type  : ${checkDescriptions[checkType] || checkType}
${threshold ? `Threshold   : ${threshold}` : ''}
${callee    ? `Target name : ${callee}` : ''}

═══════════════════════════════════════
GENERATED CODE TO VERIFY
═══════════════════════════════════════
${state.generated || '(generate the rule first, then click Verify with AI)'}

═══════════════════════════════════════
SCALEARCH AST RULE STRUCTURE — DO NOT CHANGE THIS FORMAT
═══════════════════════════════════════
export function checkRuleName(node: any): RuleResult | null {
  // Guard: skip wrong node types
  if (node.type !== 'FunctionDeclaration') return null;
  // OR for multiple types:
  if (!['FunctionDeclaration', 'ArrowFunctionExpression'].includes(node.type)) return null;

  // Your condition — return null to skip, return result to flag
  const params = node.params ?? [];
  if (params.length <= 4) return null;

  // Build the range (always this exact pattern)
  const s = node.loc?.start ?? { line: 0, column: 0 };
  const e = node.loc?.end   ?? { line: 0, column: 0 };
  const range = new vscode.Range(s.line - 1, s.column, e.line - 1, e.column);

  return {
    range,
    code: 'category/rule-name',
    message: 'your message here',
    hint: 'your hint here',
    severity: vscode.DiagnosticSeverity.Warning,
  };
}

═══════════════════════════════════════
COMMON AST NODE PROPERTIES (for reference)
═══════════════════════════════════════
FunctionDeclaration / FunctionExpression / ArrowFunctionExpression:
  node.id?.name         — function name (null for anonymous)
  node.params           — array of parameters
  node.params.length    — parameter count
  node.async            — true if async
  node.loc.start.line   — start line number
  node.loc.end.line     — end line number
  node.body.body        — array of statements inside

ClassDeclaration:
  node.id?.name         — class name
  node.body.body        — array of MethodDefinitions

MethodDefinition:
  node.key.name         — method name
  node.kind             — 'constructor' | 'method' | 'get' | 'set'
  node.static           — true if static method

CallExpression:
  node.callee.name                  — name if direct call: foo()
  node.callee.property?.name        — name if method call: obj.foo()
  node.arguments                    — array of arguments

CatchClause:
  node.body.body        — statements inside catch block
  node.body.body.length — 0 means empty catch

Literal:
  node.value            — the actual value (string, number, boolean)
  typeof node.value     — use this to check type

═══════════════════════════════════════
EXAMPLE OF A CORRECT AST RULE (for reference)
═══════════════════════════════════════
// Rule: flag empty catch blocks
export function checkEmptyCatch(node: any): RuleResult | null {
  if (node.type !== 'CatchClause') return null;

  const statements = node.body?.body ?? [];
  if (statements.length > 0) return null; // has code — fine

  const s = node.loc?.start ?? { line: 0, column: 0 };
  const e = node.loc?.end   ?? { line: 0, column: 0 };
  const range = new vscode.Range(s.line - 1, s.column, e.line - 1, e.column);

  return {
    range,
    code: 'code-quality/empty-catch',
    message: 'Empty catch block — error is being silently swallowed',
    hint: 'At minimum log the error: catch (e) { console.error(e); }',
    severity: vscode.DiagnosticSeverity.Warning,
  };
}

═══════════════════════════════════════
WHAT I NEED FROM YOU
═══════════════════════════════════════
1. Is "${nodeTypes}" the correct node type for detecting: ${checkDescriptions[checkType]}?
   If not, what should it be?

2. Is the property being accessed (e.g. node.params, node.id.name) correct for this node type?

3. Give 2 TypeScript/JavaScript code examples that SHOULD trigger this rule.

4. Give 1 example that should NOT trigger it.

5. If anything is wrong, provide the corrected function in the EXACT format shown above.
   Do NOT change the range-building pattern or the return structure.

6. One-line summary: VALID or NEEDS FIX, and why.`;
}
// ── PYTHON AST VERIFICATION PROMPT ──────────────────────────────────
function generatePythonAstVerificationPrompt() {
  const category  = document.getElementById('category').value      || '(not set)';
  const ruleName  = document.getElementById('ruleName').value      || '(not set)';
  const message   = document.getElementById('message').value       || '(not set)';
  const hint      = document.getElementById('hint').value          || '(not set)';
  const severity  = document.querySelector('.sev-btn.selected')?.dataset.sev || 'warning';
  const nodeTypes = document.getElementById('astNodeType').value   || '(not set)';
  const code      = state.generated || '(no code generated yet)';

  return `You are reviewing a custom Python AST rule for the ScaleArch VS Code extension.

═══════════════════════════════════════════════════════════
RULE DETAILS
═══════════════════════════════════════════════════════════
ID         : ${category}/${ruleName}
Category   : ${category}
Severity   : ${severity}
Node types : ${nodeTypes}
Message    : ${message}
Hint       : ${hint}
Language   : Python AST (requires Python 3.8+)

═══════════════════════════════════════════════════════════
GENERATED CODE
═══════════════════════════════════════════════════════════
${code}

═══════════════════════════════════════════════════════════
SCALEARCH PYTHON AST RULE STRUCTURE
═══════════════════════════════════════════════════════════
A PythonRuleCheck has this signature:
  (node, cfg, makeDiag) => vscode.Diagnostic | null

Where:
  node     — Python AST node with _type, lineno, col_offset, end_lineno
  cfg      — VS Code workspace configuration for reading thresholds
  makeDiag — (node, message, severity, code) => Diagnostic

Key differences from JS/TS AST rules:
  - Use node._type (not node.type)
  - Use node.lineno / node.end_lineno (1-based, not loc.start.line)
  - PythonNode is defined in src/rules/types.ts
  - Goes in CUSTOM_PYTHON_AST_RULES (Section 4 of customRules.ts)
  - Requires Python 3.8+ installed on the user's machine

═══════════════════════════════════════════════════════════
PLEASE REVIEW THE FOLLOWING
═══════════════════════════════════════════════════════════
1. Is the _type guard correct for the intended Python AST node?
2. Does the logic correctly identify the anti-pattern in real Python code?
3. Are there false positives? (code that would be flagged but is actually fine)
4. Are there false negatives? (code that should be flagged but is missed)
5. Is the message clear and actionable for a Python developer?
6. Is the hint specific enough — does it explain WHY and HOW to fix?
7. Is the makeDiag call correct (node, message, severity, code)?

If anything is wrong, provide a corrected version of the function.`;
}