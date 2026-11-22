import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/**
 * `true` si el navegador cree tener red. `navigator.onLine` puede dar `true` sin internet real
 * (red local sin salida): por eso un envío que falla por red también encola (OP-D1).
 */
export function useNetworkStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
