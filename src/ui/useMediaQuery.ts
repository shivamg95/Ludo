import { useEffect, useState } from 'react';

/** Subscribes to a media query so layout can branch on one DOM tree, not two. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [query]);

  return matches;
}

/** True on the wide layout, where the board gets flanking seat rails. */
export function useWideLayout(): boolean {
  return useMediaQuery('(min-width: 1024px) and (min-height: 560px)');
}
