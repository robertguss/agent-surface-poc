# Surface authoring evaluations

This harness tests the product thesis rather than merely testing implementation
coverage:

> Does a constrained semantic authoring pipeline recover human intent, produce
> safer and more inspectable interfaces, and make those interfaces easier for
> unfamiliar agents to consume than direct React generation?

## Evaluation lanes

### Surface

The human brief goes through the real two-stage authoring path:

1. Natural language → `IntentSpec`
2. `IntentSpec` → `SurfaceSpec`
3. Deterministic compiler, with at most one model repair turn
4. Semantic React HTML plus JSON and Markdown projections

The runner records intent recovery, compiler contract results, component fit,
action safety, rendered HTML semantics, repair turns, latency, and model tokens.

### Direct React baseline

The baseline receives the same human brief, domain description, runtime fixture,
and action registry. It does not receive the gold eval oracle or Surface's
component catalog. It produces a `GeneratedPage({ data })` JSX function and is
scored by the same independent HTML and action oracle used for Surface.

Model-authored source is never evaluated in the runner process. It is rejected
if it contains imports, exports, dynamic evaluation, process/browser globals, or
network APIs; esbuild bundles it; then Node renders it in a scrubbed, time-
bounded child process with no network or write permission and read permission
only for the bundle. This is defense in depth for the POC, not a general-purpose
untrusted-code sandbox.

### Unfamiliar-agent consumption

With `--consumption`, a separate model receives only the generated resource and
fixed questions. It is not given the Surface skill or implementation context.
Answers are scored using deterministic accepted-answer oracles.

- Surface: HTML, agent JSON, and Markdown
- Direct React: HTML only

This lane is optional because it adds one model call per modality, case, and
run. Use `--modalities=html` for the lowest-cost fair cross-pipeline comparison.

## Public cases

`cases/public.json` contains 12 schema-validated development cases covering:

- Consequential refund decisions
- Filtered and multi-key ordered queues
- Risk metrics and prominent warnings
- Chronological history
- Read-only audit and archive views
- Request-information and escalation workflows
- Permission-disabled actions with exposed reasons
- Conversational, non-DSL human wording

Each case contains gold semantic requirements, scenarios, component constraints,
allowed actions, expected action metadata, rendered HTML oracles, capabilities,
and consumption questions. Gold oracles are used only by scorers.

Because the cases are public, they are vulnerable to prompt overfitting. They
are a development and regression set, not an unbiased benchmark. Maintain a
separate unseen holdout before making comparative product claims.

## Commands

```bash
# Deterministic compiler sensitivity; no API key or model calls
npm run eval:mutations

# One case through both generation pipelines
npm run eval:smoke

# All public cases through both pipelines
npm run eval -- --pipeline=both --runs=1

# One pipeline, selected cases, and repeated runs
npm run eval -- \
  --pipeline=surface \
  --case=pending-review-queue,unauthorized-approval \
  --runs=3

# Cross-pipeline HTML consumption
npm run eval -- \
  --case=full-refund-review \
  --pipeline=both \
  --consumption \
  --modalities=html

# Explicit evidence path and model
npm run eval -- \
  --pipeline=both \
  --model=gpt-5-mini \
  --output=evals/results/experiment-a
```

Live evaluations require `OPENAI_API_KEY`. `OPENAI_MODEL` sets the default
model; `--model` overrides it. Calls run sequentially for predictable
accounting. A full run can make many model calls, especially with consumption
enabled, so start with one case.

## Evidence and strict pass criteria

Each run writes:

- `<output>.jsonl`: one complete record per case/run/pipeline, including prompt
  version, model, Git revision, checks, metrics, artifacts, token use, and
  errors
- `<output>.md`: aggregate comparison plus per-run status and failed checks

A Surface run passes strictly only when every gold intent/scenario requirement,
surface check, and rendered HTML check passes. A direct-React run passes
strictly only when every rendered HTML/action check passes. Aggregate scores
remain visible for diagnosis, but cannot turn a failed check into a pass.

The deterministic checks cover required and forbidden text, collection order,
native semantics, agent summary and capability metadata, allowed action IDs,
availability, disabled reasons, confirmation, and resolved action inputs.

## Mutation testing

`eval:mutations` starts from valid detail and queue surfaces, injects 12
plausible defects, and requires the compiler to reject all of them. Mutations
include bad bindings, missing traces, wrong chronology, wrong responsive
capability, duplicate IDs, demoted or missing actions, incorrect action inputs,
incorrect filters and ordering, and a forbidden action added to a read-only
surface.

The command exits nonzero if any mutation escapes. Safety-critical mutations are
marked separately and must always have zero escapes.

## Interpreting results

- Repeat stochastic generation at least three times before comparing pipelines.
- Pin the model and prompt versions in any reported result.
- Compare HTML-to-HTML consumption first; JSON and Markdown measure additional
  Surface affordances rather than baseline parity.
- Inspect individual action-safety checks; never rely only on their average.
- Use human review for visual quality, but do not use a model judge as an
  authoritative semantic or safety gate.
- Add browser interaction and accessibility automation before treating the
  direct-React lane as evidence about client-side behavior; this POC baseline is
  server-rendered semantic HTML.
