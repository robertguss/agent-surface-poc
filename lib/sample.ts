import type { IntentSpec, SurfaceSpec } from "@/lib/schemas";

export const sampleIntentText = `# Refund review

## Audience
Support leads handling escalated refund requests.

## Goal
Decide whether a refund should be approved without leaving this page.

## Requirements
- Show the refund amount, reason, and order status.
- Show previous refunds chronologically.
- Make fraud warnings visually prominent.
- Approving is the primary action.
- Denying requires confirmation.
- Mobile users can review but cannot make a decision.

## Scenarios

### Approve an eligible refund
Given the refund is pending and the support lead has permission
When the lead approves the refund
Then dispatch the approval command, show pending state, and prevent duplicates.

### Deny a refund
Given the refund is pending
When the lead chooses to deny it
Then show confirmation and do not dispatch until confirmed.

### Unauthorized user
Given the user cannot approve refunds
Then approval is unavailable and the reason is exposed.`;

export const sampleIntentSpec: IntentSpec = {
  version: "0.1",
  title: "Refund review",
  audience: ["support-lead"],
  goal: "Decide whether an escalated refund should be approved.",
  requirements: [
    {
      id: "R1",
      statement: "Show the refund amount, reason, and order status.",
      kind: "information-visible",
      fields: ["refund.amount", "refund.reason", "order.status"],
      actionId: null,
      viewport: "all",
      policy: null,
    },
    {
      id: "R2",
      statement: "Show previous refunds chronologically.",
      kind: "chronological",
      fields: ["customer.previousRefunds"],
      actionId: null,
      viewport: "all",
      policy: "descending",
    },
    {
      id: "R3",
      statement: "Make fraud warnings visually prominent.",
      kind: "information-prominent",
      fields: ["fraud.explanation", "fraud.level"],
      actionId: null,
      viewport: "all",
      policy: "warning",
    },
    {
      id: "R4",
      statement: "Approving is the primary action.",
      kind: "action-primary",
      fields: [],
      actionId: "refund.approve",
      viewport: "desktop",
      policy: "primary",
    },
    {
      id: "R5",
      statement: "Denying requires confirmation.",
      kind: "action-confirmation",
      fields: [],
      actionId: "refund.deny",
      viewport: "desktop",
      policy: "required",
    },
    {
      id: "R6",
      statement: "Mobile users can review but cannot make a decision.",
      kind: "responsive-capability",
      fields: [],
      actionId: null,
      viewport: "mobile",
      policy: "read-only",
    },
  ],
  scenarios: [
    {
      id: "S1",
      title: "Approve an eligible refund",
      fixture: "pending-authorized-lead",
      whenActionId: "refund.approve",
      expectations: [
        "command-dispatched",
        "pending-state",
        "duplicate-submission-prevented",
      ],
    },
    {
      id: "S2",
      title: "Deny a refund",
      fixture: "pending-authorized-lead",
      whenActionId: "refund.deny",
      expectations: [
        "confirmation-visible",
        "command-not-dispatched-before-confirmation",
      ],
    },
    {
      id: "S3",
      title: "Unauthorized user",
      fixture: "pending-unauthorized-agent",
      whenActionId: "refund.approve",
      expectations: ["action-unavailable", "disabled-reason-exposed"],
    },
  ],
  assumptions: [
    "Denying a refund keeps the case open for later review.",
    "Currency values are displayed in USD.",
  ],
};

export const sampleSurfaceSpec: SurfaceSpec = {
  version: "0.1",
  id: "refund-review",
  title: "Refund review",
  description: "Review the request, risk signals, and customer history before deciding.",
  layout: "detail",
  capabilities: {
    desktop: "interactive",
    mobile: "read-only",
  },
  sections: [
    {
      kind: "record-detail",
      id: "request-summary",
      title: "Request summary",
      selectionReason: "A labeled record makes the facts for one refund easy to scan.",
      satisfies: ["R1"],
      fields: [
        {
          id: "refund-amount",
          label: "Refund amount",
          path: "refund.amount",
          format: "currency",
          emphasis: "strong",
        },
        {
          id: "refund-reason",
          label: "Reason",
          path: "refund.reason",
          format: "text",
          emphasis: "normal",
        },
        {
          id: "order-status",
          label: "Order status",
          path: "order.status",
          format: "status",
          emphasis: "normal",
        },
        {
          id: "customer-name",
          label: "Customer",
          path: "customer.name",
          format: "text",
          emphasis: "normal",
        },
      ],
    },
    {
      kind: "alert",
      id: "fraud-warning",
      title: "Risk signal",
      selectionReason: "The intent explicitly requires fraud information to be prominent.",
      satisfies: ["R3"],
      messagePath: "fraud.explanation",
      severityPath: "fraud.level",
    },
    {
      kind: "timeline",
      id: "refund-history",
      title: "Previous refunds",
      selectionReason: "A timeline preserves the requested chronological relationship.",
      satisfies: ["R2"],
      source: "customer.previousRefunds",
      titlePath: "reason",
      detailPath: "outcome",
      timestampPath: "createdAt",
      direction: "descending",
    },
    {
      kind: "decision-panel",
      id: "refund-decision",
      title: "Decision",
      selectionReason: "The page exists to support one consequential approve-or-deny decision.",
      satisfies: ["R4", "R5", "R6"],
      description: "Choose an outcome after reviewing the request and risk signals.",
      actions: [
        {
          id: "approve-refund",
          actionId: "refund.approve",
          variant: "primary",
          inputBindings: [{ input: "refundId", path: "refund.id" }],
          satisfies: ["R4"],
        },
        {
          id: "deny-refund",
          actionId: "refund.deny",
          variant: "destructive",
          inputBindings: [{ input: "refundId", path: "refund.id" }],
          satisfies: ["R5"],
        },
        {
          id: "request-information",
          actionId: "refund.request-information",
          variant: "secondary",
          inputBindings: [{ input: "refundId", path: "refund.id" }],
          satisfies: [],
        },
      ],
    },
  ],
};
