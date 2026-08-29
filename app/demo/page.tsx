import type { Metadata } from "next";
import Link from "next/link";

import { SurfaceRenderer } from "@/components/surface-renderer";
import { sampleSurfaceSpec } from "@/lib/sample";

export const metadata: Metadata = {
  title: "Refund review · Surface demo",
  alternates: {
    canonical: "/demo",
  },
};

export default function DemoPage() {
  return (
    <main className="standalone-page">
      <link
        rel="alternate"
        type="application/vnd.surface+json"
        href="/demo.agent.json"
      />
      <link rel="alternate" type="text/markdown" href="/demo.md" />
      <nav className="projection-links" aria-label="Alternate representations">
        <Link href="/">Workbench</Link>
        <a href="/demo.agent.json">Agent JSON</a>
        <a href="/demo.md">Markdown</a>
      </nav>
      <SurfaceRenderer surface={sampleSurfaceSpec} />
    </main>
  );
}
