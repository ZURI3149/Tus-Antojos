import { Body, Controller, Param, Patch, Post, Put } from '@nestjs/common';
import {
  createProductSchema,
  setRecipeSchema,
  updateProductSchema,
  type CreateProduct,
  type Product,
  type SetRecipe,
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
    @Param('id', new ZodValidationPipe(z.guid())) id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) body: UpdateProduct,
  ): Promise<Product> {
    return this.products.update(id, body);
  }

  /** Reemplaza la receta completa. */
  @Put(':id/recipe')
  setRecipe(
    @Param('id', new ZodValidationPipe(z.guid())) id: string,
    @Body(new ZodValidationPipe(setRecipeSchema)) body: SetRecipe,
  ): Promise<Product> {
    return this.products.setRecipe(id, body.items);
  }
}
