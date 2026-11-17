import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import {
  createIngredientSchema,
  updateIngredientSchema,
  type CreateIngredient,
  type Ingredient,
  type UpdateIngredient,
} from '@tus-antojos/shared';
import { z } from 'zod';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { IngredientsService } from './ingredients.service.js';

/** Solo escrituras: la web lee el catálogo directo de Supabase (RLS). */
@Roles('admin')
@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredients: IngredientsService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(createIngredientSchema)) body: CreateIngredient,
  ): Promise<Ingredient> {
    return this.ingredients.create(body);
  }

  @Patch(':id')
  update(
    @Param('id', new ZodValidationPipe(z.uuid())) id: string,
    @Body(new ZodValidationPipe(updateIngredientSchema)) body: UpdateIngredient,
  ): Promise<Ingredient> {
    return this.ingredients.update(id, body);
  }
}
