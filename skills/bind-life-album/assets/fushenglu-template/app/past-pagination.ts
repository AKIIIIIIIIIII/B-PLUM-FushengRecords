export type PageTurnDirection = "forward" | "backward";

export const PAST_SWIPE_START_DISTANCE = 8;
export const PAST_SWIPE_DISTANCE = 32;
export const PAST_SWIPE_FAST_DISTANCE = 18;
export const PAST_SWIPE_VELOCITY = 0.45;
export const PAST_SWIPE_MAX_DURATION = 600;

export function getPastSwipeDirection(deltaX: number, deltaY: number, minimumDistance = PAST_SWIPE_START_DISTANCE): PageTurnDirection | null {
  if (Math.abs(deltaX) < minimumDistance || Math.abs(deltaX) <= Math.abs(deltaY)) return null;
  return deltaX > 0 ? "forward" : "backward";
}

export function shouldCommitPastSwipe(distance: number, elapsed: number): boolean {
  const absoluteDistance = Math.abs(distance);
  const safeElapsed = Math.max(1, elapsed);
  if (safeElapsed > PAST_SWIPE_MAX_DURATION) return false;
  return absoluteDistance >= PAST_SWIPE_DISTANCE
    || (absoluteDistance >= PAST_SWIPE_FAST_DISTANCE && absoluteDistance / safeElapsed >= PAST_SWIPE_VELOCITY);
}

export function getPastWheelDirection(deltaX: number, deltaY: number): PageTurnDirection | null {
  if (Math.abs(deltaX) <= Math.abs(deltaY) || deltaX === 0) return null;
  return deltaX > 0 ? "forward" : "backward";
}

export function getPastPageCount(ticketCount: number, rows: number): number {
  return Math.max(1, Math.ceil(ticketCount / Math.max(1, rows)));
}

export function getPastMaxPage(pageCount: number, singlePage: boolean): number {
  const lastPage = Math.max(0, pageCount - 1);
  return singlePage ? lastPage : Math.floor(lastPage / 2) * 2;
}

export function normalizePastPage(page: number, pageCount: number, singlePage: boolean): number {
  const clamped = Math.min(Math.max(0, page), getPastMaxPage(pageCount, singlePage));
  return singlePage ? clamped : Math.floor(clamped / 2) * 2;
}

export function getPastTurnTarget(page: number, direction: PageTurnDirection, pageCount: number, singlePage: boolean): number | null {
  const current = normalizePastPage(page, pageCount, singlePage);
  const step = singlePage ? 1 : 2;
  const target = normalizePastPage(current + (direction === "forward" ? step : -step), pageCount, singlePage);
  return target === current ? null : target;
}

export function remapPastPage(page: number, previousRows: number, nextRows: number, nextSinglePage: boolean): number {
  const firstTicketIndex = Math.max(0, page) * Math.max(1, previousRows);
  const containingPage = Math.floor(firstTicketIndex / Math.max(1, nextRows));
  return nextSinglePage ? containingPage : Math.floor(containingPage / 2) * 2;
}
