import publicCases from "@/evals/cases/public.json";
import {
  PublicEvalCasesSchema,
  type AuthoringEvalCase,
} from "@/evals/types";

export function loadPublicEvalCases(): AuthoringEvalCase[] {
  const cases = PublicEvalCasesSchema.parse(publicCases);
  const ids = cases.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Public eval case IDs must be unique.");
  }
  return cases;
}
