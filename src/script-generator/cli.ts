#!/usr/bin/env node
/**
 * CLI entry point for the script generator.
 *
 * Usage:
 *   npx tsx src/script-generator/cli.ts --topic "why morning routines fail"
 *   npx tsx src/script-generator/cli.ts --topic "fitness myths" --tone "humorous" --duration 30
 */

import { generateScript } from "./generator.js";

function parseArgs(): { topic: string; tone?: string; duration?: number } {
  const args = process.argv.slice(2);
  const result: { topic: string; tone?: string; duration?: number } = { topic: "" };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--topic":
        result.topic = args[++i] ?? "";
        break;
      case "--tone":
        result.tone = args[++i];
        break;
      case "--duration":
        result.duration = args[++i] ? parseInt(args[i], 10) : undefined;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        // Ignore unknown flags
        break;
    }
  }

  if (!result.topic) {
    console.error("Error: --topic is required.\n");
    printHelp();
    process.exit(1);
  }

  return result;
}

function printHelp(): void {
  console.log(`
ClipFlow Script Generator

Usage: npx tsx src/script-generator/cli.ts --topic <topic> [options]

Options:
  --topic <string>     The video topic (required)
  --tone <string>      Desired tone: professional, casual, humorous, etc.
  --duration <seconds> Target duration in seconds (30-60, default: 45)
  --help, -h           Show this help
`);
}

async function main(): Promise<void> {
  const { topic, tone, duration } = parseArgs();

  try {
    const script = await generateScript(topic, { tone, durationSec: duration });
    console.log(JSON.stringify(script, null, 2));
  } catch (err) {
    console.error("Error:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
