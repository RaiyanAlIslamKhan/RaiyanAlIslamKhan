import type { VideoTemplate } from "./types.js";

/**
 * Default TikTok-style template.
 * 9:16 vertical, captions centered, bold white text with dark border.
 */
export function defaultTikTokTemplate(): VideoTemplate {
  return {
    background: { type: "color", value: "#1A1A2E" },
    font: {
      family: "Arial",
      size: 64,
      color: "white",
      borderColor: "black",
    },
    layout: {
      captionPosition: "center",
      captionMaxWidth: 900,
    },
  };
}

/**
 * Default Instagram Reels template.
 * 9:16 vertical, captions centered, bold white text with dark border.
 */
export function defaultReelsTemplate(): VideoTemplate {
  return {
    background: { type: "color", value: "#16213E" },
    font: {
      family: "Arial",
      size: 60,
      color: "white",
      borderColor: "black",
    },
    layout: {
      captionPosition: "center",
      captionMaxWidth: 900,
    },
  };
}

/**
 * Default YouTube Shorts template.
 * 9:16 vertical, captions centered, bold white text with dark border.
 */
export function defaultShortsTemplate(): VideoTemplate {
  return {
    background: { type: "color", value: "#0F3460" },
    font: {
      family: "Arial",
      size: 62,
      color: "white",
      borderColor: "black",
    },
    layout: {
      captionPosition: "center",
      captionMaxWidth: 920,
    },
  };
}
