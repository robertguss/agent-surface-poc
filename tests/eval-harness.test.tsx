import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SurfaceRenderer } from "@/components/surface-renderer";
import { loadPublicEvalCases } from "@/evals/cases";
import { runMutationSuite } from "@/evals/mutations";
import { scoreHtml, scoreIntent } from "@/evals/scoring";
import { sampleIntentSpec, sampleSurfaceSpec } from "@/lib/sample";

describe("authoring evaluation harness", () => {
  it("loads 12 schema-valid public cases with stable unique IDs", () => {
    const cases = loadPublicEvalCases();

    expect(cases).toHaveLength(12);
    expect(new Set(cases.map((evalCase) => evalCase.id)).size).toBe(12);
  });

  it("scores recovered intent requirements independently from the compiler", () => {
    const evalCase = loadPublicEvalCases().find(
      (candidate) => candidate.id === "full-refund-review",
    );
    expect(evalCase).toBeDefined();

    const result = scoreIntent(evalCase!, sampleIntentSpec);

    expect(result.requirementRecall).toBeGreaterThan(0);
    expect(result.requirementRecall).toBeLessThan(1);
    expect(result.scenarioRecall).toBe(1);
    expect(result.card.checks.some((check) => !check.passed)).toBe(true);
  });

  it("accepts semantic HTML and rejects missing action metadata", () => {
    const evalCase = loadPublicEvalCases().find(
      (candidate) => candidate.id === "full-refund-review",
    );
    expect(evalCase).toBeDefined();
    const html = renderToStaticMarkup(
      <SurfaceRenderer surface={sampleSurfaceSpec} />,
    );

    const valid = scoreHtml(evalCase!, html);
    const mutated = scoreHtml(
      evalCase!,
      html.replace('data-requires-confirmation="true"', ""),
    );

    expect(valid.card.score).toBe(1);
    expect(valid.actionSafety).toBe(1);
    expect(mutated.card.score).toBeLessThan(1);
    expect(
      mutated.card.checks.find((check) =>
        check.id.includes("refund.deny:confirmation"),
      )?.passed,
    ).toBe(false);
  });

  it("catches every compiler mutation, including every safety mutation", () => {
    const results = runMutationSuite();

    expect(results).toHaveLength(12);
    expect(results.every((result) => result.caught)).toBe(true);
    expect(
      results
        .filter((result) => result.safetyCritical)
        .every((result) => result.caught),
    ).toBe(true);
  });
});
