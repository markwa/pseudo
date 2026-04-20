import { translateProgram } from "./translator.js";

const STORAGE_KEY = "ocr-pseudocode-teaching-tool:v1";

const EXAMPLES = [
  {
    name: "Basics",
    code: `global userid = 123
name = input("Enter your name: ")
print("Hello " + name)
score = 6 + 5
print("Score is " + str(score))
if score > 10 then
  print("big")
else
  print("small")
endif`
  },
  {
    name: "Selection and loops",
    code: `count = 0
for i=0 to 2
  print("Loop " + str(i))
next i

answer = ""
while answer != "computer"
  answer = input("Password? ")
endwhile

do
  answer = input("Type computer to stop: ")
until answer == "computer"

switch answer:
  case "computer":
    print("Unlocked")
  default:
    print("Nope")
endswitch`
  },
  {
    name: "Arrays, strings, files",
    code: `array names[5]
names[0] = "Ahmad"
names[1] = "Ben"
names[2] = "Catherine"
names[3] = "Dana"
names[4] = "Elijah"
print(names[3])

someText = "Computer Science"
print(someText.length)
print(someText.substring(3, 3))

myFile = openWrite("sample.txt")
myFile.writeLine("Hello World")
myFile.close()

myFile = openRead("sample.txt")
while NOT myFile.endOfFile()
  print(myFile.readLine())
endwhile
myFile.close()`
  },
  {
    name: "Subroutines and OOP",
    code: `function triple(number)
  return number * 3
endfunction

procedure greeting(name)
  print("hello " + name)
endprocedure

y = triple(7)
greeting("Hamish")

class Pet
  private name
  public procedure new(givenName)
    name = givenName
  endprocedure
  public function getName()
    return name
  endfunction
endclass

class Dog inherits Pet
  private breed
  public procedure new(givenName, givenBreed)
    super.new(givenName)
    breed = givenBreed
  endprocedure
  public function describe()
    return getName() + " - " + breed
  endfunction
endclass

myDog = new Dog("Fido", "Scottish Terrier")
print(myDog.describe())`
  }
];

const KEYWORDS = new Set([
  "AND", "OR", "NOT", "MOD", "DIV",
  "TRUE", "FALSE", "NULL", "NEW", "SUPER", "THIS"
]);

const BINARY_PRECEDENCE = new Map([
  ["OR", 1],
  ["AND", 2],
  ["==", 3],
  ["!=", 3],
  ["<", 4],
  ["<=", 4],
  [">", 4],
  [">=", 4],
  ["+", 5],
  ["-", 5],
  ["*", 6],
  ["/", 6],
  ["MOD", 6],
  ["DIV", 6],
  ["^", 7]
]);

const app = Vue.createApp({
  data() {
    return {
      examples: EXAMPLES,
      selectedExample: 0,
      editorText: EXAMPLES[0].code,
      outputLines: [],
      generatedJs: "",
      lineMap: [],
      showJs: true,
      running: false,
      promptActive: false,
      promptText: "",
      inputValue: "",
      terminalStatus: "Ready",
      worker: null,
      pendingPromptResolver: null,
      editorRevision: 0
    };
  },
  computed: {
    editorLineCount() {
      return Math.max(1, this.editorText.split(/\r?\n/).length);
    }
  },
  watch: {
    editorText: {
      handler() {
        this.editorRevision += 1;
        this.persistState();
      },
      immediate: true
    },
    selectedExample() {
      this.persistState();
    },
    showJs() {
      this.persistState();
    }
  },
  mounted() {
    this.restoreState();
    this.scrollTerminalToBottom();
  },
  methods: {
    loadExample() {
      this.editorText = this.examples[this.selectedExample].code;
      this.terminalStatus = `Loaded example: ${this.examples[this.selectedExample].name}`;
      this.appendLine("Loaded example: " + this.examples[this.selectedExample].name, "info");
      this.scrollTerminalToBottom();
    },
    clearOutput() {
      this.outputLines = [];
      this.terminalStatus = "Output cleared";
    },
    async runProgram() {
      this.stopProgram(false);
      this.outputLines.push({ kind: "info", text: "Compiling pseudocode..." });
      this.terminalStatus = "Translating";
      this.scrollTerminalToBottom();

      let compiled;
      try {
        compiled = translateProgram(this.editorText);
      } catch (error) {
        this.reportTranslatorError(error);
        return;
      }

      this.generatedJs = compiled.js;
      this.lineMap = compiled.lineMap;

      this.outputLines.push({ kind: "info", text: "Running translated JavaScript..." });
      this.running = true;
      this.terminalStatus = "Running";
      this.promptActive = false;
      this.promptText = "";
      this.inputValue = "";

      const worker = createRunnerWorker();
      this.worker = worker;
      worker.onmessage = (event) => this.handleWorkerMessage(event);
      worker.onerror = (event) => {
        this.outputLines.push({ kind: "error", text: `Worker error: ${event.message}` });
        this.finishRun(false);
      };
      worker.postMessage({
        type: "run",
        jsCode: compiled.js,
        lineMap: compiled.lineMap
      });
    },
    stopProgram(showMessage = true) {
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }
      if (this.pendingPromptResolver) {
        this.pendingPromptResolver = null;
      }
      this.promptActive = false;
      this.promptText = "";
      this.inputValue = "";
      this.running = false;
      this.terminalStatus = "Idle";
      if (showMessage) {
        this.appendLine("Run stopped.", "info");
      }
    },
    submitInput() {
      if (!this.promptActive || !this.worker) {
        return;
      }
      const value = this.inputValue;
      this.appendLine(`> ${value}`, "input");
      this.worker.postMessage({ type: "input-response", value });
      this.inputValue = "";
      this.promptActive = false;
      this.promptText = "";
      this.scrollTerminalToBottom();
      this.$nextTick(() => this.focusInput());
    },
    handleWorkerMessage(event) {
      const message = event.data;
      if (message.type === "output") {
        this.appendLine(message.text, message.kind || "output");
        this.scrollTerminalToBottom();
        return;
      }
      if (message.type === "prompt") {
        this.promptActive = true;
        this.promptText = message.text;
        this.terminalStatus = "Waiting for input";
        this.$nextTick(() => this.focusInput());
        this.scrollTerminalToBottom();
        return;
      }
      if (message.type === "done") {
        this.outputLines.push({ kind: "info", text: "Program finished." });
        this.finishRun(true);
        this.scrollTerminalToBottom();
        return;
      }
      if (message.type === "error") {
        this.outputLines.push({ kind: "error", text: formatRuntimeError(message) });
        this.finishRun(false);
        this.scrollTerminalToBottom();
      }
    },
    finishRun(completed) {
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }
      this.running = false;
      this.promptActive = false;
      this.promptText = "";
      this.inputValue = "";
      this.pendingPromptResolver = null;
      this.terminalStatus = completed ? "Completed" : "Idle";
    },
    reportTranslatorError(error) {
      const line = error && error.line ? `Line ${error.line}: ` : "";
      const message = error && error.message ? error.message : String(error);
      this.outputLines.push({ kind: "error", text: `Translation error. ${line}${message}` });
      this.terminalStatus = "Translation failed";
      this.running = false;
      this.scrollTerminalToBottom();
    },
    appendLine(text, kind = "output") {
      this.outputLines.push({ text: String(text), kind });
    },
    scrollTerminalToBottom() {
      this.$nextTick(() => {
        const el = this.$refs.terminalScroll;
        if (el) {
          el.scrollTop = el.scrollHeight;
        }
      });
    },
    focusInput() {
      const field = this.$refs.inputField;
      if (field) {
        field.focus();
      }
    },
    persistState() {
      const payload = {
        editorText: this.editorText,
        selectedExample: this.selectedExample,
        showJs: this.showJs
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    },
    restoreState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          return;
        }
        const state = JSON.parse(raw);
        if (typeof state.editorText === "string") {
          this.editorText = state.editorText;
        }
        if (Number.isInteger(state.selectedExample)) {
          this.selectedExample = Math.max(0, Math.min(this.examples.length - 1, state.selectedExample));
        }
        if (typeof state.showJs === "boolean") {
          this.showJs = state.showJs;
        }
      } catch {
        // Ignore corrupt saved state.
      }
    }
  }
});

