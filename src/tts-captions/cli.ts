#!/usr/bin/env node
/**
 * CLI entry point for TTS + captions pipeline.
 *
 * Usage:
 *   npx tsx src/tts-captions/cli.ts --script output/my-script.json
 *   npx tsx src/tts-captions/cli.ts --text "Hook. Body content. CTA." --topic "my-topic"
 *   npx tsx src/tts-captions/cli.ts --script output/my-script.json --voice fable --speed 1.1
 */

import fs from "node:fs";
import path from "node:path";
import { generateVoiceoverWithCaptions } from "./pipeline.js";
import type { Script } from "../script-generator/types.js";
import type { VoiceoverOptions } from "./types.js";
import type { TTSVoice } from "./types.js";

const VALID_VOICES: string[] = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

function parseArgs(): {
  script?: string;
  text?: string;
  topic?: string;
  voice?: TTSVoice;
  speed?: number;
  help: boolean;
} {
  const args = process.argv.slice(2);
  const result: ReturnType<typeof parseArgs> = { help: false };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--script":
        result.script = args[++i];
        break;
      case "--text":
        result.text = args[++i];
        break;
      case "--topic":
        result.topic = args[++i];
        break;
      case "--voice":
        result.voice = args[++i] as TTSVoice;
        break;
      case "--speed":
        result.speed = args[++i] ? parseFloat(args[i]) : undefined;
        break;
      case "--help":
      case "-h":
        result.help = true;
        break;
      default:
        break;
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
ClipFlow TTS + Captions Pipeline

Usage:
  npx tsx src/tts-captions/cli.ts --script <path> [options]
  npx tsx src/tts-captions/cli.ts --text <content> --topic <topic> [options]

Options:
  --script <path>   Path to a JSON file with a Script object
  --text <string>   Raw text to convert (use with --topic)
  --topic <string>  Topic name (required with --text, used for output filename)
  --voice <voice>   TTS voice: alloy, echo, fable, onyx, nova, shimmer (default: nova)
  --speed <number>  Playback speed multiplier 0.25–4.0 (default: 1.0)
  --help, -h        Show this help
`);
}

function loadScriptFromFile(filePath: string): Script {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`Script file not found: ${absPath}`);
  }
  const raw = fs.readFileSync(absPath, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Failed to parse JSON from: ${absPath}`);
  }
  const obj = parsed as Record<string, unknown>;
  for (const key of ["hook", "body", "cta", "topic"]) {
    if (typeof obj[key] !== "string" || (obj[key] as string).trim().length === 0) {
      throw new Error(`Script file is missing required field "${key}"`);
    }
  }
  return {
    hook: obj.hook as string,
    body: obj.body as string,
    cta: obj.cta as string,
    topic: obj.topic as string,
    estimatedDurationSec: typeof obj.estimatedDurationSec === "number" ? obj.estimatedDurationSec : 0,
  };
}

function buildScriptFromText(text: string, topic: string): Script {
  // Simple heuristic: split on sentence boundaries for hook/body/cta
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0);

  let hook = "";
  let body = "";
  let cta = "";

  if (sentences.length === 1) {
    hook = sentences[0];
  } else if (sentences.length === 2) {
    hook = sentences[0];
    cta = sentences[1];
  } else {
    hook = sentences[0];
    cta = sentences[sentences.length - 1];
    body = sentences.slice(1, -1).join(" ");
  }

  const fullText = `${hook} ${body} ${cta}`.trim();
  const wordCount = fullText.split(/\s+/).length;

  return {
    hook,
    body,
    cta,
    topic,
    estimatedDurationSec: Math.round(wordCount / 2.5),
  };
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Validate input
  if (!args.script && !args.text) {
    console.error("Error: Either --script or --text is required.\n");
    printHelp();
    process.exit(1);
  }

  if (args.text && !args.topic) {
    console.error("Error: --topic is required when using --text.\n");
    printHelp();
    process.exit(1);
  }

  // Validate voice if provided
  if (args.voice && !VALID_VOICES.includes(args.voice)) {
    console.error(`Error: Invalid voice "${args.voice}". Must be one of: ${VALID_VOICES.join(", ")}`);
    process.exit(1);
  }

  // Validate speed if provided
  if (args.speed !== undefined && (args.speed < 0.25 || args.speed > 4.0)) {
    console.error("Error: --speed must be between 0.25 and 4.0");
    process.exit(1);
  }

  try {
    let script: Script;

    if (args.script) {
      script = loadScriptFromFile(args.script);
    } else {
      script = buildScriptFromText(args.text!, args.topic!);
    }

    const options: VoiceoverOptions = {};
    if (args.voice) options.voice = args.voice;
    if (args.speed !== undefined) options.speed = args.speed;

    console.log(`Generating voiceover for: "${script.topic}"`);
    console.log(`Voice: ${options.voice ?? "nova"}, Speed: ${options.speed ?? 1.0}`);

    const result = await generateVoiceoverWithCaptions(script, options);

    // Save captions JSON
    const captionsPath = result.audioPath.replace(/\.mp3$/, ".captions.json");
    fs.writeFileSync(captionsPath, JSON.stringify(result.captions, null, 2));

    console.log(`\nDone!`);
    console.log(`  Audio:    ${result.audioPath}`);
    console.log(`  Captions: ${captionsPath}`);
    console.log(`  Duration: ${result.durationSec.toFixed(1)}s`);
    console.log(`  Words:    ${result.captions.words.length}`);
  } catch (err) {
    console.error("Error:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
