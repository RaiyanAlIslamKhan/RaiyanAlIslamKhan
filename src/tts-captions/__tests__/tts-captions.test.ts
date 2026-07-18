import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { generateVoiceover } from "../tts.js";
import { generateCaptions } from "../captions.js";
import { generateVoiceoverWithCaptions } from "../pipeline.js";
import type { Script } from "../../script-generator/types.js";

// ── Mock helpers ──────────────────────────────────────────────────────────

const mockSpeechCreate = vi.fn();
const mockTranscriptionsCreate = vi.fn();

vi.mock("openai", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      audio: {
        speech: { create: mockSpeechCreate },
        transcriptions: { create: mockTranscriptionsCreate },
      },
    })),
  };
});

// Helper to create a fake MP3 buffer (minimal valid MP3 header)
function fakeMp3Buffer(sizeBytes: number = 48000): ArrayBuffer {
  // A minimal MP3 frame: sync word + header + some data
  const header = Buffer.from([
    0xff, 0xfb, 0x90, 0x00, // MPEG1 Layer3 128kbps 44100Hz
  ]);
  const buf = Buffer.alloc(sizeBytes, 0x00);
  header.copy(buf);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

// ── Helpers ──────────────────────────────────────────────────────────────

const script: Script = {
  hook: "Stop setting your alarm for 5 AM.",
  body: "Most morning routines fail because people copy what works for CEOs.",
  cta: "Follow for more productivity tips.",
  estimatedDurationSec: 15,
  topic: "morning routines",
};

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
        // File may have been cleaned up by another afterEach — safe to ignore
      }
    }
  }
}

// ── Tests: generateVoiceover ─────────────────────────────────────────────

describe("generateVoiceover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "sk-test-dummy-key";
    setupOutputDir();
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    cleanupOutputDir();
  });

  it("generates an MP3 file from a script", async () => {
    mockSpeechCreate.mockResolvedValueOnce({
      arrayBuffer: () => Promise.resolve(fakeMp3Buffer(48000)),
    });

    const result = await generateVoiceover(script);

    expect(result.audioPath).toContain("output");
    expect(result.audioPath).toMatch(/\.mp3$/);
    expect(result.durationSec).toBeGreaterThan(0);
    expect(fs.existsSync(result.audioPath)).toBe(true);

    // Verify the API was called correctly
    expect(mockSpeechCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockSpeechCreate.mock.calls[0][0];
    expect(callArgs.model).toBe("tts-1");
    expect(callArgs.voice).toBe("nova");
    expect(callArgs.response_format).toBe("mp3");
  });

  it("joins hook, body, and cta into the spoken text", async () => {
    mockSpeechCreate.mockResolvedValueOnce({
      arrayBuffer: () => Promise.resolve(fakeMp3Buffer(32000)),
    });

    await generateVoiceover(script);

    const callArgs = mockSpeechCreate.mock.calls[0][0];
    expect(callArgs.input).toContain(script.hook);
    expect(callArgs.input).toContain(script.body);
    expect(callArgs.input).toContain(script.cta);
  });

  it("uses the specified voice option", async () => {
    mockSpeechCreate.mockResolvedValueOnce({
      arrayBuffer: () => Promise.resolve(fakeMp3Buffer(32000)),
    });

    await generateVoiceover(script, { voice: "fable" });

    expect(mockSpeechCreate.mock.calls[0][0].voice).toBe("fable");
  });

  it("defaults voice to nova when not specified", async () => {
    mockSpeechCreate.mockResolvedValueOnce({
      arrayBuffer: () => Promise.resolve(fakeMp3Buffer(32000)),
    });

    await generateVoiceover(script);

    expect(mockSpeechCreate.mock.calls[0][0].voice).toBe("nova");
  });

  it("passes speed option to the API", async () => {
    mockSpeechCreate.mockResolvedValueOnce({
      arrayBuffer: () => Promise.resolve(fakeMp3Buffer(32000)),
    });

    await generateVoiceover(script, { speed: 1.25 });

    expect(mockSpeechCreate.mock.calls[0][0].speed).toBe(1.25);
  });

  it("defaults speed to 1.0", async () => {
    mockSpeechCreate.mockResolvedValueOnce({
      arrayBuffer: () => Promise.resolve(fakeMp3Buffer(32000)),
    });

    await generateVoiceover(script);

    expect(mockSpeechCreate.mock.calls[0][0].speed).toBe(1.0);
  });

  it("throws if OPENAI_API_KEY is not set", async () => {
    delete process.env.OPENAI_API_KEY;

    await expect(generateVoiceover(script)).rejects.toThrow("OPENAI_API_KEY");
  });

  it("throws on invalid voice", async () => {
    await expect(
      generateVoiceover(script, { voice: "invalid" as never }),
    ).rejects.toThrow(/Invalid voice/);
  });

  it("retries once on API failure then throws a descriptive error", async () => {
    mockSpeechCreate.mockRejectedValueOnce(new Error("Rate limit exceeded"));
    mockSpeechCreate.mockRejectedValueOnce(new Error("Rate limit exceeded"));

    await expect(generateVoiceover(script)).rejects.toThrow(
      "Voiceover generation failed after 2 attempts",
    );

    expect(mockSpeechCreate).toHaveBeenCalledTimes(2);
  });

  it("succeeds on retry if first call fails", async () => {
    mockSpeechCreate.mockRejectedValueOnce(new Error("Network error"));
    mockSpeechCreate.mockResolvedValueOnce({
      arrayBuffer: () => Promise.resolve(fakeMp3Buffer(32000)),
    });

    const result = await generateVoiceover(script);
    expect(result.audioPath).toMatch(/\.mp3$/);
    expect(mockSpeechCreate).toHaveBeenCalledTimes(2);
  });
});

