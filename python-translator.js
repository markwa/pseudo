import {
  buildTrackVarExpression,
  formatGeneratedJs,
  instrumentDebugTrace,
  syntaxError
} from "./translator.js";

const METHOD_NAME_MAP = new Map([
  ["readline", "readLine"],
  ["readlines", "readLines"],
  ["write", "write"],
  ["writeline", "writeLine"],
  ["writelines", "writeLines"],
  ["endoffile", "endOfFile"]
]);

const BUILTIN_CALLS = new Set(["str", "int", "float", "len", "openread", "openwrite", "open", "input", "bool", "list", "chr", "ord", "round"]);

export function translatePythonProgram(source) {
  const parser = new PythonTranslator(source);
  return parser.translate();
}

class PythonTranslator {
  constructor(source) {
    this.source = String(source || "");
    this.rawLines = this.source.split(/\r?\n/);
    this.lines = this.rawLines.map((raw, index) => parseLine(raw, index + 1));
    this.classNames = new Set();
    this.topLevelNames = new Set();
    this.functionNames = new Set();
    this.classMethodNames = new Map();
    this.tempCounter = 0;
    this.imports = new Set();
  }

  translate() {
    this.collectDefinitions();
    const output = [];
    const lineMap = [];
    const ctx = {
      scopeStack: [makeScope(null)],
      classStack: []
    };
    const state = { index: 0 };
    this.translateBlock(state, 0, ctx, output, lineMap);
    const instrumented = instrumentDebugTrace(output, lineMap, this.rawLines);
    return {
      js: formatGeneratedJs(instrumented.lines).join("\n"),
      lineMap: instrumented.lineMap
    };
  }

