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

// src/config-loader.ts
var config_loader_exports = {};
__export(config_loader_exports, {
  defaultConfig: () => defaultConfig,
  loadConfig: () => loadConfig
});
module.exports = __toCommonJS(config_loader_exports);
var import_node_fs = require("fs");
var import_node_path = require("path");
var defaultConfig = {
  wcagLevel: "AA",
  rules: {
    "focus-management": true,
    "aria-roles": true,
    "keyboard-navigation": true,
    "color-contrast": true,
    "form-labeling": true,
    "landmark-structure": true,
    "live-regions": true,
    images: true
  }
};
var CONFIG_PATH = ".a11y/config/a11y.config.json";
function isRuleFlags(obj) {
  if (typeof obj !== "object" || obj === null) return false;
  const keys = [
    "focus-management",
    "aria-roles",
    "keyboard-navigation",
    "color-contrast",
    "form-labeling",
    "landmark-structure",
    "live-regions",
    "images"
  ];
  return keys.every((k) => typeof obj[k] === "boolean");
}
function isA11yConfig(obj) {
  if (typeof obj !== "object" || obj === null) return false;
  const record = obj;
  if (record["wcagLevel"] !== "AA" && record["wcagLevel"] !== "AAA") return false;
  return isRuleFlags(record["rules"]);
}
function loadConfig(projectRoot) {
  const configPath = (0, import_node_path.join)(projectRoot, CONFIG_PATH);
  let raw;
  try {
    raw = (0, import_node_fs.readFileSync)(configPath, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") {
      return { ...defaultConfig, rules: { ...defaultConfig.rules } };
    }
    throw new Error(
      `a11y-sdk: could not read config at ${configPath}: ${String(err)}`
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `a11y-sdk: malformed JSON in ${configPath}. Fix the syntax error and try again.`
    );
  }
  if (!isA11yConfig(parsed)) {
    throw new Error(
      `a11y-sdk: invalid config shape in ${configPath}. Expected { wcagLevel: "AA"|"AAA", rules: { ... } } with all rule flags as booleans.`
    );
  }
  return parsed;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  defaultConfig,
  loadConfig
});
