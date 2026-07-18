import OpenAI from "openai";
import fs from "node:fs";
import type { CaptionResult, CaptionWord } from "./types.js";

/**
 * Generate word-level captions from an audio file using OpenAI Whisper.
 *
 * @param audioPath Absolute path to the MP3 audio file.
 * @returns Caption data with word-level timings.
 * @throws If the API key is missing, audio file is not found, or the API fails after retries.
 */
export async function generateCaptions(audioPath: string): Promise<CaptionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY environment variable is not set. " +
        "Set it in your environment or a .env file before calling generateCaptions.",
    );
  }

  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  const client = new OpenAI({ apiKey });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const transcription = await client.audio.transcriptions.create({
        model: "whisper-1",
        file: fs.createReadStream(audioPath),
        response_format: "verbose_json",
        timestamp_granularities: ["word"],
      });

      // Extract word-level timestamps
      const words: CaptionWord[] = (transcription.words ?? []).map((w) => ({
        text: w.word,
        startMs: Math.round(w.start * 1000),
        endMs: Math.round(w.end * 1000),
      }));

      const fullText = words.map((w) => w.text).join(" ");

      return { words, fullText };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === 0) {
        // Brief pause before retry
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  throw new Error(
    `Caption generation failed after 2 attempts: ${lastError?.message ?? "unknown error"}`,
  );
}
