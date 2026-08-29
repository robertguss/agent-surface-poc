import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SurfaceRenderer } from "@/components/surface-renderer";
import { getDemoFixture } from "@/lib/domain";
import { sampleSurfaceSpec } from "@/lib/sample";

describe("surface behavior", () => {
  it("renders semantic structure and shared action identifiers", () => {
    render(<SurfaceRenderer surface={sampleSurfaceSpec} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Refund review" }),
    ).toBeInTheDocument();
    expect(screen.getByText("$284.50")).toHaveAttribute(
      "data-raw-value",
      "284.5",
    );
    expect(screen.getByRole("button", { name: "Approve refund" })).toHaveAttribute(
      "data-action-id",
      "refund.approve",
    );
  });

  it("hydrates independently of browser date-format punctuation", () => {
    const serverHtml = renderToString(
      <SurfaceRenderer surface={sampleSurfaceSpec} />,
    );
    const container = document.createElement("div");
    container.innerHTML = serverHtml;
    document.body.append(container);
    const dateFormatter = vi
      .spyOn(Intl, "DateTimeFormat")
      .mockImplementation(
        () =>
          ({ format: () => "Feb 11, 2026 at 10:00 AM" }) as Intl.DateTimeFormat,
      );
    const recoverableErrors: unknown[] = [];
    let unmount: (() => void) | undefined;

    try {
      unmount = render(<SurfaceRenderer surface={sampleSurfaceSpec} />, {
        container,
        hydrate: true,
        onRecoverableError: (error) => recoverableErrors.push(error),
      }).unmount;
      expect(recoverableErrors).toEqual([]);
      expect(container.querySelector("time")?.textContent).toBe(
        "Feb 11, 2026, 10:00 AM UTC",
      );
    } finally {
      unmount?.();
      dateFormatter.mockRestore();
      container.remove();
    }
  });

  it("does not dispatch a destructive action before confirmation", async () => {
    const user = userEvent.setup();
    render(<SurfaceRenderer surface={sampleSurfaceSpec} />);

    await user.click(screen.getByRole("button", { name: "Deny refund" }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(
      screen.queryByText("Deny refund command dispatched."),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(
      screen.getByText("Deny refund command dispatched."),
    ).toBeInTheDocument();
  });

  it("exposes why an unauthorized action is unavailable", () => {
    render(
      <SurfaceRenderer
        surface={sampleSurfaceSpec}
        data={getDemoFixture("pending-unauthorized-agent")}
      />,
    );

    const approve = screen.getByRole("button", { name: "Approve refund" });
    expect(approve).toBeDisabled();
    expect(
      screen.getAllByText("Your current role does not permit this action.")
        .length,
    ).toBeGreaterThan(0);
  });
});
