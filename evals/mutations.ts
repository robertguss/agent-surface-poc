import { compileContract } from "@/lib/compiler";
import { getDemoFixture } from "@/lib/domain";
import { sampleIntentSpec, sampleSurfaceSpec } from "@/lib/sample";
import type { IntentSpec, SurfaceSpec } from "@/lib/schemas";

export interface MutationResult {
  id: string;
  safetyCritical: boolean;
  caught: boolean;
  failedChecks: string[];
}

interface Mutation {
  id: string;
  safetyCritical: boolean;
  intent: IntentSpec;
  surface: SurfaceSpec;
  mutate(surface: SurfaceSpec): void;
}

const queueIntent: IntentSpec = {
  version: "0.1",
  title: "Pending queue",
  audience: ["support-lead"],
  goal: "Review pending refunds in operational priority order.",
  requirements: [
    {
      id: "Q1",
      statement: "Only pending refunds are shown.",
      kind: "collection-filter",
      fields: ["queue.status"],
      actionId: null,
      viewport: "all",
      policy: "equals:pending",
    },
    {
      id: "Q2",
      statement: "Oldest and then highest-value refunds are shown first.",
      kind: "collection-order",
      fields: ["queue.ageDays", "queue.amount"],
      actionId: null,
      viewport: "all",
      policy: "descending",
    },
    {
      id: "Q3",
      statement: "The queue exposes no actions.",
      kind: "action-absence",
      fields: [],
      actionId: null,
      viewport: "all",
      policy: null,
    },
    {
      id: "Q4",
      statement: "Mobile is read-only.",
      kind: "responsive-capability",
      fields: [],
      actionId: null,
      viewport: "mobile",
      policy: "read-only",
    },
  ],
  scenarios: [
    {
      id: "QS1",
      title: "No actions are exposed",
      fixture: "pending-authorized-lead",
      whenActionId: null,
      expectations: ["no-actions-exposed"],
    },
  ],
  assumptions: [],
};

const queueSurface: SurfaceSpec = {
  version: "0.1",
  id: "pending-queue",
  title: "Pending refunds",
  description: "Pending refunds ordered for review.",
  layout: "queue",
  capabilities: { desktop: "read-only", mobile: "read-only" },
  sections: [
    {
      kind: "data-table",
      id: "refund-queue",
      title: "Pending refunds",
      selectionReason: "A table exposes a filterable, ordered collection.",
      satisfies: ["Q1", "Q2", "Q3", "Q4"],
      source: "queue",
      columns: [
        { id: "customer", label: "Customer", path: "customer", format: "text", emphasis: "strong" },
        { id: "amount", label: "Amount", path: "amount", format: "currency", emphasis: "normal" },
        { id: "status", label: "Status", path: "status", format: "status", emphasis: "normal" },
        { id: "age", label: "Age", path: "ageDays", format: "number", emphasis: "normal" },
      ],
      sort: [
        { path: "ageDays", direction: "descending" },
        { path: "amount", direction: "descending" },
      ],
      filters: [{ path: "status", operator: "equals", value: "pending" }],
    },
  ],
};

function sampleMutation(
  id: string,
  safetyCritical: boolean,
  mutate: Mutation["mutate"],
): Mutation {
  return {
    id,
    safetyCritical,
    intent: sampleIntentSpec,
    surface: sampleSurfaceSpec,
    mutate,
  };
}

function queueMutation(
  id: string,
  safetyCritical: boolean,
  mutate: Mutation["mutate"],
): Mutation {
  return { id, safetyCritical, intent: queueIntent, surface: queueSurface, mutate };
}

