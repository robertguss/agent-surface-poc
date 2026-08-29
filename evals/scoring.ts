import { JSDOM } from "jsdom";

import { getActionPresentation, resolveActionInputs } from "@/lib/action-policy";
import { compileContract } from "@/lib/compiler";
import { getDemoFixture, refundActions } from "@/lib/domain";
import type {
  IntentRequirement,
  IntentScenario,
  IntentSpec,
  SurfaceSpec,
} from "@/lib/schemas";
import type {
  ActionOracle,
  AuthoringEvalCase,
  RequirementOracle,
  ScenarioOracle,
  ScoreCard,
  ScoreCheck,
} from "@/evals/types";

function scoreCard(checks: ScoreCheck[]): ScoreCard {
  const passed = checks.filter((check) => check.passed).length;
  return {
    passed,
    total: checks.length,
    score: checks.length === 0 ? 1 : passed / checks.length,
    checks,
  };
}

function requirementMatches(
  oracle: RequirementOracle,
  actual: IntentRequirement,
): boolean {
  const actionKind = [
    "action-primary",
    "action-confirmation",
    "action-availability",
  ].includes(oracle.kind);
  const viewportMatches =
    actual.viewport === oracle.viewport ||
    (actionKind && oracle.viewport === "desktop" && actual.viewport === "all");
  return (
    actual.kind === oracle.kind &&
    actual.actionId === oracle.actionId &&
    viewportMatches &&
    (oracle.policy === null || actual.policy === oracle.policy) &&
    oracle.fields.every((field) => actual.fields.includes(field))
  );
}

function scenarioMatches(
  oracle: ScenarioOracle,
  actual: IntentScenario,
): boolean {
  return (
    actual.fixture === oracle.fixture &&
    actual.whenActionId === oracle.whenActionId &&
    oracle.expectations.every((expectation) =>
      actual.expectations.includes(expectation),
    )
  );
}

export function scoreIntent(
  evalCase: AuthoringEvalCase,
  intent: IntentSpec,
): {
  card: ScoreCard;
  requirementRecall: number;
  requirementPrecision: number;
  scenarioRecall: number;
} {
  const requirementChecks = evalCase.requirements.map((oracle, index) => {
    const match = intent.requirements.find((actual) =>
      requirementMatches(oracle, actual),
    );
    return {
      id: `intent:requirement:${index + 1}`,
      passed: Boolean(match),
      evidence: match?.id ?? `${oracle.kind} was not recovered`,
    };
  });
  const relevantGeneratedRequirements = intent.requirements.filter((actual) =>
    evalCase.requirements.some((oracle) => requirementMatches(oracle, actual)),
  ).length;
  const scenarioChecks = evalCase.scenarios.map((oracle, index) => {
    const match = intent.scenarios.find((actual) => scenarioMatches(oracle, actual));
    return {
      id: `intent:scenario:${index + 1}`,
      passed: Boolean(match),
      evidence: match?.id ?? "Scenario was not recovered",
    };
  });

  return {
    card: scoreCard([...requirementChecks, ...scenarioChecks]),
    requirementRecall:
      requirementChecks.filter((check) => check.passed).length /
      requirementChecks.length,
    requirementPrecision:
      intent.requirements.length === 0
        ? 0
        : relevantGeneratedRequirements / intent.requirements.length,
    scenarioRecall:
      scenarioChecks.length === 0
        ? 1
        : scenarioChecks.filter((check) => check.passed).length /
          scenarioChecks.length,
  };
}

function surfaceActions(surface: SurfaceSpec) {
  return surface.sections.flatMap((section) =>
    section.kind === "decision-panel" ? section.actions : [],
  );
}

