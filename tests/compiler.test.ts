import { describe, expect, it } from "vitest";

import { compileContract } from "@/lib/compiler";
import { sampleIntentSpec, sampleSurfaceSpec } from "@/lib/sample";
import type { IntentSpec, SurfaceSpec } from "@/lib/schemas";

describe("executable UI contract", () => {
  it("proves the sample surface satisfies its requirements and scenarios", () => {
    const report = compileContract(sampleIntentSpec, sampleSurfaceSpec);

    expect(report.status).toBe("passed");
    expect(report.summary.failed).toBe(0);
    expect(
      report.checks.filter((check) => check.kind === "requirement"),
    ).toHaveLength(sampleIntentSpec.requirements.length);
    expect(
      report.checks.filter((check) => check.kind === "scenario"),
    ).toHaveLength(sampleIntentSpec.scenarios.length);
  });

  it("fails when visible information from the intent is omitted", () => {
    const surface = structuredClone(sampleSurfaceSpec);
    const record = surface.sections.find(
      (section) => section.kind === "record-detail",
    );
    if (record?.kind === "record-detail") {
      record.fields = record.fields.filter(
        (field) => field.path !== "order.status",
      );
    }

    const report = compileContract(sampleIntentSpec, surface);
    const requirement = report.checks.find((check) => check.id === "R1");

    expect(report.status).toBe("failed");
    expect(requirement?.passed).toBe(false);
    expect(requirement?.message).toContain("semantic contract not met");
  });

  it("fails when the mobile capability contradicts the intent", () => {
    const surface = structuredClone(sampleSurfaceSpec);
    surface.capabilities.mobile = "interactive";

    const report = compileContract(sampleIntentSpec, surface);

    expect(report.checks.find((check) => check.id === "R6")?.passed).toBe(
      false,
    );
  });

  it("fails behavior scenarios when their action is not bound", () => {
    const surface = structuredClone(sampleSurfaceSpec);
    const decision = surface.sections.find(
      (section) => section.kind === "decision-panel",
    );
    if (decision?.kind === "decision-panel") {
      decision.actions = decision.actions.filter(
        (action) => action.actionId !== "refund.deny",
      );
    }

    const report = compileContract(sampleIntentSpec, surface);

    expect(report.checks.find((check) => check.id === "S2")?.passed).toBe(
      false,
    );
  });

  it("enforces collection filters, sort priority, and action absence", () => {
    const intent: IntentSpec = {
      version: "0.1",
      title: "Pending refund queue",
      audience: ["support-lead"],
      goal: "Review the oldest pending refunds first.",
      requirements: [
        {
          id: "R1",
          statement: "Only show pending refunds.",
          kind: "collection-filter",
          fields: ["queue.status"],
          actionId: null,
          viewport: "all",
          policy: "equals:pending",
        },
        {
          id: "R2",
          statement: "Order by age and amount descending.",
          kind: "collection-order",
          fields: ["queue.ageDays", "queue.amount"],
          actionId: null,
          viewport: "all",
          policy: "descending",
        },
        {
          id: "R3",
          statement: "Expose no actions.",
          kind: "action-absence",
          fields: [],
          actionId: null,
          viewport: "all",
          policy: null,
        },
      ],
      scenarios: [
        {
          id: "S1",
          title: "No actions are exposed",
          fixture: "pending-authorized-lead",
          whenActionId: null,
          expectations: ["no-actions-exposed"],
        },
      ],
      assumptions: [],
    };
    const surface: SurfaceSpec = {
      version: "0.1",
      id: "pending-refunds",
      title: "Pending refunds",
      description: "Review pending requests.",
      layout: "queue",
      capabilities: { desktop: "read-only", mobile: "read-only" },
      sections: [
        {
          kind: "data-table",
          id: "refund-table",
          title: "Requests",
          selectionReason: "The task requires dense comparison.",
          satisfies: ["R1", "R2", "R3"],
          source: "queue",
          columns: [
            {
              id: "status",
              label: "Status",
              path: "status",
              format: "status",
              emphasis: "normal",
            },
          ],
          sort: [
            { path: "ageDays", direction: "descending" },
            { path: "amount", direction: "descending" },
          ],
          filters: [{ path: "status", operator: "equals", value: "pending" }],
        },
      ],
    };

    const report = compileContract(intent, surface);

    expect(report.status).toBe("passed");
    expect(
      report.checks
        .filter((check) => check.kind === "requirement")
        .every((check) => check.passed),
    ).toBe(true);
  });
});