app.mount("#app");

function createRunnerWorker() {
  const workerSource = `
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    let pendingInput = null;
    const fs = new Map();

    function post(type, payload = {}) {
      self.postMessage({ type, ...payload });
    }

    function toText(value) {
      if (value === null || value === undefined) return "";
      return String(value);
    }

    function linesFromValue(value) {
      const text = toText(value).replace(/\\r\\n/g, "\\n").replace(/\\r/g, "\\n");
      return text === "" ? [] : text.split("\\n");
    }

    function makeReader(path) {
      const source = fs.get(path) || [];
      let index = 0;
      return {
        async readLine() {
          return index < source.length ? source[index++] : "";
        },
        async endOfFile() {
          return index >= source.length;
        },
        async close() {}
      };
    }

    function makeWriter(path) {
      const buffer = [];
      fs.set(path, buffer);
      return {
        async writeLine(value) {
          buffer.push(toText(value));
        },
        async readLine() {
          return "";
        },
        async endOfFile() {
          return true;
        },
        async close() {}
      };
    }

    const runtime = {
      print: async (value) => {
        post("output", { kind: "output", text: toText(value) });
      },
      input: async (prompt) => {
        if (pendingInput) {
          throw new Error("An input prompt is already waiting.");
        }
        return await new Promise((resolve) => {
          pendingInput = resolve;
          post("prompt", { text: toText(prompt) });
        });
      },
      openRead: async (path) => {
        const filename = toText(path);
        if (!fs.has(filename)) {
          fs.set(filename, []);
        }
        return makeReader(filename);
      },
      openWrite: async (path) => {
        const filename = toText(path);
        return makeWriter(filename);
      }
    };

    function parseStackLine(stack) {
      if (!stack) return null;
      const match = String(stack).match(/ocr-pseudocode-translated\\.js:(\\d+):(\\d+)/i);
      return match ? Number(match[1]) : null;
    }

    function reportError(error, lineMap) {
      const pseudoLine = parseStackLine(error && error.stack);
      const mappedLine = pseudoLine ? lineMap[pseudoLine - 1] || pseudoLine : null;
      post("error", {
        message: error && error.message ? error.message : String(error),
        stack: error && error.stack ? String(error.stack) : "",
        pseudoLine: mappedLine
      });
    }

    self.onmessage = async (event) => {
      const data = event.data || {};
      if (data.type === "input-response") {
        if (pendingInput) {
          const resolve = pendingInput;
          pendingInput = null;
          resolve(toText(data.value));
        }
        return;
      }

      if (data.type !== "run") {
        return;
      }

      pendingInput = null;
      try {
        const code = '"use strict";\\n' + data.jsCode + '\\n//# sourceURL=ocr-pseudocode-translated.js';
        const runner = new AsyncFunction("__runtime", code);
        await runner(runtime);
        post("done", {});
      } catch (error) {
        reportError(error, Array.isArray(data.lineMap) ? data.lineMap : []);
      }
    };
  `;
  const blob = new Blob([workerSource], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  return new Worker(url);
}

function formatRuntimeError(message) {
  if (!message) {
    return "Runtime error.";
  }
  const pseudoLine = message.pseudoLine ? ` Pseudocode line ${message.pseudoLine}.` : "";
  return `Runtime error.${pseudoLine} ${message.message || ""}`.trim();
}

if (false) {
function translateProgram(source) {
  const rawLines = String(source || "").split(/\r?\n/);
  const lines = rawLines.map((line) => normalizeSource(line));
  const ctx = {
    scopeStack: [makeScope()],
    classStack: []
  };
  const result = translateStatements(lines, 0, null, ctx);
  return {
    js: result.lines.join("\n"),
    lineMap: result.lineMap
  };
}

function translateStatements(lines, startIndex, terminators, ctx) {
  const output = [];
  const lineMap = [];
  let i = startIndex;
  while (i < lines.length) {
    const originalLineNumber = i + 1;
    const stripped = stripComments(lines[i]).trim();
    if (!stripped) {
      i += 1;
      continue;
    }

    if (terminators && terminators.some((term) => term.test(stripped))) {
      break;
    }

    const classContext = ctx.classStack[ctx.classStack.length - 1] || null;
    const currentScope = ctx.scopeStack[ctx.scopeStack.length - 1];

    if (/^if\b/i.test(stripped)) {
      const parsed = parseIf(lines, i, ctx);
      output.push(...parsed.lines);
      lineMap.push(...parsed.lineMap);
      i = parsed.nextIndex;
      continue;
    }

    if (/^while\b/i.test(stripped)) {
      const cond = stripped.replace(/^while\b/i, "").trim();
      emit(output, lineMap, originalLineNumber, `while (${emitExpression(cond, ctx, true, classContext)}) {`);
      const inner = translateStatements(lines, i + 1, [/^endwhile\b/i], ctx);
      output.push(...inner.lines);
      lineMap.push(...inner.lineMap);
      if (!/^endwhile\b/i.test(stripComments(lines[inner.nextIndex] || "").trim())) {
        throw syntaxError("Missing endwhile", originalLineNumber);
      }
      emit(output, lineMap, inner.nextIndex + 1, `}`);
      i = inner.nextIndex + 1;
      continue;
    }

    if (/^do\b/i.test(stripped)) {
      emit(output, lineMap, originalLineNumber, "do {");
      const inner = translateStatements(lines, i + 1, [/^until\b/i], ctx);
      output.push(...inner.lines);
      lineMap.push(...inner.lineMap);
      const untilLine = stripComments(lines[inner.nextIndex] || "").trim();
      const untilMatch = untilLine.match(/^until\s+(.+)$/i);
      if (!untilMatch) {
        throw syntaxError("Missing until clause", originalLineNumber);
      }
      emit(output, lineMap, inner.nextIndex + 1, `} while (!(${emitExpression(untilMatch[1], ctx, true, classContext)}));`);
      i = inner.nextIndex + 1;
      continue;
    }

    if (/^for\b/i.test(stripped)) {
      const match = stripped.match(/^for\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s+to\s+(.+)$/i);
      if (!match) {
        throw syntaxError("Invalid for loop", originalLineNumber);
      }
      const [, variable, startExpr, endExpr] = match;
      emit(output, lineMap, originalLineNumber, `for (var ${variable} = ${emitExpression(startExpr, ctx, true, classContext)}; ${variable} <= ${emitExpression(endExpr, ctx, true, classContext)}; ${variable}++) {`);
      currentScope.declared.add(variable);
      const inner = translateStatements(lines, i + 1, [/^next\b/i], ctx);
      output.push(...inner.lines);
      lineMap.push(...inner.lineMap);
      if (!/^next\b/i.test(stripComments(lines[inner.nextIndex] || "").trim())) {
        throw syntaxError("Missing next", originalLineNumber);
      }
      emit(output, lineMap, inner.nextIndex + 1, `}`);
      i = inner.nextIndex + 1;
      continue;
    }

    if (/^switch\b/i.test(stripped)) {
      const expr = stripped.replace(/^switch\b/i, "").replace(/:\s*$/, "").trim();
      emit(output, lineMap, originalLineNumber, `switch (${emitExpression(expr, ctx, true, classContext)}) {`);
      const inner = translateSwitch(lines, i + 1, ctx);
      output.push(...inner.lines);
      lineMap.push(...inner.lineMap);
      if (!/^endswitch\b/i.test(stripComments(lines[inner.nextIndex] || "").trim())) {
        throw syntaxError("Missing endswitch", originalLineNumber);
      }
      emit(output, lineMap, inner.nextIndex + 1, `}`);
      i = inner.nextIndex + 1;
      continue;
    }

    if (/^(function|procedure)\b/i.test(stripped) || /^(public|private)\s+(function|procedure)\b/i.test(stripped)) {
      const parsed = parseFunction(lines, i, ctx, false);
      output.push(...parsed.lines);
      lineMap.push(...parsed.lineMap);
      i = parsed.nextIndex;
      continue;
    }

    if (/^class\b/i.test(stripped)) {
      const parsed = parseClass(lines, i, ctx);
      output.push(...parsed.lines);
      lineMap.push(...parsed.lineMap);
      i = parsed.nextIndex;
      continue;
    }

    if (/^return\b/i.test(stripped)) {
      const expr = stripped.replace(/^return\b/i, "").trim();
      emit(output, lineMap, originalLineNumber, `return ${expr ? emitExpression(expr, ctx, true, classContext) : ""};`);
      i += 1;
      continue;
    }

    if (/^print\s*\(/i.test(stripped)) {
      const call = emitStatementCall(stripped, ctx, classContext, true);
      emit(output, lineMap, originalLineNumber, call);
      i += 1;
      continue;
    }

    if (/^global\b/i.test(stripped)) {
      const globalMatch = stripped.match(/^global\s+(.+)$/i);
      if (!globalMatch) {
        throw syntaxError("Invalid global declaration", originalLineNumber);
      }
      const assignment = globalMatch[1];
      const globalTranslated = translateAssignment(assignment, ctx, classContext, true);
      emit(output, lineMap, originalLineNumber, globalTranslated);
      i += 1;
      continue;
    }

    if (/^array\b/i.test(stripped) || /^Array\b/i.test(stripped)) {
      const match = stripped.match(/^(?:array|Array)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\[([^\]]+)\]$/i);
      if (!match) {
        throw syntaxError("Invalid array declaration", originalLineNumber);
      }
      const [, name, dims] = match;
      const parts = dims.split(",").map((part) => part.trim()).filter(Boolean);
      let js;
      if (parts.length === 1) {
        js = `var ${name} = new Array(${emitExpression(parts[0], ctx, true, classContext)});`;
      } else if (parts.length === 2) {
        js = `var ${name} = Array.from({ length: ${emitExpression(parts[0], ctx, true, classContext)} }, () => new Array(${emitExpression(parts[1], ctx, true, classContext)}));`;
      } else {
        throw syntaxError("Only one- and two-dimensional arrays are supported", originalLineNumber);
      }
      currentScope.declared.add(name);
      emit(output, lineMap, originalLineNumber, js);
      i += 1;
      continue;
    }

    if (/^case\b/i.test(stripped) || /^default\b/i.test(stripped) || /^else\b/i.test(stripped) || /^elseif\b/i.test(stripped) || /^endif\b/i.test(stripped) || /^endwhile\b/i.test(stripped) || /^next\b/i.test(stripped) || /^endswitch\b/i.test(stripped) || /^until\b/i.test(stripped) || /^endfunction\b/i.test(stripped) || /^endprocedure\b/i.test(stripped) || /^endclass\b/i.test(stripped)) {
      break;
    }

    const assignment = translateAssignment(stripped, ctx, classContext, false);
    if (assignment) {
      emit(output, lineMap, originalLineNumber, assignment);
      i += 1;
      continue;
    }

    try {
      const expr = parseExpression(stripped, { allowAwait: true, classContext });
      emit(output, lineMap, originalLineNumber, `${emitExprNode(expr, ctx, { allowAwait: true, classContext })};`);
      i += 1;
      continue;
    } catch {
      // Fall through to a syntax error for genuinely invalid statements.
    }

    throw syntaxError(`Unrecognised statement: ${stripped}`, originalLineNumber);
  }

  return { lines: output, lineMap, nextIndex: i };
}

function parseIf(lines, startIndex, ctx) {
  const output = [];
  const lineMap = [];
  let i = startIndex;
  let branchState = "if";
  const classContext = ctx.classStack[ctx.classStack.length - 1] || null;
  const currentScope = ctx.scopeStack[ctx.scopeStack.length - 1];

  while (i < lines.length) {
    const line = stripComments(lines[i]).trim();
    const lineNumber = i + 1;
    if (!line) {
      i += 1;
      continue;
    }
    if (branchState === "if") {
      const match = line.match(/^if\s+(.+?)\s+then$/i);
      if (!match) {
        throw syntaxError("Invalid if statement", lineNumber);
      }
      emit(output, lineMap, lineNumber, `if (${emitExpression(match[1], ctx, true, classContext)}) {`);
      const inner = translateStatements(lines, i + 1, [/^elseif\b/i, /^else\b/i, /^endif\b/i], ctx);
      output.push(...inner.lines);
      lineMap.push(...inner.lineMap);
      i = inner.nextIndex;
      branchState = "branch";
      continue;
    }

    if (/^elseif\b/i.test(line)) {
      emit(output, lineMap, lineNumber, `} else if (${emitExpression(line.replace(/^elseif\b/i, "").replace(/\s+then\s*$/i, "").trim(), ctx, true, classContext)}) {`);
      const inner = translateStatements(lines, i + 1, [/^elseif\b/i, /^else\b/i, /^endif\b/i], ctx);
      output.push(...inner.lines);
      lineMap.push(...inner.lineMap);
      i = inner.nextIndex;
      continue;
    }

    if (/^else\b/i.test(line)) {
      emit(output, lineMap, lineNumber, "} else {");
      const inner = translateStatements(lines, i + 1, [/^endif\b/i], ctx);
      output.push(...inner.lines);
      lineMap.push(...inner.lineMap);
      i = inner.nextIndex;
      continue;
    }

    if (/^endif\b/i.test(line)) {
      emit(output, lineMap, lineNumber, "}");
      return { lines: output, lineMap, nextIndex: i + 1 };
    }

    throw syntaxError("Malformed if block", lineNumber);
  }

  throw syntaxError("Missing endif", startIndex + 1);
}

function translateSwitch(lines, startIndex, ctx) {
  const output = [];
  const lineMap = [];
  let i = startIndex;
  let openCase = false;
  const classContext = ctx.classStack[ctx.classStack.length - 1] || null;
  while (i < lines.length) {
    const line = stripComments(lines[i]).trim();
    const lineNumber = i + 1;
    if (!line) {
      i += 1;
      continue;
    }
    if (/^case\b/i.test(line)) {
      const exprText = line.replace(/^case\s+/i, "").replace(/\s*:\s*$/, "").trim();
      if (!exprText) {
        throw syntaxError("Invalid case", lineNumber);
      }
      if (openCase) {
        emit(output, lineMap, lineNumber, "break;");
      }
      emit(output, lineMap, lineNumber, `case ${emitExpression(exprText, ctx, true, classContext)}:`);
      openCase = true;
      i += 1;
      continue;
    }
    if (/^default\b/i.test(line)) {
      if (openCase) {
        emit(output, lineMap, lineNumber, "break;");
      }
      emit(output, lineMap, lineNumber, "default:");
      openCase = true;
      i += 1;
      continue;
    }
    if (/^endswitch\b/i.test(line)) {
      if (openCase) {
        emit(output, lineMap, lineNumber, "break;");
      }
      return { lines: output, lineMap, nextIndex: i };
    }
    const inner = translateStatements(lines, i, [/^case\b/i, /^default\b/i, /^endswitch\b/i], ctx);
    output.push(...inner.lines);
    lineMap.push(...inner.lineMap);
    i = inner.nextIndex;
  }
  throw syntaxError("Missing endswitch", startIndex + 1);
}

function parseFunction(lines, startIndex, ctx, isMethod, methodInfo = null) {
  const output = [];
  const lineMap = [];
  const line = stripComments(lines[startIndex]).trim();
  const lineNumber = startIndex + 1;
  const classContext = ctx.classStack[ctx.classStack.length - 1] || null;

  const match = line.match(/^(?:(public|private)\s+)?(function|procedure)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*$/i);
  if (!match) {
    throw syntaxError("Invalid function or procedure declaration", lineNumber);
  }
  const [, , kind, name, paramText] = match;
  const params = splitParams(paramText);
  const bodyLines = [];
  let terminatorRegex = kind.toLowerCase() === "function" ? /^endfunction\b/i : /^endprocedure\b/i;

  let i = startIndex + 1;
  while (i < lines.length) {
    const current = stripComments(lines[i]).trim();
    if (terminatorRegex.test(current)) {
      break;
    }
    bodyLines.push(lines[i]);
    i += 1;
  }
  if (i >= lines.length) {
    throw syntaxError(`Missing ${kind.toLowerCase()} terminator`, lineNumber);
  }

  const childCtx = {
    scopeStack: ctx.scopeStack.slice(),
    classStack: ctx.classStack.slice()
  };
  childCtx.scopeStack.push(makeScope());
  for (const param of params) {
    childCtx.scopeStack[childCtx.scopeStack.length - 1].declared.add(param);
  }
  if (methodInfo && methodInfo.fields) {
    // Class fields stay as object properties; they are not local variables.
  }

  const isConstructor = methodInfo && methodInfo.kind === "constructor";
  const jsHeader = isMethod
    ? `${isConstructor ? "constructor" : `async ${name}`}(${params.join(", ")}) {`
    : `async function ${name}(${params.join(", ")}) {`;
  emit(output, lineMap, lineNumber, jsHeader);

  const fieldInitializers = [];
  if (isConstructor && methodInfo && Array.isArray(methodInfo.fields)) {
    for (const field of methodInfo.fields) {
      fieldInitializers.push(`this.${field} = undefined;`);
    }
  }

  const hasExplicitSuper = isConstructor && methodInfo && methodInfo.extendsName && bodyLines.some((entry) => /^super\.new\s*\(/i.test(stripComments(entry).trim()));

  if (isConstructor && methodInfo && methodInfo.extendsName && !hasExplicitSuper) {
    emit(output, lineMap, lineNumber, "super(...arguments);");
    for (const fieldLine of fieldInitializers) {
      emit(output, lineMap, lineNumber, fieldLine);
    }
  } else if (isConstructor && fieldInitializers.length && !methodInfo.extendsName) {
    for (const fieldLine of fieldInitializers) {
      emit(output, lineMap, lineNumber, fieldLine);
    }
  }

  const parsedBody = translateStatements(bodyLines, 0, null, childCtx);
  const bodyLineOffset = startIndex + 1;
  let insertedFields = false;
  for (let idx = 0; idx < parsedBody.lines.length; idx += 1) {
    const generated = parsedBody.lines[idx];
    const sourceLine = parsedBody.lineMap[idx] + bodyLineOffset;
    if (isConstructor && methodInfo && methodInfo.extendsName && hasExplicitSuper && !insertedFields && /^super\(/.test(generated.trim())) {
      emit(output, lineMap, sourceLine, generated);
      for (const fieldLine of fieldInitializers) {
        emit(output, lineMap, lineNumber, fieldLine);
      }
      insertedFields = true;
      continue;
    }
    emit(output, lineMap, sourceLine, generated);
  }
  if (!insertedFields && fieldInitializers.length && isConstructor && methodInfo && methodInfo.extendsName) {
    for (const fieldLine of fieldInitializers) {
      emit(output, lineMap, lineNumber, fieldLine);
    }
  }
  emit(output, lineMap, lineNumber, "}");

  return {
    lines: output,
    lineMap,
    nextIndex: i + 1
  };
}

function parseClass(lines, startIndex, ctx) {
  const output = [];
  const lineMap = [];
  const header = stripComments(lines[startIndex]).trim();
  const lineNumber = startIndex + 1;
  const match = header.match(/^class\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+inherits\s+([A-Za-z_][A-Za-z0-9_]*))?\s*$/i);
  if (!match) {
    throw syntaxError("Invalid class declaration", lineNumber);
  }
  const [, className, extendsName] = match;
  const classCtx = {
    name: className,
    extendsName: extendsName || null,
    fields: [],
    methods: new Set()
  };
  ctx.classStack.push(classCtx);
  emit(output, lineMap, lineNumber, `class ${className}${extendsName ? ` extends ${extendsName}` : ""} {`);

  let i = startIndex + 1;
  const bodyLines = [];
  while (i < lines.length) {
    const current = stripComments(lines[i]).trim();
    if (/^endclass\b/i.test(current)) {
      break;
    }
    if (!current) {
      i += 1;
      continue;
    }
    const fieldMatch = current.match(/^(?:(?:public|private)\s+)?([A-Za-z_][A-Za-z0-9_]*)(?:\s*=\s*(.+))?$/i);
    const methodMatch = current.match(/^(?:(public|private)\s+)?(function|procedure)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*$/i);
    if (methodMatch) {
      classCtx.methods.add(methodMatch[3]);
      const isConstructor = methodMatch[2].toLowerCase() === "procedure" && methodMatch[3].toLowerCase() === "new";
      const parsedMethod = parseFunction(lines, i, ctx, true, {
        kind: isConstructor ? "constructor" : "method",
        fields: classCtx.fields.slice(),
        extendsName: classCtx.extendsName
      });
      output.push(...parsedMethod.lines);
      lineMap.push(...parsedMethod.lineMap);
      i = parsedMethod.nextIndex;
      continue;
    }
    if (/^(?:(?:public|private)\s+)?[A-Za-z_][A-Za-z0-9_]*\s*(?:=\s*.+)?$/i.test(current)) {
      const fieldName = current.replace(/^(?:public|private)\s+/i, "").split("=")[0].trim();
      if (["return", "if", "elseif", "else", "endif", "while", "endwhile", "for", "next", "switch", "case", "default", "endswitch", "do", "until", "function", "procedure", "class", "endclass", "global", "print"].includes(fieldName.toLowerCase())) {
        throw syntaxError(`Invalid class field declaration: ${current}`, i + 1);
      }
      classCtx.fields.push(fieldName);
      i += 1;
      continue;
    }
    throw syntaxError(`Invalid class body statement: ${current}`, i + 1);
  }

  if (i >= lines.length) {
    throw syntaxError("Missing endclass", lineNumber);
  }

  if (!classCtx.methods.has("new")) {
    const constructorLines = [];
    const constructorMap = [];
    emit(constructorLines, constructorMap, lineNumber, "constructor(...arguments) {");
    if (classCtx.extendsName) {
      emit(constructorLines, constructorMap, lineNumber, "super(...arguments);");
    }
    for (const field of classCtx.fields) {
      emit(constructorLines, constructorMap, lineNumber, `this.${field} = undefined;`);
    }
    emit(constructorLines, constructorMap, lineNumber, "}");
    output.push(...constructorLines);
    lineMap.push(...constructorMap);
  }

  emit(output, lineMap, i + 1, "}");
  ctx.classStack.pop();
  return { lines: output, lineMap, nextIndex: i + 1 };
}

function translateAssignment(statement, ctx, classContext, allowGlobalPrefix) {
  const eqIndex = findAssignmentIndex(statement);
  if (eqIndex === -1) {
    return null;
  }
  let left = statement.slice(0, eqIndex).trim();
  let right = statement.slice(eqIndex + 1).trim();
  if (!left || !right) {
    return null;
  }
  if (allowGlobalPrefix && /^global\b/i.test(left)) {
    const target = left.replace(/^global\b/i, "").trim();
    if (!target) {
      return `globalThis.${target} = ${emitExpression(right, ctx, true, classContext)};`;
    }
    return `globalThis.${target} = ${emitExpression(right, ctx, true, classContext)};`;
  }

  const leftExpr = parseSimpleTarget(left, ctx, classContext);
    if (leftExpr.kind === "identifier") {
      const scope = ctx.scopeStack[ctx.scopeStack.length - 1];
      if (classContext && classContext.fields.includes(leftExpr.name) && !scope.declared.has(leftExpr.name)) {
        return `this.${leftExpr.name} = ${emitExpression(right, ctx, true, classContext)};`;
      }
      if (!scope.declared.has(leftExpr.name)) {
        scope.declared.add(leftExpr.name);
        return `var ${leftExpr.name} = ${emitExpression(right, ctx, true, classContext)};`;
      }
      return `${leftExpr.name} = ${emitExpression(right, ctx, true, classContext)};`;
    }
  return `${leftExpr.code} = ${emitExpression(right, ctx, true, classContext)};`;
}

function parseSimpleTarget(text, ctx, classContext) {
  const expr = parseExpression(text, { allowAwait: true, classContext, inTarget: true });
  if (expr.type === "Identifier") {
    return { kind: "identifier", name: expr.name, code: expr.name };
  }
  return { kind: "complex", code: emitExprNode(expr, ctx, { allowAwait: true, classContext }) };
}

function emitStatementCall(line, ctx, classContext, allowAwait) {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_\.]*)\s*\((.*)\)\s*$/);
  if (!match) {
    throw syntaxError("Invalid call statement", 0);
  }
  const expr = parseExpression(line, { allowAwait, classContext });
  if (expr.type !== "Call") {
    return `${emitExprNode(expr, ctx, { allowAwait, classContext })};`;
  }
  return `${emitExprNode(expr, ctx, { allowAwait, classContext })};`;
}

