import { Injectable } from '@nestjs/common';
import { toStockItem, type StockItem, type UpdateStockInput } from '@tus-antojos/shared';
import { AppException } from '../../common/app-exception.js';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { inventoryError } from './inventory-error.js';

@Injectable()
export class StockService {
  constructor(private readonly supabase: SupabaseService) {}

  async updateMinQuantity(ingredientId: string, input: UpdateStockInput): Promise<StockItem> {
    const { data, error } = await this.supabase.admin
      .from('inventory_stock')
      .update({ min_quantity: input.minQuantity })
      .eq('ingredient_id', ingredientId)
      .select()
      .maybeSingle();

    if (error) throw inventoryError(error);
    if (!data) throw new AppException('NOT_FOUND', 'Insumo no encontrado');

    return toStockItem(data);
  }
}