  collectDefinitions() {
    for (const line of this.lines) {
      if (line.isBlank) {
        continue;
      }
      const classMatch = line.code.match(/^class\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\))?\s*:\s*$/);
      if (classMatch) {
        const className = classMatch[1];
        this.classNames.add(className);
        this.topLevelNames.add(className);
      }
      if (line.indent === 0) {
        const functionMatch = line.code.match(/^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
        if (functionMatch) {
          const name = functionMatch[1];
          this.functionNames.add(name);
          this.topLevelNames.add(name);
          continue;
        }
        const assignMatch = line.code.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/);
        if (assignMatch) {
          this.topLevelNames.add(assignMatch[1]);
        }
      }
    }

    for (let index = 0; index < this.lines.length; index += 1) {
      const line = this.lines[index];
      if (line.isBlank) {
        continue;
      }
      const classMatch = line.code.match(/^class\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\))?\s*:\s*$/);
      if (!classMatch) {
        continue;
      }
      const className = classMatch[1];
      const childIndent = this.findChildIndent(index, line.indent);
      if (childIndent == null) {
        throw syntaxError("Expected an indented block after class declaration", line.number);
      }
      const methodNames = new Set();
      for (let cursor = index + 1; cursor < this.lines.length; cursor += 1) {
        const child = this.lines[cursor];
        if (child.isBlank) {
          continue;
        }
        if (child.indent < childIndent) {
          break;
        }
        if (child.indent === childIndent) {
          const methodMatch = child.code.match(/^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
          if (methodMatch) {
            methodNames.add(methodMatch[1]);
          }
        }
      }
      this.classMethodNames.set(className, methodNames);
    }
  }

  translateBlock(state, indent, ctx, output, lineMap) {
    while (state.index < this.lines.length) {
      const line = this.lines[state.index];
      if (line.isBlank) {
        state.index += 1;
        continue;
      }
      if (line.indent < indent) {
        return;
      }
      if (line.indent > indent) {
        throw syntaxError("Unexpected indentation", line.number);
      }
      if (/^(elif|else)\b/.test(line.code)) {
        return;
      }
      this.translateStatement(state, ctx, output, lineMap);
    }
  }

  translateStatement(state, ctx, output, lineMap) {
    const line = this.lines[state.index];
    const scope = currentScope(ctx);

    if (/^if\b/.test(line.code)) {
      this.translateIf(state, ctx, output, lineMap);
      return;
    }

    if (/^while\b/.test(line.code)) {
      this.translateWhile(state, ctx, output, lineMap);
      return;
    }

    if (/^for\b/.test(line.code)) {
      this.translateFor(state, ctx, output, lineMap);
      return;
    }

    if (/^class\b/.test(line.code)) {
      this.translateClass(state, ctx, output, lineMap);
      return;
    }

    if (/^def\b/.test(line.code)) {
      this.translateFunction(state, ctx, output, lineMap, false);
      return;
    }

    if (/^import\b/.test(line.code)) {
      this.translateImport(state);
      return;
    }

    if (/^global\b/.test(line.code)) {
      const globalMatch = line.code.match(/^global\s+(.+)$/);
      if (!globalMatch) {
        throw syntaxError("Invalid global declaration", line.number);
      }
      splitTopLevel(globalMatch[1], ",").forEach((name) => {
        const trimmed = name.trim();
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
          throw syntaxError("Invalid global declaration", line.number);
        }
        scope.globals.add(trimmed);
      });
      state.index += 1;
      return;
    }

    if (/^return\b/.test(line.code)) {
      if (ctx.scopeStack.length <= 1) {
        throw syntaxError("return is not valid outside a function", line.number);
      }
      const returnMatch = line.code.match(/^return\b\s*(.*)$/);
      const expr = returnMatch ? returnMatch[1].trim() : "";
      emit(output, lineMap, line.number, expr ? `return ${this.emitExpression(expr, ctx, { lineNumber: line.number })};` : "return;");
      state.index += 1;
      return;
    }

    if (/^pass$/.test(line.code)) {
      emit(output, lineMap, line.number, ";");
      state.index += 1;
      return;
    }

    if (/^print\s*\(/.test(line.code)) {
      const args = parseCallArguments(extractCallInner(line.code, line.number), line.number).map((arg) =>
        this.emitExpression(arg, ctx, { lineNumber: line.number })
      );
      emit(output, lineMap, line.number, `await __runtime.print(${args[0] || '""'});`);
      state.index += 1;
      return;
    }

    if (/^del\b/.test(line.code)) {
      this.translateDelete(state, ctx, output, lineMap);
      return;
    }

    if (/^[A-Za-z_][A-Za-z0-9_]*(?:\s*\[[^\]]+\]|\.[A-Za-z_][A-Za-z0-9_]*)*\s*(\+=|-=|\*=|\/=|\/\/=|%=)\s*/.test(line.code)) {
      this.translateAugmentedAssignment(state, ctx, output, lineMap);
      return;
    }

    if (line.code.includes("=") && !/[=!<>]=/.test(line.code.split("=")[0] + "=")) {
      this.translateAssignment(state, ctx, output, lineMap);
      return;
    }

    emit(output, lineMap, line.number, `${this.emitExpression(line.code, ctx, { lineNumber: line.number })};`);
    state.index += 1;
  }

  translateIf(state, ctx, output, lineMap) {
    const line = this.lines[state.index];
    const match = line.code.match(/^if\s+(.+)\s*:\s*$/);
    if (!match) {
      throw syntaxError("Invalid if statement", line.number);
    }
    emit(output, lineMap, line.number, `if (${this.emitExpression(match[1], ctx, { lineNumber: line.number })}) {`);
    state.index += 1;
    const childIndent = this.requireChildIndent(state.index - 1, line.indent, "if", line.number);
    this.translateNestedBlock(state, childIndent, ctx, output, lineMap);
    let closed = false;

    while (state.index < this.lines.length) {
      const next = this.lines[state.index];
      if (next.isBlank) {
        state.index += 1;
        continue;
      }
      if (next.indent !== line.indent) {
        break;
      }
      const elifMatch = next.code.match(/^elif\s+(.+)\s*:\s*$/);
      if (elifMatch) {
        emit(output, lineMap, next.number, `} else if (${this.emitExpression(elifMatch[1], ctx, { lineNumber: next.number })}) {`);
        state.index += 1;
        const elifIndent = this.requireChildIndent(state.index - 1, next.indent, "elif", next.number);
        this.translateNestedBlock(state, elifIndent, ctx, output, lineMap);
        continue;
      }
      if (/^else\s*:\s*$/.test(next.code)) {
        emit(output, lineMap, next.number, "} else {");
        state.index += 1;
        const elseIndent = this.requireChildIndent(state.index - 1, next.indent, "else", next.number);
        this.translateNestedBlock(state, elseIndent, ctx, output, lineMap);
        closed = true;
      }
      break;
    }
    emit(output, lineMap, line.number, "}");
    if (closed) {
      return;
    }
  }

  translateWhile(state, ctx, output, lineMap) {
    const line = this.lines[state.index];
    const match = line.code.match(/^while\s+(.+)\s*:\s*$/);
    if (!match) {
      throw syntaxError("Invalid while loop", line.number);
    }
    emit(output, lineMap, line.number, `while (${this.emitExpression(match[1], ctx, { lineNumber: line.number })}) {`);
    state.index += 1;
    const childIndent = this.requireChildIndent(state.index - 1, line.indent, "while", line.number);
    this.translateNestedBlock(state, childIndent, ctx, output, lineMap);
    emit(output, lineMap, line.number, "}");
  }

  translateFor(state, ctx, output, lineMap) {
    const line = this.lines[state.index];
    const rangeMatch = line.code.match(/^for\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s+range\s*\((.*)\)\s*:\s*$/);
    const iterableMatch = line.code.match(/^for\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s+(.+)\s*:\s*$/);
    if (rangeMatch) {
      this.translateRangeFor(state, ctx, output, lineMap, rangeMatch);
      return;
    }
    if (!iterableMatch) {
      throw syntaxError("Invalid for loop", line.number);
    }
    const [, variable, iterableSource] = iterableMatch;
    const isGlobal = scopeHasGlobal(ctx, variable);
    const needsDeclaration = !isGlobal && !currentScope(ctx).declared.has(variable);
    declareVariable(variable, ctx, { lineNumber: line.number, asGlobal: isGlobal });
    const iterableCode = this.emitExpression(iterableSource, ctx, { lineNumber: line.number });
    const tempId = this.nextTemp("iter");
    const sequenceVar = `__pySeq_${tempId}`;
    const indexVar = `__pyIdx_${tempId}`;
    const variableRef = variableReference(variable, ctx);

    emit(output, lineMap, line.number, `var ${sequenceVar} = await __runtime.toIterableArray(${iterableCode});`);
    emit(output, lineMap, line.number, `for (var ${indexVar} = 0; ${indexVar} < ${sequenceVar}.length; ${indexVar} += 1) {`);
    emit(output, lineMap, line.number, `${needsDeclaration ? "var " : ""}${variableRef} = ${sequenceVar}[${indexVar}]; ${buildTrackVarExpression(variable, variableRef)};`);
    state.index += 1;
    const childIndent = this.requireChildIndent(state.index - 1, line.indent, "for", line.number);
    this.translateNestedBlock(state, childIndent, ctx, output, lineMap);
    emit(output, lineMap, line.number, "}");
  }

  translateRangeFor(state, ctx, output, lineMap, match) {
    const line = this.lines[state.index];
    const variable = match[1];
    const rangeArgs = splitTopLevel(match[2], ",").map((arg) => arg.trim()).filter(Boolean);
    let startExpr;
    let endExpr;
    let stepExpr;
    if (rangeArgs.length === 1) {
      startExpr = "0";
      endExpr = rangeArgs[0];
      stepExpr = "1";
    } else if (rangeArgs.length === 2) {
      startExpr = rangeArgs[0];
      endExpr = rangeArgs[1];
      stepExpr = "1";
    } else if (rangeArgs.length === 3) {
      startExpr = rangeArgs[0];
      endExpr = rangeArgs[1];
      stepExpr = rangeArgs[2];
    } else {
      throw syntaxError("Invalid range() call", line.number);
    }

    const isGlobal = scopeHasGlobal(ctx, variable);
    const needsDeclaration = !isGlobal && !currentScope(ctx).declared.has(variable);
    declareVariable(variable, ctx, { lineNumber: line.number, asGlobal: isGlobal });
    const startCode = this.emitExpression(startExpr, ctx, { lineNumber: line.number });
    const endCode = this.emitExpression(endExpr, ctx, { lineNumber: line.number });
    const stepCode = this.emitExpression(stepExpr, ctx, { lineNumber: line.number });
    const variableRef = variableReference(variable, ctx);
    const stepVar = `__pyStep_${this.nextTemp("step")}`;

    emit(output, lineMap, line.number, `var ${stepVar} = ${stepCode};`);
    emit(output, lineMap, line.number, `${needsDeclaration ? "var " : ""}${variableRef} = ${startCode}; ${buildTrackVarExpression(variable, variableRef)};`);
    emit(
      output,
      lineMap,
      line.number,
      `for (; (${stepVar} >= 0 ? ${variableRef} < ${endCode} : ${variableRef} > ${endCode}); ${variableRef} += ${stepVar}, ${buildTrackVarExpression(variable, variableRef)}) {`
    );
    state.index += 1;
    const childIndent = this.requireChildIndent(state.index - 1, line.indent, "for", line.number);
    this.translateNestedBlock(state, childIndent, ctx, output, lineMap);
    emit(output, lineMap, line.number, "}");
  }

  translateClass(state, ctx, output, lineMap) {
    const line = this.lines[state.index];
    const match = line.code.match(/^class\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\))?\s*:\s*$/);
    if (!match) {
      throw syntaxError("Invalid class declaration", line.number);
    }
    const [, className, baseName] = match;
    emit(output, lineMap, line.number, `class ${className}${baseName ? ` extends ${baseName}` : ""} {`);
    const childIndent = this.requireChildIndent(state.index, line.indent, "class", line.number);
    state.index += 1;
    const classCtx = {
      name: className,
      methods: this.classMethodNames.get(className) || new Set(),
      fields: this.collectClassFields(state.index, childIndent)
    };
    ctx.classStack.push(classCtx);
    while (state.index < this.lines.length) {
      const child = this.lines[state.index];
      if (child.isBlank) {
        state.index += 1;
        continue;
      }
      if (child.indent < childIndent) {
        break;
      }
      if (child.indent > childIndent) {
        throw syntaxError("Unexpected indentation", child.number);
      }
      if (!/^def\b/.test(child.code)) {
        throw syntaxError("Only methods are allowed directly inside a class", child.number);
      }
      this.translateFunction(state, ctx, output, lineMap, true);
    }
    ctx.classStack.pop();
    emit(output, lineMap, line.number, "}");
  }

  collectClassFields(startIndex, indent) {
    const fields = new Set();
    for (let index = startIndex; index < this.lines.length; index += 1) {
      const line = this.lines[index];
      if (line.isBlank) {
        continue;
      }
      if (line.indent < indent) {
        break;
      }
      const fieldMatch = line.code.match(/^self\.([A-Za-z_][A-Za-z0-9_]*)\s*=/);
      if (fieldMatch) {
        fields.add(fieldMatch[1]);
      }
    }
    return fields;
  }

  translateFunction(state, ctx, output, lineMap, inClass) {
    const line = this.lines[state.index];
    const match = line.code.match(/^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*:\s*$/);
    if (!match) {
      throw syntaxError("Invalid function declaration", line.number);
    }
    const [, name, rawParams] = match;
    const params = splitTopLevel(rawParams, ",").map((part) => part.trim()).filter(Boolean);
    const childIndent = this.requireChildIndent(state.index, line.indent, "function", line.number);
    state.index += 1;

    const functionScope = makeScope(currentScope(ctx));
    ctx.scopeStack.push(functionScope);

    let jsHeader;
    let effectiveParams = params;
    if (inClass) {
      effectiveParams = params.filter((param) => param !== "self");
      const classCtx = currentClass(ctx);
      if (name === "__init__") {
        jsHeader = `constructor(${effectiveParams.join(", ")}) {`;
      } else {
        jsHeader = `async ${name}(${effectiveParams.join(", ")}) {`;
      }
    } else {
      jsHeader = `async function ${name}(${effectiveParams.join(", ")}) {`;
    }
    emit(output, lineMap, line.number, jsHeader);
    effectiveParams.forEach((param) => {
      declareVariable(param, ctx, { forceLocal: true });
      emit(output, lineMap, line.number, `${buildTrackVarExpression(param)};`);
    });
    this.translateNestedBlock(state, childIndent, ctx, output, lineMap);
    emit(output, lineMap, line.number, "}");
    ctx.scopeStack.pop();
  }

  translateNestedBlock(state, indent, ctx, output, lineMap) {
    if (indent == null) {
      return;
    }
    this.translateBlock(state, indent, ctx, output, lineMap);
  }

  translateAssignment(state, ctx, output, lineMap) {
    const line = this.lines[state.index];
    const [targetSource, exprSource] = splitAssignment(line.code, line.number);
    const target = targetSource.trim();
    const expression = this.emitExpression(exprSource.trim(), ctx, { lineNumber: line.number });

    const selfFieldMatch = target.match(/^self\.([A-Za-z_][A-Za-z0-9_]*)$/);
    if (selfFieldMatch) {
      emit(output, lineMap, line.number, `this.${selfFieldMatch[1]} = ${expression};`);
      state.index += 1;
      return;
    }

    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(target)) {
      const isGlobal = scopeHasGlobal(ctx, target);
      const needsDeclaration = !isGlobal && !currentScope(ctx).declared.has(target);
      declareVariable(target, ctx, { lineNumber: line.number, asGlobal: isGlobal });
      const reference = variableReference(target, ctx);
      emit(
        output,
        lineMap,
        line.number,
        `${needsDeclaration ? "var " : ""}${reference} = ${expression}; ${buildTrackVarExpression(target, reference)};`
      );
      state.index += 1;
      return;
    }

    const targetExpr = this.emitExpression(target, ctx, { allowConstructorCalls: false, lineNumber: line.number });
    emit(output, lineMap, line.number, `${targetExpr} = ${expression};`);
    state.index += 1;
  }

  translateDelete(state, ctx, output, lineMap) {
    const line = this.lines[state.index];
    const match = line.code.match(/^del\s+(.+)\[(.+)\]\s*$/);
    if (!match) {
      throw syntaxError("Invalid del statement", line.number);
    }
    const targetExpr = this.emitExpression(match[1].trim(), ctx, { allowConstructorCalls: false, lineNumber: line.number });
    const indexExpr = this.emitExpression(match[2].trim(), ctx, { lineNumber: line.number });
    emit(output, lineMap, line.number, `${targetExpr}.splice(${indexExpr}, 1);`);
    state.index += 1;
  }

  translateAugmentedAssignment(state, ctx, output, lineMap) {
    const line = this.lines[state.index];
    const match = line.code.match(/^(.+?)\s*(\+=|-=|\*=|\/=|\/\/=|%=)\s*(.+)$/);
    if (!match) {
      throw syntaxError("Invalid augmented assignment", line.number);
    }
    const [, targetSource, operator, exprSource] = match;
    const target = targetSource.trim();
    const rhs = this.emitExpression(exprSource.trim(), ctx, { lineNumber: line.number });
    const targetExpr = this.emitExpression(target, ctx, { allowConstructorCalls: false, lineNumber: line.number });

    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(target)) {
      const isGlobal = scopeHasGlobal(ctx, target);
      const needsDeclaration = !isGlobal && !currentScope(ctx).declared.has(target);
      declareVariable(target, ctx, { lineNumber: line.number, asGlobal: isGlobal });
      const reference = variableReference(target, ctx);
      const updated = buildAugmentedExpression(reference, operator, rhs);
      emit(output, lineMap, line.number, `${needsDeclaration ? "var " : ""}${reference} = ${updated}; ${buildTrackVarExpression(target, reference)};`);
      state.index += 1;
      return;
    }

    emit(output, lineMap, line.number, `${targetExpr} = ${buildAugmentedExpression(targetExpr, operator, rhs)};`);
    state.index += 1;
  }

  translateImport(state) {
    const line = this.lines[state.index];
    const match = line.code.match(/^import\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/);
    if (!match) {
      throw syntaxError("Invalid import statement", line.number);
    }
    const library = match[1];
    if (!["math", "random", "time"].includes(library)) {
      throw syntaxError(`Library import is not supported: ${library}`, line.number);
    }
    this.imports.add(library);
    state.index += 1;
  }

  emitExpression(source, ctx, options = {}) {
    const tokens = tokenizeExpression(source, options.lineNumber);
    const parser = new ExpressionParser(tokens, this, ctx, options);
    const emitted = parser.parseExpression();
    if (!parser.isAtEnd()) {
      const token = parser.peek();
      throw syntaxError("Invalid expression", token ? token.line : options.lineNumber || 1);
    }
    return emitted;
  }

  findChildIndent(index, parentIndent) {
    for (let cursor = index + 1; cursor < this.lines.length; cursor += 1) {
      const line = this.lines[cursor];
      if (line.isBlank) {
        continue;
      }
      if (line.indent <= parentIndent) {
        return null;
      }
      return line.indent;
    }
    return null;
  }

  requireChildIndent(index, parentIndent, label, lineNumber) {
    const childIndent = this.findChildIndent(index, parentIndent);
    if (childIndent == null) {
      throw syntaxError(`Expected an indented block after ${label} statement`, lineNumber);
    }
    return childIndent;
  }

  nextTemp(prefix) {
    this.tempCounter += 1;
    return `${prefix}${this.tempCounter}`;
  }
}

