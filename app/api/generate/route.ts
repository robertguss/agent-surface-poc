import { NextResponse } from "next/server";
import { z } from "zod";

import { compileHumanIntent } from "@/lib/authoring";
import { createCompiledExperience } from "@/lib/experience";

const RequestSchema = z.object({
  intent: z.string().min(40).max(12_000),
});

export async function POST(request: Request) {
  try {
    const body = RequestSchema.parse(await request.json());
    const { intent, surface, authoring } = await compileHumanIntent(body.intent);
    return NextResponse.json(
      createCompiledExperience(intent, surface, authoring),
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "The intent brief is invalid.",
          details: error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Intent compilation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
