import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import type { RenderInput, RenderResult } from "./types.js";
import { FORMAT_RESOLUTIONS } from "./types.js";
import type { CaptionWord } from "../tts-captions/types.js";

const execFileAsync = promisify(execFile);

/** Number of words grouped into a single caption phrase. */
const WORDS_PER_PHRASE = 4;

/** Internal representation of a timed caption phrase. */
interface CaptionPhrase {
  text: string;
  startSec: number;
  endSec: number;
}

/**
 * Group word-level captions into multi-word phrases for display.
 * Uses first word's startMs and last word's endMs for timing.
 */
function groupWordsIntoPhrases(
  words: CaptionWord[],
  maxWords: number = WORDS_PER_PHRASE,
): CaptionPhrase[] {
  const phrases: CaptionPhrase[] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    const chunk = words.slice(i, i + maxWords);
    const text = chunk.map((w) => w.text).join(" ");
    const startSec = chunk[0].startMs / 1000;
    const endSec = chunk[chunk.length - 1].endMs / 1000;
    phrases.push({ text, startSec, endSec });
  }
  return phrases;
}

/**
 * Escape special characters in drawtext text values.
 * FFmpeg drawtext treats : \ ' % { } as special.
 */
function escapeDrawtextText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}");
}

/**
 * Return the y-position expression for drawtext based on captionPosition.
 */
function buildYPosition(position: "center" | "bottom"): string {
  if (position === "center") {
    return "(h-text_h)/2";
  }
  // Bottom: 100px from the bottom edge
  return "h-text_h-100";
}

/**
 * Assemble a short-form video from a script, voiceover, captions, and template
 * by shelling out to FFmpeg.  Returns metadata about the rendered file.
 *
 * The generated FFmpeg command:
 *   1. Creates / scales the background canvas at the target resolution.
 *   2. Burns in each caption phrase using `drawtext` with `enable='between(t,S,E)'`.
 *   3. Overlays the voiceover audio track.
 *   4. Encodes to H.264 + AAC MP4.
 */
