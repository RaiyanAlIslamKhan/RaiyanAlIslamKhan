import { generateVoiceover } from "./tts.js";
import { generateCaptions } from "./captions.js";
import type { Script } from "../script-generator/types.js";
import type { VoiceoverOptions, VoiceoverResult } from "./types.js";

/**
 * Generate a voiceover MP3 and word-level captions from a script.
 *
 * Full pipeline: TTS → captions. Runs TTS first, then transcribes
 * the resulting audio with Whisper for word-level timing.
 *
 * @param script  The script to convert.
 * @param options Optional voice and speed settings.
 * @returns Combined result with audio path, duration, and captions.
 */
export async function generateVoiceoverWithCaptions(
  script: Script,
  options: VoiceoverOptions = {},
): Promise<VoiceoverResult> {
  // Step 1: Generate voiceover
  const { audioPath, durationSec } = await generateVoiceover(script, options);

  // Step 2: Generate captions from the audio
  const captions = await generateCaptions(audioPath);

  return {
    audioPath,
    durationSec,
    captions,
  };
}
