import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import {
  createCategorySchema,
  updateCategorySchema,
  type Category,
  type CreateCategory,
  type UpdateCategory,
} from '@tus-antojos/shared';
import { z } from 'zod';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { CategoriesService } from './categories.service.js';

/** Solo escrituras: la web lee el catálogo directo de Supabase (RLS). */
@Roles('admin')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(createCategorySchema)) body: CreateCategory,
  ): Promise<Category> {
    return this.categories.create(body);
  }

  @Patch(':id')
  update(
    @Param('id', new ZodValidationPipe(z.uuid())) id: string,
    @Body(new ZodValidationPipe(updateCategorySchema)) body: UpdateCategory,
  ): Promise<Category> {
    return this.categories.update(id, body);
  }
}
