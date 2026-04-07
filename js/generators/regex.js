// ══════════════════════════════════════════════════════
//  ScaleArch Rule Builder — generators/regex.js
//  Generates CUSTOM_REGEX_RULES object for customRules.ts
// ══════════════════════════════════════════════════════

function generateRegex(cat, name, msg, hint, sev) {
  const pattern   = document.getElementById('regexPattern').value.trim() || 'YOUR_PATTERN_HERE';
  const context   = document.getElementById('contextType').value;
  const anchor    = document.getElementById('multilineAnchor')?.value.trim() || 'SELECT';
  const countKw   = document.getElementById('multilineCount')?.value.trim()  || 'JOIN';
  const threshold = parseInt(document.getElementById('multilineThreshold')?.value) || 5;
  const id        = `${cat}/${name}`;

  const langValue = document.getElementById('ruleLanguage').value;
  const langMap = {
    'all':    null,
    'js-ts':  `['typescript', 'javascript', 'typescriptreact', 'javascriptreact']`,
    'python': `['python']`,
    'java':   `['java']`,
    'cpp':    `['cpp', 'c']`,
  };
  const languagesLine = langMap[langValue]
    ? `  languages: ${langMap[langValue]},\n`
    : '';

  let testFn = '';

  if (context === 'none') {
    testFn = `  test: (line) => /${pattern}/i.test(line),`;

  } else if (context === 'multiline-keyword') {
    testFn =
`  test: (line, allLines, lineIndex) => {
    // Only trigger on lines containing the anchor keyword
    if (!/${anchor}/i.test(line)) return false;
    // Scan the next 25 lines as one string to catch multi-line patterns
    const window = allLines.slice(lineIndex, lineIndex + 25).join(' ');
    const count  = (window.match(/${countKw}/gi) ?? []).length;
    return count > ${threshold};
  },`;

  } else if (context === 'multiline-count') {
    testFn =
`  test: (line, allLines, lineIndex) => {
    if (!/${anchor}/i.test(line)) return false;
    const window = allLines.slice(lineIndex, lineIndex + 25).join(' ');
    const count  = (window.match(/${pattern}/gi) ?? []).length;
    return count > ${threshold};
  },`;

  } else {
    // Single-line with look-back context (loop / async / class)
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