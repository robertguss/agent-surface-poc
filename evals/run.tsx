import { execFileSync } from "node:child_process";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";

import { SurfaceRenderer } from "@/components/surface-renderer";
import {
  compileHumanIntent,
  SURFACE_PROMPT_VERSION,
} from "@/lib/authoring";
import { getDemoFixture } from "@/lib/domain";
import { createAgentSnapshot, snapshotToMarkdown } from "@/lib/projections";
import {
  DIRECT_REACT_PROMPT_VERSION,
  generateDirectReact,
  renderGeneratedReact,
} from "./baseline";
import { loadPublicEvalCases } from "./cases";
import { runConsumptionEval } from "./consumption";
import { generateMarkdownReport } from "./report";
import { scoreHtml, scoreIntent, scoreSurface } from "./scoring";
import type {
  AuthoringEvalCase,
  ConsumptionResult,
  EvalMetrics,
  EvalResult,
  ScoreCard,
} from "./types";

type PipelineOption = "surface" | "direct-react" | "both";
type Modality = "html" | "json" | "markdown";

interface RunnerOptions {
  pipeline: PipelineOption;
  runs: number;
  caseIds: string[];
  consumption: boolean;
  modalities: Modality[];
  output: string;
  model: string;
}

const emptyCard = (): ScoreCard => ({
  passed: 0,
  total: 0,
  score: 0,
  checks: [],
});

function parseOptions(argv: string[]): RunnerOptions {
  const values = new Map<string, string>();
  const flags = new Set<string>();

  for (const argument of argv) {
    if (!argument.startsWith("--")) {
      throw new Error(`Unknown positional argument: ${argument}`);
    }
    const [name, value] = argument.slice(2).split("=", 2);
    if (value === undefined) flags.add(name);
    else values.set(name, value);
  }

  if (flags.has("help")) {
    console.log(`Usage: npm run eval -- [options]

--pipeline=surface|direct-react|both  Pipelines to run (default: both)
--runs=N                              Repetitions per case (default: 1)
--case=id[,id]                        Restrict to case IDs
--consumption                         Run unfamiliar-agent consumption evals
--modalities=html,json,markdown       Surface modalities (default: all)
--output=path                         Output base or .jsonl path
--model=name                          OpenAI model (default: OPENAI_MODEL or gpt-5-mini)`);
    process.exit(0);
  }

  const pipeline = (values.get("pipeline") ?? "both") as PipelineOption;
  if (!["surface", "direct-react", "both"].includes(pipeline)) {
    throw new Error(`Invalid pipeline: ${pipeline}`);
  }
  const runs = Number(values.get("runs") ?? "1");
  if (!Number.isInteger(runs) || runs < 1 || runs > 20) {
    throw new Error("--runs must be an integer from 1 through 20.");
  }
  const modalities = (values.get("modalities") ?? "html,json,markdown")
    .split(",")
    .filter(Boolean) as Modality[];
  if (
    modalities.length === 0 ||
    modalities.some(
      (modality) => !["html", "json", "markdown"].includes(modality),
    )
  ) {
    throw new Error("--modalities must contain html, json, and/or markdown.");
  }
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");

  return {
    pipeline,
    runs,
    caseIds: (values.get("case") ?? "").split(",").filter(Boolean),
    consumption: flags.has("consumption"),
    modalities,
    output: values.get("output") ?? `evals/results/${timestamp}`,
    model: values.get("model") ?? process.env.OPENAI_MODEL ?? "gpt-5-mini",
  };
}

function outputPaths(output: string) {
  const base = output.endsWith(".jsonl") ? output.slice(0, -6) : output;
  return { jsonl: `${base}.jsonl`, markdown: `${base}.md` };
}

function gitRevision(): string {
  try {
    const sha = execFileSync("git", ["rev-parse", "--short=12", "HEAD"], {
      encoding: "utf8",
    }).trim();
    const dirty = execFileSync("git", ["status", "--porcelain"], {
      encoding: "utf8",
    }).trim();
    return dirty ? `${sha}-dirty` : sha;
  } catch {
    return "unknown";
  }
}

