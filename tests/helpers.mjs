import { readFileSync } from "node:fs";

import { translateProgram } from "../translator.js";

export function loadFixture(name, language = "ocr") {
  return readFileSync(new URL(`./fixtures/${name}.${language === "python" ? "py" : "ocr"}`, import.meta.url), "utf8");
}

export function translateSource(source, options = {}) {
  return translateProgram(source, options);
}

export async function runSource(source, runtimeOverrides = {}, options = {}) {
  const { js, lineMap } = translateProgram(source, options);
  const output = [];
  const files = new Map();
  const inputQueue = [...(runtimeOverrides.inputs || [])];

  if (runtimeOverrides.files) {
    for (const [path, lines] of runtimeOverrides.files.entries()) {
      files.set(String(path), [...lines]);
    }
  }

  const runtime = {
    print: async (value) => {
      output.push(String(value));
    },
    input: async () => {
      if (!inputQueue.length) {
        throw new Error("No more test input");
      }
      return String(inputQueue.shift());
    },
    open: async (path, mode) => makeFileHandle(files, path, mode),
    openRead: async (path) => makeReader(files, path),
    openWrite: async (path) => makeWriter(files, path),
    toIterableArray: async (value) => toIterableArray(value),
    pyAppend: (target, value) => {
      target.push(value);
    },
    pyInsert: (target, index, value) => {
      target.splice(Number(index), 0, value);
    },
    pyMul: (left, right) => pyMul(left, right),
    pyFind: (text, needle, start, end) => pyFind(text, needle, start, end),
    pyIndex: (text, needle, start, end) => pyIndex(text, needle, start, end),
    pyIsAlpha: (text) => /^[A-Za-z]+$/.test(String(text)),
    pyIsAlnum: (text) => /^[A-Za-z0-9]+$/.test(String(text)),
    pyIsDigit: (text) => /^\d+$/.test(String(text)),
    pyIsUpper: (text) => /[A-Z]/.test(String(text)) && String(text) === String(text).toUpperCase(),
    pyIsLower: (text) => /[a-z]/.test(String(text)) && String(text) === String(text).toLowerCase(),
    pyRound: (value, digits) => pyRound(value, digits),
    pyReplace: (text, oldValue, newValue, count) => pyReplace(text, oldValue, newValue, count),
    pyStrip: (text, chars) => pyStrip(text, chars),
    pyFormat: (template, values) => pyFormat(template, values),
    random: () => (typeof runtimeOverrides.random === "function" ? Number(runtimeOverrides.random()) : Math.random()),
    randomInt: (min, max) =>
      typeof runtimeOverrides.randomInt === "function"
        ? Number(runtimeOverrides.randomInt(min, max))
        : randomInt(min, max, typeof runtimeOverrides.random === "function" ? runtimeOverrides.random() : Math.random()),
    sleep: async (seconds) => {
      if (typeof runtimeOverrides.sleep === "function") {
        return runtimeOverrides.sleep(seconds);
      }
      return undefined;
    },
    trackVar: (name, value) => value,
    beforeStep: async () => {},
    traceStep: async () => {}
  };

  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const fn = new AsyncFunction("__runtime", `"use strict";\n${js}`);
  await fn(runtime);

  return { js, lineMap, output, files };
}

function makeReader(files, path) {
  const key = String(path);
  const lines = files.get(key) || [];
  let index = 0;
  return {
    __pythonFile: true,
    async readLine() {
      return index < lines.length ? lines[index++] : "";
    },
    async readLines() {
      const rest = lines.slice(index);
      index = lines.length;
      return rest;
    },
    async endOfFile() {
      return index >= lines.length;
    },
    async write() {},
    async writeLines() {},
    async close() {}
  };
}

