import { describe, it, expect } from "vitest";
import { formatResults } from "../src/audit.ts";
import type { AxeResults } from "../src/audit.ts";

const mockResults: AxeResults = {
  violations: [
    {
      id: "color-contrast",
      impact: "serious",
      description: "Elements must have sufficient color contrast",
      tags: ["wcag2aa", "wcag143"],
      nodes: [
        {
          target: [".cta-button"],
          html: '<button class="cta-button">Submit</button>',
          failureSummary: "Fix any of the following:\n  Element has insufficient color contrast",
        },
      ],
    },
    {
      id: "image-alt",
      impact: "critical",
      description: "Images must have alternate text",
      tags: ["wcag2a", "wcag111"],
      nodes: [
        {
          target: ["#hero-image"],
          html: '<img id="hero-image" src="hero.jpg">',
          failureSummary: "Fix any of the following:\n  Element does not have an alt attribute",
        },
      ],
    },
    {
      id: "link-name",
      impact: "moderate",
      description: "Links must have discernible text",
      tags: ["wcag2a", "wcag244"],
      nodes: [
        {
          target: ["a.icon-link"],
          html: '<a class="icon-link" href="/dashboard"></a>',
          failureSummary: "Fix any of the following:\n  Element does not have text that is visible to screen readers",
        },
      ],
    },
  ],
};

describe("formatResults", () => {
  it("returns no-violation message for empty violations", () => {
    const result = formatResults({ violations: [] });
    expect(result).toBe("No accessibility violations found.");
  });

  it("orders violations by impact: critical → serious → moderate → minor", () => {
    const output = formatResults(mockResults);
    const criticalPos = output.indexOf("WCAG 1.1.1");
    const seriousPos = output.indexOf("WCAG 1.4.3");
    const moderatePos = output.indexOf("WCAG 2.4.4");
    expect(criticalPos).toBeLessThan(seriousPos);
    expect(seriousPos).toBeLessThan(moderatePos);
  });

  it("formats critical image-alt violation with WCAG criterion and impact", () => {
    const output = formatResults(mockResults);
    expect(output).toContain("WCAG 1.1.1 Non-text Content [critical]");
    expect(output).toContain("#hero-image");
  });

  it("formats serious color-contrast violation with WCAG criterion", () => {
    const output = formatResults(mockResults);
    expect(output).toContain("WCAG 1.4.3 Contrast (Minimum) [serious]");
    expect(output).toContain(".cta-button");
  });

  it("strips 'Fix any of the following:' prefix from failure summary", () => {
    const output = formatResults(mockResults);
    expect(output).not.toContain("Fix any of the following:");
  });

  it("falls back to axe rule id when no WCAG mapping exists", () => {
    const unknown: AxeResults = {
      violations: [
        {
          id: "unknown-custom-rule",
          impact: "minor",
          description: "Some custom check",
          tags: [],
          nodes: [{ target: ["div"], html: "<div></div>", failureSummary: undefined }],
        },
      ],
    };
    const output = formatResults(unknown);
    expect(output).toContain("unknown-custom-rule [minor]");
  });
});
