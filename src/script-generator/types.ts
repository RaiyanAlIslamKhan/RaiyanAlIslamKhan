/** Structured short-form video script produced by the generator. */
export interface Script {
  /** Attention-grabbing opening (first ~3 seconds of spoken content). */
  hook: string;
  /** The main body delivering value / content. */
  body: string;
  /** Call-to-action driving engagement (like, comment, follow, etc.). */
  cta: string;
  /** Estimated spoken duration in seconds (based on ~2.5 words/sec). */
  estimatedDurationSec: number;
  /** The original topic used to generate this script. */
  topic: string;
}

/** Options for script generation. */
export interface GenerateOptions {
  /** Desired tone / style (e.g. "professional", "casual", "humorous"). */
  tone?: string;
  /** Target duration in seconds (default: 45, range: 30–60). */
  durationSec?: number;
}

/** Raw shape returned by the OpenAI structured completion. */
export interface OpenAIScriptResponse {
  hook: string;
  body: string;
  cta: string;
}
