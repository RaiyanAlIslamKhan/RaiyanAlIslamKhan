import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { app } from "../server.js";

const OUTPUT_DIR = path.resolve(process.cwd(), "output");

let server: ReturnType<typeof app.listen>;
let baseUrl: string;

function setupTestMeta() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const meta = {
    id: "test-video-1",
    topic: "morning routines",
    mp4Path: path.join(OUTPUT_DIR, "test-video-1.mp4"),
    captionsPath: path.join(OUTPUT_DIR, "test-video-1.captions.json"),
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "test-video-1.meta.json"),
    JSON.stringify(meta, null, 2),
  );
  // Create a dummy MP4
  fs.writeFileSync(path.join(OUTPUT_DIR, "test-video-1.mp4"), Buffer.alloc(1024));
  return meta;
}

function cleanupTestData() {
  if (fs.existsSync(OUTPUT_DIR)) {
    for (const file of fs.readdirSync(OUTPUT_DIR)) {
      if (file.startsWith("test-")) {
        try { fs.unlinkSync(path.join(OUTPUT_DIR, file)); } catch { /* ignore */ }
      }
    }
  }
}

function fetchApi(url: string, options: RequestInit = {}): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `${baseUrl}${url}`,
      { method: options.method || "GET", headers: { "Content-Type": "application/json", ...(options.headers as Record<string, string>) } },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode || 0, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode || 0, body: data });
          }
        });
      },
    );
    req.on("error", reject);
    if (options.body) req.write(options.body as string);
    req.end();
  });
}

describe("Review UI Server", () => {
  beforeAll(async () => {
    server = app.listen(0); // random port
    const addr = server.address() as AddressInfo;
    baseUrl = `http://localhost:${addr.port}`;
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    setupTestMeta();
  });

  afterEach(() => {
    cleanupTestData();
  });

  // ── GET /api/videos ────────────────────────────────────────────────
  describe("GET /api/videos", () => {
    it("returns video list with metadata", async () => {
      const { status, body } = await fetchApi("/api/videos");
      expect(status).toBe(200);
      const videos = body as Array<Record<string, unknown>>;
      expect(videos.length).toBeGreaterThanOrEqual(1);
      const video = videos.find((v) => v.id === "test-video-1");
      expect(video).toBeDefined();
      expect(video!.topic).toBe("morning routines");
      expect(video!.status).toBe("pending");
      expect(video!.mp4Path).toBe("/output/test-video-1.mp4");
    });

    it("returns empty array when no videos exist", async () => {
      cleanupTestData();
      const { status, body } = await fetchApi("/api/videos");
      expect(status).toBe(200);
      expect(body).toEqual([]);
    });
  });

  // ── POST /api/videos/:id/approve ───────────────────────────────────
  describe("POST /api/videos/:id/approve", () => {
    it("approves a pending video", async () => {
      const { status, body } = await fetchApi("/api/videos/test-video-1/approve", { method: "POST" });
      expect(status).toBe(200);
      expect((body as Record<string, unknown>).status).toBe("approved");

      // Verify on disk
      const raw = fs.readFileSync(path.join(OUTPUT_DIR, "test-video-1.meta.json"), "utf-8");
      expect(JSON.parse(raw).status).toBe("approved");
    });

    it("returns 404 for non-existent video", async () => {
      const { status } = await fetchApi("/api/videos/nonexistent/approve", { method: "POST" });
      expect(status).toBe(404);
    });
  });

  // ── POST /api/videos/:id/reject ────────────────────────────────────
  describe("POST /api/videos/:id/reject", () => {
    it("rejects a pending video", async () => {
      const { status, body } = await fetchApi("/api/videos/test-video-1/reject", { method: "POST" });
      expect(status).toBe(200);
      expect((body as Record<string, unknown>).status).toBe("rejected");
    });

    it("returns 404 for non-existent video", async () => {
      const { status } = await fetchApi("/api/videos/nonexistent/reject", { method: "POST" });
      expect(status).toBe(404);
    });
  });

  // ── Static file serving ────────────────────────────────────────────
  describe("static serving", () => {
    it("serves the dashboard HTML", async () => {
      const { status, body } = await fetchApi("/");
      expect(status).toBe(200);
      expect(typeof body).toBe("string");
      expect((body as string)).toContain("ClipFlow");
    });

    it("serves video files from /output", async () => {
      const { status } = await fetchApi("/output/test-video-1.mp4");
      expect(status).toBe(200);
    });
  });
});