class ExpressionParser {
  constructor(tokens, translator, ctx, options = {}) {
    this.tokens = tokens;
    this.translator = translator;
    this.ctx = ctx;
    this.options = options;
    this.index = 0;
  }

  isAtEnd() {
    return this.index >= this.tokens.length;
  }

  peek(offset = 0) {
    return this.tokens[this.index + offset] || null;
  }

  consume() {
    return this.tokens[this.index++] || null;
  }

  match(type, value = null) {
    const token = this.peek();
    if (!token || token.type !== type) {
      return false;
    }
    if (value != null && token.value !== value) {
      return false;
    }
    this.index += 1;
    return true;
  }

  parseExpression(stopValues = new Set()) {
    return this.parseOr(stopValues);
  }

  atStop(stopValues) {
    const token = this.peek();
    return !!(token && token.type === "punct" && stopValues.has(token.value));
  }

  parseOr(stopValues) {
    let expr = this.parseAnd(stopValues);
    while (!this.isAtEnd() && !this.atStop(stopValues) && this.match("keyword", "or")) {
      expr = `(${expr} || ${this.parseAnd(stopValues)})`;
    }
    return expr;
  }

  parseAnd(stopValues) {
    let expr = this.parseComparison(stopValues);
    while (!this.isAtEnd() && !this.atStop(stopValues) && this.match("keyword", "and")) {
      expr = `(${expr} && ${this.parseComparison(stopValues)})`;
    }
    return expr;
  }

