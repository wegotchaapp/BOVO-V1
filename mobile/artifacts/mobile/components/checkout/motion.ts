export const FEED_DURATION = 1750;
export const FEED_TIMES = [
  0, 0.075, 0.105, 0.18, 0.21, 0.285, 0.315, 0.39, 0.42, 0.495, 0.525, 0.6,
  0.63, 0.705, 0.735, 0.81, 0.84, 0.915, 0.945, 1,
];
export const FEED_POSITIONS = [
  -1, -0.91, -0.91, -0.81, -0.81, -0.7, -0.7, -0.58, -0.58, -0.45, -0.45, -0.32,
  -0.32, -0.2, -0.2, -0.1, -0.1, -0.03, -0.03, 0,
];
export function fanPosition(
  index: number,
  count: number,
  width: number,
  cardWidth: number,
) {
  const offset = index - (count - 1) / 2;
  const spacing =
    count <= 1
      ? 0
      : Math.min(48, Math.max(0, (width - cardWidth - 40) / (count - 1)));
  const rotation = offset * Math.min(9, 46 / Math.max(1, count - 1));
  return { x: offset * spacing, y: Math.abs(rotation) * 1.9, rotation };
}
