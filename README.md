# GenreGen AI — Video Generation Pipeline

> **"AI that doesn't just edit your video — it writes the story."**

The core video generation engine for GenreGen AI. Turns genre script templates into finished 9:16 vertical videos with text overlays, powered by TypeScript, node-canvas, and ffmpeg.

## Architecture

```
src/
├── pipeline/
│   ├── types.ts              # Shared types, configs, constants
│   ├── script-generator.ts   # Template-based script generation (§5.1 schema)
│   ├── text-renderer.ts      # Canvas text rendering (§5.2 styles)
│   ├── video-assembler.ts    # FFmpeg video encoding
│   ├── generate.ts           # CLI entry point
│   └── templates/
│       ├── love.ts           # Love/Romance "Meet-Cute Arc" (§2)
│       ├── comedy.ts         # Comedy "Escalation Arc" (§3)
│       └── action.ts         # Action "Thriller Arc" (§4)
└── api/
    └── server.ts             # Express API server (POST /api/generate)
```

## Quick Start

### Prerequisites
- **Node.js** 22+
- **ffmpeg** (installed automatically if missing; requires `sudo apt-get install ffmpeg`)

### Install

```bash
npm install
```

### CLI Usage

```bash
# Generate a love story video
npx tsx src/pipeline/generate.ts --genre love --output ./output/my_video.mp4

# Generate a comedy video with specific length
npx tsx src/pipeline/generate.ts --genre comedy --length 28 --platform tiktok

# Generate action with variable overrides
npx tsx src/pipeline/generate.ts --genre action --var setting=warehouse --var intensity=intense

# Series mode
npx tsx src/pipeline/generate.ts --genre love --series 1 --total-series 3 --cta "Follow for Part 2!"
```

### API Server

```bash
npx tsx src/api/server.ts
# Server runs on http://localhost:3001
```

**POST /api/generate**

```json
{
  "genre": "love",
  "variables": { "setting": "park", "tone": "bittersweet" },
  "platform": "tiktok",
  "videoLength": 28,
  "hasCta": true,
  "ctaText": "Follow for more!"
}
```

Response:
```json
{
  "storyId": "uuid",
  "status": "success",
  "downloadUrl": "/output/genegen-abc12345.mp4",
  "pipelineOutput": { ... }
}
```

## Video Specs

| Property | Value |
|----------|-------|
| Resolution | 1080×1920 (9:16 vertical) |
| Codec | H.264 (libx264) |
| Format | MP4 |
| FPS | 30 |
| Duration | 21–34 seconds |
| Scenes | 6–8 per story |

## Text Overlay Styles (§5.2)

| Style | Position | Font Size | Color |
|-------|----------|-----------|-------|
| `hook` | top | 48px | White bold, 2px black stroke |
| `dialogue` | center | 42px | Yellow/white italic |
| `caption` | bottom | 36px | White on semi-transparent bg |
| `punchline` | center | 52px | White bold |
| `reaction` | center | 38px | White |
| `title` | center | 56px | White |

## Genre Templates

### Love — "The Meet-Cute Arc" (28–30s)
Act 1 (0–8s): The Spark → Act 2 (8–22s): The Tension → Act 3 (22–28s): The Payoff

### Comedy — "The Escalation Arc" (24–28s)
Act 1 (0–7s): The Setup → Act 2 (7–22s): The Escalation → Act 3 (22–28s): The Punchline

### Action — "The Thriller Arc" (28–32s)
Act 1 (0–7s): The Inciting Incident → Act 2 (7–22s): The Rising Stakes → Act 3 (22–30s): The Climax

## Development

```bash
npm run dev      # Start API server with watch mode
npm run build    # Compile TypeScript
```

## Reference

- Script templates specification: `/home/team/shared/script-templates.md`
- Market research: `/home/team/shared/market-research.md`