  parseComparison(stopValues) {
    let expr = this.parseAdditive(stopValues);
    while (!this.isAtEnd() && !this.atStop(stopValues)) {
      const token = this.peek();
      if (!token || token.type !== "operator" || !["==", "!=", "<", "<=", ">", ">="].includes(token.value)) {
        break;
      }
      this.consume();
      expr = `(${expr} ${token.value} ${this.parseAdditive(stopValues)})`;
    }
    return expr;
  }

  parseAdditive(stopValues) {
    let expr = this.parseMultiplicative(stopValues);
    while (!this.isAtEnd() && !this.atStop(stopValues)) {
      const token = this.peek();
      if (!token || token.type !== "operator" || !["+", "-"].includes(token.value)) {
        break;
      }
      this.consume();
      expr = `(${expr} ${token.value} ${this.parseMultiplicative(stopValues)})`;
    }
    return expr;
  }

  parseMultiplicative(stopValues) {
    let expr = this.parseUnary(stopValues);
    while (!this.isAtEnd() && !this.atStop(stopValues)) {
      const token = this.peek();
      if (!token || token.type !== "operator" || !["*", "/", "//", "%"].includes(token.value)) {
        break;
      }
      this.consume();
      const right = this.parseUnary(stopValues);
      if (token.value === "*") {
        expr = `__runtime.pyMul(${expr}, ${right})`;
      } else if (token.value === "//") {
        expr = `Math.trunc(${expr} / ${right})`;
      } else {
        expr = `(${expr} ${token.value} ${right})`;
      }
    }
    return expr;
  }

