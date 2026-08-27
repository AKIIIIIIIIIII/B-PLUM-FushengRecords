import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { Ticket } from "../album-types";
import { getPastTurnTarget, type PageTurnDirection } from "../past-pagination";
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
  phase: "dragging" | "settling";
  targetPage: number;
};

type GestureState = {
  pointerId: number;
  direction: PageTurnDirection;
  startX: number;
  startTime: number;
  progress: number;
  active: boolean;
};

const TURN_THRESHOLD = 0.3;
const TURN_VELOCITY = 0.45;
const TURN_DURATION = 680;

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
        {pageTickets.map((ticket, index) => (
          <button key={ticket.id} className={`past-ticket ${ticket.imageUrl ? "has-image" : ""}`} disabled={!interactive} onClick={() => interactive && onSelect(ticket)} style={{ "--delay": `${index * 90}ms` } as CSSProperties}>
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
  const timerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

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

  const targetFor = useCallback((direction: PageTurnDirection) => getPastTurnTarget(page, direction, pageCount, singlePage), [page, pageCount, singlePage]);

  const finishTurn = useCallback((direction: PageTurnDirection, targetPage: number, commit: boolean) => {
    clearScheduledTurn();
    if (reducedMotion) {
      setTurn(null);
      if (commit) onPageChange(targetPage);
      return;
    }
    const endProgress = commit ? 1 : 0;
    const duration = TURN_DURATION;
    setTurn({ direction, targetPage, progress: endProgress, phase: "settling" });
    timerRef.current = window.setTimeout(() => {
      setTurn(null);
      timerRef.current = null;
      if (commit) onPageChange(targetPage);
    }, duration);
  }, [clearScheduledTurn, onPageChange, reducedMotion]);

  const playTurn = useCallback((direction: PageTurnDirection) => {
    if (interactionLocked || turn) return;
    const targetPage = targetFor(direction);
    if (targetPage === null) return;
    if (reducedMotion) {
      onPageChange(targetPage);
      return;
    }
    clearScheduledTurn();
    setTurn({ direction, targetPage, progress: 0, phase: "dragging" });
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

  const beginGesture = (direction: PageTurnDirection, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (interactionLocked || turn || targetFor(direction) === null) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gestureRef.current = { pointerId: event.pointerId, direction, startX: event.clientX, startTime: event.timeStamp, progress: 0, active: false };
  };

  const moveGesture = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const pageWidth = Math.max(1, (spreadRef.current?.getBoundingClientRect().width ?? 1) * (singlePage ? 1 : 0.5));
    const distance = gesture.direction === "forward" ? gesture.startX - event.clientX : event.clientX - gesture.startX;
    const progress = Math.min(1, Math.max(0, distance / pageWidth));
    if (!gesture.active && Math.abs(distance) < 4) return;
    event.preventDefault();
    gesture.active = true;
    gesture.progress = progress;
    const targetPage = targetFor(gesture.direction);
    if (targetPage !== null) setTurn({ direction: gesture.direction, targetPage, progress, phase: "dragging" });
  };

  const endGesture = (event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const targetPage = targetFor(gesture.direction);
    if (targetPage === null) { setTurn(null); return; }
    if (!gesture.active) {
      if (!cancelled) playTurn(gesture.direction);
      return;
    }
    const elapsed = Math.max(1, event.timeStamp - gesture.startTime);
    const distance = gesture.direction === "forward" ? gesture.startX - event.clientX : event.clientX - gesture.startX;
    const velocity = Math.max(0, distance) / elapsed;
    const commit = !cancelled && (gesture.progress >= TURN_THRESHOLD || velocity >= TURN_VELOCITY);
    finishTurn(gesture.direction, targetPage, commit);
  };

  const currentLeft = page;
  const currentRight = page + 1;
  const targetPage = turn?.targetPage ?? page;
  const forward = turn?.direction === "forward";
  const baseLeft = turn && !singlePage && !forward ? targetPage : currentLeft;
  const baseRight = turn && !singlePage && forward ? targetPage + 1 : currentRight;
  const baseSingle = turn ? targetPage : page;
  const pageProps = { tickets, rows, collectionEmpty: !tickets.length, interactive: !turn && !interactionLocked, fileInputRef, onSelect };

  return (
    <div className={`past-chapter ${turn ? "is-turning" : ""}`}>
      <div ref={spreadRef} className={`past-spread ${singlePage ? "is-single" : "is-spread"}`} style={{ "--past-rows": rows, "--turn-progress": turn?.progress ?? 0, "--turn-angle": `${(turn?.direction === "backward" ? 1 : -1) * (turn?.progress ?? 0) * 180}deg`, "--turn-shadow-opacity": 0.08 + (turn?.progress ?? 0) * 0.28, "--turn-duration": `${TURN_DURATION}ms` } as CSSProperties}>
        {singlePage
          ? <BookPage logicalPage={baseSingle} placement="single" {...pageProps} />
          : <><BookPage logicalPage={baseLeft} placement="left" {...pageProps} /><BookPage logicalPage={baseRight} placement="right" {...pageProps} /></>}
        {turn && (
          <div className={`turning-leaf turn-${turn.direction} ${turn.phase === "settling" ? "is-settling" : ""}`} aria-hidden="true">
            <div className="leaf-face leaf-front">
              <BookPage logicalPage={singlePage ? page : (forward ? currentRight : currentLeft)} placement={singlePage ? "single" : (forward ? "right" : "left")} {...pageProps} interactive={false} />
            </div>
            <div className="leaf-face leaf-back">
              <BookPage logicalPage={singlePage ? targetPage : (forward ? targetPage : targetPage + 1)} placement={singlePage ? "single" : (forward ? "left" : "right")} {...pageProps} interactive={false} />
            </div>
          </div>
        )}
        <button className="page-corner page-corner-back" aria-label="上一页" disabled={interactionLocked || targetFor("backward") === null} onPointerDown={(event) => beginGesture("backward", event)} onPointerMove={moveGesture} onPointerUp={(event) => endGesture(event)} onPointerCancel={(event) => endGesture(event, true)} onClick={(event) => { if (event.detail === 0) playTurn("backward"); }} />
        <button className="page-corner page-corner-forward" aria-label="下一页" disabled={interactionLocked || targetFor("forward") === null} onPointerDown={(event) => beginGesture("forward", event)} onPointerMove={moveGesture} onPointerUp={(event) => endGesture(event)} onPointerCancel={(event) => endGesture(event, true)} onClick={(event) => { if (event.detail === 0) playTurn("forward"); }} />
        <div className="page-spine" aria-hidden="true" />
        <span className="page-turn-status" role="status" aria-live="polite">第 {page + 1}{singlePage || page + 1 >= pageCount ? "页" : `—${page + 2}页`}</span>
      </div>
      {pageCount > 1 && <span className="page-swipe-hint">拖动页角翻页</span>}
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
        const depth = Math.abs(corridorDistance);
        const visible = Math.max(0.6, 1 - depth * 0.24);
        const revealEnd = Math.max(0.02, Math.min(0.1, (depths[0] ?? 0.1) * 0.7));
        const revealRaw = Math.min(1, Math.max(0, (progress - 0.01) / (revealEnd - 0.01)));
        const corridorReveal = revealRaw * revealRaw * (3 - 2 * revealRaw);
        const scale = Math.max(0.52, 0.96 - depth * 0.14);
        const side = (index % 2 === 0 ? -1 : 1) * Math.min(22, depth * 17);
        const sideOffset = stageWidth * side / 100;
        const verticalOffset = stageHeight * corridorDistance * 0.54;
        const ratio = ratios[String(ticket.id)] ?? 1.75;
        const elongation = Math.max(ratio, 1 / ratio);
        const isSlender = elongation >= 2;
        const targetLongSide = isSlender ? baseShortSide * 2 : baseShortSide * elongation;
        const targetShortSide = isSlender ? targetLongSide / elongation : baseShortSide;
        const targetWidth = ratio >= 1 ? targetLongSide : targetShortSide;
        const targetHeight = ratio >= 1 ? targetShortSide : targetLongSide;
        const fitScale = Math.min(1, maxWidth / targetWidth, maxHeight / targetHeight);
        return (
          <button key={ticket.id} className="corridor-ticket" style={{ width: `${targetWidth * fitScale}px`, height: `${targetHeight * fitScale}px`, opacity: visible * corridorReveal, pointerEvents: corridorReveal < 0.08 ? "none" : "auto", transform: `translate3d(calc(-50% + ${sideOffset}px), calc(-50% + ${verticalOffset}px), 0) scale(${scale})`, filter: `blur(${Math.min(1, Math.max(0, depth - 1.4) * 0.55)}px)` }} onClick={() => onSelect(ticket)}>
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