// ── Tests: generateCaptions ──────────────────────────────────────────────

describe("generateCaptions", () => {
  const testAudioPath = path.resolve(process.cwd(), "output", "test-audio.mp3");

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "sk-test-dummy-key";
    setupOutputDir();
    // Create a dummy audio file
    fs.writeFileSync(testAudioPath, Buffer.from(fakeMp3Buffer(16000)));
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    cleanupOutputDir();
  });

  const whisperResponse = {
    words: [
      { word: "Stop", start: 0.0, end: 0.3 },
      { word: "setting", start: 0.3, end: 0.7 },
      { word: "your", start: 0.7, end: 0.9 },
      { word: "alarm", start: 0.9, end: 1.3 },
    ],
    text: "Stop setting your alarm",
  };

  it("returns word-level captions from an audio file", async () => {
    mockTranscriptionsCreate.mockResolvedValueOnce(whisperResponse);

    const result = await generateCaptions(testAudioPath);

    expect(result.words).toHaveLength(4);
    expect(result.words[0]).toEqual({
      text: "Stop",
      startMs: 0,
      endMs: 300,
    });
    expect(result.fullText).toBe("Stop setting your alarm");
  });

  it("calls Whisper with verbose_json and word timestamps", async () => {
    mockTranscriptionsCreate.mockResolvedValueOnce(whisperResponse);

    await generateCaptions(testAudioPath);

    const callArgs = mockTranscriptionsCreate.mock.calls[0][0];
    expect(callArgs.model).toBe("whisper-1");
    expect(callArgs.response_format).toBe("verbose_json");
    expect(callArgs.timestamp_granularities).toEqual(["word"]);
  });

  it("handles empty words array gracefully", async () => {
    mockTranscriptionsCreate.mockResolvedValueOnce({
      words: [],
      text: "",
    });

    const result = await generateCaptions(testAudioPath);

    expect(result.words).toHaveLength(0);
    expect(result.fullText).toBe("");
  });

  it("throws if OPENAI_API_KEY is not set", async () => {
    delete process.env.OPENAI_API_KEY;

    await expect(generateCaptions(testAudioPath)).rejects.toThrow("OPENAI_API_KEY");
  });

  it("throws if audio file does not exist", async () => {
    await expect(
      generateCaptions(path.resolve(process.cwd(), "output", "nonexistent.mp3")),
    ).rejects.toThrow("Audio file not found");
  });

  it("retries once on API failure then throws a descriptive error", async () => {
    mockTranscriptionsCreate.mockRejectedValueOnce(new Error("Server error"));
    mockTranscriptionsCreate.mockRejectedValueOnce(new Error("Server error"));

    await expect(generateCaptions(testAudioPath)).rejects.toThrow(
      "Caption generation failed after 2 attempts",
    );

    expect(mockTranscriptionsCreate).toHaveBeenCalledTimes(2);
  });

  it("succeeds on retry if first call fails", async () => {
    mockTranscriptionsCreate.mockRejectedValueOnce(new Error("Timeout"));
    mockTranscriptionsCreate.mockResolvedValueOnce(whisperResponse);

    const result = await generateCaptions(testAudioPath);
    expect(result.words).toHaveLength(4);
    expect(mockTranscriptionsCreate).toHaveBeenCalledTimes(2);
  });
});

