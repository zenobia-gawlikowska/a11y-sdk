#!/usr/bin/env node
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/detect-framework.ts
var detect_framework_exports = {};
__export(detect_framework_exports, {
  detectFramework: () => detectFramework
});
module.exports = __toCommonJS(detect_framework_exports);
var import_node_fs = require("fs");
var import_node_path = require("path");
function readDeps(projectRoot) {
  try {
    const raw = (0, import_node_fs.readFileSync)((0, import_node_path.join)(projectRoot, "package.json"), "utf8");
    const pkg = JSON.parse(raw);
    return {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies
    };
  } catch {
    return {};
  }
}
function detectFramework(projectRoot) {
  const deps = readDeps(projectRoot);
  if ("@angular/core" in deps) return "angular";
  if ("svelte" in deps) return "svelte";
  if ("vue" in deps) return "vue";
  if ("react" in deps) return "react";
  return "unknown";
}
if (require.main === module) {
  const projectRoot = process.argv[2] ?? process.cwd();
  process.stdout.write(detectFramework(projectRoot) + "\n");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  detectFramework
});
