import { Injectable } from '@nestjs/common';
import {
  toIngredient,
  type CreateIngredient,
  type Ingredient,
  type TablesUpdate,
  type UpdateIngredient,
} from '@tus-antojos/shared';
import { AppException } from '../../common/app-exception.js';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { catalogError } from './catalog-error.js';

const CONFLICT_MESSAGE = 'Ya existe un insumo con ese nombre';

@Injectable()
export class IngredientsService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(input: CreateIngredient): Promise<Ingredient> {
    const { data, error } = await this.supabase.admin
      .from('ingredients')
      .insert({ name: input.name, unit: input.unit, is_active: input.isActive })
      .select()
      .single();
    if (error) throw catalogError(error, CONFLICT_MESSAGE);
    return toIngredient(data);
  }

  /**
   * La BD rechaza cambiar la unidad de un insumo que está en una receta
   * (INGREDIENT_UNIT_LOCKED) y desactivar uno que usan productos activos (INGREDIENT_IN_USE).
   */
  async update(id: string, input: UpdateIngredient): Promise<Ingredient> {
    const changes: TablesUpdate<'ingredients'> = {
      name: input.name,
      unit: input.unit,
      is_active: input.isActive,
    };
    const { data, error } = await this.supabase.admin
      .from('ingredients')
      .update(changes)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw catalogError(error, CONFLICT_MESSAGE);
    if (!data) throw new AppException('NOT_FOUND', 'Insumo no encontrado');
    return toIngredient(data);
  }
}
