import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject, type WheelEvent as ReactWheelEvent } from "react";
import type { Ticket } from "../album-types";
import { getFuturePerspective, getFutureTicketFitScale } from "../future-perspective";
import { getPastSwipeDirection, getPastTurnTarget, getPastWheelDirection, shouldCommitPastSwipe, type PageTurnDirection } from "../past-pagination";
import { TicketFace } from "./ticket-face";

type PastChapterProps = {
  tickets: Ticket[];
  rows: number;
  page: number;
  pageCount: number;
  singlePage: boolean;
  interactionLocked: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onPageChange: (page: number) => void;
  onSelect: (ticket: Ticket) => void;
};

type TurnState = {
  direction: PageTurnDirection;
  progress: number;
  phase: "preparing" | "settling";
  targetPage: number;
};

type GestureState = {
  pointerId: number;
  startX: number;
  startY: number;
  startTime: number;
  active: boolean;
};

const TURN_DURATION = 680;
const SLIDE_DURATION = 420;
const TRACKPAD_THRESHOLD = 48;
const TRACKPAD_RESET_DELAY = 160;
const TRACKPAD_COOLDOWN = 900;

type BookPageProps = {
  logicalPage: number;
  placement: "left" | "right" | "single";
  tickets: Ticket[];
  rows: number;
  collectionEmpty: boolean;
  interactive: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onSelect: (ticket: Ticket) => void;
};

function BookPage({ logicalPage, placement, tickets, rows, collectionEmpty, interactive, fileInputRef, onSelect }: BookPageProps) {
  const pageTickets = tickets.slice(logicalPage * rows, logicalPage * rows + rows);
  const showHeading = logicalPage % 2 === 0;
  return (
    <div className={`page book-page page-${placement}`} aria-label={`往昔第 ${logicalPage + 1} 页`}>
      {showHeading && <div className="spread-heading"><p className="chapter-no">卷一 · 往昔</p><h1>循岁月而行</h1></div>}
      <div className={`page-ticket-list ${showHeading ? "" : "page-ticket-list-right"}`} data-count={pageTickets.length}>
        {pageTickets.map((ticket) => (
          <button key={ticket.id} className={`past-ticket ${ticket.imageUrl ? "has-image" : ""}`} disabled={!interactive} onClick={() => interactive && onSelect(ticket)}>
            <TicketFace ticket={ticket} compact />
          </button>
        ))}
        {collectionEmpty && logicalPage === 0 && <div className="empty-collection">这一卷还是空白<br /><button disabled={!interactive} onClick={() => interactive && fileInputRef.current?.click()}>置入第一张往昔纪念票</button></div>}
      </div>
      <div className="folio">{logicalPage + 1}</div>
    </div>
  );
}

