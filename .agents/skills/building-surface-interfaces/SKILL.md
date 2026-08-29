---
name: building-surface-interfaces
description:
  Builds, extends, and verifies Surface intent-driven interfaces while
  preserving semantic parity across React, HTML, JSON, Markdown, and actions.
  Use when authoring a Surface brief or spec, selecting semantic components,
  changing the catalog or compiler, adding actions or requirement kinds, or
  debugging a Surface contract.
---

# Building Surface Interfaces

Surface is an agent-native UI language and compiler. A human states intent, an
agent authors a constrained semantic interface, and the compiler enforces the
objective contract. React is the first renderer; JSX is not the authoring
language.

## Choose the workflow

- For a natural-language brief, `IntentSpec`, or `SurfaceSpec`, read
  [reference/authoring.md](reference/authoring.md).
- For catalog, schema, compiler, renderer, projection, action, or domain work,
  read [reference/architecture.md](reference/architecture.md).
- For any code or spec change, finish with
  [reference/verification.md](reference/verification.md).
- For product rationale and longer-term boundaries, read
  `docs/product-architecture.md` only when the task needs that context.

## Preserve the core invariant

Human UI, semantic HTML, agent JSON, Markdown, and eventual tool adapters are
projections of one bound semantic surface and action registry. Never let a
projection independently redefine:

- Raw values or entity identity
- Action identity or input schema
- Availability or disabled reasons
- Risk or confirmation policy
- Dispatch behavior

If two outputs disagree, fix the shared semantic source or policy. Do not patch
one representation to resemble another.

## Work in this order

1. Identify the human outcome, audience, facts, decisions, safety constraints,
   responsive constraints, and acceptance scenarios.
2. Normalize those into objective `IntentSpec` requirements. Record unresolved
   material details as assumptions rather than inventing behavior.
3. Select the fewest catalog components that semantically fulfill the intent.
   Use only registered data paths, actions, fixtures, and component kinds.
4. Trace every requirement, but do not treat a trace as proof. The compiler must
   verify actual semantics.
5. Compile before rendering. Repair the plan rather than weakening intent or
   deleting a failing trace.
6. Derive React, JSON, and Markdown from the accepted surface and shared action
   policy.
7. Run deterministic and browser verification.

## Guardrails

- Do not generate arbitrary JSX, CSS, event handlers, or backend commands into
  `SurfaceSpec`.
- Do not add a component merely for visual novelty. Components represent
  coherent task semantics.
- Do not expose actions the intent says must be absent. A missing action and a
  disabled action are different contracts.
- Do not encode domain-independent semantics only in prompts. Add reusable
  schema and compiler concepts with tests.
- Do not trust `satisfies` arrays alone. Add semantic checks for every new
  requirement kind.
- Do not turn confirmation metadata into authorization. Backends must still
  authenticate, authorize, validate, make mutations idempotent, and audit them.
- Do not make Markdown authoritative for operations; it is a lossy reading
  projection.
- Keep the current POC constrained to the refund domain unless the task
  explicitly expands that boundary.

## Definition of done

A Surface change is complete only when:

- The intent can express the requested meaning without prompt-only exceptions.
- The selected components have valid bindings and genuine requirement fit.
- The contract passes without weakening requirements.
- Human and agent outputs agree on facts, ordering, filtering, actions, and
  action state.
- Representative interaction and responsive states are executed.
- Typecheck, lint, tests, and production build pass.
