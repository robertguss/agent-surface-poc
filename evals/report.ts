import type { EvalResult } from "./types";

interface ReportMetadata {
  generatedAt: string;
  model: string;
  gitSha: string;
  resultsPath: string;
}

function average(values: Array<number | null>): number | null {
  const observed = values.filter((value): value is number => value !== null);
  return observed.length === 0
    ? null
    : observed.reduce((sum, value) => sum + value, 0) / observed.length;
}

function percent(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function number(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}

function aggregate(results: EvalResult[], pipeline: EvalResult["pipeline"]) {
  const rows = results.filter((result) => result.pipeline === pipeline);
  const completed = rows.filter((result) => result.status !== "error");
  return {
    pipeline,
    runs: rows.length,
    completed: completed.length,
    passed: rows.filter((result) => result.status === "passed").length,
    contract: average(rows.map((result) => result.metrics.contractPassed === null
      ? null
      : Number(result.metrics.contractPassed))),
    intentRecall: average(
      rows.map((result) => result.metrics.intentRequirementRecall),
    ),
    intentPrecision: average(
      rows.map((result) => result.metrics.intentRequirementPrecision),
    ),
    html: average(rows.map((result) => result.metrics.htmlScore)),
    actionSafety: average(rows.map((result) => result.metrics.actionSafety)),
    consumption: average(
      rows.map((result) => result.metrics.consumptionAccuracy),
    ),
    repairs: average(rows.map((result) => result.metrics.repairTurns)),
    duration: average(rows.map((result) => result.durationMs)),
    tokens: average(rows.map((result) => result.metrics.totalTokens)),
  };
}

export function generateMarkdownReport(
  results: EvalResult[],
  metadata: ReportMetadata,
): string {
  const pipelines: EvalResult["pipeline"][] = ["surface", "direct-react"];
  const summaries = pipelines
    .map((pipeline) => aggregate(results, pipeline))
    .filter((summary) => summary.runs > 0);
  const lines = [
    "# Surface authoring evaluation",
    "",
    `Generated: ${metadata.generatedAt}`,
    `Model: \`${metadata.model}\``,
    `Git revision: \`${metadata.gitSha}\``,
    `Evidence: \`${metadata.resultsPath}\``,
    "",
    "> This is a reproducible development evaluation over a public case set, not a claim of general model quality. Repeated runs and an unseen holdout are required before drawing product conclusions.",
    "",
    "## Summary",
    "",
    "| Pipeline | Runs | Completed | Strict pass | Contract | Intent recall | Intent precision | HTML | Action safety | Consumption | Avg repairs | Avg duration | Avg tokens |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...summaries.map(
      (summary) =>
        `| ${summary.pipeline} | ${summary.runs} | ${summary.completed} | ${percent(summary.runs === 0 ? null : summary.passed / summary.runs)} | ${percent(summary.contract)} | ${percent(summary.intentRecall)} | ${percent(summary.intentPrecision)} | ${percent(summary.html)} | ${percent(summary.actionSafety)} | ${percent(summary.consumption)} | ${number(summary.repairs)} | ${summary.duration === null ? "—" : `${Math.round(summary.duration)} ms`} | ${summary.tokens === null ? "—" : Math.round(summary.tokens)} |`,
    ),
    "",
    "A strict pass means every deterministic oracle check for that pipeline passed. Scores are shown separately so averages cannot hide a safety failure.",
    "",
    "## Runs",
    "",
    "| Case | Run | Pipeline | Status | Intent | Surface | HTML | Safety | Consumption | Duration | Error |",
    "| --- | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...results.map((result) => {
      const consumption = result.metrics.consumptionAccuracy;
      return `| ${result.caseId} | ${result.run} | ${result.pipeline} | ${result.status} | ${percent(result.checks.intent?.score ?? null)} | ${percent(result.checks.surface?.score ?? null)} | ${percent(result.metrics.htmlScore)} | ${percent(result.metrics.actionSafety)} | ${percent(consumption)} | ${result.durationMs} ms | ${result.error ? result.error.replaceAll("|", "\\|") : ""} |`;
    }),
    "",
    "## Failed checks",
    "",
  ];

  const failures = results.flatMap((result) =>
    [result.checks.intent, result.checks.surface, result.checks.html]
      .filter((card): card is NonNullable<typeof card> => Boolean(card))
      .flatMap((card) =>
        card.checks
          .filter((check) => !check.passed)
          .map(
            (check) =>
              `- **${result.caseId} / run ${result.run} / ${result.pipeline}:** \`${check.id}\` — ${check.evidence}`,
          ),
      ),
  );

  lines.push(...(failures.length > 0 ? failures : ["No deterministic checks failed."]));
  lines.push("");
  return lines.join("\n");
}
