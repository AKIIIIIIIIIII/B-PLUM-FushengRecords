export type ViewportLayout = {
  width: number;
  height: number;
  designWidth: number;
  designHeight: number;
  isMobile: boolean;
  uiScale: number;
  bookWidth: number;
  bookHeight: number;
  pastRows: 2 | 3;
};

const DESKTOP_WIDTH = 1440;
const DESKTOP_HEIGHT = 900;
const MOBILE_WIDTH = 390;
const MOBILE_HEIGHT = 844;
const MAX_SCALE = 1.15;
const MOBILE_BREAKPOINT = 760;

export function createViewportLayout(width: number, height: number): ViewportLayout {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const isMobile = safeWidth <= MOBILE_BREAKPOINT;
  const designWidth = isMobile ? MOBILE_WIDTH : DESKTOP_WIDTH;
  const designHeight = isMobile ? MOBILE_HEIGHT : DESKTOP_HEIGHT;
  const uiScale = Math.min(MAX_SCALE, safeWidth / designWidth, safeHeight / designHeight);
  const bookWidth = isMobile ? MOBILE_WIDTH * 0.92 : 1160;
  const bookHeight = isMobile ? bookWidth * (650 / 580) : 650;
  const pastRows: 2 | 3 = isMobile || bookHeight * uiScale < 500 ? 2 : 3;
  return { width: safeWidth, height: safeHeight, designWidth, designHeight, isMobile, uiScale, bookWidth, bookHeight, pastRows };
}
