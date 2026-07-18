import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildRenderCommand, renderVideo } from "../renderer.js";
import {
  defaultTikTokTemplate,
  defaultReelsTemplate,
  defaultShortsTemplate,
} from "../templates.js";
import { FORMAT_RESOLUTIONS } from "../types.js";
import type { RenderInput, VideoTemplate } from "../types.js";
import type { Script } from "../../script-generator/types.js";
import type { CaptionResult, CaptionWord } from "../../tts-captions/types.js";

// ── Helpers ──────────────────────────────────────────────────────────────

function setupOutputDir(): string {
  const dir = path.resolve(process.cwd(), "output");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function cleanupOutputDir(): void {
  const dir = path.resolve(process.cwd(), "output");
  if (fs.existsSync(dir)) {
    for (const file of fs.readdirSync(dir)) {
      try {
        fs.unlinkSync(path.join(dir, file));
      } catch {
        // ignore
      }
    }
  }
}

function createDummyAudio(filePath: string): void {
  const header = Buffer.from([0xff, 0xfb, 0x90, 0x00]);
  const buf = Buffer.alloc(16000, 0x00);
  header.copy(buf);
  fs.writeFileSync(filePath, buf);
}

function createDummyImage(filePath: string): void {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
    "base64",
  );
  fs.writeFileSync(filePath, png);
}

// ── Shared fixtures ──────────────────────────────────────────────────────

const script: Script = {
  hook: "Stop setting your alarm for 5 AM.",
  body: "Most morning routines fail because people copy what works for CEOs.",
  cta: "Follow for more productivity tips.",
  estimatedDurationSec: 15,
  topic: "morning routines",
};

const captionWords: CaptionWord[] = [
  { text: "Stop", startMs: 0, endMs: 300 },
  { text: "setting", startMs: 300, endMs: 700 },
  { text: "your", startMs: 700, endMs: 900 },
  { text: "alarm", startMs: 900, endMs: 1300 },
  { text: "for", startMs: 1300, endMs: 1500 },
  { text: "five", startMs: 1500, endMs: 1800 },
  { text: "AM", startMs: 1800, endMs: 2100 },
  { text: "it", startMs: 2100, endMs: 2300 },
  { text: "is", startMs: 2300, endMs: 2500 },
  { text: "sabotaging", startMs: 2500, endMs: 3000 },
  { text: "your", startMs: 3000, endMs: 3200 },
  { text: "entire", startMs: 3200, endMs: 3500 },
  { text: "day", startMs: 3500, endMs: 3800 },
];

const captions: CaptionResult = {
  words: captionWords,
  fullText: captionWords.map((w) => w.text).join(" "),
};

const defaultInput: RenderInput = {
  script,
  voiceover: {
    audioPath: path.resolve(process.cwd(), "output", "test-voiceover.mp3"),
    durationSec: 5.0,
  },
  captions,
  template: defaultTikTokTemplate(),
  outputPath: path.resolve(process.cwd(), "output", "test-output.mp4"),
  format: "9:16",
};

// ── Mock execFile for renderVideo tests ──────────────────────────────────

const mockExecFile = vi.fn();
vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => {
    // We also need to support the real promisify, so just return the mock
    return mockExecFile(...args);
  },
}));

// ── Tests: buildRenderCommand ────────────────────────────────────────────

