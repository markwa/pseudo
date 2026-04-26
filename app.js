import { translateProgram as sharedTranslateProgram } from "./translator.js";

const STORAGE_KEY = "ocr-pseudocode-teaching-tool:v1";

const SORT_INPUT_SOURCE_BY_LESSON = {
  "Bubble Sort": "example-data/sorting/bubble-sort/unsorted.txt",
  "Insertion Sort": "example-data/sorting/insertion-sort/unsorted.txt",
  "Merge Sort": "example-data/sorting/merge-sort/unsorted.txt",
  "Quick Sort": "example-data/sorting/quick-sort/unsorted.txt"
};

const SEARCH_INPUT_SOURCE = "example-data/searching/common/search.txt";
const FILE_LOOP_INPUT_SOURCE = "example-data/files/sample.txt";

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
    files: [{ path: "sample.txt", source: FILE_LOOP_INPUT_SOURCE }],
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
  },

  {
    name: "Algorithms",
    separator: true
  },
  {
    name: "Bubble Sort",
    files: [{ path: "unsorted.txt", source: SORT_INPUT_SOURCE_BY_LESSON["Bubble Sort"] }],
    code: `// Read 100 numbers, bubble sort them, and write sorted.txt.
ARRAY values[100]
myFile = OPENREAD("unsorted.txt")
index = 0
WHILE NOT myFile.ENDOFFILE()
  values[index] = INT(myFile.READLINE())
  index = index + 1
ENDWHILE
myFile.CLOSE()

FOR pass = 0 TO 98
  FOR i = 0 TO 98 - pass
    IF values[i] > values[i + 1] THEN
      temp = values[i]
      values[i] = values[i + 1]
      values[i + 1] = temp
    ENDIF
  NEXT i
NEXT pass

sortedFile = OPENWRITE("sorted.txt")
FOR i = 0 TO 99
  sortedFile.WRITELINE(STR(values[i]))
NEXT i
sortedFile.CLOSE()

PRINT(STR(values[0]))
PRINT(STR(values[99]))`
  },
  {
    name: "Insertion Sort",
    files: [{ path: "unsorted.txt", source: SORT_INPUT_SOURCE_BY_LESSON["Insertion Sort"] }],
    code: `// Read 100 numbers, insertion sort them, and write sorted.txt.
ARRAY values[100]
myFile = OPENREAD("unsorted.txt")
index = 0
WHILE NOT myFile.ENDOFFILE()
  values[index] = INT(myFile.READLINE())
  index = index + 1
ENDWHILE
myFile.CLOSE()

FOR i = 1 TO 99
  key = values[i]
  j = i - 1
  WHILE j >= 0 AND values[j] > key
    values[j + 1] = values[j]
    j = j - 1
  ENDWHILE
  values[j + 1] = key
NEXT i

sortedFile = OPENWRITE("sorted.txt")
FOR i = 0 TO 99
  sortedFile.WRITELINE(STR(values[i]))
NEXT i
sortedFile.CLOSE()

PRINT(STR(values[0]))
PRINT(STR(values[99]))`
  },
  {
    name: "Merge Sort",
    files: [{ path: "unsorted.txt", source: SORT_INPUT_SOURCE_BY_LESSON["Merge Sort"] }],
    code: `// Read 100 numbers, merge sort them, and write sorted.txt.
PROCEDURE merge(values, temp, left, mid, right)
  i = left
  j = mid + 1
  k = left
  WHILE i <= mid AND j <= right
    IF values[i] <= values[j] THEN
      temp[k] = values[i]
      i = i + 1
    ELSE
      temp[k] = values[j]
      j = j + 1
    ENDIF
    k = k + 1
  ENDWHILE
  WHILE i <= mid
    temp[k] = values[i]
    i = i + 1
    k = k + 1
  ENDWHILE
  WHILE j <= right
    temp[k] = values[j]
    j = j + 1
    k = k + 1
  ENDWHILE
  FOR idx = left TO right
    values[idx] = temp[idx]
  NEXT idx
ENDPROCEDURE

PROCEDURE mergeSort(values, temp, left, right)
  IF left < right THEN
    mid = (left + right) DIV 2
    mergeSort(values, temp, left, mid)
    mergeSort(values, temp, mid + 1, right)
    merge(values, temp, left, mid, right)
  ENDIF
ENDPROCEDURE

ARRAY values[100]
ARRAY temp[100]
myFile = OPENREAD("unsorted.txt")
index = 0
WHILE NOT myFile.ENDOFFILE()
  values[index] = INT(myFile.READLINE())
  index = index + 1
ENDWHILE
myFile.CLOSE()

mergeSort(values, temp, 0, 99)

sortedFile = OPENWRITE("sorted.txt")
FOR i = 0 TO 99
  sortedFile.WRITELINE(STR(values[i]))
NEXT i
sortedFile.CLOSE()

PRINT(STR(values[0]))
PRINT(STR(values[99]))`
  },
  {
    name: "Quick Sort",
    files: [{ path: "unsorted.txt", source: SORT_INPUT_SOURCE_BY_LESSON["Quick Sort"] }],
    code: `// Read 100 numbers, quick sort them, and write sorted.txt.
FUNCTION partition(values, low, high)
  pivot = values[high]
  i = low - 1
  FOR j = low TO high - 1
    IF values[j] <= pivot THEN
      i = i + 1
      temp = values[i]
      values[i] = values[j]
      values[j] = temp
    ENDIF
  NEXT j
  temp = values[i + 1]
  values[i + 1] = values[high]
  values[high] = temp
  RETURN i + 1
ENDFUNCTION

FUNCTION quickSort(values, low, high)
  IF low < high THEN
    pivotIndex = partition(values, low, high)
    quickSort(values, low, pivotIndex - 1)
    quickSort(values, pivotIndex + 1, high)
  ENDIF
ENDFUNCTION

ARRAY values[100]
myFile = OPENREAD("unsorted.txt")
index = 0
WHILE NOT myFile.ENDOFFILE()
  values[index] = INT(myFile.READLINE())
  index = index + 1
ENDWHILE
myFile.CLOSE()

quickSort(values, 0, 99)

sortedFile = OPENWRITE("sorted.txt")
FOR i = 0 TO 99
  sortedFile.WRITELINE(STR(values[i]))
NEXT i
sortedFile.CLOSE()

PRINT(STR(values[0]))
PRINT(STR(values[99]))`
  },
  {
    name: "Linear Search",
    files: [{ path: "search.txt", source: SEARCH_INPUT_SOURCE }],
    code: `// Search a sorted list of vegetables linearly for a target value.
ARRAY values[25]
myFile = OPENREAD("search.txt")
index = 0
WHILE NOT myFile.ENDOFFILE()
  values[index] = myFile.READLINE()
  index = index + 1
ENDWHILE
myFile.CLOSE()

target = INPUT("Target? ")
found = FALSE
index = 0
WHILE index < 25 AND NOT found
  IF values[index] == target THEN
    found = TRUE
    PRINT("Found at " + STR(index))
  ENDIF
  index = index + 1
ENDWHILE

IF NOT found THEN
  PRINT("Not found")
ENDIF`
  },
  {
    name: "Binary Search",
    files: [{ path: "search.txt", source: SEARCH_INPUT_SOURCE }],
    code: `// Search a sorted list of vegetables by repeatedly halving the range.
ARRAY values[25]
myFile = OPENREAD("search.txt")
index = 0
WHILE NOT myFile.ENDOFFILE()
  values[index] = myFile.READLINE()
  index = index + 1
ENDWHILE
myFile.CLOSE()

target = INPUT("Target? ")
low = 0
high = 24
found = FALSE

WHILE low <= high AND NOT found
  mid = (low + high) DIV 2
  IF values[mid] == target THEN
    found = TRUE
    PRINT("Found at " + STR(mid))
  ELSE
    IF values[mid] < target THEN
      low = mid + 1
    ELSE
      high = mid - 1
    ENDIF
  ENDIF
ENDWHILE

IF NOT found THEN
  PRINT("Not found")
ENDIF`
  },
  {
    name: "Examples",
    separator: true
  },
  {
    name: "Battleship",
    code: `// Find the hidden ship on a 3x3 grid.
// You get three attempts to guess the row and column.
ARRAY board[3, 3]
FOR row = 0 TO 2
  FOR col = 0 TO 2
    board[row, col] = "."
  NEXT col
NEXT row

shipRow = 1
shipCol = 2
turn = 0
hit = FALSE

WHILE turn < 3 AND NOT hit
  rowGuess = INT(INPUT("Row? "))
  colGuess = INT(INPUT("Col? "))
  IF rowGuess < 0 OR rowGuess > 2 OR colGuess < 0 OR colGuess > 2 THEN
    PRINT("Out of bounds")
  ELSE
    IF rowGuess == shipRow AND colGuess == shipCol THEN
      board[rowGuess, colGuess] = "X"
      PRINT("Hit!")
      hit = TRUE
    ELSE
      board[rowGuess, colGuess] = "o"
      PRINT("Miss")
    ENDIF
  ENDIF
  turn = turn + 1
ENDWHILE

IF hit THEN
  PRINT("You found the ship.")
ELSE
  PRINT("Game over.")
ENDIF

FOR row = 0 TO 2
  line = ""
  FOR col = 0 TO 2
    line = line + board[row, col]
  NEXT col
  PRINT(line)
NEXT row`
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
      showTraceTable: true,
      expandTraceArrays: false,
      running: false,
      programFinished: false,
      debugPaused: false,
      currentPseudoLine: 0,
      compressTraceTable: false,
      traceEvents: [],
      traceRows: [],
      traceColumns: [],
      traceArrayColumns: [],
      traceArrayPaths: {},
      lastTraceSnapshot: null,
      promptActive: false,
      promptText: "",
      inputValue: "",
      terminalStatus: "Ready",
      worker: null,
      pendingPromptResolver: null,
      exampleLoadToken: 0,
      exampleLoadPromise: Promise.resolve(),
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
    },
    canStep() {
      if (this.programFinished) {
        return false;
      }
      if (this.promptActive) {
        return false;
      }
      if (!this.running) {
        return true;
      }
      return this.debugPaused;
    },
    canContinue() {
      return this.running && this.debugPaused && !this.promptActive;
    },
    canPause() {
      return this.running && !this.debugPaused;
    },
    canRun() {
      return !this.running && !this.programFinished;
    },
    runStateText() {
      if (this.running) {
        return "Running";
      }
      return this.programFinished ? "Finished" : "Idle";
    },
    traceDisplayColumns() {
      return this.buildTraceDisplayColumns();
    },
    traceHeaderGroups() {
      return this.buildTraceHeaderGroups();
    },
    traceVisibleRows() {
      return this.compressTraceTable ? this.buildCompressedTraceRows() : this.traceRows;
    },
    traceEmptyColspan() {
      return (this.compressTraceTable ? 0 : 1) + this.traceDisplayColumns.length;
    },
    traceSummaryText() {
      const count = this.traceVisibleRows.length;
      const label = this.compressTraceTable ? "row" : "step";
      return `${count} ${label}${count === 1 ? "" : "s"}`;
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
      this.stopProgram(true);
      this.showJs = false;
      this.loadExample();
      this.persistState();
    },
    showJs() {
      this.persistState();
    },
    showVirtualFs() {
      this.persistState();
    },
    showTraceTable() {
      this.persistState();
    },
    expandTraceArrays() {
      this.persistState();
    },
    compressTraceTable() {
      this.persistState();
    }
  },
  mounted() {
    this.restoreState();
    this.scrollTerminalToBottom();
  },
  methods: {
    resolveSelectableExampleIndex(index) {
      if (!this.examples.length) {
        return 0;
      }
      let resolved = Math.max(0, Math.min(this.examples.length - 1, index));
      if (!this.examples[resolved]?.separator) {
        return resolved;
      }
      for (let offset = 1; offset < this.examples.length; offset += 1) {
        const next = resolved + offset;
        if (next < this.examples.length && !this.examples[next].separator) {
          return next;
        }
        const prev = resolved - offset;
        if (prev >= 0 && !this.examples[prev].separator) {
          return prev;
        }
      }
      return 0;
    },
    loadExample() {
      const resolvedExample = this.resolveSelectableExampleIndex(this.selectedExample);
      if (resolvedExample !== this.selectedExample) {
        this.selectedExample = resolvedExample;
        return this.exampleLoadPromise;
      }
      const example = this.examples[this.selectedExample];
      const loadToken = ++this.exampleLoadToken;
      this.exampleLoadPromise = (async () => {
        this.clearVirtualFiles(false);
        this.editorText = example.code;
        if (Array.isArray(example.files) && example.files.length) {
          const files = await this.loadExampleFiles(example.files);
          if (loadToken !== this.exampleLoadToken) {
            return;
          }
          this.setVirtualFiles(files);
        }
        if (loadToken !== this.exampleLoadToken) {
          return;
        }
        this.terminalStatus = `Loaded example: ${example.name}`;
      })().catch((error) => {
        if (loadToken !== this.exampleLoadToken) {
          return;
        }
        this.terminalStatus = "Failed to load example";
        this.appendLine(formatExampleLoadError(error), "error");
        this.scrollTerminalToBottom();
      });
      return this.exampleLoadPromise;
    },
    async loadExampleFiles(files) {
      const loaded = [];
      for (const file of files) {
        if (!file || typeof file.path !== "string" || !file.path) {
          continue;
        }
        if (Array.isArray(file.lines)) {
          loaded.push({
            path: file.path,
            lines: file.lines.map((line) => String(line))
          });
          continue;
        }
        const source = typeof file.source === "string" ? file.source : typeof file.url === "string" ? file.url : "";
        if (!source) {
          continue;
        }
        const baseHref = typeof window !== "undefined" && window.location ? window.location.href : import.meta.url;
        const resolvedSource = new URL(source, baseHref).href;
        const response = await fetch(resolvedSource);
        if (!response.ok) {
          throw new Error(`Failed to load example file ${source}`);
        }
        loaded.push({
          path: file.path,
          lines: splitVirtualFileText(await response.text())
        });
      }
      return loaded;
    },
    async startProgram(options = {}) {
      if (this.programFinished) {
        return false;
      }
      const startPaused = !!options.startPaused;
      const initialControl = typeof options.initialControl === "string" ? options.initialControl : "";
      await this.exampleLoadPromise;
      this.stopProgram(false);
      this.outputLines = [];
      this.resetDebugState();
      this.applyTraceOptionDirectives(this.editorText);
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
      this.traceColumns = this.extractInitialTraceColumns(compiled.js);
      this.traceArrayColumns = this.extractInitialTraceArrayColumns(compiled.js);
      this.traceArrayPaths = this.extractInitialTraceArrayPaths(compiled.js, this.editorText);

      this.running = true;
      this.programFinished = false;
      this.debugPaused = startPaused;
      this.terminalStatus = startPaused ? "Running (paused)" : "Running";
      this.promptActive = false;
      this.promptText = "";
      this.inputValue = "";

      const worker = createRunnerWorker(this.serializeVirtualFiles());
      this.worker = worker;
      worker.onmessage = (event) => this.handleWorkerMessage(event);
      worker.onerror = (event) => {
        this.outputLines.push({ kind: "error", text: formatWorkerError(event && event.message) });
        this.finishRun(false);
      };
      worker.postMessage({
        type: "run",
        jsCode: compiled.js,
        lineMap: compiled.lineMap,
        debug: {
          enabled: true,
          startPaused
        }
      });
      if (initialControl) {
        worker.postMessage({ type: "debug-control", action: initialControl });
      }
      return true;
    },
    async runProgram() {
      await this.startProgram({ startPaused: false });
    },
    applyTraceOptionDirectives(sourceText) {
      const directives = this.parseTraceOptionDirectives(sourceText);
      if (typeof directives.expandTraceArrays === "boolean") {
        this.expandTraceArrays = directives.expandTraceArrays;
      }
      if (typeof directives.compressTraceTable === "boolean") {
        this.compressTraceTable = directives.compressTraceTable;
      }
    },
    parseTraceOptionDirectives(sourceText) {
      const directives = {};
      for (const line of String(sourceText || "").split(/\r?\n/)) {
        const match = line.match(/\/\/\s*#(expand_arrays|compress_rows)\s*:\s*(true|false)\b/i);
        if (!match) {
          continue;
        }
        const enabled = match[2].toLowerCase() === "true";
        if (match[1].toLowerCase() === "expand_arrays") {
          directives.expandTraceArrays = enabled;
        } else if (match[1].toLowerCase() === "compress_rows") {
          directives.compressTraceTable = enabled;
        }
      }
      return directives;
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
      this.programFinished = false;
      this.debugPaused = false;
      this.currentPseudoLine = 0;
      this.terminalStatus = "Idle";
      if (showMessage) {
        this.outputLines = [];
        this.resetDebugState();
      }
    },
    resetDebugState() {
      this.debugPaused = false;
      this.currentPseudoLine = 0;
      this.traceRows = [];
      this.traceEvents = [];
      this.traceColumns = [];
      this.traceArrayColumns = [];
      this.traceArrayPaths = {};
      this.lastTraceSnapshot = null;
    },
    async stepProgram() {
      if (!this.running) {
        await this.startProgram({
          startPaused: true
        });
        return;
      }
      this.sendDebugControl("step");
    },
    continueProgram() {
      this.sendDebugControl("continue");
    },
    pauseProgram() {
      this.sendDebugControl("pause");
    },
    sendDebugControl(action) {
      if (!this.worker || !this.running) {
        return;
      }
      this.worker.postMessage({ type: "debug-control", action });
      if (action === "continue" || action === "step") {
        this.debugPaused = false;
        this.terminalStatus = "Running";
      } else if (action === "pause") {
        this.debugPaused = true;
        this.terminalStatus = "Running (paused)";
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
      if (message.type === "trace-step") {
        this.handleTraceStep(message);
        return;
      }
      if (message.type === "debug-line") {
        this.handleDebugLine(message);
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
      this.programFinished = true;
      this.debugPaused = false;
      this.promptActive = false;
      this.inputValue = "";
      this.pendingPromptResolver = null;
      this.terminalStatus = completed ? "Completed" : "Idle";
    },
    handleTraceStep(message) {
      const pseudoLine = Number(message.pseudoLine) || 0;
      const snapshot = this.cloneTraceSnapshot(message.snapshot && typeof message.snapshot === "object" ? message.snapshot : {});
      const stepIndex = Number(message.stepIndex) || this.traceRows.length + 1;
      this.updateTraceColumns(snapshot);
      const previousSnapshot = this.lastTraceSnapshot;
      const row = {
        step: stepIndex,
        line: pseudoLine,
        snapshot,
        previousSnapshot,
        changes: this.buildTraceChanges(previousSnapshot, snapshot)
      };
      this.lastTraceSnapshot = snapshot;
      this.traceEvents.push(row);
      if (this.traceRowHasVisibleChange(row)) {
        this.traceRows.push(row);
      }
    },
    handleDebugLine(message) {
      const pseudoLine = Number(message.pseudoLine) || 0;
      this.currentPseudoLine = pseudoLine;
      this.debugPaused = !!message.paused;
      this.terminalStatus = this.debugPaused ? "Running (paused)" : "Running";
      this.scrollEditorToLine(pseudoLine);
    },
    updateTraceColumns(snapshot) {
      const nextColumns = new Set(this.traceColumns);
      const nextArrays = new Set(this.traceArrayColumns);
      for (const key of Object.keys(snapshot || {})) {
        nextColumns.add(key);
        if (Array.isArray(snapshot[key])) {
          nextArrays.add(key);
        }
      }
      this.traceArrayColumns = Array.from(nextArrays).filter((column) => nextColumns.has(column));
      this.traceColumns = this.orderTraceColumnNames(Array.from(nextColumns), this.traceArrayColumns);
    },
    orderTraceColumnNames(columns, arrayColumns = []) {
      const arrays = new Set(arrayColumns);
      const uniqueColumns = [];
      const seen = new Set();
      for (const column of columns) {
        if (!seen.has(column)) {
          seen.add(column);
          uniqueColumns.push(column);
        }
      }
      return [
        ...uniqueColumns.filter((column) => !arrays.has(column)),
        ...uniqueColumns.filter((column) => arrays.has(column))
      ];
    },
    buildTraceDisplayColumns() {
      if (!this.expandTraceArrays) {
        return this.traceColumns.map((column) => ({
          key: column,
          label: column,
          source: column,
          path: null,
          expanded: false
        }));
      }
      const sourceRows = this.traceEvents.length ? this.traceEvents : this.traceRows;
      const snapshots = sourceRows.map((row) => row.snapshot).filter(Boolean);
      if (this.lastTraceSnapshot) {
        snapshots.push(this.lastTraceSnapshot);
      }
      const displayColumns = [];
      for (const column of this.traceColumns) {
        const paths = [];
        const seen = new Set();
        for (const path of this.traceArrayPaths[column] || []) {
          const key = path.join(".");
          if (!seen.has(key)) {
            seen.add(key);
            paths.push(path);
          }
        }
        for (const snapshot of snapshots) {
          const value = snapshot ? snapshot[column] : undefined;
          if (!Array.isArray(value)) {
            continue;
          }
          for (const path of this.collectTraceArrayPaths(value)) {
            const key = path.join(".");
            if (!seen.has(key)) {
              seen.add(key);
              paths.push(path);
            }
          }
        }
        if (!paths.length) {
          displayColumns.push({
            key: column,
            label: column,
            source: column,
            path: null,
            expanded: false
          });
          continue;
        }
        for (const path of paths) {
          const suffix = path.map((index) => `[${index}]`).join("");
          displayColumns.push({
            key: `${column}${suffix}`,
            label: suffix,
            group: column,
            source: column,
            path,
            expanded: true
          });
        }
      }
      return displayColumns;
    },
    buildTraceHeaderGroups() {
      const groups = [];
      for (const column of this.traceDisplayColumns) {
        if (!column.expanded) {
          groups.push({
            key: column.key,
            label: column.label,
            colspan: 1,
            rowspan: 2,
            expanded: false
          });
          continue;
        }
        const previous = groups[groups.length - 1];
        if (previous && previous.expanded && previous.label === column.group) {
          previous.colspan += 1;
          continue;
        }
        groups.push({
          key: `group:${column.group}`,
          label: column.group,
          colspan: 1,
          rowspan: 1,
          expanded: true
        });
      }
      return groups;
    },
    collectTraceArrayPaths(value, basePath = []) {
      if (!Array.isArray(value)) {
        return [];
      }
      const paths = [];
      for (let index = 0; index < value.length; index += 1) {
        const nextPath = [...basePath, index];
        if (Array.isArray(value[index])) {
          paths.push(...this.collectTraceArrayPaths(value[index], nextPath));
        } else {
          paths.push(nextPath);
        }
      }
      return paths;
    },
    buildCompressedTraceRows() {
      const rows = [];
      const events = this.traceEvents.length ? this.traceEvents : this.traceRows;
      let currentRow = null;
      for (const event of events) {
        const cells = {};
        for (const column of this.traceDisplayColumns) {
          const value = this.formatTraceCell(event, column);
          if (value !== "") {
            cells[column.key] = value;
          }
        }
        const changedKeys = Object.keys(cells);
        const endsTraceGroup = this.isTraceGroupBoundaryLine(event.line);
        if (!changedKeys.length) {
          if (endsTraceGroup) {
            currentRow = null;
          }
          continue;
        }
        const repeatsChangedValue = currentRow && changedKeys.some((key) => Object.prototype.hasOwnProperty.call(currentRow.cells, key));
        if (!currentRow || repeatsChangedValue) {
          currentRow = {
            key: `compressed-${rows.length + 1}-${event.step}`,
            step: event.step,
            line: event.line,
            compressed: true,
            cells: {}
          };
          rows.push(currentRow);
        }
        Object.assign(currentRow.cells, cells);
        if (endsTraceGroup) {
          currentRow = null;
        }
      }
      return rows;
    },
    isTraceGroupBoundaryLine(lineNumber) {
      if (!Number.isInteger(lineNumber) || lineNumber <= 0) {
        return false;
      }
      const sourceLine = this.editorText.split(/\r?\n/)[lineNumber - 1] || "";
      const code = sourceLine.replace(/\/\/.*$/, "").trim();
      return /^(ENDWHILE|NEXT|UNTIL)\b/i.test(code) || /^ARRAY\s+[A-Za-z][A-Za-z0-9_]*\s*\[[^\]]+\]\s*=/i.test(code);
    },
    extractInitialTraceColumns(jsCode) {
      const hiddenVariables = new Set();
      const handlePattern = /(?:var\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*await\s+__runtime\.open(?:Read|Write)\(/g;
      for (const match of String(jsCode || "").matchAll(handlePattern)) {
        hiddenVariables.add(match[1]);
      }

      const columns = [];
      const seenColumns = new Set();
      const trackPattern = /__runtime\.trackVar\(("(?:[^"\\]|\\.)*")\s*,\s*([A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)?)\)/g;
      for (const match of String(jsCode || "").matchAll(trackPattern)) {
        let name;
        try {
          name = JSON.parse(match[1]);
        } catch {
          continue;
        }
        const valueReference = String(match[2]).replace(/^globalThis\./, "");
        if (hiddenVariables.has(name) || hiddenVariables.has(valueReference)) {
          continue;
        }
        if (!seenColumns.has(name)) {
          seenColumns.add(name);
          columns.push(name);
        }
      }
      return this.orderTraceColumnNames(columns, this.extractInitialTraceArrayColumns(jsCode));
    },
    extractInitialTraceArrayColumns(jsCode) {
      const arrayColumns = new Set();
      const declarationPattern = /var\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:new\s+Array\s*\(|Array\.from\s*\(|\[)/g;
      for (const match of String(jsCode || "").matchAll(declarationPattern)) {
        arrayColumns.add(match[1]);
      }
      return Array.from(arrayColumns);
    },
    extractInitialTraceArrayPaths(jsCode, sourceText = "") {
      const pathsByColumn = {};
      for (const declaration of this.extractSourceArrayDeclarations(sourceText)) {
        const paths = this.buildTraceArrayPathsFromDimensions(declaration.dimensions);
        if (paths.length) {
          pathsByColumn[declaration.name] = paths;
        }
      }
      if (Object.keys(pathsByColumn).length) {
        return pathsByColumn;
      }

      const js = String(jsCode || "");
      const oneDimensionalPattern = /var\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*new\s+Array\((\d+)\)/g;
      for (const match of js.matchAll(oneDimensionalPattern)) {
        pathsByColumn[match[1]] = this.buildTraceArrayPathsFromDimensions([Number(match[2])]);
      }
      const twoDimensionalPattern = /var\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*Array\.from\(\{\s*length:\s*(\d+)\s*\},\s*\(\)\s*=>\s*new\s+Array\((\d+)\)\)/g;
      for (const match of js.matchAll(twoDimensionalPattern)) {
        pathsByColumn[match[1]] = this.buildTraceArrayPathsFromDimensions([Number(match[2]), Number(match[3])]);
      }
      return pathsByColumn;
    },
    extractSourceArrayDeclarations(sourceText) {
      const declarations = [];
      for (const line of String(sourceText || "").split(/\r?\n/)) {
        const code = line.replace(/\/\/.*$/, "").trim();
        const match = code.match(/^ARRAY\s+([A-Za-z][A-Za-z0-9_]*)\s*\[([^\]]+)\]/i);
        if (!match) {
          continue;
        }
        declarations.push({
          name: match[1],
          dimensions: match[2].split(",").map((part) => Number(part.trim()))
        });
      }
      return declarations;
    },
    buildTraceArrayPathsFromDimensions(dimensions) {
      if (!Array.isArray(dimensions) || !dimensions.length || dimensions.length > 2 || dimensions.some((dimension) => !Number.isInteger(dimension) || dimension < 0)) {
        return [];
      }
      const [rows, columns] = dimensions;
      const paths = [];
      if (dimensions.length === 1) {
        for (let index = 0; index < rows; index += 1) {
          paths.push([index]);
        }
        return paths;
      }
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          paths.push([row, column]);
        }
      }
      return paths;
    },
    formatTraceCell(row, column) {
      if (row && row.compressed) {
        const key = column && typeof column === "object" ? column.key : column;
        return row.cells && Object.prototype.hasOwnProperty.call(row.cells, key) ? row.cells[key] : "";
      }
      if (column && typeof column === "object") {
        if (column.expanded) {
          return this.formatExpandedTraceCell(row, column);
        }
        column = column.source;
      }
      if (!row || !row.snapshot || !(column in row.snapshot)) {
        return "";
      }
      const value = row.snapshot[column];
      if (this.isTraceContainer(value) && row.changes && Object.prototype.hasOwnProperty.call(row.changes, column)) {
        return row.changes[column];
      }
      const previousValue = this.previousTraceValue(row, column);
      if (this.hasPreviousTraceValue(row, column) && this.isTraceValueEqual(previousValue, value)) {
        return "";
      }
      if (this.isTraceContainer(value) && this.isTraceContainer(previousValue)) {
        const changes = this.collectTraceValueChanges(previousValue, value, "");
        return changes.join(", ");
      }
      return this.formatTraceValue(value);
    },
    formatExpandedTraceCell(row, column) {
      if (!row || !row.snapshot || !column || !column.source || !Array.isArray(column.path) || !(column.source in row.snapshot)) {
        return "";
      }
      const value = this.getTracePathValue(row.snapshot[column.source], column.path);
      if (value === undefined && !this.hasTracePath(row.snapshot[column.source], column.path)) {
        return "";
      }
      const previousSource = this.previousTraceValue(row, column.source);
      if (this.isTraceContainer(previousSource) && this.hasTracePath(previousSource, column.path)) {
        const previousValue = this.getTracePathValue(previousSource, column.path);
        if (this.isTraceValueEqual(previousValue, value)) {
          return "";
        }
      }
      return this.formatTraceValue(value);
    },
    formatTraceLine(row) {
      if (!this.traceRowHasVisibleChange(row)) {
        return "";
      }
      return row && row.line ? String(row.line) : "";
    },
    traceRowHasVisibleChange(row) {
      if (!row || !row.snapshot) {
        return false;
      }
      return this.traceColumns.some((column) => this.formatTraceCell(row, column) !== "");
    },
    cloneTraceSnapshot(snapshot) {
      try {
        return JSON.parse(JSON.stringify(snapshot || {}));
      } catch {
        return {};
      }
    },
    buildTraceChanges(previousSnapshot, snapshot) {
      const changesByColumn = {};
      if (!previousSnapshot || typeof previousSnapshot !== "object") {
        return changesByColumn;
      }
      for (const column of Object.keys(snapshot || {})) {
        const value = snapshot[column];
        const previousValue = previousSnapshot[column];
        if (this.isTraceContainer(value) && this.isTraceContainer(previousValue)) {
          changesByColumn[column] = this.collectTraceValueChanges(previousValue, value, "").join(", ");
        }
      }
      return changesByColumn;
    },
    hasPreviousTraceValue(row, column) {
      if (row.previousSnapshot && typeof row.previousSnapshot === "object") {
        return Object.prototype.hasOwnProperty.call(row.previousSnapshot, column);
      }
      const rowIndex = this.traceRows.indexOf(row);
      if (rowIndex <= 0) {
        return false;
      }
      const previousRow = this.traceRows[rowIndex - 1];
      return !!(previousRow && previousRow.snapshot && Object.prototype.hasOwnProperty.call(previousRow.snapshot, column));
    },
    previousTraceValue(row, column) {
      if (row.previousSnapshot && typeof row.previousSnapshot === "object") {
        return row.previousSnapshot[column];
      }
      const rowIndex = this.traceRows.indexOf(row);
      if (rowIndex <= 0) {
        return undefined;
      }
      const previousRow = this.traceRows[rowIndex - 1];
      if (!previousRow || !previousRow.snapshot || !(column in previousRow.snapshot)) {
        return undefined;
      }
      return previousRow.snapshot[column];
    },
    getTracePathValue(value, path) {
      let current = value;
      for (const index of path) {
        if (!Array.isArray(current) || index < 0 || index >= current.length) {
          return undefined;
        }
        current = current[index];
      }
      return current;
    },
    hasTracePath(value, path) {
      let current = value;
      for (const index of path) {
        if (!Array.isArray(current) || index < 0 || index >= current.length) {
          return false;
        }
        current = current[index];
      }
      return true;
    },
    formatTraceValue(value) {
      if (value === null) {
        return "null";
      }
      if (typeof value === "string") {
        return JSON.stringify(value);
      }
      if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
      }
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    },
    formatTraceChangeValue(value) {
      if (value === undefined) {
        return "undefined";
      }
      if (Array.isArray(value)) {
        return `[${value.map((entry) => this.formatTraceChangeValue(entry)).join(",")}]`;
      }
      return this.formatTraceValue(value);
    },
    isTraceContainer(value) {
      return value !== null && typeof value === "object";
    },
    isTraceValueEqual(left, right) {
      if (Object.is(left, right)) {
        return true;
      }
      if (!this.isTraceContainer(left) || !this.isTraceContainer(right)) {
        return false;
      }
      if (Array.isArray(left) !== Array.isArray(right)) {
        return false;
      }
      if (Array.isArray(left)) {
        if (left.length !== right.length) {
          return false;
        }
        return left.every((entry, index) => this.isTraceValueEqual(entry, right[index]));
      }
      const leftKeys = Object.keys(left);
      const rightKeys = Object.keys(right);
      if (leftKeys.length !== rightKeys.length) {
        return false;
      }
      return leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && this.isTraceValueEqual(left[key], right[key]));
    },
    collectTraceValueChanges(previousValue, value, path) {
      if (this.isTraceValueEqual(previousValue, value)) {
        return [];
      }
      if (!this.isTraceContainer(previousValue) || !this.isTraceContainer(value) || Array.isArray(previousValue) !== Array.isArray(value)) {
        return [`${path || "value"} = ${this.formatTraceChangeValue(value)}`];
      }
      if (Array.isArray(value)) {
        const changes = [];
        const maxLength = Math.max(previousValue.length, value.length);
        for (let index = 0; index < maxLength; index += 1) {
          if (!this.isTraceValueEqual(previousValue[index], value[index])) {
            const nextPath = `${path}[${index}]`;
            if (Array.isArray(previousValue[index]) && Array.isArray(value[index]) && this.isWholeTraceArrayChanged(previousValue[index], value[index])) {
              changes.push(`${nextPath} = ${this.formatTraceChangeValue(value[index])}`);
              continue;
            }
            changes.push(...this.collectTraceValueChanges(previousValue[index], value[index], nextPath));
          }
        }
        return changes;
      }
      const changes = [];
      const keys = Array.from(new Set([...Object.keys(previousValue), ...Object.keys(value)])).sort((left, right) => left.localeCompare(right));
      for (const key of keys) {
        if (!this.isTraceValueEqual(previousValue[key], value[key])) {
          const nextPath = path ? `${path}.${key}` : key;
          changes.push(...this.collectTraceValueChanges(previousValue[key], value[key], nextPath));
        }
      }
      return changes;
    },
    isWholeTraceArrayChanged(previousValue, value) {
      if (!Array.isArray(previousValue) || !Array.isArray(value) || previousValue.length !== value.length || !value.length) {
        return false;
      }
      return value.every((entry, index) => !this.isTraceValueEqual(previousValue[index], entry));
    },
    reportTranslatorError(error) {
      this.outputLines.push({ kind: "error", text: formatTranslatorError(error) });
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
    scrollEditorToLine(lineNumber) {
      if (!Number.isInteger(lineNumber) || lineNumber <= 0) {
        return;
      }
      const editor = this.$refs.editorArea;
      const gutter = this.$refs.gutterScroll;
      if (!editor) {
        return;
      }
      const style = window.getComputedStyle(editor);
      const lineHeight = Number.parseFloat(style.lineHeight) || 24;
      const targetTop = Math.max(0, (lineNumber - 1) * lineHeight - editor.clientHeight / 2);
      editor.scrollTop = targetTop;
      if (gutter) {
        gutter.scrollTop = targetTop;
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
      this.clearVirtualFiles(false);
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
    clearVirtualFiles(showMessage = true) {
      this.virtualFiles = [];
      this.selectedVirtualFilePath = "";
      if (showMessage) {
        this.terminalStatus = "Virtual filesystem cleared";
        this.appendLine("Virtual filesystem cleared.", "info");
        this.scrollTerminalToBottom();
      }
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
        showTraceTable: this.showTraceTable,
        expandTraceArrays: this.expandTraceArrays,
        compressTraceTable: this.compressTraceTable,
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
            this.selectedExample = this.resolveSelectableExampleIndex(byName);
          }
        } else if (Number.isInteger(state.selectedExample)) {
          this.selectedExample = this.resolveSelectableExampleIndex(state.selectedExample);
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
        if (typeof state.showTraceTable === "boolean") {
          this.showTraceTable = state.showTraceTable;
        }
        if (typeof state.expandTraceArrays === "boolean") {
          this.expandTraceArrays = state.expandTraceArrays;
        }
        if (typeof state.compressTraceTable === "boolean") {
          this.compressTraceTable = state.compressTraceTable;
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
    let pendingDebugResume = null;
    const debugState = {
      enabled: false,
      mode: "continue",
      stepIndex: 0
    };
    const trackedVars = new Map();
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

    function resolveDebugWait() {
      if (!pendingDebugResume) {
        return;
      }
      const resolve = pendingDebugResume;
      pendingDebugResume = null;
      resolve();
    }

    function waitForDebugCommand() {
      return new Promise((resolve) => {
        pendingDebugResume = resolve;
      });
    }

    function setDebugMode(mode) {
      debugState.mode = mode;
      if (mode !== "paused") {
        resolveDebugWait();
      }
    }

    function serializeTraceValue(value, depth = 0) {
      if (value === null || value === undefined) {
        return value === undefined ? null : value;
      }
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return value;
      }
      if (typeof value === "function") {
        return "[Function]";
      }
      if (value && typeof value.__traceLabel === "string") {
        return value.__traceLabel;
      }
      if (depth >= 2) {
        return Array.isArray(value) ? \`Array(\${value.length})\` : "[Object]";
      }
      if (Array.isArray(value)) {
        return value.slice(0, 20).map((entry) => serializeTraceValue(entry, depth + 1));
      }
      if (typeof value === "object") {
        const keys = Object.keys(value).slice(0, 20);
        if (keys.length && keys.every((key) => typeof value[key] === "function")) {
          return "[Object]";
        }
        const result = {};
        for (const key of keys) {
          result[key] = serializeTraceValue(value[key], depth + 1);
        }
        return result;
      }
      return toText(value);
    }

    function isTraceHiddenValue(value) {
      return !!(value && typeof value === "object" && value.__traceHidden);
    }

    function snapshotTrackedVars() {
      const snapshot = {};
      const keys = Array.from(trackedVars.keys());
      for (const key of keys) {
        const value = trackedVars.get(key);
        if (isTraceHiddenValue(value)) {
          continue;
        }
        snapshot[key] = serializeTraceValue(value, 0);
      }
      return snapshot;
    }

    function makeReader(path) {
      const source = fs.get(path) || [];
      let index = 0;
      return {
        __traceHidden: true,
        __traceLabel: "[File]",
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
        __traceHidden: true,
        __traceLabel: "[File]",
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
      },
      trackVar: (name, value) => {
        const key = toText(name);
        trackedVars.set(key, value);
        return value;
      },
      traceStep: async (pseudoLine) => {
        if (!debugState.enabled) {
          return;
        }
        const line = Number(pseudoLine) || 0;
        debugState.stepIndex += 1;
        post("trace-step", {
          stepIndex: debugState.stepIndex,
          pseudoLine: line,
          snapshot: snapshotTrackedVars()
        });
      },
      beforeStep: async (pseudoLine) => {
        if (!debugState.enabled) {
          return;
        }
        const line = Number(pseudoLine) || 0;
        if (debugState.mode === "step") {
          debugState.mode = "paused";
        }
        post("debug-line", {
          pseudoLine: line,
          paused: debugState.mode === "paused"
        });
        while (debugState.mode === "paused") {
          await waitForDebugCommand();
        }
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

      if (data.type === "debug-control") {
        const action = toText(data.action).toLowerCase();
        if (action === "step") {
          setDebugMode("step");
        } else if (action === "continue") {
          setDebugMode("continue");
        } else if (action === "pause") {
          setDebugMode("paused");
        } else if (action === "stop") {
          setDebugMode("paused");
        }
        return;
      }

      if (data.type !== "run") {
        return;
      }

      pendingInput = null;
      pendingDebugResume = null;
      trackedVars.clear();
      debugState.stepIndex = 0;
      debugState.enabled = !!(data.debug && data.debug.enabled);
      debugState.mode = data.debug && data.debug.startPaused ? "paused" : "continue";
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
    return "Runtime error. The program stopped unexpectedly.";
  }
  const pseudoLine = message.pseudoLine ? ` Pseudocode line ${message.pseudoLine}.` : "";
  const raw = String(message.message || "").trim();
  return `Runtime error.${pseudoLine} ${toFriendlyRuntimeMessage(raw)}`.trim();
}

function formatTranslatorError(error) {
  const line = error && error.line ? `Line ${error.line}: ` : "";
  const raw = String((error && error.message) || error || "").trim();
  const message = toFriendlySyntaxMessage(raw);
  return `Syntax error. ${line}${message}`.trim();
}

function formatExampleLoadError(error) {
  const raw = String((error && error.message) || error || "").trim();
  if (/Failed to load example file/i.test(raw)) {
    return "Could not load the example data file. Check that the example-data folder is deployed and publicly accessible.";
  }
  return `Failed to load example: ${raw || "Unknown error"}`;
}

function formatWorkerError(message) {
  const raw = String(message || "").trim();
  if (!raw) {
    return "Runtime worker crashed unexpectedly.";
  }
  return `Runtime worker error: ${raw}`;
}

function toFriendlyRuntimeMessage(raw) {
  if (!raw) {
    return "The program stopped unexpectedly.";
  }
  if (/Cannot read properties of undefined/i.test(raw)) {
    return "Tried to use a value that does not exist. Check array indexes and method calls.";
  }
  if (/is not a function/i.test(raw)) {
    return "Tried to call something that is not a function. Check method names and brackets.";
  }
  if (/already waiting/i.test(raw)) {
    return "A second INPUT was requested before the first one was answered.";
  }
  return raw;
}

function toFriendlySyntaxMessage(raw) {
  if (!raw) {
    return "Could not parse this program.";
  }
  if (/Missing endif/i.test(raw)) {
    return "Missing ENDIF for an IF block.";
  }
  if (/Missing endwhile/i.test(raw)) {
    return "Missing ENDWHILE for a WHILE block.";
  }
  if (/Missing next/i.test(raw)) {
    return "Missing NEXT for a FOR loop.";
  }
  if (/Missing endswitch/i.test(raw)) {
    return "Missing ENDSWITCH for a SWITCH block.";
  }
  if (/Missing function terminator/i.test(raw)) {
    return "Missing ENDFUNCTION for a FUNCTION block.";
  }
  if (/Missing procedure terminator/i.test(raw)) {
    return "Missing ENDPROCEDURE for a PROCEDURE block.";
  }
  if (/Missing endclass/i.test(raw)) {
    return "Missing ENDCLASS for a CLASS block.";
  }
  if (/Missing until clause/i.test(raw)) {
    return "A DO loop must end with UNTIL condition.";
  }
  if (/Invalid if statement/i.test(raw)) {
    return "Invalid IF/ELSEIF syntax. Use IF condition THEN.";
  }
  if (/Invalid for loop/i.test(raw)) {
    return "Invalid FOR syntax. Use FOR i = start TO end.";
  }
  if (/Invalid array declaration/i.test(raw)) {
    return "Invalid ARRAY syntax. Use ARRAY name[size] or ARRAY name[rows, cols].";
  }
  if (/Only one- and two-dimensional arrays are supported/i.test(raw)) {
    return "Only 1D and 2D arrays are supported.";
  }
  if (/Invalid default/i.test(raw)) {
    return "Invalid DEFAULT branch. Use DEFAULT on its own line.";
  }
  if (/Invalid case/i.test(raw)) {
    return "Invalid CASE branch. Use CASE value.";
  }
  if (/Invalid class declaration/i.test(raw)) {
    return "Invalid CLASS declaration. Use CLASS Name or CLASS Name INHERITS Parent.";
  }
  if (/Invalid class body statement/i.test(raw)) {
    return "Invalid statement inside CLASS. Only fields, methods, and visibility keywords are allowed.";
  }
  if (/Duplicate class member declaration/i.test(raw)) {
    return "Duplicate class member name. Rename one of the fields or methods.";
  }
  if (/SUPER can only be used inside a class/i.test(raw)) {
    return "SUPER can only be used inside a class method.";
  }
  if (/return is not valid outside a function or procedure/i.test(raw)) {
    return "RETURN can only be used inside FUNCTION or PROCEDURE.";
  }
  if (/Unclosed string literal/i.test(raw)) {
    return "A string is missing its closing quote.";
  }
  if (/Chained comparisons are not supported/i.test(raw)) {
    return "Chained comparisons are not supported. Split them with AND, for example: a < b AND b < c.";
  }
  if (/new must be followed by a class name/i.test(raw)) {
    return "NEW must be followed by a class name, for example NEW Dog().";
  }
  if (/Expected property name/i.test(raw)) {
    return "Expected a field or method name after '.'.";
  }
  if (/Expected \]/i.test(raw)) {
    return "Missing closing ']' in an array index.";
  }
  if (/Unclosed parenthesis/i.test(raw)) {
    return "Missing closing ')' in an expression.";
  }
  if (/Unexpected end of expression/i.test(raw)) {
    return "Expression ended too early.";
  }
  if (/Unexpected token/i.test(raw)) {
    return "Unexpected token in expression. Check spelling and brackets.";
  }
  if (/Unrecognised statement:/i.test(raw)) {
    return `${raw}. Check keyword spelling and required block endings (ENDIF, ENDWHILE, NEXT, ENDSWITCH).`;
  }
  return raw;
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


