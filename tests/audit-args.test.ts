import { describe, it, expect } from "vitest";
import { parseAuditArgs } from "../src/audit";

describe("parseAuditArgs", () => {
  it("defaults to AA with no flags", () => {
    const { url, opts, error } = parseAuditArgs(["http://localhost:3000"]);
    expect(url).toBe("http://localhost:3000");
    expect(opts).toEqual({ level: "AA", json: false });
    expect(error).toBeUndefined();
  });

  it("accepts --level=AAA and --level AAA forms", () => {
    expect(parseAuditArgs(["http://x", "--level=AAA"]).opts.level).toBe("AAA");
    expect(parseAuditArgs(["http://x", "--level", "AAA"]).opts.level).toBe("AAA");
    expect(parseAuditArgs(["--level", "aa", "http://x"]).opts.level).toBe("AA");
  });

  it("empty --level= falls back to AA instead of an empty tag set", () => {
    const { opts, error } = parseAuditArgs(["http://x", "--level="]);
    expect(opts.level).toBe("AA");
    expect(error).toBeUndefined();
  });

  it("rejects a non-AA/AAA level instead of scanning with garbage", () => {
    const { error } = parseAuditArgs(["--level", "http://x"]);
    expect(error).toContain("invalid --level");
  });

  it("rejects unknown flags instead of silently ignoring them", () => {
    const { error } = parseAuditArgs(["--verbose", "http://x"]);
    expect(error).toContain('unknown audit flag "--verbose"');
  });

  it("keeps the URL when flags surround it", () => {
    const { url, opts } = parseAuditArgs(["--json", "http://x", "--level", "AAA"]);
    expect(url).toBe("http://x");
    expect(opts).toEqual({ level: "AAA", json: true });
  });
});