describe("buildRenderCommand", () => {
  it("includes correct resolution for 9:16 format", () => {
    const { args } = buildRenderCommand(defaultInput);
    const joined = args.join(" ");
    expect(joined).toContain("1080x1920");
  });

  it("includes correct resolution for 1:1 format", () => {
    const { args } = buildRenderCommand({ ...defaultInput, format: "1:1" });
    const joined = args.join(" ");
    expect(joined).toContain("1080x1080");
  });

  it("includes correct resolution for 16:9 format", () => {
    const { args } = buildRenderCommand({ ...defaultInput, format: "16:9" });
    const joined = args.join(" ");
    expect(joined).toContain("1920x1080");
  });

  it("throws on unsupported format", () => {
    expect(() =>
      buildRenderCommand({ ...defaultInput, format: "4:3" as never }),
    ).toThrow(/Unsupported format/);
  });

  it("uses lavfi color source for color backgrounds", () => {
    const { args } = buildRenderCommand(defaultInput);
    const joined = args.join(" ");
    expect(joined).toContain("-f");
    expect(joined).toContain("lavfi");
    expect(joined).toContain("color=c=0x");
  });

  it("uses image input for image backgrounds", () => {
    const imagePath = path.resolve(process.cwd(), "output", "bg.png");
    const { args } = buildRenderCommand({
      ...defaultInput,
      template: {
        ...defaultInput.template,
        background: { type: "image", value: imagePath },
      },
    });
    const joined = args.join(" ");
    expect(joined).toContain("-loop");
    expect(joined).toContain("1");
    expect(joined).toContain(imagePath);
  });

  it("includes the audio input from voiceover path", () => {
    const { args } = buildRenderCommand(defaultInput);
    const joined = args.join(" ");
    expect(joined).toContain(defaultInput.voiceover.audioPath);
  });

  it("maps output video label and audio stream", () => {
    const { args } = buildRenderCommand(defaultInput);
    const joined = args.join(" ");

    expect(joined).toMatch(/-map\s+\[outv\]/);
    expect(joined).toMatch(/-map\s+1:a:0/);
  });

  it("includes H.264 video codec settings", () => {
    const { args } = buildRenderCommand(defaultInput);
    const joined = args.join(" ");
    expect(joined).toContain("-c:v");
    expect(joined).toContain("libx264");
    expect(joined).toContain("-preset");
    expect(joined).toContain("fast");
    expect(joined).toContain("-crf");
    expect(joined).toContain("23");
    expect(joined).toContain("-pix_fmt");
    expect(joined).toContain("yuv420p");
  });

  it("includes AAC audio codec settings", () => {
    const { args } = buildRenderCommand(defaultInput);
    const joined = args.join(" ");
    expect(joined).toContain("-c:a");
    expect(joined).toContain("aac");
    expect(joined).toContain("-b:a");
    expect(joined).toContain("128k");
  });

  it("uses -shortest flag", () => {
    const { args } = buildRenderCommand(defaultInput);
    expect(args).toContain("-shortest");
  });

  it("uses -y flag to overwrite without prompt", () => {
    const { args } = buildRenderCommand(defaultInput);
    expect(args).toContain("-y");
  });

  it("ends with the output path", () => {
    const { args } = buildRenderCommand(defaultInput);
    expect(args[args.length - 1]).toBe(defaultInput.outputPath);
  });

  it("filter_complex includes drawtext for each caption phrase", () => {
    const { filterComplex } = buildRenderCommand(defaultInput);
    expect(filterComplex).toContain("drawtext");
    const enableCount = (
      filterComplex.match(/enable='between\(t,/g) || []
    ).length;
    expect(enableCount).toBeGreaterThanOrEqual(1);
  });

  it("filter_complex uses template font settings", () => {
    const template = defaultTikTokTemplate();
    const { filterComplex } = buildRenderCommand({ ...defaultInput, template });
    expect(filterComplex).toContain(`fontsize=${template.font.size}`);
    expect(filterComplex).toContain(`fontcolor=${template.font.color}`);
    expect(filterComplex).toContain(`bordercolor=${template.font.borderColor}`);
  });

  it("filter_complex uses center y-position for center layout", () => {
    const { filterComplex } = buildRenderCommand(defaultInput);
    expect(filterComplex).toContain("y=(h-text_h)/2");
  });

  it("filter_complex uses bottom y-position for bottom layout", () => {
    const { filterComplex } = buildRenderCommand({
      ...defaultInput,
      template: {
        ...defaultInput.template,
        layout: { captionPosition: "bottom", captionMaxWidth: 900 },
      },
    });
    expect(filterComplex).toContain("y=h-text_h-100");
  });

  it("filter_complex includes the first phrase text", () => {
    const { filterComplex } = buildRenderCommand(defaultInput);
    // First 4 words: "Stop setting your alarm"
    expect(filterComplex).toContain("Stop setting your alarm");
  });

  it("filter_complex includes correct timing for first phrase", () => {
    const { filterComplex } = buildRenderCommand(defaultInput);
    // startSec from first word: 0/1000 = 0, endSec from 4th word: 1300/1000 = 1.3
    expect(filterComplex).toContain("between(t,0,1.3)");
  });

  it("filter_complex scales and crops image backgrounds", () => {
    const imagePath = path.resolve(process.cwd(), "output", "bg.png");
    const { filterComplex } = buildRenderCommand({
      ...defaultInput,
      template: {
        ...defaultInput.template,
        background: { type: "image", value: imagePath },
      },
    });
    expect(filterComplex).toContain("scale=1080:1920");
    expect(filterComplex).toContain("force_original_aspect_ratio=increase");
    expect(filterComplex).toContain("crop=1080:1920");
    expect(filterComplex).toContain("setsar=1");
  });

  it("handles a single-word caption gracefully", () => {
    const { filterComplex } = buildRenderCommand({
      ...defaultInput,
      captions: {
        words: [{ text: "Hello", startMs: 0, endMs: 1000 }],
        fullText: "Hello",
      },
    });
    expect(filterComplex).toContain("Hello");
    expect(filterComplex).toContain("between(t,0,1)");
  });

  it("handles empty captions array gracefully", () => {
    const { filterComplex } = buildRenderCommand({
      ...defaultInput,
      captions: { words: [], fullText: "" },
    });
    // Should still have bg → outv chain, no drawtext
    expect(filterComplex).not.toContain("drawtext");
    expect(filterComplex).toMatch(/\[bg\].*null\[outv\]/);
  });
});

// ── Tests: renderVideo (error handling) ──────────────────────────────────

describe("renderVideo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupOutputDir();
    createDummyAudio(defaultInput.voiceover.audioPath);
  });

  afterEach(() => {
    cleanupOutputDir();
  });

  it("throws when voiceover audio file is missing", async () => {
    const missingPath = path.resolve(process.cwd(), "output", "missing.mp3");
    await expect(
      renderVideo({
        ...defaultInput,
        voiceover: { ...defaultInput.voiceover, audioPath: missingPath },
      }),
    ).rejects.toThrow(/Voiceover audio file not found/);
  });

  it("throws when image background file is missing", async () => {
    const missingPath = path.resolve(process.cwd(), "output", "missing.png");
    await expect(
      renderVideo({
        ...defaultInput,
        template: {
          ...defaultInput.template,
          background: { type: "image", value: missingPath },
        },
      }),
    ).rejects.toThrow(/Background image file not found/);
  });

  it("throws on unsupported format", async () => {
    await expect(
      renderVideo({ ...defaultInput, format: "4:3" as never }),
    ).rejects.toThrow(/Unsupported format/);
  });

  it("creates output directory if it does not exist", async () => {
    const newDir = path.resolve(process.cwd(), "output", "nested", "dir");
    const outPath = path.join(newDir, "out.mp4");

    // FFmpeg mock resolves successfully
    mockExecFile.mockImplementationOnce(
      (_cmd: string, _args: string[], callback: Function) => {
        // Create a dummy output file so the stat check passes
        fs.mkdirSync(newDir, { recursive: true });
        fs.writeFileSync(outPath, Buffer.alloc(1024));
        callback(null);
      },
    );

    await renderVideo({
      ...defaultInput,
      outputPath: outPath,
    });

    expect(fs.existsSync(outPath)).toBe(true);
    // Cleanup
    fs.rmSync(path.resolve(process.cwd(), "output", "nested"), {
      recursive: true,
      force: true,
    });
  });

  it("wraps FFmpeg errors with descriptive message", async () => {
    mockExecFile.mockImplementationOnce(
      (_cmd: string, _args: string[], callback: Function) => {
        callback(new Error("FFmpeg crashed with signal 11"));
      },
    );

    await expect(renderVideo(defaultInput)).rejects.toThrow(
      /FFmpeg rendering failed/,
    );
  });

  it("throws if FFmpeg exits cleanly but output file is missing", async () => {
    mockExecFile.mockImplementationOnce(
      (_cmd: string, _args: string[], callback: Function) => {
        // Do NOT create the output file
        callback(null);
      },
    );

    await expect(renderVideo(defaultInput)).rejects.toThrow(
      /output file was not created/,
    );
  });

  it("returns RenderResult with correct metadata on success", async () => {
    const outPath = defaultInput.outputPath;
    mockExecFile.mockImplementationOnce(
      (_cmd: string, _args: string[], callback: Function) => {
        fs.writeFileSync(outPath, Buffer.alloc(4096));
        callback(null);
      },
    );

    const result = await renderVideo(defaultInput);

    expect(result.outputPath).toBe(outPath);
    expect(result.durationSec).toBe(defaultInput.voiceover.durationSec);
    expect(result.fileSizeBytes).toBe(4096);
  });
});

