import {
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_MAX_DIMENSION,
  PRODUCT_IMAGE_MIME_TYPES,
} from '@tus-antojos/shared';

/** Motivo por el que no se acepta el archivo elegido, o null si sirve (spec catalog D3). */
export function imageFileProblem(file: File): string | null {
  if (!(PRODUCT_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'La foto debe ser JPG, PNG o WebP';
  }
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) return 'La foto no puede pasar de 2 MB';
  return null;
}

/** Tamaño que cabe en un cuadrado de `max` px sin deformar. Nunca agranda. */
export function fitWithin(
  width: number,
  height: number,
  max: number = PRODUCT_IMAGE_MAX_DIMENSION,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Reduce la foto a máx. 800 px y la convierte a WebP con un canvas (sin dependencias). */
export async function resizeToWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const size = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo procesar la foto');
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.85),
  );
  // Un navegador sin codificador WebP devuelve PNG: el bucket espera .webp.
  if (!blob || blob.type !== 'image/webp') {
    throw new Error('Este navegador no puede convertir la foto a WebP');
  }
  return blob;
}
