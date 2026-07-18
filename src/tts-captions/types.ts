/** Supported OpenAI TTS voices. */
export type TTSVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

/** Options for voiceover generation. */
export interface VoiceoverOptions {
  /** OpenAI TTS voice (default: "nova"). */
  voice?: TTSVoice;
  /** Playback speed multiplier (0.25 – 4.0). */
  speed?: number;
}

/** A single word with timing info from Whisper. */
export interface CaptionWord {
  /** The word text as transcribed. */
  text: string;
  /** Start time in milliseconds. */
  startMs: number;
  /** End time in milliseconds. */
  endMs: number;
}

/** Timed caption result from Whisper transcription. */
export interface CaptionResult {
  /** Word-level timing entries. */
  words: CaptionWord[];
  /** Full spoken text (joined from words). */
  fullText: string;
}

/** Result of generating a voiceover from a script. */
export interface VoiceoverResult {
  /** Absolute path to the MP3 audio file. */
  audioPath: string;
  /** Spoken duration in seconds (derived from audio). */
  durationSec: number;
  /** Caption data with word-level timings. */
  captions: CaptionResult;
}