function checkSurfaceAction(
  oracle: ActionOracle,
  surface: SurfaceSpec,
  evalCase: AuthoringEvalCase,
): ScoreCheck[] {
  const binding = surfaceActions(surface).find(
    (action) => action.actionId === oracle.actionId,
  );
  if (!binding) {
    return [
      {
        id: `surface:action:${oracle.actionId}`,
        passed: false,
        evidence: "Action is not bound",
      },
    ];
  }

  const definition = refundActions[oracle.actionId];
  const data = getDemoFixture(evalCase.fixture);
  const presentation = definition
    ? getActionPresentation(definition, data)
    : null;
  const inputs = resolveActionInputs(binding, data);

  return [
    {
      id: `surface:action:${oracle.actionId}:variant`,
      passed: binding.variant === oracle.variant,
      evidence: binding.variant,
    },
    {
      id: `surface:action:${oracle.actionId}:availability`,
      passed: presentation?.enabled === oracle.enabled,
      evidence: `enabled:${presentation?.enabled ?? false}`,
    },
    {
      id: `surface:action:${oracle.actionId}:confirmation`,
      passed:
        presentation?.requiresConfirmation === oracle.requiresConfirmation,
      evidence: `confirmation:${presentation?.requiresConfirmation ?? false}`,
    },
    ...oracle.input.map(({ name, value }) => ({
      id: `surface:action:${oracle.actionId}:input:${name}`,
      passed: String(inputs[name]) === value,
      evidence: `${name}:${String(inputs[name])}`,
    })),
  ];
}

