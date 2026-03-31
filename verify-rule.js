function openVerification() {
  if (!state.generated) return;
  const prompt = generateVerificationPrompt();
  
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

  const contextIsMultiline = context.startsWith('multiline');

  return `You are verifying a VS Code linting rule for a tool called ScaleArch.
ScaleArch analyzes TypeScript/JavaScript code and flags bad patterns using custom rules.

I have built a rule using a Rule Builder UI. Please verify that:
1. The regex pattern is correct and does what I intend
2. The test function logic is correct for the context mode I selected
3. Point out any false positives or false negatives
4. If anything is wrong, give me the corrected version in the EXACT same format

═══════════════════════════════════════
RULE DETAILS (filled in by user)
═══════════════════════════════════════
Category  : ${cat || '(not set)'}
Rule ID   : ${cat}/${name || '(not set)'}
Message   : ${msg || '(not set)'}
Hint      : ${hint || '(same as message)'}
Severity  : ${sevMap[sev]}
Pattern   : /${pattern || '(not set)'}/i
Context   : ${contextDescriptions[context] || context}
${contextIsMultiline ? `Anchor    : ${anchor}
Count kw  : ${countKw}
Threshold : ${threshold}` : ''}

═══════════════════════════════════════
GENERATED CODE TO VERIFY
═══════════════════════════════════════
${state.generated || '(generate the rule first, then click Verify with AI)'}

═══════════════════════════════════════
SCALEARCH RULE STRUCTURE — DO NOT CHANGE THIS FORMAT
═══════════════════════════════════════
A valid ScaleArch regex rule must match this exact structure:

{
  id: 'category/rule-name',
  category: 'database' | 'performance' | 'security' | 'solid' | 'code-quality',
  severity: vscode.DiagnosticSeverity.Error | .Warning | .Information | .Hint,
  message: 'short message shown in squiggly tooltip',
  hint: 'longer explanation shown on hover',

  // FOR SINGLE LINE (context: none):
  test: (line) => /pattern/i.test(line),

  // FOR SINGLE LINE WITH LOOK-BACK (context: loop/async/class):
  test: (line, allLines, lineIndex) => {
    if (!/pattern/i.test(line)) return false;
    for (let i = Math.max(0, lineIndex - 5); i < lineIndex; i++) {
      if (/\\b(for|while|forEach|map|reduce)\\b/.test(allLines[i])) return true;
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
EXAMPLE OF A CORRECT RULE (for reference)
═══════════════════════════════════════
// Rule: flag SQL queries inside loops (N+1 problem)
{
  id: 'database/query-in-loop',
  category: 'database',
  severity: vscode.DiagnosticSeverity.Error,
  message: 'SQL query inside a loop — classic N+1 problem',
  hint: 'Each iteration fires a separate DB round-trip. Use a JOIN or batch query instead.',
  test: (line, allLines, lineIndex) => {
    if (!/\\bselect\\b/i.test(line)) return false;
    for (let i = Math.max(0, lineIndex - 5); i < lineIndex; i++) {
      if (/\\b(for|while|forEach|map|reduce)\\b/.test(allLines[i])) return true;
    }
    return false;
  },
}

// Rule: flag queries with more than 5 JOINs (multi-line)
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
   - Give 3 examples that SHOULD trigger it
   - Give 2 examples that should NOT trigger it (false positives check)

2. Is the test function logic correct for the context mode "${context}"?

3. If anything is wrong, provide the corrected rule in the EXACT format shown above.
   Do NOT change the structure — only fix what is incorrect.

4. One-line summary: VALID or NEEDS FIX, and why.`;
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