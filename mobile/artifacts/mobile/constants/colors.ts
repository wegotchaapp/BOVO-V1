/**
 * Ink for text and glyphs sitting on a solid gold fill. White measures 2.71:1
 * on `#C4954A`; this is 6.93:1.
 *
 * Exported at module level as well as via `accentForeground` so that
 * `StyleSheet.create` blocks, which cannot call `useColors()`, can reach it.
 */
export const GOLD_INK = "#111210";

const colors = {
  light: {
    text: "#111210",
    tint: "#1B3D2F",

    background: "#F8F7F3",
    foreground: "#111210",

    card: "#FFFFFF",
    cardForeground: "#111210",

    primary: "#1B3D2F",
    primaryForeground: "#FFFFFF",

    secondary: "#EBF2ED",
    secondaryForeground: "#1B3D2F",

    muted: "#F2EFE8",
    // Secondary text: captions, timestamps, stat labels. Darkened from the
    // brand sage #8A9A8D, which measured 2.76:1 on the background and 2.96:1
    // on cards — under the 4.5:1 floor, in 315 places. This step holds the
    // same sage hue (135°) at 4.62:1 / 4.96:1.
    mutedForeground: "#67736A",

    accent: "#C4954A",
    // Ink for text sitting ON the gold accent. White measured 2.71:1 here —
    // unreadable. Dark ink is 6.93:1. Gold is a fill, never a text colour.
    accentForeground: GOLD_INK,

    destructive: "#C0392B",
    destructiveForeground: "#FFFFFF",

    border: "#E3DDD3",
    input: "#EEEAE3",

    success: "#1A7A4A",
    warning: "#D97706",
    info: "#0EA5E9",
  },

  radius: 16,
};

/**
 * Gold for text sitting on a dark forest surface — the post-trip wheel sheet and the
 * Travel+ compare table, the only dark grounds in this otherwise light app.
 *
 * The brand gold `#C4954A` is 4.41:1 on `#1B3D2F` and only 3.67:1 on the compare
 * table's `#29493B` (6% white over forest), so it fails the 4.5:1 floor for the
 * 12–15px text it is used at. Lightened along the same hue to 5.86:1 and 4.88:1.
 *
 * This is the inverse of `accentForeground`: gold stays a fill on light grounds, but
 * on dark it becomes legible as text.
 */
export const GOLD_ON_DARK = "#D9AF6A";

/**
 * Ink for text sitting on the muted fill `#F2EFE8` — segmented-control tracks,
 * "Completed" pills, count chips.
 *
 * `mutedForeground` is 4.62:1 on the background and 4.96:1 on cards, but only
 * **4.32:1** on `muted`, under the 4.5 floor. This holds the same sage hue one
 * step darker, at 6.78:1.
 *
 * Sibling of `GOLD_ON_DARK`: the palette's secondary ink, corrected for the one
 * surface it does not clear.
 */
export const INK_ON_MUTED = "#4A554D";

export const CARD_SHADOW = {
  shadowColor: "#1B3D2F",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.07,
  shadowRadius: 12,
  elevation: 3,
};

export const STRONG_SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.12,
  shadowRadius: 20,
  elevation: 6,
};

export default colors;