function average(values: number[]): number | null {
  return values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function consumptionAccuracy(results: ConsumptionResult[]): number | null {
  return average(results.map((result) => result.accuracy));
}

function errorMetrics(): EvalMetrics {
  return {
    intentRequirementRecall: null,
    intentRequirementPrecision: null,
    intentScenarioRecall: null,
    contractPassed: null,
    componentFit: null,
    actionSafety: 0,
    htmlScore: 0,
    consumptionAccuracy: null,
    repairTurns: null,
    firstPassFailedChecks: null,
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
  };
}

function baseResult({
  evalCase,
  run,
  pipeline,
  model,
  promptVersion,
  gitSha,
  startedAt,
}: {
  evalCase: AuthoringEvalCase;
  run: number;
  pipeline: EvalResult["pipeline"];
  model: string;
  promptVersion: string;
  gitSha: string;
  startedAt: number;
}) {
  return {
    schemaVersion: "0.1" as const,
    timestamp: new Date().toISOString(),
    gitSha,
    promptVersion,
    model,
    caseId: evalCase.id,
    caseTitle: evalCase.title,
    run,
    pipeline,
    durationMs: Date.now() - startedAt,
  };
}

async function runSurface(
  evalCase: AuthoringEvalCase,
  run: number,
  options: RunnerOptions,
  gitSha: string,
): Promise<EvalResult> {
  const startedAt = Date.now();
  try {
    const authored = await compileHumanIntent(evalCase.brief);
    const data = getDemoFixture(evalCase.fixture);
    const html = renderToStaticMarkup(
      <SurfaceRenderer surface={authored.surface} data={data} />,
    );
    const snapshot = createAgentSnapshot(authored.surface, data);
    const markdown = snapshotToMarkdown(snapshot);
    const intentScore = scoreIntent(evalCase, authored.intent);
    const surfaceScore = scoreSurface(
      evalCase,
      authored.intent,
      authored.surface,
    );
    const htmlScore = scoreHtml(evalCase, html);
    const consumption: ConsumptionResult[] = [];

    if (options.consumption) {
      const resources: Record<Modality, string> = {
        html,
        json: JSON.stringify(snapshot),
        markdown,
      };
      for (const modality of options.modalities) {
        consumption.push(
          await runConsumptionEval({
            evalCase,
            modality,
            resource: resources[modality],
            model: options.model,
          }),
        );
      }
    }

    const passed =
      intentScore.card.score === 1 &&
      surfaceScore.card.score === 1 &&
      htmlScore.card.score === 1;

    return {
      ...baseResult({
        evalCase,
        run,
        pipeline: "surface",
        model: options.model,
        promptVersion: SURFACE_PROMPT_VERSION,
        gitSha,
        startedAt,
      }),
      status: passed ? "passed" : "failed",
      metrics: {
        intentRequirementRecall: intentScore.requirementRecall,
        intentRequirementPrecision: intentScore.requirementPrecision,
        intentScenarioRecall: intentScore.scenarioRecall,
        contractPassed: surfaceScore.contractPassed,
        componentFit: surfaceScore.componentFit,
        actionSafety: Math.min(
          surfaceScore.actionSafety,
          htmlScore.actionSafety,
        ),
        htmlScore: htmlScore.card.score,
        consumptionAccuracy: consumptionAccuracy(consumption),
        repairTurns: authored.authoring.repairTurns,
        firstPassFailedChecks: authored.authoring.firstPassFailedChecks,
        inputTokens: authored.authoring.inputTokens,
        outputTokens: authored.authoring.outputTokens,
        totalTokens: authored.authoring.totalTokens,
      },
      checks: {
        intent: intentScore.card,
        surface: surfaceScore.card,
        html: htmlScore.card,
      },
      consumption,
      error: null,
      artifacts: {
        intent: authored.intent,
        surface: authored.surface,
        html,
        snapshot,
        markdown,
      },
    };
  } catch (error) {
    return {
      ...baseResult({
        evalCase,
        run,
        pipeline: "surface",
        model: options.model,
        promptVersion: SURFACE_PROMPT_VERSION,
        gitSha,
        startedAt,
      }),
      status: "error",
      metrics: errorMetrics(),
      checks: { intent: null, surface: null, html: emptyCard() },
      consumption: [],
      error: error instanceof Error ? error.message : "Unknown Surface error",
      artifacts: {},
    };
  }
}

async function runDirectReact(
  evalCase: AuthoringEvalCase,
  run: number,
  options: RunnerOptions,
  gitSha: string,
): Promise<EvalResult> {
  const startedAt = Date.now();
  try {
    const data = getDemoFixture(evalCase.fixture);
    const generation = await generateDirectReact(evalCase, data, options.model);
    const html = await renderGeneratedReact(generation.source, data);
    const htmlScore = scoreHtml(evalCase, html);
    const consumption: ConsumptionResult[] = [];

    if (options.consumption && options.modalities.includes("html")) {
      consumption.push(
        await runConsumptionEval({
          evalCase,
          modality: "html",
          resource: html,
          model: options.model,
        }),
      );
    }

    return {
      ...baseResult({
        evalCase,
        run,
        pipeline: "direct-react",
        model: options.model,
        promptVersion: DIRECT_REACT_PROMPT_VERSION,
        gitSha,
        startedAt,
      }),
      status: htmlScore.card.score === 1 ? "passed" : "failed",
      metrics: {
        intentRequirementRecall: null,
        intentRequirementPrecision: null,
        intentScenarioRecall: null,
        contractPassed: null,
        componentFit: null,
        actionSafety: htmlScore.actionSafety,
        htmlScore: htmlScore.card.score,
        consumptionAccuracy: consumptionAccuracy(consumption),
        repairTurns: null,
        firstPassFailedChecks: null,
        inputTokens: generation.usage.inputTokens,
        outputTokens: generation.usage.outputTokens,
        totalTokens: generation.usage.totalTokens,
      },
      checks: { intent: null, surface: null, html: htmlScore.card },
      consumption,
      error: null,
      artifacts: {
        source: generation.source,
        rationale: generation.rationale,
        html,
      },
    };
  } catch (error) {
    return {
      ...baseResult({
        evalCase,
        run,
        pipeline: "direct-react",
        model: options.model,
        promptVersion: DIRECT_REACT_PROMPT_VERSION,
        gitSha,
        startedAt,
      }),
      status: "error",
      metrics: errorMetrics(),
      checks: { intent: null, surface: null, html: emptyCard() },
      consumption: [],
      error:
        error instanceof Error ? error.message : "Unknown direct React error",
      artifacts: {},
    };
  }
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const allCases = loadPublicEvalCases();
  const cases =
    options.caseIds.length === 0
      ? allCases
      : allCases.filter((evalCase) => options.caseIds.includes(evalCase.id));
  const missingCases = options.caseIds.filter(
    (caseId) => !allCases.some((evalCase) => evalCase.id === caseId),
  );
  if (missingCases.length > 0) {
    throw new Error(`Unknown case IDs: ${missingCases.join(", ")}`);
  }

  const paths = outputPaths(options.output);
  await mkdir(path.dirname(paths.jsonl), { recursive: true });
  await writeFile(paths.jsonl, "", "utf8");

  const gitSha = gitRevision();
  const results: EvalResult[] = [];
  const pipelines: EvalResult["pipeline"][] =
    options.pipeline === "both"
      ? ["surface", "direct-react"]
      : [options.pipeline];

  console.log(
    `Running ${cases.length} case(s) × ${options.runs} run(s) × ${pipelines.length} pipeline(s) with ${options.model}.`,
  );

  for (const evalCase of cases) {
    for (let run = 1; run <= options.runs; run += 1) {
      for (const pipeline of pipelines) {
        process.stdout.write(`- ${evalCase.id} / run ${run} / ${pipeline} ... `);
        const result =
          pipeline === "surface"
            ? await runSurface(evalCase, run, options, gitSha)
            : await runDirectReact(evalCase, run, options, gitSha);
        results.push(result);
        await appendFile(paths.jsonl, `${JSON.stringify(result)}\n`, "utf8");
        console.log(`${result.status} (${result.durationMs} ms)`);
      }
    }
  }

  const generatedAt = new Date().toISOString();
  await writeFile(
    paths.markdown,
    generateMarkdownReport(results, {
      generatedAt,
      model: options.model,
      gitSha,
      resultsPath: paths.jsonl,
    }),
    "utf8",
  );
  console.log(`Evidence: ${paths.jsonl}`);
  console.log(`Report: ${paths.markdown}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
