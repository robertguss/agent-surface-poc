import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { build } from "esbuild";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

import { refundActions, refundDomainDescription } from "@/lib/domain";
import type { AuthoringEvalCase, ModelUsage } from "./types";

export const DIRECT_REACT_PROMPT_VERSION = "direct-react-v3";

const execFileAsync = promisify(execFile);

const directReactOutputSchema = z.object({
  source: z.string(),
  rationale: z.string(),
});

const forbiddenSourcePatterns = [
  { label: "imports", pattern: /\bimport\s*(?:\(|[\s{"'*])/u },
  { label: "exports", pattern: /\bexport\b/u },
  { label: "CommonJS imports", pattern: /\brequire\s*\(/u },
  { label: "process access", pattern: /\bprocess\b/u },
  { label: "global access", pattern: /\bglobalThis\b/u },
  { label: "network access", pattern: /\b(?:fetch|XMLHttpRequest|WebSocket)\b/u },
  { label: "dynamic evaluation", pattern: /\b(?:eval|Function)\b/u },
  { label: "browser globals", pattern: /\b(?:window|document)\b/u },
];

export interface DirectReactGeneration {
  source: string;
  rationale: string;
  model: string;
  usage: ModelUsage;
}

function usageFromResponse(response: {
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  } | null;
}): ModelUsage {
  return {
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
    totalTokens: response.usage?.total_tokens ?? null,
  };
}

export function validateGeneratedSource(source: string): void {
  if (source.length > 50_000) {
    throw new Error("Generated React source exceeds the 50 KB limit.");
  }

  if (!/\bfunction\s+GeneratedPage\s*\(\s*\{\s*data\s*\}\s*\)/u.test(source)) {
    throw new Error(
      "Generated React source must define function GeneratedPage({ data }).",
    );
  }

  for (const forbidden of forbiddenSourcePatterns) {
    if (forbidden.pattern.test(source)) {
      throw new Error(`Generated React source contains forbidden ${forbidden.label}.`);
    }
  }
}

export async function generateDirectReact(
  evalCase: AuthoringEvalCase,
  data: Record<string, unknown>,
  model = process.env.OPENAI_MODEL ?? "gpt-5-mini",
): Promise<DirectReactGeneration> {
  const client = new OpenAI();
  const response = await client.responses.parse({
    model,
    input: [
      {
        role: "system",
        content: `You author a production-quality React interface from a human brief.

Return JSX source that defines exactly one entry function named GeneratedPage({ data }). Do not import or export anything. React is already in scope. You may define small local helpers inside GeneratedPage. Do not access browser or server globals, perform I/O, or use external packages.

Render semantic, accessible HTML with a polished but restrained visual hierarchy. Preserve all information, ordering, filtering, action-safety, and responsive-capability intent in the brief. Use buttons for actions. Render only action IDs explicitly requested by the brief; the registry is a list of possibilities, not a request to expose every action.

Machine-readable HTML contract:
- The root <main> or <article> must include data-agent-summary, data-desktop-capability, and data-mobile-capability. Capability values must be exactly "interactive" or "read-only".
- Semantic regions should use native HTML and one of these data-component values when applicable: record-detail, metric-group, alert, data-table, timeline, decision-panel.
- Alerts must use role="alert" or role="status". Chronological timelines must use an <ol> with a <time dateTime="..."> for each event.
- Every action button must include data-action-id, data-action-variant as "primary", "secondary", or "destructive", data-action-inputs containing a JSON object, and data-requires-confirmation as "true" or "false".
- Render exactly one element for each action ID; do not duplicate action controls for desktop and mobile.
- Unavailable actions must be disabled and expose the disabled reason in visible text or an accessible description.
- Use stable UTC formatting for timestamps.`,
      },
      {
        role: "user",
        content: `Human brief:
${evalCase.brief}

Available domain catalog:
${refundDomainDescription}

Action registry:
${JSON.stringify(refundActions, null, 2)}

Runtime fixture data:
${JSON.stringify(data, null, 2)}`,
      },
    ],
    text: {
      format: zodTextFormat(
        directReactOutputSchema,
        `surface_direct_react_${DIRECT_REACT_PROMPT_VERSION}`,
      ),
    },
  });

  if (!response.output_parsed) {
    throw new Error("The direct React baseline returned no parsed output.");
  }

  validateGeneratedSource(response.output_parsed.source);

  return {
    ...response.output_parsed,
    model,
    usage: usageFromResponse(response),
  };
}

export async function renderGeneratedReact(
  source: string,
  data: Record<string, unknown>,
): Promise<string> {
  validateGeneratedSource(source);

  const directory = await mkdtemp(path.join(tmpdir(), "surface-react-eval-"));
  const entryPath = path.join(directory, "entry.tsx");
  const bundlePath = path.join(directory, "bundle.cjs");
  const serializedData = JSON.stringify(data).replaceAll("<", "\\u003c");

  try {
    await writeFile(
      entryPath,
      `import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

${source}

const data = ${serializedData};
const html = renderToStaticMarkup(React.createElement(GeneratedPage, { data }));
process.stdout.write(html);`,
      "utf8",
    );

    await build({
      entryPoints: [entryPath],
      outfile: bundlePath,
      bundle: true,
      platform: "node",
      format: "cjs",
      jsx: "automatic",
      logLevel: "silent",
      nodePaths: [path.join(process.cwd(), "node_modules")],
    });

    const { stdout } = await execFileAsync(
      process.execPath,
      ["--permission", `--allow-fs-read=${bundlePath}`, bundlePath],
      {
        cwd: directory,
        encoding: "utf8",
        env: {
          PATH: process.env.PATH ?? "",
          NODE_ENV: process.env.NODE_ENV ?? "production",
          NODE_NO_WARNINGS: "1",
        },
        maxBuffer: 2 * 1024 * 1024,
        timeout: 5_000,
      },
    );

    return stdout;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
