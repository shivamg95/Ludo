import { useCallback, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

export const APP_VERSION = __APP_VERSION__;

type UpdateResult = 'updated' | 'current' | 'unavailable';

let registration: ServiceWorkerRegistration | undefined;
let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;
let started = false;

export function initPwa() {
  if (started || typeof window === 'undefined') return;
  started = true;

  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      void updateSW?.(true);
    },
    onRegisteredSW(_url, reg) {
      registration = reg;
      void reg?.update();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg?.update();
      });
    },
  });
}

export async function checkForUpdate(): Promise<UpdateResult> {
  if (!registration) return 'unavailable';
  await registration.update();
  await new Promise((resolve) => window.setTimeout(resolve, 400));
  if (registration.waiting) {
    await updateSW?.(true);
    return 'updated';
  }
  return 'current';
}

export function usePwaUpdate() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'current' | 'unavailable'>('idle');

  const check = useCallback(async () => {
    setStatus('checking');
    const result = await checkForUpdate();
    setStatus(result === 'updated' ? 'checking' : result);
  }, []);

  return { version: APP_VERSION, status, check };
}