function emitExpression(text, ctx, allowAwait, classContext) {
  const expr = parseExpression(text, { allowAwait, classContext });
  return emitExprNode(expr, ctx, { allowAwait, classContext });
}

function parseExpression(text, options = {}) {
  const tokens = tokenizeExpression(text);
  let position = 0;

  function peek(offset = 0) {
    return tokens[position + offset] || null;
  }

  function consume(expected = null) {
    const token = tokens[position];
    if (!token) {
      throw new Error("Unexpected end of expression");
    }
    if (expected && token.value !== expected && token.type !== expected) {
      throw new Error(`Expected ${expected}`);
    }
    position += 1;
    return token;
  }

  function parsePrimary() {
    const token = consume();
    if (token.type === "number" || token.type === "string") {
      return { type: "Literal", value: token.value, literalType: token.type };
    }
    if (token.type === "identifier") {
      if (token.value.toUpperCase() === "TRUE") return { type: "Literal", value: true, literalType: "boolean" };
      if (token.value.toUpperCase() === "FALSE") return { type: "Literal", value: false, literalType: "boolean" };
      if (token.value.toUpperCase() === "NULL") return { type: "Literal", value: null, literalType: "null" };
      if (token.value.toUpperCase() === "NEW") {
        const ctor = parsePrimary();
        if (ctor.type !== "Identifier") {
          throw new Error("new must be followed by a class name");
        }
        let args = [];
        if (peek() && peek().value === "(") {
          consume("(");
          args = parseArgumentList();
        }
        return { type: "New", callee: ctor.name, args };
      }
      return { type: "Identifier", name: token.value };
    }
    if (token.value === "(") {
      const expr = parseBinary(0);
      const next = consume();
      if (next.value !== ")") {
        throw new Error("Unclosed parenthesis");
      }
      return expr;
    }
    throw new Error(`Unexpected token ${token.value}`);
  }

  function parsePostfix() {
    let node = parsePrimary();
    while (true) {
      const next = peek();
      if (!next) break;
      if (next.value === "(") {
        consume("(");
        const args = parseArgumentList();
        node = { type: "Call", callee: node, args };
        continue;
      }
      if (next.value === ".") {
        consume(".");
        const name = consume();
        if (name.type !== "identifier") {
          throw new Error("Expected property name");
        }
        node = { type: "Member", object: node, property: name.value };
        continue;
      }
      if (next.value === "[") {
        consume("[");
        const indices = [parseBinary(0)];
        while (peek() && peek().value === ",") {
          consume(",");
          indices.push(parseBinary(0));
        }
        const close = consume();
        if (close.value !== "]") {
          throw new Error("Expected ]");
        }
        node = { type: "Index", object: node, indices };
        continue;
      }
      break;
    }
    return node;
  }

  function parseUnary() {
    const next = peek();
    if (next && (next.value === "-" || next.value === "+" || String(next.value).toUpperCase() === "NOT")) {
      consume();
      return { type: "Unary", operator: String(next.value).toUpperCase() === "NOT" ? "NOT" : next.value, argument: parseUnary() };
    }
    return parsePostfix();
  }

  function parsePower() {
    let left = parseUnary();
    while (peek() && peek().value === "^") {
      consume("^");
      const right = parseUnary();
      left = { type: "Binary", operator: "^", left, right };
    }
    return left;
  }

  function parseFactor() {
    let left = parsePower();
    while (peek() && ["*", "/", "MOD", "DIV"].includes(String(peek().value).toUpperCase())) {
      const op = String(consume().value).toUpperCase();
      const right = parsePower();
      left = { type: "Binary", operator: op, left, right };
    }
    return left;
  }

  function parseTerm() {
    let left = parseFactor();
    while (peek() && ["+", "-"].includes(peek().value)) {
      const op = consume().value;
      const right = parseFactor();
      left = { type: "Binary", operator: op, left, right };
    }
    return left;
  }

  function parseComparison() {
    let left = parseTerm();
    while (peek() && ["<", "<=", ">", ">="].includes(peek().value)) {
      const op = consume().value;
      const right = parseTerm();
      left = { type: "Binary", operator: op, left, right };
    }
    return left;
  }

  function parseEquality() {
    let left = parseComparison();
    while (peek() && ["==", "!="].includes(peek().value)) {
      const op = consume().value;
      const right = parseComparison();
      left = { type: "Binary", operator: op, left, right };
    }
    return left;
  }

  function parseAnd() {
    let left = parseEquality();
    while (peek() && String(peek().value).toUpperCase() === "AND") {
      consume();
      const right = parseEquality();
      left = { type: "Binary", operator: "AND", left, right };
    }
    return left;
  }

  function parseBinary(level) {
    if (level === 0) {
      let left = parseAnd();
      while (peek() && String(peek().value).toUpperCase() === "OR") {
        consume();
        const right = parseAnd();
        left = { type: "Binary", operator: "OR", left, right };
      }
      return left;
    }
    return parseAnd();
  }

  const expr = parseBinary(0);
  if (position !== tokens.length) {
    throw new Error(`Unexpected token ${tokens[position].value}`);
  }
  return expr;

  function parseArgumentList() {
    const args = [];
    if (peek() && peek().value === ")") {
      consume(")");
      return args;
    }
    while (true) {
      args.push(parseBinary(0));
      const token = consume();
      if (token.value === ")") {
        break;
      }
      if (token.value !== ",") {
        throw new Error("Expected , or )");
      }
    }
    return args;
  }
}

