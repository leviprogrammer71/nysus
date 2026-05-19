/**
 * The Procession of Aphorisms.
 *
 * Short Dionysian / theatrical / film-making lines that surface in
 * quiet places — the dashboard header, the empty-state of an empty
 * gallery, the moment after a stitch lands. None are too long; all
 * are usable above a single CTA without crowding it.
 *
 * Sources lean Ovid, Bacchae, and a director's-notebook voice. Where
 * a line is from a named source we pretend not to attribute it — the
 * point is mood, not bibliography.
 */

export interface Aphorism {
  text: string;
  /** Optional attribution. Kept tiny and italic. */
  whisper?: string;
}

export const APHORISMS: Aphorism[] = [
  {
    text: "Every cut is a small ecstatic act.",
  },
  {
    text: "Hold the thread. The labyrinth holds itself.",
    whisper: "Ariadne",
  },
  {
    text: "Wine first, then the procession. Then the cut.",
  },
  {
    text: "A film is a long ritual that ends in 1080p.",
  },
  {
    text: "The mask is not a disguise. It is a frequency.",
  },
  {
    text: "Slow down at the seed. Speed at the rite.",
  },
  {
    text: "What the maenads tear, the cut restores.",
  },
  {
    text: "Theater begins where the lights forget to be polite.",
  },
  {
    text: "The Oracle does not answer. She names what you asked.",
  },
  {
    text: "Every still is a small altar. Treat it as one.",
  },
  {
    text: "Dionysus is the room. You are the candle in it.",
  },
  {
    text: "A first scene is an invocation. Speak it cleanly.",
  },
  {
    text: "Bring your own grapes. The vine is here.",
  },
  {
    text: "The thyrsus is just a stick until the dance.",
  },
  {
    text: "Forge the still. Set the rite. Then go to sleep.",
  },
  {
    text: "Continuity is the kindest god.",
  },
];

/**
 * Pick a stable aphorism for a given key (e.g. user id + date).
 * Deterministic so the page doesn't flicker on re-render but rotates
 * naturally with time.
 */
export function aphorismFor(key: string): Aphorism {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  return APHORISMS[h % APHORISMS.length];
}

/** Today's aphorism — same across all users on a given UTC day. */
export function aphorismOfTheDay(): Aphorism {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  return aphorismFor(today);
}
