import { createContext, useContext } from 'react';
import type { SnapshotStore } from '@/lib/offline/snapshots';

export const SnapshotsContext = createContext<SnapshotStore | null>(null);

export function useSnapshots(): SnapshotStore {
  const store = useContext(SnapshotsContext);
  if (!store) throw new Error('useSnapshots() debe usarse dentro de <AppProviders>');
  return store;
}
