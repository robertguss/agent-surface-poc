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

export interface CompiledExperience {
  intent: IntentSpec;
  surface: SurfaceSpec;
  authoring: {
    repairTurns: number;
    firstPassFailedChecks: number;
  };
  report: ContractReport;
  snapshot: AgentSnapshot;
  markdown: string;
}

export function createCompiledExperience(
  intent: IntentSpec,
  surface: SurfaceSpec,
  authoring = { repairTurns: 0, firstPassFailedChecks: 0 },
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
