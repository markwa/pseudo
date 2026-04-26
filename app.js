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

const OCR_EXAMPLES = [
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

const PYTHON_EXAMPLES = [
  {
    name: "Input (Python)",
    code: `# Ask the user for a name and print a greeting.
name = input("Name? ")
print("Hello " + name)`
  },
  {
    name: "Strings (Python)",
    code: `# Manipulate text with concatenation, len(), and slicing.
text = "HELLO WORLD"
print(text + "!")
print(str(len(text)))
print(text[6:11])`
  },
  {
    name: "Selection (Python)",
    code: `# Use if / elif / else to choose one branch.
score = 72
if score >= 80:
    print("Excellent")
elif score >= 50:
    print("Pass")
else:
    print("Try again")`
  },
  {
    name: "Boolean logic (Python)",
    code: `# Combine and, or, and not inside one decision.
age = 16
has_permission = True
door_open = False
if (age >= 16 and has_permission) or not door_open:
    print("Allowed")
else:
    print("Blocked")`
  },
  {
    name: "Procedures (Python)",
    code: `# Use a function for side effects and early return.
def announce(message):
    if message == "":
        return
    print(">> " + message)

announce("Hello")
announce("")`
  },
  {
    name: "Counted loop (Python)",
    code: `# Count from 1 to 3 with range().
for i in range(1, 4):
    print("Count " + str(i))`
  },
  {
    name: "While loop (Python)",
    code: `# Repeat while the condition stays true.
n = 3
while n > 0:
    print(str(n))
    n = n - 1
print("Done")`
  },
  {
    name: "Do until (Python)",
    code: `# Keep going until the condition becomes true.
attempts = 0
while attempts != 3:
    attempts = attempts + 1
    print("Try " + str(attempts))
print("Stopped")`
  },
  {
    name: "Recursion (Python)",
    code: `# A function can call itself to count down.
def countdown(n):
    if n == 0:
        return
    print(str(n))
    countdown(n - 1)

countdown(3)`
  },
  {
    name: "2D arrays (Python)",
    code: `# Use nested lists with row and column indexes.
board = [["rook", "knight"], ["bishop", "queen"]]
print(board[1][1])`
  },
  {
    name: "Casting (Python)",
    code: `# Convert strings into numbers with int() and float().
whole = int("7")
decimal = float("3.5")
print(str(whole + 1))
print(str(decimal + 0.5))`
  },
  {
    name: "Switch (Python)",
    code: `# Use if / elif / else to choose from several fixed values.
day = 3
if day == 1:
    print("Mon")
elif day == 2:
    print("Tue")
elif day == 3:
    print("Wed")
else:
    print("Other")`
  },
  {
    name: "Inheritance (Python)",
    code: `# A class can inherit methods from a parent class.
class Pet:
    def __init__(self, given_name):
        self.name = given_name

    def get_name(self):
        return self.name

class Dog(Pet):
    def __init__(self, given_name, given_breed):
        super().__init__(given_name)
        self.breed = given_breed

    def describe(self):
        return self.get_name() + " - " + self.breed

my_dog = Dog("Fido", "Terrier")
print(my_dog.describe())`
  },
  {
    name: "Global scope (Python)",
    code: `# Use global to update a variable outside the function.
total = 0

def add_to_total(amount):
    global total
    total = amount

add_to_total(7)
print(str(total))`
  },
  {
    name: "File loop (Python)",
    files: [{ path: "sample.txt", source: FILE_LOOP_INPUT_SOURCE }],
    code: `# Read a file until endOfFile() is true.
my_file = openRead("sample.txt")
while not my_file.endOfFile():
    print(my_file.readLine())
my_file.close()`
  },
  {
    name: "Files (Python)",
    code: `# Write a file, then read it back.
my_file = openWrite("sample.txt")
my_file.writeLine("Hello World")
my_file.close()

my_file = openRead("sample.txt")
print(my_file.readLine())
my_file.close()`
  },
  {
    name: "Functions (Python)",
    code: `# Define a function and call it.
def double(n):
    return n * 2

print(str(double(4)))`
  },
  {
    name: "Classes (Python)",
    code: `# Create a class with a constructor and a method.
class Greeter:
    def __init__(self, who):
        self.name = who

    def greet(self):
        return "Hi " + self.name

g = Greeter("Mia")
print(g.greet())`
  },
  {
    name: "Algorithms",
    separator: true
  },
  {
    name: "Bubble Sort (Python)",
    files: [{ path: "unsorted.txt", source: SORT_INPUT_SOURCE_BY_LESSON["Bubble Sort"] }],
    code: `# Read 100 numbers, bubble sort them, and write sorted.txt.
values = []
my_file = openRead("unsorted.txt")
index = 0
while not my_file.endOfFile():
    values[index] = int(my_file.readLine())
    index = index + 1
my_file.close()

for current_pass in range(0, 99):
    for i in range(0, 99 - current_pass):
        if values[i] > values[i + 1]:
            temp = values[i]
            values[i] = values[i + 1]
            values[i + 1] = temp

sorted_file = openWrite("sorted.txt")
for i in range(0, 100):
    sorted_file.writeLine(str(values[i]))
sorted_file.close()

print(str(values[0]))
print(str(values[99]))`
  },
  {
    name: "Insertion Sort (Python)",
    files: [{ path: "unsorted.txt", source: SORT_INPUT_SOURCE_BY_LESSON["Insertion Sort"] }],
    code: `# Read 100 numbers, insertion sort them, and write sorted.txt.
values = []
my_file = openRead("unsorted.txt")
index = 0
while not my_file.endOfFile():
    values[index] = int(my_file.readLine())
    index = index + 1
my_file.close()

for i in range(1, 100):
    key = values[i]
    j = i - 1
    while j >= 0 and values[j] > key:
        values[j + 1] = values[j]
        j = j - 1
    values[j + 1] = key

sorted_file = openWrite("sorted.txt")
for i in range(0, 100):
    sorted_file.writeLine(str(values[i]))
sorted_file.close()

print(str(values[0]))
print(str(values[99]))`
  },
  {
    name: "Merge Sort (Python)",
    files: [{ path: "unsorted.txt", source: SORT_INPUT_SOURCE_BY_LESSON["Merge Sort"] }],
    code: `# Read 100 numbers, merge sort them, and write sorted.txt.
def merge(values, temp, left, mid, right):
    i = left
    j = mid + 1
    k = left
    while i <= mid and j <= right:
        if values[i] <= values[j]:
            temp[k] = values[i]
            i = i + 1
        else:
            temp[k] = values[j]
            j = j + 1
        k = k + 1
    while i <= mid:
        temp[k] = values[i]
        i = i + 1
        k = k + 1
    while j <= right:
        temp[k] = values[j]
        j = j + 1
        k = k + 1
    for idx in range(left, right + 1):
        values[idx] = temp[idx]

def merge_sort(values, temp, left, right):
    if left < right:
        mid = int((left + right) / 2)
        merge_sort(values, temp, left, mid)
        merge_sort(values, temp, mid + 1, right)
        merge(values, temp, left, mid, right)

values = []
temp = []
my_file = openRead("unsorted.txt")
index = 0
while not my_file.endOfFile():
    values[index] = int(my_file.readLine())
    temp[index] = 0
    index = index + 1
my_file.close()

merge_sort(values, temp, 0, 99)

sorted_file = openWrite("sorted.txt")
for i in range(0, 100):
    sorted_file.writeLine(str(values[i]))
sorted_file.close()

print(str(values[0]))
print(str(values[99]))`
  },
  {
    name: "Quick Sort (Python)",
    files: [{ path: "unsorted.txt", source: SORT_INPUT_SOURCE_BY_LESSON["Quick Sort"] }],
    code: `# Read 100 numbers, quick sort them, and write sorted.txt.
def partition(values, low, high):
    pivot = values[high]
    i = low - 1
    for j in range(low, high):
        if values[j] <= pivot:
            i = i + 1
            temp = values[i]
            values[i] = values[j]
            values[j] = temp
    temp = values[i + 1]
    values[i + 1] = values[high]
    values[high] = temp
    return i + 1

def quick_sort(values, low, high):
    if low < high:
        pivot_index = partition(values, low, high)
        quick_sort(values, low, pivot_index - 1)
        quick_sort(values, pivot_index + 1, high)

values = []
my_file = openRead("unsorted.txt")
index = 0
while not my_file.endOfFile():
    values[index] = int(my_file.readLine())
    index = index + 1
my_file.close()

quick_sort(values, 0, 99)

sorted_file = openWrite("sorted.txt")
for i in range(0, 100):
    sorted_file.writeLine(str(values[i]))
sorted_file.close()

print(str(values[0]))
print(str(values[99]))`
  },
  {
    name: "Linear Search (Python)",
    files: [{ path: "search.txt", source: SEARCH_INPUT_SOURCE }],
    code: `# Search a sorted list of vegetables linearly for a target value.
values = []
my_file = openRead("search.txt")
index = 0
while not my_file.endOfFile():
    values[index] = my_file.readLine()
    index = index + 1
my_file.close()

target = input("Target? ")
found = False
index = 0
while index < 25 and not found:
    if values[index] == target:
        found = True
        print("Found at " + str(index))
    index = index + 1

if not found:
    print("Not found")`
  },
  {
    name: "Binary Search (Python)",
    files: [{ path: "search.txt", source: SEARCH_INPUT_SOURCE }],
    code: `# Search a sorted list of vegetables by repeatedly halving the range.
values = []
my_file = openRead("search.txt")
index = 0
while not my_file.endOfFile():
    values[index] = my_file.readLine()
    index = index + 1
my_file.close()

target = input("Target? ")
low = 0
high = 24
found = False

while low <= high and not found:
    mid = int((low + high) / 2)
    if values[mid] == target:
        found = True
        print("Found at " + str(mid))
    else:
        if values[mid] < target:
            low = mid + 1
        else:
            high = mid - 1

if not found:
    print("Not found")`
  },
  {
    name: "Examples",
    separator: true
  },
  {
    name: "Battleship (Python)",
    code: `# Find the hidden ship on a 3x3 grid.
board = [[".", ".", "."], [".", ".", "."], [".", ".", "."]]
ship_row = 1
ship_col = 2
turn = 0
hit = False

while turn < 3 and not hit:
    row_guess = int(input("Row? "))
    col_guess = int(input("Col? "))
    if row_guess < 0 or row_guess > 2 or col_guess < 0 or col_guess > 2:
        print("Out of bounds")
    elif row_guess == ship_row and col_guess == ship_col:
        board[row_guess][col_guess] = "X"
        print("Hit!")
        hit = True
    else:
        board[row_guess][col_guess] = "o"
        print("Miss")
    turn = turn + 1

if hit:
    print("You found the ship.")
else:
    print("Game over.")

for row in range(0, 3):
    line = ""
    for col in range(0, 3):
        line = line + board[row][col]
    print(line)`
  }
];

const EXAMPLES = [
  ...normalizeExamples(OCR_EXAMPLES, "ocr"),
  { name: "Python", separator: true, language: "python" },
  ...normalizeExamples(PYTHON_EXAMPLES, "python")
];

function normalizeExamples(examples, language) {
  return examples.map((example) => ({
    ...example,
    language,
    exampleKey: toExampleKey(example.name, language)
  }));
}

function toExampleKey(name, language) {
  const raw = String(name || "");
  if (language === "python") {
    return raw.replace(/\s+\(Python\)$/, "");
  }
  return raw;
}

function inferPythonArrayDimensions(source) {
  const text = String(source || "").trim();
  if (!text.startsWith("[") || !text.endsWith("]")) {
    return [];
  }
  try {
    const parsed = JSON.parse(text.replace(/'/g, '"').replace(/\bNone\b/g, "null"));
    if (!Array.isArray(parsed)) {
      return [];
    }
    if (!parsed.length || !Array.isArray(parsed[0])) {
      return [parsed.length];
    }
    return [parsed.length, Array.isArray(parsed[0]) ? parsed[0].length : 0];
  } catch {
    return [];
  }
}

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
      selectedLanguage: EXAMPLES[0].language || "ocr",
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
    selectedLanguage() {
      if (this.restoringState) {
        return;
      }
      this.stopProgram(true);
      this.showJs = false;
      this.syncExampleToLanguage();
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
        this.selectedLanguage = example.language || "ocr";
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
        compiled = sharedTranslateProgram(this.editorText, { language: this.selectedLanguage });
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
    syncExampleToLanguage() {
      const current = this.examples[this.selectedExample];
      if (!current || current.separator) {
        return;
      }
      if ((current.language || "ocr") === this.selectedLanguage) {
        return;
      }
      const targetIndex = this.examples.findIndex((example) =>
        !example.separator
        && example.exampleKey === current.exampleKey
        && (example.language || "ocr") === this.selectedLanguage
      );
      if (targetIndex >= 0) {
        this.selectedExample = targetIndex;
      }
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
        const match = line.match(/(?:\/\/|#)\s*#(expand_arrays|compress_rows)\s*:\s*(true|false)\b/i);
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
      const code = sourceLine.replace(/\/\/.*$/, "").replace(/#.*$/, "").trim();
      return /^(ENDWHILE|NEXT|UNTIL)\b/i.test(code)
        || /^ARRAY\s+[A-Za-z][A-Za-z0-9_]*\s*\[[^\]]+\]\s*=/i.test(code)
        || /^(while|for)\b.+:\s*$/i.test(code)
        || /^[A-Za-z_][A-Za-z0-9_]*\s*=\s*\[/.test(code);
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
        const code = line.replace(/\/\/.*$/, "").replace(/#.*$/, "").trim();
        const match = code.match(/^ARRAY\s+([A-Za-z][A-Za-z0-9_]*)\s*\[([^\]]+)\]/i);
        if (!match) {
          const pythonMatch = code.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(\[[\s\S]*\])$/);
          if (!pythonMatch) {
            continue;
          }
          const dimensions = inferPythonArrayDimensions(pythonMatch[2]);
          if (!dimensions.length) {
            continue;
          }
          declarations.push({
            name: pythonMatch[1],
            dimensions
          });
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
        selectedLanguage: this.selectedLanguage,
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
          const byName = this.examples.findIndex((example) =>
            example.name === state.selectedExampleName
            && (!state.selectedLanguage || (example.language || "ocr") === state.selectedLanguage)
          );
          if (byName >= 0) {
            this.selectedExample = this.resolveSelectableExampleIndex(byName);
          }
        } else if (Number.isInteger(state.selectedExample)) {
          this.selectedExample = this.resolveSelectableExampleIndex(state.selectedExample);
        }
        if (typeof state.selectedLanguage === "string") {
          this.selectedLanguage = state.selectedLanguage === "python" ? "python" : "ocr";
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
        __pythonFile: true,
        async readLine() {
          return index < source.length ? source[index++] : "";
        },
        async readLines() {
          const rest = source.slice(index);
          index = source.length;
          return rest;
        },
        async endOfFile() {
          return index >= source.length;
        },
        async write() {},
        async writeLines() {},
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
        __pythonFile: true,
        async writeLine(value) {
          buffer.push(toText(value));
          syncFiles();
        },
        async write(value) {
          const text = toText(value);
          const parts = text.split(/\\r?\\n/);
          if (!parts.length) {
            return;
          }
          if (!buffer.length) {
            buffer.push(parts.shift());
          } else {
            buffer[buffer.length - 1] += parts.shift();
          }
          for (const part of parts) {
            buffer.push(part);
          }
          syncFiles();
        },
        async writeLines(values) {
          for (const value of Array.isArray(values) ? values : []) {
            await this.write(value);
          }
          syncFiles();
        },
        async readLine() {
          return "";
        },
        async readLines() {
          return [];
        },
        async endOfFile() {
          return true;
        },
        async close() {
          syncFiles();
        }
      };
    }

    function makeAppendWriter(path) {
      const buffer = fs.get(path) ? [...fs.get(path)] : [];
      fs.set(path, buffer);
      syncFiles();
      return {
        __traceHidden: true,
        __traceLabel: "[File]",
        __pythonFile: true,
        async writeLine(value) {
          buffer.push(toText(value));
          syncFiles();
        },
        async write(value) {
          const text = toText(value);
          const parts = text.split(/\\r?\\n/);
          if (!parts.length) {
            return;
          }
          if (!buffer.length) {
            buffer.push(parts.shift());
          } else {
            buffer[buffer.length - 1] += parts.shift();
          }
          for (const part of parts) {
            buffer.push(part);
          }
          syncFiles();
        },
        async writeLines(values) {
          for (const value of Array.isArray(values) ? values : []) {
            await this.write(value);
          }
          syncFiles();
        },
        async readLine() {
          return "";
        },
        async readLines() {
          return [];
        },
        async endOfFile() {
          return true;
        },
        async close() {
          syncFiles();
        }
      };
    }

    function pyReplace(text, oldValue, newValue, count) {
      let result = toText(text);
      const oldText = toText(oldValue);
      const replacement = toText(newValue);
      if (oldText === "") {
        return result;
      }
      if (count == null) {
        return result.split(oldText).join(replacement);
      }
      let remaining = Number(count);
      while (remaining > 0) {
        const found = result.indexOf(oldText);
        if (found < 0) {
          break;
        }
        result = result.slice(0, found) + replacement + result.slice(found + oldText.length);
        remaining -= 1;
      }
      return result;
    }

    function pyMul(left, right) {
      if (typeof left === "string" && Number.isInteger(Number(right))) {
        return left.repeat(Math.max(0, Number(right)));
      }
      if (typeof right === "string" && Number.isInteger(Number(left))) {
        return right.repeat(Math.max(0, Number(left)));
      }
      return Number(left) * Number(right);
    }

    function pyFind(text, needle, start, end) {
      const source = toText(text);
      const from = start == null ? 0 : Number(start);
      const to = end == null ? source.length : Number(end);
      const idx = source.slice(from, to).indexOf(toText(needle));
      return idx < 0 ? -1 : from + idx;
    }

    function pyIndex(text, needle, start, end) {
      const idx = pyFind(text, needle, start, end);
      if (idx < 0) {
        throw new Error("substring not found");
      }
      return idx;
    }

    function pyRound(value, digits) {
      const number = Number(value);
      if (digits == null) {
        return Math.round(number);
      }
      const precision = Number(digits);
      const factor = 10 ** precision;
      return Math.round(number * factor) / factor;
    }

    function pyStrip(text, chars) {
      const source = toText(text);
      if (chars == null) {
        return source.trim();
      }
      const charset = new Set(Array.from(toText(chars)));
      let start = 0;
      let end = source.length;
      while (start < end && charset.has(source[start])) {
        start += 1;
      }
      while (end > start && charset.has(source[end - 1])) {
        end -= 1;
      }
      return source.slice(start, end);
    }

    function pyFormat(template, values) {
      let autoIndex = 0;
      return toText(template).replace(/\\{(\\d*)(?::([^}]+))?\\}/g, (_, rawIndex, rawSpec) => {
        const index = rawIndex === "" ? autoIndex++ : Number(rawIndex);
        const value = index >= 0 && index < values.length ? values[index] : "";
        return applyPyFormatSpec(value, rawSpec || "");
      });
    }

    function applyPyFormatSpec(value, spec) {
      const match = toText(spec).match(/^([<>=^])?([+\\- ])?(\\d+)?(?:\\.(\\d+))?([sdf])?$/);
      if (!match) {
        return toText(value);
      }
      const [, alignRaw, signRaw, widthRaw, precisionRaw, typeRaw] = match;
      const align = alignRaw || null;
      const sign = signRaw || "-";
      const width = widthRaw ? Number(widthRaw) : 0;
      const precision = precisionRaw != null ? Number(precisionRaw) : null;
      const type = typeRaw || null;
      let text;

      if (type === "d") {
        const number = Number(value);
        text = String(Math.trunc(number));
        if (number >= 0 && sign === "+") {
          text = "+" + text;
        } else if (number >= 0 && sign === " ") {
          text = " " + text;
        }
      } else if (type === "f") {
        const number = Number(value);
        const digits = precision == null ? 6 : precision;
        text = number.toFixed(digits);
        if (number >= 0 && sign === "+") {
          text = "+" + text;
        } else if (number >= 0 && sign === " ") {
          text = " " + text;
        }
      } else {
        text = toText(value);
      }

      if (width <= text.length) {
        return text;
      }
      const padding = " ".repeat(width - text.length);
      const alignment = align || (type === "d" || type === "f" ? ">" : "<");
      if (alignment === "<") {
        return text + padding;
      }
      if (alignment === "^") {
        const left = Math.floor(padding.length / 2);
        const right = padding.length - left;
        return " ".repeat(left) + text + " ".repeat(right);
      }
      return padding + text;
    }

    async function toIterableArray(value) {
      if (value && value.__pythonFile && typeof value.readLines === "function") {
        return await value.readLines();
      }
      if (Array.isArray(value)) {
        return [...value];
      }
      if (typeof value === "string") {
        return Array.from(value);
      }
      return Array.from(value || []);
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
      open: async (path, mode) => {
        const filename = toText(path);
        const normalizedMode = toText(mode).replace(/^["']|["']$/g, "");
        if (normalizedMode === "r") {
          if (!fs.has(filename)) {
            fs.set(filename, []);
            syncFiles();
          }
          return makeReader(filename);
        }
        if (normalizedMode === "a") {
          return makeAppendWriter(filename);
        }
        return makeWriter(filename);
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
      toIterableArray: async (value) => await toIterableArray(value),
      pyAppend: (target, value) => {
        target.push(value);
      },
      pyInsert: (target, index, value) => {
        target.splice(Number(index), 0, value);
      },
      pyMul: (left, right) => pyMul(left, right),
      pyFind: (text, needle, start, end) => pyFind(text, needle, start, end),
      pyIndex: (text, needle, start, end) => pyIndex(text, needle, start, end),
      pyIsAlpha: (text) => /^[A-Za-z]+$/.test(toText(text)),
      pyIsAlnum: (text) => /^[A-Za-z0-9]+$/.test(toText(text)),
      pyIsDigit: (text) => /^\\d+$/.test(toText(text)),
      pyIsUpper: (text) => /[A-Z]/.test(toText(text)) && toText(text) === toText(text).toUpperCase(),
      pyIsLower: (text) => /[a-z]/.test(toText(text)) && toText(text) === toText(text).toLowerCase(),
      pyRound: (value, digits) => pyRound(value, digits),
      pyReplace: (text, oldValue, newValue, count) => pyReplace(text, oldValue, newValue, count),
      pyStrip: (text, chars) => pyStrip(text, chars),
      pyFormat: (template, values) => pyFormat(template, values),
      random: () => Math.random(),
      randomInt: (min, max) => {
        const lower = Math.ceil(Number(min));
        const upper = Math.floor(Number(max));
        if (!Number.isFinite(lower) || !Number.isFinite(upper) || upper < lower) {
          return lower;
        }
        return Math.floor(Math.random() * (upper - lower + 1)) + lower;
      },
      sleep: async (seconds) => {
        const delay = Math.max(0, Number(seconds) || 0) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
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

    function parseGeneratedLine(error) {
      const stack = error && error.stack ? String(error.stack) : "";
      const sourceMatch = stack.match(/ocr-pseudocode-translated\\.js:(\\d+):(\\d+)/i);
      if (sourceMatch) {
        return Number(sourceMatch[1]);
      }
      const genericMatch = stack.match(/<anonymous>:(\\d+):(\\d+)/i);
      if (genericMatch) {
        return Number(genericMatch[1]);
      }
      if (error && Number.isFinite(Number(error.lineNumber))) {
        return Number(error.lineNumber);
      }
      return null;
    }

    function mapGeneratedLineToPseudoLine(generatedLine, lineMap) {
      if (!generatedLine || !Array.isArray(lineMap) || !lineMap.length) {
        return null;
      }
      const candidateIndexes = [generatedLine - 2, generatedLine - 1, generatedLine - 3];
      for (const index of candidateIndexes) {
        if (index >= 0 && index < lineMap.length && lineMap[index]) {
          return lineMap[index];
        }
      }
      return null;
    }

    function reportError(error, lineMap) {
      const generatedLine = parseGeneratedLine(error);
      const mappedLine = mapGeneratedLineToPseudoLine(generatedLine, lineMap);
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


