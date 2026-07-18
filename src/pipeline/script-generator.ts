// GenreGen Pipeline — Script Generator
// Template-based script generation producing the §5.1 PipelineOutput schema.

import { v4 as uuid } from "uuid";
import type {
  Genre,
  PipelineOutput,
  Scene,
  Hook,
  GenerateOptions,
} from "./types.js";
import { buildLoveScenes } from "./templates/love.js";
import { buildComedyScenes } from "./templates/comedy.js";
import { buildActionScenes } from "./templates/action.js";

/** Arc names per genre (from spec §1 Quick Reference) */
const TEMPLATE_NAMES: Record<Genre, string> = {
  love: "meet_cute_arc",
  comedy: "escalation_arc",
  action: "thriller_arc",
};

/** Default variable fallbacks per genre */
const DEFAULT_VARIABLES: Record<Genre, Record<string, string>> = {
  love: {
    character_1_name: "You",
    character_2_name: "Them",
    setting: "coffee_shop",
    conflict_type: "distance",
    tone: "romantic",
    has_pov: "true",
    twist_preference: "none",
  },
  comedy: {
    character_name: "Me",
    situation: "getting_ready",
    humour_type: "relatable",
    escalation_level: "medium",
    has_narrator: "true",
    punchline_style: "subversion",
  },
  action: {
    character_name: "You",
    setting: "house",
    threat_type: "unknown_stalker",
    sub_genre: "thriller",
    has_twist: "true",
    twist_type: "friend_not_foe",
    intensity: "medium",
  },
};

/**
 * Pick a random hook from the genre's hook templates.
 */
function pickHook(genre: Genre, tone?: string): Hook {
  const hooks: Record<Genre, Hook[]> = {
    love: [
      {
        type: "curiosity_gap",
        text: "POV: You lock eyes with a stranger across the counter ☕",
      },
      {
        type: "curiosity_gap",
        text: "POV: You just met someone who makes you forget your own name.",
      },
      {
        type: "pattern_interrupt",
        text: "They say love at first sight isn't real. Then this happened.",
      },
      {
        type: "relatability",
        text: "The one that got away? Yeah, this is that story.",
      },
    ],
    comedy: [
      {
        type: "relatability",
        text: "Me: 'I only need 5 minutes to get ready.'",
      },
      {
        type: "relatability",
        text: "Me: 'I'll just quickly run to the store.' Narrator: 'They did not quickly run to the store.'",
      },
      {
        type: "pattern_interrupt",
        text: "The 5 stages of realizing you left the oven on.",
      },
      {
        type: "overconfident_setup",
        text: "Me: 'I've got this under control.' (I did not have it under control.)",
      },
    ],
    action: [
      {
        type: "curiosity_gap",
        text: "The last text you'll ever send. Read it.",
      },
      {
        type: "pattern_interrupt",
        text: "You hear footsteps behind you. You're the only one home.",
      },
      {
        type: "urgency_countdown",
        text: "60 seconds ago, the door was locked. Now it's open.",
      },
      {
        type: "curiosity_gap",
        text: "3 AM. One text. Wrong address.",
      },
    ],
  };

  const choices = hooks[genre];
  return choices[Math.floor(Math.random() * choices.length)];
}

/**
 * Merge user variables with genre defaults.
 */
function resolveVariables(
  genre: Genre,
  userVars?: Record<string, string>,
): Record<string, string> {
  const defaults = { ...DEFAULT_VARIABLES[genre] };
  if (userVars) {
    for (const [k, v] of Object.entries(userVars)) {
      defaults[k] = v;
    }
  }
  return defaults;
}

/**
 * Interpolate `{{variable}}` placeholders in text strings.
 */
function interpolate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`;
  });
}

/**
 * Apply scene count adjustment logic from §5.3.
 */
function adjustScenes(
  scenes: Scene[],
  targetDuration: number,
): Scene[] {
  if (targetDuration <= 24) {
    // Remove last scene, compress escalation scene
    const reduced = scenes.slice(0, -1);
    // Shorten each scene proportionally
    const ratio = targetDuration / scenes.reduce((s, sc) => s + sc.duration_seconds, 0);
    return reduced.map((sc) => ({
      ...sc,
      duration_seconds: Math.max(2, Math.round(sc.duration_seconds * ratio)),
    }));
  }
  if (targetDuration >= 29) {
    // Extend durations for longer output
    const ratio = targetDuration / scenes.reduce((s, sc) => s + sc.duration_seconds, 0);
    return scenes.map((sc) => ({
      ...sc,
      duration_seconds: Math.round(sc.duration_seconds * ratio),
    }));
  }
  return scenes;
}

type SceneBuilder = (vars: Record<string, string>, seriesPart?: number) => Scene[];

const SCENE_BUILDERS: Record<Genre, SceneBuilder> = {
  love: buildLoveScenes,
  comedy: buildComedyScenes,
  action: buildActionScenes,
};

/**
 * Main entry: generate a full PipelineOutput from genre + options.
 */
export function generateScript(options: GenerateOptions): PipelineOutput {
  const {
    genre,
    variables: userVars,
    videoLength,
    seriesPart,
    totalSeriesParts,
    hasCta,
    ctaText,
  } = options;

  const vars = resolveVariables(genre, userVars);
  const hook = pickHook(genre, vars.tone);

  let scenes = SCENE_BUILDERS[genre](vars, seriesPart);

  // Interpolate variables into all text overlays
  scenes = scenes.map((scene) => ({
    ...scene,
    text_overlay: {
      ...scene.text_overlay,
      text: interpolate(scene.text_overlay.text, vars),
    },
  }));

  // Apply duration adjustment
  const rawDuration = scenes.reduce((s, sc) => s + sc.duration_seconds, 0);
  const targetDuration = videoLength || rawDuration;

  if (videoLength) {
    scenes = adjustScenes(scenes, videoLength);
  }

  // Update total duration
  const totalDuration = scenes.reduce((s, sc) => s + sc.duration_seconds, 0);

  // Add CTA tag scene if requested
  if (hasCta) {
    const ctaScene: Scene = {
      id: scenes.length + 1,
      type: "cta_tag",
      act: 3,
      visual_description: "Final frame with call to action overlay.",
      text_overlay: {
        style: "punchline",
        text: ctaText || "Follow for more →",
        position: "top",
        duration_seconds: 2,
      },
      sound: { mood: "fade_out", sfx: [] },
      duration_seconds: 2,
    };
    scenes.push(ctaScene);
  }

  // Series/episodic metadata in the title if applicable
  let seriesSuffix = "";
  if (seriesPart && totalSeriesParts) {
    seriesSuffix = ` | Part ${seriesPart}/${totalSeriesParts}`;
  }

  return {
    story_id: uuid(),
    genre,
    template_name: TEMPLATE_NAMES[genre],
    total_duration_seconds: totalDuration + (hasCta ? 2 : 0),
    scenes,
    hook: {
      ...hook,
      text: interpolate(hook.text, vars),
    },
    variables: vars,
  };
}
