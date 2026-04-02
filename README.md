# ScaleArch Rule Builder

A visual, zero-dependency web tool for creating custom linting rules for the [ScaleArch VSCode extension](https://github.com/Udayverma0906/ScaleArch) — without writing boilerplate TypeScript by hand.

![ScaleArch Rule Builder](assets/images/icon.png)

---

## What it does

ScaleArch Rule Builder generates production-ready TypeScript code you can paste directly into your ScaleArch extension's `customRules.ts`. It supports two rule types:

- **Regex Rules** — line-by-line pattern matching (great for SQL, banned APIs, hardcoded secrets)
- **AST Rules** — structure-aware checks using the Abstract Syntax Tree (great for empty functions, long parameter lists, method counts)

You fill out a form, test your pattern, and copy the generated code. No compilation, no Node.js, no frameworks.

---

## Features

- **54 built-in patterns** across Database, Security, Performance, and Code Quality categories — one click to pre-fill the entire form
- **Regex context modes**: single-line, loop-aware, async-aware, class-aware, and multi-line (25-line window)
- **AST check types**: empty body, parameter count, method count, function length, specific callee/declaration/method name detection
- **Language targeting**: JS/TS, Python, Java, C/C++, or all languages
- **Live regex tester** — test your pattern against sample input before generating
- **Verify with Claude** — auto-generates a verification prompt and opens Claude.ai for a second opinion
- **Quality gate** — warns before copy if message or hint text is too short
- **4-step progress UI** with dark/light mode (preference saved to localStorage)

---



## How to use

1. **Define your rule** — pick a category, enter a kebab-case name (e.g. `no-raw-sql`), write a short message and a detailed hint, choose severity
2. **Configure detection** — select Regex or AST, pick a context mode or AST check type, enter your pattern or threshold
3. **Generate code** — click Generate, test with the regex tester if needed, then click Copy
4. **Paste and go** — open `src/rules/customRules.ts` in the ScaleArch extension, paste into the correct section, press F5 to test

Or start from the **Pattern Library** — search by keyword or filter by category, click a pattern to pre-fill the form, then tweak and generate.

---

## Generated code structure

**Regex rule** (added to `CUSTOM_REGEX_RULES`):

```typescript
{
  id: 'database/no-raw-sql',
  category: 'database',
  severity: vscode.DiagnosticSeverity.Error,
  message: 'Raw SQL detected — use QueryBuilder instead',
  hint: 'Raw SQL bypasses query logging and type safety...',
  languages: ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'],
  test: (line, allLines, lineIndex) => {
    if (!/SELECT\s+\*/i.test(line)) return false;
    return true;
  },
},
```

**AST rule** (paste the function above `CUSTOM_AST_CHECKS`, then add its name to the array):

```typescript
export function checkLongFunction(node: any): RuleResult | null {
  if (!['FunctionDeclaration', 'ArrowFunctionExpression'].includes(node.type)) return null;
  if (!node.loc) return null;
  const lines = node.loc.end.line - node.loc.start.line + 1;
  if (lines <= 50) return null;
  const s = node.loc?.start ?? { line: 0, column: 0 };
  const e = node.loc?.end   ?? { line: 0, column: 0 };
  const range = new vscode.Range(s.line - 1, s.column, e.line - 1, e.column);
  return {
    range,
    code: 'code-quality/long-function',
    message: 'Function exceeds 50 lines',
    hint: 'Break this into smaller, composable functions...',
    severity: vscode.DiagnosticSeverity.Warning,
  };
}
```

---

## Project structure

```
extension UI/
├── index.html              # Full UI — form, panels, modals
├── style.css               # Dark/light theme, all component styles
├── js/
│   ├── script.js           # Core logic: state, code generation, pattern library
│   ├── popup.js            # Reusable modal registry and lifecycle
│   └── verify-rule.js      # Claude verification prompt generation
├── data/
│   ├── pattern-library.json   # 54 pre-built patterns
│   └── ast-nodes.json         # AST node type definitions and examples
├── modals/
│   └── help-modal.html        # Help system content (dynamically injected)
└── assets/images/
    └── icon.png
```

---

## Tech stack

Pure vanilla HTML/CSS/JavaScript — no framework, no build step, no package manager.

| Layer | Tech |
|-------|------|
| Structure | HTML5 |
| Styling | CSS3 with custom properties (dark/light themes) |
| Logic | Vanilla JS (ES6) |
| Fonts | IBM Plex Mono · Syne (Google Fonts) |
| Data | JSON |

---

## Rule categories

| Category | Examples |
|----------|---------|
| Database | `SELECT *`, missing `WHERE`, N+1 queries, raw SQL |
| Security | Hardcoded secrets, `eval()`, weak hashing, SQL injection |
| Performance | Sync file I/O, memory leaks, inefficient loops |
| Code quality | Unused vars, type checks, complexity |
| SOLID | Large classes, single-responsibility violations |

---

## Contributing

1. Fork the repo
2. Edit files directly (no build step needed)
3. Test by opening with a local HTTP server
4. Add new patterns to `data/pattern-library.json` following the existing schema
5. Submit a PR

---

## Related

- [ScaleArch VSCode Extension](https://github.com/Udayverma0906/ScaleArch) — the extension this tool generates rules for

---

## Author

[Uday Verma](https://github.com/Udayverma0906)
