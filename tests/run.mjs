import assert from "node:assert/strict";

import { loadFixture, runSource, translateSource } from "./helpers.mjs";

const cases = [
  ["basics fixture translates and runs", async () => {
    const source = loadFixture("basics");
    const { js, output, lineMap } = await runSource(source, { inputs: ["Mark"] });

    assert.match(js, /globalThis\.userid = 123;/);
    assert.match(js, /await __runtime\.input\("Enter your name: "\)/);
    assert.deepEqual(output, ["Hello Mark", "Score is 11", "big"]);
    assert.ok(lineMap.length > 0);
  }],
  ["loops and switch fixture runs with the expected control flow", async () => {
    const source = loadFixture("loops_switch");
    const { js, output } = await runSource(source, { inputs: ["x", "computer", "computer"] });

    assert.match(js, /for \(var i = 0; i <= 2; i\+\+\)/);
    assert.match(js, /while \(\(answer != "computer"\)\)/);
    assert.match(js, /switch \(answer\)/);
    assert.deepEqual(output, ["Loop 0", "Loop 1", "Loop 2", "Unlocked"]);
  }],
  ["arrays, strings, and virtual files translate and execute", async () => {
    const source = loadFixture("arrays_files");
    const { js, output, files } = await runSource(source);

    assert.match(js, /var names = new Array\(5\);/);
    assert.match(js, /Array\.from\(\{ length: 8 \}/);
    assert.match(js, /await __runtime\.openWrite\("sample\.txt"\)/);
    assert.deepEqual(output, ["Dana", "16", "put", "Hello World"]);
    assert.deepEqual(files.get("sample.txt"), ["Hello World"]);
  }],
  ["functions, procedures, classes, and inheritance execute", async () => {
    const source = loadFixture("subroutines_oop");
    const { js, output } = await runSource(source);

    assert.match(js, /async function triple\(number\)/);
    assert.match(js, /class Dog extends Pet/);
    assert.match(js, /super\(givenName\);/);
    assert.deepEqual(output, ["hello Hamish", "Fido - Scottish Terrier"]);
  }],
  ["comments and curly quotes normalize", () => {
    const source = `// leading comment\nprint(“hello”) // trailing comment`;
    const { js, lineMap } = translateSource(source);

    assert.equal(js.trim(), 'await __runtime.print("hello");');
    assert.deepEqual(lineMap, [2]);
  }],
  ["mapped source lines preserve the original pseudocode line numbers", () => {
    const source = `print("one")\nprint("two")\nprint("three")`;
    const { lineMap } = translateSource(source);

    assert.deepEqual(lineMap, [1, 2, 3]);
  }],
  ["missing endif is reported with the opening line number", () => {
    assert.throws(
      () => translateSource(`if x == 1 then\n  print("x")`),
      (error) => error.message === "Missing endif" && error.line === 1
    );
  }],
  ["missing endswitch is reported with the opening line number", () => {
    assert.throws(
      () => translateSource(`switch choice:\n  case "a":\n    print("a")`),
      (error) => error.message === "Missing endswitch" && error.line === 1
    );
  }],
  ["invalid array declarations are rejected", () => {
    assert.throws(
      () => translateSource("array board[1,2,3]"),
      (error) => error.message === "Only one- and two-dimensional arrays are supported" && error.line === 1
    );
  }],
  ["unrecognized statements are rejected", () => {
    assert.throws(
      () => translateSource("gibberish token"),
      (error) => /Unrecognised statement/.test(error.message) && error.line === 1
    );
  }],

  // --- arithmetic operators ---
  ["MOD, DIV, and ^ arithmetic produce correct results", async () => {
    const source = [
      "x = 12 MOD 5",
      "y = 17 DIV 5",
      "z = 3 ^ 4",
      "print(str(x))",
      "print(str(y))",
      "print(str(z))"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /\(12 % 5\)/);
    assert.match(js, /Math\.trunc\(/);
    assert.match(js, /\(3 \*\* 4\)/);
    assert.deepEqual(output, ["2", "3", "81"]);
  }],

  // --- casting ---
  ["int() and float() convert strings to numbers", async () => {
    const source = [
      'a = int("3")',
      'b = float("3.14")',
      "print(str(a))",
      "print(str(b))"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /Number\.parseInt\("3", 10\)/);
    assert.match(js, /Number\.parseFloat\("3\.14"\)/);
    assert.deepEqual(output, ["3", "3.14"]);
  }],

  // --- elseif branch ---
  ["elseif branch is taken when the first condition is false", async () => {
    const source = [
      'entry = "b"',
      'if entry == "a" then',
      '  print("A")',
      'elseif entry == "b" then',
      '  print("B")',
      "else",
      '  print("other")',
      "endif"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /\} else if/);
    assert.deepEqual(output, ["B"]);
  }],

  // --- byVal / byRef parameter stripping ---
  ["byVal and byRef annotations are stripped from parameters", async () => {
    const source = [
      "procedure foobar(x:byVal, y:byRef)",
      "  print(str(x + y))",
      "endprocedure",
      "foobar(3, 4)"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /async function foobar\(x, y\)/);
    assert.deepEqual(output, ["7"]);
  }],

  // --- missing block terminators ---
  ["missing endwhile is reported with the opening line number", () => {
    assert.throws(
      () => translateSource('while x < 5\n  print("loop")'),
      (error) => error.message === "Missing endwhile" && error.line === 1
    );
  }],

  ["missing next is reported with the opening line number", () => {
    assert.throws(
      () => translateSource('for i = 0 to 5\n  print("hi")'),
      (error) => error.message === "Missing next" && error.line === 1
    );
  }],

  ["missing endfunction is reported with the opening line number", () => {
    assert.throws(
      () => translateSource("function foo()\n  return 1"),
      (error) => error.message === "Missing function terminator" && error.line === 1
    );
  }],

  ["missing endprocedure is reported with the opening line number", () => {
    assert.throws(
      () => translateSource('procedure bar()\n  print("hi")'),
      (error) => error.message === "Missing procedure terminator" && error.line === 1
    );
  }],

  // --- class errors ---
  ["missing endclass is reported with the opening line number", () => {
    assert.throws(
      () => translateSource("class Foo\n  private name"),
      (error) => error.message === "Missing endclass" && error.line === 1
    );
  }],

  ["invalid statement in class body is rejected", () => {
    assert.throws(
      () => translateSource('class Foo\n  print("hello")\nendclass'),
      (error) => /Invalid class body statement/.test(error.message) && error.line === 2
    );
  }],

  // --- logical operators ---
  ["AND and OR operators produce correct boolean results", async () => {
    const source = [
      "x = 5",
      "y = 10",
      "if x > 3 AND y < 20 then",
      '  print("both")',
      "endif",
      "if x > 100 OR y < 20 then",
      '  print("either")',
      "endif"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /&&/);
    assert.match(js, /\|\|/);
    assert.deepEqual(output, ["both", "either"]);
  }],

  ["NOT operator in an if condition inverts the branch", async () => {
    const source = [
      "flag = false",
      "if NOT flag then",
      '  print("not set")',
      "endif"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /!\(flag\)/);
    assert.deepEqual(output, ["not set"]);
  }],

  // --- subtraction, division, unary minus ---
  ["subtraction, division, and unary minus produce correct results", async () => {
    const source = [
      "a = 10 - 3",
      "b = 15 / 3",
      "c = -7",
      "print(str(a))",
      "print(str(b))",
      "print(str(c))"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["7", "5", "-7"]);
  }],

  // --- 2D array element read-back ---
  ["2D array elements can be written and read back by index", async () => {
    const source = [
      "Array grid[3,3]",
      'grid[0,0] = "X"',
      'grid[1,2] = "O"',
      "print(grid[0,0])",
      "print(grid[1,2])"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /grid\[0\]\[0\]/);
    assert.deepEqual(output, ["X", "O"]);
  }],

  // --- class with no explicit constructor ---
  ["class with no new procedure gets an auto-generated constructor", async () => {
    const source = [
      "class Greeter",
      "  private message",
      "  public procedure setMessage(msg)",
      "    message = msg",
      "  endprocedure",
      "  public function getMessage()",
      "    return message",
      "  endfunction",
      "endclass",
      'g = new Greeter()',
      'g.setMessage("hello")',
      "print(g.getMessage())"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /constructor\(\.\.\.args\)/);
    assert.match(js, /this\.message = undefined;/);
    assert.deepEqual(output, ["hello"]);
  }],

  // --- zero-parameter subroutines ---
  ["functions and procedures with no parameters translate and execute", async () => {
    const source = [
      "function getAnswer()",
      "  return 42",
      "endfunction",
      "procedure sayHello()",
      '  print("hello")',
      "endprocedure",
      "result = getAnswer()",
      "print(str(result))",
      "sayHello()"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /async function getAnswer\(\)/);
    assert.match(js, /async function sayHello\(\)/);
    assert.deepEqual(output, ["42", "hello"]);
  }],

  // --- malformed control flow headers ---
  ["malformed if header without then is rejected", () => {
    assert.throws(
      () => translateSource('if x == 1\n  print("x")\nendif'),
      (error) => error.message === "Invalid if statement" && error.line === 1
    );
  }],

  ["malformed for loop header is rejected", () => {
    assert.throws(
      () => translateSource('for i 0 to 5\n  print("hi")\nnext i'),
      (error) => error.message === "Invalid for loop" && error.line === 1
    );
  }],

  // --- TRUE / FALSE / NULL literals ---
  ["TRUE, FALSE, and NULL literals translate and evaluate correctly", async () => {
    const source = [
      "a = TRUE",
      "b = FALSE",
      "c = NULL",
      "if a then",
      '  print("true")',
      "endif",
      "if NOT b then",
      '  print("not false")',
      "endif",
      "if c == NULL then",
      '  print("null")',
      "endif"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /var a = true;/);
    assert.match(js, /var b = false;/);
    assert.match(js, /var c = null;/);
    assert.deepEqual(output, ["true", "not false", "null"]);
  }],

  // --- >= operator ---
  ["the >= operator evaluates correctly at the boundary and above", async () => {
    const source = [
      "x = 5",
      "if x >= 5 then",
      '  print("at least 5")',
      "endif",
      "if x >= 6 then",
      '  print("at least 6")',
      "endif"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, />=/);
    assert.deepEqual(output, ["at least 5"]);
  }],

  // --- switch default branch ---
  ["switch default branch executes when no case matches", async () => {
    const source = [
      'choice = "other"',
      "switch choice:",
      '  case "a":',
      '    print("A")',
      '  case "b":',
      '    print("B")',
      "  default:",
      '    print("default")',
      "endswitch"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["default"]);
  }],

  // --- nested constructs ---
  ["nested for loops iterate in the correct order", async () => {
    const source = [
      "for i = 0 to 1",
      "  for j = 0 to 1",
      "    print(str(i) + str(j))",
      "  next j",
      "next i"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["00", "01", "10", "11"]);
  }],

  // --- auto-generated super() in derived constructor without explicit super.new() ---
  ["derived constructor without super.new() gets an auto-generated super call", async () => {
    const source = [
      "class Vehicle",
      "  private type",
      "  public procedure new(t)",
      "    type = t",
      "  endprocedure",
      "  public function getType()",
      "    return type",
      "  endfunction",
      "endclass",
      "class Car inherits Vehicle",
      "  private doors",
      "  public procedure new(t, d)",
      "    doors = d",
      "  endprocedure",
      "  public function describe()",
      '    return getType() + " with " + str(doors) + " doors"',
      "  endfunction",
      "endclass",
      'c = new Car("sedan", 4)',
      "print(c.describe())"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /super\(t, d\);/);
    assert.deepEqual(output, ["sedan with 4 doors"]);
  }],

  // --- string escape sequences ---
  ["string escape sequences are decoded in literals", async () => {
    const source = [
      'print("a\\tb")',
      'print("x\\\\y")'
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["a\tb", "x\\y"]);
  }],

  // --- new ClassName without parentheses ---
  ["new ClassName without parentheses instantiates correctly", async () => {
    const source = [
      "class Box",
      "  public function greet()",
      '    return "hello"',
      "  endfunction",
      "endclass",
      "b = new Box",
      "print(b.greet())"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /new Box\(\)/);
    assert.deepEqual(output, ["hello"]);
  }],

  // --- class field vs local variable in method body ---
  ["class field assignment uses this. while local variable uses var", async () => {
    const source = [
      "class Counter",
      "  private count",
      "  public procedure new()",
      "    count = 0",
      "  endprocedure",
      "  public procedure tick()",
      "    step = 1",
      "    count = count + step",
      "  endprocedure",
      "  public function get()",
      "    return count",
      "  endfunction",
      "endclass",
      "c = new Counter()",
      "c.tick()",
      "c.tick()",
      "print(str(c.get()))"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /var step = 1;/);
    assert.match(js, /this\.count = /);
    assert.deepEqual(output, ["2"]);
  }],

  // ── Bug fixes ────────────────────────────────────────────────────────────

  // Bug 1: descending for loop
  ["for loop with start > end runs in descending order", async () => {
    const source = [
      "for i = 3 to 1",
      "  print(str(i))",
      "next i"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /var i = 3; i >= 1; i--/);
    assert.deepEqual(output, ["3", "2", "1"]);
  }],

  // Bug 2: unclosed string literal
  ["unclosed string literal is rejected with a clear error", () => {
    assert.throws(
      () => translateSource('print("hello'),
      (error) => error.message === "Unclosed string literal"
    );
  }],

  // Bug 3: chained comparisons
  ["chained comparisons are rejected", () => {
    assert.throws(
      () => translateSource('if 1 < x < 5 then\n  print("yes")\nendif'),
      (error) => error.message === "Chained comparisons are not supported"
    );
  }],

  // Bug 4: return outside function
  ["return outside a function or procedure is rejected", () => {
    assert.throws(
      () => translateSource('print("a")\nreturn 42'),
      (error) => /return is not valid outside/.test(error.message) && error.line === 2
    );
  }],

  // Bug 5: number with multiple decimal points
  ["number with two decimal points is rejected", () => {
    assert.throws(
      () => translateSource("x = 3.14.159"),
      (error) => error.message === "Expected property name"
    );
  }],

  // ── Untested correct behaviour ────────────────────────────────────────────

  // print() / input() with no arguments
  ["print() with no arguments prints an empty string", async () => {
    const { js, output } = await runSource("print()");

    assert.match(js, /await __runtime\.print\(""\)/);
    assert.deepEqual(output, [""]);
  }],

  ["input() with no prompt uses an empty string", async () => {
    const source = "x = input()\nprint(x)";
    const { js, output } = await runSource(source, { inputs: ["hello"] });

    assert.match(js, /await __runtime\.input\(""\)/);
    assert.deepEqual(output, ["hello"]);
  }],

  ["while TRUE generates a valid infinite loop and can return from inside it", async () => {
    const source = [
      "function countToThree()",
      "  n = 0",
      "  while TRUE",
      "    n = n + 1",
      "    if n == 3 then",
      "      return n",
      "    endif",
      "  endwhile",
      "endfunction",
      "print(str(countToThree()))"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /while \(true\)/);
    assert.deepEqual(output, ["3"]);
  }],

  // return with no value / return in procedure
  ["return with no value exits the function early", async () => {
    const source = [
      "function test(n)",
      "  if n > 0 then",
      "    return",
      "  endif",
      '  print("reached")',
      "endfunction",
      "test(5)",
      "test(-1)"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /return ;/);
    assert.deepEqual(output, ["reached"]);
  }],

  ["return inside a procedure exits early", async () => {
    const source = [
      "procedure earlyOut()",
      '  print("before")',
      "  return",
      '  print("after")',
      "endprocedure",
      "earlyOut()"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["before"]);
  }],

  // empty procedure body
  ["empty procedure body is valid and callable", async () => {
    const source = [
      "procedure noop()",
      "endprocedure",
      "noop()",
      '  print("ok")'
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /async function noop\(\)/);
    assert.deepEqual(output, ["ok"]);
  }],

  // recursive function
  ["recursive function computes the correct result", async () => {
    const source = [
      "function sum(n)",
      "  if n <= 0 then",
      "    return 0",
      "  endif",
      "  return n + sum(n - 1)",
      "endfunction",
      "print(str(sum(4)))"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["10"]);
  }],

  // function hoisting — called before its definition in the source
  ["function called before its definition is hoisted and works", async () => {
    const source = [
      "result = getAnswer()",
      "print(str(result))",
      "function getAnswer()",
      "  return 42",
      "endfunction"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["42"]);
  }],

  // while FALSE / empty while body
  ["while FALSE body never executes", async () => {
    const source = [
      "while FALSE",
      '  print("never")',
      "endwhile",
      '  print("done")'
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /while \(false\)/);
    assert.deepEqual(output, ["done"]);
  }],

  ["empty while body is valid", async () => {
    const source = [
      "x = 5",
      "while x < 0",
      "endwhile",
      '  print("ok")'
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["ok"]);
  }],

  // global inside a function
  ["global declaration inside a procedure writes to globalThis", async () => {
    const source = [
      "procedure setGlobal()",
      "  global myVar = 42",
      "endprocedure",
      "setGlobal()",
      "print(str(globalThis.myVar))"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /globalThis\.myVar = 42/);
    assert.deepEqual(output, ["42"]);
  }],

  // comment boundary — // inside a string is not stripped
  ["double-slash inside a string is not treated as a comment", async () => {
    const { js, output } = await runSource('print("http://example.com")');

    assert.match(js, /await __runtime\.print\("http:\/\/example\.com"\)/);
    assert.deepEqual(output, ["http://example.com"]);
  }],

  // elseif / else variants
  ["elseif without then keyword is accepted", async () => {
    const source = [
      "x = 2",
      "if x == 1 then",
      '  print("one")',
      "elseif x == 2",
      '  print("two")',
      "endif"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["two"]);
  }],

  ["else with trailing condition text still behaves as a plain else", async () => {
    const source = [
      "x = 2",
      "if x == 1 then",
      '  print("one")',
      "else x == 2 then",
      '  print("two")',
      "endif"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /\} else \{/);
    assert.deepEqual(output, ["two"]);
  }],

  // array with variable size bound
  ["array declaration with a variable size bound works at runtime", async () => {
    const source = [
      "n = 4",
      "array items[n]",
      'items[0] = "first"',
      "print(items[0])"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /new Array\(n\)/);
    assert.deepEqual(output, ["first"]);
  }],

  // .length on a string literal
  [".length on a string literal returns the correct count", async () => {
    const source = [
      'x = "hello".length',
      "print(str(x))"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /"hello"\.length/);
    assert.deepEqual(output, ["5"]);
  }],

  ["member access after a call is parsed as a postfix chain", async () => {
    const source = [
      'x = "hello".substring(1, 4).length',
      "print(str(x))"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /\("hello"\)\.substring\(1, \(1\) \+ \(4\)\)\.length/);
    assert.deepEqual(output, ["4"]);
  }],

  // NOT NOT double negation
  ["NOT NOT reverses a boolean back to its original value", async () => {
    const source = [
      "flag = FALSE",
      "if NOT NOT flag then",
      '  print("double negation true")',
      "else",
      '  print("still false")',
      "endif"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /!\(/);
    assert.deepEqual(output, ["still false"]);
  }],

  // \n escape in string literal
  ["\\n escape in a string literal produces a newline character", async () => {
    const source = 'print("hello\\nworld")';
    const { output } = await runSource(source);

    assert.deepEqual(output, ["hello\nworld"]);
  }],

  ["\\r escape in a string literal produces a carriage return", async () => {
    const source = 'print("a\\rb")';
    const { output } = await runSource(source);

    assert.deepEqual(output, ["a\rb"]);
  }]
];

let failed = 0;

for (const [name, fn] of cases) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

if (failed) {
  console.error(`\n${failed} test${failed === 1 ? "" : "s"} failed.`);
  process.exitCode = 1;
} else {
  console.log(`\n${cases.length} tests passed.`);
}
