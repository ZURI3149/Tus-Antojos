import { Injectable } from '@nestjs/common';
import {
  toInventoryMovement,
  type CountStockInput,
  type InventoryMovement,
  type RecordWasteInput,
} from '@tus-antojos/shared';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { inventoryError } from './inventory-error.js';

@Injectable()
export class AdjustmentsService {
  constructor(private readonly supabase: SupabaseService) {}

  async recordWaste(input: RecordWasteInput, userId: string): Promise<InventoryMovement> {
    const { data, error } = await this.supabase.admin.rpc('record_waste', {
      p_ingredient_id: input.ingredientId,
      p_quantity: input.quantity,
      p_reason: input.reason,
      p_user_id: userId,
    });

    if (error) throw inventoryError(error);
    return toInventoryMovement(data);
  }

  async countStock(input: CountStockInput, userId: string): Promise<InventoryMovement> {
    const { data, error } = await this.supabase.admin.rpc('count_stock', {
      p_ingredient_id: input.ingredientId,
      p_counted: input.counted,
      p_reason: input.reason,
      p_user_id: userId,
    });

    if (error) throw inventoryError(error);
    return toInventoryMovement(data);
  }
}
