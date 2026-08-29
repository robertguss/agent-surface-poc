# Authoring Surface

Use this reference to turn a human brief into `IntentSpec` and `SurfaceSpec`, or
to review specs authored by another agent.

## Human input

Plain natural language is valid. Structured Intent Markdown is optional and
helps humans review the interpreted contract:

```md
# Interface name

## Audience

Who uses it and in what role.

## Goal

The outcome, not a layout description.

## Requirements

- Facts that must be visible or prominent.
- Ordering or filtering rules.
- Available, primary, confirmed, disabled, or absent actions.
- Desktop and mobile capabilities.

## Scenarios

Given a named state When the user attempts a registered action Then an objective
interaction or dispatch result occurs.
```

Do not require this DSL from humans. The authoring agent can generate it as a
reviewable intermediate form.

## IntentSpec rules

Use `lib/schemas.ts` as the exact schema and `lib/domain.ts` as the allowed
vocabulary.

- Assign stable requirement IDs `R1`, `R2`, and so on.
- Keep requirements independent of component choices.
- Use exact root data paths and registered action IDs.
- Use only available behavior fixtures.
- Add only scenarios stated by the human or needed to verify stated safety.
- Put material ambiguity in `assumptions`; do not silently expand the product.

### Requirement kinds

| Kind                    | Expresses                                      | Important fields                                         |
| ----------------------- | ---------------------------------------------- | -------------------------------------------------------- |
| `information-visible`   | Exact facts must render                        | `fields` contains root paths                             |
| `information-prominent` | Exact facts need emphasized or alert treatment | `fields` contains root paths                             |
| `chronological`         | Events have explicit order                     | collection source in `fields`; direction in `policy`     |
| `collection-order`      | A table has sort priority                      | full sort paths in priority order; direction in `policy` |
| `collection-filter`     | A table restricts its rows                     | full field path; `policy` is `equals:<value>`            |
| `action-primary`        | One registered action is primary               | `actionId`                                               |
| `action-confirmation`   | One action requires confirmation               | `actionId`                                               |
| `action-availability`   | Availability follows permission state          | `actionId`                                               |
| `action-absence`        | The surface exposes no actions                 | `actionId: null`                                         |
| `responsive-capability` | A viewport is interactive or read-only         | `viewport` and `policy`                                  |

Action absence is not action unavailability. Use a `no-actions-exposed` scenario
with `whenActionId: null` to test absence. Use `action-unavailable` and
`disabled-reason-exposed` only for a control that exists but is disabled.

## Surface planning

Choose the fewest components that fully satisfy intent:

| Component kind   | Use for                                        | Avoid for                          |
| ---------------- | ---------------------------------------------- | ---------------------------------- |
| `record-detail`  | Labeled facts about one entity                 | Collections or chronology          |
| `alert`          | Consequential warning or exceptional state     | Routine status                     |
| `timeline`       | Ordered events and history                     | Cross-record comparison            |
| `data-table`     | Scanning or comparing similarly shaped records | Narrative or image-first content   |
| `metric-group`   | A small set of headline numbers                | Large datasets                     |
| `decision-panel` | Related consequential actions with context     | Navigation or review-only surfaces |

Every section needs a stable `id`, honest `selectionReason`, and the requirement
IDs it satisfies. Every action binding also has a stable ID and its own traces.

### Binding conventions

- `record-detail`, `metric-group`, and `alert` use root data paths.
- `timeline` and `data-table` use a root collection `source` and item-relative
  field paths.
- Intent requirements still use full dotted collection paths such as
  `queue.amount`.
- Data-table sort entries are item-relative and preserve priority order.
- Action inputs bind registered input names to existing root paths.
- The action registry owns labels, meaning, permissions, risk, and confirmation.

## Review questions

Before accepting a plan, ask:

1. Could a smaller component set preserve every requirement?
2. Does each component fit the task, not merely contain the data?
3. Does every trace point to real semantics the compiler can prove?
4. Did the plan invent data, actions, fixtures, roles, or assumptions?
5. Are review-only and no-action requirements enforced explicitly?
6. Are ordering and filtering machine-readable rather than implied visually?
