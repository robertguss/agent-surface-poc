import { resolvePath, type ActionDefinition } from "@/lib/domain";

export interface ActionPresentation {
  enabled: boolean;
  disabledReason: string | null;
  requiresConfirmation: boolean;
}

export interface ActionAttempt {
  phase: "blocked" | "confirmation" | "dispatched";
  dispatched: boolean;
}

export function getActionPresentation(
  definition: ActionDefinition,
  data: Record<string, unknown>,
  readOnly = false,
): ActionPresentation {
  if (readOnly) {
    return {
      enabled: false,
      disabledReason: "Actions are unavailable in read-only mode.",
      requiresConfirmation: definition.requiresConfirmation,
    };
  }

  const permitted = definition.permissionPath
    ? resolvePath(data, definition.permissionPath) === true
    : true;

  return {
    enabled: permitted,
    disabledReason: permitted
      ? null
      : "Your current role does not permit this action.",
    requiresConfirmation: definition.requiresConfirmation,
  };
}

export function beginAction(
  presentation: ActionPresentation,
): ActionAttempt {
  if (!presentation.enabled) {
    return { phase: "blocked", dispatched: false };
  }

  if (presentation.requiresConfirmation) {
    return { phase: "confirmation", dispatched: false };
  }

  return { phase: "dispatched", dispatched: true };
}

export function confirmAction(attempt: ActionAttempt): ActionAttempt {
  if (attempt.phase !== "confirmation") return attempt;
  return { phase: "dispatched", dispatched: true };
}