export function PastChapter({ tickets, rows, page, pageCount, singlePage, interactionLocked, fileInputRef, onPageChange, onSelect }: PastChapterProps) {
  const [turn, setTurn] = useState<TurnState | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const spreadRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<GestureState | null>(null);
  const suppressClickRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const clickResetTimerRef = useRef<number | null>(null);
  const wheelResetTimerRef = useRef<number | null>(null);
  const wheelDeltaRef = useRef(0);
  const wheelCooldownUntilRef = useRef(0);

  const clearScheduledTurn = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    timerRef.current = null;
    frameRef.current = null;
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => () => clearScheduledTurn(), [clearScheduledTurn]);

  useEffect(() => () => {
    if (clickResetTimerRef.current !== null) window.clearTimeout(clickResetTimerRef.current);
    if (wheelResetTimerRef.current !== null) window.clearTimeout(wheelResetTimerRef.current);
  }, []);

  const targetFor = useCallback((direction: PageTurnDirection) => getPastTurnTarget(page, direction, pageCount, singlePage), [page, pageCount, singlePage]);

  const finishTurn = useCallback((direction: PageTurnDirection, targetPage: number, commit: boolean) => {
    clearScheduledTurn();
    if (reducedMotion) {
      setTurn(null);
      if (commit) onPageChange(targetPage);
      return;
    }
    const endProgress = commit ? 1 : 0;
    const duration = singlePage ? SLIDE_DURATION : TURN_DURATION;
    setTurn({ direction, targetPage, progress: endProgress, phase: "settling" });
    timerRef.current = window.setTimeout(() => {
      setTurn(null);
      timerRef.current = null;
      if (commit) onPageChange(targetPage);
    }, duration);
  }, [clearScheduledTurn, onPageChange, reducedMotion, singlePage]);

  const playTurn = useCallback((direction: PageTurnDirection) => {
    if (interactionLocked || turn) return;
    const targetPage = targetFor(direction);
    if (targetPage === null) return;
    if (reducedMotion) {
      onPageChange(targetPage);
      return;
    }
    clearScheduledTurn();
    setTurn({ direction, targetPage, progress: 0, phase: "preparing" });
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = window.requestAnimationFrame(() => finishTurn(direction, targetPage, true));
    });
  }, [clearScheduledTurn, finishTurn, interactionLocked, onPageChange, reducedMotion, targetFor, turn]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (interactionLocked || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowRight") { event.preventDefault(); playTurn("forward"); }
      if (event.key === "ArrowLeft") { event.preventDefault(); playTurn("backward"); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [interactionLocked, playTurn]);

  const suppressNextClick = () => {
    if (clickResetTimerRef.current !== null) window.clearTimeout(clickResetTimerRef.current);
    suppressClickRef.current = true;
    clickResetTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false;
      clickResetTimerRef.current = null;
    }, 0);
  };

  const beginGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (interactionLocked || turn || !event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    if (targetFor("forward") === null && targetFor("backward") === null) return;
    gestureRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startTime: event.timeStamp, active: false };
  };

  const moveGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const deltaX = gesture.startX - event.clientX;
    const deltaY = gesture.startY - event.clientY;
    if (!gesture.active && getPastSwipeDirection(deltaX, deltaY) === null) return;
    event.preventDefault();
    if (!gesture.active) {
      gesture.active = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const endGesture = (event: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!gesture.active) return;
    suppressNextClick();
    const elapsed = Math.max(1, event.timeStamp - gesture.startTime);
    const deltaX = gesture.startX - event.clientX;
    const deltaY = gesture.startY - event.clientY;
    const direction = getPastSwipeDirection(deltaX, deltaY);
    if (!cancelled && direction !== null && shouldCommitPastSwipe(deltaX, elapsed)) playTurn(direction);
  };

  const handlePastWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    const direction = getPastWheelDirection(event.deltaX, event.deltaY);
    if (direction === null) return;
    event.preventDefault();
    if (interactionLocked || turn || performance.now() < wheelCooldownUntilRef.current) return;
    wheelDeltaRef.current += event.deltaX;
    if (wheelResetTimerRef.current !== null) window.clearTimeout(wheelResetTimerRef.current);
    wheelResetTimerRef.current = window.setTimeout(() => {
      wheelDeltaRef.current = 0;
      wheelResetTimerRef.current = null;
    }, TRACKPAD_RESET_DELAY);
    if (Math.abs(wheelDeltaRef.current) < TRACKPAD_THRESHOLD) return;
    const accumulatedDirection: PageTurnDirection = wheelDeltaRef.current > 0 ? "forward" : "backward";
    wheelDeltaRef.current = 0;
    wheelCooldownUntilRef.current = performance.now() + TRACKPAD_COOLDOWN;
    playTurn(accumulatedDirection);
  };

  const currentLeft = page;
  const currentRight = page + 1;
  const targetPage = turn?.targetPage ?? page;
  const forward = turn?.direction === "forward";
  const baseLeft = turn && !singlePage && !forward ? targetPage : currentLeft;
  const baseRight = turn && !singlePage && forward ? targetPage + 1 : currentRight;
  const transitionDuration = singlePage ? SLIDE_DURATION : TURN_DURATION;
  const pageProps = { tickets, rows, collectionEmpty: !tickets.length, interactive: !turn && !interactionLocked, fileInputRef, onSelect };

  return (
    <div className={`past-chapter ${turn ? "is-turning" : ""}`}>
      <div
        ref={spreadRef}
        className={`past-spread ${singlePage ? "is-single" : "is-spread"}`}
        style={{ "--past-rows": rows, "--turn-progress": turn?.progress ?? 0, "--turn-angle": `${(turn?.direction === "backward" ? 1 : -1) * (turn?.progress ?? 0) * 180}deg`, "--turn-shadow-opacity": 0.08 + (turn?.progress ?? 0) * 0.28, "--turn-duration": `${transitionDuration}ms` } as CSSProperties}
        aria-label="往昔书册，轻扫书页翻页，也可使用左右方向键"
        onPointerDown={beginGesture}
        onPointerMove={moveGesture}
        onPointerUp={(event) => endGesture(event)}
        onPointerCancel={(event) => endGesture(event, true)}
        onWheel={handlePastWheel}
        onClickCapture={(event) => {
          if (!suppressClickRef.current) return;
          event.preventDefault();
          event.stopPropagation();
          suppressClickRef.current = false;
        }}
        onDragStart={(event) => event.preventDefault()}
      >
        {singlePage && !turn && <BookPage logicalPage={page} placement="single" {...pageProps} />}
        {singlePage && turn && (
          <div className={`single-page-slider slide-${turn.direction} ${turn.phase === "settling" ? "is-settling" : ""}`} aria-hidden="true">
            <div className="single-slide-page single-slide-current">
              <BookPage logicalPage={page} placement="single" {...pageProps} interactive={false} />
            </div>
            <div className="single-slide-page single-slide-target">
              <BookPage logicalPage={targetPage} placement="single" {...pageProps} interactive={false} />
            </div>
          </div>
        )}
        {!singlePage && <><BookPage logicalPage={baseLeft} placement="left" {...pageProps} /><BookPage logicalPage={baseRight} placement="right" {...pageProps} /></>}
        {turn && !singlePage && (
          <div className={`turning-leaf turn-${turn.direction} ${turn.phase === "settling" ? "is-settling" : ""}`} aria-hidden="true">
            <div className="leaf-face leaf-front">
              <BookPage logicalPage={forward ? currentRight : currentLeft} placement={forward ? "right" : "left"} {...pageProps} interactive={false} />
            </div>
            <div className="leaf-face leaf-back">
              <BookPage logicalPage={forward ? targetPage : targetPage + 1} placement={forward ? "left" : "right"} {...pageProps} interactive={false} />
            </div>
          </div>
        )}
        <div className="page-spine" aria-hidden="true" />
        <span className="page-turn-status" role="status" aria-live="polite">第 {page + 1}{singlePage || page + 1 >= pageCount ? "页" : `—${page + 2}页`}</span>
      </div>
      {pageCount > 1 && <span className="page-swipe-hint">轻扫书页翻页 · 方向键亦可</span>}
    </div>
  );
}

