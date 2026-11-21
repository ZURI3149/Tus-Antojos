import { Injectable } from '@nestjs/common';
import type { RegisterPurchase } from '@tus-antojos/shared';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { inventoryError } from './inventory-error.js';

@Injectable()
export class PurchasesService {
  constructor(private readonly supabase: SupabaseService) {}

  async register(input: RegisterPurchase, userId: string): Promise<{ id: string }> {
    const { data, error } = await this.supabase.admin.rpc('register_purchase', {
      p_purchased_on: input.purchasedOn,
      p_supplier: input.supplier,
      p_note: input.note,
      p_items: input.items,
      p_user_id: userId,
    });

    if (error) throw inventoryError(error);
    return { id: data as string };
  }
}
