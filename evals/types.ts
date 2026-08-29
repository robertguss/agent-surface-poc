import { z } from "zod";

import {
  RequirementKindSchema,
  ScenarioExpectationSchema,
} from "@/lib/schemas";

export const EvalComponentKindSchema = z.enum([
  "record-detail",
  "alert",
  "timeline",
  "data-table",
  "metric-group",
  "decision-panel",
]);

export const EvalSemanticSchema = z.enum([
  "record",
  "alert",
  "timeline",
  "table",
  "metrics",
  "actions",
]);

export const RequirementOracleSchema = z.object({
  kind: RequirementKindSchema,
  fields: z.array(z.string()),
  actionId: z.string().nullable(),
  viewport: z.enum(["all", "desktop", "mobile"]),
  policy: z.string().nullable(),
});

export const ScenarioOracleSchema = z.object({
  fixture: z.enum([
    "pending-authorized-lead",
    "pending-unauthorized-agent",
    "approved-refund",
  ]),
  whenActionId: z.string().nullable(),
  expectations: z.array(ScenarioExpectationSchema).min(1),
});

export const ActionOracleSchema = z.object({
  actionId: z.string().min(1),
  variant: z.enum(["primary", "secondary", "destructive"]),
  enabled: z.boolean(),
  requiresConfirmation: z.boolean(),
  input: z.array(
    z.object({
      name: z.string().min(1),
      value: z.string(),
    }),
  ),
});

export const HtmlOracleSchema = z.object({
  requiredText: z.array(z.array(z.string()).min(1)),
  forbiddenText: z.array(z.string()),
  orderedText: z.array(z.array(z.string()).min(2)),
  semantics: z.array(EvalSemanticSchema),
});

export const ConsumptionQuestionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  acceptedAnswers: z.array(z.string().min(1)).min(1),
});

export const AuthoringEvalCaseSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  brief: z.string().min(40),
  fixture: z.enum([
    "pending-authorized-lead",
    "pending-unauthorized-agent",
    "approved-refund",
  ]),
  requirements: z.array(RequirementOracleSchema).min(1),
  scenarios: z.array(ScenarioOracleSchema),
  requiredComponents: z.array(EvalComponentKindSchema),
  maxSections: z.number().int().positive(),
  allowedActions: z.array(z.string()),
  actions: z.array(ActionOracleSchema),
  capabilities: z.object({
    desktop: z.enum(["interactive", "read-only"]),
    mobile: z.enum(["interactive", "read-only"]),
  }),
  html: HtmlOracleSchema,
  questions: z.array(ConsumptionQuestionSchema),
});

export const PublicEvalCasesSchema = z.array(AuthoringEvalCaseSchema).min(1);

export type EvalComponentKind = z.infer<typeof EvalComponentKindSchema>;
export type EvalSemantic = z.infer<typeof EvalSemanticSchema>;
export type RequirementOracle = z.infer<typeof RequirementOracleSchema>;
export type ScenarioOracle = z.infer<typeof ScenarioOracleSchema>;
export type ActionOracle = z.infer<typeof ActionOracleSchema>;
export type AuthoringEvalCase = z.infer<typeof AuthoringEvalCaseSchema>;
export type ConsumptionQuestion = z.infer<typeof ConsumptionQuestionSchema>;

export interface ScoreCheck {
  id: string;
  passed: boolean;
  evidence: string;
}

export interface ScoreCard {
  passed: number;
  total: number;
  score: number;
  checks: ScoreCheck[];
}

export interface EvalMetrics {
  intentRequirementRecall: number | null;
  intentRequirementPrecision: number | null;
  intentScenarioRecall: number | null;
  contractPassed: boolean | null;
  componentFit: number | null;
  actionSafety: number;
  htmlScore: number;
  consumptionAccuracy: number | null;
  repairTurns: number | null;
  firstPassFailedChecks: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export interface ModelUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export interface ConsumptionResult {
  modality: "html" | "json" | "markdown";
  answers: Array<{
    id: string;
    answer: string;
    correct: boolean;
  }>;
  accuracy: number;
  usage: ModelUsage;
  error: string | null;
}

export interface EvalResult {
  schemaVersion: "0.1";
  timestamp: string;
  gitSha: string;
  promptVersion: string;
  model: string;
  caseId: string;
  caseTitle: string;
  run: number;
  pipeline: "surface" | "direct-react";
  status: "passed" | "failed" | "error";
  durationMs: number;
  metrics: EvalMetrics;
  checks: {
    intent: ScoreCard | null;
    surface: ScoreCard | null;
    html: ScoreCard;
  };
  consumption: ConsumptionResult[];
  error: string | null;
  artifacts: Record<string, unknown>;
}
