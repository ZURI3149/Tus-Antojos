import type { SupabaseClient } from '@supabase/supabase-js';
import {
  computeStockTotalValue,
  stockStatus,
  toIngredient,
  toInventoryMovement,
  type Database,
  type Ingredient,
  type IngredientUnit,
  type InventoryMovement,
  type StockStatus,
} from '@tus-antojos/shared';
import { createContext, useContext } from 'react';

export interface StockRowData {
  ingredientId: string;
  ingredientName: string;
  unit: IngredientUnit;
  isActive: boolean;
  quantity: number;
  avgUnitCost: string;
  minQuantity: number;
  updatedAt: string;
  status: StockStatus;
  totalValueCents: number;
}

export interface PurchaseItemData {
  ingredientId: string;
  ingredientName: string;
  unit: IngredientUnit;
  quantity: number;
  costCents: number;
}

export interface PurchaseRowData {
  id: string;
  purchasedOn: string;
  supplier: string;
  note: string;
  totalCents: number;
  createdBy: string | null;
  createdAt: string;
  items: PurchaseItemData[];
}

export interface InventoryReader {
  stock(): Promise<StockRowData[]>;
  kardex(ingredientId: string, limit?: number): Promise<InventoryMovement[]>;
  purchases(limit?: number): Promise<PurchaseRowData[]>;
  ingredient(id: string): Promise<Ingredient | null>;
}

function unwrap<T>(result: { data: T | null; error: unknown }, what: string): T {
  if (result.error || result.data === null) {
    throw new Error(`No se pudo cargar ${what}`, { cause: result.error });
  }
  return result.data;
}

export function createSupabaseInventoryReader(db: SupabaseClient<Database>): InventoryReader {
  return {
    async stock() {
      // Unimos inventory_stock con ingredients
      const result = await db
        .from('inventory_stock')
        .select(
          `
          ingredient_id,
          quantity,
          avg_unit_cost,
          min_quantity,
          updated_at,
          ingredients!inner (
            id,
            name,
            unit,
            is_active
          )
        `,
        )
        .order('ingredients(name)');

      const rows = unwrap(result, 'el inventario');

      return rows.map((row) => {
        const ing = row.ingredients as unknown as {
          id: string;
          name: string;
          unit: IngredientUnit;
          is_active: boolean;
        };
        const quantity = Number(row.quantity);
        const minQuantity = Number(row.min_quantity);
        const avgUnitCost = String(row.avg_unit_cost);

        return {
          ingredientId: row.ingredient_id,
          ingredientName: ing.name,
          unit: ing.unit,
          isActive: ing.is_active,
          quantity,
          avgUnitCost,
          minQuantity,
          updatedAt: new Date(row.updated_at).toISOString(),
          status: stockStatus(quantity, minQuantity),
          totalValueCents: computeStockTotalValue(quantity, avgUnitCost),
        };
      });
    },

    async kardex(ingredientId: string, limit = 50) {
      const result = await db
        .from('inventory_movements')
        .select('*')
        .eq('ingredient_id', ingredientId)
        .order('id', { ascending: false })
        .limit(limit);

      return unwrap(result, 'el kardex').map(toInventoryMovement);
    },

    async purchases(limit = 50) {
      const result = await db
        .from('purchases')
        .select(
          `
          id,
          purchased_on,
          supplier,
          note,
          total_cents,
          created_by,
          created_at,
          purchase_items (
            ingredient_id,
            quantity,
            cost_cents,
            ingredients (
              name,
              unit
            )
          )
        `,
        )
        .order('purchased_on', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      const rows = unwrap(result, 'las compras');

      return rows.map((p) => {
        const items: PurchaseItemData[] = (p.purchase_items ?? []).map((item) => {
          const ing = item.ingredients as unknown as { name: string; unit: IngredientUnit };
          return {
            ingredientId: item.ingredient_id,
            ingredientName: ing?.name ?? 'Desconocido',
            unit: ing?.unit ?? 'unidad',
            quantity: Number(item.quantity),
            costCents: Number(item.cost_cents),
          };
        });

        return {
          id: p.id,
          purchasedOn: p.purchased_on,
          supplier: p.supplier,
          note: p.note,
          totalCents: Number(p.total_cents),
          createdBy: p.created_by,
          createdAt: new Date(p.created_at).toISOString(),
          items,
        };
      });
    },

    async ingredient(id: string) {
      const result = await db.from('ingredients').select('*').eq('id', id).maybeSingle();
      if (result.error) throw new Error('No se pudo cargar el insumo', { cause: result.error });
      return result.data ? toIngredient(result.data) : null;
    },
  };
}

export const InventoryReaderContext = createContext<InventoryReader | null>(null);

export function useInventoryReader(): InventoryReader {
  const reader = useContext(InventoryReaderContext);
  if (!reader) throw new Error('useInventoryReader() debe usarse dentro de <AppProviders>');
  return reader;
}
