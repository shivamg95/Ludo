/** Line icons at a shared 24px grid, inheriting colour from their button. */
const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function SoundOnIcon() {
  return (
    <svg {...base}>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" />
      <path d="M19 6a8.5 8.5 0 0 1 0 12" />
    </svg>
  );
}

export function SoundOffIcon() {
  return (
    <svg {...base}>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="m17 9 4 6M21 9l-4 6" />
    </svg>
  );
}

export function QuitIcon() {
  return (
    <svg {...base}>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="M10 16 6 12l4-4M6 12h9" />
    </svg>
  );
}

export function LogIcon() {
  return (
    <svg {...base}>
      <path d="M5 5h14M5 12h14M5 19h9" />
    </svg>
  );
}

export function TrophyIcon() {
  return (
    <svg {...base}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4v1a4 4 0 0 0 3 3.9M17 6h3v1a4 4 0 0 1-3 3.9" />
      <path d="M10 14h4l.5 4h-5l.5-4ZM8 20h8" />
    </svg>
  );
}

export function ReplayIcon() {
  return (
    <svg {...base}>
      <path d="M4 12a8 8 0 1 0 2.6-5.9" />
      <path d="M4 4v4h4" />
    </svg>
  );
}

export function PlayIcon() {
  return (
    <svg {...base}>
      <path d="M8 5.5 18 12 8 18.5v-13Z" />
    </svg>
  );
}
