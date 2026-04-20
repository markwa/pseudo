import { translateProgram as sharedTranslateProgram } from "./translator.js";

const STORAGE_KEY = "ocr-pseudocode-teaching-tool:v1";

const EXAMPLES = [
  {
    name: "Input",
    code: `// Ask the user for a name and print a greeting.
name = INPUT("Name? ")
PRINT("Hello " + name)`
  },
  {
    name: "Strings",
    code: `// Manipulate text with concatenation, LENGTH, and SUBSTRING.
text = "HELLO WORLD"
PRINT(text + "!")
PRINT(STR(text.LENGTH))
PRINT(text.SUBSTRING(6, 5))`
  },
  {
    name: "Selection",
    code: `// Use IF / ELSEIF / ELSE to choose one branch.
score = 72
IF score >= 80 THEN
  PRINT("Excellent")
ELSEIF score >= 50 THEN
  PRINT("Pass")
ELSE
  PRINT("Try again")
ENDIF`
  },
  {
    name: "Boolean logic",
    code: `// Combine AND, OR, and NOT inside one decision.
age = 16
hasPermission = TRUE
doorOpen = FALSE
IF (age >= 16 AND hasPermission) OR NOT doorOpen THEN
  PRINT("Allowed")
ELSE
  PRINT("Blocked")
ENDIF`
  },
  {
    name: "Procedures",
    code: `// Procedures are useful for side effects and early RETURN.
PROCEDURE announce(message)
  IF message == "" THEN
    RETURN
  ENDIF
  PRINT(">> " + message)
ENDPROCEDURE

announce("Hello")
announce("")`
  },
  {
    name: "Counted loop",
    code: `// Count from 1 to 3 with a FOR loop.
FOR i = 1 TO 3
  PRINT("Count " + STR(i))
NEXT i`
  },
  {
    name: "While loop",
    code: `// Repeat while the condition stays true.
n = 3
WHILE n > 0
  PRINT(STR(n))
  n = n - 1
ENDWHILE
PRINT("Done")`
  },
  {
    name: "Do until",
    code: `// Keep going until the condition becomes true.
attempts = 0
DO
  attempts = attempts + 1
  PRINT("Try " + STR(attempts))
UNTIL attempts == 3
PRINT("Stopped")`
  },
  {
    name: "Recursion",
    code: `// A function can call itself to count down.
FUNCTION countdown(n)
  IF n == 0 THEN
    RETURN
  ENDIF
  PRINT(STR(n))
  countdown(n - 1)
ENDFUNCTION

countdown(3)`
  },
  {
    name: "2D arrays",
    code: `// Use a two-dimensional array with row and column indexes.
ARRAY board[2, 2]
board[0, 0] = "rook"
board[0, 1] = "knight"
board[1, 0] = "bishop"
board[1, 1] = "queen"
PRINT(board[1, 1])`
  },
  {
    name: "Casting",
    code: `// Convert strings into numbers with INT and FLOAT.
whole = INT("7")
decimal = FLOAT("3.5")
PRINT(STR(whole + 1))
PRINT(STR(decimal + 0.5))`
  },
  {
    name: "Switch",
    code: `// SWITCH / CASE / DEFAULT choose from several fixed values.
day = 3
SWITCH day
  CASE 1
    PRINT("Mon")
  CASE 2
    PRINT("Tue")
  CASE 3
    PRINT("Wed")
  DEFAULT
    PRINT("Other")
ENDSWITCH`
  },
  {
    name: "Inheritance",
    code: `// A class can inherit methods from a parent class.
CLASS Pet
  PRIVATE name
  PUBLIC PROCEDURE NEW(givenName)
    name = givenName
  ENDPROCEDURE
  PUBLIC FUNCTION getName()
    RETURN name
  ENDFUNCTION
ENDCLASS

CLASS Dog INHERITS Pet
  PRIVATE breed
  PUBLIC PROCEDURE NEW(givenName, givenBreed)
    SUPER.NEW(givenName)
    breed = givenBreed
  ENDPROCEDURE
  PUBLIC FUNCTION describe()
    RETURN getName() + " - " + breed
  ENDFUNCTION
ENDCLASS

myDog = NEW Dog("Fido", "Terrier")
PRINT(myDog.describe())`
  },
  {
    name: "Global scope",
    code: `// Use GLOBAL to update a variable outside the procedure.
total = 0

PROCEDURE addToTotal(amount)
  GLOBAL total = amount
ENDPROCEDURE

addToTotal(7)
PRINT(STR(globalThis.total))`
  },
  {
    name: "File loop",
    code: `// Read a file until ENDOFFILE is true.
myFile = OPENREAD("sample.txt")
WHILE NOT myFile.ENDOFFILE()
  PRINT(myFile.READLINE())
ENDWHILE
myFile.CLOSE()`
  },
  {
    name: "Files",
    code: `// Write a file, then read it back line by line.
myFile = OPENWRITE("sample.txt")
myFile.WRITELINE("Hello World")
myFile.CLOSE()

myFile = OPENREAD("sample.txt")
PRINT(myFile.READLINE())
myFile.CLOSE()`
  },
  {
    name: "Functions",
    code: `// Define a function and call it from the main program.
FUNCTION double(n)
  RETURN n * 2
ENDFUNCTION

PRINT(STR(double(4)))`
  },
  {
    name: "Classes",
    code: `// Create a class with a constructor and a method.
CLASS Greeter
  PRIVATE name
  PUBLIC PROCEDURE NEW(who)
    name = who
  ENDPROCEDURE
  PUBLIC FUNCTION greet()
    RETURN "Hi " + name
  ENDFUNCTION
ENDCLASS

g = NEW Greeter("Mia")
PRINT(g.greet())`
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
      showJs: false,
      showVirtualFs: false,
      running: false,
      promptActive: false,
      promptText: "",
      inputValue: "",
      terminalStatus: "Ready",
      worker: null,
      pendingPromptResolver: null,
      virtualFiles: [],
      selectedVirtualFilePath: "",
      editorRevision: 0,
      restoringState: false
    };
  },
  computed: {
    editorLineCount() {
      return Math.max(1, this.editorText.split(/\r?\n/).length);
    },
    selectedVirtualFile() {
      return this.virtualFiles.find((file) => file.path === this.selectedVirtualFilePath) || null;
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
    virtualFiles: {
      handler() {
        this.persistState();
      },
      deep: true
    },
    selectedVirtualFilePath() {
      this.persistState();
    },
    selectedExample() {
      if (this.restoringState) {
        return;
      }
      this.loadExample();
      this.persistState();
    },
    showJs() {
      this.persistState();
    },
    showVirtualFs() {
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
    async runProgram() {
      this.stopProgram(false);
      this.outputLines = [];
      this.outputLines.push({ kind: "info", text: "Compiling pseudocode..." });
      this.terminalStatus = "Translating";
      this.scrollTerminalToBottom();

      let compiled;
      try {
        compiled = sharedTranslateProgram(this.editorText);
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

      const worker = createRunnerWorker(this.serializeVirtualFiles());
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
      this.appendLine(`${this.promptText}${value}`, "input");
      this.worker.postMessage({ type: "input-response", value });
      this.inputValue = "";
      this.promptActive = false;
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
      if (message.type === "fs-state") {
        this.setVirtualFiles(message.files);
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
    focusPromptInput() {
      if (this.promptActive) {
        this.$nextTick(() => this.focusInput());
      }
    },
    syncEditorScroll(event) {
      const gutter = this.$refs.gutterScroll;
      if (gutter) {
        gutter.scrollTop = event.target.scrollTop;
      }
    },
    openVirtualFsUpload() {
      const field = this.$refs.virtualFsUpload;
      if (field) {
        field.value = "";
        field.click();
      }
    },
    openEditorLoadDialog() {
      const field = this.$refs.editorLoadInput;
      if (field) {
        field.value = "";
        field.click();
      }
    },
    saveEditorProgram() {
      const blob = new Blob([this.editorText], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "program.ocr";
      anchor.rel = "noopener";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      this.terminalStatus = "Program saved";
      this.appendLine("Saved program to program.ocr", "info");
      this.scrollTerminalToBottom();
    },
    async handleEditorLoad(event) {
      const file = event.target.files && event.target.files[0];
      event.target.value = "";
      if (!file) {
        return;
      }
      const text = await file.text();
      this.editorText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      this.terminalStatus = `Loaded program: ${file.name}`;
      this.appendLine(`Loaded program: ${file.name}`, "info");
      this.scrollTerminalToBottom();
    },
    async handleVirtualFsUpload(event) {
      const files = Array.from(event.target.files || []);
      event.target.value = "";
      if (!files.length) {
        return;
      }
      const uploaded = [];
      for (const file of files) {
        const text = await file.text();
        uploaded.push({
          path: file.webkitRelativePath || file.name,
          lines: splitVirtualFileText(text)
        });
      }
      this.mergeVirtualFiles(uploaded);
      this.selectedVirtualFilePath = uploaded[0]?.path || this.selectedVirtualFilePath;
      this.persistState();
    },
    downloadSelectedVirtualFile() {
      const file = this.selectedVirtualFile;
      if (!file) {
        return;
      }
      const blob = new Blob([file.lines.join("\n")], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = sanitizeDownloadName(file.path);
      anchor.rel = "noopener";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    },
    formatVirtualFile(file) {
      const text = file.lines.join("\n");
      return text === "" ? "(empty file)" : text;
    },
    mergeVirtualFiles(files) {
      const merged = new Map(this.virtualFiles.map((file) => [file.path, [...file.lines]]));
      for (const file of files) {
        merged.set(file.path, [...file.lines]);
      }
      this.virtualFiles = normalizeVirtualFiles(
        Array.from(merged.entries(), ([path, lines]) => ({ path, lines }))
      );
      this.ensureVirtualFileSelection();
    },
    setVirtualFiles(files) {
      this.virtualFiles = normalizeVirtualFiles(files);
      this.ensureVirtualFileSelection();
      this.persistState();
    },
    serializeVirtualFiles() {
      return this.virtualFiles.map((file) => ({
        path: file.path,
        lines: [...file.lines]
      }));
    },
    ensureVirtualFileSelection() {
      if (this.selectedVirtualFilePath && this.virtualFiles.some((file) => file.path === this.selectedVirtualFilePath)) {
        return;
      }
      this.selectedVirtualFilePath = this.virtualFiles[0]?.path || "";
    },
    persistState() {
      const payload = {
        editorText: this.editorText,
        selectedExample: this.selectedExample,
        selectedExampleName: this.examples[this.selectedExample]?.name || "",
        showJs: this.showJs,
        showVirtualFs: this.showVirtualFs,
        virtualFiles: this.serializeVirtualFiles(),
        selectedVirtualFilePath: this.selectedVirtualFilePath
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    },
    restoreState() {
      try {
        this.restoringState = true;
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          this.restoringState = false;
          return;
        }
        const state = JSON.parse(raw);
        if (typeof state.selectedExampleName === "string") {
          const byName = this.examples.findIndex((example) => example.name === state.selectedExampleName);
          if (byName >= 0) {
            this.selectedExample = byName;
          }
        } else if (Number.isInteger(state.selectedExample)) {
          this.selectedExample = Math.max(0, Math.min(this.examples.length - 1, state.selectedExample));
        }
        if (typeof state.editorText === "string") {
          this.editorText = state.editorText;
        }
        if (typeof state.showJs === "boolean") {
          this.showJs = state.showJs;
        }
        if (typeof state.showVirtualFs === "boolean") {
          this.showVirtualFs = state.showVirtualFs;
        }
        if (Array.isArray(state.virtualFiles)) {
          this.virtualFiles = normalizeVirtualFiles(state.virtualFiles);
        }
        if (typeof state.selectedVirtualFilePath === "string") {
          this.selectedVirtualFilePath = state.selectedVirtualFilePath;
        }
        this.ensureVirtualFileSelection();
      } catch {
        // Ignore corrupt saved state.
      } finally {
        this.restoringState = false;
      }
    }
  }
});

app.mount("#app");

function createRunnerWorker(initialFiles = []) {
  const workerSource = `
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    let pendingInput = null;
    const fs = new Map(${JSON.stringify(initialFiles)}.map((file) => [file.path, Array.isArray(file.lines) ? [...file.lines] : []]));

    function post(type, payload = {}) {
      self.postMessage({ type, ...payload });
    }

    function syncFiles() {
      post("fs-state", {
        files: Array.from(fs.entries(), ([path, lines]) => ({
          path,
          lines: [...lines]
        }))
      });
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
      syncFiles();
      return {
        async writeLine(value) {
          buffer.push(toText(value));
          syncFiles();
        },
        async readLine() {
          return "";
        },
        async endOfFile() {
          return true;
        },
        async close() {
          syncFiles();
        }
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
          syncFiles();
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
      if (Array.isArray(data.files)) {
        fs.clear();
        for (const file of data.files) {
          if (!file || typeof file.path !== "string") {
            continue;
          }
          fs.set(file.path, Array.isArray(file.lines) ? [...file.lines] : []);
        }
      }
      syncFiles();
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

function normalizeVirtualFiles(files) {
  if (!Array.isArray(files)) {
    return [];
  }
  const normalized = [];
  for (const file of files) {
    if (!file || typeof file.path !== "string" || !file.path) {
      continue;
    }
    normalized.push({
      path: file.path,
      lines: Array.isArray(file.lines) ? file.lines.map((line) => String(line)) : []
    });
  }
  normalized.sort((left, right) => left.path.localeCompare(right.path));
  return normalized;
}

function splitVirtualFileText(text) {
  const normalized = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return normalized === "" ? [] : normalized.split("\n");
}

function sanitizeDownloadName(path) {
  const name = String(path).split(/[/\\]/).pop() || "virtual-file.txt";
  return name || "virtual-file.txt";
}

