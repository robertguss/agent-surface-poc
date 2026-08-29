"use client";

import { useEffect, useMemo, useState } from "react";

import {
  beginAction,
  getActionPresentation,
  type ActionAttempt,
} from "@/lib/action-policy";
import {
  refundActions,
  refundDemoData,
  resolvePath,
} from "@/lib/domain";
import { displayValue, filterRows, sortRows } from "@/lib/projections";
import type {
  ActionBinding,
  FieldSpec,
  SurfaceSpec,
} from "@/lib/schemas";

interface SurfaceRendererProps {
  surface: SurfaceSpec;
  data?: Record<string, unknown>;
}

function useMobileViewport() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(max-width: 720px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isMobile;
}

function rawAttribute(value: unknown): string | undefined {
  return ["string", "number", "boolean"].includes(typeof value)
    ? String(value)
    : undefined;
}

function FieldValue({
  field,
  data,
}: {
  field: FieldSpec;
  data: Record<string, unknown>;
}) {
  const raw = resolvePath(data, field.path);
  return (
    <div className={`record-field field-${field.emphasis}`} data-field-id={field.id}>
      <dt>{field.label}</dt>
      <dd data-raw-value={rawAttribute(raw)}>{displayValue(raw, field.format)}</dd>
    </div>
  );
}

