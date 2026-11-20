import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createFakeApi, type FakeApi } from '@/test/fake-api';
import { createFakeAuth } from '@/test/fake-auth';
import { renderApp } from '@/test/render-app';
import type * as ResizeImage from './resize-image';

// jsdom no tiene canvas ni createImageBitmap: la reducción se prueba aparte (resize-image.test.ts).
vi.mock('./resize-image', async (importOriginal) => ({
  ...(await importOriginal<typeof ResizeImage>()),
  resizeToWebp: vi.fn(async () => new Blob(['webp'], { type: 'image/webp' })),
}));

const CONO = '00000000-0000-4000-8000-0000000000f1';
const OLD_PATH = `products/${CONO}/00000000-0000-4000-8000-0000000000aa.webp`;

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:vista-previa');
  URL.revokeObjectURL = vi.fn();
});

function open(api: FakeApi = createFakeApi()) {
  const result = renderApp(`/admin/productos/${CONO}`, createFakeAuth({ session: 'admin' }), api);
  // applyAccept: false → se puede intentar elegir un PDF, como al arrastrar un archivo.
  return { ...result, user: userEvent.setup({ applyAccept: false }) };
}

const photo = (type = 'image/jpeg', bytes = 1000) =>
  new File([new Uint8Array(bytes)], 'foto.jpg', { type });
const field = () => screen.findByRole('group', { name: 'Foto' });

describe('ProductImageField', () => {
  it('elige, previsualiza, sube y confirma la foto', async () => {
    const { user, api } = open();
    const f = await field();
    expect(within(f).getByText('Sin foto')).toBeVisible();

    await user.upload(within(f).getByLabelText('Elegir foto'), photo());
    expect(await within(f).findByRole('img', { name: 'Vista previa' })).toHaveAttribute(
      'src',
      'blob:vista-previa',
    );
    await user.click(within(f).getByRole('button', { name: 'Guardar foto' }));

    await waitFor(() =>
      expect(api.calls).toHaveBeenCalledWith(
        'PUT',
        `/products/${CONO}/image`,
        expect.objectContaining({ path: expect.stringMatching(`^products/${CONO}/`) }),
      ),
    );
    const saved = api.catalog.data.products.find((p) => p.id === CONO)!.imagePath!;
    expect(api.catalog.files).toEqual(new Set([saved]));
    expect(await within(f).findByRole('img', { name: 'Foto de Cono simple' })).toHaveAttribute(
      'src',
      `https://storage.test/${saved}`,
    );
  });

  it.each([
    ['un PDF', photo('application/pdf'), 'La foto debe ser JPG, PNG o WebP'],
    ['un archivo de 3 MB', photo('image/jpeg', 3 * 1024 * 1024), 'La foto no puede pasar de 2 MB'],
  ])('rechaza %s antes de subirlo (CA-08)', async (_label, file, message) => {
    const { user, api } = open();
    const f = await field();
    await user.upload(within(f).getByLabelText('Elegir foto'), file);
    expect(await within(f).findByText(message)).toBeVisible();
    expect(within(f).queryByRole('button', { name: 'Guardar foto' })).not.toBeInTheDocument();
    expect(api.calls).not.toHaveBeenCalledWith('POST', expect.stringContaining('image'), {});
  });

  it('reemplazar la foto borra la anterior (CA-08)', async () => {
    const api = createFakeApi();
    api.catalog.data.products.find((p) => p.id === CONO)!.imagePath = OLD_PATH;
    api.catalog.files.add(OLD_PATH);
    const { user } = open(api);
    const f = await field();
    expect(within(f).getByRole('img', { name: 'Foto de Cono simple' })).toHaveAttribute(
      'src',
      `https://storage.test/${OLD_PATH}`,
    );

    await user.upload(within(f).getByLabelText('Cambiar foto'), photo());
    await user.click(await within(f).findByRole('button', { name: 'Guardar foto' }));
    await waitFor(() =>
      expect(api.catalog.data.products.find((p) => p.id === CONO)!.imagePath).not.toBe(OLD_PATH),
    );
    expect(api.catalog.files.has(OLD_PATH)).toBe(false);
    expect(api.catalog.files.size).toBe(1);
  });

  it('cancelar la vista previa no sube nada', async () => {
    const { user, api } = open();
    const f = await field();
    await user.upload(within(f).getByLabelText('Elegir foto'), photo());
    await user.click(await within(f).findByRole('button', { name: 'Cancelar' }));
    expect(within(f).getByText('Sin foto')).toBeVisible();
    expect(api.catalog.files.size).toBe(0);
  });

  it('quita la foto', async () => {
    const api = createFakeApi();
    api.catalog.data.products.find((p) => p.id === CONO)!.imagePath = OLD_PATH;
    api.catalog.files.add(OLD_PATH);
    const { user } = open(api);
    await user.click(within(await field()).getByRole('button', { name: 'Quitar foto' }));
    await waitFor(() =>
      expect(api.calls).toHaveBeenCalledWith('DELETE', `/products/${CONO}/image`),
    );
    expect(await within(await field()).findByText('Sin foto')).toBeVisible();
    expect(api.catalog.files.size).toBe(0);
  });
});
