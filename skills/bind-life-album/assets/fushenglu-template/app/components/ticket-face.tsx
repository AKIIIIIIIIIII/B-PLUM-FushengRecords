import type { Ticket } from "../album-types";

type TicketFaceProps = {
  ticket: Ticket;
  compact?: boolean;
  onImageLoad?: (ticketId: string, width: number, height: number) => void;
};

export function TicketFace({ ticket, compact = false, onImageLoad }: TicketFaceProps) {
  if (ticket.imageUrl) {
    return (
      <div className={`ticket-face imported-ticket ${compact ? "compact" : ""}`}>
        <img src={ticket.imageUrl} alt={`${ticket.title}票根`} onLoad={(event) => {
          const image = event.currentTarget;
          onImageLoad?.(String(ticket.id), image.naturalWidth, image.naturalHeight);
        }} />
      </div>
    );
  }
  return (
    <div className={`ticket-face ${ticket.kind === "宇宙订单票" ? "ticket-future" : ""} ${compact ? "compact" : ""}`}>
      <div className="ticket-kicker">{ticket.kind}</div>
      <div className="ticket-title">{ticket.title}</div>
      <div className="ticket-rule" />
      <div className="ticket-date">{ticket.date}</div>
      {!compact && <div className="ticket-place">{ticket.place}</div>}
      <div className="ticket-seal">录</div>
    </div>
  );
}