// ── Tests: Template factories ────────────────────────────────────────────

describe("template factories", () => {
  function assertValidTemplate(t: VideoTemplate, name: string) {
    expect(t.background).toBeDefined();
    expect(t.font).toBeDefined();
    expect(t.layout).toBeDefined();
    expect(t.font.family).toBeTruthy();
    expect(t.font.size).toBeGreaterThan(0);
    expect(t.font.color).toBeTruthy();
  }

  it("defaultTikTokTemplate returns a valid template", () => {
    const t = defaultTikTokTemplate();
    assertValidTemplate(t, "tiktok");
    expect(t.background.type).toBe("color");
    expect(t.layout.captionPosition).toBe("center");
  });

  it("defaultReelsTemplate returns a valid template", () => {
    const t = defaultReelsTemplate();
    assertValidTemplate(t, "reels");
    expect(t.background.type).toBe("color");
    expect(t.layout.captionPosition).toBe("center");
  });

  it("defaultShortsTemplate returns a valid template", () => {
    const t = defaultShortsTemplate();
    assertValidTemplate(t, "shorts");
    expect(t.background.type).toBe("color");
    expect(t.layout.captionPosition).toBe("center");
  });
});

// ── Tests: FORMAT_RESOLUTIONS ────────────────────────────────────────────

describe("FORMAT_RESOLUTIONS", () => {
  it("maps 9:16 to 1080x1920", () => {
    expect(FORMAT_RESOLUTIONS["9:16"]).toEqual({
      width: 1080,
      height: 1920,
    });
  });

  it("maps 1:1 to 1080x1080", () => {
    expect(FORMAT_RESOLUTIONS["1:1"]).toEqual({
      width: 1080,
      height: 1080,
    });
  });

  it("maps 16:9 to 1920x1080", () => {
    expect(FORMAT_RESOLUTIONS["16:9"]).toEqual({
      width: 1920,
      height: 1080,
    });
  });
});
