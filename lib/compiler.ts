import {
  beginAction,
  confirmAction,
  getActionPresentation,
} from "@/lib/action-policy";
import {
  getDemoFixture,
  hasPath,
  refundActions,
  refundDemoData,
  resolvePath,
} from "@/lib/domain";
import type {
  ActionBinding,
  ContractCheck,
  ContractReport,
  IntentRequirement,
  IntentScenario,
  IntentSpec,
  SurfaceSection,
  SurfaceSpec,
} from "@/lib/schemas";

interface RenderedPath {
  path: string;
  evidence: string;
  prominent: boolean;
}

function sectionRenderedPaths(section: SurfaceSection): RenderedPath[] {
  switch (section.kind) {
    case "record-detail":
      return section.fields.map((field) => ({
        path: field.path,
        evidence: `${section.id}.${field.id}`,
        prominent: field.emphasis === "strong",
      }));
    case "metric-group":
      return section.metrics.map((field) => ({
        path: field.path,
        evidence: `${section.id}.${field.id}`,
        prominent: true,
      }));
    case "alert":
      return [
        {
          path: section.messagePath,
          evidence: `${section.id}.message`,
          prominent: true,
        },
        {
          path: section.severityPath,
          evidence: `${section.id}.severity`,
          prominent: true,
        },
      ];
    case "timeline":
      return [
        {
          path: section.source,
          evidence: section.id,
          prominent: false,
        },
        ...[section.titlePath, section.detailPath, section.timestampPath].map(
          (path) => ({
            path: `${section.source}.${path}`,
            evidence: `${section.id}.${path}`,
            prominent: false,
          }),
        ),
      ];
    case "data-table":
      return section.columns.map((field) => ({
        path: `${section.source}.${field.path}`,
        evidence: `${section.id}.${field.id}`,
        prominent: field.emphasis === "strong",
      }));
    case "decision-panel":
      return [];
  }
}

function allActions(surface: SurfaceSpec): ActionBinding[] {
  return surface.sections.flatMap((section) =>
    section.kind === "decision-panel" ? section.actions : [],
  );
}

function allSatisfies(surface: SurfaceSpec): Set<string> {
  return new Set(
    surface.sections.flatMap((section) => [
      ...section.satisfies,
      ...(section.kind === "decision-panel"
        ? section.actions.flatMap((action) => action.satisfies)
        : []),
    ]),
  );
}

function validateSectionBindings(
  section: SurfaceSection,
  data: Record<string, unknown>,
): ContractCheck[] {
  const checks: ContractCheck[] = [];
  const addPathCheck = (id: string, path: string, source: unknown = data) => {
    const passed = hasPath(source, path);
    checks.push({
      id,
      kind: "schema",
      passed,
      message: passed
        ? `Data binding ${path} is valid.`
        : `Data binding ${path} does not exist in the demo domain.`,
      evidence: [section.id, path],
    });
  };

  switch (section.kind) {
    case "record-detail":
      section.fields.forEach((field) =>
        addPathCheck(`binding:${section.id}:${field.id}`, field.path),
      );
      break;
    case "metric-group":
      section.metrics.forEach((field) =>
        addPathCheck(`binding:${section.id}:${field.id}`, field.path),
      );
      break;
    case "alert":
      addPathCheck(`binding:${section.id}:message`, section.messagePath);
      addPathCheck(`binding:${section.id}:severity`, section.severityPath);
      break;
    case "timeline": {
      addPathCheck(`binding:${section.id}:source`, section.source);
      const rows = resolvePath(data, section.source);
      const first = Array.isArray(rows) ? rows[0] : undefined;
      for (const [name, path] of [
        ["title", section.titlePath],
        ["detail", section.detailPath],
        ["timestamp", section.timestampPath],
      ] as const) {
        addPathCheck(`binding:${section.id}:${name}`, path, first);
      }
      break;
    }
    case "data-table": {
      addPathCheck(`binding:${section.id}:source`, section.source);
      const rows = resolvePath(data, section.source);
      const first = Array.isArray(rows) ? rows[0] : undefined;
      section.columns.forEach((field) =>
        addPathCheck(`binding:${section.id}:${field.id}`, field.path, first),
      );
      section.sort.forEach((sort, index) =>
        addPathCheck(`binding:${section.id}:sort:${index}`, sort.path, first),
      );
      section.filters.forEach((filter, index) =>
        addPathCheck(`binding:${section.id}:filter:${index}`, filter.path, first),
      );
      break;
    }
    case "decision-panel":
      for (const binding of section.actions) {
        const definition = refundActions[binding.actionId];
        const definitionExists = Boolean(definition);
        checks.push({
          id: `action:${binding.id}:definition`,
          kind: "schema",
          passed: definitionExists,
          message: definitionExists
            ? `Action ${binding.actionId} exists in the domain registry.`
            : `Action ${binding.actionId} is not registered.`,
          evidence: [section.id, binding.id],
        });
        if (!definition) continue;

        const providedInputs = binding.inputBindings.map(({ input }) => input);
        const inputsMatch =
          definition.inputFields.every((field) => providedInputs.includes(field)) &&
          providedInputs.every((field) => definition.inputFields.includes(field));
        checks.push({
          id: `action:${binding.id}:inputs`,
          kind: "schema",
          passed: inputsMatch,
          message: inputsMatch
            ? `Action ${binding.actionId} has all required input bindings.`
            : `Action ${binding.actionId} input bindings do not match its schema.`,
          evidence: providedInputs,
        });

        for (const { input, path } of binding.inputBindings) {
          addPathCheck(`action:${binding.id}:input:${input}`, path);
        }
      }
      break;
  }

  return checks;
}

