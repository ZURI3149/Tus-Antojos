import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import {
  createProductSchema,
  updateProductSchema,
  type CreateProduct,
  type Product,
  type UpdateProduct,
} from '@tus-antojos/shared';
import { z } from 'zod';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { ProductsService } from './products.service.js';

/** Solo escrituras: la web lee el catálogo directo de Supabase (RLS). */
@Roles('admin')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Post()
  create(@Body(new ZodValidationPipe(createProductSchema)) body: CreateProduct): Promise<Product> {
    return this.products.create(body);
  }

  @Patch(':id')
  update(
    @Param('id', new ZodValidationPipe(z.uuid())) id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) body: UpdateProduct,
  ): Promise<Product> {
    return this.products.update(id, body);
  }
}
