// GenreGen — Comedy Template ("The Escalation Arc")
// Reference: §3 of script-templates.md

import type { Scene } from "../types.js";

const SITUATION_LINES: Record<string, {
  setup: string;
  escalation1: string;
  escalation2: string;
  escalation3: string;
  punchline: string;
}> = {
  getting_ready: {
    setup: "Me: 'I only need 5 minutes to get ready.'",
    escalation1: "Also me: 'Okay, 10 minutes max.'",
    escalation2: "Me 10 minutes later: 'I'm a mess. I'm late. I'm fine.'",
    escalation3:
      "The universe heard 'I have time' and laughed. 😂",
    punchline: "The meeting: 'Actually, it's next week.' 💀",
  },
  cooking: {
    setup: "Me: 'I'll just make a quick pasta.'",
    escalation1: "Also me: 'Okay, sauce from scratch won't take long.'",
    escalation2: "Me 45 minutes later: 'The kitchen is on fire (metaphorically).'",
    escalation3: "When the smoke alarm is your dinner bell. 🚨",
    punchline: "Delivery app: 'Your order has arrived.' 💀",
  },
  meeting: {
    setup: "Me: 'The meeting is at 3. It's 2:55. I'm fine.'",
    escalation1: "Also me: 'Wait, the link isn't working.'",
    escalation2: "Me at 2:59: 'I'M IN THE WRONG ZOOM ROOM.'",
    escalation3: "When you join and realize your camera was on the whole time. 😂",
    punchline: "Host: 'Actually, we rescheduled. Didn't you get the email?' 💀",
  },
  shopping: {
    setup: "Me: 'I'm just grabbing one thing.'",
    escalation1: "Also me, 30 minutes later: 'I need a cart.'",
    escalation2: "Me at checkout: 'How did I spend $87?'",
    escalation3: "The one thing I came for? Still on the shelf. 😂",
    punchline: "Receipt: 'You saved $4.32!' Congratulations. 💀",
  },
  working_out: {
    setup: "Me: 'Today is the day I get fit.'",
    escalation1: "Also me, 3 minutes in: 'I see the light.'",
    escalation2: "Me 5 minutes later: 'My legs have left the chat.'",
    escalation3: "When the gym instructor says 'just 10 more' for the 4th time. 😭",
    punchline: "Narrator: 'They did not go back to the gym.' 💀",
  },
  first_date: {
    setup: "Me: 'I'll just be my charming self.'",
    escalation1: "Also me: accidentally calls them by the wrong name.",
    escalation2: "Me, trying to recover: 'I meant... your aura says [wrong name].'",
    escalation3: "When you laugh so hard at your own joke that you snort. 😂",
    punchline: "Them: 'So... same time next week?' They liked the chaos. 💀",
  },
  travel: {
    setup: "Me: 'I packed light.'",
    escalation1: "Also me: dragging a suitcase that could fit a small human.",
    escalation2: "Me at the airport: 'Gate changed. Terminal Z. 2 minutes.'",
    escalation3: "When you're sprinting and your shoe comes off. 👟",
    punchline: "Flight attendant: 'We're oversold. You've been bumped.' 💀",
  },
  phone_call: {
    setup: "Me: 'I'll just make one quick call.'",
    escalation1: "Also me, 25 minutes later: 'Hold music is my life now.'",
    escalation2: "Me to the automated system: 'REPRESENTATIVE. HUMAN. PLEASE.'",
    escalation3: "When they finally answer and the call drops. 📵",
    punchline: "Them: 'We tried to call you back 47 times.' 💀",
  },
  pet_chaos: {
    setup: "Me: 'My pet is so well-behaved.'",
    escalation1: "Also me: walks into room. Everything is on the floor.",
    escalation2: "Me: 'WHO DID THIS?' Pet gives innocent look.",
    escalation3: "When your pet brings you a 'gift' that is not a gift. 🐾",
    punchline: "The pet: already asleep. No regrets. 💀",
  },
  technology_fail: {
    setup: "Me: 'I'm so tech-savvy.'",
    escalation1: "Also me: unplugging and replugging for the 5th time.",
    escalation2: "Me: 'Have you tried turning it off and on again?'",
    escalation3: "When the blue screen appears mid-presentation. 💻",
    punchline: "IT: 'It was unplugged the whole time.' 💀",
  },
};

