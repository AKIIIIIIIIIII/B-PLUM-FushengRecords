export const FUTURE_NEAR_SCALE = 1.12;
export const FUTURE_FAR_SCALE = 0.28;

export type FuturePerspective = {
  depth: number;
  scale: number;
  verticalOffsetRatio: number;
  sideOffsetRatio: number;
  opacity: number;
  blur: number;
  layer: number;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smoothstep = (value: number) => {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
};
const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress;

export function getFuturePerspective(corridorDistance: number): FuturePerspective {
  const depth = Math.abs(corridorDistance);
  const passed = corridorDistance < 0;
  const perspectiveRange = passed ? 2.2 : 1.8;
  const perspectiveProgress = smoothstep(depth / perspectiveRange);
  const scale = lerp(FUTURE_NEAR_SCALE, FUTURE_FAR_SCALE, perspectiveProgress);
  const verticalOffsetRatio = passed
    ? -0.39 * (1 - Math.exp(-depth * 0.85))
    : 0.48 * Math.min(depth, 1.4);
  const sideOffsetRatio = 0.08 * 4 * perspectiveProgress * (1 - perspectiveProgress);
  const fadeProgress = passed ? smoothstep((depth - 0.4) / 2) : 0;
  const opacity = passed ? 1 - fadeProgress : 1 - 0.65 * perspectiveProgress;
  const blur = passed ? 1.8 * fadeProgress : 1.1 * perspectiveProgress;

  return {
    depth,
    scale,
    verticalOffsetRatio,
    sideOffsetRatio,
    opacity,
    blur,
    layer: Math.max(1, 20 - Math.round(depth * 5)),
  };
}

export function getFutureTicketFitScale(width: number, height: number, maxWidth: number, maxHeight: number) {
  return Math.min(
    1,
    maxWidth / (width * FUTURE_NEAR_SCALE),
    maxHeight / (height * FUTURE_NEAR_SCALE),
  );
}
