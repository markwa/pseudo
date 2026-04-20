import { translateProgram as sharedTranslateProgram } from "./translator.js";

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
      showJs: false,
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
    syncEditorScroll(event) {
      const gutter = this.$refs.gutterScroll;
      if (gutter) {
        gutter.scrollTop = event.target.scrollTop;
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

