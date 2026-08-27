export type PageTurnDirection = "forward" | "backward";

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
