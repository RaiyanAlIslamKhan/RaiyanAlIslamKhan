import OpenAI from "openai";
import type { Script, GenerateOptions, OpenAIScriptResponse } from "./types.js";

const SYSTEM_PROMPT = `You are a professional short-form video scriptwriter. Your job is to produce punchy, engaging scripts designed for TikTok, YouTube Shorts, and Instagram Reels.

RULES:
- The script must have exactly three parts: hook, body, cta.
- The hook must grab attention within the first 3 seconds of spoken content (~7 words).
- The body must deliver clear value — a tip, insight, or story related to the topic.
- The CTA must drive engagement (like, comment, follow, share).
- Total spoken word count should be 75–150 words (roughly 30–60 seconds at ~2.5 words/sec).
- Write in a natural, conversational tone suitable for voiceover.
- Return valid JSON with exactly these keys: "hook", "body", "cta".`;

const USER_PROMPT_TEMPLATE = (
  topic: string,
  tone: string | undefined,
  durationSec: number,
) => {
  const toneHint = tone ? ` Use a "${tone}" tone.` : "";
  const durationHint = ` Target approximately ${durationSec} seconds of spoken content (~${Math.round(durationSec * 2.5)} words).`;
  return `Write a short-form video script about: "${topic}".${toneHint}${durationHint}`;
};

/** Estimate spoken duration from word count (2.5 words/sec, industry average). */
function estimateDuration(wordCount: number): number {
  return Math.round(wordCount / 2.5);
}

function validateResponse(data: unknown): OpenAIScriptResponse {
  if (typeof data !== "object" || data === null) {
    throw new Error("OpenAI response is not an object");
  }
  const obj = data as Record<string, unknown>;
  for (const key of ["hook", "body", "cta"]) {
    if (typeof obj[key] !== "string" || (obj[key] as string).trim().length === 0) {
      throw new Error(`OpenAI response missing or invalid field: "${key}"`);
    }
  }
  return { hook: obj.hook as string, body: obj.body as string, cta: obj.cta as string };
}

/**
 * Generate a structured short-form video script for the given topic.
 *
 * @param topic   The topic or idea for the video script.
 * @param options Optional tone and target duration.
 * @returns A structured {@link Script}.
 * @throws If the API key is missing, or the API fails after a retry, or the response is malformed.
 */
export async function generateScript(
  topic: string,
  options: GenerateOptions = {},
): Promise<Script> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY environment variable is not set. " +
        "Set it in your environment or a .env file before calling generateScript.",
    );
  }

  const client = new OpenAI({ apiKey });
  const durationSec = Math.min(60, Math.max(30, options.durationSec ?? 45));
  const userPrompt = USER_PROMPT_TEMPLATE(topic, options.tone, durationSec);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
        max_tokens: 500,
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw) {
        throw new Error("OpenAI returned an empty response");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error(`Failed to parse OpenAI response as JSON. Raw: ${raw.slice(0, 200)}`);
      }

      const validated = validateResponse(parsed);
      const fullText = `${validated.hook} ${validated.body} ${validated.cta}`;
      const wordCount = fullText.trim().split(/\s+/).length;

      return {
        hook: validated.hook.trim(),
        body: validated.body.trim(),
        cta: validated.cta.trim(),
        estimatedDurationSec: estimateDuration(wordCount),
        topic,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === 0) {
        // Brief pause before retry
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  throw new Error(
    `Script generation failed after 2 attempts: ${lastError?.message ?? "unknown error"}`,
  );
}
