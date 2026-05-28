import { describe, it, expect } from "vitest";
import { VERSION } from "../src/index.js";

describe("a11y-sdk", () => {
  it("exports a version string", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
