/**
 * Bovogo's voice.
 *
 * Every empty state and loading moment is a place the product either says
 * nothing, or says something that makes the road feel worth taking. This is the
 * one place that copy lives, so the tone stays consistent as screens change.
 *
 * House style:
 *   • Second person, present tense. The Sailor is going somewhere, now.
 *   • Concrete over abstract — "the tank is full" beats "get started".
 *   • Never guilt the user for an empty screen; make the empty screen an invitation.
 *   • One line, ideally under 12 words. A second line only if it earns its place.
 *
 * All lines are original. We deliberately do NOT quote films, songs or books:
 * that dialogue is copyrighted, and shipping it inside an app is a real
 * liability. The register borrows from road-trip cinema without borrowing text.
 */

export interface VoiceLine {
  /** The headline. Short. */
  title: string;
  /** Optional supporting line. Keep it practical — it usually says what to do. */
  body?: string;
}

/** Shown while the app boots or a route loads. */
export const LOADING_LINES: string[] = [
  "Warming up the engine…",
  "Checking the mirrors…",
  "Folding the map…",
  "Reading the sky…",
  "Counting the miles ahead…",
  "Loading the good roads…",
  "Topping up the tank…",
  "Finding the scenic route…",
  "Dusting off the dashboard…",
  "Queuing up something worth listening to…",
];

/** Sailor has never booked an adventure. The line the brief asked for. */
export const EMPTY_SAILOR_NO_TRIPS: VoiceLine[] = [
  {
    title: "Every road not taken is a story not told",
    body: "Somewhere between here and there, someone's already going your way.",
  },
  {
    title: "The best trips start with a maybe",
    body: "Pick a route. See who's driving. Decide from there.",
  },
  {
    title: "You haven't missed it yet",
    body: "There's an adventure leaving soon with your name on an empty seat.",
  },
  {
    title: "Two cities. One empty seat. Your move.",
    body: "Find an adventure and claim a spot.",
  },
];

/** Voyager has posted nothing. */
export const EMPTY_VOYAGER_NO_POSTS: VoiceLine[] = [
  {
    title: "An empty car is just wasted road",
    body: "Post where you're headed and let Sailors come to you.",
  },
  {
    title: "You're driving anyway",
    body: "Share the seats, share the cost. Post your first adventure.",
  },
  {
    title: "Three empty seats, one full tank",
    body: "Announce your drive and let the road pay for itself.",
  },
];

/** Search returned nothing on this route. */
export const EMPTY_SEARCH_RESULTS: VoiceLine[] = [
  {
    title: "This road's quiet today",
    body: "Nobody's posted this route yet. Try another day — or drive it yourself.",
  },
  {
    title: "No one's headed that way — yet",
    body: "Routes fill up fast. Check back, or post the drive yourself.",
  },
];

/** No conversations at all. */
export const EMPTY_MESSAGES: VoiceLine[] = [
  {
    title: "Nothing but open road",
    body: "Book an adventure and you'll meet your Voyager here.",
  },
  {
    title: "No messages yet",
    body: "Once you book, this is where you'll sort out pickup.",
  },
];

/** Voyager hasn't completed any adventures, so there's nothing to show. */
export const EMPTY_EARNINGS: VoiceLine[] = [
  {
    title: "The meter starts with the first mile",
    body: "Complete an adventure and your cost recovery shows up here.",
  },
  {
    title: "Nothing recovered yet",
    body: "Every shared seat puts fuel money back in your pocket. Post a drive to begin.",
  },
];

/** No Sailors have booked a posted adventure yet. */
export const EMPTY_MANIFEST: VoiceLine[] = [
  {
    title: "Seats still open",
    body: "Nobody's booked this adventure yet. Sailors can see it and reply.",
  },
];

/**
 * Picks a line that is stable for the life of the screen but varies between
 * sessions, so the app feels alive without the text flickering on every render.
 *
 * `seed` should be something stable for the context — a user id, a trip id, or
 * omitted to vary per app launch.
 */
const SESSION_SALT = Math.floor(Math.random() * 100_000);

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function pickLine<T>(lines: T[], seed?: string): T {
  if (lines.length === 0) throw new Error("pickLine called with no lines");
  const n = seed ? hash(seed) : SESSION_SALT;
  return lines[n % lines.length];
}

/** Convenience for the loading screen, which only needs a string. */
export function pickLoadingLine(seed?: string): string {
  return pickLine(LOADING_LINES, seed);
}
