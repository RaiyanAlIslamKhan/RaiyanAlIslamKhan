import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateScript } from "../generator.js";
import type { Script } from "../types.js";

// We'll mock the openai module to avoid real API calls.
vi.mock("openai", () => {
  const createMock = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: { create: createMock },
      },
    })),
    // Expose the mock so tests can configure it
    __mockCreate: createMock,
  };
});

// Grab the mock reference (same instance used inside the module after import)
// We need a cleaner way — let's use a local mock helper instead.
import OpenAI from "openai";

const MockedOpenAI = vi.mocked(OpenAI);
const mockCreate = vi.fn();
MockedOpenAI.mockImplementation(
  () =>
    ({
      chat: { completions: { create: mockCreate } },
    }) as unknown as OpenAI,
);

describe("generateScript", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "sk-test-dummy-key";
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  const validResponse = {
    choices: [
      {
        message: {
          content: JSON.stringify({
            hook: "Stop setting your alarm for 5 AM — it's sabotaging your entire day.",
            body: "Most morning routines fail because people copy what works for CEOs instead of building around their own chronotype. Your body has a natural rhythm. If you're a night owl, a 5 AM wake-up will just make you groggy and unproductive. Instead, track your energy peaks for a week and design a 10-minute routine that works with your biology, not against it.",
            cta: "Follow for more evidence-based productivity tips that actually stick.",
          }),
        },
      },
    ],
  };

  it("returns a structured Script object on successful API call", async () => {
    mockCreate.mockResolvedValueOnce(validResponse);

    const script = await generateScript("why morning routines fail");

    expect(script).toMatchObject({
      topic: "why morning routines fail",
      hook: expect.any(String),
      body: expect.any(String),
      cta: expect.any(String),
      estimatedDurationSec: expect.any(Number),
    });

    // Duration should be in a reasonable range
    expect(script.estimatedDurationSec).toBeGreaterThan(10);
    expect(script.estimatedDurationSec).toBeLessThan(90);

    // Fields should be non-empty strings
    expect(script.hook.length).toBeGreaterThan(0);
    expect(script.body.length).toBeGreaterThan(0);
    expect(script.cta.length).toBeGreaterThan(0);
  });

  it("passes tone and duration options to the API", async () => {
    mockCreate.mockResolvedValueOnce(validResponse);

    await generateScript("fitness myths", { tone: "humorous", durationSec: 30 });

    const userMessage = mockCreate.mock.calls[0][0].messages[1].content as string;
    expect(userMessage).toContain("humorous");
    expect(userMessage).toContain("30 seconds");
  });

  it("defaults to 45 seconds when no duration is provided", async () => {
    mockCreate.mockResolvedValueOnce(validResponse);

    await generateScript("test topic");

    const userMessage = mockCreate.mock.calls[0][0].messages[1].content as string;
    expect(userMessage).toContain("45 seconds");
  });

  it("clamps duration to the 30–60 second range", async () => {
    mockCreate.mockResolvedValue(validResponse);
    mockCreate.mockResolvedValue(validResponse);

    await generateScript("test", { durationSec: 10 });
    expect(mockCreate.mock.calls[0][0].messages[1].content).toContain("30 seconds");

    await generateScript("test", { durationSec: 120 });
    expect(mockCreate.mock.calls[1][0].messages[1].content).toContain("60 seconds");
  });

  it("throws if OPENAI_API_KEY is not set", async () => {
    delete process.env.OPENAI_API_KEY;

    await expect(generateScript("test")).rejects.toThrow("OPENAI_API_KEY");
  });

  it("retries once on API failure then throws a descriptive error", async () => {
    mockCreate.mockRejectedValueOnce(new Error("Rate limit exceeded"));
    mockCreate.mockRejectedValueOnce(new Error("Rate limit exceeded"));

    await expect(generateScript("test")).rejects.toThrow(
      "Script generation failed after 2 attempts",
    );

    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("succeeds on retry if first call fails", async () => {
    mockCreate.mockRejectedValueOnce(new Error("Network error"));
    mockCreate.mockResolvedValueOnce(validResponse);

    const script = await generateScript("test");
    expect(script.topic).toBe("test");
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("throws on malformed JSON response", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "not valid json{{{" } }],
    });
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "still not json!!" } }],
    });

    await expect(generateScript("test")).rejects.toThrow(
      "Script generation failed after 2 attempts",
    );
  });

  it("throws when response is missing required fields", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ hook: "only hook" }) } }],
    });
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ hook: "h", body: "", cta: "" }) } }],
    });

    await expect(generateScript("test")).rejects.toThrow(
      "Script generation failed after 2 attempts",
    );
  });

  it("uses gpt-4o-mini model", async () => {
    mockCreate.mockResolvedValueOnce(validResponse);

    await generateScript("test");
    expect(mockCreate.mock.calls[0][0].model).toBe("gpt-4o-mini");
  });

  it("requests json_object response format", async () => {
    mockCreate.mockResolvedValueOnce(validResponse);

    await generateScript("test");
    expect(mockCreate.mock.calls[0][0].response_format).toEqual({
      type: "json_object",
    });
  });

  it("trims whitespace from hook, body, and cta", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              hook: "  Hook with spaces  ",
              body: "  Body text here  ",
              cta: "  CTA here  ",
            }),
          },
        },
      ],
    });

    const script = await generateScript("test");
    expect(script.hook).toBe("Hook with spaces");
    expect(script.body).toBe("Body text here");
    expect(script.cta).toBe("CTA here");
  });

  it("returns the original topic in the result", async () => {
    mockCreate.mockResolvedValueOnce(validResponse);

    const script = await generateScript("why morning routines fail");
    expect(script.topic).toBe("why morning routines fail");
  });
});
