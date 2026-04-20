import { translateProgram as sharedTranslateProgram } from "./translator.js";

const STORAGE_KEY = "ocr-pseudocode-teaching-tool:v1";

const SORT_INPUT_SOURCE_BY_LESSON = {
  "Bubble Sort": "tests/testcases/sorting/bubble-sort/unsorted.txt",
  "Insertion Sort": "tests/testcases/sorting/insertion-sort/unsorted.txt",
  "Merge Sort": "tests/testcases/sorting/merge-sort/unsorted.txt",
  "Quick Sort": "tests/testcases/sorting/quick-sort/unsorted.txt"
};

const SEARCH_INPUT_SOURCE = "tests/testcases/searching/common/search.txt";
const FILE_LOOP_INPUT_SOURCE = "tests/testcases/files/sample.txt";

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
      running: false,
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
      this.showJs = false;
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
        this.appendLine("Loaded example: " + example.name, "info");
        this.scrollTerminalToBottom();
      })().catch((error) => {
        if (loadToken !== this.exampleLoadToken) {
          return;
        }
        this.terminalStatus = "Failed to load example";
        this.appendLine(
          `Failed to load example: ${error && error.message ? error.message : String(error)}`,
          "error"
        );
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
        const response = await fetch(source);
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
    async runProgram() {
      await this.exampleLoadPromise;
      this.stopProgram(false);
      this.outputLines = [];
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


