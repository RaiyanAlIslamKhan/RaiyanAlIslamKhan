import express from "express";
import fs from "node:fs";
import path from "node:path";
import type { VideoMeta, VideoStatus } from "./types.js";

const app = express();
app.use(express.json());

const OUTPUT_DIR = path.resolve(process.cwd(), "output");
const PUBLIC_DIR = path.resolve(import.meta.dirname, "public");

// ── Serve static dashboard ────────────────────────────────────────────
app.use(express.static(PUBLIC_DIR));

// ── Helpers ────────────────────────────────────────────────────────────

function loadMeta(): VideoMeta[] {
  if (!fs.existsSync(OUTPUT_DIR)) return [];
  const metas: VideoMeta[] = [];
  for (const file of fs.readdirSync(OUTPUT_DIR)) {
    if (file.endsWith(".meta.json")) {
      try {
        const raw = fs.readFileSync(path.join(OUTPUT_DIR, file), "utf-8");
        metas.push(JSON.parse(raw) as VideoMeta);
      } catch {
        // skip malformed files
      }
    }
  }
  return metas.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function saveMeta(meta: VideoMeta): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  fs.writeFileSync(
    path.join(OUTPUT_DIR, `${meta.id}.meta.json`),
    JSON.stringify(meta, null, 2),
  );
}

function updateStatus(id: string, status: VideoStatus): VideoMeta | null {
  const metaPath = path.join(OUTPUT_DIR, `${id}.meta.json`);
  if (!fs.existsSync(metaPath)) return null;
  const meta: VideoMeta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
  meta.status = status;
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  return meta;
}

// ── API Endpoints ──────────────────────────────────────────────────────

/** List all videos in the queue. */
app.get("/api/videos", (_req, res) => {
  try {
    const videos = loadMeta();
    // Return relative paths for the frontend
    const result = videos.map((v) => ({
      ...v,
      mp4Path: v.mp4Path.replace(OUTPUT_DIR, "/output"),
      captionsPath: v.captionsPath.replace(OUTPUT_DIR, "/output"),
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to load videos" });
  }
});

/** Approve a video. */
app.post("/api/videos/:id/approve", (req, res) => {
  const updated = updateStatus(req.params.id, "approved");
  if (!updated) {
    res.status(404).json({ error: "Video not found" });
    return;
  }
  res.json(updated);
});

/** Reject a video. */
app.post("/api/videos/:id/reject", (req, res) => {
  const updated = updateStatus(req.params.id, "rejected");
  if (!updated) {
    res.status(404).json({ error: "Video not found" });
    return;
  }
  res.json(updated);
});

/** Serve video files from output directory. */
app.use("/output", express.static(OUTPUT_DIR));

// ── Start ──────────────────────────────────────────────────────────────

const PORT = process.env.REVIEW_UI_PORT
  ? parseInt(process.env.REVIEW_UI_PORT)
  : 3001;

export function startServer(port: number = PORT): ReturnType<typeof app.listen> {
  return app.listen(port, () => {
    console.log(`ClipFlow Review UI: http://localhost:${port}`);
  });
}

// Only start when run directly
if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  startServer();
}

export { app };