function makeWriter(files, path) {
  const key = String(path);
  const lines = [];
  files.set(key, lines);
  return {
    __pythonFile: true,
    async writeLine(value) {
      lines.push(String(value));
    },
    async write(value) {
      const text = String(value);
      const parts = text.split(/\r?\n/);
      if (!parts.length) {
        return;
      }
      if (!lines.length) {
        lines.push(parts.shift());
      } else {
        lines[lines.length - 1] += parts.shift();
      }
      for (const part of parts) {
        lines.push(part);
      }
    },
    async writeLines(values) {
      for (const value of Array.isArray(values) ? values : []) {
        await this.write(value);
      }
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
    async close() {}
  };
}

function makeAppendWriter(files, path) {
  const key = String(path);
  const lines = files.get(key) ? [...files.get(key)] : [];
  files.set(key, lines);
  return {
    __pythonFile: true,
    async writeLine(value) {
      lines.push(String(value));
    },
    async write(value) {
      const text = String(value);
      const parts = text.split(/\r?\n/);
      if (!parts.length) {
        return;
      }
      if (!lines.length) {
        lines.push(parts.shift());
      } else {
        lines[lines.length - 1] += parts.shift();
      }
      for (const part of parts) {
        lines.push(part);
      }
    },
    async writeLines(values) {
      for (const value of Array.isArray(values) ? values : []) {
        await this.write(value);
      }
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
    async close() {}
  };
}

function makeFileHandle(files, path, mode) {
  const normalizedMode = String(mode).replace(/^["']|["']$/g, "");
  if (normalizedMode === "r") {
    return makeReader(files, path);
  }
  if (normalizedMode === "a") {
    return makeAppendWriter(files, path);
  }
  return makeWriter(files, path);
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
  const source = String(text);
  const from = start == null ? 0 : Number(start);
  const to = end == null ? source.length : Number(end);
  const idx = source.slice(from, to).indexOf(String(needle));
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

function pyReplace(text, oldValue, newValue, count) {
  let result = String(text);
  const oldText = String(oldValue);
  const replacement = String(newValue);
  if (oldText === "") {
    return result;
  }
  if (count == null) {
    return result.split(oldText).join(replacement);
  }
  let remaining = Number(count);
  while (remaining > 0) {
    const index = result.indexOf(oldText);
    if (index < 0) {
      break;
    }
    result = result.slice(0, index) + replacement + result.slice(index + oldText.length);
    remaining -= 1;
  }
  return result;
}

function pyStrip(text, chars) {
  const source = String(text);
  if (chars == null) {
    return source.trim();
  }
  const charset = new Set(Array.from(String(chars)));
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
  return String(template).replace(/\{(\d*)(?::([^}]+))?\}/g, (_, rawIndex, rawSpec) => {
    const index = rawIndex === "" ? autoIndex++ : Number(rawIndex);
    const value = index >= 0 && index < values.length ? values[index] : "";
    return applyPyFormatSpec(value, rawSpec || "");
  });
}

function applyPyFormatSpec(value, spec) {
  const match = String(spec).match(/^([<>=^])?([+\- ])?(\d+)?(?:\.(\d+))?([sdf])?$/);
  if (!match) {
    return String(value);
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
      text = `+${text}`;
    } else if (number >= 0 && sign === " ") {
      text = ` ${text}`;
    }
  } else if (type === "f") {
    const number = Number(value);
    const digits = precision == null ? 6 : precision;
    text = number.toFixed(digits);
    if (number >= 0 && sign === "+") {
      text = `+${text}`;
    } else if (number >= 0 && sign === " ") {
      text = ` ${text}`;
    }
  } else {
    text = String(value);
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
    return `${" ".repeat(left)}${text}${" ".repeat(right)}`;
  }
  return padding + text;
}

function randomInt(min, max, unitRandom) {
  const lower = Math.ceil(Number(min));
  const upper = Math.floor(Number(max));
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || upper < lower) {
    return lower;
  }
  const randomValue = Math.min(Math.max(Number(unitRandom), 0), 0.9999999999999999);
  return Math.floor(randomValue * (upper - lower + 1)) + lower;
}
