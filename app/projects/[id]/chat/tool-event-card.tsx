"use client";

/**
 * Inline "action receipt" card rendered in place of a ```tool-event
 * fence. Each card represents one director tool call that ran on the
 * server — e.g. "updated character sheet · cast: David, Maya".
 *
 * The card is deliberately quiet. It's a margin note in the director's
 * notebook, not a loud success banner.
 */

type ToolEvent = {
  name: string;
  summary: string;
  detail?: string;
};

const ICONS: Record<string, React.ReactNode> = {
  update_character_sheet: <IconCast />,
  add_character: <IconCast />,
  update_aesthetic_bible: <IconBible />,
  update_project_meta: <IconPen />,
};

const LABELS: Record<string, string> = {
  update_character_sheet: "character sheet",
  add_character: "character added",
  update_aesthetic_bible: "aesthetic bible",
  update_project_meta: "project meta",
};

export function ToolEventCard({ event }: { event: ToolEvent }) {
  const icon = ICONS[event.name] ?? <IconInk />;
  const label = LABELS[event.name] ?? event.name.replace(/_/g, " ");
  const failed =
    event.summary.toLowerCase().startsWith("failed") ||
    event.summary.toLowerCase().startsWith("couldn");

  return (
    <div
      className={`my-3 flex items-start gap-3 px-3 py-2 border-l-2 ${
        failed
          ? "border-red-grease bg-paper-deep"
          : "border-sepia bg-paper-deep"
      }`}
    >
      <span
        className={`shrink-0 mt-0.5 ${failed ? "text-red-grease" : "text-sepia-deep"}`}
        aria-hidden
      >
        {failed ? <IconX /> : icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-body text-[10px] uppercase tracking-widest text-ink-soft/60">
            {label}
          </span>
          <span className="font-hand text-base text-ink">{event.summary}</span>
        </div>
        {event.detail ? (
          <p className="font-body text-xs text-ink-soft/80 mt-0.5 truncate">
            {event.detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Icons — all inline pen-sketch style
// ------------------------------------------------------------------

function IconCast() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden
      fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" />
      <circle cx="17" cy="10" r="2" />
      <path d="M15 20c0-2.2 1.5-4 4-4" />
    </svg>
  );
}
function IconBible() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden
      fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h9a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4z" />
      <path d="M7 8h6M7 12h6" />
    </svg>
  );
}
function IconPen() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden
      fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21c2-.5 3.5-1.5 4.5-2.5L18 8a2 2 0 1 0-2.8-2.8L4.7 15.7C3.7 16.7 2.7 18.5 3 21z" />
    </svg>
  );
}
function IconInk() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden
      fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function IconX() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden
      fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 5 19 19M19 5 5 19" />
    </svg>
  );
}
