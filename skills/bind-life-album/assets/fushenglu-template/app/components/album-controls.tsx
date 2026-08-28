import type { CSSProperties, RefObject } from "react";
import type { Ticket } from "../album-types";
import { TicketFace } from "./ticket-face";

type CollectionToolbarProps = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  canExport: boolean;
  canClear: boolean;
  canRestore: boolean;
  onExport: () => void;
  onClear: () => void;
  onRestore: () => void;
};

const actionClass = "min-h-[var(--touch-target)] border border-[rgba(191,137,51,.46)] bg-[rgba(8,12,12,.58)] px-[14px] py-2 text-[max(10px,var(--readable-small))] text-[rgba(239,218,175,.88)] tracking-[.14em] transition-colors hover:border-[rgba(230,173,74,.85)] hover:bg-[rgba(72,43,19,.68)] hover:text-[#f5dfb0] max-[760px]:px-[9px] max-[760px]:py-[7px]";

export function CollectionToolbar({ fileInputRef, canExport, canClear, canRestore, onExport, onClear, onRestore }: CollectionToolbarProps) {
  return (
    <div className="collection-tools absolute bottom-[27px] left-[42px] z-[9] flex max-w-[680px] flex-wrap items-center gap-x-[13px] gap-y-[9px] max-[760px]:bottom-[18px] max-[760px]:left-[18px] max-[760px]:max-w-[354px] max-[760px]:gap-x-[7px] max-[760px]:gap-y-1.5">
      <button className={actionClass} onClick={() => fileInputRef.current?.click()}>置入票根</button>
      {canExport && <button className={`${actionClass} border-[rgba(181,141,72,.38)] bg-[rgba(18,31,40,.62)] text-[rgba(235,211,163,.72)]`} onClick={onExport}>导出票根</button>}
      {canClear && <button className="min-h-[var(--touch-target)] border-0 bg-transparent px-[5px] py-2 text-[max(10px,var(--readable-small))] text-[rgba(224,204,163,.42)] tracking-[.14em]" onClick={onClear}>清空票根</button>}
      {canRestore && <button className={`${actionClass} border-[rgba(191,137,51,.62)] bg-[rgba(42,31,18,.72)]`} onClick={onRestore}>恢复默认票根</button>}
      <small className="text-[rgba(224,204,163,.4)] tracking-[.15em] max-[760px]:hidden">仅保存在此浏览器</small>
    </div>
  );
}

export function DropCurtain({ visible }: { visible: boolean }) {
  return <div className={`drop-curtain ${visible ? "visible" : ""}`} aria-hidden={!visible}><span className="drop-seal">入</span><strong>放入浮生录</strong><p>票根图片与同名票据册会自动配对</p></div>;
}

export function TicketFocus({ ticket, onClose, scale }: { ticket: Ticket; onClose: () => void; scale: number }) {
  return (
    <div className="ticket-focus" role="dialog" aria-modal="true" aria-label={`${ticket.title}详情`} onClick={onClose}>
      <button className="focus-close" onClick={onClose} aria-label="收回票根">收回此页 ×</button>
      <div className="focus-content-scale" style={{ "--focus-scale": scale } as CSSProperties} onClick={(event) => event.stopPropagation()}><div className="floating-ticket"><TicketFace ticket={ticket} /><div className="ticket-memory"><p>{ticket.note}</p><span>{ticket.place}</span></div></div></div>
    </div>
  );
}
