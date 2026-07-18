// GenreGen Pipeline — Shared Types

export type Genre = "love" | "comedy" | "action";

export type TextStyle = "hook" | "dialogue" | "caption" | "punchline" | "reaction" | "title";

export type TextPosition = "top" | "center" | "bottom";

export type Platform = "tiktok" | "instagram" | "facebook" | "youtube";

export interface TextOverlay {
  style: TextStyle;
  text: string;
  position: TextPosition;
  duration_seconds: number;
}

export interface SoundCue {
  mood: string;
  sfx: string[];
}

export interface Scene {
  id: number;
  type: string;
  act: 1 | 2 | 3;
  visual_description: string;
  text_overlay: TextOverlay;
  sound: SoundCue;
  duration_seconds: number;
}

export interface Hook {
  type: string;
  text: string;
}

export interface PipelineOutput {
  story_id: string;
  genre: Genre;
  template_name: string;
  total_duration_seconds: number;
  scenes: Scene[];
  hook: Hook;
  variables: Record<string, string | number | boolean | null>;
}

export interface GenerateOptions {
  genre: Genre;
  variables?: Record<string, string>;
  platform?: Platform;
  videoLength?: number; // 21-34 seconds
  seriesPart?: number;
  totalSeriesParts?: number;
  outputPath?: string;
  hasCta?: boolean;
  ctaText?: string;
}

export interface GenerateResult {
  storyId: string;
  status: "success" | "error";
  downloadUrl?: string;
  error?: string;
  pipelineOutput?: PipelineOutput;
}

// Text rendering config per style (from spec §5.2)
export interface TextStyleConfig {
  position: TextPosition;
  fontSize: number;
  color: string;
  fontWeight: string;
  fontStyle: string;
  strokeWidth: number;
  strokeColor: string;
  backgroundAlpha: number; // 0 = transparent
}

export const TEXT_STYLE_CONFIGS: Record<TextStyle, TextStyleConfig> = {
  hook: {
    position: "top",
    fontSize: 48,
    color: "#FFFFFF",
    fontWeight: "bold",
    fontStyle: "normal",
    strokeWidth: 2,
    strokeColor: "#000000",
    backgroundAlpha: 0,
  },
  dialogue: {
    position: "center",
    fontSize: 42,
    color: "#FFFF88",
    fontWeight: "normal",
    fontStyle: "italic",
    strokeWidth: 0,
    strokeColor: "#000000",
    backgroundAlpha: 0,
  },
  caption: {
    position: "bottom",
    fontSize: 36,
    color: "#FFFFFF",
    fontWeight: "normal",
    fontStyle: "normal",
    strokeWidth: 0,
    strokeColor: "#000000",
    backgroundAlpha: 0.5,
  },
  punchline: {
    position: "center",
    fontSize: 52,
    color: "#FFFFFF",
    fontWeight: "bold",
    fontStyle: "normal",
    strokeWidth: 0,
    strokeColor: "#000000",
    backgroundAlpha: 0,
  },
  reaction: {
    position: "center",
    fontSize: 38,
    color: "#FFFFFF",
    fontWeight: "normal",
    fontStyle: "normal",
    strokeWidth: 0,
    strokeColor: "#000000",
    backgroundAlpha: 0,
  },
  title: {
    position: "center",
    fontSize: 56,
    color: "#FFFFFF",
    fontWeight: "normal",
    fontStyle: "normal",
    strokeWidth: 0,
    strokeColor: "#000000",
    backgroundAlpha: 0,
  },
};

// Genre colors for backgrounds
export interface GenreColors {
  primary: string;
  secondary: string;
  accent: string;
}

export const GENRE_COLORS: Record<Genre, GenreColors> = {
  love: {
    primary: "#FF6B9D",
    secondary: "#FFA6C9",
    accent: "#FF1744",
  },
  comedy: {
    primary: "#FFD54F",
    secondary: "#FFB74D",
    accent: "#FF8A65",
  },
  action: {
    primary: "#1A1A2E",
    secondary: "#16213E",
    accent: "#E94560",
  },
};

// Video constants
export const VIDEO = {
  width: 1080,
  height: 1920,
  fps: 30,
  codec: "libx264",
  format: "mp4",
} as const;
