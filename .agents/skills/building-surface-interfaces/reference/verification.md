# Verifying Surface

Use the cheapest checks first, but cover every affected projection and state.

## Static verification

Run from the repository root:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Targeted tests live in:

- `tests/compiler.test.ts` for bindings, semantic requirement fulfillment,
  traces, scenarios, action absence, ordering, and filtering
- `tests/projections.test.ts` for raw/display parity and Markdown derivation
- `tests/surface-renderer.test.tsx` for native semantics and shared action
  behavior

Add both passing and deliberately failing compiler tests for a new invariant.
The contract should reject a plausible incorrect surface, not only accept the
sample.

## Contract verification

For each changed intent or surface, inspect `ContractReport` and verify:

- All data and action bindings exist.
- Action input fields match exactly.
- Surface and action identities are unique.
- Every requirement is traced and semantically fulfilled.
- Collection filter values and sort priority match intent.
- Action absence, availability, and confirmation are not conflated.
- Every scenario uses a valid fixture and objective expectations.

Never make a check pass by deleting a requirement, weakening the intent, or
hard-coding one generated example.

## Projection parity

Compare representative facts and actions across HTML, agent JSON, and Markdown:

- Raw value, displayed value, units, and labels
- Identical SSR and initial-client date and number text across target runtimes
- Stable entity, section, and action identity
- Collection membership and order
- Action input values
- Availability and disabled reason
- Confirmation requirement

JSON and Markdown routes for the checked-in demo are:

```text
/demo.agent.json
/demo.md
```

An enabled action must have a null disabled reason. An unavailable action must
have a useful reason. Markdown should describe operations but never become the
dispatch contract.

## Browser verification

Exercise representative states rather than inspecting only a screenshot:

1. Load `/` and verify Human preview, IntentSpec, Component plan, Contract,
   Agent JSON, and Markdown tabs all hydrate and display content.
2. Load `/demo` and inspect the accessibility tree for native landmarks,
   headings, lists or tables, time values, and controls.
3. Attempt a destructive action. Verify confirmation appears and dispatch has
   not occurred.
4. Confirm it. Verify dispatch status, pending state, and disabled controls that
   prevent duplicate submission.
5. Render an unauthorized fixture and verify the control is disabled with an
   exposed reason.
6. Use a mobile viewport when capabilities are read-only. Verify every action is
   disabled and explains why.
7. Inspect one representative screenshot for hierarchy, overflow, overlap, and
   responsive defects after behavior passes.

When using an Amp orb portal, ensure Next.js dev assets hydrate through the
portal. `next.config.ts` allows `*.onamp.dev` only when `AMP_ORB` is set.

## Live authoring proof

When authoring logic or schemas change and model access is available, test at
least one novel brief that is not the checked-in sample. Prefer a brief that
combines multiple enforceable constraints, such as:

- A queue filtered to one status
- Multi-key ordering with explicit directions
- Desktop and mobile review-only behavior
- Explicitly no actions

Record first-pass failures, repair turns, final component choices, and contract
results. One attractive generated page is not sufficient evidence.