type FutureChapterProps = {
  tickets: Ticket[];
  depths: number[];
  progress: number;
  ratios: Record<string, number>;
  baseShortSide: number;
  maxWidth: number;
  maxHeight: number;
  stageWidth: number;
  stageHeight: number;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onImageLoad: (ticketId: string, width: number, height: number) => void;
  onSelect: (ticket: Ticket) => void;
};

export function FutureChapter({ tickets, depths, progress, ratios, baseShortSide, maxWidth, maxHeight, stageWidth, stageHeight, fileInputRef, onImageLoad, onSelect }: FutureChapterProps) {
  return (
    <div className="future-corridor">
      <div className="corridor-heading" style={{ opacity: Math.max(0, 1 - progress * 2.2) }}><p className="chapter-no">卷二 · 未至</p><h1>向云深处</h1><p>滚动前行，让尚未抵达的一页慢慢显形。</p></div>
      <div className="path-line" />
      {tickets.map((ticket, index) => {
        const distance = depths[index] - progress;
        const corridorDistance = distance * Math.max(2.4, tickets.length);
        const perspective = getFuturePerspective(corridorDistance);
        const revealEnd = Math.max(0.02, Math.min(0.1, (depths[0] ?? 0.1) * 0.7));
        const revealRaw = Math.min(1, Math.max(0, (progress - 0.01) / (revealEnd - 0.01)));
        const corridorReveal = revealRaw * revealRaw * (3 - 2 * revealRaw);
        const sideDirection = index % 2 === 0 ? -1 : 1;
        const sideOffset = stageWidth * perspective.sideOffsetRatio * sideDirection;
        const verticalOffset = stageHeight * perspective.verticalOffsetRatio;
        const ratio = ratios[String(ticket.id)] ?? 1.75;
        const elongation = Math.max(ratio, 1 / ratio);
        const isSlender = elongation >= 2;
        const targetLongSide = isSlender ? baseShortSide * 2 : baseShortSide * elongation;
        const targetShortSide = isSlender ? targetLongSide / elongation : baseShortSide;
        const targetWidth = ratio >= 1 ? targetLongSide : targetShortSide;
        const targetHeight = ratio >= 1 ? targetShortSide : targetLongSide;
        const fitScale = getFutureTicketFitScale(targetWidth, targetHeight, maxWidth, maxHeight);
        const ticketOpacity = perspective.opacity * corridorReveal;
        return (
          <button key={ticket.id} className="corridor-ticket" style={{ width: `${targetWidth * fitScale}px`, height: `${targetHeight * fitScale}px`, opacity: ticketOpacity, pointerEvents: ticketOpacity < 0.18 ? "none" : "auto", zIndex: perspective.layer, transform: `translate3d(calc(-50% + ${sideOffset}px), calc(-50% + ${verticalOffset}px), 0) scale(${perspective.scale})`, filter: `blur(${perspective.blur}px)` }} onClick={() => onSelect(ticket)}>
            <TicketFace ticket={ticket} onImageLoad={onImageLoad} />
          </button>
        );
      })}
      {!tickets.length && <div className="empty-future"><span>长廊尽头尚无来信</span><button onClick={() => fileInputRef.current?.click()}>置入第一张宇宙订单票</button></div>}
      <div className="progress-rail" aria-label={`未来长廊进度 ${Math.round(progress * 100)}%`}><span style={{ height: `${10 + progress * 90}%` }} /><em>{Math.round(progress * 100).toString().padStart(2, "0")}</em></div>
      <div className="scroll-hint" style={{ opacity: progress > 0.08 ? 0.35 : 1 }}><span>滚动 · 向前</span><i>↓</i></div>
    </div>
  );
}
