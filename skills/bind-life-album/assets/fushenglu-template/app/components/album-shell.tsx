import type { AlbumContact, AlbumManifest, Chapter } from "../album-types";

export function BrandMark({ manifest }: { manifest: AlbumManifest }) {
  return (
    <header className="absolute top-[34px] left-11 z-[8] flex items-center gap-4 text-[max(12px,var(--readable-small))] tracking-[.25em] text-[rgba(228,205,161,.72)] max-[760px]:top-[22px] max-[760px]:left-5">
      <span className="max-[760px]:hidden">{manifest.subtitle}</span>
      <i className="block h-px w-11 bg-[rgba(182,152,82,.7)] max-[760px]:hidden" />
      <b className="text-[max(18px,var(--readable-small))] font-normal tracking-[.32em] text-[#ead4a7]">{manifest.title}</b>
    </header>
  );
}

export function AlbumCover({ manifest, onOpen }: { manifest: AlbumManifest; onOpen: () => void }) {
  return (
    <section className="opening absolute inset-0 grid place-items-center [perspective:1500px]" aria-label="浮生录封面">
      <div className="cover-position max-[760px]:translate-y-[55px]">
        <button className="closed-book" onClick={onOpen} aria-label="打开浮生录">
          <span className="book-edge" /><span className="cover-frame" /><span className="cover-cloud cloud-a" /><span className="cover-cloud cloud-b" />
          <span className="cover-title">{manifest.title}</span><span className="cover-subtitle">{manifest.subtitle}</span><span className="cover-seal">藏</span>
        </button>
      </div>
      <button className="open-prompt absolute bottom-[8%] left-1/2 flex min-h-[var(--touch-target)] -translate-x-1/2 items-center gap-[18px] border-0 bg-transparent text-[max(11px,var(--readable-small))] tracking-[.28em] text-[rgba(235,227,209,.7)] max-[760px]:bottom-[9%]" onClick={onOpen}>
        <span>轻触开卷</span><i>↗</i>
      </button>
    </section>
  );
}

export function ContactNote({ contact, uiScale, mobile }: { contact: AlbumContact; uiScale: number; mobile: boolean }) {
  const qrWidth = Math.max(mobile ? 86 : 118, 86 / uiScale);
  const noteWidth = Math.max(mobile ? 132 : 160, qrWidth + 22);
  return (
    <aside className="contact-note absolute top-[34px] right-9 z-[9] rotate-[1.2deg] border border-[rgba(85,62,31,.25)] bg-[linear-gradient(145deg,#ded0b2,#bda984)] px-4 pt-[15px] pb-[14px] text-center text-[rgba(67,49,28,.82)] opacity-60 shadow-[0_12px_28px_rgba(0,0,0,.24),inset_0_0_0_1px_rgba(255,248,225,.18)] transition-[opacity,transform,box-shadow] duration-300 hover:translate-y-[-3px] hover:rotate-0 hover:opacity-[.78] focus-within:translate-y-[-3px] focus-within:rotate-0 focus-within:opacity-[.78] max-[760px]:top-[19px] max-[760px]:right-3 max-[760px]:px-[11px] max-[760px]:pt-[11px] max-[760px]:pb-[10px]" style={{ width: noteWidth }} aria-label={contact.label}>
      <strong className="block text-[max(13px,var(--readable-small))] font-normal tracking-[.2em] max-[760px]:text-[max(11px,var(--readable-small))]">{contact.label}</strong>
      {contact.qrImageUrl && contact.supportUrl && (
        <a className="mx-auto mt-[11px] block text-inherit no-underline max-[760px]:mt-2" style={{ width: qrWidth }} href={contact.supportUrl} target="_blank" rel="noreferrer" aria-label={contact.qrLabel || "请造册人喝杯茶"}>
          <img className="block aspect-square w-full border-[5px] border-[rgba(246,239,220,.92)] object-contain shadow-[0_3px_10px_rgba(65,44,21,.14)] transition-transform duration-200 hover:-translate-y-0.5 max-[760px]:border-4" src={contact.qrImageUrl} alt="付茶钱二维码" />
          <span className="mt-1.5 block text-[max(9px,var(--readable-small))] leading-[1.4] tracking-[.16em] opacity-[.78]">{contact.qrLabel || "请造册人喝杯茶"}</span>
        </a>
      )}
      {contact.detail && <p className="my-2 text-[max(9px,var(--readable-small))] leading-[1.7] tracking-[.11em] opacity-70 max-[760px]:my-1.5">{contact.detail}</p>}
      {contact.url && <a className="grid min-h-[var(--touch-target)] place-items-center border border-[rgba(134,98,45,.58)] bg-[linear-gradient(135deg,#172b39,#0a151d)] px-2 py-[7px] text-[max(9px,var(--readable-small))] tracking-[.18em] text-[#e4c98f] no-underline transition-colors hover:border-[rgba(181,141,72,.82)] hover:text-[#f4deb0]" href={contact.url} target="_blank" rel="noreferrer">{contact.actionLabel || "拜访造册人"}</a>}
    </aside>
  );
}

export function ChapterBookmarks({ chapter, onChange }: { chapter: Chapter; onChange: (chapter: Chapter) => void }) {
  return (
    <nav className="bookmarks" aria-label="时间书签">
      <button className={chapter === "past" ? "active" : ""} onClick={() => onChange("past")}><small>旧章</small><span>过去</span></button>
      <button className={chapter === "future" ? "active" : ""} onClick={() => onChange("future")}><small>未至</small><span>未来</span></button>
    </nav>
  );
}