  parseUnary(stopValues) {
    if (this.atStop(stopValues)) {
      throw syntaxError("Invalid expression", this.options.lineNumber || 1);
    }
    if (this.match("keyword", "not")) {
      return `(!${this.parseUnary(stopValues)})`;
    }
    if (this.match("operator", "-")) {
      return `(-${this.parseUnary(stopValues)})`;
    }
    return this.parsePower(stopValues);
  }

  parsePower(stopValues) {
    let expr = this.parseAtom();
    while (!this.isAtEnd() && !this.atStop(stopValues) && this.match("operator", "**")) {
      expr = `(${expr} ** ${this.parseUnary(stopValues)})`;
    }
    return expr;
  }

  parseAtom() {
    const token = this.consume();
    if (!token) {
      throw syntaxError("Invalid expression", 1);
    }

    if (token.type === "number") {
      return this.parsePostfix(token.value, null);
    }

    if (token.type === "string") {
      return this.parsePostfix(token.value, null);
    }

    if (token.type === "identifier" || token.type === "keyword") {
      let expr = this.emitIdentifier(token.value);
      return this.parsePostfix(expr, token.value);
    }

    if (token.type === "punct" && token.value === "(") {
      const inner = this.parseExpression(new Set([")"]));
      if (!this.match("punct", ")")) {
        throw syntaxError("Missing closing parenthesis", token.line);
      }
      return this.parsePostfix(`(${inner})`, null);
    }

    if (token.type === "punct" && token.value === "[") {
      const items = [];
      if (!this.match("punct", "]")) {
        while (true) {
          items.push(this.parseExpression(new Set([",", "]"])));
          if (this.match("punct", "]")) {
            break;
          }
          if (!this.match("punct", ",")) {
            throw syntaxError("Invalid list literal", token.line);
          }
        }
      }
      return this.parsePostfix(`[${items.join(", ")}]`, null);
    }
    throw syntaxError("Invalid expression", token.line);
  }

