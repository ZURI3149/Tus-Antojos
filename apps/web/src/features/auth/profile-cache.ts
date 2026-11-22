import { APP_ROLES, type AppRole } from '@tus-antojos/shared';
import type { Profile } from './profile';

/**
 * Último perfil conocido de cada usuario, para abrir la caja sin red (SPEC-offline-print OP-D9).
 * Es una comodidad por dispositivo: si el almacenamiento falla, simplemente no hay copia.
 */
const key = (userId: string) => `tus-antojos:profile:${userId}`;

function isProfile(value: unknown, userId: string): value is Profile {
  const v = value as Partial<Profile> | null;
  return (
    !!v &&
    v.id === userId &&
    typeof v.fullName === 'string' &&
    typeof v.isActive === 'boolean' &&
    (APP_ROLES as readonly string[]).includes(v.role as AppRole)
  );
}

export function readCachedProfile(userId: string): Profile | null {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isProfile(parsed, userId) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCachedProfile(profile: Profile): void {
  try {
    localStorage.setItem(key(profile.id), JSON.stringify(profile));
  } catch {
    // Sin almacenamiento (navegación privada, cuota): no hay copia, nada más.
  }
}

export function clearCachedProfile(userId: string): void {
  try {
    localStorage.removeItem(key(userId));
  } catch {
    // Igual que arriba.
  }
}
