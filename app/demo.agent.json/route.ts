import { createAgentSnapshot } from "@/lib/projections";
import { sampleSurfaceSpec } from "@/lib/sample";

export function GET() {
  return Response.json(createAgentSnapshot(sampleSurfaceSpec), {
    headers: {
      "content-type": "application/vnd.surface+json; charset=utf-8",
      link: '</demo>; rel="canonical", </demo.md>; rel="alternate"; type="text/markdown"',
    },
  });
}