// ── Tests: generateVoiceoverWithCaptions ─────────────────────────────────

describe("generateVoiceoverWithCaptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "sk-test-dummy-key";
    setupOutputDir();
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    cleanupOutputDir();
  });

  const whisperResponse = {
    words: [
      { word: "Stop", start: 0.0, end: 0.3 },
      { word: "setting", start: 0.3, end: 0.7 },
    ],
    text: "Stop setting",
  };

  it("orchestrates TTS then captions and returns combined result", async () => {
    mockSpeechCreate.mockResolvedValueOnce({
      arrayBuffer: () => Promise.resolve(fakeMp3Buffer(32000)),
    });
    mockTranscriptionsCreate.mockResolvedValueOnce(whisperResponse);

    const result = await generateVoiceoverWithCaptions(script);

    expect(result.audioPath).toMatch(/\.mp3$/);
    expect(result.durationSec).toBeGreaterThan(0);
    expect(result.captions.words).toHaveLength(2);
    expect(result.captions.fullText).toBe("Stop setting");

    expect(mockSpeechCreate).toHaveBeenCalledTimes(1);
    expect(mockTranscriptionsCreate).toHaveBeenCalledTimes(1);
  });

  it("passes voice options through to TTS", async () => {
    mockSpeechCreate.mockResolvedValueOnce({
      arrayBuffer: () => Promise.resolve(fakeMp3Buffer(32000)),
    });
    mockTranscriptionsCreate.mockResolvedValueOnce(whisperResponse);

    await generateVoiceoverWithCaptions(script, { voice: "echo", speed: 0.8 });

    const ttsCall = mockSpeechCreate.mock.calls[0][0];
    expect(ttsCall.voice).toBe("echo");
    expect(ttsCall.speed).toBe(0.8);
  });

  it("propagates TTS errors", async () => {
    mockSpeechCreate.mockRejectedValueOnce(new Error("TTS failure"));
    mockSpeechCreate.mockRejectedValueOnce(new Error("TTS failure"));

    await expect(
      generateVoiceoverWithCaptions(script),
    ).rejects.toThrow("Voiceover generation failed after 2 attempts");
  });

  it("propagates captions errors (TTS succeeds, captions fails)", async () => {
    mockSpeechCreate.mockResolvedValueOnce({
      arrayBuffer: () => Promise.resolve(fakeMp3Buffer(32000)),
    });
    mockTranscriptionsCreate.mockRejectedValueOnce(new Error("Whisper failure"));
    mockTranscriptionsCreate.mockRejectedValueOnce(new Error("Whisper failure"));

    await expect(
      generateVoiceoverWithCaptions(script),
    ).rejects.toThrow("Caption generation failed after 2 attempts");
  });
});
