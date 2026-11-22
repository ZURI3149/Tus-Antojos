import { Injectable } from '@nestjs/common';
import type { CreatePromotion, Json, UpdatePromotion } from '@tus-antojos/shared';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { promotionsError } from './promotions-error.js';

@Injectable()
export class PromotionsService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(input: CreatePromotion, userId: string): Promise<{ id: string }> {
    const { data: id, error } = await this.supabase.admin.rpc('create_promotion', {
      p_name: input.name,
      p_kind: input.kind,
      p_value: input.value,
      p_starts_at: input.startsAt,
      p_ends_at: input.endsAt ?? undefined,
      p_product_ids: input.productIds,
      p_user_id: userId,
    });
    if (error) throw promotionsError(error);
    return { id: id! };
  }

  async update(id: string, input: UpdatePromotion): Promise<{ id: string }> {
    const changes: Record<string, Json | undefined> = {};
    if (input.name !== undefined) changes.name = input.name;
    if (input.kind !== undefined) changes.kind = input.kind;
    if (input.value !== undefined) changes.value = input.value;
    if (input.startsAt !== undefined) changes.starts_at = input.startsAt;
    if (input.endsAt !== undefined) changes.ends_at = input.endsAt;
    if (input.isActive !== undefined) changes.is_active = input.isActive;

    const { error } = await this.supabase.admin.rpc('update_promotion', {
      p_id: id,
      p_changes: changes as Json,
      p_product_ids: input.productIds ?? undefined,
    });
    if (error) throw promotionsError(error);
    return { id };
  }
}
