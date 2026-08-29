export interface ComponentManifest {
  name: string;
  purpose: string;
  fits: string[];
  avoidWhen: string[];
  guarantees: string[];
}

export const componentCatalog: ComponentManifest[] = [
  {
    name: "RecordDetail",
    purpose: "Present labeled facts about one entity for inspection.",
    fits: ["single entity", "label/value facts", "review details"],
    avoidWhen: ["comparing many entities", "chronological history"],
    guarantees: ["definition-list HTML", "raw and displayed values"],
  },
  {
    name: "Alert",
    purpose: "Make a consequential warning or exceptional state prominent.",
    fits: ["risk", "warning", "blocking information"],
    avoidWhen: ["routine status", "large narrative"],
    guarantees: ["live-region semantics", "machine-readable severity"],
  },
  {
    name: "Timeline",
    purpose: "Present ordered events so progression and history are clear.",
    fits: ["ordered events", "history", "chronology"],
    avoidWhen: ["precise cross-record comparison", "unordered records"],
    guarantees: ["time elements", "explicit ordering"],
  },
  {
    name: "DataTable",
    purpose: "Compare, scan, and sort a collection of similarly shaped records.",
    fits: ["collection", "comparison", "high density", "queue"],
    avoidWhen: ["image-first browsing", "long narrative content"],
    guarantees: ["native table HTML", "stable row identity"],
  },
  {
    name: "MetricGroup",
    purpose: "Summarize a small set of important quantitative values.",
    fits: ["dashboard", "monitoring", "headline measures"],
    avoidWhen: ["large datasets", "values requiring detailed context"],
    guarantees: ["raw numeric values", "visible units and formatting"],
  },
  {
    name: "DecisionPanel",
    purpose: "Present high-impact actions together with decision context.",
    fits: ["approve or reject", "workflow decision", "high-impact action"],
    avoidWhen: ["ordinary navigation", "many unrelated commands"],
    guarantees: [
      "shared human/agent action binding",
      "confirmation policy",
      "pending and duplicate-submission behavior",
    ],
  },
];

export function catalogForPrompt(): string {
  return componentCatalog
    .map(
      (component) =>
        `${component.name}: ${component.purpose}\n` +
        `  Use when: ${component.fits.join(", ")}\n` +
        `  Avoid when: ${component.avoidWhen.join(", ")}\n` +
        `  Guarantees: ${component.guarantees.join(", ")}`,
    )
    .join("\n\n");
}
