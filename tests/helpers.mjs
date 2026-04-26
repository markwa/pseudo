import { readFileSync } from "node:fs";

import { translateProgram } from "../translator.js";

export function loadFixture(name) {
  return readFileSync(new URL(`./fixtures/${name}.ocr`, import.meta.url), "utf8");
}

export function translateSource(source) {
  return translateProgram(source);
}

export async function runSource(source, runtimeOverrides = {}) {
  const { js, lineMap } = translateProgram(source);
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
    openRead: async (path) => makeReader(files, path),
    openWrite: async (path) => makeWriter(files, path),
    trackVar: (name, value) => value,
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
    async readLine() {
      return index < lines.length ? lines[index++] : "";
    },
    async endOfFile() {
      return index >= lines.length;
    },
    async close() {}
  };
}

function makeWriter(files, path) {
  const key = String(path);
  const lines = [];
  files.set(key, lines);
  return {
    async writeLine(value) {
      lines.push(String(value));
    },
    async close() {}
  };
}
