#!/usr/bin/env npx tsx
// GenreGen Pipeline — CLI Entry Point
// Usage: npx tsx src/pipeline/generate.ts --genre love --output ./output.mp4

import { generateScript } from "./script-generator.js";
import { assembleVideo } from "./video-assembler.js";
import type { Genre, Platform, GenerateOptions } from "./types.js";

function parseArgs(): GenerateOptions {
  const args = process.argv.slice(2);
  const options: Partial<GenerateOptions> & { variables?: Record<string, string> } = {
    variables: {},
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const val = args[i + 1];

    switch (arg) {
      case "--genre":
      case "-g":
        if (!val || !["love", "comedy", "action"].includes(val)) {
          console.error("Error: --genre must be one of: love, comedy, action");
          process.exit(1);
        }
        options.genre = val as Genre;
        i++;
        break;
      case "--output":
      case "-o":
        if (!val) {
          console.error("Error: --output requires a file path");
          process.exit(1);
        }
        options.outputPath = val;
        i++;
        break;
      case "--platform":
        if (!val || !["tiktok", "instagram", "facebook", "youtube"].includes(val)) {
          console.error("Error: --platform must be one of: tiktok, instagram, facebook, youtube");
          process.exit(1);
        }
        options.platform = val as Platform;
        i++;
        break;
      case "--length":
      case "-l":
        const len = parseInt(val);
        if (isNaN(len) || len < 21 || len > 34) {
          console.error("Error: --length must be between 21 and 34 seconds");
          process.exit(1);
        }
        options.videoLength = len;
        i++;
        break;
      case "--series":
        const part = parseInt(val);
        if (isNaN(part) || part < 1 || part > 5) {
          console.error("Error: --series must be between 1 and 5");
          process.exit(1);
        }
        options.seriesPart = part;
        i++;
        break;
      case "--total-series":
        const total = parseInt(val);
        if (isNaN(total) || total < 1 || total > 5) {
          console.error("Error: --total-series must be between 1 and 5");
          process.exit(1);
        }
        options.totalSeriesParts = total;
        i++;
        break;
      case "--var":
      case "-v":
        if (val && val.includes("=")) {
          const [key, value] = val.split("=", 2);
          options.variables![key] = value;
          i++;
        }
        break;
      case "--cta":
        options.hasCta = true;
        if (val && !val.startsWith("--")) {
          options.ctaText = val;
          i++;
        }
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        break;
    }
  }

  if (!options.genre) {
    console.error("Error: --genre is required (love, comedy, action)");
    console.error("Usage: npx tsx src/pipeline/generate.ts --genre love --output ./output.mp4");
    process.exit(1);
  }

  if (!options.outputPath) {
    options.outputPath = `./output/genegen-${options.genre}-${Date.now()}.mp4`;
  }

  return options as GenerateOptions;
}

function printHelp(): void {
  console.log(`
GenreGen AI — Video Generation CLI
====================================

Usage:
  npx tsx src/pipeline/generate.ts --genre <genre> [options]

Required:
  --genre, -g     Genre: love, comedy, action

Options:
  --output, -o    Output file path (default: ./output/genegen-{genre}-{timestamp}.mp4)
  --platform      Target platform: tiktok, instagram, facebook, youtube
  --length, -l    Target video length in seconds (21-34)
  --series        Series part number (1-5)
  --total-series  Total series parts (1-5)
  --var, -v       Variable override: key=value (repeatable)
  --cta           Add CTA tag scene (optional custom text)
  --help, -h      Show this help

Examples:
  npx tsx src/pipeline/generate.ts --genre love --output ./my_video.mp4
  npx tsx src/pipeline/generate.ts --genre comedy --length 28 --platform tiktok
  npx tsx src/pipeline/generate.ts --genre action --var setting=warehouse --var intensity=intense
  npx tsx src/pipeline/generate.ts --genre love --series 1 --total-series 3 --cta "Follow for Part 2!"

Platform-specific optimal lengths (from market research):
  TikTok:      21–34s
  Instagram:   15–30s
  Facebook:    15–30s
  YouTube:     15–60s
`);
}

async function main(): Promise<void> {
  console.log("🎬 GenreGen AI — Video Generation Pipeline");
  console.log("==========================================\n");

  const options = parseArgs();

  console.log(`Genre: ${options.genre}`);
  console.log(`Output: ${options.outputPath}`);
  if (options.platform) console.log(`Platform: ${options.platform}`);
  if (options.videoLength) console.log(`Target length: ${options.videoLength}s`);
  if (options.seriesPart) console.log(`Series part: ${options.seriesPart}/${options.totalSeriesParts || "?"}`);
  console.log();

  // Step 1: Generate script
  console.log("📝 Generating script...");
  const pipeline = generateScript(options);
  console.log(`   Story ID: ${pipeline.story_id}`);
  console.log(`   Template: ${pipeline.template_name}`);
  console.log(`   Scenes: ${pipeline.scenes.length}`);
  console.log(`   Duration: ${pipeline.total_duration_seconds}s`);
  console.log(`   Hook: "${pipeline.hook.text.slice(0, 60)}..."`);
  console.log();

  // Step 2: Assemble video
  console.log("🎥 Assembling video...");
  const startTime = Date.now();
  try {
    const outputPath = await assembleVideo(pipeline, options.outputPath!);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Video generated successfully in ${elapsed}s!`);
    console.log(`   File: ${outputPath}`);
  } catch (err: any) {
    console.error(`❌ Video assembly failed: ${err.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
