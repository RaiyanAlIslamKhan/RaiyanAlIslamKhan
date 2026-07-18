// GenreGen Pipeline — Text Overlay Renderer (SVG-based)
// Generates SVG frame strings with gradient backgrounds and styled text.
// Reference: §5.2 of script-templates.md

import type { TextOverlay, TextStyle, TextPosition, Genre } from "./types.js";
import { TEXT_STYLE_CONFIGS, GENRE_COLORS, VIDEO } from "./types.js";

const W = VIDEO.width;
const H = VIDEO.height;

/**
 * Generate an SVG string for a single frame with genre background and text overlay.
 */
export function renderFrameSVG(
  textOverlay: TextOverlay,
  genre: Genre,
): string {
  const colors = GENRE_COLORS[genre];
  const styleConfig = TEXT_STYLE_CONFIGS[textOverlay.style];
  const { fontSize, color, fontWeight, fontStyle, strokeWidth, strokeColor, backgroundAlpha } =
    styleConfig;
  const position = textOverlay.position;

  // Calculate Y position
  let yRatio: number;
  switch (position) {
    case "top":
      yRatio = 0.12;
      break;
    case "center":
      yRatio = 0.5;
      break;
    case "bottom":
      yRatio = 0.88;
      break;
  }

  // Escape text for SVG
  const escapedText = escapeXml(textOverlay.text);

  // Build SVG parts
  const svgParts: string[] = [];

  svgParts.push(
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `  <defs>`,
    `    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">`,
    `      <stop offset="0%" style="stop-color:${colors.primary}"/>`,
    `      <stop offset="50%" style="stop-color:${colors.secondary}"/>`,
    `      <stop offset="100%" style="stop-color:${colors.accent}"/>`,
    `    </linearGradient>`,
  );

  // Add a drop-shadow filter for stroke effect
  if (strokeWidth > 0) {
    svgParts.push(
      `    <filter id="textStroke" x="-10%" y="-10%" width="120%" height="120%">`,
      `      <feMorphology in="SourceAlpha" operator="dilate" radius="${strokeWidth}" result="expanded"/>`,
      `      <feFlood flood-color="${strokeColor}" result="strokeColor"/>`,
      `      <feComposite in="strokeColor" in2="expanded" operator="in" result="stroke"/>`,
      `      <feMerge>`,
      `        <feMergeNode in="stroke"/>`,
      `        <feMergeNode in="SourceGraphic"/>`,
      `      </feMerge>`,
      `    </filter>`,
    );
  }

  svgParts.push(`  </defs>`);

  // Background rect
  svgParts.push(`  <rect width="${W}" height="${H}" fill="url(#bg)"/>`);

  // Text background (for caption style with semi-transparent bg)
  if (backgroundAlpha > 0) {
    const bgPadding = 24;
    const bgWidth = W - 160; // padding on each side
    const bgHeight = fontSize * 1.8;
    const bgX = (W - bgWidth) / 2;
    const bgY = (H * yRatio) - bgHeight / 2;
    const bgRx = 12;

    svgParts.push(
      `  <rect x="${bgX}" y="${bgY}" width="${bgWidth}" height="${bgHeight}" rx="${bgRx}" ry="${bgRx}" fill="rgba(0,0,0,${backgroundAlpha})"/>`,
    );
  }

  // Text element
  const fontFamily = "Arial, Helvetica, sans-serif";
  const textAnchor = "middle";
  const dominantBaseline = "central";
  const filterAttr = strokeWidth > 0 ? ` filter="url(#textStroke)"` : "";

  svgParts.push(
    `  <text x="${W / 2}" y="${H * yRatio}"`,
    `    font-family="${fontFamily}" font-size="${fontSize}"`,
    `    font-weight="${fontWeight}" font-style="${fontStyle}"`,
    `    fill="${color}" text-anchor="${textAnchor}"`,
    `    dominant-baseline="${dominantBaseline}"${filterAttr}>`,
  );

  // Handle multiline (wrap at ~70 chars for readability)
  const lines = wrapTextSimple(escapedText, 28);
  if (lines.length === 1) {
    svgParts.push(`    ${lines[0]}`);
  } else {
    const lineHeight = fontSize * 1.3;
    const startY = H * yRatio - ((lines.length - 1) * lineHeight) / 2;
    for (let i = 0; i < lines.length; i++) {
      const y = startY + i * lineHeight;
      svgParts.push(
        `    <tspan x="${W / 2}" y="${y}">${lines[i]}</tspan>`,
      );
    }
  }

  svgParts.push(`  </text>`);
  svgParts.push(`</svg>`);

  return svgParts.join("\n");
}

/**
 * Simple word-wrap for SVG text. Splits at word boundaries.
 */
function wrapTextSimple(text: string, maxCharsPerLine: number): string[] {
  // SVG doesn't auto-wrap, so we do manual word-wrap
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [text];
}

/**
 * Escape XML special characters.
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
