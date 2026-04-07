// ══════════════════════════════════════════════════════
//  ScaleArch Rule Builder — generators/ast-python.js
//  Generates Python AST per-node check for customRules.ts Section 4
//
//  PYTHON_AST_CHECKS — defines the "What to check" dropdown options
//  for Python. Same check values as JS/TS where applicable so the
//  UX is consistent — but the generated code uses Python node
//  properties (_type, lineno, end_lineno, args.args etc.)
//
//  To add a new language (e.g. Java):
//  1. Duplicate this file as ast-java.js
//  2. Define JAVA_AST_CHECKS with the same structure
//  3. Write generateJavaAst() with Java-specific node properties
//  4. Add <script src="js/generators/ast-java.js"> to index.html
//  5. Add routing case in generate() in script.js
// ══════════════════════════════════════════════════════

const PYTHON_AST_CHECKS = [
  { value: 'line-count',        label: 'Function / class too long',     hasThreshold: true,  hasName: false },
  { value: 'method-count',      label: 'Too many methods in class',     hasThreshold: true,  hasName: false },
  { value: 'param-count',       label: 'Too many parameters',           hasThreshold: true,  hasName: false },
  { value: 'empty-body',        label: 'Body is empty (only pass)',     hasThreshold: false, hasName: false },
  { value: 'missing-docstring', label: 'Missing docstring',             hasThreshold: false, hasName: false },
  { value: 'name-match',        label: 'Specific name detected',        hasThreshold: false, hasName: true  },
  { value: 'custom-prop',       label: 'Custom property check',         hasThreshold: false, hasName: false },
];

function generatePythonAst(cat, name, msg, hint, sev) {
  const rawNodeTypes = document.getElementById('astNodeType').value.trim() || 'FunctionDef';
  const nodeTypeList = rawNodeTypes.split('|').map(s => s.trim()).filter(Boolean);
  const checkType    = document.getElementById('astCheck').value;
  const threshold    = parseInt(document.getElementById('astThreshold').value) || 5;
  const targetName   = document.getElementById('astCallee').value.trim() || 'targetName';
  const fnName       = toCamelCase('checkPy-' + name);
  const id           = `${cat}/${name}`;

  // Python uses lineno/end_lineno (1-based), _type, args.args, node.name
  const checkMap = {
    'line-count':
`  // Python line numbers are 1-based
  const lines = (node.end_lineno ?? node.lineno) - node.lineno + 1;
  if (lines <= ${threshold}) return null;`,

    'method-count':
`  // Count FunctionDef and AsyncFunctionDef children in the class body
  const methods = (node.body ?? []).filter(
    n => n._type === 'FunctionDef' || n._type === 'AsyncFunctionDef'
  );
  if (methods.length <= ${threshold}) return null;`,

    'param-count':
`  // args.args excludes *args and **kwargs — add posonlyargs/kwonlyargs if needed
  const params = (node.args?.args ?? []).filter(
    a => a.arg !== 'self' && a.arg !== 'cls'
  );
  if (params.length <= ${threshold}) return null;`,

    'empty-body':
`  // An "empty" Python body contains only a Pass statement
  const body = node.body ?? [];
  const isOnlyPass = body.length === 1 && body[0]._type === 'Pass';
  if (!isOnlyPass) return null;`,

    'missing-docstring':
`  // A docstring is an Expr node whose value is a string Constant
  const body = node.body ?? [];
  if (body.length === 0) return null;
  const firstStmt = body[0];
  const hasDocstring =
    firstStmt._type === 'Expr' &&
    firstStmt.value?._type === 'Constant' &&
    typeof firstStmt.value?.value === 'string';
  if (hasDocstring) return null;
  // Skip private / dunder names
  if ((node.name ?? '').startsWith('_')) return null;`,

    'name-match':
`  // node.name is the function or class name string in Python AST
  if ((node.name ?? '') !== '${targetName}') return null;`,

    'custom-prop':
`  // TODO: add your custom Python property check here
  // Common properties:
  //   node.name        → function/class name string
  //   node.body        → list of child statement nodes
  //   node.args.args   → list of parameter nodes (each has .arg string)
  //   node.lineno      → start line (1-based)
  //   node.end_lineno  → end line (1-based)
  //   node.returns     → return annotation node (or null)
  const shouldFlag = false;
  if (!shouldFlag) return null;`,
  };

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
  node,     // Python AST node — uses _type, lineno, end_lineno, name, body etc.
  cfg,      // VS Code workspace configuration (for reading settings/thresholds)
  makeDiag  // helper: makeDiag(node, message, severity, ruleId)
) {
  // Only process ${nodeTypesComment} nodes
${guardLine}

${checkMap[checkType] ?? '  // TODO: add your check here'}

  return makeDiag(
    node,
    '${msg.replace(/'/g, "\\'")}',
    ${sev},
    '${id}',
    '${(hint || '').replace(/'/g, "\\'")}' || undefined
  );
}

// ─── Register it ───────────────────────────────────
// Add to CUSTOM_PYTHON_AST_RULES in customRules.ts:
// export const CUSTOM_PYTHON_AST_RULES: PythonRuleCheck[] = [
//   ...existing,
//   ${fnName},   // ← add this
// ];
//
// Tip: python3 -c "import ast; print(ast.dump(ast.parse('your code here'), indent=2))"
// prints the exact node tree for any Python snippet.`;
}