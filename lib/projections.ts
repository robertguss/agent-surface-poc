import {
  getActionPresentation,
  resolveActionInputs,
} from "@/lib/action-policy";
import {
  refundActions,
  refundDemoData,
  resolvePath,
} from "@/lib/domain";
import type { FieldSpec, SurfaceSpec } from "@/lib/schemas";

function formatValue(value: unknown, format: FieldSpec["format"]): string {
  if (value === null || value === undefined) return "Not available";

  switch (format) {
    case "currency":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(Number(value));
    case "date": {
      const date = new Date(String(value));
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const hour = date.getUTCHours();
      const minute = String(date.getUTCMinutes()).padStart(2, "0");
      return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}, ${hour % 12 || 12}:${minute} ${hour < 12 ? "AM" : "PM"} UTC`;
    }
    case "number":
      return new Intl.NumberFormat("en-US").format(Number(value));
    case "status":
      return String(value)
        .replaceAll("-", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
    case "text":
      return String(value);
  }
}

export function displayValue(value: unknown, format: FieldSpec["format"]): string {
  return formatValue(value, format);
}

export function sortRows(
  rows: unknown[],
  sort: Array<{ path: string; direction: "ascending" | "descending" }>,
): unknown[] {
  return [...rows].sort((left, right) => {
    for (const rule of sort) {
      const leftValue = resolvePath(left, rule.path);
      const rightValue = resolvePath(right, rule.path);
      const compared =
        typeof leftValue === "number" && typeof rightValue === "number"
          ? leftValue - rightValue
          : String(leftValue).localeCompare(String(rightValue));
      if (compared !== 0) {
        return rule.direction === "ascending" ? compared : -compared;
      }
    }
    return 0;
  });
}

export function filterRows(
  rows: unknown[],
  filters: Array<{ path: string; operator: "equals"; value: string }>,
): unknown[] {
  return rows.filter((row) =>
    filters.every((filter) =>
      filter.operator === "equals"
        ? String(resolvePath(row, filter.path)) === filter.value
        : false,
    ),
  );
}

export interface AgentSnapshot {
  schemaVersion: "0.1";
  surface: {
    id: string;
    title: string;
    description: string;
    layout: SurfaceSpec["layout"];
    capabilities: SurfaceSpec["capabilities"];
  };
  sections: Array<Record<string, unknown>>;
}

export function createAgentSnapshot(
  surface: SurfaceSpec,
  data: Record<string, unknown> = refundDemoData,
): AgentSnapshot {
  return {
    schemaVersion: "0.1",
    surface: {
      id: surface.id,
      title: surface.title,
      description: surface.description,
      layout: surface.layout,
      capabilities: surface.capabilities,
    },
    sections: surface.sections.map((section) => {
      switch (section.kind) {
        case "record-detail":
          return {
            id: section.id,
            kind: "record",
            title: section.title,
            fields: section.fields.map((field) => {
              const raw = resolvePath(data, field.path);
              return {
                id: field.id,
                label: field.label,
                path: field.path,
                raw,
                display: formatValue(raw, field.format),
                emphasis: field.emphasis,
              };
            }),
          };
        case "alert":
          return {
            id: section.id,
            kind: "alert",
            title: section.title,
            severity: resolvePath(data, section.severityPath),
            message: resolvePath(data, section.messagePath),
          };
        case "timeline": {
          const source = resolvePath(data, section.source);
          const events = Array.isArray(source) ? [...source] : [];
          events.sort((left, right) => {
            const leftTime = Date.parse(String(resolvePath(left, section.timestampPath)));
            const rightTime = Date.parse(String(resolvePath(right, section.timestampPath)));
            return section.direction === "ascending"
              ? leftTime - rightTime
              : rightTime - leftTime;
          });
          return {
            id: section.id,
            kind: "timeline",
            title: section.title,
            direction: section.direction,
            events: events.map((event) => ({
              title: resolvePath(event, section.titlePath),
              detail: resolvePath(event, section.detailPath),
              timestamp: resolvePath(event, section.timestampPath),
            })),
          };
        }
        case "data-table": {
          const source = resolvePath(data, section.source);
          const rows = sortRows(
            filterRows(Array.isArray(source) ? source : [], section.filters),
            section.sort,
          );
          return {
            id: section.id,
            kind: "collection",
            title: section.title,
            sort: section.sort,
            filters: section.filters,
            rows: rows.map((row) =>
              Object.fromEntries(
                section.columns.map((column) => {
                  const raw = resolvePath(row, column.path);
                  return [
                    column.id,
                    {
                      label: column.label,
                      raw,
                      display: formatValue(raw, column.format),
                    },
                  ];
                }),
              ),
            ),
          };
        }
        case "metric-group":
          return {
            id: section.id,
            kind: "metrics",
            title: section.title,
            metrics: section.metrics.map((metric) => {
              const raw = resolvePath(data, metric.path);
              return {
                id: metric.id,
                label: metric.label,
                raw,
                display: formatValue(raw, metric.format),
              };
            }),
          };
        case "decision-panel":
          return {
            id: section.id,
            kind: "actions",
            title: section.title,
            description: section.description,
            actions: section.actions.map((binding) => {
              const definition = refundActions[binding.actionId];
              const presentation = definition
                ? getActionPresentation(definition, data)
                : null;
              return {
                bindingId: binding.id,
                actionId: binding.actionId,
                label: definition?.label ?? binding.actionId,
                description: definition?.description ?? "Unknown action",
                variant: binding.variant,
                input: resolveActionInputs(binding, data),
                enabled: presentation?.enabled ?? false,
                disabledReason: presentation
                  ? presentation.disabledReason
                  : "Action is not registered.",
                requiresConfirmation:
                  presentation?.requiresConfirmation ?? false,
              };
            }),
          };
      }
    }),
  };
}

export function snapshotToMarkdown(snapshot: AgentSnapshot): string {
  const lines = [
    `# ${snapshot.surface.title}`,
    "",
    snapshot.surface.description,
    "",
  ];

  for (const section of snapshot.sections) {
    lines.push(`## ${String(section.title)}`, "");

    if (section.kind === "record") {
      for (const field of section.fields as Array<Record<string, unknown>>) {
        lines.push(`- **${String(field.label)}:** ${String(field.display)}`);
      }
    } else if (section.kind === "alert") {
      lines.push(
        `**${String(section.severity).toUpperCase()}:** ${String(section.message)}`,
      );
    } else if (section.kind === "timeline") {
      for (const event of section.events as Array<Record<string, unknown>>) {
        lines.push(
          `- **${String(event.title)}** — ${String(event.detail)} (${String(event.timestamp)})`,
        );
      }
    } else if (section.kind === "collection") {
      const rows = section.rows as Array<Record<string, Record<string, unknown>>>;
      if (rows.length > 0) {
        const keys = Object.keys(rows[0]);
        lines.push(
          `| ${keys.map((key) => String(rows[0][key].label)).join(" | ")} |`,
          `| ${keys.map(() => "---").join(" | ")} |`,
          ...rows.map(
            (row) => `| ${keys.map((key) => String(row[key].display)).join(" | ")} |`,
          ),
        );
      }
    } else if (section.kind === "metrics") {
      for (const metric of section.metrics as Array<Record<string, unknown>>) {
        lines.push(`- **${String(metric.label)}:** ${String(metric.display)}`);
      }
    } else if (section.kind === "actions") {
      lines.push(String(section.description), "", "Available actions:");
      for (const action of section.actions as Array<Record<string, unknown>>) {
        const availability = action.enabled
          ? "available"
          : `unavailable: ${String(action.disabledReason)}`;
        const confirmation = action.requiresConfirmation
          ? "; confirmation required"
          : "";
        lines.push(
          `- **${String(action.label)}** — ${availability}${confirmation}`,
        );
      }
    }

    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}
