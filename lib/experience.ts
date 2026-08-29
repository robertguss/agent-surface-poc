import { compileContract } from "@/lib/compiler";
import {
  createAgentSnapshot,
  snapshotToMarkdown,
  type AgentSnapshot,
} from "@/lib/projections";
import type {
  ContractReport,
  IntentSpec,
  SurfaceSpec,
} from "@/lib/schemas";

export interface AuthoringMetrics {
  repairTurns: number;
  firstPassFailedChecks: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export interface CompiledExperience {
  intent: IntentSpec;
  surface: SurfaceSpec;
  authoring: AuthoringMetrics;
  report: ContractReport;
  snapshot: AgentSnapshot;
  markdown: string;
}

export function createCompiledExperience(
  intent: IntentSpec,
  surface: SurfaceSpec,
  authoring: AuthoringMetrics = {
    repairTurns: 0,
    firstPassFailedChecks: 0,
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
  },
): CompiledExperience {
  const snapshot = createAgentSnapshot(surface);
  return {
    intent,
    surface,
    authoring,
    report: compileContract(intent, surface),
    snapshot,
    markdown: snapshotToMarkdown(snapshot),
  };
}