function emitExprNode(node, ctx, options = {}) {
  const allowAwait = options.allowAwait !== false;
  const classContext = options.classContext || null;
  switch (node.type) {
    case "Literal":
      if (node.literalType === "string") {
        return JSON.stringify(node.value);
      }
      if (node.literalType === "null") {
        return "null";
      }
      if (node.literalType === "boolean") {
        return node.value ? "true" : "false";
      }
      return String(node.value);
    case "Identifier": {
      if (classContext) {
        if (classContext.methods && classContext.methods.has(node.name)) {
          return `this.${node.name}`;
        }
        if (classContext.fields && classContext.fields.includes(node.name)) {
          return `this.${node.name}`;
        }
      }
      return node.name;
    }
    case "Unary": {
      const inner = emitExprNode(node.argument, ctx, options);
      if (node.operator === "NOT") {
        return `(!(${inner}))`;
      }
      return `(${node.operator}${inner})`;
    }
    case "Binary": {
      const left = emitExprNode(node.left, ctx, options);
      const right = emitExprNode(node.right, ctx, options);
      switch (node.operator) {
        case "AND":
          return `(${left} && ${right})`;
        case "OR":
          return `(${left} || ${right})`;
        case "MOD":
          return `(${left} % ${right})`;
        case "DIV":
          return `(Math.trunc((${left}) / (${right})))`;
        case "^":
          return `(${left} ** ${right})`;
        default:
          return `(${left} ${node.operator} ${right})`;
      }
    }
    case "Call": {
      if (node.callee.type === "Identifier") {
        const name = node.callee.name;
        const args = node.args.map((arg) => emitExprNode(arg, ctx, options));
        if (name === "print") {
          return `${allowAwait ? "await " : ""}__runtime.print(${args.join(", ") || '""'})`;
        }
        if (name === "input") {
          return `${allowAwait ? "await " : ""}__runtime.input(${args[0] || '""'})`;
        }
        if (name === "openRead") {
          return `${allowAwait ? "await " : ""}__runtime.openRead(${args[0] || '""'})`;
        }
        if (name === "openWrite") {
          return `${allowAwait ? "await " : ""}__runtime.openWrite(${args[0] || '""'})`;
        }
        if (name === "int") {
          return `Number.parseInt(${args[0] || "0"}, 10)`;
        }
        if (name === "float") {
          return `Number.parseFloat(${args[0] || "0"})`;
        }
        if (name === "str") {
          return `String(${args[0] || '""'})`;
        }
        if (classContext && name !== "this" && name !== "super") {
          return `${allowAwait ? "await " : ""}this.${name}(${args.join(", ")})`;
        }
        return `${allowAwait ? "await " : ""}${name}(${args.join(", ")})`;
      }
      if (node.callee.type === "Member") {
        const objectCode = emitExprNode(node.callee.object, ctx, options);
        const property = node.callee.property;
        const args = node.args.map((arg) => emitExprNode(arg, ctx, options));
        if (String(property).toLowerCase() === "substring") {
          const start = args[0] || "0";
          const count = args[1] || "0";
          return `(${objectCode}).substring(${start}, (${start}) + (${count}))`;
        }
        if (node.callee.object.type === "Identifier" && node.callee.object.name.toLowerCase() === "super" && String(property).toLowerCase() === "new") {
          return `super(${args.join(", ")})`;
        }
        return `${allowAwait ? "await " : ""}${objectCode}.${property}(${args.join(", ")})`;
      }
      return `${allowAwait ? "await " : ""}${emitExprNode(node.callee, ctx, options)}(${node.args.map((arg) => emitExprNode(arg, ctx, options)).join(", ")})`;
    }
    case "Member":
      return `${emitExprNode(node.object, ctx, options)}.${node.property}`;
    case "Index":
      return `${emitExprNode(node.object, ctx, options)}${node.indices.map((index) => `[${emitExprNode(index, ctx, options)}]`).join("")}`;
    case "New":
      return `new ${node.callee}(${node.args.map((arg) => emitExprNode(arg, ctx, options)).join(", ")})`;
    default:
      return "";
  }
}

