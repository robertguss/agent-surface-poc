import {
  createAgentSnapshot,
  snapshotToMarkdown,
} from "@/lib/projections";
import { sampleSurfaceSpec } from "@/lib/sample";

export function GET() {
  const markdown = snapshotToMarkdown(createAgentSnapshot(sampleSurfaceSpec));
  return new Response(markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      link: '</demo>; rel="canonical", </demo.agent.json>; rel="alternate"; type="application/vnd.surface+json"',
    },
  });
}
