// ══════════════════════════════════════════════════════
//  ScaleArch Rule Builder — generators/ast-jsts.js
//  Generates JS/TS AST per-node check for customRules.ts Section 2
//
//  JSTS_AST_CHECKS — defines the "What to check" dropdown options
//  for this language. script.js reads this when JS/TS is selected
//  and rebuilds the dropdown automatically.
//
//  hasThreshold → shows the threshold number input
//  hasName      → shows the name/callee text input
// ══════════════════════════════════════════════════════

const JSTS_AST_CHECKS = [
  { value: 'line-count',     label: 'Function / class too long',        hasThreshold: true,  hasName: false },
  { value: 'method-count',   label: 'Too many methods in class',        hasThreshold: true,  hasName: false },
  { value: 'param-count',    label: 'Too many parameters',              hasThreshold: true,  hasName: false },
  { value: 'empty-body',     label: 'Body is empty',                    hasThreshold: false, hasName: false },
  { value: 'missing-docstring', label: 'Missing docstring (JSDoc)',     hasThreshold: false, hasName: false },
  { value: 'name-match',     label: 'Specific name detected',           hasThreshold: false, hasName: true  },
  { value: 'custom-prop',    label: 'Custom property check',            hasThreshold: false, hasName: false },
];

function generateAst(cat, name, msg, hint, sev) {
  const rawNodeTypes = document.getElementById('astNodeType').value.trim() || 'FunctionDeclaration';
  const nodeTypeList = rawNodeTypes.split('|').map(s => s.trim()).filter(Boolean);
  const checkType    = document.getElementById('astCheck').value;
  const threshold    = parseInt(document.getElementById('astThreshold').value) || 5;
  const targetName   = document.getElementById('astCallee').value.trim() || 'targetName';
  const fnName       = toCamelCase('check-' + name);
  const id           = `${cat}/${name}`;

  const checkMap = {
    'line-count':
`  if (!node.loc) return null;
  const lines = node.loc.end.line - node.loc.start.line + 1;
  if (lines <= ${threshold}) return null;`,

    'method-count':
`  const methods = (node.body?.body ?? []).filter(
    (m) => m.type === 'MethodDefinition' && m.kind !== 'constructor'
  );
  if (methods.length <= ${threshold}) return null;`,

    'param-count':
`  const params = node.params ?? [];
  if (params.length <= ${threshold}) return null;`,

    'empty-body':
`  const stmts = node.body?.body ?? node.body?.statements ?? [];
  if (stmts.length > 0) return null;`,

    'missing-docstring':
`  // Check for leading JSDoc comment block
  // node.parent is not always available — use a whole-AST check for full coverage
  // TODO: verify your AST walker passes comments through
  const hasDoc = (node.leadingComments ?? []).some(c => c.type === 'Block' && c.value.startsWith('*'));
  if (hasDoc) return null;`,

    'name-match':
`  // Matches by function/class/method name
  const nodeName =
    node.id?.name ??           // FunctionDeclaration, ClassDeclaration
    node.key?.name ??          // MethodDefinition
    node.callee?.name ??       // CallExpression (bare call)
    node.callee?.property?.name ?? // CallExpression (method call)
    '';
  if (nodeName !== '${targetName}') return null;`,

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
// Type     : AST — JS/TS per-node check
// Nodes    : ${nodeTypesComment}
// Generated: ScaleArch Rule Builder

export function ${fnName}(node: any): RuleResult | null {
  // Only process ${nodeTypesComment} nodes
${guardLine}

${checkMap[checkType] ?? '  // TODO: add your check here'}

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