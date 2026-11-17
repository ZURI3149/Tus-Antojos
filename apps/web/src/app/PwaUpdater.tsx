import { useEffect } from 'react';
import { toast } from 'sonner';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** Cada cuánto se busca una versión nueva: la caja y la cocina quedan abiertas todo el día. */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const UPDATE_TOAST_ID = 'pwa-update';

/**
 * Registra el service worker y avisa cuando hay una versión nueva.
 * Nunca recarga sola (registerType 'prompt'): actualizar en medio de una venta perdería el carrito.
 */
export function PwaUpdater() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        // Sin red o con el SW instalándose no tiene sentido consultar.
        if (!navigator.onLine || registration.installing) return;
        void registration.update().catch(() => undefined);
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });

  useEffect(() => {
    if (!offlineReady) return;
    toast.success('La app ya funciona sin conexión.');
    setOfflineReady(false);
  }, [offlineReady, setOfflineReady]);

  useEffect(() => {
    if (!needRefresh) return;
    toast.info('Hay una nueva versión de Tus Antojos.', {
      id: UPDATE_TOAST_ID,
      description: 'Actualiza cuando no tengas una venta en curso.',
      duration: Infinity,
      action: { label: 'Actualizar', onClick: () => void updateServiceWorker(true) },
      cancel: { label: 'Más tarde', onClick: () => setNeedRefresh(false) },
    });
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  return null;
}