const mutations: Mutation[] = [
  sampleMutation("invalid-field-path", false, (surface) => {
    const record = surface.sections.find((section) => section.kind === "record-detail");
    if (record?.kind === "record-detail") record.fields[0].path = "refund.missing";
  }),
  sampleMutation("missing-requirement-trace", false, (surface) => {
    const record = surface.sections.find((section) => section.kind === "record-detail");
    if (record) record.satisfies = record.satisfies.filter((id) => id !== "R1");
  }),
  sampleMutation("wrong-timeline-direction", false, (surface) => {
    const timeline = surface.sections.find((section) => section.kind === "timeline");
    if (timeline?.kind === "timeline") timeline.direction = "ascending";
  }),
  sampleMutation("wrong-mobile-capability", true, (surface) => {
    surface.capabilities.mobile = "interactive";
  }),
  sampleMutation("duplicate-stable-id", false, (surface) => {
    surface.sections[1].id = surface.sections[0].id;
  }),
  sampleMutation("primary-action-demoted", true, (surface) => {
    const decision = surface.sections.find((section) => section.kind === "decision-panel");
    const approve = decision?.kind === "decision-panel"
      ? decision.actions.find((action) => action.actionId === "refund.approve")
      : undefined;
    if (approve) approve.variant = "secondary";
  }),
  sampleMutation("required-action-removed", true, (surface) => {
    const decision = surface.sections.find((section) => section.kind === "decision-panel");
    if (decision?.kind === "decision-panel") {
      decision.actions = decision.actions.filter(
        (action) => action.actionId !== "refund.approve",
      );
    }
  }),
  sampleMutation("action-input-name-changed", true, (surface) => {
    const decision = surface.sections.find((section) => section.kind === "decision-panel");
    if (decision?.kind === "decision-panel") {
      decision.actions[0].inputBindings[0].input = "orderId";
    }
  }),
  sampleMutation("action-input-path-changed", true, (surface) => {
    const decision = surface.sections.find((section) => section.kind === "decision-panel");
    if (decision?.kind === "decision-panel") {
      decision.actions[0].inputBindings[0].path = "refund.unknown";
    }
  }),
  queueMutation("collection-filter-changed", false, (surface) => {
    const table = surface.sections[0];
    if (table.kind === "data-table") table.filters[0].value = "escalated";
  }),
  queueMutation("collection-order-changed", false, (surface) => {
    const table = surface.sections[0];
    if (table.kind === "data-table") table.sort.reverse();
  }),
  queueMutation("forbidden-action-added", true, (surface) => {
    surface.sections.push({
      kind: "decision-panel",
      id: "forbidden-decision",
      title: "Decision",
      selectionReason: "This mutation intentionally violates read-only intent.",
      satisfies: [],
      description: "A forbidden action.",
      actions: [
        {
          id: "forbidden-approve",
          actionId: "refund.approve",
          variant: "primary",
          inputBindings: [{ input: "refundId", path: "refund.id" }],
          satisfies: [],
        },
      ],
    });
  }),
];

export function runMutationSuite(): MutationResult[] {
  return mutations.map((mutation) => {
    const baseline = compileContract(
      mutation.intent,
      mutation.surface,
      getDemoFixture("pending-authorized-lead"),
    );
    if (baseline.status !== "passed") {
      throw new Error(`Mutation baseline ${mutation.id} is invalid.`);
    }

    const candidate = structuredClone(mutation.surface);
    mutation.mutate(candidate);
    const report = compileContract(
      mutation.intent,
      candidate,
      getDemoFixture("pending-authorized-lead"),
    );
    return {
      id: mutation.id,
      safetyCritical: mutation.safetyCritical,
      caught: report.status === "failed",
      failedChecks: report.checks
        .filter((check) => !check.passed)
        .map((check) => check.id),
    };
  });
}

function main() {
  const results = runMutationSuite();
  for (const result of results) {
    console.log(
      `${result.caught ? "CAUGHT" : "ESCAPED"} ${result.id}${result.safetyCritical ? " [safety]" : ""}: ${result.failedChecks.join(", ") || "no failing checks"}`,
    );
  }
  const caught = results.filter((result) => result.caught).length;
  const safetyEscapes = results.filter(
    (result) => result.safetyCritical && !result.caught,
  );
  console.log(`Caught ${caught}/${results.length} mutations.`);
  if (caught !== results.length || safetyEscapes.length > 0) {
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
