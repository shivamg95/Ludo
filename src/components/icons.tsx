export function IconSpeaker({ off }: { off?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 9v6h4l5 4V5L8 9H4z" strokeLinejoin="round" />
      {off ? (
        <path d="M16 9.5l5 5m0-5l-5 5" strokeLinecap="round" />
      ) : (
        <path d="M16.5 8.5a4.5 4.5 0 010 7" strokeLinecap="round" />
      )}
    </svg>
  );
}

export function IconSun() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2m0 14v2M4.2 4.2l1.4 1.4m12.8 12.8l1.4 1.4M3 12h2m14 0h2M4.2 19.8l1.4-1.4m12.8-12.8l1.4-1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconMoon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M17 13.5A6.5 6.5 0 1110.5 7 5 5 0 0017 13.5z" strokeLinejoin="round" />
    </svg>
  );
}

export function IconLeave() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M10 6H6a2 2 0 00-2 2v8a2 2 0 002 2h4" strokeLinecap="round" />
      <path d="M14 16l4-4-4-4M18 12H10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HubMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <polygon points="4,4 16,16 4,28" fill="var(--red)" />
      <polygon points="4,4 28,4 16,16" fill="var(--green)" />
      <polygon points="28,4 28,28 16,16" fill="var(--yellow)" />
      <polygon points="4,28 28,28 16,16" fill="var(--blue)" />
      <circle cx="16" cy="16" r="2.4" fill="#f5e6a8" />
    </svg>
  );
}
