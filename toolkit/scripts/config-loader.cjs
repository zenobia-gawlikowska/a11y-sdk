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
function loadConfig(_projectRoot) {
  return defaultConfig;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  defaultConfig,
  loadConfig
});