export function buildComedyScenes(
  vars: Record<string, string>,
  _seriesPart?: number,
): Scene[] {
  const situation = vars.situation || "getting_ready";
  const lines =
    SITUATION_LINES[situation] || SITUATION_LINES.getting_ready;
  const narrator = vars.has_narrator === "true";

  return [
    {
      id: 1,
      type: "relatable_setup",
      act: 1,
      visual_description:
        "Character (front-facing) in mundane situation. Staring at microwave or mirror. Relatable blank expression.",
      text_overlay: {
        style: "hook",
        text: lines.setup,
        position: "top",
        duration_seconds: 3,
      },
      sound: { mood: "upbeat_ukulele", sfx: ["record_scratch"] },
      duration_seconds: 3,
    },
    {
      id: 2,
      type: "first_escalation",
      act: 1,
      visual_description:
        "Something goes slightly wrong. Spill. Misstep. Phone drops. Zoom on mess.",
      text_overlay: {
        style: "dialogue",
        text: lines.escalation1,
        position: "center",
        duration_seconds: 3,
      },
      sound: { mood: "tempo_increase", sfx: ["crash_light"] },
      duration_seconds: 3,
    },
    {
      id: 3,
      type: "second_escalation",
      act: 2,
      visual_description:
        "Situation worsens. Cut to another angle. Speed ramp the chaos. Exaggerated frustration.",
      text_overlay: {
        style: "reaction",
        text: lines.escalation2,
        position: "center",
        duration_seconds: 4,
      },
      sound: { mood: "chaotic", sfx: ["slide_whistle"] },
      duration_seconds: 4,
    },
    {
      id: 4,
      type: "third_escalation",
      act: 2,
      visual_description:
        "Worst thing happens. Rapid-fire cuts. Complete chaos. Pet moves through frame if applicable.",
      text_overlay: {
        style: "caption",
        text: lines.escalation3,
        position: "bottom",
        duration_seconds: 5,
      },
      sound: { mood: "max_tempo", sfx: ["crash_loud", "glass_break"] },
      duration_seconds: 5,
    },
    {
      id: 5,
      type: "give_up_moment",
      act: 2,
      visual_description:
        "Character stops fighting. Deadpan stare at camera. Surrender visible in eyes. Deep breath.",
      text_overlay: {
        style: "dialogue",
        text: "Me: 'You know what? This is my life now.'",
        position: "center",
        duration_seconds: 4,
      },
      sound: { mood: "music_cut", sfx: ["crickets", "wah_wah"] },
      duration_seconds: 4,
    },
    {
      id: 6,
      type: "punchline",
      act: 3,
      visual_description:
        "Unexpected twist. Freeze frame on character's expression. Dramatic zoom.",
      text_overlay: {
        style: "punchline",
        text: lines.punchline,
        position: "center",
        duration_seconds: 4,
      },
      sound: { mood: "dramatic_sting", sfx: ["record_scratch", "bruh"] },
      duration_seconds: 4,
    },
    {
      id: 7,
      type: "reaction_tag",
      act: 3,
      visual_description:
        "Split screen or final deadpan. Before (optimistic) vs after (destroyed).",
      text_overlay: {
        style: "caption",
        text: narrator
          ? "Narrator: 'And they never learned from this experience.'"
          : "Never getting those minutes back.",
        position: "bottom",
        duration_seconds: 3,
      },
      sound: { mood: "sad_trombone_fade", sfx: ["sigh", "anyway"] },
      duration_seconds: 3,
    },
  ];
}
