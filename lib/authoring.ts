import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { catalogForPrompt } from "@/lib/catalog";
import { compileContract } from "@/lib/compiler";
import { refundDomainDescription } from "@/lib/domain";
import {
  IntentSpecSchema,
  SurfaceSpecSchema,
  type IntentSpec,
  type SurfaceSpec,
} from "@/lib/schemas";

export const SURFACE_PROMPT_VERSION = "surface-authoring-v3";

interface UsageAccumulator {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  observed: boolean;
}

function recordUsage(
  usage: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  } | null | undefined,
  accumulator?: UsageAccumulator,
) {
  if (!usage || !accumulator) {
    return;
  }

  accumulator.inputTokens += usage.input_tokens ?? 0;
  accumulator.outputTokens += usage.output_tokens ?? 0;
  accumulator.totalTokens += usage.total_tokens ?? 0;
  accumulator.observed = true;
}

const intentSystemPrompt = `You translate a human UI brief into an executable IntentSpec.

Preserve the human's desired outcome rather than prematurely choosing visual components.
Requirements must be objective enough for a compiler to check. Assign stable IDs R1, R2,
and so on. Use exact domain field paths and registered action IDs. Do not invent data,
actions, roles, or behavior fixtures. If the human leaves a material detail unresolved,
record it as an assumption rather than silently expanding the product.

Requirement kind guidance:
- information-visible: one or more exact fields must be rendered.
- information-prominent: exact fields need emphasized or alert treatment.
- chronological: use this for a history or event collection rendered as a Timeline. Put
  the collection source in fields and set policy to ascending or descending. Do not split
  timeline direction into a separate collection-order requirement.
- collection-order: a DataTable needs explicit sort priority. Put full sort-key paths in
  fields in priority order and set policy to ascending or descending.
- collection-filter: a DataTable must filter a collection. Put the full filtered path in
  fields and set policy to the controlled syntax equals:<value>.
- action-primary: use when the action must be primary; actionId names that action.
- action-confirmation: actionId must require confirmation.
- action-availability: use when an action must be present, available, secondary, or reflect
  permissions; actionId names that action. Never encode a requested action as
  information-visible because actions are not data fields.
- action-absence: the surface must expose no actions. actionId must be null.
- responsive-capability: set viewport and policy to interactive or read-only.

Scenarios normally use one available fixture and one registered action. Only add scenarios
that the human stated or that directly verify a stated safety requirement. A scenario may
verify action absence, but that scenario has exactly one legal shape: whenActionId is null
and expectations contains only no-actions-exposed. Never use action-unavailable or
disabled-reason-exposed for an absent action; those describe a visible disabled control.

${refundDomainDescription}`;

function surfaceSystemPrompt(intent: IntentSpec): string {
  return `You are a UI planning agent. Compile the supplied IntentSpec into a constrained
SurfaceSpec using only the catalog and domain below. Choose components by semantic fit,
not visual novelty. React, CSS, and arbitrary markup are not available.

Every requirement must be traced through a section or action satisfies array. Tracing is
not enough: the chosen component must semantically fulfill the requirement. Use exact
root field paths for RecordDetail, MetricGroup, and Alert. For DataTable and Timeline,
use a root collection source and item-relative field paths. Bind every registered action
input to an existing root data path. Use the action registry's meaning and confirmation
policy; never redefine either in the surface.

For DataTable, sort entries are item-relative paths in priority order. Leave sort empty only
when ordering is not part of the intent. For example, a queue ordered by oldest then highest
value uses source "queue" and sort paths "ageDays" then "amount", both descending.
Filters use item-relative paths and an explicit equality value. Leave filters empty when the
intent does not constrain which records appear.

Use the fewest components that fully satisfy the intent. Do not add a DecisionPanel or
any action when the intent says the surface is review-only or has no actions. A responsive
capability requirement can be traced by any relevant section; it does not require an action.

Component-to-kind mapping:
- RecordDetail -> record-detail
- Alert -> alert
- Timeline -> timeline
- DataTable -> data-table
- MetricGroup -> metric-group
- DecisionPanel -> decision-panel

COMPONENT CATALOG
${catalogForPrompt()}

DOMAIN
${refundDomainDescription}

INTENT SPEC
${JSON.stringify(intent, null, 2)}`;
}

function createClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is required to compile new natural-language intent.",
    );
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function interpretIntent(
  humanIntent: string,
  usage?: UsageAccumulator,
): Promise<IntentSpec> {
  const client = createClient();
  const response = await client.responses.parse({
    model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
    instructions: intentSystemPrompt,
    input: humanIntent,
    text: {
      format: zodTextFormat(IntentSpecSchema, "intent_spec"),
    },
  });
  recordUsage(response.usage, usage);

  if (!response.output_parsed) {
    throw new Error("The authoring agent did not return a valid IntentSpec.");
  }

  return response.output_parsed;
}

export async function planSurface(
  intent: IntentSpec,
  usage?: UsageAccumulator,
): Promise<SurfaceSpec> {
  const client = createClient();
  const response = await client.responses.parse({
    model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
    instructions: surfaceSystemPrompt(intent),
    input: "Produce the SurfaceSpec and preserve requirement traceability.",
    text: {
      format: zodTextFormat(SurfaceSpecSchema, "surface_spec"),
    },
  });
  recordUsage(response.usage, usage);

  if (!response.output_parsed) {
    throw new Error("The planning agent did not return a valid SurfaceSpec.");
  }

  return response.output_parsed;
}

async function repairSurface(
  intent: IntentSpec,
  attemptedSurface: SurfaceSpec,
  usage?: UsageAccumulator,
): Promise<SurfaceSpec> {
  const report = compileContract(intent, attemptedSurface);
  const failures = report.checks
    .filter((check) => !check.passed)
    .map((check) => ({
      id: check.id,
      kind: check.kind,
      message: check.message,
      evidence: check.evidence,
    }));
  const client = createClient();
  const response = await client.responses.parse({
    model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
    instructions: `${surfaceSystemPrompt(intent)}

The previous SurfaceSpec failed deterministic compiler checks. Return a corrected full
SurfaceSpec. Do not change or weaken the IntentSpec. Do not hide a failure by removing a
requirement trace. Remove unnecessary components and use only valid domain bindings.

FAILED CHECKS
${JSON.stringify(failures, null, 2)}`,
    input: JSON.stringify(attemptedSurface, null, 2),
    text: {
      format: zodTextFormat(SurfaceSpecSchema, "repaired_surface_spec"),
    },
  });
  recordUsage(response.usage, usage);

  if (!response.output_parsed) {
    throw new Error("The planning agent did not return a repaired SurfaceSpec.");
  }

  return response.output_parsed;
}

export async function compileHumanIntent(humanIntent: string) {
  const usage: UsageAccumulator = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    observed: false,
  };
  const intent = await interpretIntent(humanIntent, usage);
  const firstSurface = await planSurface(intent, usage);
  const firstReport = compileContract(intent, firstSurface);
  const surface =
    firstReport.status === "failed"
      ? await repairSurface(intent, firstSurface, usage)
      : firstSurface;

  return {
    intent,
    surface,
    authoring: {
      repairTurns: firstReport.status === "failed" ? 1 : 0,
      firstPassFailedChecks: firstReport.summary.failed,
      inputTokens: usage.observed ? usage.inputTokens : null,
      outputTokens: usage.observed ? usage.outputTokens : null,
      totalTokens: usage.observed ? usage.totalTokens : null,
    },
  };
}
