import { Injectable } from '@nestjs/common';
import {
  toProduct,
  type CreateProduct,
  type Product,
  type TablesUpdate,
  type UpdateProduct,
} from '@tus-antojos/shared';
import { AppException } from '../../common/app-exception.js';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { catalogError } from './catalog-error.js';

const CONFLICT_MESSAGE = 'Ya existe un producto con ese nombre';
const WITH_RECIPE = '*, recipe_items(ingredient_id, quantity)';

@Injectable()
export class ProductsService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Producto y receta en una transacción (`create_product`): si algo falla, no queda nada. */
  async create(input: CreateProduct): Promise<Product> {
    const { data: id, error } = await this.supabase.admin.rpc('create_product', {
      p_category_id: input.categoryId,
      p_name: input.name,
      p_description: input.description,
      p_price_cents: input.priceCents,
      p_is_active: input.isActive,
      p_recipe: input.recipe.map((item) => ({
        ingredient_id: item.ingredientId,
        quantity: item.quantity,
      })),
    });
    if (error) throw catalogError(error, CONFLICT_MESSAGE);
    return this.get(id);
  }

  /**
   * Datos del producto (la receta y la foto van por rutas propias). Activarlo sin receta,
   * con insumos o categoría inactivos falla con la regla de la BD (422).
   */
  async update(id: string, input: UpdateProduct): Promise<Product> {
    const changes: TablesUpdate<'products'> = {
      category_id: input.categoryId,
      name: input.name,
      description: input.description,
      price_cents: input.priceCents,
      is_active: input.isActive,
    };
    const { data, error } = await this.supabase.admin
      .from('products')
      .update(changes)
      .eq('id', id)
      .select(WITH_RECIPE)
      .maybeSingle();
    if (error) throw catalogError(error, CONFLICT_MESSAGE);
    if (!data) throw new AppException('NOT_FOUND', 'Producto no encontrado');
    return toProduct(data);
  }

  private async get(id: string): Promise<Product> {
    const { data, error } = await this.supabase.admin
      .from('products')
      .select(WITH_RECIPE)
      .eq('id', id)
      .single();
    if (error) throw catalogError(error, CONFLICT_MESSAGE);
    return toProduct(data);
  }
}
