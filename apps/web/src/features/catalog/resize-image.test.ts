import { fitWithin, imageFileProblem } from './resize-image';

const file = (type: string, bytes: number) => new File([new Uint8Array(bytes)], 'foto', { type });

describe('imageFileProblem', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])('acepta %s de hasta 2 MB', (type) => {
    expect(imageFileProblem(file(type, 2 * 1024 * 1024))).toBeNull();
  });

  it('rechaza un PDF', () => {
    expect(imageFileProblem(file('application/pdf', 10))).toBe('La foto debe ser JPG, PNG o WebP');
  });

  it('rechaza más de 2 MB', () => {
    expect(imageFileProblem(file('image/jpeg', 3 * 1024 * 1024))).toBe(
      'La foto no puede pasar de 2 MB',
    );
  });
});

describe('fitWithin', () => {
  it.each([
    [1600, 1200, { width: 800, height: 600 }],
    [600, 2400, { width: 200, height: 800 }],
    [640, 480, { width: 640, height: 480 }],
    [800, 800, { width: 800, height: 800 }],
  ])('%i×%i → %o', (w, h, expected) => {
    expect(fitWithin(w, h)).toEqual(expected);
  });
});