  parsePostfix(baseExpr, baseName) {
    let expr = baseExpr;
    let nameHint = baseName;
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (token.type === "punct" && token.value === "(") {
        this.consume();
        const args = [];
        if (!this.match("punct", ")")) {
          while (true) {
            args.push(this.parseExpression(new Set([",", ")"])));
            if (this.match("punct", ")")) {
              break;
            }
            if (!this.match("punct", ",")) {
              throw syntaxError("Invalid call expression", token.line);
            }
          }
        }
        expr = this.emitCall(expr, nameHint, args);
        nameHint = null;
        continue;
      }
      if (token.type === "punct" && token.value === "[") {
        this.consume();
        const segments = [];
        let sawColon = false;
        if (!this.match("punct", "]")) {
          while (true) {
            if (this.peek() && this.peek().type === "punct" && this.peek().value === ":") {
              sawColon = true;
              segments.push("");
            } else {
              segments.push(this.parseExpression(new Set([",", "]", ":"])));
            }
            if (this.match("punct", "]")) {
              break;
            }
            if (this.match("punct", ":")) {
              sawColon = true;
              continue;
            }
            if (this.match("punct", ",")) {
              continue;
            }
            throw syntaxError("Invalid index expression", token.line);
          }
        }
        if (sawColon) {
          const start = segments[0] || "0";
          const end = segments[1] || `${expr}.length`;
          expr = `${expr}.slice(${start}, ${end})`;
        } else {
          expr = segments.some((segment) => /^(\(\s*)?-\s*\d+(\s*\))?$/.test(String(segment).trim()))
            ? `${expr}.at(${segments.join(").at(")})`
            : `${expr}[${segments.join("][")}]`;
        }
        nameHint = null;
        continue;
      }
      if (token.type === "punct" && token.value === ".") {
        this.consume();
        const property = this.consume();
        if (!property || property.type !== "identifier") {
          throw syntaxError("Invalid attribute access", token.line);
        }
        const propertyName = property.value;
        if (expr === "self") {
          expr = `this.${propertyName}`;
        } else if (expr === "super") {
          expr = `super.${propertyName}`;
        } else {
          expr = `${expr}.${mapMemberName(propertyName)}`;
        }
        nameHint = propertyName;
        continue;
      }
      break;
    }
    return expr;
  }

  emitIdentifier(name) {
    if (name === "True") {
      return "true";
    }
    if (name === "False") {
      return "false";
    }
    if (name === "None") {
      return "null";
    }
    if (name === "self") {
      return "self";
    }
    if (name === "super") {
      return "super";
    }
    if (name === "math") {
      if (!this.translator.imports.has("math")) {
        throw syntaxError("math is not available without import math", this.options.lineNumber || 1);
      }
      return "Math";
    }
    if (name === "random") {
      if (!this.translator.imports.has("random")) {
        throw syntaxError("random is not available without import random", this.options.lineNumber || 1);
      }
      return "__pythonRandom";
    }
    if (name === "time") {
      if (!this.translator.imports.has("time")) {
        throw syntaxError("time is not available without import time", this.options.lineNumber || 1);
      }
      return "__pythonTime";
    }
    if (scopeHasGlobal(this.ctx, name) || (!isDeclaredLocally(this.ctx, name) && this.translator.topLevelNames.has(name) && currentScope(this.ctx) !== this.ctx.scopeStack[0])) {
      return name;
    }
    return name;
  }

  emitCall(expr, nameHint, args) {
    const callName = String(nameHint || "").toLowerCase();
    const receiver = nameHint && expr.endsWith(`.${nameHint}`) ? expr.slice(0, -(nameHint.length + 1)) : null;
    if (callName === "str") {
      return `String(${args[0] || '""'})`;
    }
    if (callName === "int") {
      return `parseInt(${args[0] || "0"}, 10)`;
    }
    if (callName === "float") {
      return `parseFloat(${args[0] || "0"})`;
    }
    if (callName === "len") {
      return `(${args[0] || "[]"}).length`;
    }
    if (callName === "bool") {
      return `Boolean(${args[0] || "false"})`;
    }
    if (callName === "list") {
      return args.length ? `Array.from(${args[0]})` : "[]";
    }
    if (callName === "chr") {
      return `String.fromCharCode(${args[0] || "0"})`;
    }
    if (callName === "ord") {
      return `String(${args[0] || '""'}).charCodeAt(0)`;
    }
    if (callName === "round") {
      return `__runtime.pyRound(${args[0] || "0"}${args[1] ? `, ${args[1]}` : ""})`;
    }
    if (callName === "input") {
      return `await __runtime.input(${args[0] || '""'})`;
    }
    if (callName === "open") {
      return `await __runtime.open(${args[0] || '""'}, ${args[1] || '"r"'})`;
    }
    if (callName === "openread") {
      return `await __runtime.openRead(${args[0] || '""'})`;
    }
    if (callName === "openwrite") {
      return `await __runtime.openWrite(${args[0] || '""'})`;
    }
    if (expr === "super" && nameHint === "super" && args.length === 0) {
      return "super";
    }
    if (expr === "super.__init__") {
      return `super(${args.join(", ")})`;
    }
    if (expr.startsWith("this.")) {
      return `await ${expr}(${args.join(", ")})`;
    }
    if (expr.startsWith("super.")) {
      return `await ${expr}(${args.join(", ")})`;
    }
    if (nameHint && this.translator.classNames.has(nameHint) && this.options.allowConstructorCalls !== false) {
      return `new ${nameHint}(${args.join(", ")})`;
    }
    if (nameHint && this.translator.functionNames.has(nameHint)) {
      return `await ${nameHint}(${args.join(", ")})`;
    }
    if (receiver && callName === "append") {
      return `(__runtime.pyAppend(${receiver}, ${args[0] || "undefined"}), undefined)`;
    }
    if (receiver && callName === "insert") {
      return `(__runtime.pyInsert(${receiver}, ${args[0] || "0"}, ${args[1] || "undefined"}), undefined)`;
    }
    if (receiver && callName === "find") {
      return `__runtime.pyFind(${receiver}, ${args[0] || '""'}${args[1] ? `, ${args[1]}` : ""}${args[2] ? `, ${args[2]}` : ""})`;
    }
    if (receiver && callName === "index") {
      return `__runtime.pyIndex(${receiver}, ${args[0] || '""'}${args[1] ? `, ${args[1]}` : ""}${args[2] ? `, ${args[2]}` : ""})`;
    }
    if (receiver && callName === "isalpha") {
      return `__runtime.pyIsAlpha(${receiver})`;
    }
    if (receiver && callName === "isalnum") {
      return `__runtime.pyIsAlnum(${receiver})`;
    }
    if (receiver && callName === "isdigit") {
      return `__runtime.pyIsDigit(${receiver})`;
    }
    if (receiver && callName === "replace") {
      return `__runtime.pyReplace(${receiver}, ${args[0] || '""'}, ${args[1] || '""'}${args[2] ? `, ${args[2]}` : ""})`;
    }
    if (receiver && callName === "split") {
      return `${receiver}.split(${args[0] || '""'})`;
    }
    if (receiver && callName === "strip") {
      return `__runtime.pyStrip(${receiver}${args[0] ? `, ${args[0]}` : ""})`;
    }
    if (receiver && callName === "upper") {
      return `${receiver}.toUpperCase()`;
    }
    if (receiver && callName === "lower") {
      return `${receiver}.toLowerCase()`;
    }
    if (receiver && callName === "isupper") {
      return `__runtime.pyIsUpper(${receiver})`;
    }
    if (receiver && callName === "islower") {
      return `__runtime.pyIsLower(${receiver})`;
    }
    if (receiver && callName === "format") {
      return `__runtime.pyFormat(${receiver}, [${args.join(", ")}])`;
    }
    if (receiver === "__pythonRandom" && callName === "randint") {
      return `__runtime.randomInt(${args[0] || "0"}, ${args[1] || "0"})`;
    }
    if (receiver === "__pythonRandom" && callName === "random") {
      return "__runtime.random()";
    }
    if (receiver === "__pythonTime" && callName === "sleep") {
      return `await __runtime.sleep(${args[0] || "0"})`;
    }
    if (BUILTIN_CALLS.has(callName)) {
      return `${expr}(${args.join(", ")})`;
    }
    if (expr.includes(".")) {
      return `await ${expr}(${args.join(", ")})`;
    }
    return `${expr}(${args.join(", ")})`;
  }
}

