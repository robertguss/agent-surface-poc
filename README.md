# Surface POC

An agent-native UI compiler proof of concept:

> Human intent becomes a beautiful React interface, an agent-readable
> representation, and an executable behavioral contract.

The POC is intentionally constrained to a refund-operations domain. A human
writes an intent brief; two structured model calls produce an `IntentSpec` and a
`SurfaceSpec`; the compiler validates requirement coverage, bindings, actions,
and BDD-style scenarios; React renders semantic HTML; JSON and Markdown are
derived from the same surface and data.

Read the full product and architecture document in
[`docs/product-architecture.md`](docs/product-architecture.md).

## Run

```bash
cp .env.example .env.local
# Add OPENAI_API_KEY to .env.local
npm install
npm run dev
```

The checked-in sample loads without an API call. Compiling edited natural
language requires `OPENAI_API_KEY`. Override `OPENAI_MODEL` if needed.

## Agent usage

The project includes the `building-surface-interfaces` agent skill in
`.agents/skills/`. It teaches coding agents how to author intent and surfaces,
select components, preserve cross-projection invariants, extend the language,
and verify human and agent-facing behavior. Amp discovers it from the repository
and loads it for Surface authoring or implementation tasks.

## Verify

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Routes

- `/` — authoring workbench
- `/demo` — standalone semantic HTML surface
- `/demo.agent.json` — structured agent projection
- `/demo.md` — fetch-friendly Markdown projection

## POC boundaries

Included:

- Natural language → structured intent
- Structured intent → constrained component plan
- One semantic component catalog and visual theme
- Shared human/agent action registry
- Requirement traceability and BDD-style scenarios
- Semantic SSR HTML, JSON, and Markdown

Deferred:

- Screenshots and wireframes
- Arbitrary domains and data-source generation
- Production authorization and command execution
- WebMCP/MCP adapters
- Multiple renderers and themes
- Runtime-generated untrusted UI