export function SurfaceRenderer({
  surface,
  data = refundDemoData,
}: SurfaceRendererProps) {
  const isMobile = useMobileViewport();
  const readOnly = isMobile && surface.capabilities.mobile === "read-only";
  const [confirmation, setConfirmation] = useState<{
    binding: ActionBinding;
    attempt: ActionAttempt;
  } | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [lastDispatch, setLastDispatch] = useState<string | null>(null);

  const titleId = `${surface.id}-title`;
  const sections = useMemo(() => surface.sections, [surface.sections]);

  const dispatch = (binding: ActionBinding) => {
    if (pendingAction) return;
    const definition = refundActions[binding.actionId];
    if (!definition) return;

    setPendingAction(binding.actionId);
    setLastDispatch(`${definition.label} command dispatched.`);
    window.setTimeout(() => setPendingAction(null), 650);
  };

  const startAction = (binding: ActionBinding) => {
    const definition = refundActions[binding.actionId];
    if (!definition) return;
    const presentation = getActionPresentation(definition, data, readOnly);
    const attempt = beginAction(presentation);

    if (attempt.phase === "confirmation") {
      setConfirmation({ binding, attempt });
    } else if (attempt.phase === "dispatched") {
      dispatch(binding);
    }
  };

  return (
    <article
      className={`surface surface-${surface.layout}`}
      aria-labelledby={titleId}
      data-surface-id={surface.id}
      data-surface-version={surface.version}
    >
      <header className="surface-header">
        <div>
          <p className="eyebrow">Refund operations</p>
          <h1 id={titleId}>{surface.title}</h1>
          <p>{surface.description}</p>
        </div>
        <span className="mode-pill" data-capability={readOnly ? "read-only" : "interactive"}>
          {readOnly ? "Review only" : "Interactive"}
        </span>
      </header>

      <div className="surface-grid">
        {sections.map((section) => {
          const sectionTitleId = `${surface.id}-${section.id}-title`;

          if (section.kind === "record-detail") {
            return (
              <section
                className="surface-card record-card"
                aria-labelledby={sectionTitleId}
                data-component="record-detail"
                data-section-id={section.id}
                key={section.id}
              >
                <h2 id={sectionTitleId}>{section.title}</h2>
                <dl className="record-grid">
                  {section.fields.map((field) => (
                    <FieldValue field={field} data={data} key={field.id} />
                  ))}
                </dl>
              </section>
            );
          }

          if (section.kind === "alert") {
            const severity = String(resolvePath(data, section.severityPath));
            return (
              <section
                className={`surface-card alert-card severity-${severity}`}
                aria-labelledby={sectionTitleId}
                role="status"
                data-component="alert"
                data-severity={severity}
                data-section-id={section.id}
                key={section.id}
              >
                <div className="alert-icon" aria-hidden="true">!</div>
                <div>
                  <p className="alert-severity">{severity} risk</p>
                  <h2 id={sectionTitleId}>{section.title}</h2>
                  <p>{String(resolvePath(data, section.messagePath))}</p>
                </div>
              </section>
            );
          }

          if (section.kind === "timeline") {
            const source = resolvePath(data, section.source);
            const events = Array.isArray(source) ? [...source] : [];
            events.sort((left, right) => {
              const leftTime = Date.parse(
                String(resolvePath(left, section.timestampPath)),
              );
              const rightTime = Date.parse(
                String(resolvePath(right, section.timestampPath)),
              );
              return section.direction === "ascending"
                ? leftTime - rightTime
                : rightTime - leftTime;
            });

            return (
              <section
                className="surface-card timeline-card"
                aria-labelledby={sectionTitleId}
                data-component="timeline"
                data-direction={section.direction}
                data-section-id={section.id}
                key={section.id}
              >
                <h2 id={sectionTitleId}>{section.title}</h2>
                <ol className="timeline-list">
                  {events.map((event, index) => {
                    const timestamp = String(
                      resolvePath(event, section.timestampPath),
                    );
                    return (
                      <li key={String(resolvePath(event, "id") ?? index)}>
                        <div className="timeline-marker" aria-hidden="true" />
                        <div>
                          <div className="timeline-heading">
                            <h3>{String(resolvePath(event, section.titlePath))}</h3>
                            <time dateTime={timestamp}>
                              {displayValue(timestamp, "date")}
                            </time>
                          </div>
                          <p>{String(resolvePath(event, section.detailPath))}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          }

          if (section.kind === "data-table") {
            const source = resolvePath(data, section.source);
            const rows = sortRows(
              filterRows(
                Array.isArray(source) ? source : [],
                section.filters,
              ),
              section.sort,
            );
            return (
              <section
                className="surface-card table-card"
                aria-labelledby={sectionTitleId}
                data-component="data-table"
                data-sort={section.sort
                  .map((sort) => `${sort.path}:${sort.direction}`)
                  .join(",")}
                data-filters={section.filters
                  .map((filter) => `${filter.path}:${filter.value}`)
                  .join(",")}
                data-section-id={section.id}
                key={section.id}
              >
                <h2 id={sectionTitleId}>{section.title}</h2>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {section.columns.map((column) => (
                          <th scope="col" key={column.id}>{column.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr key={String(resolvePath(row, "id") ?? index)}>
                          {section.columns.map((column) => {
                            const raw = resolvePath(row, column.path);
                            return (
                              <td data-raw-value={rawAttribute(raw)} key={column.id}>
                                {displayValue(raw, column.format)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          }

          if (section.kind === "metric-group") {
            return (
              <section
                className="surface-card metrics-card"
                aria-labelledby={sectionTitleId}
                data-component="metric-group"
                data-section-id={section.id}
                key={section.id}
              >
                <h2 id={sectionTitleId}>{section.title}</h2>
                <dl className="metrics-grid">
                  {section.metrics.map((metric) => {
                    const raw = resolvePath(data, metric.path);
                    return (
                      <div key={metric.id}>
                        <dt>{metric.label}</dt>
                        <dd data-raw-value={rawAttribute(raw)}>
                          {displayValue(raw, metric.format)}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </section>
            );
          }

          return (
            <section
              className="surface-card decision-card"
              aria-labelledby={sectionTitleId}
              data-component="decision-panel"
              data-section-id={section.id}
              key={section.id}
            >
              <div>
                <p className="eyebrow">Decision point</p>
                <h2 id={sectionTitleId}>{section.title}</h2>
                <p>{section.description}</p>
              </div>
              <div className="action-list">
                {section.actions.map((binding) => {
                  const definition = refundActions[binding.actionId];
                  if (!definition) return null;
                  const presentation = getActionPresentation(
                    definition,
                    data,
                    readOnly,
                  );
                  const isPending = pendingAction === binding.actionId;
                  const hintId = `${binding.id}-hint`;
                  return (
                    <div className="action-wrap" key={binding.id}>
                      <button
                        className={`action-button action-${binding.variant}`}
                        type="button"
                        disabled={!presentation.enabled || Boolean(pendingAction)}
                        aria-describedby={!presentation.enabled ? hintId : undefined}
                        aria-busy={isPending}
                        data-action-id={binding.actionId}
                        onClick={() => startAction(binding)}
                      >
                        {isPending ? "Working…" : definition.label}
                      </button>
                      {!presentation.enabled && (
                        <span className="action-hint" id={hintId}>
                          {presentation.disabledReason}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="dispatch-status" aria-live="polite">
                {lastDispatch}
              </p>
            </section>
          );
        })}
      </div>

      {confirmation && (
        <div className="dialog-backdrop">
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-description"
          >
            <p className="eyebrow">Confirmation required</p>
            <h2 id="confirm-title">
              {refundActions[confirmation.binding.actionId]?.label}?
            </h2>
            <p id="confirm-description">
              This action changes the outcome of the refund request. Confirm that
              you want to continue.
            </p>
            <div className="dialog-actions">
              <button
                className="action-button action-secondary"
                type="button"
                onClick={() => setConfirmation(null)}
              >
                Cancel
              </button>
              <button
                className="action-button action-destructive"
                type="button"
                onClick={() => {
                  const binding = confirmation.binding;
                  setConfirmation(null);
                  dispatch(binding);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