function parseLine(raw, number) {
  const normalized = String(raw || "").replace(/\t/g, "    ");
  const indentMatch = normalized.match(/^ */);
  const indent = indentMatch ? indentMatch[0].length : 0;
  const code = stripPythonComment(normalized).trim();
  return {
    raw: normalized,
    number,
    indent,
    code,
    isBlank: !code
  };
}

function buildAugmentedExpression(targetExpr, operator, rhsExpr) {
  if (operator === "+=") {
    return `(${targetExpr} + ${rhsExpr})`;
  }
  if (operator === "-=") {
    return `(${targetExpr} - ${rhsExpr})`;
  }
  if (operator === "*=") {
    return `__runtime.pyMul(${targetExpr}, ${rhsExpr})`;
  }
  if (operator === "/=") {
    return `(${targetExpr} / ${rhsExpr})`;
  }
  if (operator === "//=") {
    return `Math.trunc(${targetExpr} / ${rhsExpr})`;
  }
  if (operator === "%=") {
    return `(${targetExpr} % ${rhsExpr})`;
  }
  return rhsExpr;
}

function stripPythonComment(line) {
  let quote = null;
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "#") {
      return line.slice(0, index);
    }
  }
  return line;
}

function splitAssignment(source, lineNumber) {
  let quote = null;
  let escaped = false;
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(" || char === "[" || char === "{") {
      depth += 1;
      continue;
    }
    if (char === ")" || char === "]" || char === "}") {
      depth -= 1;
      continue;
    }
    if (depth === 0 && char === "=" && source[index + 1] !== "=" && source[index - 1] !== "!" && source[index - 1] !== "<" && source[index - 1] !== ">") {
      return [source.slice(0, index), source.slice(index + 1)];
    }
  }
  throw syntaxError("Invalid assignment", lineNumber);
}

function tokenizeExpression(source, lineNumber = 1) {
  const tokens = [];
  const text = String(source || "");
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      let cursor = index + 1;
      let escaped = false;
      let value = "";
      while (cursor < text.length) {
        const next = text[cursor];
        if (escaped) {
          if (next === "n") {
            value += "\n";
          } else if (next === "r") {
            value += "\r";
          } else if (next === "t") {
            value += "\t";
          } else if (next === "\\" || next === '"' || next === "'") {
            value += next;
          } else {
            value += next;
          }
          escaped = false;
        } else if (next === "\\") {
          escaped = true;
        } else if (next === char) {
          break;
        } else {
          value += next;
        }
        cursor += 1;
      }
      if (cursor >= text.length || text[cursor] !== char) {
        throw syntaxError("Unterminated string literal", lineNumber);
      }
      tokens.push({ type: "string", value: JSON.stringify(value), line: lineNumber });
      index = cursor + 1;
      continue;
    }
    const twoChar = text.slice(index, index + 2);
    if (["==", "!=", "<=", ">=", "//", "**"].includes(twoChar)) {
      tokens.push({ type: "operator", value: twoChar, line: lineNumber });
      index += 2;
      continue;
    }
    if ("+-*/%<>".includes(char)) {
      tokens.push({ type: "operator", value: char, line: lineNumber });
      index += 1;
      continue;
    }
    if ("(),:.[]".includes(char)) {
      tokens.push({ type: "punct", value: char, line: lineNumber });
      index += 1;
      continue;
    }
    const numberMatch = text.slice(index).match(/^\d+(?:\.\d+)?/);
    if (numberMatch) {
      tokens.push({ type: "number", value: numberMatch[0], line: lineNumber });
      index += numberMatch[0].length;
      continue;
    }
    const identifierMatch = text.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (identifierMatch) {
      const value = identifierMatch[0];
      tokens.push({
        type: ["and", "or", "not"].includes(value) ? "keyword" : "identifier",
        value,
        line: lineNumber
      });
      index += value.length;
      continue;
    }
    throw syntaxError("Invalid expression", lineNumber);
  }
  return tokens;
}

