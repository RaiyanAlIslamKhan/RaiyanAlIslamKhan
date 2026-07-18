// GenreGen — Love/Romance Template ("The Meet-Cute Arc")
// Reference: §2 of script-templates.md

import type { Scene } from "../types.js";

export function buildLoveScenes(
  vars: Record<string, string>,
  _seriesPart?: number,
): Scene[] {
  const char1 = vars.character_1_name || "You";
  const char2 = vars.character_2_name || "Them";
  const setting = vars.setting || "coffee_shop";
  const conflict = vars.conflict_type || "distance";

  const settingNames: Record<string, string> = {
    coffee_shop: "coffee shop",
    bookstore: "bookstore",
    park: "park",
    train_station: "train station",
    gym: "gym",
    library: "library",
  };

  const settingName = settingNames[setting] || "coffee shop";

  const conflictLines: Record<string, string> = {
    distance: `"I'm moving next week."`,
    timing: `"I just got out of something serious."`,
    misunderstanding: `"Wait... you thought I was someone else?"`,
    ex_returns: `"My ex just texted. They want to talk."`,
    family_disapproval: `"My family would never approve."`,
  };

  const conflictLine =
    conflictLines[conflict] || conflictLines.distance;

  const conflictResolution: Record<string, string> = {
    distance: `${char2}: "I'm not going. Not without you."`,
    timing: `${char2}: "Take all the time you need. I'll wait."`,
    misunderstanding: `${char2}: "I knew exactly who you were."`,
    ex_returns: `${char2}: "The past is the past. I choose now."`,
    family_disapproval: `${char2}: "Then we'll change their minds together."`,
  };

  const resolution =
    conflictResolution[conflict] || conflictResolution.distance;

  return [
    {
      id: 1,
      type: "establishing_hook",
      act: 1,
      visual_description: `First-person POV: hand reaches for coffee cup. Across the counter at the ${settingName}, someone else reaches for the same cup. Eye contact.`,
      text_overlay: {
        style: "hook",
        text: `POV: You lock eyes with a stranger across the counter ☕`,
        position: "top",
        duration_seconds: 3,
      },
      sound: { mood: "soft_acoustic", sfx: ["ambient_chatter", "cup_clink"] },
      duration_seconds: 3,
    },
    {
      id: 2,
      type: "flirtation",
      act: 1,
      visual_description:
        "Montage of exchanged glances, small smiles, nervous laugh. Other person tucks hair behind ear.",
      text_overlay: {
        style: "dialogue",
        text: `${char2}: "I think we both needed this caffeine."`,
        position: "center",
        duration_seconds: 4,
      },
      sound: { mood: "warm_lofi", sfx: ["laugh", "soft_gasp"] },
      duration_seconds: 4,
    },
    {
      id: 3,
      type: "connection",
      act: 1,
      visual_description:
        "They sit together. Laughing. Close-up of hands brushing. Soft lighting.",
      text_overlay: {
        style: "caption",
        text: "And just like that... the world disappeared.",
        position: "bottom",
        duration_seconds: 3,
      },
      sound: { mood: "romantic_strings", sfx: ["heartbeat"] },
      duration_seconds: 3,
    },
    {
      id: 4,
      type: "conflict_introduction",
      act: 2,
      visual_description:
        "Text overlay reveals obstacle. Phone screen: the conflict message. Look of realization.",
      text_overlay: {
        style: "dialogue",
        text: `${char1}: "Wait... you're leaving?"`,
        position: "center",
        duration_seconds: 4,
      },
      sound: { mood: "minor_piano", sfx: ["phone_notification"] },
      duration_seconds: 4,
    },
    {
      id: 5,
      type: "emotional_distance",
      act: 2,
      visual_description:
        "Montage of separate spaces. Checking phone. Staring out window. Rain on glass.",
      text_overlay: {
        style: "caption",
        text: "48 hours left. 48 hours too few.",
        position: "bottom",
        duration_seconds: 5,
      },
      sound: { mood: "sparse_piano", sfx: ["rain", "heartbeat_slow"] },
      duration_seconds: 5,
    },
    {
      id: 6,
      type: "turning_point",
      act: 2,
      visual_description:
        "Decision moment. Character runs. Determination on face. Cinematic slow-motion.",
      text_overlay: {
        style: "dialogue",
        text: resolution,
        position: "center",
        duration_seconds: 4,
      },
      sound: { mood: "drum_pulse", sfx: ["footsteps", "heavy_breathing"] },
      duration_seconds: 4,
    },
    {
      id: 7,
      type: "climax_reunion",
      act: 3,
      visual_description:
        "Meet at same spot. Hug. Spin. Close embrace. Slow-motion. Golden hour light.",
      text_overlay: {
        style: "punchline",
        text: "Some stories don't end. They begin. 💕",
        position: "center",
        duration_seconds: 4,
      },
      sound: { mood: "swelling_strings", sfx: ["heartbeat", "hug_sigh"] },
      duration_seconds: 4,
    },
    {
      id: 8,
      type: "tag_cta",
      act: 3,
      visual_description:
        "Final shot: couple together, smiling. CTA fades in. Warm, golden light.",
      text_overlay: {
        style: "title",
        text: "Follow for more love stories →",
        position: "center",
        duration_seconds: 2,
      },
      sound: { mood: "fade_out", sfx: ["inhale"] },
      duration_seconds: 2,
    },
  ];
}
