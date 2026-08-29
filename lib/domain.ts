export type DemoFixtureId =
  | "pending-authorized-lead"
  | "pending-unauthorized-agent"
  | "approved-refund";

export interface ActionDefinition {
  id: string;
  label: string;
  description: string;
  inputFields: string[];
  risk: "routine" | "destructive";
  requiresConfirmation: boolean;
  permissionPath: string | null;
}

export const refundActions: Record<string, ActionDefinition> = {
  "refund.approve": {
    id: "refund.approve",
    label: "Approve refund",
    description: "Approve the pending refund for payment.",
    inputFields: ["refundId"],
    risk: "routine",
    requiresConfirmation: false,
    permissionPath: "actor.permissions.approveRefund",
  },
  "refund.deny": {
    id: "refund.deny",
    label: "Deny refund",
    description: "Deny the refund while keeping the case available for review.",
    inputFields: ["refundId"],
    risk: "destructive",
    requiresConfirmation: true,
    permissionPath: "actor.permissions.denyRefund",
  },
  "refund.request-information": {
    id: "refund.request-information",
    label: "Request information",
    description: "Ask the customer for additional information.",
    inputFields: ["refundId"],
    risk: "routine",
    requiresConfirmation: false,
    permissionPath: "actor.permissions.requestInformation",
  },
  "refund.escalate": {
    id: "refund.escalate",
    label: "Escalate to supervisor",
    description: "Move the refund request to supervisor review.",
    inputFields: ["refundId"],
    risk: "routine",
    requiresConfirmation: false,
    permissionPath: "actor.permissions.escalateRefund",
  },
};

const baseDemoData = {
  refund: {
    id: "ref_2041",
    amount: 284.5,
    reason: "The delivered camera body does not power on.",
    status: "pending",
    requestedAt: "2026-08-27T14:32:00Z",
  },
  order: {
    id: "ord_8193",
    number: "ORD-8193",
    total: 284.5,
    status: "delivered",
    deliveredAt: "2026-08-25T18:10:00Z",
  },
  customer: {
    id: "cus_302",
    name: "Maya Chen",
    accountAgeDays: 914,
    previousRefunds: [
      {
        id: "ref_1781",
        createdAt: "2026-02-11T10:00:00Z",
        reason: "Duplicate shipment",
        outcome: "Approved for $42.00",
      },
      {
        id: "ref_934",
        createdAt: "2024-11-03T09:15:00Z",
        reason: "Package damaged in transit",
        outcome: "Approved for $81.20",
      },
    ],
  },
  fraud: {
    level: "medium",
    score: 42,
    explanation:
      "Refund velocity is above average, but payment and delivery signals are consistent.",
  },
  queue: [
    {
      id: "ref_2041",
      customer: "Maya Chen",
      amount: 284.5,
      status: "pending",
      ageDays: 2,
    },
    {
      id: "ref_2040",
      customer: "Jon Bell",
      amount: 89,
      status: "needs-information",
      ageDays: 4,
    },
    {
      id: "ref_2038",
      customer: "Nia Patel",
      amount: 640,
      status: "escalated",
      ageDays: 6,
    },
  ],
};

export function getDemoFixture(fixture: DemoFixtureId): Record<string, unknown> {
  const authorized = fixture !== "pending-unauthorized-agent";
  const approved = fixture === "approved-refund";

  return structuredClone({
    ...baseDemoData,
    refund: {
      ...baseDemoData.refund,
      status: approved ? "approved" : "pending",
    },
    actor: {
      id: authorized ? "usr_lead_12" : "usr_agent_41",
      role: authorized ? "support-lead" : "support-agent",
      permissions: {
        approveRefund: authorized && !approved,
        denyRefund: authorized && !approved,
        requestInformation: !approved,
        escalateRefund: !approved,
      },
    },
  });
}

export const refundDemoData = getDemoFixture("pending-authorized-lead");

export const refundDomainDescription = `
Available root data and paths:
- refund: id, amount, reason, status, requestedAt
- order: id, number, total, status, deliveredAt
- customer: id, name, accountAgeDays
- customer.previousRefunds is a collection. Item fields: id, createdAt, reason, outcome.
- fraud: level, score, explanation
- queue is a collection. Item fields: id, customer, amount, status, ageDays.
- actor: id, role, permissions

Collection path convention:
- Use the collection itself as a component source, for example "queue".
- Use item-relative column and sort paths, for example "customer" or "ageDays".
- Intent requirement fields use a dotted full path, for example "queue.customer".

Available actions:
${Object.values(refundActions)
  .map(
    (action) =>
      `- ${action.id}: ${action.description} Inputs: ${action.inputFields.join(", ")}. ` +
      `Risk: ${action.risk}. Confirmation: ${action.requiresConfirmation}.`,
  )
  .join("\n")}

Available behavior fixtures:
- pending-authorized-lead
- pending-unauthorized-agent
- approved-refund
`.trim();

export function resolvePath(value: unknown, path: string): unknown {
  if (!path) return value;

  return path.split(".").reduce<unknown>((current, segment) => {
    if (current === null || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}

export function hasPath(value: unknown, path: string): boolean {
  return resolvePath(value, path) !== undefined;
}
