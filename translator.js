const KEYWORDS = new Set([
  "AND", "OR", "NOT", "MOD", "DIV",
  "TRUE", "FALSE", "NULL", "NEW", "SUPER", "THIS"
]);

export function translateProgram(source) {
  const rawLines = String(source || "").split(/\r?\n/);
  const lines = rawLines.map((line) => normalizeSource(line));
  const ctx = {
    scopeStack: [makeScope()],
    classStack: []
  };
  const result = translateStatements(lines, 0, null, ctx);
  const instrumented = instrumentDebugTrace(result.lines, result.lineMap, lines);
  return {
    js: formatGeneratedJs(instrumented.lines).join("\n"),
    lineMap: instrumented.lineMap
  };
}

function formatGeneratedJs(lines) {
  const formatted = [];
  const blockStack = [];
  let indent = 0;

  for (const rawLine of lines) {
    const line = String(rawLine || "").trim();
    if (!line) {
      formatted.push("");
      continue;
    }

    if (/^case\b/i.test(line) || /^default:$/i.test(line)) {
      const currentSwitch = findCurrentSwitch(blockStack);
      if (currentSwitch) {
        indent = currentSwitch.baseIndent + 1;
      }
    } else if (/^\}/.test(line)) {
      const closed = blockStack.pop();
      indent = closed ? closed.baseIndent : Math.max(0, indent - 1);
    }

    formatted.push(`${"  ".repeat(Math.max(0, indent))}${line}`);

    if (/^switch\b.*\{\s*$/i.test(line)) {
      blockStack.push({ type: "switch", baseIndent: indent });
      indent += 1;
      continue;
    }

    if (/^case\b/i.test(line) || /^default:$/i.test(line)) {
      const currentSwitch = findCurrentSwitch(blockStack);
      indent = currentSwitch ? currentSwitch.baseIndent + 2 : indent + 1;
      continue;
    }

    if (/\{\s*$/.test(line)) {
      blockStack.push({ type: "block", baseIndent: indent });
      indent += 1;
      continue;
    }

    if (/^\}\s*while\b/i.test(line)) {
      indent = Math.max(0, indent);
      continue;
    }
  }

  return formatted;
}

