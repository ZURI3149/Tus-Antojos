import { afterEach, describe, expect, it } from 'vitest';
import { clearCachedProfile, readCachedProfile, saveCachedProfile } from './profile-cache';
import type { Profile } from './profile';

const profile: Profile = {
  id: '00000000-0000-4000-a000-000000000001',
  role: 'cajero',
  fullName: 'Cajero de Prueba',
  isActive: true,
};

afterEach(() => {
  localStorage.clear();
});

describe('profile-cache', () => {
  it('guarda y lee el último perfil conocido de un usuario', () => {
    saveCachedProfile(profile);

    expect(readCachedProfile(profile.id)).toEqual(profile);
  });

  it('no devuelve el perfil de otro usuario', () => {
    saveCachedProfile(profile);

    expect(readCachedProfile('00000000-0000-4000-a000-000000000009')).toBeNull();
  });

  it('ignora datos corruptos o con otra forma', () => {
    localStorage.setItem(`tus-antojos:profile:${profile.id}`, '{no es json');
    expect(readCachedProfile(profile.id)).toBeNull();

    localStorage.setItem(`tus-antojos:profile:${profile.id}`, JSON.stringify({ id: profile.id }));
    expect(readCachedProfile(profile.id)).toBeNull();
  });

  it('clearCachedProfile lo borra', () => {
    saveCachedProfile(profile);

    clearCachedProfile(profile.id);

    expect(readCachedProfile(profile.id)).toBeNull();
  });
});
