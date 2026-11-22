import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, PromotionKind } from '@tus-antojos/shared';
import { createContext, useContext } from 'react';

export interface PromotionRowData {
  id: string;
  name: string;
  kind: PromotionKind;
  value: number;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
  productCount: number;
  productIds: string[];
  createdAt: string;
}

export interface PromotionsReader {
  promotions(): Promise<PromotionRowData[]>;
  promotion(id: string): Promise<PromotionRowData | null>;
}

function unwrap<T>(result: { data: T | null; error: unknown }, what: string): T {
  if (result.error || result.data === null) {
    throw new Error(`No se pudo cargar ${what}`, { cause: result.error });
  }
  return result.data;
}

export function createSupabasePromotionsReader(db: SupabaseClient<Database>): PromotionsReader {
  return {
    async promotions() {
      const result = await db
        .from('promotions')
        .select(
          `
          id,
          name,
          kind,
          value,
          starts_at,
          ends_at,
          is_active,
          created_at,
          promotion_products (
            product_id
          )
        `,
        )
        .order('starts_at', { ascending: false });

      const data = unwrap(result, 'las promociones');
      return data.map((p) => {
        const productIds = (p.promotion_products ?? []).map((pp) => pp.product_id);
        return {
          id: p.id,
          name: p.name,
          kind: p.kind,
          value: p.value,
          startsAt: p.starts_at,
          endsAt: p.ends_at,
          isActive: p.is_active,
          productCount: productIds.length,
          productIds,
          createdAt: p.created_at,
        };
      });
    },

    async promotion(id: string) {
      const result = await db
        .from('promotions')
        .select(
          `
          id,
          name,
          kind,
          value,
          starts_at,
          ends_at,
          is_active,
          created_at,
          promotion_products (
            product_id
          )
        `,
        )
        .eq('id', id)
        .maybeSingle();

      if (result.error) {
        throw new Error('No se pudo cargar la promoción', { cause: result.error });
      }
      if (!result.data) return null;

      const p = result.data;
      const productIds = (p.promotion_products ?? []).map((pp) => pp.product_id);
      return {
        id: p.id,
        name: p.name,
        kind: p.kind,
        value: p.value,
        startsAt: p.starts_at,
        endsAt: p.ends_at,
        isActive: p.is_active,
        productCount: productIds.length,
        productIds,
        createdAt: p.created_at,
      };
    },
  };
}

export const PromotionsReaderContext = createContext<PromotionsReader | null>(null);

export function usePromotionsReader(): PromotionsReader {
  const reader = useContext(PromotionsReaderContext);
  if (!reader) throw new Error('usePromotionsReader() debe usarse dentro de <AppProviders>');
  return reader;
}
