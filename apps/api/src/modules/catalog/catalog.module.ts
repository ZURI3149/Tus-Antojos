import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';
import { IngredientsController } from './ingredients.controller.js';
import { IngredientsService } from './ingredients.service.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

/** Escrituras del catálogo (spec catalog §3.1). Todas las rutas son solo para admin. */
@Module({
  imports: [AuthModule],
  controllers: [CategoriesController, IngredientsController, ProductsController],
  providers: [CategoriesService, IngredientsService, ProductsService],
})
export class CatalogModule {}
