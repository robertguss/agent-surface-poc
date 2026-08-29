"use client";

import { useState } from "react";

import { SurfaceRenderer } from "@/components/surface-renderer";
import type { CompiledExperience } from "@/lib/experience";

type OutputTab =
  | "preview"
  | "intent"
  | "plan"
  | "contract"
  | "agent-json"
  | "markdown";

interface WorkbenchProps {
  initialIntent: string;
  initialExperience: CompiledExperience;
}

const tabs: Array<{ id: OutputTab; label: string }> = [
  { id: "preview", label: "Human preview" },
  { id: "intent", label: "IntentSpec" },
  { id: "plan", label: "Component plan" },
  { id: "contract", label: "Contract" },
  { id: "agent-json", label: "Agent JSON" },
  { id: "markdown", label: "Markdown" },
];

export function Workbench({
  initialIntent,
  initialExperience,
}: WorkbenchProps) {
  const [humanIntent, setHumanIntent] = useState(initialIntent);
  const [experience, setExperience] = useState(initialExperience);
  const [activeTab, setActiveTab] = useState<OutputTab>("preview");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent: humanIntent }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Compilation failed.");
      setExperience(body as CompiledExperience);
      setActiveTab("preview");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Compilation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="workbench-shell">
      <header className="product-header">
        <div className="product-mark" aria-hidden="true">S</div>
        <div>
          <p className="product-name">Surface</p>
          <p className="product-tagline">Intent in. Interface out. Contract enforced.</p>
        </div>
        <div className="header-links">
          <a href="/demo">Standalone demo</a>
          <a href="/demo.agent.json">JSON</a>
          <a href="/demo.md">Markdown</a>
        </div>
      </header>

      <div className="workbench-layout">
        <aside className="intent-panel">
          <div className="panel-heading">
            <div>
              <p className="step-label">01 · Human intent</p>
              <h1>Describe the outcome</h1>
            </div>
            <span className="domain-chip">Refund domain</span>
          </div>
          <p className="panel-copy">
            State who the interface is for, what they need to accomplish, what
            information matters, and any behavioral acceptance scenarios.
          </p>
          <label className="sr-only" htmlFor="intent-editor">UI intent brief</label>
          <textarea
            id="intent-editor"
            className="intent-editor"
            value={humanIntent}
            onChange={(event) => setHumanIntent(event.target.value)}
            spellCheck="true"
          />
          {error && <p className="error-message" role="alert">{error}</p>}
          <button
            className="compile-button"
            type="button"
            disabled={isGenerating || humanIntent.trim().length < 40}
            onClick={generate}
          >
            <span>{isGenerating ? "Interpreting intent…" : "Compile interface"}</span>
            <span aria-hidden="true">→</span>
          </button>
          <div className="pipeline-summary" aria-label="Compilation stages">
            <span>IntentSpec</span><i>→</i><span>SurfaceSpec</span><i>→</i><span>Contract</span>
          </div>
        </aside>

        <section className="output-panel" aria-label="Compiled interface">
          <div className="output-toolbar">
            <nav className="tab-list" aria-label="Output views">
              {tabs.map((tab) => (
                <button
                  className={activeTab === tab.id ? "active" : ""}
                  type="button"
                  aria-current={activeTab === tab.id ? "page" : undefined}
                  onClick={() => setActiveTab(tab.id)}
                  key={tab.id}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
            <div
              className={`contract-badge contract-${experience.report.status}`}
              title={`${experience.report.summary.passed} of ${experience.report.summary.total} checks passed`}
            >
              <span aria-hidden="true" />
              {experience.report.status === "passed"
                ? `${experience.report.summary.total} checks passed`
                : `${experience.report.summary.failed} checks failed`}
            </div>
          </div>

          <div className="output-content">
            {activeTab === "preview" && (
              <div className="preview-stage">
                <div className="browser-chrome">
                  <span /><span /><span />
                  <div>surface.local/refunds/ref_2041</div>
                </div>
                <SurfaceRenderer surface={experience.surface} />
              </div>
            )}

            {activeTab === "intent" && (
              <div className="spec-view">
                <div className="spec-intro">
                  <p className="step-label">02 · Interpreted intent</p>
                  <h2>{experience.intent.title}</h2>
                  <p>{experience.intent.goal}</p>
                </div>
                <div className="requirement-list">
                  {experience.intent.requirements.map((requirement) => (
                    <article key={requirement.id}>
                      <span>{requirement.id}</span>
                      <div>
                        <h3>{requirement.statement}</h3>
                        <p>{requirement.kind} · {requirement.viewport}</p>
                      </div>
                    </article>
                  ))}
                </div>
                {experience.intent.assumptions.length > 0 && (
                  <div className="assumption-box">
                    <h3>Assumptions to review</h3>
                    <ul>
                      {experience.intent.assumptions.map((assumption) => (
                        <li key={assumption}>{assumption}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {activeTab === "plan" && (
              <div className="spec-view">
                <div className="spec-intro">
                  <p className="step-label">03 · Component selection</p>
                  <h2>{experience.surface.sections.length} semantic components</h2>
                  <p>
                    Each component is selected for task fit and traces back to intent.
                    {experience.authoring.repairTurns > 0 &&
                      ` Compiler feedback repaired ${experience.authoring.firstPassFailedChecks} first-pass failures.`}
                  </p>
                </div>
                <div className="component-plan">
                  {experience.surface.sections.map((section, index) => (
                    <article key={section.id}>
                      <div className="component-number">{String(index + 1).padStart(2, "0")}</div>
                      <div>
                        <p className="component-kind">{section.kind}</p>
                        <h3>{section.title}</h3>
                        <p>{section.selectionReason}</p>
                        <div className="trace-chips">
                          {section.satisfies.map((requirement) => (
                            <span key={requirement}>{requirement}</span>
                          ))}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "contract" && (
              <div className="spec-view">
                <div className="contract-hero">
                  <div className={`contract-score score-${experience.report.status}`}>
                    {experience.report.summary.passed}/{experience.report.summary.total}
                  </div>
                  <div>
                    <p className="step-label">04 · Executable contract</p>
                    <h2>{experience.report.status === "passed" ? "Intent preserved" : "Contract needs repair"}</h2>
                    <p>Static bindings, requirement traces, invariants, and BDD scenarios.</p>
                  </div>
                </div>
                <div className="check-groups">
                  {(["requirement", "scenario", "invariant", "schema"] as const).map((kind) => {
                    const checks = experience.report.checks.filter((check) => check.kind === kind);
                    if (checks.length === 0) return null;
                    return (
                      <section key={kind}>
                        <h3>{kind === "schema" ? "Bindings" : `${kind[0].toUpperCase()}${kind.slice(1)}s`}</h3>
                        {checks.map((check) => (
                          <details className={`contract-check check-${check.passed ? "pass" : "fail"}`} key={check.id}>
                            <summary>
                              <span aria-hidden="true">{check.passed ? "✓" : "×"}</span>
                              <strong>{check.id}</strong>
                              <span>{check.message}</span>
                            </summary>
                            <ul>
                              {check.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}
                            </ul>
                          </details>
                        ))}
                      </section>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "agent-json" && (
              <div className="code-view">
                <div>
                  <p className="step-label">Agent-readable projection</p>
                  <span>application/vnd.surface+json</span>
                </div>
                <pre><code>{JSON.stringify(experience.snapshot, null, 2)}</code></pre>
              </div>
            )}

            {activeTab === "markdown" && (
              <div className="code-view">
                <div>
                  <p className="step-label">Fetch-friendly projection</p>
                  <span>text/markdown</span>
                </div>
                <pre><code>{experience.markdown}</code></pre>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
