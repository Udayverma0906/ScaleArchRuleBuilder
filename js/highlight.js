// ══════════════════════════════════════════════════════
//  ScaleArch Rule Builder — highlight.js
//  Syntax highlighting for the generated code output panel
// ══════════════════════════════════════════════════════

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