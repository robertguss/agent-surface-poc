import { describe, expect, it } from "vitest";

import {
  createAgentSnapshot,
  displayValue,
  snapshotToMarkdown,
} from "@/lib/projections";
import { sampleSurfaceSpec } from "@/lib/sample";

describe("agent projections", () => {
  it("preserves raw values and human display values", () => {
    const snapshot = createAgentSnapshot(sampleSurfaceSpec);
    const record = snapshot.sections.find(
      (section) => section.kind === "record",
    );
    const fields = record?.fields as Array<Record<string, unknown>>;
    const amount = fields.find((field) => field.path === "refund.amount");

    expect(amount).toMatchObject({
      raw: 284.5,
      display: "$284.50",
    });
  });

  it("does not expose a disabled reason for an available action", () => {
    const snapshot = createAgentSnapshot(sampleSurfaceSpec);
    const actions = snapshot.sections.find(
      (section) => section.kind === "actions",
    )?.actions as Array<Record<string, unknown>>;

    expect(actions.find((action) => action.actionId === "refund.approve"))
      .toMatchObject({ enabled: true, disabledReason: null });
  });

  it("formats SSR dates deterministically in UTC", () => {
    expect(displayValue("2026-02-11T10:00:00Z", "date")).toBe(
      "Feb 11, 2026, 10:00 AM UTC",
    );
  });

  it("derives Markdown from the canonical snapshot", () => {
    const markdown = snapshotToMarkdown(
      createAgentSnapshot(sampleSurfaceSpec),
    );

    expect(markdown).toContain("# Refund review");
    expect(markdown).toContain("**Refund amount:** $284.50");
    expect(markdown).toContain("**Deny refund** — available; confirmation required");
  });
});