function tokenizeExpression(text) {
  const tokens = [];
  const input = String(text);
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let value = "";
      i += 1;
      while (i < input.length) {
        const current = input[i];
        if (current === "\\" && i + 1 < input.length) {
          value += current + input[i + 1];
          i += 2;
          continue;
        }
        if (current === quote) {
          i += 1;
          break;
        }
        value += current;
        i += 1;
      }
      tokens.push({ type: "string", value: decodeStringLiteral(quote, value) });
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let start = i;
      while (i < input.length && /[0-9.]/.test(input[i])) {
        i += 1;
      }
      tokens.push({ type: "number", value: Number(input.slice(start, i)) });
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let start = i;
      while (i < input.length && /[A-Za-z0-9_]/.test(input[i])) {
        i += 1;
      }
      let value = input.slice(start, i);
      const upper = value.toUpperCase();
      if (KEYWORDS.has(upper)) {
        value = upper;
      }
      tokens.push({ type: "identifier", value });
      continue;
    }
    const two = input.slice(i, i + 2);
    if (["==", "!=", "<=", ">="].includes(two)) {
      tokens.push({ type: "operator", value: two });
      i += 2;
      continue;
    }
    if ("+-*/^=<>(),[].:".includes(ch)) {
      tokens.push({ type: "operator", value: ch });
      i += 1;
      continue;
    }
    throw new Error(`Unexpected character ${ch}`);
  }

  return tokens.map((token) => {
    if (token.type === "identifier" && ["AND", "OR", "NOT", "MOD", "DIV", "TRUE", "FALSE", "NULL"].includes(token.value.toUpperCase())) {
      return { type: "identifier", value: token.value.toUpperCase() };
    }
    return token;
  });
}

