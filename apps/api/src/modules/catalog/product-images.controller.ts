import { Body, Controller, Delete, Param, Post, Put } from '@nestjs/common';
import {
  confirmProductImageSchema,
  type ConfirmProductImage,
  type Product,
  type ProductImageUpload,
} from '@tus-antojos/shared';
import { z } from 'zod';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { ProductImagesService } from './product-images.service.js';

const productId = new ZodValidationPipe(z.uuid());

@Roles('admin')
@Controller('products/:id')
export class ProductImagesController {
  constructor(private readonly images: ProductImagesService) {}

  /** URL firmada para subir la foto directo a Storage (sin cuerpo). */
  @Post('image-upload')
  createUpload(
    @Param('id', productId) id: string,
    @Body(new ZodValidationPipe(z.strictObject({}))) _body: Record<string, never>,
  ): Promise<ProductImageUpload> {
    return this.images.createUpload(id);
  }

  /** Confirma la foto subida y borra la anterior. */
  @Put('image')
  confirm(
    @Param('id', productId) id: string,
    @Body(new ZodValidationPipe(confirmProductImageSchema)) body: ConfirmProductImage,
  ): Promise<Product> {
    return this.images.confirm(id, body.path);
  }

  @Delete('image')
  remove(@Param('id', productId) id: string): Promise<Product> {
    return this.images.remove(id);
  }
}