function mapMemberName(name) {
  const normalized = String(name || "").toLowerCase();
  if (normalized === "ceil") {
    return "ceil";
  }
  if (normalized === "floor") {
    return "floor";
  }
  if (normalized === "sqrt") {
    return "sqrt";
  }
  if (normalized === "pi") {
    return "PI";
  }
  return METHOD_NAME_MAP.get(normalized) || name;
}

function extractCallInner(source, lineNumber) {
  const start = source.indexOf("(");
  const end = source.lastIndexOf(")");
  if (start < 0 || end <= start) {
    throw syntaxError("Invalid call expression", lineNumber);
  }
  return source.slice(start + 1, end);
}

function parseCallArguments(source, lineNumber) {
  const parts = splitTopLevel(source, ",").map((part) => part.trim());
  if (parts.length === 1 && !parts[0]) {
    return [];
  }
  return parts.filter((part) => part || parts.length > 1);
}

function splitTopLevel(source, separator) {
  const parts = [];
  let quote = null;
  let escaped = false;
  let depth = 0;
  let current = "";
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      current += char;
      escaped = true;
      continue;
    }
    if (quote) {
      current += char;
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      current += char;
      quote = char;
      continue;
    }
    if ("([{".includes(char)) {
      depth += 1;
      current += char;
      continue;
    }
    if (")]}".includes(char)) {
      depth -= 1;
      current += char;
      continue;
    }
    if (depth === 0 && char === separator) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts;
}

function makeScope(parent) {
  return {
    parent,
    declared: new Set(),
    globals: new Set()
  };
}

function currentScope(ctx) {
  return ctx.scopeStack[ctx.scopeStack.length - 1];
}

function currentClass(ctx) {
  return ctx.classStack[ctx.classStack.length - 1] || null;
}

function declareVariable(name, ctx, options = {}) {
  if (options.asGlobal || scopeHasGlobal(ctx, name)) {
    return;
  }
  if (options.forceLocal) {
    currentScope(ctx).declared.add(name);
    return;
  }
  currentScope(ctx).declared.add(name);
}

function scopeHasGlobal(ctx, name) {
  return currentScope(ctx).globals.has(name);
}

function isDeclaredLocally(ctx, name) {
  return currentScope(ctx).declared.has(name);
}

function variableReference(name) {
  return name;
}

function emit(output, lineMap, sourceLine, code) {
  output.push(code);
  lineMap.push(sourceLine);
}