function stripComments(line) {
  const text = String(line);
  let inString = false;
  let quote = "";
  for (let i = 0; i < text.length - 1; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (inString) {
      if (ch === "\\") {
        i += 1;
        continue;
      }
      if (ch === quote) {
        inString = false;
        quote = "";
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      continue;
    }
    if (ch === "/" && next === "/") {
      return text.slice(0, i);
    }
  }
  return text;
}

function normalizeSource(line) {
  return String(line)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

function splitParams(text) {
  return String(text)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/^(?:byVal|byRef)\s*/i, "").replace(/:[A-Za-z]+$/i, "").trim())
    .filter(Boolean);
}

function decodeStringLiteral(quote, raw) {
  const text = String(raw);
  return text
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\")
    .replace(quote === '"' ? /\\"/g : /\\'/g, quote);
}

function makeScope(parent = null) {
  return {
    parent,
    declared: new Set()
  };
}

function emit(lines, lineMap, sourceLine, code) {
  lines.push(code);
  lineMap.push(sourceLine);
}

function syntaxError(message, line) {
  const error = new Error(message);
  error.line = line;
  return error;
}

function findAssignmentIndex(statement) {
  let depth = 0;
  let inString = false;
  let quote = "";
  for (let i = 0; i < statement.length; i += 1) {
    const ch = statement[i];
    if (inString) {
      if (ch === "\\") {
        i += 1;
        continue;
      }
      if (ch === quote) {
        inString = false;
        quote = "";
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") {
      depth += 1;
    } else if (ch === ")" || ch === "]" || ch === "}") {
      depth -= 1;
    } else if (ch === "=" && depth === 0) {
      const prev = statement[i - 1];
      const next = statement[i + 1];
      if (prev === "=" || prev === "!" || prev === "<" || prev === ">") {
        continue;
      }
      if (next === "=") {
        continue;
      }
      return i;
    }
  }
  return -1;
}
}
