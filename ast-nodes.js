// ══════════════════════════════════════════════════════
//  AST Node Definitions for ScaleArch Rule Builder
//  Add new AST nodes here to extend the rule builder
// ══════════════════════════════════════════════════════

const AST_NODES = [
  {
    id: 'FunctionDeclaration',
    desc: 'A named function defined with the function keyword at the statement level.',
    example: 'function greet(name) {\n  return "Hello " + name;\n}',
    props: ['node.id.name (fn name)', 'node.params (param list)', 'node.body (block)', 'node.async', 'node.loc (line numbers)'],
  },
  {
    id: 'ArrowFunctionExpression',
    desc: 'An arrow function assigned to a variable or passed as a callback. Has no own "this".',
    example: 'const greet = (name) => {\n  return "Hello " + name;\n};\n\nconst add = (a, b) => a + b;',
    props: ['node.params', 'node.body', 'node.async', 'node.expression (true if body is not a block)'],
  },
  {
    id: 'FunctionExpression',
    desc: 'A function assigned to a variable or used as a value (not a declaration).',
    example: 'const greet = function(name) {\n  return "Hello " + name;\n};',
    props: ['node.id.name (optional name)', 'node.params', 'node.body', 'node.async'],
  },
  {
    id: 'ClassDeclaration',
    desc: 'A class defined at the statement level with a name.',
    example: 'class OrderService {\n  constructor(repo) {\n    this.repo = repo;\n  }\n  getOrder(id) { ... }\n}',
    props: ['node.id.name (class name)', 'node.body.body (method list)', 'node.superClass'],
  },
  {
    id: 'MethodDefinition',
    desc: 'A method inside a class body — including constructor, getters, setters, and regular methods.',
    example: 'class Foo {\n  myMethod() { ... }  // ← MethodDefinition\n  get value() { ... } // ← MethodDefinition (kind: "get")\n}',
    props: ['node.key.name (method name)', 'node.kind ("constructor"|"method"|"get"|"set")', 'node.static', 'node.value (the function)'],
  },
  {
    id: 'CatchClause',
    desc: 'The catch block of a try/catch statement. Useful for detecting empty or silent catches.',
    example: 'try {\n  riskyOp();\n} catch (e) {     // ← CatchClause\n  // empty — bad!\n}',
    props: ['node.param (the error variable, e.g. e)', 'node.body.body (statements inside catch)'],
  },
  {
    id: 'CallExpression',
    desc: 'Any function or method call — e.g. fetch(), console.log(), obj.method(). Most common for banning specific API calls.',
    example: 'fetch("/api/users")       // ← CallExpression\nconsole.log("debug")      // ← CallExpression\nobj.dangerousMethod()     // ← CallExpression',
    props: ['node.callee.name (fn name, e.g. "fetch")', 'node.callee.property.name (method name)', 'node.arguments (arg list)'],
  },
  {
    id: 'NewExpression',
    desc: 'A constructor call using the new keyword.',
    example: 'const repo = new OrderRepository();\nconst d    = new Date();',
    props: ['node.callee.name (class name)', 'node.arguments'],
  },
  {
    id: 'Literal',
    desc: 'Any literal value in the source — string, number, boolean, null, or regex. Good for detecting magic numbers or repeated strings.',
    example: 'const x = 42;           // Literal (number)\nconst s = "hello";      // Literal (string)\nconst b = true;         // Literal (boolean)',
    props: ['node.value (the actual value)', 'node.raw (the raw source text)', 'typeof node.value for type check'],
  },
  {
    id: 'BlockStatement',
    desc: 'Any block of code wrapped in curly braces — function bodies, if/else bodies, loop bodies.',
    example: 'if (condition) {\n  doThing(); // ← inside a BlockStatement\n}',
    props: ['node.body (array of statements inside)', 'node.body.length (count statements)'],
  },
  {
    id: 'IfStatement',
    desc: 'An if/else conditional statement. Useful for complexity checks.',
    example: 'if (a > 0) {\n  ...\n} else if (b > 0) {\n  ...\n}',
    props: ['node.test (the condition)', 'node.consequent (if body)', 'node.alternate (else body, or null)'],
  },
  {
    id: 'ImportDeclaration',
    desc: 'An ES module import statement. Use to count imports or detect banned dependencies.',
    example: 'import React from "react";\nimport { db } from "@company/db";',
    props: ['node.source.value (the module path, e.g. "@company/db")', 'node.specifiers (what is imported)'],
  },
  {
    id: 'VariableDeclaration',
    desc: 'A variable declaration using let, const, or var.',
    example: 'const x = 10;     // VariableDeclaration (kind: "const")\nlet name = "foo"; // VariableDeclaration (kind: "let")',
    props: ['node.kind ("const"|"let"|"var")', 'node.declarations (array of declarators)'],
  },
];