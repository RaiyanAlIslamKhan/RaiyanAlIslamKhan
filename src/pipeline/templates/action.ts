// GenreGen — Action Template ("The Thriller Arc")
// Reference: §4 of script-templates.md

import type { Scene } from "../types.js";

const SETTING_DESCRIPTIONS: Record<string, string> = {
  house: "Dark house. Silent rooms. Something out of place.",
  city_streets: "Empty city street at night. Flickering streetlight. Distant siren.",
  parking_garage: "Underground parking garage. Fluorescent lights buzzing. Echo of footsteps.",
  office: "Dark office after hours. Cubicles like a maze. Computer screen glowing alone.",
  forest: "Dense forest at twilight. Mist between trees. Something moving in the periphery.",
  subway: "Deserted subway platform. The last train just left. One other person at the far end.",
  warehouse: "Abandoned warehouse. Chain-link fences. Distant dripping sound.",
  beach: "Beach at night. Waves crashing. Fog rolling in. A figure standing at the shoreline.",
};

const THREAT_HOOKS: Record<string, string> = {
  unknown_stalker: "You feel eyes on you. You turn. Nobody there.",
  break_in: "The door was locked. Now it's wide open.",
  wrong_place: "You were never supposed to be here. They know.",
  countdown: "60 seconds. One choice. No way back.",
  nature: "The storm isn't the threat. What it brought is.",
  supernatural: "The rules of reality just changed. You're not ready.",
  transformation: "Something is wrong with you. You can feel it spreading.",
};

const TWIST_REVEALS: Record<string, string> = {
  friend_not_foe: "The twist: They were never after you. They were protecting you. 💀",
  it_was_a_dream: "The twist: You've been here before. You never left. 🔥",
  protagonist_is_threat: "The twist: You're not the victim. You're the reason they're running. 💀",
  false_alarm: "The twist: It was a surprise party. The cake is real. The fear was not. 🔥",
  callback: "The twist: Remember the first scene? Watch it again. 💀",
};

export function buildActionScenes(
  vars: Record<string, string>,
  _seriesPart?: number,
): Scene[] {
  const charName = vars.character_name || "You";
  const setting = vars.setting || "house";
  const threatType = vars.threat_type || "unknown_stalker";
  const twistType = vars.twist_type || "friend_not_foe";
  const hasTwist = vars.has_twist !== "false";

  const settingDesc = SETTING_DESCRIPTIONS[setting] || SETTING_DESCRIPTIONS.house;
  const threatHook = THREAT_HOOKS[threatType] || THREAT_HOOKS.unknown_stalker;
  const twistLine = TWIST_REVEALS[twistType] || TWIST_REVEALS.friend_not_foe;

  return [
    {
      id: 1,
      type: "inciting_hook",
      act: 1,
      visual_description: `${settingDesc} Phone lights up with cryptic message. Hand reaches. Eyes reading.`,
      text_overlay: {
        style: "hook",
        text: "3 AM. One text. Wrong address.",
        position: "top",
        duration_seconds: 3,
      },
      sound: { mood: "low_drone", sfx: ["phone_buzz", "distant_thunder"] },
      duration_seconds: 3,
    },
    {
      id: 2,
      type: "tension_building",
      act: 1,
      visual_description:
        "Character gets up. Slow, deliberate movements. Shadows stretch. Clock ticks. Footsteps approach.",
      text_overlay: {
        style: "caption",
        text: "The door wasn't locked.",
        position: "bottom",
        duration_seconds: 4,
      },
      sound: { mood: "synth_pad", sfx: ["footsteps", "clock_tick"] },
      duration_seconds: 4,
    },
    {
      id: 3,
      type: "discovery",
      act: 2,
      visual_description:
        "Character finds something. Letter on the floor. Drawer open. Something's been moved. Zoom on object.",
      text_overlay: {
        style: "dialogue",
        text: `${charName}: "Someone was here."`,
        position: "center",
        duration_seconds: 4,
      },
      sound: { mood: "sub_bass_rumble", sfx: ["door_creak", "paper_rustle"] },
      duration_seconds: 4,
    },
    {
      id: 4,
      type: "threat_revealed",
      act: 2,
      visual_description:
        "Shadow moves in background. Character doesn't see. The viewer knows. Tension peaks.",
      text_overlay: {
        style: "caption",
        text: "You're not alone.",
        position: "bottom",
        duration_seconds: 4,
      },
      sound: { mood: "strings_tremolo", sfx: ["floorboard_creak"] },
      duration_seconds: 4,
    },
    {
      id: 5,
      type: "race_chase",
      act: 2,
      visual_description:
        "Fast cuts. Running. Doors slamming. Heavy breathing. Speed ramps. Motion blur.",
      text_overlay: {
        style: "reaction",
        text: "Heart: pounding. Exit: 10 feet. Time: 0.",
        position: "center",
        duration_seconds: 5,
      },
      sound: { mood: "percussion_rapid", sfx: ["running", "doors_slamming"] },
      duration_seconds: 5,
    },
    {
      id: 6,
      type: "climax",
      act: 3,
      visual_description:
        "Confrontation. Protagonist turns, ready. Door opens. Silhouette. Breath held.",
      text_overlay: {
        style: "dialogue",
        text: `${charName}: "I'm not running anymore."`,
        position: "center",
        duration_seconds: 4,
      },
      sound: { mood: "silence_loud_hit", sfx: ["dramatic_silence", "door_slam"] },
      duration_seconds: 4,
    },
    {
      id: 7,
      type: "reveal_twist",
      act: 3,
      visual_description:
        "Final shot: the threat is revealed. A face. A mirror. A truth. Slow zoom into reaction.",
      text_overlay: {
        style: "punchline",
        text: hasTwist ? twistLine : "You survived. But something followed you home. 💀",
        position: "center",
        duration_seconds: 4,
      },
      sound: { mood: "reversed_sound", sfx: ["laugh_or_sigh"] },
      duration_seconds: 4,
    },
    {
      id: 8,
      type: "cta_tag",
      act: 3,
      visual_description:
        "Black screen with white text. Quick cut. Leaves viewer wanting more.",
      text_overlay: {
        style: "title",
        text: "Part 2? 🔥",
        position: "center",
        duration_seconds: 2,
      },
      sound: { mood: "bass_drop_silence", sfx: ["heartbeat_slow"] },
      duration_seconds: 2,
    },
  ];
}
