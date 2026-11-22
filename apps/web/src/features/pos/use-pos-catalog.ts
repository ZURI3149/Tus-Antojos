import { useEffect, useState } from 'react';
import type { Category, Product } from '@tus-antojos/shared';
import { useSnapshots } from '@/app/snapshots-context';
import { useCategories, useProducts } from '@/features/catalog/api';
import { usePromotions } from '@/features/promotions/api';
import type { PromotionRowData } from '@/features/promotions/reader';
import { useNetworkStatus } from '@/lib/offline/use-network-status';

export const POS_CATALOG_SNAPSHOT_KEY = 'pos-catalog';

export interface PosCatalogData {
  categories: Category[];
  products: Product[];
  promotions: PromotionRowData[];
}

export type PosCatalog = PosCatalogData &
  (
    | { source: 'loading' | 'live' | 'none' }
    /** Datos de la última lectura guardada; `savedAt` en ISO. */
    | { source: 'snapshot'; savedAt: string }
  );

const EMPTY: PosCatalogData = { categories: [], products: [], promotions: [] };

/**
 * Catálogo y promociones de la caja. Con red usa las lecturas de siempre y guarda una copia;
 * sin red (o si la lectura falla) usa la última copia guardada (SPEC-offline-print OP-D10).
 *
 * Ojo: sin red TanStack Query **pausa** las consultas en vez de fallar, por eso también se usa
 * la copia cuando el navegador está sin conexión o la consulta está en pausa.
 */
export function usePosCatalog(): PosCatalog {
  const store = useSnapshots();
  const online = useNetworkStatus();
  const categories = useCategories();
  const products = useProducts();
  const promotions = usePromotions();

  // `undefined` mientras se lee la copia; `null` si no hay ninguna.
  const [snapshot, setSnapshot] = useState<
    { savedAt: string; data: PosCatalogData } | null | undefined
  >(undefined);

  useEffect(() => {
    let alive = true;
    void store.load<PosCatalogData>(POS_CATALOG_SNAPSHOT_KEY).then((s) => {
      if (alive) setSnapshot(s ? { savedAt: s.savedAt, data: s.data } : null);
    });
    return () => {
      alive = false;
    };
  }, [store]);

  const fresh =
    categories.data && products.data && promotions.data
      ? { categories: categories.data, products: products.data, promotions: promotions.data }
      : null;

  useEffect(() => {
    if (fresh) void store.save(POS_CATALOG_SNAPSHOT_KEY, fresh);
    // Guardar solo cuando cambian los datos, no en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, categories.data, products.data, promotions.data]);

  // Pedir que el navegador no borre la cola ni la copia por falta de espacio (spec §8).
  useEffect(() => {
    void navigator.storage?.persist?.().catch(() => undefined);
  }, []);

  if (fresh) return { ...fresh, source: 'live' };

  const queries = [categories, products, promotions];
  const unreachable =
    !online || queries.some((q) => q.isError || (q.isPending && q.fetchStatus === 'paused'));

  if (!unreachable || snapshot === undefined) return { ...EMPTY, source: 'loading' };
  if (snapshot) return { ...snapshot.data, source: 'snapshot', savedAt: snapshot.savedAt };
  return { ...EMPTY, source: 'none' };
}

/** "22/11 09:05" en hora de Bolivia. */
export function formatSnapshotDate(iso: string): string {
  const parts = new Intl.DateTimeFormat('es-BO', {
    timeZone: 'America/La_Paz',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  return `${get('day')}/${get('month')} ${get('hour')}:${get('minute')}`;
}
