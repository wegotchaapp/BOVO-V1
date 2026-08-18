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
    accentForeground: "#111210",

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
