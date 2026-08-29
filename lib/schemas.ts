import { z } from "zod";

export const RequirementKindSchema = z.enum([
  "information-visible",
  "information-prominent",
  "chronological",
  "collection-order",
  "collection-filter",
  "action-primary",
  "action-confirmation",
  "action-availability",
  "action-absence",
  "responsive-capability",
]);

export const ScenarioExpectationSchema = z.enum([
  "confirmation-visible",
  "command-not-dispatched-before-confirmation",
  "command-dispatched",
  "pending-state",
  "duplicate-submission-prevented",
  "action-unavailable",
  "disabled-reason-exposed",
  "no-actions-exposed",
]);

export const IntentRequirementSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  kind: RequirementKindSchema,
  fields: z.array(z.string()),
  actionId: z.string().nullable(),
  viewport: z.enum(["all", "desktop", "mobile"]),
  policy: z.string().nullable(),
});

export const IntentScenarioSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  fixture: z.enum([
    "pending-authorized-lead",
    "pending-unauthorized-agent",
    "approved-refund",
  ]),
  whenActionId: z.string().nullable(),
  expectations: z.array(ScenarioExpectationSchema).min(1),
});

export const IntentSpecSchema = z.object({
  version: z.literal("0.1"),
  title: z.string().min(1),
  audience: z.array(z.string()).min(1),
  goal: z.string().min(1),
  requirements: z.array(IntentRequirementSchema).min(1),
  scenarios: z.array(IntentScenarioSchema),
  assumptions: z.array(z.string()),
});

const BaseSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  selectionReason: z.string().min(1),
  satisfies: z.array(z.string()),
});

export const FieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  path: z.string().min(1),
  format: z.enum(["text", "currency", "date", "status", "number"]),
  emphasis: z.enum(["normal", "strong"]),
});

export const ActionBindingSchema = z.object({
  id: z.string().min(1),
  actionId: z.string().min(1),
  variant: z.enum(["primary", "secondary", "destructive"]),
  inputBindings: z.array(
    z.object({
      input: z.string().min(1),
      path: z.string().min(1),
    }),
  ),
  satisfies: z.array(z.string()),
});

export const RecordSectionSchema = BaseSectionSchema.extend({
  kind: z.literal("record-detail"),
  fields: z.array(FieldSchema).min(1),
});

export const AlertSectionSchema = BaseSectionSchema.extend({
  kind: z.literal("alert"),
  messagePath: z.string().min(1),
  severityPath: z.string().min(1),
});

export const TimelineSectionSchema = BaseSectionSchema.extend({
  kind: z.literal("timeline"),
  source: z.string().min(1),
  titlePath: z.string().min(1),
  detailPath: z.string().min(1),
  timestampPath: z.string().min(1),
  direction: z.enum(["ascending", "descending"]),
});

export const CollectionSectionSchema = BaseSectionSchema.extend({
  kind: z.literal("data-table"),
  source: z.string().min(1),
  columns: z.array(FieldSchema).min(1),
  sort: z.array(
    z.object({
      path: z.string().min(1),
      direction: z.enum(["ascending", "descending"]),
    }),
  ),
  filters: z.array(
    z.object({
      path: z.string().min(1),
      operator: z.literal("equals"),
      value: z.string(),
    }),
  ),
});

export const MetricGroupSectionSchema = BaseSectionSchema.extend({
  kind: z.literal("metric-group"),
  metrics: z.array(FieldSchema).min(1),
});

export const DecisionSectionSchema = BaseSectionSchema.extend({
  kind: z.literal("decision-panel"),
  description: z.string().min(1),
  actions: z.array(ActionBindingSchema).min(1),
});

export const SurfaceSectionSchema = z.discriminatedUnion("kind", [
  RecordSectionSchema,
  AlertSectionSchema,
  TimelineSectionSchema,
  CollectionSectionSchema,
  MetricGroupSectionSchema,
  DecisionSectionSchema,
]);

export const SurfaceSpecSchema = z.object({
  version: z.literal("0.1"),
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  layout: z.enum(["detail", "queue", "dashboard"]),
  capabilities: z.object({
    desktop: z.enum(["interactive", "read-only"]),
    mobile: z.enum(["interactive", "read-only"]),
  }),
  sections: z.array(SurfaceSectionSchema).min(1),
});

export type IntentSpec = z.infer<typeof IntentSpecSchema>;
export type IntentRequirement = z.infer<typeof IntentRequirementSchema>;
export type IntentScenario = z.infer<typeof IntentScenarioSchema>;
export type ScenarioExpectation = z.infer<typeof ScenarioExpectationSchema>;
export type SurfaceSpec = z.infer<typeof SurfaceSpecSchema>;
export type SurfaceSection = z.infer<typeof SurfaceSectionSchema>;
export type FieldSpec = z.infer<typeof FieldSchema>;
export type ActionBinding = z.infer<typeof ActionBindingSchema>;

export interface ContractCheck {
  id: string;
  kind: "schema" | "requirement" | "scenario" | "invariant";
  passed: boolean;
  message: string;
  evidence: string[];
}

export interface ContractReport {
  status: "passed" | "failed";
  summary: {
    passed: number;
    failed: number;
    total: number;
  };
  checks: ContractCheck[];
}