export function scoreSurface(
  evalCase: AuthoringEvalCase,
  intent: IntentSpec,
  surface: SurfaceSpec,
): { card: ScoreCard; contractPassed: boolean; componentFit: number; actionSafety: number } {
  const report = compileContract(intent, surface, getDemoFixture(evalCase.fixture));
  const kinds = surface.sections.map((section) => section.kind);
  const boundActions = surfaceActions(surface);
  const componentChecks = evalCase.requiredComponents.map((kind) => ({
    id: `surface:component:${kind}`,
    passed: kinds.includes(kind),
    evidence: kinds.join(", "),
  }));
  const actionChecks = [
    ...evalCase.actions.flatMap((oracle) =>
      checkSurfaceAction(oracle, surface, evalCase),
    ),
    {
      id: "surface:actions:allowed",
      passed: boundActions.every((action) =>
        evalCase.allowedActions.includes(action.actionId),
      ),
      evidence: boundActions.map((action) => action.actionId).join(", ") || "none",
    },
  ];
  const checks: ScoreCheck[] = [
    {
      id: "surface:contract",
      passed: report.status === "passed",
      evidence: `${report.summary.passed}/${report.summary.total} checks passed`,
    },
    {
      id: "surface:max-sections",
      passed: surface.sections.length <= evalCase.maxSections,
      evidence: `${surface.sections.length}/${evalCase.maxSections}`,
    },
    {
      id: "surface:capability:desktop",
      passed:
        surface.capabilities.desktop === evalCase.capabilities.desktop,
      evidence: surface.capabilities.desktop,
    },
    {
      id: "surface:capability:mobile",
      passed: surface.capabilities.mobile === evalCase.capabilities.mobile,
      evidence: surface.capabilities.mobile,
    },
    ...componentChecks,
    ...actionChecks,
  ];
  const componentFit =
    componentChecks.length === 0
      ? 1
      : componentChecks.filter((check) => check.passed).length /
        componentChecks.length;
  const actionSafety =
    actionChecks.filter((check) => check.passed).length / actionChecks.length;

  return {
    card: scoreCard(checks),
    contractPassed: report.status === "passed",
    componentFit,
    actionSafety,
  };
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseActionInputs(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function scoreHtml(
  evalCase: AuthoringEvalCase,
  html: string,
): { card: ScoreCard; actionSafety: number } {
  const document = new JSDOM(html).window.document;
  const text = normalizeText(document.body.textContent ?? "");
  const root = document.querySelector<HTMLElement>("[data-agent-summary]");
  const actionElements = Array.from(
    document.querySelectorAll<HTMLElement>("[data-action-id]"),
  );
  const actionIds = actionElements
    .map((element) => element.dataset.actionId)
    .filter((value): value is string => Boolean(value));
  const textChecks: ScoreCheck[] = [
    {
      id: "html:agent-summary",
      passed: Boolean(root?.dataset.agentSummary?.trim()),
      evidence: root?.dataset.agentSummary ?? "missing",
    },
    {
      id: "html:capability:desktop",
      passed:
        root?.dataset.desktopCapability === evalCase.capabilities.desktop,
      evidence: root?.dataset.desktopCapability ?? "missing",
    },
    {
      id: "html:capability:mobile",
      passed: root?.dataset.mobileCapability === evalCase.capabilities.mobile,
      evidence: root?.dataset.mobileCapability ?? "missing",
    },
    ...evalCase.html.requiredText.map((alternatives, index) => ({
      id: `html:text:required:${index + 1}`,
      passed: alternatives.some((value) => text.includes(normalizeText(value))),
      evidence: alternatives.join(" | "),
    })),
    ...evalCase.html.forbiddenText.map((value, index) => ({
      id: `html:text:forbidden:${index + 1}`,
      passed: !text.includes(normalizeText(value)),
      evidence: value,
    })),
    ...evalCase.html.orderedText.map((values, index) => {
      let cursor = -1;
      const passed = values.every((value) => {
        const next = text.indexOf(normalizeText(value), cursor + 1);
        cursor = next;
        return next >= 0;
      });
      return {
        id: `html:text:order:${index + 1}`,
        passed,
        evidence: values.join(" -> "),
      };
    }),
  ];
  const semanticChecks = evalCase.html.semantics.map((semantic) => {
    const selectors: Record<typeof semantic, string> = {
      record: "dl",
      alert: '[role="alert"], [role="status"]',
      timeline: "ol time",
      table: "table",
      metrics: "dl",
      actions: "button[data-action-id]",
    };
    return {
      id: `html:semantic:${semantic}`,
      passed: Boolean(document.querySelector(selectors[semantic])),
      evidence: selectors[semantic],
    };
  });
  const actionChecks: ScoreCheck[] = [
    ...evalCase.actions.flatMap((oracle) => {
      const element = actionElements.find(
        (candidate) => candidate.dataset.actionId === oracle.actionId,
      );
      if (!element) {
        return [
          {
            id: `html:action:${oracle.actionId}`,
            passed: false,
            evidence: "Action element is missing",
          },
        ];
      }
      const inputs = parseActionInputs(element.dataset.actionInputs ?? null);
      const disabled =
        element.hasAttribute("disabled") ||
        element.getAttribute("aria-disabled") === "true";
      const describedBy = element.getAttribute("aria-describedby");
      const disabledReason =
        element.dataset.disabledReason ??
        element.getAttribute("title") ??
        (describedBy
          ? document.getElementById(describedBy)?.textContent?.trim()
          : null);
      return [
        {
          id: `html:action:${oracle.actionId}:variant`,
          passed: element.dataset.actionVariant === oracle.variant,
          evidence: `variant:${element.dataset.actionVariant ?? "missing"}`,
        },
        {
          id: `html:action:${oracle.actionId}:availability`,
          passed: disabled === !oracle.enabled,
          evidence: `disabled:${disabled}`,
        },
        {
          id: `html:action:${oracle.actionId}:confirmation`,
          passed:
            (element.dataset.requiresConfirmation === "true") ===
            oracle.requiresConfirmation,
          evidence: `confirmation:${element.dataset.requiresConfirmation ?? "missing"}`,
        },
        ...(!oracle.enabled
          ? [
              {
                id: `html:action:${oracle.actionId}:disabled-reason`,
                passed: Boolean(disabledReason),
                evidence: disabledReason ?? "missing",
              },
            ]
          : []),
        ...oracle.input.map(({ name, value }) => ({
          id: `html:action:${oracle.actionId}:input:${name}`,
          passed: String(inputs[name]) === value,
          evidence: `${name}:${String(inputs[name])}`,
        })),
      ];
    }),
    {
      id: "html:actions:allowed",
      passed: actionIds.every((actionId) =>
        evalCase.allowedActions.includes(actionId),
      ),
      evidence: actionIds.join(", ") || "none",
    },
    {
      id: "html:actions:unique",
      passed: new Set(actionIds).size === actionIds.length,
      evidence: actionIds.join(", ") || "none",
    },
  ];

  return {
    card: scoreCard([...textChecks, ...semanticChecks, ...actionChecks]),
    actionSafety:
      actionChecks.filter((check) => check.passed).length / actionChecks.length,
  };
}

export function answerIsCorrect(
  answer: string,
  acceptedAnswers: string[],
): boolean {
  const normalized = normalizeText(answer);
  return acceptedAnswers.some((accepted) =>
    normalized.includes(normalizeText(accepted)),
  );
}
