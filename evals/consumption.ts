import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

import { answerIsCorrect } from "./scoring";
import {
  type ConsumptionResult,
  type AuthoringEvalCase,
  type ModelUsage,
} from "./types";

export const CONSUMPTION_PROMPT_VERSION = "consumption-v1";

const consumptionAnswerSchema = z.object({
  id: z.string().min(1),
  answer: z.string(),
});

const consumptionOutputSchema = z.object({
  answers: z.array(consumptionAnswerSchema),
});

function usageFromResponse(response: {
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  } | null;
}): ModelUsage {
  return {
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
    totalTokens: response.usage?.total_tokens ?? null,
  };
}

export async function runConsumptionEval({
  evalCase,
  modality,
  resource,
  model = process.env.OPENAI_MODEL ?? "gpt-5-mini",
}: {
  evalCase: AuthoringEvalCase;
  modality: "html" | "json" | "markdown";
  resource: string;
  model?: string;
}): Promise<ConsumptionResult> {
  const client = new OpenAI();

  try {
    const response = await client.responses.parse({
      model,
      input: [
        {
          role: "system",
          content:
            "You are an unfamiliar web-research agent. Answer only from the supplied resource. Do not assume knowledge of its authoring framework. Return one concise answer for every question ID.",
        },
        {
          role: "user",
          content: `Resource format: ${modality}

Resource:
${resource}

Questions:
${evalCase.questions
  .map((question) => `- ${question.id}: ${question.prompt}`)
  .join("\n")}`,
        },
      ],
      text: {
        format: zodTextFormat(
          consumptionOutputSchema,
          `surface_consumption_${CONSUMPTION_PROMPT_VERSION}`,
        ),
      },
    });

    if (!response.output_parsed) {
      throw new Error("The consumption agent returned no parsed output.");
    }

    const answersById = new Map(
      response.output_parsed.answers.map((answer) => [answer.id, answer]),
    );
    const answers = evalCase.questions.map((question) => {
      const answer = answersById.get(question.id)?.answer ?? "";
      return {
        id: question.id,
        answer,
        correct: answerIsCorrect(answer, question.acceptedAnswers),
      };
    });

    return {
      modality,
      accuracy:
        answers.length === 0
          ? 1
          : answers.filter((answer) => answer.correct).length / answers.length,
      answers,
      usage: usageFromResponse(response),
      error: null,
    };
  } catch (error) {
    return {
      modality,
      accuracy: 0,
      answers: [],
      usage: {
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
      },
      error: error instanceof Error ? error.message : "Unknown consumption error",
    };
  }
}
