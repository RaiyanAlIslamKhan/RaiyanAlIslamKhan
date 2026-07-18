import OpenAI from "openai";
import fs from "node:fs";
import path from "node:path";
import type { Script } from "../script-generator/types.js";
import type { VoiceoverOptions } from "./types.js";

const OUTPUT_DIR = path.resolve(process.cwd(), "output");

/** Ensure the output directory exists. */
function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

/** Join script sections into a single spoken string. */
function buildSpokenText(script: Script): string {
  return `${script.hook} ${script.body} ${script.cta}`.trim();
}

/** Estimate audio duration from MP3 file size.
 *  MP3 at ~128 kbps: bytes ≈ duration_sec * 16000. */
function estimateDurationFromFile(filePath: string): number {
  const stats = fs.statSync(filePath);
  const estimatedSec = stats.size / 16000;
  return Math.round(estimatedSec * 100) / 100;
}

/**
 * Generate a voiceover MP3 from a script using OpenAI TTS.
 *
 * @param script  The script to convert to speech.
 * @param options Optional voice and speed settings.
 * @returns Path to the saved MP3 and its estimated duration.
 * @throws If the API key is missing, voice is invalid, or the API fails after retries.
 */
export async function generateVoiceover(
  script: Script,
  options: VoiceoverOptions = {},
): Promise<{ audioPath: string; durationSec: number }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY environment variable is not set. " +
        "Set it in your environment or a .env file before calling generateVoiceover.",
    );
  }

  const voice = options.voice ?? "nova";
  const validVoices: string[] = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
  if (!validVoices.includes(voice)) {
    throw new Error(
      `Invalid voice "${voice}". Must be one of: ${validVoices.join(", ")}`,
    );
  }

  const client = new OpenAI({ apiKey });
  const spokenText = buildSpokenText(script);

  ensureOutputDir();

  // Create a unique filename using timestamp + topic slug
  const slug = script.topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  const timestamp = Date.now();
  const audioPath = path.join(OUTPUT_DIR, `${slug}-${timestamp}.mp3`);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.audio.speech.create({
        model: "tts-1",
        voice: voice as OpenAI.Audio.Speech.SpeechCreateParams["voice"],
        input: spokenText,
        speed: options.speed ?? 1.0,
        response_format: "mp3",
      });

      // Write the MP3 buffer to disk
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(audioPath, buffer);

      const durationSec = estimateDurationFromFile(audioPath);

      return { audioPath, durationSec };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === 0) {
        // Brief pause before retry
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  throw new Error(
    `Voiceover generation failed after 2 attempts: ${lastError?.message ?? "unknown error"}`,
  );
}
