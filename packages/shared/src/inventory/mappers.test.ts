import { describe, expect, it } from 'vitest';
import { purchaseSchema } from './inventory.schema';
import { toInventoryMovement, toPurchase, toStockItem } from './mappers';

describe('inventory mappers', () => {
  it('toStockItem maps inventory_stock row to StockItem', () => {
    const row = {
      ingredient_id: '00000000-0000-4000-8000-000000000001',
      quantity: 1500,
      avg_unit_cost: 0.8,
      min_quantity: 500,
      updated_at: '2026-11-20T12:00:00Z',
    };
    const item = toStockItem(row);
    expect(item).toEqual({
      ingredientId: '00000000-0000-4000-8000-000000000001',
      quantity: 1500,
      avgUnitCost: '0.8',
      minQuantity: 500,
      updatedAt: '2026-11-20T12:00:00.000Z',
    });
  });

  it('toInventoryMovement maps inventory_movements row to InventoryMovement', () => {
    const row = {
      id: 42,
      ingredient_id: '00000000-0000-4000-8000-000000000001',
      type: 'compra' as const,
      quantity: 1000,
      cost_cents: 800,
      balance_quantity: 1000,
      balance_avg_unit_cost: 0.8,
      purchase_id: '00000000-0000-4000-8000-000000000002',
      order_id: null,
      reason: 'Compra inicial',
      created_by: '00000000-0000-4000-8000-000000000003',
      created_at: '2026-11-20T12:00:00Z',
    };
    const movement = toInventoryMovement(row);
    expect(movement).toEqual({
      id: 42,
      ingredientId: '00000000-0000-4000-8000-000000000001',
      type: 'compra',
      quantity: 1000,
      costCents: 800,
      balanceQuantity: 1000,
      balanceAvgUnitCost: '0.8',
      purchaseId: '00000000-0000-4000-8000-000000000002',
      orderId: null,
      reason: 'Compra inicial',
      createdBy: '00000000-0000-4000-8000-000000000003',
      createdAt: '2026-11-20T12:00:00.000Z',
    });
  });

  it('toPurchase maps purchases row to Purchase', () => {
    const row = {
      id: '00000000-0000-4000-8000-000000000001',
      purchased_on: '2026-11-20',
      supplier: 'Molino Real',
      note: 'Factura 123',
      total_cents: 5000,
      created_by: '00000000-0000-4000-8000-000000000002',
      created_at: '2026-11-20T12:00:00Z',
      purchase_items: [
        {
          purchase_id: '00000000-0000-4000-8000-000000000001',
          ingredient_id: '00000000-0000-4000-8000-000000000003',
          quantity: 2000,
          cost_cents: 5000,
        },
      ],
    };
    const purchase = toPurchase(row);
    expect(purchase).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      purchasedOn: '2026-11-20',
      supplier: 'Molino Real',
      note: 'Factura 123',
      totalCents: 5000,
      createdBy: '00000000-0000-4000-8000-000000000002',
      createdAt: '2026-11-20T12:00:00.000Z',
      items: [
        {
          ingredientId: '00000000-0000-4000-8000-000000000003',
          quantity: 2000,
          costCents: 5000,
        },
      ],
    });
  });

  it('toPurchase conserva createdBy null cuando el usuario fue eliminado', () => {
    const purchase = toPurchase({
      id: '00000000-0000-4000-8000-000000000001',
      purchased_on: '2026-11-20',
      supplier: '',
      note: '',
      total_cents: 0,
      created_by: null,
      created_at: '2026-11-20T12:00:00Z',
    });
    expect(purchase.createdBy).toBeNull();
    expect(purchaseSchema.safeParse(purchase).success).toBe(true);
  });
});
