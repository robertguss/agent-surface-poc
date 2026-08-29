// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  renderGeneratedReact,
  validateGeneratedSource,
} from "@/evals/baseline";

const safeSource = `function GeneratedPage({ data }) {
  return (
    <main
      data-agent-summary="Refund review"
      data-desktop-capability="interactive"
      data-mobile-capability="read-only"
    >
      <h1>{data.refund.id}</h1>
      <button
        data-action-id="refund.approve"
        data-action-variant="primary"
        data-action-inputs={JSON.stringify({ refundId: data.refund.id })}
        data-requires-confirmation="false"
      >
        Approve refund
      </button>
    </main>
  );
}`;

describe("sandboxed direct React baseline", () => {
  it("bundles and renders safe generated JSX in a restricted child process", async () => {
    const html = await renderGeneratedReact(safeSource, {
      refund: { id: "ref_test" },
    });

    expect(html).toContain("ref_test");
    expect(html).toContain('data-action-id="refund.approve"');
    expect(html).toContain(
      'data-action-inputs="{&quot;refundId&quot;:&quot;ref_test&quot;}"',
    );
  });

  it("rejects generated source that can access external capabilities", () => {
    expect(() =>
      validateGeneratedSource(
        "function GeneratedPage({ data }) { fetch(data.url); return <main />; }",
      ),
    ).toThrow(/network access/);
    expect(() =>
      validateGeneratedSource(
        "function GeneratedPage({ data }) { return <main>{process.env.SECRET}</main>; }",
      ),
    ).toThrow(/process access/);
  });
});
