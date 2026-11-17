import { Injectable } from '@nestjs/common';
import {
  toCategory,
  type Category,
  type CreateCategory,
  type TablesUpdate,
  type UpdateCategory,
} from '@tus-antojos/shared';
import { AppException } from '../../common/app-exception.js';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { catalogError } from './catalog-error.js';

const CONFLICT_MESSAGE = 'Ya existe una categoría con ese nombre';

@Injectable()
export class CategoriesService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(input: CreateCategory): Promise<Category> {
    const { data, error } = await this.supabase.admin
      .from('categories')
      .insert({ name: input.name, sort_order: input.sortOrder, is_active: input.isActive })
      .select()
      .single();
    if (error) throw catalogError(error, CONFLICT_MESSAGE);
    return toCategory(data);
  }

  /** Desactivar una categoría con productos activos falla con CATEGORY_IN_USE (regla de la BD). */
  async update(id: string, input: UpdateCategory): Promise<Category> {
    const changes: TablesUpdate<'categories'> = {
      name: input.name,
      sort_order: input.sortOrder,
      is_active: input.isActive,
    };
    const { data, error } = await this.supabase.admin
      .from('categories')
      .update(changes)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw catalogError(error, CONFLICT_MESSAGE);
    if (!data) throw new AppException('NOT_FOUND', 'Categoría no encontrada');
    return toCategory(data);
  }
}
