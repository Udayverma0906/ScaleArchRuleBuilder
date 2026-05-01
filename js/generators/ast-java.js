// ══════════════════════════════════════════════════════
//  ScaleArch Rule Builder — generators/ast-java.js
//  Generates Java AST per-node check for customRules.ts Section 5
//
//  JAVA_AST_CHECKS — defines the "What to check" dropdown options
//  for Java. script.js reads this when Java is selected and rebuilds
//  the dropdown automatically.
//
//  Key differences from JS/TS and Python:
//    node.type             (NO underscore — tree-sitter)
//    node.startPosition.row (0-based — same as VS Code Range)
//    node.childForFieldName("name")?.text   (to get named fields)
//    node.namedChildren    (excludes syntax tokens like { } ; )
//    node.parent           (for walking up the tree)
//
//  Output format: named const assigned to JavaRuleCheck type,
//  then const name added to CUSTOM_JAVA_AST_RULES array.
//  This matches the pattern used by Python and JS/TS sections.
//
//  hasThreshold → shows the threshold number input
//  hasName      → shows the name/callee text input
// ══════════════════════════════════════════════════════

const JAVA_AST_CHECKS = [
  { value: 'line-count',      label: 'Method / class too long',          hasThreshold: true,  hasName: false },
  { value: 'method-count',    label: 'Too many methods in class',        hasThreshold: true,  hasName: false },
  { value: 'param-count',     label: 'Too many parameters',              hasThreshold: true,  hasName: false },
  { value: 'empty-body',      label: 'Body is empty (empty catch etc.)', hasThreshold: false, hasName: false },
  { value: 'field-public',    label: 'Public non-final field detected',  hasThreshold: false, hasName: false },
  { value: 'method-call',     label: 'Specific method call detected',    hasThreshold: false, hasName: true  },
  { value: 'missing-javadoc', label: 'Public method missing Javadoc',    hasThreshold: false, hasName: false },
  { value: 'custom-prop',     label: 'Custom property check',            hasThreshold: false, hasName: false },
];

function generateJavaAst(cat, name, msg, hint, sev) {
  const rawNodeTypes = document.getElementById('astNodeType').value.trim() || 'method_declaration';
  const nodeTypeList = rawNodeTypes.split('|').map(s => s.trim()).filter(Boolean);
  const checkType    = document.getElementById('astCheck').value;
  const threshold    = parseInt(document.getElementById('astThreshold').value) || 5;
  const targetName   = document.getElementById('astCallee').value.trim() || 'targetMethod';
  const id           = `${cat}/${name}`;
  const constName    = 'check' + name
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');

  const checkMap = {
    'line-count':
`  // tree-sitter row is 0-based — subtract to get line count
  const lineCount = node.endPosition.row - node.startPosition.row;
  if (lineCount <= ${threshold}) return null;`,

    'method-count':
`  // Count method_declaration children inside the class body
  const body = node.childForFieldName('body');
  if (!body) return null;
  const methodCount = body.namedChildren.filter(
    (c: JavaNode) => c.type === 'method_declaration'
  ).length;
  if (methodCount <= ${threshold}) return null;`,

    'param-count':
`  // Count formal_parameter nodes inside the parameters field
  const params = node.childForFieldName('parameters');
  if (!params) return null;
  const paramCount = params.namedChildren.filter(
    (c: JavaNode) => c.type === 'formal_parameter'
  ).length;
  if (paramCount <= ${threshold}) return null;`,

    'empty-body':
`  // namedChildren excludes syntax tokens (braces) — length 0 = truly empty
  const body = node.childForFieldName('body');
  if (!body) return null;
  if (body.namedChildren.length > 0) return null;`,

    'field-public':
`  // Check modifiers for 'public' but NOT 'final' (constants are ok)
  const modifiers = node.namedChildren.find((c: JavaNode) => c.type === 'modifiers');
  if (!modifiers) return null;
  if (!modifiers.text.includes('public')) return null;
  if (modifiers.text.includes('final')) return null;`,

    'method-call':
`  // Detect a specific method invocation by method name
  const method = node.childForFieldName('name')?.text;
  if (method !== '${targetName}') return null;`,

    'missing-javadoc':
`  // Only flag public methods — skip private, protected, @Override
  const modifiers = node.namedChildren.filter((c: JavaNode) => c.type === 'modifiers');
  const isPublic   = modifiers.some((m: JavaNode) => m.text.includes('public'));
  if (!isPublic) return null;
  const hasOverride = modifiers.some((m: JavaNode) => m.text.includes('@Override'));
  if (hasOverride) return null;
  // Check if previous sibling is a /** Javadoc */ block comment
  const prev = node.previousNamedSibling;
  const hasJavadoc = prev?.type === 'block_comment' && prev.text.startsWith('/**');
  if (hasJavadoc) return null;`,

    'custom-prop':
`  // TODO: add your custom Java property check here
  // Common patterns:
  //   node.childForFieldName('name')?.text        → method/class name
  //   node.childForFieldName('body')?.namedChildren → body statements
  //   node.namedChildren.find((c: JavaNode) => c.type === 'modifiers')?.text
  //   node.startPosition.row                       → line number (0-based)
  //   node.endPosition.row - node.startPosition.row → line count
  //   node.parent?.type                            → parent node type
  const shouldFlag = false;
  if (!shouldFlag) return null;`,
  };

  const nodeTypesLiteral = nodeTypeList.map(t => `'${t}'`).join(', ');
  const nodeTypesComment = nodeTypeList.join(' | ');
  const guardLine = nodeTypeList.length === 1
    ? `  if (node.type !== '${nodeTypeList[0]}') return null;`
    : `  if (![${nodeTypesLiteral}].includes(node.type)) return null;`;

  const sevLabel = sev.replace('vscode.DiagnosticSeverity.', '');

  return `// ─── Rule: ${id} ───────────────────────────────────
// Category  : ${cat}
// Type      : Java AST — tree-sitter per-node check
// Nodes     : ${nodeTypesComment}
// Severity  : ${sevLabel}
// Generated : ScaleArch Rule Builder

const ${constName}: JavaRuleCheck = (node, _cfg, makeDiag) => {
  // Only process ${nodeTypesComment} nodes
${guardLine}

${checkMap[checkType] ?? '  // TODO: add your check here'}

  return makeDiag(
    node,
    '${msg.replace(/'/g, "\\'")}',
    ${sev},
    '${id}',
    '${(hint || '').replace(/'/g, "\\'")}'
  );
};

// ─── Register it ───────────────────────────────────
// In customRules.ts Section 5, add the const above then
// add its name to the CUSTOM_JAVA_AST_RULES array:
//
// export const CUSTOM_JAVA_AST_RULES: JavaRuleCheck[] = [
//   ...existing,
//   ${constName},   // ← add this
// ];`;
}