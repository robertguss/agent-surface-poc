# Surface Architecture and Extension Rules

## Pipeline

```text
Human intent
    ↓ structured model output
IntentSpec
    ↓ catalog-constrained planning
SurfaceSpec
    ↓ deterministic compiler
ContractReport
    ├── React renderer → semantic HTML
    ├── AgentSnapshot → JSON
    ├── AgentSnapshot → Markdown
    └── Action registry → shared interaction policy
```

`lib/authoring.ts` permits one bounded planning repair using concrete compiler
failures. The repair may change `SurfaceSpec`; it must not weaken `IntentSpec`.

## Ownership map

| Concern                                         | Source of truth                   |
| ----------------------------------------------- | --------------------------------- |
| Intent and surface language                     | `lib/schemas.ts`                  |
| Component purpose and fit                       | `lib/catalog.ts`                  |
| Domain fields, fixtures, and action definitions | `lib/domain.ts`                   |
| Natural-language normalization and planning     | `lib/authoring.ts`                |
| Binding, trace, invariant, and BDD enforcement  | `lib/compiler.ts`                 |
| Action availability and transition policy       | `lib/action-policy.ts`            |
| JSON and Markdown derivation                    | `lib/projections.ts`              |
| Semantic React behavior                         | `components/surface-renderer.tsx` |
| End-to-end assembled output                     | `lib/experience.ts`               |
| Review workbench                                | `components/workbench.tsx`        |

Change the owning source directly. Do not add projection-specific overrides for
shared semantics.

## Extending a requirement kind

Update all of these together:

1. Add the kind and any closed policy vocabulary to `lib/schemas.ts`.
2. Teach interpretation in `lib/authoring.ts`.
3. Add deterministic semantic fulfillment in `lib/compiler.ts`.
4. Add positive and negative compiler tests.
5. Add renderer or projection work only if the new meaning requires it.

A new prompt instruction without a compiler check is not a language feature. A
trace-only compiler check is insufficient.

## Extending the component catalog

Add a component only when it owns a coherent semantic responsibility. Then:

1. Add its closed spec to the discriminated union in `lib/schemas.ts`.
2. Publish purpose, fit, counter-fit, and guarantees in `lib/catalog.ts`.
3. Map the catalog name to its spec kind in `lib/authoring.ts`.
4. Validate every binding and requirement capability in `lib/compiler.ts`.
5. Project it from the same data in `lib/projections.ts`.
6. Render native semantic HTML in `components/surface-renderer.tsx`.
7. Add contract, projection-parity, semantic-HTML, and interaction tests as
   applicable.

Do not add a component whose only responsibility is spacing, color, or a one-off
composition.

## Extending domains and data

The POC directly owns one refund domain. When intentionally adding domain
capability:

- Register data shape and fixtures together.
- Register action identity, input fields, risk, confirmation, and permission
  path together.
- Keep stable entity and action IDs across all outputs.
- Validate collection source paths separately from item-relative paths.
- Never expose arbitrary event handlers as actions.

If multiple domains are introduced, first extract a genuine domain registry
boundary. Do not scatter domain conditionals through the compiler and renderer.

## Extending actions

Human controls and agent actions must share one definition and policy:

1. Add the action definition to the domain registry.
2. Bind every required input to existing data.
3. Derive enabled state and disabled reason through `getActionPresentation`.
4. Derive confirmation and dispatch transitions through the shared action
   policy.
5. Project the same action ID, inputs, availability, reason, and confirmation to
   agent JSON.
6. Add authorized, unauthorized, confirmation, pending, and duplicate-prevention
   tests as relevant.

The POC simulates dispatch. A production adapter must reauthorize and revalidate
server-side and provide idempotency and audit behavior.

## Projection rules

- JSON preserves raw and displayed values.
- SSR-visible formatting must be deterministic across JavaScript runtimes. The
  POC uses an explicit English UTC date representation rather than
  implementation-dependent `Intl.DateTimeFormat` date styles.
- Ordering and filtering are explicit in both the spec and resulting rows.
- `enabled: true` requires `disabledReason: null`.
- Markdown derives from `AgentSnapshot`; it is not independently authored.
- Semantic HTML uses native headings, sections, definition lists, tables,
  ordered lists, `time`, buttons, and accessible states.
- Alternate routes must observe the same future authentication and authorization
  boundary as HTML.