function checkRequirement(
  requirement: IntentRequirement,
  surface: SurfaceSpec,
): ContractCheck {
  const traced = allSatisfies(surface).has(requirement.id);
  const renderedPaths = surface.sections.flatMap(sectionRenderedPaths);
  const actions = allActions(surface);
  let semanticPass = false;
  let evidence: string[] = [];

  switch (requirement.kind) {
    case "information-visible": {
      const matches = requirement.fields.map((field) =>
        renderedPaths.find((rendered) => rendered.path === field),
      );
      semanticPass = matches.every(Boolean);
      evidence = matches.flatMap((match) => (match ? [match.evidence] : []));
      break;
    }
    case "information-prominent": {
      const matches = requirement.fields.map((field) =>
        renderedPaths.find(
          (rendered) => rendered.path === field && rendered.prominent,
        ),
      );
      semanticPass = matches.every(Boolean);
      evidence = matches.flatMap((match) => (match ? [match.evidence] : []));
      break;
    }
    case "chronological": {
      const timelines = surface.sections.filter(
        (section) => section.kind === "timeline",
      );
      const match = timelines.find(
        (section) =>
          requirement.fields.includes(section.source) &&
          (!requirement.policy || section.direction === requirement.policy),
      );
      semanticPass = Boolean(match);
      evidence = match ? [match.id, match.direction] : [];
      break;
    }
    case "collection-order": {
      const tables = surface.sections.filter(
        (section) => section.kind === "data-table",
      );
      const match = tables.find((section) => {
        const requiredSort = requirement.fields.map((field) =>
          field.startsWith(`${section.source}.`)
            ? field.slice(section.source.length + 1)
            : field,
        );
        return requiredSort.every(
          (path, index) =>
            section.sort[index]?.path === path &&
            (!requirement.policy ||
              section.sort[index]?.direction === requirement.policy),
        );
      });
      semanticPass = Boolean(match);
      evidence = match
        ? [
            match.id,
            ...match.sort.map((sort) => `${sort.path}:${sort.direction}`),
          ]
        : [];
      break;
    }
    case "collection-filter": {
      const tables = surface.sections.filter(
        (section) => section.kind === "data-table",
      );
      const requiredValue = requirement.policy?.startsWith("equals:")
        ? requirement.policy.slice("equals:".length)
        : requirement.policy;
      const match = tables.find((section) =>
        requirement.fields.every((field) => {
          const path = field.startsWith(`${section.source}.`)
            ? field.slice(section.source.length + 1)
            : field;
          return section.filters.some(
            (filter) =>
              filter.path === path &&
              filter.operator === "equals" &&
              filter.value === requiredValue,
          );
        }),
      );
      semanticPass = Boolean(match);
      evidence = match
        ? [
            match.id,
            ...match.filters.map(
              (filter) => `${filter.path} ${filter.operator} ${filter.value}`,
            ),
          ]
        : [];
      break;
    }
    case "action-primary": {
      const match = actions.find(
        (action) =>
          action.actionId === requirement.actionId && action.variant === "primary",
      );
      semanticPass = Boolean(match);
      evidence = match ? [match.id, match.variant] : [];
      break;
    }
    case "action-confirmation": {
      const binding = actions.find(
        (action) => action.actionId === requirement.actionId,
      );
      const definition = requirement.actionId
        ? refundActions[requirement.actionId]
        : undefined;
      semanticPass = Boolean(binding && definition?.requiresConfirmation);
      evidence = binding && definition ? [binding.id, "confirmation required"] : [];
      break;
    }
    case "action-availability": {
      const binding = actions.find(
        (action) => action.actionId === requirement.actionId,
      );
      const definition = requirement.actionId
        ? refundActions[requirement.actionId]
        : undefined;
      semanticPass = Boolean(binding && definition?.permissionPath);
      evidence = binding && definition?.permissionPath
        ? [binding.id, definition.permissionPath]
        : [];
      break;
    }
    case "action-absence":
      semanticPass = actions.length === 0;
      evidence = [
        actions.length === 0
          ? "No actions are bound to this surface."
          : `${actions.length} actions are bound.`,
      ];
      break;
    case "responsive-capability": {
      const viewport = requirement.viewport === "mobile" ? "mobile" : "desktop";
      semanticPass = surface.capabilities[viewport] === requirement.policy;
      evidence = [`${viewport}:${surface.capabilities[viewport]}`];
      break;
    }
  }

  const passed = traced && semanticPass;
  return {
    id: requirement.id,
    kind: "requirement",
    passed,
    message: passed
      ? requirement.statement
      : `${requirement.statement} (${!traced ? "missing trace" : "semantic contract not met"})`,
    evidence,
  };
}

