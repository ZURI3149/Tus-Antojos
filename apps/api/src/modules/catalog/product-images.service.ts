import { Injectable } from '@nestjs/common';
import {
  PRODUCT_IMAGE_BUCKET,
  PRODUCT_IMAGE_PATH,
  type Product,
  type ProductImageUpload,
} from '@tus-antojos/shared';
import { AppException } from '../../common/app-exception.js';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { ProductsService } from './products.service.js';

const folderOf = (productId: string) => `products/${productId}`;

/**
 * Foto del producto (spec catalog D3). El navegador sube directo a Storage con una URL
 * firmada que emite esta API; el bucket limita tamaño (2 MB) y tipo (JPG/PNG/WebP).
 * Cada producto tiene su carpeta `products/<id>/` y solo conserva la foto asignada.
 */
@Injectable()
export class ProductImagesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly products: ProductsService,
  ) {}

  private get bucket() {
    return this.supabase.admin.storage.from(PRODUCT_IMAGE_BUCKET);
  }

  /** URL firmada para subir `products/<id>/<uuid>.webp`. */
  async createUpload(productId: string): Promise<ProductImageUpload> {
    await this.products.get(productId);
    const path = `${folderOf(productId)}/${crypto.randomUUID()}.webp`;
    const { data, error } = await this.bucket.createSignedUploadUrl(path);
    if (error) throw storageError(error);
    return { path: data.path, token: data.token, signedUrl: data.signedUrl };
  }

  /**
   * Asigna una foto ya subida. El path debe estar en la carpeta del producto y el archivo
   * debe existir; luego se borran las demás fotos de la carpeta (la anterior y las
   * subidas que nunca se confirmaron).
   */
  async confirm(productId: string, path: string): Promise<Product> {
    if (PRODUCT_IMAGE_PATH.exec(path)?.[1] !== productId) {
      throw new AppException('VALIDATION_ERROR', 'La imagen no pertenece a este producto');
    }
    const { data: exists, error } = await this.bucket.exists(path);
    if (!exists) {
      if (error && !isNotFound(error)) throw storageError(error);
      throw new AppException('VALIDATION_ERROR', 'La imagen no se subió');
    }

    const product = await this.products.setImagePath(productId, path);
    await this.removeFolder(productId, path);
    return product;
  }

  /** Quita la foto y borra los archivos del producto. */
  async remove(productId: string): Promise<Product> {
    const product = await this.products.setImagePath(productId, null);
    await this.removeFolder(productId);
    return product;
  }

  /** Borra los archivos de la carpeta del producto, menos `keep`. */
  private async removeFolder(productId: string, keep?: string): Promise<void> {
    const folder = folderOf(productId);
    const { data: files, error } = await this.bucket.list(folder, { limit: 100 });
    if (error) throw storageError(error);
    const paths = files.map((file) => `${folder}/${file.name}`).filter((path) => path !== keep);
    if (paths.length === 0) return;
    const removed = await this.bucket.remove(paths);
    if (removed.error) throw storageError(removed.error);
  }
}

/** `exists()` informa "no existe" como error con estado 400/404 según la versión de Storage. */
function isNotFound(error: unknown): boolean {
  const { status, statusCode } = error as { status?: number; statusCode?: string | number };
  return [400, 404].includes(Number(status ?? statusCode));
}

function storageError(error: unknown): AppException {
  return new AppException('INTERNAL', undefined, undefined, { cause: error });
}
