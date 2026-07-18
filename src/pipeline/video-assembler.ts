// GenreGen Pipeline — Video Assembler (SVG + ffmpeg)
// Takes PipelineOutput scenes, renders SVG frames, converts to video using ffmpeg.

import { spawnSync } from "child_process";
import { writeFileSync, mkdirSync, readdirSync, unlinkSync, rmdirSync } from "fs";
import { join, resolve } from "path";
import { tmpdir } from "os";
import type { PipelineOutput } from "./types.js";
import { VIDEO } from "./types.js";
import { renderFrameSVG } from "./text-renderer.js";

/**
 * Check that ffmpeg is available.
 */
export function checkFfmpeg(): void {
  try {
    spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  } catch {
    throw new Error(
      "ffmpeg is not installed. Install it with: sudo apt-get install ffmpeg",
    );
  }
}

/**
 * Generate a unique temporary directory.
 */
function createTmpDir(): string {
  const dir = join(
    tmpdir(),
    `genegen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Clean up temporary directory.
 */
function cleanupDir(dir: string): void {
  try {
    const files = readdirSync(dir);
    for (const f of files) {
      unlinkSync(join(dir, f));
    }
    rmdirSync(dir);
  } catch {
    // Best-effort cleanup
  }
}

/**
 * Assembles the pipeline output into a single MP4 video.
 *
 * Strategy:
 * 1. Render one SVG frame per scene
 * 2. Use ffmpeg to convert each SVG → video-only segment
 * 3. Concatenate all segments + silent audio into final video
 */
export async function assembleVideo(
  pipeline: PipelineOutput,
  outputPath: string,
): Promise<string> {
  checkFfmpeg();

  const tmpDir = createTmpDir();
  const segmentFiles: string[] = [];

  try {
    // Step 1: Generate SVG per scene, then convert to video segment (no audio)
    for (const scene of pipeline.scenes) {
      const svg = renderFrameSVG(scene.text_overlay, pipeline.genre);
      const svgFile = join(
        tmpDir,
        `scene_${String(scene.id).padStart(3, "0")}.svg`,
      );
      writeFileSync(svgFile, svg, "utf-8");

      const segmentFile = join(
        tmpDir,
        `seg_${String(scene.id).padStart(3, "0")}.mp4`,
      );

      const duration = scene.duration_seconds;
      // Render SVG to video-only segment (no audio, simpler)
      const ffmpegArgs = [
        "-y",
        "-loop", "1",
        "-i", svgFile,
        "-vf",
        `scale=${VIDEO.width}:${VIDEO.height},fps=${VIDEO.fps},format=yuv420p`,
        "-c:v", VIDEO.codec,
        "-preset", "fast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-t", String(duration),
        "-an",
        segmentFile,
      ];

      try {
        const result = spawnSync("ffmpeg", ffmpegArgs, { stdio: "ignore", timeout: 60000 });
        if (result.status !== 0) {
          throw new Error(`ffmpeg exited with code ${result.status}`);
        }
      } catch (err: any) {
        throw new Error(
          `ffmpeg scene render failed for scene ${scene.id}: ${String(err.message).slice(-300)}`,
        );
      }

      segmentFiles.push(segmentFile);
    }

    // Step 2: Concatenate all segments with silent audio
    const concatFilePath = join(tmpDir, "concat.txt");
    const concatLines: string[] = [];
    for (const seg of segmentFiles) {
      concatLines.push(`file '${seg}'`);
    }
    writeFileSync(concatFilePath, concatLines.join("\n"), "utf-8");

    const totalDuration = pipeline.scenes.reduce(
      (s, sc) => s + sc.duration_seconds,
      0,
    );

    const absOutputPath = resolve(outputPath);
    // Concat video-only segments and add silent audio track
    const concatArgs = [
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", concatFilePath,
      "-f", "lavfi",
      "-i", `anullsrc=r=44100:cl=stereo:duration=${totalDuration}`,
      "-c:v", "copy",
      "-c:a", "aac",
      "-b:a", "128k",
      "-shortest",
      "-movflags", "+faststart",
      absOutputPath,
    ];

    try {
      const result = spawnSync("ffmpeg", concatArgs, { stdio: "ignore", timeout: 120000 });
      if (result.status !== 0) {
        throw new Error(`ffmpeg concat exited with code ${result.status}`);
      }
    } catch (err: any) {
      throw new Error(`ffmpeg concat failed: ${String(err.message).slice(-300)}`);
    }

    return absOutputPath;
  } finally {
    cleanupDir(tmpDir);
  }
}
