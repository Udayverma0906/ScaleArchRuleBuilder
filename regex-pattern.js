// ══════════════════════════════════════════════════════
//  PATTERN LIBRARY  — regex-pattern.js
//  Used by the ScaleArch Rule Builder website.
//
//  Each entry has an optional `language` field that maps
//  to the ruleLanguage dropdown in the UI:
//    'all'    → no languages field in generated rule (fires on everything)
//    'js-ts'  → languages: ['typescript','javascript','typescriptreact','javascriptreact']
//    'python' → languages: ['python']
//    'java'   → languages: ['java']
//    'cpp'    → languages: ['cpp','c']
//
//  Patterns with multiline context also carry:
//    multilineAnchor, multilineCount, multilineThreshold
// ══════════════════════════════════════════════════════

const PATTERN_LIBRARY = [

  // ══════════════════════════════════════════════════════
  //  DATABASE  (all languages — SQL strings appear anywhere)
  // ══════════════════════════════════════════════════════
  {
    name: 'SELECT *',
    category: 'database',
    language: 'all',
    pattern: 'select\\s+\\*',
    message: 'Avoid SELECT * — fetch only the columns you need',
    hint: 'SELECT * fetches all columns including unused ones, wastes bandwidth and prevents index-only scans.',
    context: 'none',
  },
  {
    name: 'SELECT without WHERE',
    category: 'database',
    language: 'all',
    pattern: 'select\\s+[\\w\\s,*]+from\\s+\\w+\\s*[`;]',
    message: 'SELECT without WHERE — possible full table scan',
    hint: 'Without a WHERE clause every row is scanned. Add a filter or ensure this is intentional.',
    context: 'none',
  },
  {
    name: 'No LIMIT clause',
    category: 'database',
    language: 'all',
    pattern: '\\bselect\\b(?!.*\\blimit\\b)(?!.*count\\s*\\()',
    message: 'No LIMIT clause — risk of fetching a huge result set',
    hint: 'Always paginate results. Add LIMIT (and OFFSET) to control how many rows are returned.',
    context: 'none',
  },
  {
    name: 'Leading wildcard LIKE',
    category: 'database',
    language: 'all',
    pattern: 'like\\s+[\x27\x22%]%',
    message: "Leading wildcard LIKE '%...' disables index usage",
    hint: "A leading % forces a full scan. Use full-text search or a search engine for this pattern.",
    context: 'none',
  },
  {
    name: 'More than 5 JOINs (multi-line)',
    category: 'database',
    language: 'all',
    pattern: '\\bSELECT\\b',
    message: 'More than 5 JOINs detected — consider refactoring',
    hint: 'Queries with 6+ JOINs are expensive. Add indexes on JOIN columns, break into subqueries, or use a view.',
    context: 'multiline-keyword',
    multilineAnchor: 'SELECT',
    multilineCount: 'JOIN',
    multilineThreshold: 5,
  },
  {
    name: 'Subquery inside IN clause',
    category: 'database',
    language: 'all',
    pattern: '\\bIN\\s*\\(\\s*SELECT\\b',
    message: 'Subquery inside IN() — consider EXISTS or a JOIN instead',
    hint: 'IN (SELECT ...) is often slower than EXISTS() or a JOIN, especially on large datasets.',
    context: 'none',
  },
  {
    name: 'SQL query in a loop (N+1)',
    category: 'database',
    language: 'all',
    pattern: '\\bselect\\b',
    message: 'SQL query inside a loop — classic N+1 problem',
    hint: 'Each iteration fires a separate DB round-trip. Use a JOIN, batch query (WHERE id IN (...)), or a dataloader instead.',
    context: 'loop',
  },
  {
    name: 'DELETE without WHERE',
    category: 'database',
    language: 'all',
    pattern: '\\bDELETE\\s+FROM\\s+\\w+\\s*[`;]',
    message: 'DELETE without WHERE — this will wipe the entire table',
    hint: 'A DELETE without a WHERE clause deletes every row. Always add a WHERE clause unless you explicitly want to truncate.',
    context: 'none',
  },
  {
    name: 'UPDATE without WHERE',
    category: 'database',
    language: 'all',
    pattern: '\\bUPDATE\\s+\\w+\\s+SET\\b(?!.*\\bWHERE\\b)',
    message: 'UPDATE without WHERE — will update every row in the table',
    hint: 'A WHERE clause is almost always required on UPDATE. Double-check this is intentional.',
    context: 'none',
  },

  // ══════════════════════════════════════════════════════
  //  SECURITY  (all languages — secrets appear anywhere)
  // ══════════════════════════════════════════════════════
  {
    name: 'Hardcoded API key or secret',
    category: 'security',
    language: 'all',
    pattern: '(password|secret|api_key|apikey|token|auth)\\s*[:=]\\s*[\x27\x22][^\x27\x22]{6,}',
    message: 'Possible hardcoded secret detected',
    hint: 'Move secrets to environment variables or a secrets manager (AWS SSM, HashiCorp Vault).',
    context: 'none',
  },
  {
    name: 'Hardcoded IP address',
    category: 'security',
    language: 'all',
    pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b',
    message: 'Hardcoded IP address detected',
    hint: 'Hardcoded IPs make deployments fragile and may expose internal infrastructure. Use environment variables or service discovery.',
    context: 'none',
  },
  {
    name: 'SQL string concatenation (injection risk)',
    category: 'security',
    language: 'all',
    pattern: '(SELECT|INSERT|UPDATE|DELETE).*\\+\\s*(\\w+|[\x27\x22])',
    message: 'SQL built with string concatenation — injection risk',
    hint: 'Building SQL with + opens the door to SQL injection. Use parameterised queries or a query builder with bound parameters.',
    context: 'none',
  },

  // ── JS/TS security ──
  {
    name: 'eval() usage',
    category: 'security',
    language: 'js-ts',
    pattern: '\\beval\\s*\\(',
    message: 'eval() is a security risk — avoid it',
    hint: 'eval() executes arbitrary code and can be exploited via injection. Use JSON.parse() for data or restructure the logic.',
    context: 'none',
  },
  {
    name: 'MD5 hashing (weak)',
    category: 'security',
    language: 'js-ts',
    pattern: '\\bmd5\\s*\\(',
    message: 'MD5 is cryptographically broken — use SHA-256 or bcrypt',
    hint: 'MD5 collisions are trivial to generate. Use crypto.subtle.digest("SHA-256", ...) for hashing or bcrypt for passwords.',
    context: 'none',
  },
  {
    name: 'console.log with sensitive words',
    category: 'security',
    language: 'js-ts',
    pattern: 'console\\.(log|warn|info|debug)\\s*\\(.*\\b(password|secret|token|apikey|api_key|auth|credential|private_key)\\b',
    message: 'Logging potentially sensitive data',
    hint: 'Logging secrets or credentials can expose them in log aggregators. Redact sensitive fields before logging.',
    context: 'none',
  },

  // ══════════════════════════════════════════════════════
  //  PERFORMANCE  (JS/TS only)
  // ══════════════════════════════════════════════════════
  {
    name: 'Synchronous fs call',
    category: 'performance',
    language: 'js-ts',
    pattern: '\\bfs\\.(readFileSync|writeFileSync|existsSync|readdirSync|mkdirSync)\\b',
    message: 'Synchronous fs call blocks the event loop',
    hint: 'Use the async version: readFileSync → readFile, writeFileSync → writeFile. Sync calls block all other requests.',
    context: 'none',
  },
  {
    name: 'JSON.parse in a loop',
    category: 'performance',
    language: 'js-ts',
    pattern: 'JSON\\.parse\\s*\\(',
    message: 'JSON.parse() inside a loop — expensive repeated parsing',
    hint: 'Parse once outside the loop and reuse the result.',
    context: 'loop',
  },
  {
    name: 'setTimeout with 0ms',
    category: 'performance',
    language: 'js-ts',
    pattern: 'setTimeout\\s*\\(.*,\\s*0\\s*\\)',
    message: 'setTimeout(fn, 0) is unreliable — use queueMicrotask()',
    hint: '0ms delay is not guaranteed to be immediate and adds scheduler overhead. Use queueMicrotask() for microtask scheduling.',
    context: 'none',
  },
  {
    name: 'new object inside loop',
    category: 'performance',
    language: 'js-ts',
    pattern: '(new\\s+\\w+\\(|\\[\\s*\\]|\\{\\s*\\})',
    message: 'Object/array created inside a loop — GC pressure',
    hint: 'Allocate outside the loop and reuse or clear per iteration to reduce garbage collection overhead.',
    context: 'loop',
  },
  {
    name: 'await inside loop (serial)',
    category: 'performance',
    language: 'js-ts',
    pattern: '\\bawait\\b',
    message: 'await inside a loop runs promises serially — use Promise.all()',
    hint: 'Each await blocks the next iteration. Collect promises in an array and resolve with Promise.all([...]) for parallel execution.',
    context: 'loop',
  },
  {
    name: 'console.log left in code',
    category: 'performance',
    language: 'js-ts',
    pattern: 'console\\.(log|warn|info)\\s*\\(',
    message: 'console.log() left in code — remove before production',
    hint: 'Use a proper logger (winston, pino) that can be disabled in production via log level.',
    context: 'none',
  },

  // ══════════════════════════════════════════════════════
  //  CODE QUALITY  (JS/TS only — language-specific syntax)
  // ══════════════════════════════════════════════════════
  {
    name: 'TODO / FIXME comment',
    category: 'code-quality',
    language: 'js-ts',
    pattern: '\\b(TODO|FIXME|HACK|XXX)\\b',
    message: 'TODO/FIXME comment left in code',
    hint: 'Track outstanding work in your issue tracker, not in code comments. TODOs in code often get forgotten.',
    context: 'none',
  },
  {
    name: 'Debugger statement',
    category: 'code-quality',
    language: 'js-ts',
    pattern: '\\bdebugger\\b',
    message: 'debugger statement left in code',
    hint: 'Remove debugger statements before committing. They pause execution in any browser with DevTools open.',
    context: 'none',
  },
  {
    name: 'var declaration',
    category: 'code-quality',
    language: 'js-ts',
    pattern: '\\bvar\\s+',
    message: 'Avoid var — use const or let instead',
    hint: 'var is function-scoped and hoisted, leading to subtle bugs. Use const by default and let when reassignment is needed.',
    context: 'none',
  },
  {
    name: 'Double equals (==)',
    category: 'code-quality',
    language: 'js-ts',
    pattern: '(?<!=)={2}(?!=)',
    message: 'Loose equality (==) — use strict equality (===) instead',
    hint: '== performs type coercion which leads to unexpected results (e.g. 0 == "" is true). Always use === for comparisons.',
    context: 'none',
  },
  {
    name: 'Magic number',
    category: 'code-quality',
    language: 'js-ts',
    pattern: '(?<![a-zA-Z0-9_.])(?!0\\b|1\\b|-1\\b)\\d{2,}(?![a-zA-Z0-9_])',
    message: 'Magic number detected — extract to a named constant',
    hint: 'Numbers with no explanation make code hard to understand. Extract to: const MAX_RETRIES = 5 and reference the constant.',
    context: 'none',
  },
  {
    name: 'Raw fetch() call',
    category: 'code-quality',
    language: 'js-ts',
    pattern: '\\bfetch\\s*\\(',
    message: 'Raw fetch() — use your internal HttpClient wrapper instead',
    hint: 'Direct fetch() calls bypass auth token injection, retry logic, and error logging. Use the shared HttpClient from your core library.',
    context: 'none',
  },

  // ══════════════════════════════════════════════════════
  //  PYTHON
  // ══════════════════════════════════════════════════════

  // ── Python performance ──
  {
    name: 'print() in production',
    category: 'performance',
    language: 'python',
    pattern: '^\\s*print\\s*\\(',
    message: 'print() left in code — use the logging module instead',
    hint: 'print() has no log levels and cannot be silenced in production. Use logging.debug(), logging.info() etc.',
    context: 'none',
  },
  {
    name: 'New object inside loop (Python)',
    category: 'performance',
    language: 'python',
    pattern: '=\\s*\\[\\s*\\]|=\\s*\\{\\s*\\}|=\\s*\\(\\s*\\)',
    message: 'Object allocated inside a loop — consider moving outside',
    hint: 'Creating new lists/dicts on every iteration adds GC pressure. Allocate once before the loop and reset per iteration.',
    context: 'loop',
  },

  // ── Python code quality ──
  {
    name: 'Bare except:',
    category: 'code-quality',
    language: 'python',
    pattern: '^\\s*except\\s*:',
    message: 'Bare except: catches everything including KeyboardInterrupt and SystemExit',
    hint: 'Specify the exception type: except ValueError: or except (TypeError, ValueError):. Bare except: swallows errors silently.',
    context: 'none',
  },
  {
    name: 'Mutable default argument',
    category: 'code-quality',
    language: 'python',
    pattern: 'def\\s+\\w+\\s*\\(.*=\\s*(\\[\\s*\\]|\\{\\s*\\}|\\(\\s*\\))',
    message: 'Mutable default argument — shared across all calls',
    hint: 'Default arguments are evaluated once at definition time. Use None: def fn(items=None): items = items or []',
    context: 'none',
  },
  {
    name: 'Broad Exception catch',
    category: 'code-quality',
    language: 'python',
    pattern: '^\\s*except\\s+Exception\\s*(:|(\\s+as\\s))',
    message: 'Catching broad Exception — use a more specific type',
    hint: 'Catching Exception masks unexpected errors. Catch only the specific exceptions you can handle (e.g. ValueError, IOError).',
    context: 'none',
  },
  {
    name: 'assert in production',
    category: 'code-quality',
    language: 'python',
    pattern: '^\\s*assert\\s+',
    message: 'assert is disabled when Python runs with -O (optimise flag)',
    hint: 'assert is stripped in optimised builds. Use explicit if/raise for runtime validation that must hold in production.',
    context: 'none',
  },

  // ── Python security ──
  {
    name: 'eval() usage (Python)',
    category: 'security',
    language: 'python',
    pattern: '\\beval\\s*\\(',
    message: 'eval() is a security risk — avoid it',
    hint: 'eval() executes arbitrary Python code. Use ast.literal_eval() for safe data parsing instead.',
    context: 'none',
  },
  {
    name: 'exec() usage',
    category: 'security',
    language: 'python',
    pattern: '\\bexec\\s*\\(',
    message: 'exec() executes arbitrary code — security risk',
    hint: 'exec() is rarely justified and hard to audit. Use a dict of callables for dynamic dispatch instead.',
    context: 'none',
  },
  {
    name: 'subprocess shell=True',
    category: 'security',
    language: 'python',
    pattern: '\\bsubprocess\\b.*\\bshell\\s*=\\s*True',
    message: 'shell=True in subprocess is a command-injection risk',
    hint: 'shell=True passes the command through the shell. Pass a list instead: subprocess.run(["cmd", "arg"])',
    context: 'none',
  },

  // ══════════════════════════════════════════════════════
  //  JAVA
  // ══════════════════════════════════════════════════════

  // ── Java performance ──
  {
    name: 'System.out.println',
    category: 'performance',
    language: 'java',
    pattern: 'System\\s*\\.\\s*out\\s*\\.\\s*print(ln)?\\s*\\(',
    message: 'System.out.println() left in code — use a logger instead',
    hint: 'System.out.println is synchronous and has no log levels. Use SLF4J or Log4j2: logger.debug(), logger.info() etc.',
    context: 'none',
  },
  {
    name: 'String concatenation in loop (Java)',
    category: 'performance',
    language: 'java',
    pattern: '^\\s*\\w+\\s*\\+=|String\\b.*\\+\\s*\\w+',
    message: 'String concatenation with + inside a loop — use StringBuilder',
    hint: 'Each + creates a new String object. Use StringBuilder.append() inside loops and call toString() once at the end.',
    context: 'loop',
  },
  {
    name: 'New object in loop (Java)',
    category: 'performance',
    language: 'java',
    pattern: '=\\s*new\\s+\\w+',
    message: 'Object instantiation inside a loop — move outside if reusable',
    hint: 'Creating objects in tight loops increases GC pressure. Move the allocation before the loop and reset per iteration.',
    context: 'loop',
  },

  // ── Java code quality ──
  {
    name: 'Empty catch block (Java)',
    category: 'code-quality',
    language: 'java',
    pattern: '^\\s*catch\\s*\\(',
    message: 'Empty catch block — exception is silently swallowed',
    hint: 'At minimum log the exception: catch (Exception e) { logger.error("Error", e); }. Silent catches hide bugs.',
    context: 'none',
  },
  {
    name: 'Catch generic Exception (Java)',
    category: 'code-quality',
    language: 'java',
    pattern: 'catch\\s*\\(\\s*Exception\\s+\\w+\\s*\\)',
    message: 'Catching generic Exception — use a more specific type',
    hint: 'Catching Exception masks unexpected errors. Catch only the specific exceptions you expect (e.g. IOException, SQLException).',
    context: 'none',
  },
  {
    name: 'Raw types (Java)',
    category: 'code-quality',
    language: 'java',
    pattern: '\\b(List|Map|Set|ArrayList|HashMap|HashSet)\\s+\\w+\\s*=(?!.*<)',
    message: 'Raw type used — add a generic type parameter',
    hint: 'Raw types (List, Map without <T>) bypass compile-time type checking. Use List<String>, Map<String, Integer> etc.',
    context: 'none',
  },

  // ── Java security ──
  {
    name: 'Hardcoded secret (Java)',
    category: 'security',
    language: 'java',
    pattern: '(password|secret|apiKey|api_key|token|auth)\\s*=\\s*"[^"]{6,}"',
    message: 'Possible hardcoded secret in Java code',
    hint: 'Move secrets to environment variables, application.properties, or a secrets manager.',
    context: 'none',
  },
  {
    name: 'SQL string concatenation (Java)',
    category: 'security',
    language: 'java',
    pattern: '(SELECT|INSERT|UPDATE|DELETE).*"\\s*\\+',
    message: 'SQL built with string concatenation — SQL injection risk',
    hint: 'Use PreparedStatement with ? placeholders instead of concatenating user input into SQL strings.',
    context: 'none',
  },

  // ══════════════════════════════════════════════════════
  //  C / C++
  // ══════════════════════════════════════════════════════

  // ── C/C++ performance ──
  {
    name: 'std::cout in production',
    category: 'performance',
    language: 'cpp',
    pattern: '\\bstd\\s*::\\s*cout\\b|\\bcout\\s*<<',
    message: 'std::cout left in code — use a proper logging framework',
    hint: "std::cout is synchronous and not thread-safe for production. Use spdlog, glog, or your project's logging framework.",
    context: 'none',
  },
  {
    name: 'printf in production',
    category: 'performance',
    language: 'cpp',
    pattern: '\\bprintf\\s*\\(',
    message: 'printf() left in code — use a proper logging framework',
    hint: "printf() has no log levels and cannot be filtered in production. Use your project's logging framework.",
    context: 'none',
  },

  // ── C/C++ code quality ──
  {
    name: 'Raw new (no smart pointer)',
    category: 'code-quality',
    language: 'cpp',
    pattern: '=\\s*new\\s+\\w+(?!.*make_unique|.*make_shared)',
    message: 'Raw new — prefer smart pointers (unique_ptr / shared_ptr)',
    hint: 'Manual new/delete is error-prone. Use std::make_unique<T>() or std::make_shared<T>() instead.',
    context: 'none',
  },
  {
    name: 'Raw delete',
    category: 'code-quality',
    language: 'cpp',
    pattern: '^\\s*delete\\s+',
    message: 'Raw delete — prefer smart pointers to manage object lifetime',
    hint: 'Manual delete is error-prone (double-free, use-after-free). Let std::unique_ptr or std::shared_ptr handle lifetime via RAII.',
    context: 'none',
  },
  {
    name: '#define constant (use constexpr)',
    category: 'code-quality',
    language: 'cpp',
    pattern: '^\\s*#\\s*define\\s+[A-Z_]+\\s+(\\d+|")',
    message: '#define used for a constant — use const or constexpr instead',
    hint: '#define has no type safety and no scope. Prefer: constexpr int MAX_SIZE = 100;',
    context: 'none',
  },
  {
    name: 'using namespace std',
    category: 'code-quality',
    language: 'cpp',
    pattern: '^\\s*using\\s+namespace\\s+std\\s*;',
    message: '"using namespace std" pollutes the global namespace',
    hint: 'In header files this forces the namespace on every file that includes yours. Use explicit prefixes (std::vector) instead.',
    context: 'none',
  },
  {
    name: 'C-style cast',
    category: 'code-quality',
    language: 'cpp',
    pattern: '\\(\\s*(int|float|double|char|long|short|void\\s*\\*)\\s*\\)\\s*\\w+',
    message: 'C-style cast — use static_cast, dynamic_cast, or reinterpret_cast',
    hint: 'C-style casts are unchecked. C++ named casts make intent explicit and are verified at compile time.',
    context: 'none',
  },

  // ── C/C++ security ──
  {
    name: 'gets() — buffer overflow',
    category: 'security',
    language: 'cpp',
    pattern: '\\bgets\\s*\\(',
    message: 'gets() is dangerous — causes buffer overflow',
    hint: 'gets() has no bounds checking and was removed in C11/C++14. Use fgets(buf, sizeof(buf), stdin) instead.',
    context: 'none',
  },
  {
    name: 'strcpy() — no bounds check',
    category: 'security',
    language: 'cpp',
    pattern: '\\bstrcpy\\s*\\(',
    message: 'strcpy() has no bounds checking — use strncpy() or std::string',
    hint: 'strcpy() can overflow the destination buffer. Use strncpy(dest, src, sizeof(dest)-1) or prefer std::string in C++.',
    context: 'none',
  },
  {
    name: 'sprintf() — no bounds check',
    category: 'security',
    language: 'cpp',
    pattern: '\\bsprintf\\s*\\(',
    message: 'sprintf() has no bounds checking — use snprintf()',
    hint: 'sprintf() can overflow the buffer. Use snprintf(buf, sizeof(buf), ...) which limits the output length.',
    context: 'none',
  },
];