function expectationPasses(
  expectation: IntentScenario["expectations"][number],
  actionId: string | null,
  fixture: IntentScenario["fixture"],
  actionBound: boolean,
  boundActionCount: number,
): { passed: boolean; evidence: string } {
  if (expectation === "no-actions-exposed") {
    return {
      passed: boundActionCount === 0,
      evidence: `${boundActionCount} actions are bound to the surface`,
    };
  }

  if (!actionBound) {
    return {
      passed: expectation === "action-unavailable",
      evidence: actionId
        ? `${actionId} is not exposed by this surface`
        : "no action is exposed by this surface",
    };
  }

  if (!actionId) return { passed: false, evidence: "no action to execute" };
  const definition = refundActions[actionId];
  if (!definition) return { passed: false, evidence: "action not registered" };

  const data = getDemoFixture(fixture);
  const presentation = getActionPresentation(definition, data);
  const firstAttempt = beginAction(presentation);

  switch (expectation) {
    case "confirmation-visible":
      return {
        passed: firstAttempt.phase === "confirmation",
        evidence: `initial phase: ${firstAttempt.phase}`,
      };
    case "command-not-dispatched-before-confirmation":
      return {
        passed: !firstAttempt.dispatched && firstAttempt.phase === "confirmation",
        evidence: `dispatched before confirmation: ${firstAttempt.dispatched}`,
      };
    case "command-dispatched": {
      const finalAttempt =
        firstAttempt.phase === "confirmation"
          ? confirmAction(firstAttempt)
          : firstAttempt;
      return {
        passed: finalAttempt.dispatched,
        evidence: `final phase: ${finalAttempt.phase}`,
      };
    }
    case "pending-state":
      return {
        passed: presentation.enabled,
        evidence: "Action renderer guarantees a pending phase while dispatching.",
      };
    case "duplicate-submission-prevented":
      return {
        passed: presentation.enabled,
        evidence: "Action renderer disables controls while dispatching.",
      };
    case "action-unavailable":
      return {
        passed: !presentation.enabled,
        evidence: `enabled: ${presentation.enabled}`,
      };
    case "disabled-reason-exposed":
      return {
        passed: !presentation.enabled && Boolean(presentation.disabledReason),
        evidence: presentation.disabledReason ?? "no reason",
      };
  }
}

function checkScenario(
  scenario: IntentScenario,
  surface: SurfaceSpec,
): ContractCheck {
  const boundActions = allActions(surface);
  const actionBound = boundActions.some(
    (action) => action.actionId === scenario.whenActionId,
  );
  const results = scenario.expectations.map((expectation) => ({
    expectation,
    ...expectationPasses(
      expectation,
      scenario.whenActionId,
      scenario.fixture,
      actionBound,
      boundActions.length,
    ),
  }));
  const passed = results.every((result) => result.passed);

  return {
    id: scenario.id,
    kind: "scenario",
    passed,
    message: passed
      ? scenario.title
      : `${scenario.title} does not meet every behavioral expectation.`,
    evidence: [
      `fixture: ${scenario.fixture}`,
      ...results.map(
        (result) =>
          `${result.expectation}: ${result.passed ? "pass" : "fail"} (${result.evidence})`,
      ),
    ],
  };
}

function uniqueIdentityCheck(surface: SurfaceSpec): ContractCheck {
  const ids = surface.sections.flatMap((section) => [
    section.id,
    ...(section.kind === "decision-panel"
      ? section.actions.map((action) => action.id)
      : []),
  ]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  return {
    id: "invariant:stable-identities",
    kind: "invariant",
    passed: duplicates.length === 0,
    message:
      duplicates.length === 0
        ? "All surface and action identities are unique."
        : `Duplicate identities: ${[...new Set(duplicates)].join(", ")}`,
    evidence: ids,
  };
}

export function compileContract(
  intent: IntentSpec,
  surface: SurfaceSpec,
  data: Record<string, unknown> = refundDemoData,
): ContractReport {
  const checks: ContractCheck[] = [
    uniqueIdentityCheck(surface),
    ...surface.sections.flatMap((section) =>
      validateSectionBindings(section, data),
    ),
    ...intent.requirements.map((requirement) =>
      checkRequirement(requirement, surface),
    ),
    ...intent.scenarios.map((scenario) => checkScenario(scenario, surface)),
  ];
  const passed = checks.filter((check) => check.passed).length;
  const failed = checks.length - passed;

  return {
    status: failed === 0 ? "passed" : "failed",
    summary: { passed, failed, total: checks.length },
    checks,
  };
}
