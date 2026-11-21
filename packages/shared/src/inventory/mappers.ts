import type { Tables } from '../db';
import type { InventoryMovement, Purchase, StockItem } from './inventory.schema';

const iso = (value: string) => new Date(value).toISOString();

export function toStockItem(row: Tables<'inventory_stock'>): StockItem {
  return {
    ingredientId: row.ingredient_id,
    quantity: Number(row.quantity),
    avgUnitCost: String(row.avg_unit_cost),
    minQuantity: row.min_quantity,
    updatedAt: iso(row.updated_at),
  };
}

export function toInventoryMovement(row: Tables<'inventory_movements'>): InventoryMovement {
  return {
    id: Number(row.id),
    ingredientId: row.ingredient_id,
    type: row.type,
    quantity: row.quantity,
    costCents: row.cost_cents,
    balanceQuantity: Number(row.balance_quantity),
    balanceAvgUnitCost: String(row.balance_avg_unit_cost),
    purchaseId: row.purchase_id,
    orderId: row.order_id,
    reason: row.reason,
    createdBy: row.created_by,
    createdAt: iso(row.created_at),
  };
}

export function toPurchase(
  row: Tables<'purchases'> & { purchase_items?: Tables<'purchase_items'>[] },
): Purchase {
  return {
    id: row.id,
    purchasedOn: row.purchased_on,
    supplier: row.supplier,
    note: row.note,
    totalCents: Number(row.total_cents),
    createdBy: row.created_by,
    createdAt: iso(row.created_at),
    items: row.purchase_items?.map((item) => ({
      ingredientId: item.ingredient_id,
      quantity: item.quantity,
      costCents: item.cost_cents,
    })),
  };
}
