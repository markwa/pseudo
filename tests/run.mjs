import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { loadFixture, runSource, translateSource } from "./helpers.mjs";

function loadTestcase(name, language = "ocr") {
  return readFileSync(new URL(`./testcases/${name}.${language === "python" ? "py" : "ocr"}`, import.meta.url), "utf8");
}

function loadSortInputLines(folder) {
  return readFileSync(
    new URL(`./testcases/sorting/${folder}/unsorted.txt`, import.meta.url),
    "utf8"
  ).split(/\r?\n/);
}

function loadSearchInputLines() {
  return readFileSync(
    new URL("./testcases/searching/common/search.txt", import.meta.url),
    "utf8"
  ).split(/\r?\n/);
}

async function loadAppOptions() {
  const previousVue = globalThis.Vue;
  const captured = {};
  const token = `${Date.now()}-${Math.random()}`;
  globalThis.Vue = {
    createApp(options) {
      captured.options = options;
      return {
        mount() {}
      };
    }
  };
  try {
    await import(new URL(`../app.js?test=${token}`, import.meta.url).href);
  } finally {
    globalThis.Vue = previousVue;
  }
  if (!captured.options) {
    throw new Error("Failed to capture app options");
  }
  return captured.options;
}

function buildAppInstance(options, overrides = {}) {
  const state = typeof options.data === "function" ? options.data.call({}) : {};
  const instance = {
    ...state,
    ...overrides
  };

  instance.$refs = overrides.$refs || {};
  instance.$nextTick = overrides.$nextTick || ((fn) => {
    if (typeof fn === "function") {
      fn();
    }
  });

  for (const [name, getter] of Object.entries(options.computed || {})) {
    Object.defineProperty(instance, name, {
      enumerable: true,
      get: () => getter.call(instance)
    });
  }

  for (const [name, method] of Object.entries(options.methods || {})) {
    instance[name] = method.bind(instance);
  }

  return instance;
}

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

    assert.match(js, /var i = 0; __runtime\.trackVar\("i", i\);/);
    assert.match(js, /for \(; i <= 2; i\+\+, __runtime\.trackVar\("i", i\)\)/);
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
  ["python basics fixture translates and runs", async () => {
    const source = loadFixture("basics", "python");
    const { js, output, lineMap } = await runSource(source, { inputs: ["Mark"] }, { language: "python" });

    assert.match(js, /await __runtime\.input\("Enter your name: "\)/);
    assert.match(js, /var score = \(\s*5 \+ 6\s*\); __runtime\.trackVar\("score", score\);/);
    assert.deepEqual(output, ["Hello Mark", "Score is 11", "big"]);
    assert.ok(lineMap.length > 0);
  }],
  ["python arrays, strings, and virtual files translate and execute", async () => {
    const source = loadFixture("arrays_files", "python");
    const { js, output, files } = await runSource(source, {}, { language: "python" });

    assert.match(js, /var names = \["Ada", "Bo", "Cara", "Dana", "Eli"\]; __runtime\.trackVar\("names", names\);/);
    assert.match(js, /await __runtime\.openWrite\("sample\.txt"\)/);
    assert.deepEqual(output, ["Dana", "5", "npu", "Hello World"]);
    assert.deepEqual(files.get("sample.txt"), ["Hello World"]);
  }],
  ["python functions, classes, and inheritance execute", async () => {
    const source = loadFixture("subroutines_oop", "python");
    const { js, output } = await runSource(source, {}, { language: "python" });

    assert.match(js, /async function triple\(number\)/);
    assert.match(js, /class Dog extends Pet/);
    assert.match(js, /super\(given_name\);/);
    assert.deepEqual(output, ["hello Hamish", "Fido - Scottish Terrier"]);
  }],
  ["python for loops, booleans, and nested indexing execute", async () => {
    const source = [
      "total = 0",
      "for i in range(1, 4):",
      "    total = total + i",
      "board = [[\"a\", \"b\"], [\"c\", \"d\"]]",
      "if total == 6 and not False:",
      "    print(board[1][0])",
      "print(str(total))"
    ].join("\n");
    const { js, output } = await runSource(source, {}, { language: "python" });

    assert.match(js, /for \(; \(__pyStep_[^)]* >= 0 \? i < 4 : i > 4\); i \+= __pyStep_[^,]+, __runtime\.trackVar\("i", i\)\)/);
    assert.match(js, /if \(\(\(total == 6\) && \(!false\)\)\)/);
    assert.deepEqual(output, ["c", "6"]);
  }],
  ["python multi-line list literals execute", async () => {
    const source = [
      "board = [",
      "    [\"a\", \"b\"],",
      "    [\"c\", \"d\"]",
      "]",
      "print(board[1][0])"
    ].join("\n");
    const { output } = await runSource(source, {}, { language: "python" });

    assert.deepEqual(output, ["c"]);
  }],
  ["python syntax errors report source lines", () => {
    assert.throws(
      () => translateSource("if True\n    print(\"x\")", { language: "python" }),
      (error) => error.line === 1
    );
  }],
  ["python testcase executes through the shared runtime contract", async () => {
    const { output } = await runSource(loadTestcase("Basic_IO", "python"), { inputs: ["17"] }, { language: "python" });

    assert.deepEqual(output, ["Child"]);
  }],
  ["python file testcase uses file handles through the shared runtime contract", async () => {
    const { output, files } = await runSource(loadTestcase("File_Handling", "python"), {}, { language: "python" });

    assert.deepEqual(output, ["alpha", "beta"]);
    assert.deepEqual(files.get("sample.txt"), ["alpha", "beta"]);
  }],
  ["python for-in over lists, strings, and files executes", async () => {
    const source = [
      'items = ["A", "B"]',
      "for item in items:",
      "    print(item)",
      'for ch in "Hi":',
      "    print(ch)",
      'reader = open("sample.txt", "r")',
      "for line in reader:",
      "    print(line)"
    ].join("\n");
    const { output } = await runSource(source, {
      files: new Map([["sample.txt", ["one", "two"]]])
    }, { language: "python" });

    assert.deepEqual(output, ["A", "B", "H", "i", "one", "two"]);
  }],
  ["python range step and exponentiation execute", async () => {
    const source = [
      "for n in range(6, 0, -2):",
      "    print(str(n))",
      "print(str(2 ** 3))"
    ].join("\n");
    const { js, output } = await runSource(source, {}, { language: "python" });

    assert.match(js, /__pyStep_/);
    assert.match(js, /\*\*/);
    assert.deepEqual(output, ["6", "4", "2", "8"]);
  }],
  ["python builtins bool list chr ord round execute", async () => {
    const source = [
      'print(str(bool("x")))',
      'letters = list("ab")',
      "print(letters[1])",
      "print(chr(65))",
      'print(str(ord("A")))',
      "print(str(round(2.6)))"
    ].join("\n");
    const { output } = await runSource(source, {}, { language: "python" });

    assert.deepEqual(output, ["true", "b", "A", "65", "3"]);
  }],
  ["python import math and Edexcel math members execute", async () => {
    const source = [
      "import math",
      "print(str(math.ceil(2.1)))",
      "print(str(math.floor(2.9)))",
      "print(str(math.sqrt(81)))",
      "print(str(math.pi))"
    ].join("\n");
    const { js, output } = await runSource(source, {}, { language: "python" });

    assert.match(js, /Math\.ceil\(2\.1\)/);
    assert.match(js, /Math\.floor\(2\.9\)/);
    assert.match(js, /Math\.sqrt\(81\)/);
    assert.match(js, /Math\.PI/);
    assert.deepEqual(output, ["3", "2", "9", String(Math.PI)]);
  }],
  ["python import random and time PLS methods execute", async () => {
    const source = [
      "import random",
      "import time",
      "print(str(random.randint(1, 6)))",
      "print(str(random.random()))",
      "time.sleep(0.5)",
      'print("done")'
    ].join("\n");
    let slept = null;
    const { js, output } = await runSource(
      source,
      {
        random: () => 0.25,
        sleep: async (seconds) => {
          slept = seconds;
        }
      },
      { language: "python" }
    );

    assert.match(js, /__runtime\.randomInt\(1, 6\)/);
    assert.match(js, /__runtime\.random\(\)/);
    assert.match(js, /await __runtime\.sleep\(0\.5\)/);
    assert.equal(slept, 0.5);
    assert.deepEqual(output, ["2", "0.25", "done"]);
  }],
  ["python augmented assignment and string repetition execute", async () => {
    const source = [
      "count = 2",
      "count += 3",
      'line = "=" * 5',
      'line *= 2',
      "print(str(count))",
      "print(line)"
    ].join("\n");
    const { js, output } = await runSource(source, {}, { language: "python" });

    assert.match(js, /count = \(\s*count \+ 3\s*\);/);
    assert.match(js, /__runtime\.pyMul\("=", 5\)/);
    assert.deepEqual(output, ["5", "=========="]);
  }],
  ["python round digits, strip char, bounded find/index, and format descriptors execute", async () => {
    const source = [
      "print(str(round(3.14159, 2)))",
      'print("--hi--".strip("-"))',
      'print(str("banana".find("an", 2, 5)))',
      'print(str("banana".index("an", 2, 5)))',
      'layout = "{:>6} {:^5d} {:7.2f}"',
      'print(layout.format("A", 12, 3.14159))'
    ].join("\n");
    const { output } = await runSource(source, {}, { language: "python" });

    assert.deepEqual(output, ["3.14", "hi", "3", "3", "     A  12      3.14"]);
  }],
  ["python rejects unsupported library imports with a clear error", () => {
    assert.throws(
      () => translateSource("import turtle", { language: "python" }),
      (error) => error.message === "Library import is not supported: turtle" && error.line === 1
    );
  }],
  ["python random and time require matching imports", () => {
    assert.throws(
      () => translateSource("print(random.randint(1, 6))", { language: "python" }),
      (error) => error.message === "random is not available without import random" && error.line === 1
    );
    assert.throws(
      () => translateSource("time.sleep(1)", { language: "python" }),
      (error) => error.message === "time is not available without import time" && error.line === 1
    );
  }],
  ["python list mutations and del execute", async () => {
    const source = [
      "items = [1, 3]",
      "items.insert(1, 2)",
      "items.append(4)",
      "del items[0]",
      "for item in items:",
      "    print(str(item))"
    ].join("\n");
    const { output } = await runSource(source, {}, { language: "python" });

    assert.deepEqual(output, ["2", "3", "4"]);
  }],
  ["python negative single indexes work for strings and lists", async () => {
    const source = [
      'text = "HELLO"',
      'items = ["a", "b", "c"]',
      "print(text[-1])",
      "print(text[-2])",
      "print(items[-1])",
      "print(items[-3])"
    ].join("\n");
    const { js, output } = await runSource(source, {}, { language: "python" });

    assert.match(js, /\.at\(\(-\s*1\)\)/);
    assert.deepEqual(output, ["O", "L", "c", "a"]);
  }],
  ["python string methods and format execute", async () => {
    const source = [
      'text = "  Abc123  "',
      "print(str(text.strip().find(\"bc\")))",
      "print(str(text.strip().index(\"Ab\")))",
      "print(str(text.strip().isalpha()))",
      'print(str("Abc123".isalnum()))',
      'print(str("123".isdigit()))',
      'print("hello".replace("l", "x"))',
      'parts = "a,b".split(",")',
      "print(parts[1])",
      'print("Ab".upper())',
      'print("Ab".lower())',
      'print(str("ABC".isupper()))',
      'print(str("abc".islower()))',
      'print("Hi {}, {}".format("Ada", 3))'
    ].join("\n");
    const { output } = await runSource(source, {}, { language: "python" });

    assert.deepEqual(output, ["1", "0", "false", "true", "true", "hexxo", "b", "AB", "ab", "true", "true", "Hi Ada, 3"]);
  }],
  ["python open append write readlines and writelines execute", async () => {
    const source = [
      'writer = open("log.txt", "w")',
      'writer.write("a")',
      'writer.writelines(["b", "\\n", "c"])',
      "writer.close()",
      'appender = open("log.txt", "a")',
      'appender.write("d")',
      "appender.close()",
      'reader = open("log.txt", "r")',
      "lines = reader.readlines()",
      "print(lines[0])",
      "reader.close()"
    ].join("\n");
    const { output, files } = await runSource(source, {}, { language: "python" });

    assert.deepEqual(output, ["ab"]);
    assert.deepEqual(files.get("log.txt"), ["ab", "cd"]);
  }],
  ["comments and curly quotes normalize", () => {
    const source = `// leading comment\nprint(“hello”) // trailing comment`;
    const { js, lineMap } = translateSource(source);

    assert.match(js, /await __runtime\.print\("hello"\);/);
    assert.match(js, /await __runtime\.traceStep\(2\);/);
    assert.deepEqual(lineMap, [2, 2, 2]);
  }],
  ["translated JavaScript is indented for nested blocks", () => {
    const source = [
      "IF TRUE THEN",
      '  PRINT("x")',
      "ENDIF"
    ].join("\n");
    const { js } = translateSource(source);

    assert.match(js, /if \(true\) \{/);
    assert.match(js, /await __runtime\.print\("x"\);/);
  }],
  ["mapped source lines preserve the original pseudocode line numbers", () => {
    const source = `print("one")\nprint("two")\nprint("three")`;
    const { lineMap } = translateSource(source);

    assert.deepEqual(lineMap, [1, 1, 1, 2, 2, 2, 3, 3, 3]);
  }],
  ["translator adds trace checkpoints and tracked-variable updates", () => {
    const source = ["x = 1", "x = x + 1", "print(str(x))"].join("\n");
    const { js } = translateSource(source);

    assert.match(js, /__runtime\.trackVar\("x", x\)/);
    assert.match(js, /await __runtime\.traceStep\(1\);/);
    assert.match(js, /await __runtime\.traceStep\(3\);/);
  }],
  ["translator traces while loop headers, body statements, and terminators", () => {
    const source = [
      "n = 3",
      "WHILE n > 0",
      "  PRINT(STR(n))",
      "  n = n - 1",
      "ENDWHILE",
      'PRINT("Done")'
    ].join("\n");
    const { js } = translateSource(source);

    assert.match(js, /await __runtime\.beforeStep\(1\);\nvar n = 3;/);
    assert.match(js, /await __runtime\.beforeStep\(2\);\nwhile \(\(n > 0\)\) \{/);
    assert.match(js, /await __runtime\.beforeStep\(3\);\n  await __runtime\.print\(String\(n\)\);/);
    assert.match(js, /await __runtime\.beforeStep\(4\);\n  n = \(n - 1\); __runtime\.trackVar\("n", n\);/);
    assert.match(js, /await __runtime\.beforeStep\(5\);\n\}/);
    assert.match(js, /n = \(n - 1\); __runtime\.trackVar\("n", n\);\n  await __runtime\.traceStep\(4\);/);
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
  ["one-dimensional array declarations can include an initializer", async () => {
    const source = [
      "ARRAY data[5] = [10, 2, 3, 20, 19]",
      "PRINT(STR(data[0]))",
      "PRINT(STR(data[4]))"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /var data = \[10, 2, 3, 20, 19\]; __runtime\.trackVar\("data", data\);/);
    assert.deepEqual(output, ["10", "19"]);
  }],
  ["array initializers support strings", async () => {
    const source = [
      'ARRAY names[2] = ["Ada", "Bo"]',
      "PRINT(names[1])"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["Bo"]);
  }],
  ["two-dimensional array declarations can include an initializer", async () => {
    const source = [
      "ARRAY board[2, 2] = [[1, 2], [3, 4]]",
      "PRINT(STR(board[0, 1]))",
      "PRINT(STR(board[1, 0]))"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /var board = \[\[1, 2\], \[3, 4\]\]; __runtime\.trackVar\("board", board\);/);
    assert.deepEqual(output, ["2", "3"]);
  }],
  ["two-dimensional array initializers support strings", async () => {
    const source = [
      'ARRAY board[2, 2] = [["a", "b"], ["c", "d"]]',
      "PRINT(board[1, 1])"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["d"]);
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

  ["incomplete expression reports the source line number", () => {
    assert.throws(
      () => translateSource("x = (1 +"),
      (error) => /Unexpected end of expression|Expression ended too early/.test(error.message) && error.line === 1
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

    assert.match(js, /var i = 3; __runtime\.trackVar\("i", i\);/);
    assert.match(js, /for \(; i >= 1; i--, __runtime\.trackVar\("i", i\)\)/);
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
  }],

  // --- sample exam programs ---
  ["Basic_IO sample translates and follows the selected branch", async () => {
    const { js, output } = await runSource(loadTestcase("Basic_IO"), { inputs: ["17"] });

    assert.match(js, /await __runtime\.input\(""\)/);
    assert.match(js, /await __runtime\.print\("Please enter your age"\)/);
    assert.deepEqual(output, ["Please enter your age", "You can vote next year."]);
  }],

  ["Iteration sample runs the counted loop", async () => {
    const { output } = await runSource(loadTestcase("Iteration"));

    assert.deepEqual(output, ["1", "2", "3", "4", "5"]);
  }],

  ["Array_List sample parses array literals and iterates over them", async () => {
    const { output } = await runSource(loadTestcase("Array_List"));

    assert.deepEqual(output, ["Alice", "Bob", "Charlie"]);
  }],

  ["File_Handling sample reads back what it wrote", async () => {
    const { js, output } = await runSource(loadTestcase("File_Handling"));

    assert.match(js, /await __runtime\.openWrite\("sample\.txt"\)/);
    assert.match(js, /await __runtime\.openRead\("sample\.txt"\)/);
    assert.deepEqual(output, ["Hello World"]);
  }],

  ["preloaded virtual files are available to a program", async () => {
    const source = [
      'file = OPENREAD("notes.txt")',
      "PRINT(file.READLINE())",
      "PRINT(file.READLINE())",
      "file.CLOSE()"
    ].join("\n");
    const { output, files } = await runSource(source, {
      files: new Map([["notes.txt", ["alpha", "beta"]]])
    });

    assert.deepEqual(output, ["alpha", "beta"]);
    assert.deepEqual(files.get("notes.txt"), ["alpha", "beta"]);
  }],

  ["uppercase file methods and string length member work like their lowercase forms", async () => {
    const source = [
      'text = "hello".LENGTH',
      'myFile = OPENWRITE("sample.txt")',
      'myFile.WRITELINE("Hello World")',
      "myFile.CLOSE()",
      'myFile = OPENREAD("sample.txt")',
      "WHILE NOT myFile.ENDOFFILE()",
      "  PRINT(myFile.READLINE())",
      "ENDWHILE",
      "myFile.CLOSE()",
      "PRINT(text)"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["Hello World", "5"]);
  }],

  // --- instructional examples ---
  ["input example greets the entered name", async () => {
    const source = [
      "// Ask the user for a name and print a greeting.",
      'name = INPUT("Name? ")',
      'PRINT("Hello " + name)'
    ].join("\n");
    const { output } = await runSource(source, { inputs: ["Mark"] });

    assert.deepEqual(output, ["Hello Mark"]);
  }],

  ["selection example chooses the middle branch", async () => {
    const source = [
      "// Use IF / ELSEIF / ELSE to choose one branch.",
      "score = 72",
      "IF score >= 80 THEN",
      '  PRINT("Excellent")',
      "ELSEIF score >= 50 THEN",
      '  PRINT("Pass")',
      "ELSE",
      '  PRINT("Try again")',
      "ENDIF"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["Pass"]);
  }],

  ["counted loop example prints three iterations", async () => {
    const source = [
      "// Count from 1 to 3 with a FOR loop.",
      "FOR i = 1 TO 3",
      '  PRINT("Count " + STR(i))',
      "NEXT i"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["Count 1", "Count 2", "Count 3"]);
  }],

  ["while loop example counts down to done", async () => {
    const source = [
      "// Repeat while the condition stays true.",
      "n = 3",
      "WHILE n > 0",
      "  PRINT(STR(n))",
      "  n = n - 1",
      "ENDWHILE",
      'PRINT("Done")'
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["3", "2", "1", "Done"]);
  }],

  ["do until example repeats until the condition becomes true", async () => {
    const source = [
      "// Keep going until the condition becomes true.",
      "attempts = 0",
      "DO",
      "  attempts = attempts + 1",
      '  PRINT("Try " + STR(attempts))',
      "UNTIL attempts == 3",
      'PRINT("Stopped")'
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["Try 1", "Try 2", "Try 3", "Stopped"]);
  }],

  ["arrays example shows length and substring access", async () => {
    const source = [
      "// Store values in an array and read string properties.",
      "ARRAY names[3]",
      'names[0] = "Ada"',
      'names[1] = "Ben"',
      'names[2] = "Cy"',
      "PRINT(names[1])",
      "",
      'text = "hello"',
      "PRINT(STR(text.LENGTH))",
      "PRINT(text.SUBSTRING(1, 3))"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /\.length/);
    assert.match(js, /\.substring\(1, \(1\) \+ \(3\)\)/);
    assert.deepEqual(output, ["Ben", "5", "ell"]);
  }],

  ["strings example manipulates text with length and substring", async () => {
    const source = [
      "// Manipulate text with concatenation, LENGTH, and SUBSTRING.",
      'text = "HELLO WORLD"',
      'PRINT(text + "!")',
      "PRINT(STR(text.LENGTH))",
      "PRINT(text.SUBSTRING(6, 5))"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["HELLO WORLD!", "11", "WORLD"]);
  }],

  ["boolean logic example combines AND, OR, and NOT", async () => {
    const source = [
      "// Combine AND, OR, and NOT inside one decision.",
      "age = 16",
      "hasPermission = TRUE",
      "doorOpen = FALSE",
      "IF (age >= 16 AND hasPermission) OR NOT doorOpen THEN",
      '  PRINT("Allowed")',
      "ELSE",
      '  PRINT("Blocked")',
      "ENDIF"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["Allowed"]);
  }],

  ["procedure example uses side effects and early return", async () => {
    const source = [
      "// Procedures are useful for side effects and early RETURN.",
      "PROCEDURE announce(message)",
      '  IF message == "" THEN',
      "    RETURN",
      "  ENDIF",
      '  PRINT(">> " + message)',
      "ENDPROCEDURE",
      "",
      'announce("Hello")',
      'announce("")'
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, [">> Hello"]);
  }],

  ["recursion example counts down by calling itself", async () => {
    const source = [
      "// A function can call itself to count down.",
      "FUNCTION countdown(n)",
      "  IF n == 0 THEN",
      "    RETURN",
      "  ENDIF",
      "  PRINT(STR(n))",
      "  countdown(n - 1)",
      "ENDFUNCTION",
      "",
      "countdown(3)"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["3", "2", "1"]);
  }],

  ["2D arrays example stores values by row and column", async () => {
    const source = [
      "// Use a two-dimensional array with row and column indexes.",
      "ARRAY board[2, 2]",
      'board[0, 0] = "rook"',
      'board[0, 1] = "knight"',
      'board[1, 0] = "bishop"',
      'board[1, 1] = "queen"',
      "PRINT(board[1, 1])"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["queen"]);
  }],

  ["Battleship example mixes loops, 2D arrays, input, and win/lose flow", async () => {
    const source = [
      "// Find the hidden ship on a 3x3 grid.",
      "// You get three attempts to guess the row and column.",
      "ARRAY board[3, 3]",
      "FOR row = 0 TO 2",
      "  FOR col = 0 TO 2",
      '    board[row, col] = "."',
      "  NEXT col",
      "NEXT row",
      "",
      "shipRow = 1",
      "shipCol = 2",
      "turn = 0",
      "hit = FALSE",
      "",
      "WHILE turn < 3 AND NOT hit",
      '  rowGuess = INT(INPUT("Row? "))',
      '  colGuess = INT(INPUT("Col? "))',
      "  IF rowGuess == shipRow AND colGuess == shipCol THEN",
      '    board[rowGuess, colGuess] = "X"',
      '    PRINT("Hit!")',
      "    hit = TRUE",
      "  ELSE",
      "    IF rowGuess < 0 OR rowGuess > 2 OR colGuess < 0 OR colGuess > 2 THEN",
      '      PRINT("Out of bounds")',
      "    ELSE",
      '      board[rowGuess, colGuess] = "o"',
      '      PRINT("Miss")',
      "    ENDIF",
      "  ENDIF",
      "  turn = turn + 1",
      "ENDWHILE",
      "",
      "IF hit THEN",
      '  PRINT("You found the ship.")',
      "ELSE",
      '  PRINT("Game over.")',
      "ENDIF",
      "",
      "FOR row = 0 TO 2",
      '  line = ""',
      "  FOR col = 0 TO 2",
      "    line = line + board[row, col]",
      "  NEXT col",
      "  PRINT(line)",
      "NEXT row"
    ].join("\n");
    const { js, output } = await runSource(source, { inputs: ["3", "0", "1", "2"] });

    assert.match(js, /Array\.from\(\{ length: 3 \}/);
    assert.match(js, /while \(\(\(turn < 3\) && \(!\(hit\)\)\)\)/);
    assert.match(js, /rowGuess < 0/);
    assert.match(js, /colGuess > 2/);
    assert.deepEqual(output, ["Out of bounds", "Hit!", "You found the ship.", "...", "..X", "..."]);
  }],

  ["sorting examples seed unsorted.txt when selected", async () => {
    const originalLocalStorage = globalThis.localStorage;
    const originalFetch = globalThis.fetch;
    globalThis.localStorage = {
      getItem() {
        return null;
      },
      setItem() {}
    };
    globalThis.fetch = async (url) => {
      const resolved = String(url).startsWith("http") || String(url).startsWith("file:")
        ? new URL(String(url))
        : new URL(`../${url}`, import.meta.url);
      const text = readFileSync(resolved, "utf8");
      return {
        ok: true,
        text: async () => text
      };
    };

    try {
      const options = await loadAppOptions();
      const app = buildAppInstance(options);
      const bubbleIndex = app.examples.findIndex((example) => example.name === "Bubble Sort");

      assert.ok(bubbleIndex >= 0);

      app.selectedExample = bubbleIndex;
      await app.loadExample();

      assert.deepEqual(app.virtualFiles, [
        {
          path: "unsorted.txt",
          lines: loadSortInputLines("bubble-sort")
        }
      ]);
      assert.equal(app.selectedVirtualFilePath, "unsorted.txt");
    } finally {
      globalThis.localStorage = originalLocalStorage;
      globalThis.fetch = originalFetch;
    }
  }],

  ["file loop example seeds sample.txt when selected", async () => {
    const originalLocalStorage = globalThis.localStorage;
    const originalFetch = globalThis.fetch;
    globalThis.localStorage = {
      getItem() {
        return null;
      },
      setItem() {}
    };
    globalThis.fetch = async (url) => {
      const resolved = String(url).startsWith("http") || String(url).startsWith("file:")
        ? new URL(String(url))
        : new URL(`../${url}`, import.meta.url);
      const text = readFileSync(resolved, "utf8");
      return {
        ok: true,
        text: async () => text
      };
    };

    try {
      const options = await loadAppOptions();
      const app = buildAppInstance(options);
      const fileLoopIndex = app.examples.findIndex((example) => example.name === "File loop");

      assert.ok(fileLoopIndex >= 0);

      app.selectedExample = fileLoopIndex;
      await app.loadExample();

      assert.deepEqual(app.virtualFiles, [
        {
          path: "sample.txt",
          lines: ["alpha", "beta"]
        }
      ]);
      assert.equal(app.selectedVirtualFilePath, "sample.txt");
    } finally {
      globalThis.localStorage = originalLocalStorage;
      globalThis.fetch = originalFetch;
    }
  }],
  ["switching language swaps to the matching example and resets the active run", async () => {
    const originalLocalStorage = globalThis.localStorage;
    globalThis.localStorage = {
      getItem() {
        return null;
      },
      setItem() {}
    };

    try {
      const options = await loadAppOptions();
      const app = buildAppInstance(options, {
        running: true,
        worker: {
          terminate() {}
        }
      });
      const ocrIndex = app.examples.findIndex((example) => example.name === "Files");

      assert.ok(ocrIndex >= 0);

      app.selectedExample = ocrIndex;
      await app.loadExample();

      assert.equal(app.selectedLanguage, "ocr");
      assert.match(app.editorText, /OPENWRITE\("sample\.txt"\)/);

      app.running = true;
      app.programFinished = false;
      app.worker = {
        terminate() {}
      };
      app.selectedLanguage = "python";
      options.watch.selectedLanguage.call(app);
      options.watch.selectedExample.call(app);
      await app.exampleLoadPromise;

      assert.equal(app.running, false);
      assert.equal(app.programFinished, false);
      assert.equal(app.examples[app.selectedExample].name, "Files");
      assert.equal(app.selectedLanguage, "python");
      assert.match(app.editorText, /openWrite\("sample\.txt"\)/);
    } finally {
      globalThis.localStorage = originalLocalStorage;
    }
  }],

  ["python examples cover every OCR lesson example by key", async () => {
    const originalLocalStorage = globalThis.localStorage;
    const originalFetch = globalThis.fetch;
    globalThis.localStorage = { getItem() { return null; }, setItem() {} };
    globalThis.fetch = async (url) => {
      const resolved = String(url).startsWith("http") || String(url).startsWith("file:")
        ? new URL(String(url))
        : new URL(`../${url}`, import.meta.url);
      const text = readFileSync(resolved, "utf8");
      return { ok: true, text: async () => text };
    };
    try {
      const options = await loadAppOptions();
      const app = buildAppInstance(options);
      const ocrExamples = app.examples.filter((e) => !e.separator);
      assert.equal(ocrExamples.length, 25, "Expected 25 OCR examples");
      for (const example of ocrExamples) {
        app.selectedExample = app.examples.indexOf(example);
        app.selectedLanguage = "python";
        await app.loadExample();
        assert.ok(app.editorText.length > 0, `No Python code for ${example.name}`);
        assert.ok(
          app.editorText.includes("print(") || app.editorText.includes("def ") || app.editorText.includes("class "),
          `Python code for ${example.name} does not look like Python`
        );
      }
    } finally {
      globalThis.localStorage = originalLocalStorage;
      globalThis.fetch = originalFetch;
    }
  }],

  ["trace table formats object and list updates as changed elements", async () => {
    const options = await loadAppOptions();
    const app = buildAppInstance(options);
    const firstRow = {
      step: 1,
      line: 1,
      snapshot: {
        person: { name: "oldname", score: 10 },
        list: [1, 2, 3],
        board: [[0, 0], [0, 0]]
      }
    };
    const secondRow = {
      step: 2,
      line: 2,
      previousSnapshot: firstRow.snapshot,
      snapshot: {
        person: { name: "newname", score: 10 },
        list: [1, 2, 5],
        board: [[0, 0], [0, 9]]
      }
    };
    const thirdRow = {
      step: 3,
      line: 3,
      previousSnapshot: secondRow.snapshot,
      snapshot: {
        person: { name: "newname", score: 10 },
        list: [1, 2, 5],
        board: [[0, 0], [0, 9]]
      }
    };
    const battleshipRow = {
      step: 4,
      line: 4,
      previousSnapshot: {
        board: [[null, null, null], [null, null, null], [null, null, null]]
      },
      snapshot: {
        board: [[".", ".", "."], [null, null, null], [null, null, null]]
      }
    };
    app.traceRows = [firstRow, secondRow, thirdRow, battleshipRow];

    assert.equal(app.formatTraceCell(secondRow, "person"), 'name = "newname"');
    assert.equal(app.formatTraceCell(secondRow, "list"), "[2] = 5");
    assert.equal(app.formatTraceCell(secondRow, "board"), "[1][1] = 9");
    assert.equal(app.formatTraceCell(thirdRow, "board"), "");
    assert.equal(
      app.formatTraceCell(battleshipRow, "board"),
      '[0] = [".",".","."]'
    );
  }],

  ["trace table keeps list diffs from runtime snapshots", async () => {
    const options = await loadAppOptions();
    const app = buildAppInstance(options);
    const snapshots = [
      {
        board: [[null, null, null], [null, null, null], [null, null, null]]
      },
      {
        board: [[null, null, null], [null, null, null], [null, null, null]],
        row: 0
      },
      {
        board: [[".", ".", "."], [null, null, null], [null, null, null]],
        col: 3,
        row: 1
      },
      {
        board: [[".", ".", "."], [".", ".", "."], [null, null, null]],
        col: 3,
        row: 2
      }
    ];

    snapshots.forEach((snapshot, index) => {
      app.handleTraceStep({
        pseudoLine: index + 1,
        snapshot,
        stepIndex: index + 1,
        paused: false
      });
    });

    assert.equal(app.traceRows.length, 4);
    assert.equal(app.formatTraceCell(app.traceRows[1], "board"), "");
    assert.equal(
      app.formatTraceCell(app.traceRows[2], "board"),
      '[0] = [".",".","."]'
    );
    assert.equal(
      app.formatTraceCell(app.traceRows[3], "board"),
      '[1] = [".",".","."]'
    );
  }],

  ["trace table can expand one-dimensional arrays into element columns", async () => {
    const options = await loadAppOptions();
    const app = buildAppInstance(options, {
      expandTraceArrays: true
    });
    const snapshots = [
      { count: 1, data: [10, 2] },
      { count: 2, data: [10, 5] }
    ];

    snapshots.forEach((snapshot, index) => {
      app.handleTraceStep({
        pseudoLine: index + 1,
        snapshot,
        stepIndex: index + 1,
        paused: false
      });
    });

    assert.deepEqual(app.traceHeaderGroups.map((group) => [group.label, group.colspan, group.rowspan]), [
      ["count", 1, 2],
      ["data", 2, 1]
    ]);
    assert.deepEqual(app.traceDisplayColumns.map((column) => column.label), ["count", "[0]", "[1]"]);
    assert.equal(app.formatTraceCell(app.traceRows[0], app.traceDisplayColumns[1]), "10");
    assert.equal(app.formatTraceCell(app.traceRows[0], app.traceDisplayColumns[2]), "2");
    assert.equal(app.formatTraceCell(app.traceRows[1], app.traceDisplayColumns[1]), "");
    assert.equal(app.formatTraceCell(app.traceRows[1], app.traceDisplayColumns[2]), "5");
  }],

  ["trace table can expand two-dimensional arrays into row-major element columns", async () => {
    const options = await loadAppOptions();
    const app = buildAppInstance(options, {
      expandTraceArrays: true
    });

    app.handleTraceStep({
      pseudoLine: 1,
      snapshot: { board: [[1, 2], [3, 4]] },
      stepIndex: 1,
      paused: false
    });

    assert.deepEqual(
      app.traceDisplayColumns.map((column) => column.label),
      ["[0][0]", "[0][1]", "[1][0]", "[1][1]"]
    );
    assert.deepEqual(
      app.traceHeaderGroups.map((group) => [group.label, group.colspan, group.rowspan]),
      [["board", 4, 1]]
    );
    assert.deepEqual(
      app.traceDisplayColumns.map((column) => app.formatTraceCell(app.traceRows[0], column)),
      ["1", "2", "3", "4"]
    );
  }],

  ["trace table expands declared arrays before runtime values exist", async () => {
    const options = await loadAppOptions();
    const app = buildAppInstance(options, {
      expandTraceArrays: true
    });
    const source = [
      "count = 0",
      "ARRAY values[3]",
      "ARRAY board[2, 2]"
    ].join("\n");
    const { js } = translateSource(source);

    app.traceColumns = app.extractInitialTraceColumns(js);
    app.traceArrayColumns = app.extractInitialTraceArrayColumns(js);
    app.traceArrayPaths = app.extractInitialTraceArrayPaths(js, source);

    assert.deepEqual(
      app.traceDisplayColumns.map((column) => column.label),
      ["count", "[0]", "[1]", "[2]", "[0][0]", "[0][1]", "[1][0]", "[1][1]"]
    );
    assert.deepEqual(
      app.traceHeaderGroups.map((group) => [group.label, group.colspan, group.rowspan]),
      [
        ["count", 1, 2],
        ["values", 3, 1],
        ["board", 4, 1]
      ]
    );
  }],

  ["trace table leaves unchanged scalar values blank", async () => {
    const options = await loadAppOptions();
    const app = buildAppInstance(options);
    const snapshots = [
      { whole: 7 },
      { whole: 7, decimal: 3.5 },
      { whole: 7, decimal: 3.5 },
      { whole: 7, decimal: 3.5 }
    ];

    snapshots.forEach((snapshot, index) => {
      app.handleTraceStep({
        pseudoLine: index + 2,
        snapshot,
        stepIndex: index + 1,
        paused: false
      });
    });

    assert.equal(app.traceRows.length, 2);
    assert.deepEqual(app.traceRows.map((row) => row.line), [2, 3]);
    assert.equal(app.formatTraceCell(app.traceRows[0], "whole"), "7");
    assert.equal(app.formatTraceCell(app.traceRows[1], "whole"), "");
    assert.equal(app.formatTraceCell(app.traceRows[1], "decimal"), "3.5");
    assert.equal(app.formatTraceLine(app.traceRows[0]), "2");
    assert.equal(app.formatTraceLine(app.traceRows[1]), "3");
  }],

  ["trace table quotes string scalar values", async () => {
    const options = await loadAppOptions();
    const app = buildAppInstance(options);

    app.handleTraceStep({
      pseudoLine: 1,
      snapshot: { name: "Ada" },
      stepIndex: 1,
      paused: false
    });

    assert.equal(app.formatTraceCell(app.traceRows[0], "name"), '"Ada"');
  }],

  ["trace table uses skipped rows as the next diff baseline", async () => {
    const options = await loadAppOptions();
    const app = buildAppInstance(options);
    const snapshots = [
      { count: 1, total: 1 },
      { count: 1, total: 1 },
      { count: 2, total: 1 }
    ];

    snapshots.forEach((snapshot, index) => {
      app.handleTraceStep({
        pseudoLine: index + 1,
        snapshot,
        stepIndex: index + 1,
        paused: false
      });
    });

    assert.equal(app.traceRows.length, 2);
    assert.deepEqual(app.traceRows.map((row) => row.line), [1, 3]);
    assert.equal(app.formatTraceCell(app.traceRows[1], "count"), "2");
    assert.equal(app.formatTraceCell(app.traceRows[1], "total"), "");
  }],

  ["trace table compresses changes into rows until a value changes again", async () => {
    const options = await loadAppOptions();
    const app = buildAppInstance(options, {
      compressTraceTable: true,
      editorText: [
        "a = 1",
        "b = 2",
        "a = 3"
      ].join("\n")
    });
    const snapshots = [
      { a: 1 },
      { a: 1, b: 2 },
      { a: 3, b: 2 }
    ];

    snapshots.forEach((snapshot, index) => {
      app.handleTraceStep({
        pseudoLine: index + 1,
        snapshot,
        stepIndex: index + 1,
        paused: false
      });
    });

    assert.equal(app.traceRows.length, 3);
    assert.equal(app.traceVisibleRows.length, 2);
    assert.equal(app.formatTraceCell(app.traceVisibleRows[0], "a"), "1");
    assert.equal(app.formatTraceCell(app.traceVisibleRows[0], "b"), "2");
    assert.equal(app.formatTraceCell(app.traceVisibleRows[1], "a"), "3");
    assert.equal(app.formatTraceCell(app.traceVisibleRows[1], "b"), "");
  }],

  ["trace table compression starts a new row after loop ends", async () => {
    const options = await loadAppOptions();
    const app = buildAppInstance(options, {
      compressTraceTable: true,
      editorText: [
        "a = 1",
        "WHILE a < 3",
        "  b = 1",
        "ENDWHILE",
        "c = 3"
      ].join("\n")
    });
    const snapshots = [
      { a: 1 },
      { a: 1 },
      { a: 1, b: 1 },
      { a: 1, b: 1 },
      { a: 1, b: 1, c: 3 }
    ];

    snapshots.forEach((snapshot, index) => {
      app.handleTraceStep({
        pseudoLine: index + 1,
        snapshot,
        stepIndex: index + 1,
        paused: false
      });
    });

    assert.equal(app.traceRows.length, 3);
    assert.equal(app.traceEvents.length, 5);
    assert.equal(app.traceVisibleRows.length, 2);
    assert.equal(app.formatTraceCell(app.traceVisibleRows[0], "a"), "1");
    assert.equal(app.formatTraceCell(app.traceVisibleRows[0], "b"), "1");
    assert.equal(app.formatTraceCell(app.traceVisibleRows[1], "a"), "");
    assert.equal(app.formatTraceCell(app.traceVisibleRows[1], "b"), "");
    assert.equal(app.formatTraceCell(app.traceVisibleRows[1], "c"), "3");
  }],

  ["trace table compression starts a new row after array initialisation", async () => {
    const options = await loadAppOptions();
    const app = buildAppInstance(options, {
      compressTraceTable: true,
      editorText: [
        "ARRAY values[3] = [1, 2, 3]",
        "count = 3"
      ].join("\n")
    });
    const snapshots = [
      { values: [1, 2, 3] },
      { values: [1, 2, 3], count: 3 }
    ];

    snapshots.forEach((snapshot, index) => {
      app.handleTraceStep({
        pseudoLine: index + 1,
        snapshot,
        stepIndex: index + 1,
        paused: false
      });
    });

    assert.equal(app.traceRows.length, 2);
    assert.equal(app.traceVisibleRows.length, 2);
    assert.equal(app.formatTraceCell(app.traceVisibleRows[0], "values"), "[1,2,3]");
    assert.equal(app.formatTraceCell(app.traceVisibleRows[0], "count"), "");
    assert.equal(app.formatTraceCell(app.traceVisibleRows[1], "values"), "");
    assert.equal(app.formatTraceCell(app.traceVisibleRows[1], "count"), "3");
  }],

  ["trace table directives in comments update display options", async () => {
    const options = await loadAppOptions();
    const app = buildAppInstance(options, {
      expandTraceArrays: false,
      compressTraceTable: false
    });

    assert.deepEqual(
      app.parseTraceOptionDirectives([
        "// #expand_arrays:true",
        "total = 0 // #compress_rows:true"
      ].join("\n")),
      {
        expandTraceArrays: true,
        compressTraceTable: true
      }
    );

    app.applyTraceOptionDirectives([
      "// #expand_arrays:true",
      "// #compress_rows:true"
    ].join("\n"));

    assert.equal(app.expandTraceArrays, true);
    assert.equal(app.compressTraceTable, true);

    app.applyTraceOptionDirectives([
      "// #expand_arrays:false",
      "// #compress_rows:false"
    ].join("\n"));

    assert.equal(app.expandTraceArrays, false);
    assert.equal(app.compressTraceTable, false);
  }],

  ["program start applies trace table directives before translating", () => {
    const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");

    assert.match(appSource, /resetDebugState\(\);\s*this\.applyTraceOptionDirectives\(this\.editorText\);\s*this\.terminalStatus = "Translating";/);
  }],

  ["trace serialization excludes virtual file handles", () => {
    const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");

    assert.match(appSource, /function isTraceHiddenValue\(value\)/);
    assert.match(appSource, /if \(isTraceHiddenValue\(value\)\) \{[\s\S]*continue;/);
    assert.match(appSource, /__traceHidden: true/);
    assert.match(appSource, /__traceLabel: "\[File\]"/);
  }],

  ["trace table seeds columns before the first trace row", async () => {
    const options = await loadAppOptions();
    const app = buildAppInstance(options);
    const { js } = translateSource([
      "ARRAY values[10]",
      "index = 0",
      'myFile = OPENREAD("input.txt")',
      "WHILE index < 2",
      "  values[index] = index",
      "  index = index + 1",
      "ENDWHILE",
      "total = index"
    ].join("\n"));

    assert.deepEqual(app.extractInitialTraceColumns(js), ["index", "total", "values"]);
  }],

  ["trace table orders source variables first and arrays last", async () => {
    const options = await loadAppOptions();
    const app = buildAppInstance(options);
    const { js } = translateSource([
      "ARRAY data[3]",
      "first = 1",
      "second = 2",
      "data[0] = first",
      "third = 3"
    ].join("\n"));

    assert.deepEqual(app.extractInitialTraceArrayColumns(js), ["data"]);
    assert.deepEqual(app.extractInitialTraceColumns(js), ["first", "second", "third", "data"]);
  }],

  ["trace table keeps arrays after later runtime scalar columns", async () => {
    const options = await loadAppOptions();
    const app = buildAppInstance(options);

    app.handleTraceStep({
      pseudoLine: 1,
      snapshot: { data: [1, 2], first: 1 },
      stepIndex: 1,
      paused: false
    });
    app.handleTraceStep({
      pseudoLine: 2,
      snapshot: { data: [1, 2], first: 1, second: 2 },
      stepIndex: 2,
      paused: false
    });

    assert.deepEqual(app.traceColumns, ["first", "second", "data"]);
  }],

  ["reset clears terminal output and trace table state", async () => {
    const options = await loadAppOptions();
    const app = buildAppInstance(options, {
      outputLines: [{ kind: "output", text: "old output" }],
      traceEvents: [{ step: 1, line: 2, snapshot: { x: 1 } }],
      traceRows: [{ step: 1, line: 2, snapshot: { x: 1 } }],
      traceColumns: ["x"],
      traceArrayColumns: ["x"],
      traceArrayPaths: { x: [[0]] },
      lastTraceSnapshot: { x: 1 },
      currentPseudoLine: 2,
      debugPaused: true,
      running: true
    });

    app.stopProgram();

    assert.deepEqual(app.outputLines, []);
    assert.deepEqual(app.traceEvents, []);
    assert.deepEqual(app.traceRows, []);
    assert.deepEqual(app.traceColumns, []);
    assert.deepEqual(app.traceArrayColumns, []);
    assert.deepEqual(app.traceArrayPaths, {});
    assert.equal(app.lastTraceSnapshot, null);
    assert.equal(app.currentPseudoLine, 0);
    assert.equal(app.debugPaused, false);
    assert.equal(app.running, false);
  }],

  ["finished programs require reset before starting again", async () => {
    const options = await loadAppOptions();
    let terminated = false;
    const app = buildAppInstance(options, {
      running: true,
      outputLines: [{ kind: "output", text: "done" }],
      traceRows: [{ step: 1, line: 1, snapshot: { x: 1 } }],
      traceEvents: [{ step: 1, line: 1, snapshot: { x: 1 } }],
      traceColumns: ["x"],
      worker: {
        terminate() {
          terminated = true;
        }
      }
    });

    app.finishRun(true);

    assert.equal(terminated, true);
    assert.equal(app.running, false);
    assert.equal(app.programFinished, true);
    assert.equal(app.canRun, false);
    assert.equal(app.canStep, false);
    assert.equal(app.runStateText, "Finished");
    assert.deepEqual(app.outputLines, [{ kind: "output", text: "done" }]);
    assert.equal(app.traceRows.length, 1);
    assert.equal(await app.startProgram(), false);

    app.stopProgram();

    assert.equal(app.programFinished, false);
    assert.equal(app.canRun, true);
    assert.equal(app.canStep, true);
    assert.deepEqual(app.outputLines, []);
    assert.deepEqual(app.traceRows, []);
  }],

  ["lesson changes reset active run state before loading the new example", async () => {
    const options = await loadAppOptions();
    let terminated = false;
    const originalLocalStorage = globalThis.localStorage;
    globalThis.localStorage = {
      getItem() {
        return null;
      },
      setItem() {}
    };
    const app = buildAppInstance(options, {
      selectedExample: 1,
      outputLines: [{ kind: "output", text: "old output" }],
      traceEvents: [{ step: 1, line: 2, snapshot: { x: 1 } }],
      traceRows: [{ step: 1, line: 2, snapshot: { x: 1 } }],
      traceColumns: ["x"],
      traceArrayColumns: ["x"],
      traceArrayPaths: { x: [[0]] },
      lastTraceSnapshot: { x: 1 },
      currentPseudoLine: 2,
      debugPaused: true,
      running: true,
      worker: {
        terminate() {
          terminated = true;
        }
      }
    });

    try {
      options.watch.selectedExample.call(app);
      await app.exampleLoadPromise;

      assert.equal(terminated, true);
      assert.equal(app.worker, null);
      assert.equal(app.running, false);
      assert.equal(app.debugPaused, false);
      assert.deepEqual(app.outputLines, []);
      assert.deepEqual(app.traceEvents, []);
      assert.deepEqual(app.traceRows, []);
      assert.deepEqual(app.traceColumns, []);
      assert.deepEqual(app.traceArrayColumns, []);
      assert.deepEqual(app.traceArrayPaths, {});
      assert.equal(app.currentPseudoLine, 0);
      assert.equal(app.editorText, app.examples[1].code);
    } finally {
      globalThis.localStorage = originalLocalStorage;
    }
  }],

  ["sorting examples write sorted.txt in ascending order", async () => {
    const originalLocalStorage = globalThis.localStorage;
    const originalFetch = globalThis.fetch;
    globalThis.localStorage = {
      getItem() {
        return null;
      },
      setItem() {}
    };
    globalThis.fetch = async (url) => {
      const resolved = String(url).startsWith("http") || String(url).startsWith("file:")
        ? new URL(String(url))
        : new URL(`../${url}`, import.meta.url);
      const text = readFileSync(resolved, "utf8");
      return {
        ok: true,
        text: async () => text
      };
    };

    try {
      const options = await loadAppOptions();
      const app = buildAppInstance(options);
      const sortCases = [
        { name: "Bubble Sort", language: "ocr" },
        { name: "Insertion Sort", language: "ocr" },
        { name: "Merge Sort", language: "ocr" },
        { name: "Quick Sort", language: "ocr" },
        { name: "Bubble Sort", language: "python" },
        { name: "Insertion Sort", language: "python" },
        { name: "Merge Sort", language: "python" },
        { name: "Quick Sort", language: "python" }
      ];

      for (const { name, language } of sortCases) {
        const index = app.examples.findIndex((entry) => !entry.separator && entry.name === name);
        assert.ok(index >= 0, `Example not found: ${name}`);
        app.selectedExample = index;
        app.selectedLanguage = language;
        await app.loadExample();

        const folder = name.toLowerCase().replace(/\s+/g, "-");
        const inputLines = loadSortInputLines(folder).map((line) => String(line));
        const expected = [...inputLines].map((line) => Number(line)).sort((left, right) => left - right).map(String);
        const { output, files } = await runSource(app.editorText, {
          files: new Map([["unsorted.txt", inputLines]])
        }, language === "python" ? { language: "python" } : {});

        assert.deepEqual(output, [expected[0], expected[expected.length - 1]]);
        assert.deepEqual(files.get("sorted.txt"), expected);
      }
    } finally {
      globalThis.localStorage = originalLocalStorage;
      globalThis.fetch = originalFetch;
    }
  }],

  ["search examples find the expected target with linear and binary search", async () => {
    const originalLocalStorage = globalThis.localStorage;
    const originalFetch = globalThis.fetch;
    globalThis.localStorage = {
      getItem() {
        return null;
      },
      setItem() {}
    };
    globalThis.fetch = async (url) => {
      const text = readFileSync(new URL(`../${url}`, import.meta.url), "utf8");
      return {
        ok: true,
        text: async () => text
      };
    };

    try {
      const options = await loadAppOptions();
      const app = buildAppInstance(options);
      const searchCases = [
        { name: "Linear Search", language: "ocr" },
        { name: "Binary Search", language: "ocr" },
        { name: "Linear Search", language: "python" },
        { name: "Binary Search", language: "python" }
      ];
      const inputLines = loadSearchInputLines().map((line) => String(line));

      for (const { name, language } of searchCases) {
        const index = app.examples.findIndex((entry) => !entry.separator && entry.name === name);
        assert.ok(index >= 0, `Example not found: ${name}`);
        app.selectedExample = index;
        app.selectedLanguage = language;
        await app.loadExample();

        const { output, files } = await runSource(app.editorText, {
          inputs: ["carrot"],
          files: new Map([["search.txt", inputLines]])
        }, language === "python" ? { language: "python" } : {});

        assert.deepEqual(output, ["Found at 5"]);
        assert.equal(files.has("sorted.txt"), false);
      }
    } finally {
      globalThis.localStorage = originalLocalStorage;
      globalThis.fetch = originalFetch;
    }
  }],

  ["switch example chooses the matching case", async () => {
    const source = [
      "// SWITCH / CASE / DEFAULT choose from several fixed values.",
      "day = 3",
      "SWITCH day",
      "  CASE 1",
      '    PRINT("Mon")',
      "  CASE 2",
      '    PRINT("Tue")',
      "  CASE 3",
      '    PRINT("Wed")',
      "  DEFAULT",
      '    PRINT("Other")',
      "ENDSWITCH"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["Wed"]);
  }],

  ["inheritance example constructs a derived object", async () => {
    const source = [
      "// A class can inherit methods from a parent class.",
      "CLASS Pet",
      "  PRIVATE name",
      "  PUBLIC PROCEDURE NEW(givenName)",
      "    name = givenName",
      "  ENDPROCEDURE",
      "  PUBLIC FUNCTION getName()",
      "    RETURN name",
      "  ENDFUNCTION",
      "ENDCLASS",
      "",
      "CLASS Dog INHERITS Pet",
      "  PRIVATE breed",
      "  PUBLIC PROCEDURE NEW(givenName, givenBreed)",
      "    SUPER.NEW(givenName)",
      "    breed = givenBreed",
      "  ENDPROCEDURE",
      "  PUBLIC FUNCTION describe()",
      '    RETURN getName() + " - " + breed',
      "  ENDFUNCTION",
      "ENDCLASS",
      "",
      'myDog = NEW Dog("Fido", "Terrier")',
      "PRINT(myDog.describe())"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["Fido - Terrier"]);
  }],

  ["global scope example updates a shared variable", async () => {
    const source = [
      "// Use GLOBAL to update a variable outside the procedure.",
      "total = 0",
      "",
      "PROCEDURE addToTotal(amount)",
      "  GLOBAL total = amount",
      "ENDPROCEDURE",
      "",
      "addToTotal(7)",
      "PRINT(STR(globalThis.total))"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /globalThis\.total = amount/);
    assert.deepEqual(output, ["7"]);
  }],

  ["file loop example reads until ENDOFFILE is true", async () => {
    const source = [
      "// Read a file until ENDOFFILE is true.",
      'myFile = OPENREAD("sample.txt")',
      "WHILE NOT myFile.ENDOFFILE()",
      "  PRINT(myFile.READLINE())",
      "ENDWHILE",
      "myFile.CLOSE()"
    ].join("\n");
    const { output, files } = await runSource(source, {
      files: new Map([["sample.txt", ["alpha", "beta"]]])
    });

    assert.deepEqual(output, ["alpha", "beta"]);
    assert.deepEqual(files.get("sample.txt"), ["alpha", "beta"]);
  }],

  ["files example writes and reads a line", async () => {
    const source = [
      "// Write a file, then read it back line by line.",
      'myFile = OPENWRITE("sample.txt")',
      'myFile.WRITELINE("Hello World")',
      "myFile.CLOSE()",
      "",
      'myFile = OPENREAD("sample.txt")',
      "PRINT(myFile.READLINE())",
      "myFile.CLOSE()"
    ].join("\n");
    const { output, files } = await runSource(source);

    assert.deepEqual(output, ["Hello World"]);
    assert.deepEqual(files.get("sample.txt"), ["Hello World"]);
  }],

  ["casting example converts values before arithmetic", async () => {
    const source = [
      "// Convert strings into numbers with INT and FLOAT.",
      'whole = INT("7")',
      'decimal = FLOAT("3.5")',
      "PRINT(STR(whole + 1))",
      "PRINT(STR(decimal + 0.5))"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["8", "4"]);
  }],

  ["functions example returns a computed value", async () => {
    const source = [
      "// Define a function and call it from the main program.",
      "FUNCTION double(n)",
      "  RETURN n * 2",
      "ENDFUNCTION",
      "",
      "PRINT(STR(double(4)))"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["8"]);
  }],

  ["classes example constructs and uses an object", async () => {
    const source = [
      "// Create a class with a constructor and a method.",
      "CLASS Greeter",
      "  PRIVATE name",
      "  PUBLIC PROCEDURE NEW(who)",
      "    name = who",
      "  ENDPROCEDURE",
      "  PUBLIC FUNCTION greet()",
      '    RETURN "Hi " + name',
      "  ENDFUNCTION",
      "ENDCLASS",
      "",
      'g = NEW Greeter("Mia")',
      "PRINT(g.greet())"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /constructor\(who\)/);
    assert.doesNotMatch(js, /constructor\(\.\.\.args\)/);
    assert.deepEqual(output, ["Hi Mia"]);
  }],

  // --- python instructional examples ---
  ["python input example greets the entered name", async () => {
    const source = [
      '# Ask the user for a name and print a greeting.',
      'name = input("Name? ")',
      'print("Hello " + name)'
    ].join("\n");
    const { output } = await runSource(source, { inputs: ["Mark"] }, { language: "python" });

    assert.deepEqual(output, ["Hello Mark"]);
  }],

  ["python strings example manipulates text with len and slicing", async () => {
    const source = [
      '# Manipulate text with concatenation, len(), and slicing.',
      'text = "HELLO WORLD"',
      'print(text + "!")',
      'print(str(len(text)))',
      'print(text[6:11])'
    ].join("\n");
    const { output } = await runSource(source, {}, { language: "python" });

    assert.deepEqual(output, ["HELLO WORLD!", "11", "WORLD"]);
  }],

  ["python selection example chooses the middle branch", async () => {
    const source = [
      '# Use if / elif / else to choose one branch.',
      'score = 72',
      'if score >= 80:',
      '    print("Excellent")',
      'elif score >= 50:',
      '    print("Pass")',
      'else:',
      '    print("Try again")'
    ].join("\n");
    const { output } = await runSource(source, {}, { language: "python" });

    assert.deepEqual(output, ["Pass"]);
  }],

  ["python boolean logic example combines and, or, and not", async () => {
    const source = [
      '# Combine and, or, and not inside one decision.',
      'age = 16',
      'has_permission = True',
      'door_open = False',
      'if (age >= 16 and has_permission) or not door_open:',
      '    print("Allowed")',
      'else:',
      '    print("Blocked")'
    ].join("\n");
    const { output } = await runSource(source, {}, { language: "python" });

    assert.deepEqual(output, ["Allowed"]);
  }],

  ["python procedures example uses side effects and early return", async () => {
    const source = [
      '# Use a function for side effects and early return.',
      'def announce(message):',
      '    if message == "":',
      '        return',
      '    print(">> " + message)',
      '',
      'announce("Hello")',
      'announce("")'
    ].join("\n");
    const { output } = await runSource(source, {}, { language: "python" });

    assert.deepEqual(output, [">> Hello"]);
  }],

  ["python counted loop example prints three iterations", async () => {
    const source = [
      '# Count from 1 to 3 with range().',
      'for i in range(1, 4):',
      '    print("Count " + str(i))'
    ].join("\n");
    const { output } = await runSource(source, {}, { language: "python" });

    assert.deepEqual(output, ["Count 1", "Count 2", "Count 3"]);
  }],

  ["python while loop example counts down to done", async () => {
    const source = [
      '# Repeat while the condition stays true.',
      'n = 3',
      'while n > 0:',
      '    print(str(n))',
      '    n = n - 1',
      'print("Done")'
    ].join("\n");
    const { output } = await runSource(source, {}, { language: "python" });

    assert.deepEqual(output, ["3", "2", "1", "Done"]);
  }],

  ["python do until example repeats until the condition becomes true", async () => {
    const source = [
      '# Keep going until the condition becomes true.',
      'attempts = 0',
      'while attempts != 3:',
      '    attempts = attempts + 1',
      '    print("Try " + str(attempts))',
      'print("Stopped")'
    ].join("\n");
    const { output } = await runSource(source, {}, { language: "python" });

    assert.deepEqual(output, ["Try 1", "Try 2", "Try 3", "Stopped"]);
  }],

  ["python recursion example counts down by calling itself", async () => {
    const source = [
      '# A function can call itself to count down.',
      'def countdown(n):',
      '    if n == 0:',
      '        return',
      '    print(str(n))',
      '    countdown(n - 1)',
      '',
      'countdown(3)'
    ].join("\n");
    const { output } = await runSource(source, {}, { language: "python" });

    assert.deepEqual(output, ["3", "2", "1"]);
  }],

  ["python 2D arrays example stores values by row and column", async () => {
    const source = [
      '# Use nested lists with row and column indexes.',
      'board = [["rook", "knight"], ["bishop", "queen"]]',
      'print(board[1][1])'
    ].join("\n");
    const { output } = await runSource(source, {}, { language: "python" });

    assert.deepEqual(output, ["queen"]);
  }],

  ["python casting example converts values before arithmetic", async () => {
    const source = [
      '# Convert strings into numbers with int() and float().',
      'whole = int("7")',
      'decimal = float("3.5")',
      'print(str(whole + 1))',
      'print(str(decimal + 0.5))'
    ].join("\n");
    const { output } = await runSource(source, {}, { language: "python" });

    assert.deepEqual(output, ["8", "4"]);
  }],

  ["python switch example chooses the matching case", async () => {
    const source = [
      '# Use if / elif / else to choose from several fixed values.',
      'day = 3',
      'if day == 1:',
      '    print("Mon")',
      'elif day == 2:',
      '    print("Tue")',
      'elif day == 3:',
      '    print("Wed")',
      'else:',
      '    print("Other")'
    ].join("\n");
    const { output } = await runSource(source, {}, { language: "python" });

    assert.deepEqual(output, ["Wed"]);
  }],

  ["python inheritance example constructs a derived object", async () => {
    const source = [
      '# A class can inherit methods from a parent class.',
      'class Pet:',
      '    def __init__(self, given_name):',
      '        self.name = given_name',
      '',
      '    def get_name(self):',
      '        return self.name',
      '',
      'class Dog(Pet):',
      '    def __init__(self, given_name, given_breed):',
      '        super().__init__(given_name)',
      '        self.breed = given_breed',
      '',
      '    def describe(self):',
      '        return self.get_name() + " - " + self.breed',
      '',
      'my_dog = Dog("Fido", "Terrier")',
      'print(my_dog.describe())'
    ].join("\n");
    const { output } = await runSource(source, {}, { language: "python" });

    assert.deepEqual(output, ["Fido - Terrier"]);
  }],

  ["python global scope example updates a shared variable", async () => {
    const source = [
      '# Use global to update a variable outside the function.',
      'total = 0',
      '',
      'def add_to_total(amount):',
      '    global total',
      '    total = amount',
      '',
      'add_to_total(7)',
      'print(str(total))'
    ].join("\n");
    const { output } = await runSource(source, {}, { language: "python" });

    assert.deepEqual(output, ["7"]);
  }],

  ["python file loop example reads until endOfFile is true", async () => {
    const source = [
      '# Read a file until endOfFile() is true.',
      'my_file = openRead("sample.txt")',
      'while not my_file.endOfFile():',
      '    print(my_file.readLine())',
      'my_file.close()'
    ].join("\n");
    const { output } = await runSource(source, {
      files: new Map([["sample.txt", ["alpha", "beta"]]])
    }, { language: "python" });

    assert.deepEqual(output, ["alpha", "beta"]);
  }],

  ["python files example writes and reads a line", async () => {
    const source = [
      '# Write a file, then read it back.',
      'my_file = openWrite("sample.txt")',
      'my_file.writeLine("Hello World")',
      'my_file.close()',
      '',
      'my_file = openRead("sample.txt")',
      'print(my_file.readLine())',
      'my_file.close()'
    ].join("\n");
    const { output, files } = await runSource(source, {}, { language: "python" });

    assert.deepEqual(output, ["Hello World"]);
    assert.deepEqual(files.get("sample.txt"), ["Hello World"]);
  }],

  ["python functions example returns a computed value", async () => {
    const source = [
      '# Define a function and call it.',
      'def double(n):',
      '    return n * 2',
      '',
      'print(str(double(4)))'
    ].join("\n");
    const { output } = await runSource(source, {}, { language: "python" });

    assert.deepEqual(output, ["8"]);
  }],

  ["python classes example constructs and uses an object", async () => {
    const source = [
      '# Create a class with a constructor and a method.',
      'class Greeter:',
      '    def __init__(self, who):',
      '        self.name = who',
      '',
      '    def greet(self):',
      '        return "Hi " + self.name',
      '',
      'g = Greeter("Mia")',
      'print(g.greet())'
    ].join("\n");
    const { output } = await runSource(source, {}, { language: "python" });

    assert.deepEqual(output, ["Hi Mia"]);
  }],

  ["python Battleship example mixes loops, nested lists, input, and win/lose flow", async () => {
    const source = [
      '# Find the hidden ship on a 3x3 grid.',
      'board = [[".", ".", "."], [".", ".", "."], [".", ".", "."]]',
      'ship_row = 1',
      'ship_col = 2',
      'turn = 0',
      'hit = False',
      '',
      'while turn < 3 and not hit:',
      '    row_guess = int(input("Row? "))',
      '    col_guess = int(input("Col? "))',
      '    if row_guess < 0 or row_guess > 2 or col_guess < 0 or col_guess > 2:',
      '        print("Out of bounds")',
      '    elif row_guess == ship_row and col_guess == ship_col:',
      '        board[row_guess][col_guess] = "X"',
      '        print("Hit!")',
      '        hit = True',
      '    else:',
      '        board[row_guess][col_guess] = "o"',
      '        print("Miss")',
      '    turn = turn + 1',
      '',
      'if hit:',
      '    print("You found the ship.")',
      'else:',
      '    print("Game over.")',
      '',
      'for row in range(0, 3):',
      '    line = ""',
      '    for col in range(0, 3):',
      '        line = line + board[row][col]',
      '    print(line)'
    ].join("\n");
    const { output } = await runSource(source, { inputs: ["3", "0", "1", "2"] }, { language: "python" });

    assert.deepEqual(output, ["Out of bounds", "Hit!", "You found the ship.", "...", "..X", "..."]);
  }],

  // --- practice exercises ---
  ["exercise 1 grade calculator returns the correct grade", async () => {
    const source = [
      'score = INT(INPUT("Score? "))',
      "",
      "IF score < 0 OR score > 100 THEN",
      '  PRINT("Invalid score")',
      "ELSEIF score >= 80 THEN",
      '  PRINT("Grade A")',
      "ELSEIF score >= 70 THEN",
      '  PRINT("Grade B")',
      "ELSEIF score >= 60 THEN",
      '  PRINT("Grade C")',
      "ELSEIF score >= 50 THEN",
      '  PRINT("Grade D")',
      "ELSE",
      '  PRINT("Grade U")',
      "ENDIF"
    ].join("\n");
    const { output } = await runSource(source, { inputs: ["85"] });

    assert.deepEqual(output, ["Grade A"]);
  }],

  ["exercise 2 password checker stops when the password is correct", async () => {
    const source = [
      'password = "computer"',
      "attempts = 0",
      "loggedIn = FALSE",
      "",
      "WHILE attempts < 3 AND NOT loggedIn",
      '  entry = INPUT("Password? ")',
      "  IF entry == password THEN",
      '    PRINT("Access granted")',
      "    loggedIn = TRUE",
      "  ELSE",
      "    attempts = attempts + 1",
      '    PRINT("Wrong password")',
      "  ENDIF",
      "ENDWHILE",
      "",
      "IF NOT loggedIn THEN",
      '  PRINT("Too many attempts")',
      "ENDIF"
    ].join("\n");
    const { output } = await runSource(source, { inputs: ["wrong", "computer"] });

    assert.deepEqual(output, ["Wrong password", "Access granted"]);
  }],

  ["exercise 3 highest of five numbers finds the maximum", async () => {
    const source = [
      "highest = -999999",
      "",
      "FOR i = 1 TO 5",
      '  value = INT(INPUT("Number? "))',
      "  IF value > highest THEN",
      "    highest = value",
      "  ENDIF",
      "NEXT i",
      "",
      'PRINT("Highest is " + STR(highest))'
    ].join("\n");
    const { output } = await runSource(source, { inputs: ["1", "9", "3", "4", "2"] });

    assert.deepEqual(output, ["Highest is 9"]);
  }],

  ["exercise 4 file logger writes and reads a file", async () => {
    const source = [
      'myFile = OPENWRITE("log.txt")',
      'myFile.WRITELINE("First line")',
      'myFile.WRITELINE("Second line")',
      'myFile.WRITELINE("Third line")',
      "myFile.CLOSE()",
      "",
      'myFile = OPENREAD("log.txt")',
      "WHILE NOT myFile.ENDOFFILE()",
      "  PRINT(myFile.READLINE())",
      "ENDWHILE",
      "myFile.CLOSE()"
    ].join("\n");
    const { output, files } = await runSource(source);

    assert.deepEqual(output, ["First line", "Second line", "Third line"]);
    assert.deepEqual(files.get("log.txt"), ["First line", "Second line", "Third line"]);
  }],

  ["exercise 5 grid search finds the target coordinates", async () => {
    const source = [
      "ARRAY grid[3, 3]",
      "",
      'grid[0, 0] = "A"',
      'grid[0, 1] = "B"',
      'grid[0, 2] = "C"',
      'grid[1, 0] = "D"',
      'grid[1, 1] = "E"',
      'grid[1, 2] = "F"',
      'grid[2, 0] = "G"',
      'grid[2, 1] = "H"',
      'grid[2, 2] = "I"',
      "",
      'target = "F"',
      "found = FALSE",
      "",
      "FOR row = 0 TO 2",
      "  FOR col = 0 TO 2",
      "    IF grid[row, col] == target THEN",
      '      PRINT("Found at " + STR(row) + ", " + STR(col))',
      "      found = TRUE",
      "    ENDIF",
      "  NEXT col",
      "NEXT row",
      "",
      "IF NOT found THEN",
      '  PRINT("Not found")',
      "ENDIF"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["Found at 1, 2"]);
  }],

  ["exercise 6 OO counter increments and returns its value", async () => {
    const source = [
      "CLASS Counter",
      "  PRIVATE value",
      "  PUBLIC PROCEDURE NEW(startValue)",
      "    value = startValue",
      "  ENDPROCEDURE",
      "  PUBLIC PROCEDURE addOne()",
      "    value = value + 1",
      "  ENDPROCEDURE",
      "  PUBLIC FUNCTION getValue()",
      "    RETURN value",
      "  ENDFUNCTION",
      "ENDCLASS",
      "",
      "myCounter = NEW Counter(10)",
      "myCounter.addOne()",
      "myCounter.addOne()",
      "PRINT(STR(myCounter.getValue()))"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["12"]);
  }],

  ["procedure locals do not overwrite globals with the same name", async () => {
    const source = [
      "counter = 5",
      "",
      "PROCEDURE bump()",
      "  counter = 10",
      "  PRINT(STR(counter))",
      "ENDPROCEDURE",
      "",
      "bump()",
      "PRINT(STR(counter))"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["10", "5"]);
  }],

  ["derived classes can call inherited getters after SUPER.NEW", async () => {
    const source = [
      "CLASS Book",
      "  PRIVATE title",
      "  PUBLIC PROCEDURE NEW(startTitle)",
      "    title = startTitle",
      "  ENDPROCEDURE",
      "  PUBLIC FUNCTION getTitle()",
      "    RETURN title",
      "  ENDFUNCTION",
      "ENDCLASS",
      "",
      "CLASS Novel INHERITS Book",
      "  PRIVATE edition",
      "  PUBLIC PROCEDURE NEW(startTitle, startEdition)",
      "    SUPER.NEW(startTitle)",
      "    edition = startEdition",
      "  ENDPROCEDURE",
      "  PUBLIC FUNCTION describe()",
      '    RETURN getTitle() + " #" + STR(edition)',
      "  ENDFUNCTION",
      "ENDCLASS",
      "",
      'myNovel = NEW Novel("Dune", 2)',
      "PRINT(myNovel.describe())"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /super\(startTitle\);/);
    assert.deepEqual(output, ["Dune #2"]);
  }],

  ["private fields are accessed through class methods", async () => {
    const source = [
      "CLASS SecretBox",
      "  PRIVATE value",
      "  PUBLIC PROCEDURE NEW(startValue)",
      "    value = startValue",
      "  ENDPROCEDURE",
      "  PUBLIC FUNCTION reveal()",
      "    RETURN value",
      "  ENDFUNCTION",
      "ENDCLASS",
      "",
      'box = NEW SecretBox("hidden")',
      "PRINT(box.reveal())"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["hidden"]);
  }],

  ["boolean precedence keeps NOT above AND above OR", async () => {
    const source = [
      "a = TRUE",
      "b = FALSE",
      "c = TRUE",
      "IF NOT a AND b OR c THEN",
      '  PRINT("yes")',
      "ELSE",
      '  PRINT("no")',
      "ENDIF"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /if \(\(\(\(!\(a\)\) && b\) \|\| c\)\) \{/);
    assert.deepEqual(output, ["yes"]);
  }],

  ["mixed precedence with calls, indexing, and member access stays correct", async () => {
    const source = [
      "FUNCTION twice(value)",
      "  RETURN value + value",
      "ENDFUNCTION",
      "",
      'words = ["abc", "xy"]',
      "IF NOT FALSE AND twice(words[0].length) == 6 OR words[1].SUBSTRING(0, 1) == \"x\" THEN",
      '  PRINT("ok")',
      "ELSE",
      '  PRINT("bad")',
      "ENDIF"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /await twice\(words\[0\]\.length\) == 6/);
    assert.deepEqual(output, ["ok"]);
  }],

  ["empty files still work with ENDOFFILE", async () => {
    const source = [
      'myFile = OPENREAD("empty.txt")',
      "WHILE NOT myFile.ENDOFFILE()",
      "  PRINT(myFile.READLINE())",
      "ENDWHILE",
      "myFile.CLOSE()",
      'PRINT("done")'
    ].join("\n");
    const { output, files } = await runSource(source, {
      files: new Map([["empty.txt", []]])
    });

    assert.deepEqual(output, ["done"]);
    assert.deepEqual(files.get("empty.txt"), []);
  }],

  ["reading past EOF stays empty and EOF remains true", async () => {
    const source = [
      'myFile = OPENREAD("sample.txt")',
      "PRINT(STR(myFile.ENDOFFILE()))",
      "PRINT(myFile.READLINE())",
      "PRINT(STR(myFile.ENDOFFILE()))",
      "PRINT(myFile.READLINE())",
      "PRINT(STR(myFile.ENDOFFILE()))",
      "myFile.CLOSE()"
    ].join("\n");
    const { output } = await runSource(source, {
      files: new Map([["sample.txt", []]])
    });

    assert.deepEqual(output, ["true", "", "true", "", "true"]);
  }],

  ["opening a missing file is safe and behaves like an empty reader", async () => {
    const source = [
      'myFile = OPENREAD("missing.txt")',
      "PRINT(STR(myFile.ENDOFFILE()))",
      "PRINT(myFile.READLINE())",
      "myFile.CLOSE()"
    ].join("\n");
    const { output, files } = await runSource(source);

    assert.deepEqual(output, ["true", ""]);
    assert.deepEqual(files.get("missing.txt"), undefined);
  }],

  ["OCR string handling example returns length and substring", async () => {
    const source = [
      'someText = "Computer Science"',
      "PRINT(STR(someText.LENGTH))",
      "PRINT(someText.SUBSTRING(3, 3))"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["16", "put"]);
  }],

  ["OCR string handling guide example works with mixed-case method names", async () => {
    const source = [
      'someText = "Computer Science"',
      "PRINT(STR(someText.length))",
      "PRINT(someText.subString(3, 3))"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["16", "put"]);
  }],

  ["OCR guide string example prints length and substring with lowercase syntax", async () => {
    const source = [
      'someText = "Computer Science"',
      "print(someText.length)",
      "print(someText.subString(3, 3))"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["16", "put"]);
  }],

  ["OCR object orientation guide example can set and get a private field", async () => {
    const source = [
      "CLASS Player",
      "  PRIVATE attempts",
      "  PUBLIC PROCEDURE NEW()",
      "    attempts = 3",
      "  ENDPROCEDURE",
      "  PUBLIC PROCEDURE setAttempts(number)",
      "    attempts = number",
      "  ENDPROCEDURE",
      "  PRIVATE FUNCTION getAttempts()",
      "    RETURN attempts",
      "  ENDFUNCTION",
      "ENDCLASS",
      "",
      "player = NEW Player()",
      "player.setAttempts(5)",
      "PRINT(STR(player.getAttempts()))"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["5"]);
  }],

  ["OCR guide constructor and inheritance example works with lowercase syntax", async () => {
    const source = [
      "class Pet",
      "  private name",
      "  public procedure new(givenName)",
      "    name = givenName",
      "  endprocedure",
      "  public function getName()",
      "    return name",
      "  endfunction",
      "endclass",
      "",
      "class Dog inherits Pet",
      "  private breed",
      "  public procedure new(givenName, givenBreed)",
      "    super.new(givenName)",
      "    breed = givenBreed",
      "  endprocedure",
      "  public function describe()",
      '    return getName() + " - " + breed',
      "  endfunction",
      "endclass",
      "",
      'myDog = new Dog("Fido", "Scottish Terrier")',
      "print(myDog.describe())"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["Fido - Scottish Terrier"]);
  }],

  ["OCR guide file-reading loop works with lowercase openRead/readLine/endOfFile", async () => {
    const source = [
      'myFile = openRead("sample.txt")',
      "while NOT myFile.endOfFile()",
      "  print(myFile.readLine())",
      "endwhile",
      "myFile.close()"
    ].join("\n");
    const { output } = await runSource(source, {
      files: new Map([["sample.txt", ["alpha", "beta"]]])
    });

    assert.deepEqual(output, ["alpha", "beta"]);
  }],

  ["malformed class declaration without a superclass name is rejected", () => {
    assert.throws(
      () => translateSource("CLASS Dog INHERITS\nENDCLASS"),
      (error) => error.message === "Invalid class declaration" && error.line === 1
    );
  }],

  ["duplicate class members are rejected", () => {
    assert.throws(
      () => translateSource([
        "CLASS A",
        "  PUBLIC FUNCTION x()",
        "    RETURN 1",
        "  ENDFUNCTION",
        "  PUBLIC FUNCTION x()",
        "    RETURN 2",
        "  ENDFUNCTION",
        "ENDCLASS"
      ].join("\n")),
      (error) => /Duplicate class member declaration: x/.test(error.message) && error.line === 5
    );

    assert.throws(
      () => translateSource([
        "CLASS A",
        "  PRIVATE x",
        "  PRIVATE x",
        "ENDCLASS"
      ].join("\n")),
      (error) => /Duplicate class member declaration: x/.test(error.message) && error.line === 3
    );
  }],

  ["SUPER outside a class is rejected", () => {
    assert.throws(
      () => translateSource("SUPER.NEW()"),
      (error) => /SUPER can only be used inside a class/.test(error.message)
    );
  }],

  ["malformed DEFAULT branches are rejected", () => {
    assert.throws(
      () => translateSource([
        "SWITCH choice:",
        "  DEFAULT x",
        "    PRINT(1)",
        "ENDSWITCH"
      ].join("\n")),
      (error) => error.message === "Invalid default" && error.line === 2
    );
  }],

  ["app persistence round-trips the selected lesson, editor text, toggles, and virtual files", async () => {
    const options = await loadAppOptions();
    const store = new Map();
    const originalLocalStorage = globalThis.localStorage;
    globalThis.localStorage = {
      getItem(key) {
        return store.has(key) ? store.get(key) : null;
      },
      setItem(key, value) {
        store.set(key, String(value));
      }
    };

    try {
      const initial = buildAppInstance(options, {
        editorText: 'PRINT("custom")',
        selectedExample: 0,
        selectedLanguage: "python",
        showVirtualFs: true,
        expandTraceArrays: true,
        compressTraceTable: true,
        virtualFiles: [
          { path: "b.txt", lines: ["two"] },
          { path: "a.txt", lines: ["one"] }
        ],
        selectedVirtualFilePath: "b.txt"
      });
      assert.ok(initial.examples.some((example) => example.name === "Algorithms" && example.separator));
      assert.ok(initial.examples.some((example) => example.name === "Files"));
      initial.persistState();

      const saved = JSON.parse(store.get("ocr-pseudocode-teaching-tool:v1"));
      assert.equal(saved.editorText, 'PRINT("custom")');
      assert.equal(saved.selectedLanguage, "python");
      assert.equal(saved.showVirtualFs, true);
      assert.equal(saved.expandTraceArrays, true);
      assert.equal(saved.compressTraceTable, true);
      assert.equal(saved.selectedVirtualFilePath, "b.txt");
      assert.equal(saved.selectedExampleName, initial.examples[0].name);
      assert.deepEqual(saved.virtualFiles, [
        { path: "b.txt", lines: ["two"] },
        { path: "a.txt", lines: ["one"] }
      ]);

      store.set("ocr-pseudocode-teaching-tool:v1", JSON.stringify({
        editorText: 'PRINT("restored")',
        selectedExample: 0,
        selectedExampleName: "Files (Python)",
        selectedLanguage: "python",
        showVirtualFs: true,
        expandTraceArrays: true,
        compressTraceTable: true,
        virtualFiles: [{ path: "notes.txt", lines: ["alpha"] }],
        selectedVirtualFilePath: "notes.txt"
      }));

      const restored = buildAppInstance(options);
      restored.restoreState();

      assert.equal(restored.editorText, 'PRINT("restored")');
      assert.equal(restored.selectedLanguage, "python");
      assert.equal(restored.showVirtualFs, true);
      assert.equal(restored.expandTraceArrays, true);
      assert.equal(restored.compressTraceTable, true);
      assert.equal(restored.virtualFiles.length, 1);
      assert.equal(restored.virtualFiles[0].path, "notes.txt");
      assert.equal(restored.selectedVirtualFilePath, "notes.txt");
      assert.equal(restored.examples[restored.selectedExample].name, "Files");
    } finally {
      globalThis.localStorage = originalLocalStorage;
    }
  }],

  ["app editor load, save, upload, download, and delete flows update state correctly", async () => {
    const options = await loadAppOptions();
    const downloads = [];
    const blobs = [];
    const originalBlob = globalThis.Blob;
    const originalURL = globalThis.URL;
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    const originalLocalStorage = globalThis.localStorage;

    globalThis.Blob = class {
      constructor(parts, init) {
        this.parts = parts;
        this.type = init && init.type;
        blobs.push(this);
      }
    };
    globalThis.URL = {
      createObjectURL() {
        return "blob:mock";
      },
      revokeObjectURL() {}
    };
    globalThis.document = {
      createElement(tag) {
        assert.equal(tag, "a");
        const anchor = {
          href: "",
          download: "",
          rel: "",
          click() {
            downloads.push({ href: this.href, download: this.download });
          }
        };
        return anchor;
      }
    };
    globalThis.window = {
      setTimeout(fn) {
        fn();
      }
    };
    globalThis.localStorage = {
      getItem() {
        return null;
      },
      setItem() {}
    };

    try {
      const app = buildAppInstance(options, {
        editorText: 'PRINT("before")',
        virtualFiles: [{ path: "note.txt", lines: ["alpha"] }],
        selectedVirtualFilePath: "note.txt",
        $refs: {
          editorLoadInput: { value: "" },
          virtualFsUpload: { value: "" }
        }
      });

      await app.handleEditorLoad({
        target: {
          value: "ignored",
          files: [{
            name: "lesson.psu",
            text: async () => 'PRINT("loaded")\r\nPRINT("again")'
          }]
        }
      });
      assert.equal(app.editorText, 'PRINT("loaded")\nPRINT("again")');
      assert.deepEqual(app.virtualFiles, []);

      app.saveEditorProgram();
      assert.equal(blobs.length, 1);
      assert.equal(blobs[0].parts.join(""), 'PRINT("loaded")\nPRINT("again")');
      assert.equal(blobs[0].type, "text/plain;charset=utf-8");
      assert.equal(downloads[0].download, "program.psu");

      await app.handleVirtualFsUpload({
        target: {
          value: "ignored",
          files: [
            {
              name: "folder/a.txt",
              webkitRelativePath: "folder/a.txt",
              text: async () => "alpha\nbeta"
            },
            {
              name: "plain.txt",
              text: async () => "gamma"
            }
          ]
        }
      });

      assert.equal(app.selectedVirtualFilePath, "folder/a.txt");
      assert.deepEqual(app.virtualFiles, [
        { path: "folder/a.txt", lines: ["alpha", "beta"] },
        { path: "plain.txt", lines: ["gamma"] }
      ]);

      app.downloadSelectedVirtualFile();
      assert.equal(downloads[1].download, "a.txt");

      app.clearVirtualFiles(false);
      assert.deepEqual(app.virtualFiles, []);
      assert.equal(app.selectedVirtualFilePath, "");
    } finally {
      globalThis.Blob = originalBlob;
      globalThis.URL = originalURL;
      globalThis.document = originalDocument;
      globalThis.window = originalWindow;
      globalThis.localStorage = originalLocalStorage;
    }
  }],

  ["missing terminators inside nested class bodies are still reported", () => {
    assert.throws(
      () => translateSource([
        "CLASS Box",
        "  PUBLIC PROCEDURE NEW()",
        "    IF TRUE THEN",
        '      PRINT("x")',
        "    ENDIF",
        "ENDCLASS"
      ].join("\n")),
      (error) => error.message === "Missing procedure terminator" && error.line === 2
    );
  }],

  ["lesson changes and editor loads keep virtual files cleared and hide JS", () => {
    const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
    const htmlSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");

    assert.match(appSource, /selectedExample\(\)\s*\{[\s\S]*?this\.stopProgram\(true\);/);
    assert.match(appSource, /loadExample\(\)\s*\{[\s\S]*?this\.clearVirtualFiles\(false\);/);
    assert.match(appSource, /async handleEditorLoad\(event\)\s*\{[\s\S]*?this\.clearVirtualFiles\(false\);/);
    assert.match(appSource, /persistState\(\)\s*\{[\s\S]*?selectedExampleName:/);
    assert.match(appSource, /restoreState\(\)\s*\{[\s\S]*?selectedExampleName/);
    assert.match(htmlSource, /<span>Load<\/span>/);
    assert.match(htmlSource, /<span>Save<\/span>/);
    assert.match(htmlSource, /Delete Files/);
    assert.match(htmlSource, /editorLoadInput/);
  }],

  ["OCR switch guide example selects the correct case", async () => {
    const source = [
      "entry = \"B\"",
      "SWITCH entry:",
      "  CASE \"A\":",
      '    PRINT("You selected A")',
      "  CASE \"B\":",
      '    PRINT("You selected B")',
      "  DEFAULT:",
      '    PRINT("Unrecognised selection")',
      "ENDSWITCH"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["You selected B"]);
  }],

  ["OCR-style word concatenation loop builds a string from an array", async () => {
    const source = [
      "words = [\"A\", \"B\", \"C\"]",
      'contents = ""',
      "count = 0",
      "WHILE count < 3",
      '  contents = contents + words[count] + " "',
      "  count = count + 1",
      "ENDWHILE",
      "PRINT(contents)"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["A B C "]);
  }],

  ["recursive binary search style function finds an item in a sorted array", async () => {
    const source = [
      "FUNCTION search(values, value, low, high)",
      "  IF low > high THEN",
      "    RETURN -1",
      "  ENDIF",
      "  mid = (low + high) DIV 2",
      "  IF values[mid] == value THEN",
      "    RETURN mid",
      "  ELSEIF values[mid] > value THEN",
      "    RETURN search(values, value, low, mid - 1)",
      "  ELSE",
      "    RETURN search(values, value, mid + 1, high)",
      "  ENDIF",
      "ENDFUNCTION",
      "",
      "numbers = [3, 7, 12, 19, 25, 31]",
      "PRINT(STR(search(numbers, 19, 0, 5)))"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["3"]);
  }],

  ["private and public methods can cooperate inside a class", async () => {
    const source = [
      "CLASS Player",
      "  PRIVATE attempts",
      "  PUBLIC PROCEDURE NEW()",
      "    attempts = 3",
      "  ENDPROCEDURE",
      "  PUBLIC PROCEDURE setAttempts(number)",
      "    attempts = number",
      "  ENDPROCEDURE",
      "  PRIVATE FUNCTION getAttempts()",
      "    RETURN attempts",
      "  ENDFUNCTION",
      "  PUBLIC FUNCTION report()",
      "    RETURN STR(getAttempts())",
      "  ENDFUNCTION",
      "ENDCLASS",
      "",
      "player = NEW Player()",
      "player.setAttempts(5)",
      "PRINT(player.report())"
    ].join("\n");
    const { output } = await runSource(source);

    assert.deepEqual(output, ["5"]);
  }],

  ["byVal and byRef parameters are accepted in an OCR-style subroutine", async () => {
    const source = [
      "PROCEDURE foobar(x:byVal, y:byRef)",
      "  PRINT(STR(x + y))",
      "ENDPROCEDURE",
      "",
      "foobar(3, 4)"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /async function foobar\(x, y\)/);
    assert.deepEqual(output, ["7"]);
  }],

  ["openWrite overwrites an existing file", async () => {
    const source = [
      'myFile = OPENWRITE("log.txt")',
      'myFile.WRITELINE("First version")',
      "myFile.CLOSE()",
      "",
      'myFile = OPENWRITE("log.txt")',
      'myFile.WRITELINE("Second version")',
      "myFile.CLOSE()",
      "",
      'myFile = OPENREAD("log.txt")',
      "PRINT(myFile.READLINE())",
      "myFile.CLOSE()"
    ].join("\n");
    const { output, files } = await runSource(source);

    assert.deepEqual(output, ["Second version"]);
    assert.deepEqual(files.get("log.txt"), ["Second version"]);
  }],

  ["derived methods can call super methods", async () => {
    const source = [
      "CLASS Pet",
      "  PRIVATE name",
      "  PUBLIC PROCEDURE NEW(givenName)",
      "    name = givenName",
      "  ENDPROCEDURE",
      "  PUBLIC FUNCTION getName()",
      "    RETURN name",
      "  ENDFUNCTION",
      "ENDCLASS",
      "",
      "CLASS Dog INHERITS Pet",
      "  PRIVATE breed",
      "  PUBLIC PROCEDURE NEW(givenName, givenBreed)",
      "    SUPER.NEW(givenName)",
      "    breed = givenBreed",
      "  ENDPROCEDURE",
      "  PUBLIC FUNCTION describe()",
      '    RETURN SUPER.getName() + " - " + breed',
      "  ENDFUNCTION",
      "ENDCLASS",
      "",
      'myDog = NEW Dog("Fido", "Terrier")',
      "PRINT(myDog.describe())"
    ].join("\n");
    const { js, output } = await runSource(source);

    assert.match(js, /super\.getName\(\)/);
    assert.deepEqual(output, ["Fido - Terrier"]);
  }],

  ["python login system checks credentials against a user table", async () => {
    const source = [
      'userTable = [["JArmstrong", "RougeChaireBean"],',
      '             ["SBarrett7", "AmarilloDeskLemon"],',
      '             ["EChisholm4", "JauneStoolCarrot"],',
      '             ["VDunn1", "AzulFutonLime"],',
      '             ["DElms5", "BleuCouchBroccoli"],',
      '             ["EFirsova13", "RojoMattressOrange"],',
      '             ["JGolland6", "VertTableSquash"],',
      '             ["EHartley13", "VerdeMirrorApple"],',
      '             ["DJohstone12", "RoseBedOnion"],',
      '             ["GKirko8", "RosaNightstandPear"],',
      '             ["LLemon8", "BlancDresserPepper"],',
      '             ["HMacCunn6", "RosaOttomanGrapefruit"],',
      '             ["PNevland10", "NoirWardrobeChilli"],',
      '             ["AOldham5", "BlancoPillowStrawberry"],',
      '             ["JPoole8", "VioletCabinetAubergine"]]',
      'name = ""',
      'password = ""',
      'foundName = False',
      'letin = False',
      'index = 0',
      'name = input("Enter your name: ")',
      'password = input("Enter your password: ")',
      'if ((len(name) == 0) or (len(password) == 0)):',
      '    print("Invalid input")',
      'else:',
      '    while ((not foundName) and (index < len(userTable))):',
      '        if (userTable[index][0] == name):',
      '            foundName = True',
      '            if (userTable[index][1] == password):',
      '                letin = True',
      '        else:',
      '            index = index + 1',
      'if (letin):',
      '    print("Welcome")',
      'elif (foundName):',
      '    print("Incorrect password")',
      'else:',
      '    print("User not found")'
    ].join("\n");

    const cases = [
      { inputs: ["JArmstrong", "RougeChaireBean"],  expected: ["Welcome"] },
      { inputs: ["LLemon8",    "WrongPassword"],     expected: ["Incorrect password"] },
      { inputs: ["ZUnknown",   "SomePassword"],      expected: ["User not found"] },
      { inputs: ["",           "RougeChaireBean"],   expected: ["Invalid input", "User not found"] },
      { inputs: ["JArmstrong", ""],                  expected: ["Invalid input", "User not found"] },
    ];

    for (const { inputs, expected } of cases) {
      const { output } = await runSource(source, { inputs }, { language: "python" });
      assert.deepEqual(output, expected, `inputs: ${JSON.stringify(inputs)}`);
    }
  }],

  ["Input_Until_Minus_One sample translates its loop and accumulator", () => {
    const { js } = translateSource(loadTestcase("Input_Until_Minus_One"));

    assert.match(js, /while \(\(number != \(-1\)\)\)/);
    assert.match(js, /String\(total\)/);
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