function findCurrentSwitch(blockStack) {
  for (let i = blockStack.length - 1; i >= 0; i -= 1) {
    if (blockStack[i].type === "switch") {
      return blockStack[i];
    }
  }
  return null;
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
      emit(output, lineMap, originalLineNumber, `while (${emitExpression(cond, ctx, true, classContext, originalLineNumber)}) {`);
      const inner = translateStatements(lines, i + 1, [/^endwhile\b/i], ctx);
      output.push(...inner.lines);
      lineMap.push(...inner.lineMap);
      if (!/^endwhile\b/i.test(stripComments(lines[inner.nextIndex] || "").trim())) {
        throw syntaxError("Missing endwhile", originalLineNumber);
      }
      emit(output, lineMap, inner.nextIndex + 1, `await __runtime.beforeStep(${inner.nextIndex + 1});`);
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
      emit(output, lineMap, inner.nextIndex + 1, `} while (!(${emitExpression(untilMatch[1], ctx, true, classContext, inner.nextIndex + 1)}));`);
      i = inner.nextIndex + 1;
      continue;
    }

    if (/^for\b/i.test(stripped)) {
      const match = stripped.match(/^for\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s+to\s+(.+)$/i);
      if (!match) {
        throw syntaxError("Invalid for loop", originalLineNumber);
      }
      const [, variable, startExpr, endExpr] = match;
      const startCode = emitExpression(startExpr, ctx, true, classContext, originalLineNumber);
      const endCode = emitExpression(endExpr, ctx, true, classContext, originalLineNumber);
      const startNum = parseFloat(startExpr.trim());
      const endNum = parseFloat(endExpr.trim());
      const descending = !isNaN(startNum) && !isNaN(endNum) && startNum > endNum;
      const cmp = descending ? ">=" : "<=";
      const inc = descending ? "--" : "++";
      currentScope.declared.add(variable);
      emit(output, lineMap, originalLineNumber, `var ${variable} = ${startCode}; ${buildTrackVarExpression(variable)};`);
      emit(output, lineMap, originalLineNumber, `for (; ${variable} ${cmp} ${endCode}; ${variable}${inc}, ${buildTrackVarExpression(variable)}) {`);
      const inner = translateStatements(lines, i + 1, [/^next\b/i], ctx);
      output.push(...inner.lines);
      lineMap.push(...inner.lineMap);
      if (!/^next\b/i.test(stripComments(lines[inner.nextIndex] || "").trim())) {
        throw syntaxError("Missing next", originalLineNumber);
      }
      emit(output, lineMap, inner.nextIndex + 1, `await __runtime.beforeStep(${inner.nextIndex + 1});`);
      emit(output, lineMap, inner.nextIndex + 1, `}`);
      i = inner.nextIndex + 1;
      continue;
    }

    if (/^switch\b/i.test(stripped)) {
      const expr = stripped.replace(/^switch\b/i, "").replace(/:\s*$/, "").trim();
      emit(output, lineMap, originalLineNumber, `switch (${emitExpression(expr, ctx, true, classContext, originalLineNumber)}) {`);
      const inner = translateSwitch(lines, i + 1, ctx, originalLineNumber);
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
      if (ctx.scopeStack.length <= 1) {
        throw syntaxError("return is not valid outside a function or procedure", originalLineNumber);
      }
      const expr = stripped.replace(/^return\b/i, "").trim();
      emit(output, lineMap, originalLineNumber, `return ${expr ? emitExpression(expr, ctx, true, classContext, originalLineNumber) : ""};`);
      i += 1;
      continue;
    }

    if (/^print\s*\(/i.test(stripped)) {
      const call = emitStatementCall(stripped, ctx, classContext, true, originalLineNumber);
      emit(output, lineMap, originalLineNumber, call);
      i += 1;
      continue;
    }

    if (/^global\b/i.test(stripped)) {
      const globalMatch = stripped.match(/^global\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/i);
      if (!globalMatch) {
        throw syntaxError("Invalid global declaration", originalLineNumber);
      }
      const [, varName, valueExpr] = globalMatch;
      emit(
        output,
        lineMap,
        originalLineNumber,
        `globalThis.${varName} = ${emitExpression(valueExpr, ctx, true, classContext, originalLineNumber)}; ${buildTrackVarExpression(varName, `globalThis.${varName}`)};`
      );
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
        js = `var ${name} = new Array(${emitExpression(parts[0], ctx, true, classContext, originalLineNumber)});`;
      } else if (parts.length === 2) {
        js = `var ${name} = Array.from({ length: ${emitExpression(parts[0], ctx, true, classContext, originalLineNumber)} }, () => new Array(${emitExpression(parts[1], ctx, true, classContext, originalLineNumber)}));`;
      } else {
        throw syntaxError("Only one- and two-dimensional arrays are supported", originalLineNumber);
      }
      currentScope.declared.add(name);
      emit(output, lineMap, originalLineNumber, `${js} ${buildTrackVarExpression(name)};`);
      i += 1;
      continue;
    }

    if (/^case\b/i.test(stripped) || /^default\b/i.test(stripped) || /^else\b/i.test(stripped) || /^elseif\b/i.test(stripped) || /^endif\b/i.test(stripped) || /^endwhile\b/i.test(stripped) || /^next\b/i.test(stripped) || /^endswitch\b/i.test(stripped) || /^until\b/i.test(stripped) || /^endfunction\b/i.test(stripped) || /^endprocedure\b/i.test(stripped) || /^endclass\b/i.test(stripped)) {
      break;
    }

    const assignment = translateAssignment(stripped, ctx, classContext, false, originalLineNumber);
    if (assignment) {
      emit(output, lineMap, originalLineNumber, assignment);
      i += 1;
      continue;
    }

    try {
      const expr = parseExpression(stripped, { allowAwait: true, classContext });
      validateSuperUsage(expr, classContext);
      emit(output, lineMap, originalLineNumber, `${emitExprNode(expr, ctx, { allowAwait: true, classContext })};`);
      i += 1;
      continue;
    } catch (error) {
      if (error && error.message === "SUPER can only be used inside a class") {
        throw error;
      }
      // fall through
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
      emit(output, lineMap, lineNumber, `if (${emitExpression(match[1], ctx, true, classContext, lineNumber)}) {`);
      const inner = translateStatements(lines, i + 1, [/^elseif\b/i, /^else\b/i, /^endif\b/i], ctx);
      output.push(...inner.lines);
      lineMap.push(...inner.lineMap);
      i = inner.nextIndex;
      branchState = "branch";
      continue;
    }

    if (/^elseif\b/i.test(line)) {
      emit(output, lineMap, lineNumber, `} else if (${emitExpression(line.replace(/^elseif\b/i, "").replace(/\s+then\s*$/i, "").trim(), ctx, true, classContext, lineNumber)}) {`);
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

function translateSwitch(lines, startIndex, ctx, openingLine) {
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
      emit(output, lineMap, lineNumber, `case ${emitExpression(exprText, ctx, true, classContext, lineNumber)}:`);
      openCase = true;
      i += 1;
      continue;
    }
    if (/^default\b/i.test(line)) {
      if (!/^default\s*:?\s*$/i.test(line)) {
        throw syntaxError("Invalid default", lineNumber);
      }
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
  throw syntaxError("Missing endswitch", openingLine != null ? openingLine : startIndex + 1);
}

function parseFunction(lines, startIndex, ctx, isMethod, methodInfo = null) {
  const output = [];
  const lineMap = [];
  const line = stripComments(lines[startIndex]).trim();
  const lineNumber = startIndex + 1;

  const match = line.match(/^(?:(public|private)\s+)?(function|procedure)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*$/i);
  if (!match) {
    throw syntaxError("Invalid function or procedure declaration", lineNumber);
  }
  const [, , kind, name, paramText] = match;
  const params = splitParams(paramText);
  const bodyLines = [];
  const terminatorRegex = kind.toLowerCase() === "function" ? /^endfunction\b/i : /^endprocedure\b/i;

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

  const isConstructor = methodInfo && methodInfo.kind === "constructor";
  const jsHeader = isMethod
    ? `${isConstructor ? "constructor" : `async ${name}`}(${params.join(", ")}) {`
    : `async function ${name}(${params.join(", ")}) {`;
  emit(output, lineMap, lineNumber, jsHeader);
  for (const param of params) {
    emit(output, lineMap, lineNumber, `${buildTrackVarExpression(param)};`);
  }

  const fieldInitializers = [];
  if (isConstructor && methodInfo && Array.isArray(methodInfo.fields)) {
    for (const field of methodInfo.fields) {
      fieldInitializers.push(`this.${field} = undefined;`);
    }
  }

  const hasExplicitSuper = isConstructor && methodInfo && methodInfo.extendsName && bodyLines.some((entry) => /^super\.new\s*\(/i.test(stripComments(entry).trim()));

  if (isConstructor && methodInfo && methodInfo.extendsName && !hasExplicitSuper) {
    emit(output, lineMap, lineNumber, `super(${params.join(", ")});`);
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
  let insertedFields = isConstructor && methodInfo && methodInfo.extendsName && !hasExplicitSuper;
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
  while (i < lines.length) {
    const current = stripComments(lines[i]).trim();
    if (/^endclass\b/i.test(current)) {
      break;
    }
    if (!current) {
      i += 1;
      continue;
    }
    const methodMatch = current.match(/^(?:(public|private)\s+)?(function|procedure)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*$/i);
    if (methodMatch) {
      const methodName = methodMatch[3];
      const methodKey = methodName.toLowerCase();
      if (classCtx.methods.has(methodKey) || classCtx.fields.some((field) => field.toLowerCase() === methodKey)) {
        throw syntaxError(`Duplicate class member declaration: ${methodName}`, i + 1);
      }
      classCtx.methods.add(methodKey);
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
      const fieldKey = fieldName.toLowerCase();
      if (classCtx.fields.some((field) => field.toLowerCase() === fieldKey) || classCtx.methods.has(fieldKey)) {
        throw syntaxError(`Duplicate class member declaration: ${fieldName}`, i + 1);
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
    emit(constructorLines, constructorMap, lineNumber, "constructor(...args) {");
    if (classCtx.extendsName) {
      emit(constructorLines, constructorMap, lineNumber, "super(...args);");
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

function translateAssignment(statement, ctx, classContext, allowGlobalPrefix, lineNumber = null) {
  const eqIndex = findAssignmentIndex(statement);
  if (eqIndex === -1) {
    return null;
  }
  const left = statement.slice(0, eqIndex).trim();
  const right = statement.slice(eqIndex + 1).trim();
  if (!left || !right) {
    return null;
  }
  if (allowGlobalPrefix && /^global\b/i.test(left)) {
    const target = left.replace(/^global\b/i, "").trim();
    return `globalThis.${target} = ${emitExpression(right, ctx, true, classContext, lineNumber)}; ${buildTrackVarExpression(target, `globalThis.${target}`)};`;
  }

  const leftExpr = parseSimpleTarget(left, ctx, classContext);
  if (leftExpr.kind === "identifier") {
    const scope = ctx.scopeStack[ctx.scopeStack.length - 1];
    if (classContext && classContext.fields.includes(leftExpr.name) && !scope.declared.has(leftExpr.name)) {
      return `this.${leftExpr.name} = ${emitExpression(right, ctx, true, classContext, lineNumber)};`;
    }
    if (!scope.declared.has(leftExpr.name)) {
      scope.declared.add(leftExpr.name);
      return `var ${leftExpr.name} = ${emitExpression(right, ctx, true, classContext, lineNumber)}; ${buildTrackVarExpression(leftExpr.name)};`;
    }
    return `${leftExpr.name} = ${emitExpression(right, ctx, true, classContext, lineNumber)}; ${buildTrackVarExpression(leftExpr.name)};`;
  }
  return `${leftExpr.code} = ${emitExpression(right, ctx, true, classContext, lineNumber)};`;
}

function parseSimpleTarget(text, ctx, classContext) {
  const expr = parseExpression(text, { allowAwait: true, classContext, inTarget: true });
  validateSuperUsage(expr, classContext);
  if (expr.type === "Identifier") {
    return { kind: "identifier", name: expr.name, code: expr.name };
  }
  return { kind: "complex", code: emitExprNode(expr, ctx, { allowAwait: true, classContext }) };
}

function emitStatementCall(line, ctx, classContext, allowAwait, lineNumber = null) {
  return `${emitExpression(line, ctx, allowAwait, classContext, lineNumber)};`;
}

function emitExpression(text, ctx, allowAwait, classContext, lineNumber = null) {
  try {
    const expr = parseExpression(text, { allowAwait, classContext });
    validateSuperUsage(expr, classContext);
    return emitExprNode(expr, ctx, { allowAwait, classContext });
  } catch (error) {
    if (lineNumber == null || (error && typeof error.line === "number")) {
      throw error;
    }
    throw syntaxError(error && error.message ? error.message : String(error), lineNumber);
  }
}

function validateSuperUsage(node, classContext) {
  if (classContext) {
    return;
  }
  if (containsSuperUsage(node)) {
    throw new Error("SUPER can only be used inside a class");
  }
}

function containsSuperUsage(node) {
  if (!node || typeof node !== "object") {
    return false;
  }
  switch (node.type) {
    case "Identifier":
      return String(node.name).toLowerCase() === "super";
    case "Call":
      return containsSuperUsage(node.callee) || node.args.some((arg) => containsSuperUsage(arg));
    case "Member":
      return containsSuperUsage(node.object);
    case "Index":
      return containsSuperUsage(node.object) || node.indices.some((index) => containsSuperUsage(index));
    case "Unary":
      return containsSuperUsage(node.argument);
    case "Binary":
      return containsSuperUsage(node.left) || containsSuperUsage(node.right);
    case "ArrayLiteral":
      return node.elements.some((element) => containsSuperUsage(element));
    case "New":
      return node.args.some((arg) => containsSuperUsage(arg));
    default:
      return false;
  }
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
      if (token.value === "[") {
        const elements = [];
        if (peek() && peek().value === "]") {
          consume("]");
          return { type: "ArrayLiteral", elements };
        }
        while (true) {
          elements.push(parseBinary(0));
          const next = consume();
          if (next.value === "]") {
            break;
          }
          if (next.value !== ",") {
            throw new Error("Expected , or ]");
          }
        }
        return { type: "ArrayLiteral", elements };
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
    if (peek() && ["<", "<=", ">", ">="].includes(peek().value)) {
      const op = consume().value;
      const right = parseTerm();
      left = { type: "Binary", operator: op, left, right };
      if (peek() && ["<", "<=", ">", ">="].includes(peek().value)) {
        throw new Error("Chained comparisons are not supported");
      }
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
    case "Identifier":
      if (classContext && classContext.fields && classContext.fields.includes(node.name)) {
        return `this.${node.name}`;
      }
      return node.name;
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
        const lowerName = name.toLowerCase();
        const args = node.args.map((arg) => emitExprNode(arg, ctx, options));
        if (lowerName === "print") {
          return `${allowAwait ? "await " : ""}__runtime.print(${args.join(", ") || '""'})`;
        }
        if (lowerName === "input") {
          return `${allowAwait ? "await " : ""}__runtime.input(${args[0] || '""'})`;
        }
        if (lowerName === "openread" || lowerName === "read") {
          return `${allowAwait ? "await " : ""}__runtime.openRead(${args[0] || '""'})`;
        }
        if (lowerName === "openwrite" || lowerName === "write") {
          return `${allowAwait ? "await " : ""}__runtime.openWrite(${args[0] || '""'})`;
        }
        if (lowerName === "int") {
          return `Number.parseInt(${args[0] || "0"}, 10)`;
        }
        if (lowerName === "float") {
          return `Number.parseFloat(${args[0] || "0"})`;
        }
        if (lowerName === "str") {
          return `String(${args[0] || '""'})`;
        }
        if (classContext && lowerName !== "this" && lowerName !== "super") {
          return `${allowAwait ? "await " : ""}this.${name}(${args.join(", ")})`;
        }
        return `${allowAwait ? "await " : ""}${name}(${args.join(", ")})`;
      }
      if (node.callee.type === "Member") {
        const objectCode = emitExprNode(node.callee.object, ctx, options);
        const property = node.callee.property;
        const lowerProperty = String(property).toLowerCase();
        const args = node.args.map((arg) => emitExprNode(arg, ctx, options));
        if (lowerProperty === "substring") {
          const start = args[0] || "0";
          const count = args[1] || "0";
          return `(${objectCode}).substring(${start}, (${start}) + (${count}))`;
        }
        if (lowerProperty === "readline") {
          return `${allowAwait ? "await " : ""}${objectCode}.readLine(${args.join(", ")})`;
        }
        if (lowerProperty === "writeline") {
          return `${allowAwait ? "await " : ""}${objectCode}.writeLine(${args.join(", ")})`;
        }
        if (lowerProperty === "endoffile") {
          return `${allowAwait ? "await " : ""}${objectCode}.endOfFile(${args.join(", ")})`;
        }
        if (lowerProperty === "close") {
          return `${allowAwait ? "await " : ""}${objectCode}.close(${args.join(", ")})`;
        }
      if (node.callee.object.type === "Identifier" && node.callee.object.name.toLowerCase() === "super" && lowerProperty === "new") {
        return `super(${args.join(", ")})`;
      }
      if (node.callee.object.type === "Identifier" && node.callee.object.name.toLowerCase() === "super") {
        return `${allowAwait ? "await " : ""}super.${property}(${args.join(", ")})`;
      }
      return `${allowAwait ? "await " : ""}${objectCode}.${property}(${args.join(", ")})`;
    }
      return `${allowAwait ? "await " : ""}${emitExprNode(node.callee, ctx, options)}(${node.args.map((arg) => emitExprNode(arg, ctx, options)).join(", ")})`;
    }
    case "Member":
      if (String(node.property).toLowerCase() === "length") {
        return `${emitExprNode(node.object, ctx, options)}.length`;
      }
      return `${emitExprNode(node.object, ctx, options)}.${node.property}`;
    case "Index":
      return `${emitExprNode(node.object, ctx, options)}${node.indices.map((index) => `[${emitExprNode(index, ctx, options)}]`).join("")}`;
    case "New":
      return `new ${node.callee}(${node.args.map((arg) => emitExprNode(arg, ctx, options)).join(", ")})`;
    case "ArrayLiteral":
      return `[${node.elements.map((element) => emitExprNode(element, ctx, options)).join(", ")}]`;
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
      let closed = false;
      while (i < input.length) {
        const current = input[i];
        if (current === "\\" && i + 1 < input.length) {
          value += current + input[i + 1];
          i += 2;
          continue;
        }
        if (current === quote) {
          i += 1;
          closed = true;
          break;
        }
        value += current;
        i += 1;
      }
      if (!closed) {
        throw new Error("Unclosed string literal");
      }
      tokens.push({ type: "string", value: decodeStringLiteral(quote, value) });
      continue;
    }
    if (/[0-9]/.test(ch)) {
      const start = i;
      let hasDot = false;
      while (i < input.length) {
        const c = input[i];
        if (/[0-9]/.test(c)) {
          i += 1;
        } else if (c === "." && !hasDot && i + 1 < input.length && /[0-9]/.test(input[i + 1])) {
          hasDot = true;
          i += 1;
        } else {
          break;
        }
      }
      tokens.push({ type: "number", value: Number(input.slice(start, i)) });
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const start = i;
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

function buildTrackVarExpression(name, valueCode = null) {
  const key = JSON.stringify(String(name));
  const value = valueCode || String(name);
  return `__runtime.trackVar(${key}, ${value})`;
}

function instrumentDebugTrace(lines, lineMap, sourceLines = []) {
  const instrumentedLines = [];
  const instrumentedMap = [];
  let classBraceDepth = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = String(lines[i] || "");
    const sourceLine = lineMap[i];
    const trimmed = line.trim();
    const startsClass = /^class\b/i.test(trimmed) && /\{\s*$/.test(trimmed);
    const inClassBody = classBraceDepth > 0 || startsClass;

    if (!inClassBody && shouldPauseBeforeLine(trimmed) && Number.isInteger(sourceLine) && sourceLine > 0) {
      instrumentedLines.push(`await __runtime.beforeStep(${sourceLine});`);
      instrumentedMap.push(sourceLine);
    }

    if (!inClassBody && shouldTraceBeforeLine(trimmed) && Number.isInteger(sourceLine) && sourceLine > 0) {
      instrumentedLines.push(`await __runtime.traceStep(${sourceLine});`);
      instrumentedMap.push(sourceLine);
    }

    instrumentedLines.push(line);
    instrumentedMap.push(sourceLine);

    if (!inClassBody && isLoopIterationStart(trimmed) && Number.isInteger(sourceLine) && sourceLine > 0) {
      // Runs at the beginning of each iteration for FOR/WHILE/DO loops.
      instrumentedLines.push(`await __runtime.traceStep(${sourceLine});`);
      instrumentedMap.push(sourceLine);
    }

    if (!inClassBody && shouldTraceAfterLine(trimmed) && Number.isInteger(sourceLine) && sourceLine > 0) {
      instrumentedLines.push(`await __runtime.traceStep(${sourceLine});`);
      instrumentedMap.push(sourceLine);
    }

    if (startsClass || classBraceDepth > 0) {
      classBraceDepth += countChar(trimmed, "{");
      classBraceDepth -= countChar(trimmed, "}");
      if (classBraceDepth < 0) {
        classBraceDepth = 0;
      }
    }
  }
  return {
    lines: instrumentedLines,
    lineMap: instrumentedMap
  };
}

function countChar(text, target) {
  let total = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === target) {
      total += 1;
    }
  }
  return total;
}

function shouldTraceBeforeLine(line) {
  if (!line) {
    return false;
  }
  if (/^await __runtime\.(?:traceStep|beforeStep)\(/.test(line)) {
    return false;
  }
  return (
    /^if\s*\(/i.test(line) ||
    /^\}\s*else if\s*\(/i.test(line) ||
    /^switch\s*\(/i.test(line) ||
    /^return\b/i.test(line)
  );
}

function shouldTraceAfterLine(line) {
  if (!line || !/;\s*$/.test(line)) {
    return false;
  }
  if (/^await __runtime\.(?:traceStep|beforeStep)\(/.test(line)) {
    return false;
  }
  if (/^break;$/i.test(line)) {
    return false;
  }
  if (/^return\b/i.test(line)) {
    return false;
  }
  if (/^\}\s*while\s*\(/i.test(line)) {
    return false;
  }
  return true;
}

function isLoopIterationStart(line) {
  return /^for\s*\(/i.test(line) || /^while\s*\(/i.test(line) || /^do\s*\{$/i.test(line);
}

function shouldPauseBeforeLine(line) {
  if (!line) {
    return false;
  }
  if (/^await __runtime\.(?:traceStep|beforeStep)\(/.test(line)) {
    return false;
  }
  if (/^break;$/i.test(line)) {
    return false;
  }
  if (/^\}$/.test(line)) {
    return false;
  }
  return (
    /;\s*$/.test(line) ||
    /^if\s*\(/i.test(line) ||
    /^\}\s*else if\s*\(/i.test(line) ||
    /^switch\s*\(/i.test(line) ||
    /^for\s*\(/i.test(line) ||
    /^while\s*\(/i.test(line) ||
    /^do\s*\{$/i.test(line) ||
    /^return\b/i.test(line)
  );
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
