import type { Script } from "../script-generator/types.js";
import type { CaptionResult } from "../tts-captions/types.js";

/** Supported video aspect ratios / platform formats. */
export type VideoFormat = "9:16" | "1:1" | "16:9";

/** Background configuration for the video canvas. */
export type BackgroundConfig =
  | { type: "color"; value: string }
  | { type: "image"; value: string };

/** Font / text style for burned-in captions. */
export interface FontConfig {
  /** Font family name (must be available on the system running FFmpeg). */
  family: string;
  /** Font size in pixels. */
  size: number;
  /** Text color as an FFmpeg-compatible color string (e.g. "white", "#FFFFFF"). */
  color: string;
  /** Optional border/stroke color (e.g. "black", "#000000"). */
  borderColor?: string;
}

/** Layout options for caption placement. */
export interface LayoutConfig {
  /** Vertical position of captions on the canvas. */
  captionPosition: "center" | "bottom";
  /** Maximum width for caption text before wrapping, in pixels. */
  captionMaxWidth: number;
}

/** Full visual template defining how the video looks. */
export interface VideoTemplate {
  /** Background canvas configuration. */
  background: BackgroundConfig;
  /** Font / text styling for captions. */
  font: FontConfig;
  /** Layout / positioning configuration. */
  layout: LayoutConfig;
}

/** Input passed to renderVideo(). */
export interface RenderInput {
  /** The original script (used for metadata, not rendered directly). */
  script: Script;
  /** Path to the generated voiceover MP3 + its known duration. */
  voiceover: {
    audioPath: string;
    durationSec: number;
  };
  /** Word-level caption data with millisecond timestamps. */
  captions: CaptionResult;
  /** Visual template controlling appearance. */
  template: VideoTemplate;
  /** Absolute path where the output MP4 should be written. */
  outputPath: string;
  /** Target aspect ratio. */
  format: VideoFormat;
}

/** Result returned by renderVideo(). */
export interface RenderResult {
  /** Absolute path to the rendered MP4 file. */
  outputPath: string;
  /** Duration of the rendered video in seconds. */
  durationSec: number;
  /** File size of the rendered video in bytes. */
  fileSizeBytes: number;
}

/** Resolution presets keyed by format. */
export const FORMAT_RESOLUTIONS: Record<VideoFormat, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "16:9": { width: 1920, height: 1080 },
};