export async function renderVideo(input: RenderInput): Promise<RenderResult> {
  const { script, voiceover, captions, template, outputPath, format } = input;

  const resolution = FORMAT_RESOLUTIONS[format];
  if (!resolution) {
    throw new Error(`Unsupported format: ${format}. Valid: 9:16, 1:1, 16:9`);
  }

  // ── Validate inputs ──────────────────────────────────────────────
  if (!fs.existsSync(voiceover.audioPath)) {
    throw new Error(`Voiceover audio file not found: ${voiceover.audioPath}`);
  }

  if (
    template.background.type === "image" &&
    !fs.existsSync(template.background.value)
  ) {
    throw new Error(
      `Background image file not found: ${template.background.value}`,
    );
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // ── Group captions into display phrases ──────────────────────────
  const phrases = groupWordsIntoPhrases(captions.words);

  // ── Build the FFmpeg argument list ───────────────────────────────
  const args: string[] = [];

  // --- Input #0: background ---
  if (template.background.type === "color") {
    // Convert "#RRGGBB" → "0xRRGGBB" for lavfi color source
    const color = template.background.value.replace(/^#/, "0x");
    args.push(
      "-f", "lavfi",
      "-i",
      `color=c=${color}:s=${resolution.width}x${resolution.height}:d=${voiceover.durationSec}`,
    );
  } else {
    args.push("-loop", "1", "-i", template.background.value);
  }

  // --- Input #1: audio ---
  args.push("-i", voiceover.audioPath);

  // --- Build filter_complex ---
  const font = template.font;
  const borderPart = font.borderColor
    ? `:bordercolor=${font.borderColor}:borderw=2`
    : "";
  const yPos = buildYPosition(template.layout.captionPosition);

  const parts: string[] = [];

  // Step 1: prepare background
  if (template.background.type === "image") {
    parts.push(
      `[0:v]scale=${resolution.width}:${resolution.height}:force_original_aspect_ratio=increase,crop=${resolution.width}:${resolution.height},setsar=1[bg]`,
    );
  } else {
    parts.push(`[0:v]null[bg]`);
  }

  // Step 2: chain drawtext filters, one per phrase
  let lastLabel = "bg";
  for (let i = 0; i < phrases.length; i++) {
    const phrase = phrases[i];
    const escaped = escapeDrawtextText(phrase.text);
    const outLabel = `c${i}`;

    parts.push(
      `[${lastLabel}]drawtext=text='${escaped}':fontsize=${font.size}:fontcolor=${font.color}${borderPart}:x=(w-text_w)/2:y=${yPos}:enable='between(t,${phrase.startSec},${phrase.endSec})'[${outLabel}]`,
    );
    lastLabel = outLabel;
  }

  // Final output label
  const videoOutLabel = "outv";
  parts.push(`[${lastLabel}]null[${videoOutLabel}]`);

  const filterComplex = parts.join(";");

  args.push("-filter_complex", filterComplex);

  // --- Map outputs ---
  args.push("-map", `[${videoOutLabel}]`);
  args.push("-map", "1:a:0");

  // --- Codec / encoding settings ---
  args.push(
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "23",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "128k",
    "-shortest",
    "-y",
    outputPath,
  );

  // ── Execute FFmpeg ───────────────────────────────────────────────
  try {
    await execFileAsync("ffmpeg", args);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`FFmpeg rendering failed: ${message}`);
  }

  // ── Gather result metadata ───────────────────────────────────────
  if (!fs.existsSync(outputPath)) {
    throw new Error(
      `FFmpeg completed but output file was not created: ${outputPath}`,
    );
  }

  const stat = fs.statSync(outputPath);

  return {
    outputPath,
    durationSec: voiceover.durationSec,
    fileSizeBytes: stat.size,
  };
}

/**
 * Exported for testing: build the FFmpeg argument list without executing.
 * Returns the full arguments array and filter_complex string for assertions.
 */
export function buildRenderCommand(input: RenderInput): {
  args: string[];
  filterComplex: string;
} {
  const { voiceover, captions, template, format } = input;

  const resolution = FORMAT_RESOLUTIONS[format];
  if (!resolution) {
    throw new Error(`Unsupported format: ${format}`);
  }

  const args: string[] = [];

  // Input #0: background
  if (template.background.type === "color") {
    const color = template.background.value.replace(/^#/, "0x");
    args.push(
      "-f", "lavfi",
      "-i",
      `color=c=${color}:s=${resolution.width}x${resolution.height}:d=${voiceover.durationSec}`,
    );
  } else {
    args.push("-loop", "1", "-i", template.background.value);
  }

  // Input #1: audio
  args.push("-i", voiceover.audioPath);

  // Build filter_complex
  const font = template.font;
  const borderPart = font.borderColor
    ? `:bordercolor=${font.borderColor}:borderw=2`
    : "";
  const yPos = buildYPosition(template.layout.captionPosition);

  const phrases = groupWordsIntoPhrases(captions.words);
  const parts: string[] = [];

  if (template.background.type === "image") {
    parts.push(
      `[0:v]scale=${resolution.width}:${resolution.height}:force_original_aspect_ratio=increase,crop=${resolution.width}:${resolution.height},setsar=1[bg]`,
    );
  } else {
    parts.push(`[0:v]null[bg]`);
  }

  let lastLabel = "bg";
  for (let i = 0; i < phrases.length; i++) {
    const phrase = phrases[i];
    const escaped = escapeDrawtextText(phrase.text);
    const outLabel = `c${i}`;
    parts.push(
      `[${lastLabel}]drawtext=text='${escaped}':fontsize=${font.size}:fontcolor=${font.color}${borderPart}:x=(w-text_w)/2:y=${yPos}:enable='between(t,${phrase.startSec},${phrase.endSec})'[${outLabel}]`,
    );
    lastLabel = outLabel;
  }

  const videoOutLabel = "outv";
  parts.push(`[${lastLabel}]null[${videoOutLabel}]`);

  const filterComplex = parts.join(";");

  args.push("-filter_complex", filterComplex);
  args.push("-map", `[${videoOutLabel}]`);
  args.push("-map", "1:a:0");
  args.push(
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "23",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "128k",
    "-shortest",
    "-y",
    input.outputPath,
  );

  return { args, filterComplex };
}
