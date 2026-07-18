// GenreGen Pipeline — Express API Server
// POST /api/generate — generates a story video from genre + variables

import express from "express";
import { generateScript } from "../pipeline/script-generator.js";
import { assembleVideo } from "../pipeline/video-assembler.js";
import type { Genre, Platform, GenerateOptions, GenerateResult } from "../pipeline/types.js";
import { mkdirSync, existsSync } from "fs";
import { join } from "path";

const app = express();
app.use(express.json());

// Ensure output directory exists
const outputDir = join(process.cwd(), "output");
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

interface GenerateRequest {
  genre: string;
  variables?: Record<string, string>;
  platform?: string;
  videoLength?: number;
  seriesPart?: number;
  totalSeriesParts?: number;
  hasCta?: boolean;
  ctaText?: string;
}

function validateRequest(body: GenerateRequest): string | null {
  if (!body.genre) return "Missing required field: genre";
  if (!["love", "comedy", "action"].includes(body.genre)) {
    return `Invalid genre "${body.genre}". Must be one of: love, comedy, action`;
  }
  if (body.videoLength !== undefined) {
    if (typeof body.videoLength !== "number" || body.videoLength < 21 || body.videoLength > 34) {
      return "videoLength must be a number between 21 and 34";
    }
  }
  if (body.platform && !["tiktok", "instagram", "facebook", "youtube"].includes(body.platform)) {
    return `Invalid platform "${body.platform}". Must be one of: tiktok, instagram, facebook, youtube`;
  }
  if (body.seriesPart !== undefined && (body.seriesPart < 1 || body.seriesPart > 5)) {
    return "seriesPart must be between 1 and 5";
  }
  return null;
}

// POST /api/generate
app.post("/api/generate", async (req, res) => {
  try {
    const body = req.body as GenerateRequest;

    const validationError = validateRequest(body);
    if (validationError) {
      res.status(400).json({
        storyId: "",
        status: "error",
        error: validationError,
      } satisfies GenerateResult);
      return;
    }

    const options: GenerateOptions = {
      genre: body.genre as Genre,
      variables: body.variables,
      platform: body.platform as Platform | undefined,
      videoLength: body.videoLength,
      seriesPart: body.seriesPart,
      totalSeriesParts: body.totalSeriesParts,
      hasCta: body.hasCta,
      ctaText: body.ctaText,
    };

    // Generate script
    const pipeline = generateScript(options);

    // Generate output filename
    const filename = `genegen-${pipeline.story_id.slice(0, 8)}.mp4`;
    const outputPath = join(outputDir, filename);

    // Assemble video
    await assembleVideo(pipeline, outputPath);

    // Return result
    res.json({
      storyId: pipeline.story_id,
      status: "success",
      downloadUrl: `/output/${filename}`,
      pipelineOutput: pipeline,
    } satisfies GenerateResult);
  } catch (err: any) {
    console.error("Generate error:", err);
    res.status(500).json({
      storyId: "",
      status: "error",
      error: err.message || "Internal server error during video generation",
    } satisfies GenerateResult);
  }
});

// Serve generated videos
app.use("/output", express.static(outputDir));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", version: "0.1.0" });
});

const PORT = parseInt(process.env.PORT || "3001", 10);

app.listen(PORT, () => {
  console.log(`🎬 GenreGen Pipeline API running on http://localhost:${PORT}`);
  console.log(`   POST /api/generate — Generate a story video`);
  console.log(`   GET  /api/health    — Health check`);
});
