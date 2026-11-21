import type {
  CountStockInput,
  InventoryMovement,
  InventoryRule,
  RecordWasteInput,
  RegisterPurchaseInput,
  StockItem,
  UpdateStockInput,
} from '@tus-antojos/shared';
import { computeStockTotalValue, inventoryRuleMessage, stockStatus } from '@tus-antojos/shared';
import type { InventoryReader, PurchaseRowData, StockRowData } from '@/features/inventory/reader';
import { ApiError } from '@/lib/api-client';
import { NOT_HANDLED, type FakeCatalog } from './fake-catalog';

const NOW = '2026-11-20T12:00:00.000Z';

function rule(code: InventoryRule, status = 422) {
  return new ApiError(
    status,
    status === 404 ? 'NOT_FOUND' : 'BUSINESS_RULE',
    inventoryRuleMessage(code) ?? 'Error',
    { reason: code },
    'r',
  );
}

export interface InventoryData {
  stock: Map<string, StockItem>;
  movements: InventoryMovement[];
  purchases: PurchaseRowData[];
}

export function seedInventory(catalog: FakeCatalog): InventoryData {
  const stock = new Map<string, StockItem>();
  const movements: InventoryMovement[] = [];
  const purchases: PurchaseRowData[] = [];

  for (const ing of catalog.data.ingredients) {
    if (ing.name === 'Leche') {
      stock.set(ing.id, {
        ingredientId: ing.id,
        quantity: 2000,
        avgUnitCost: '0.500000',
        minQuantity: 1000,
        updatedAt: NOW,
      });
      movements.push({
        id: 1,
        ingredientId: ing.id,
        type: 'compra',
        quantity: 2000,
        costCents: 1000,
        balanceQuantity: 2000,
        balanceAvgUnitCost: '0.500000',
        purchaseId: '00000000-0000-4000-8000-0000000000p1',
        orderId: null,
        reason: 'Compra inicial',
        createdBy: null,
        createdAt: NOW,
      });
    } else if (ing.name === 'Azúcar') {
      stock.set(ing.id, {
        ingredientId: ing.id,
        quantity: 500,
        avgUnitCost: '0.800000',
        minQuantity: 1000,
        updatedAt: NOW,
      });
      movements.push({
        id: 2,
        ingredientId: ing.id,
        type: 'compra',
        quantity: 1000,
        costCents: 800,
        balanceQuantity: 1000,
        balanceAvgUnitCost: '0.800000',
        purchaseId: '00000000-0000-4000-8000-0000000000p1',
        orderId: null,
        reason: 'Compra inicial',
        createdBy: null,
        createdAt: NOW,
      });
      movements.push({
        id: 3,
        ingredientId: ing.id,
        type: 'merma',
        quantity: -500,
        costCents: -400,
        balanceQuantity: 500,
        balanceAvgUnitCost: '0.800000',
        purchaseId: null,
        orderId: null,
        reason: 'Derrame accidental',
        createdBy: null,
        createdAt: NOW,
      });
    } else {
      stock.set(ing.id, {
        ingredientId: ing.id,
        quantity: 0,
        avgUnitCost: '0.000000',
        minQuantity: 0,
        updatedAt: NOW,
      });
    }
  }

  const leche = catalog.data.ingredients.find((i) => i.name === 'Leche');
  const azucar = catalog.data.ingredients.find((i) => i.name === 'Azúcar');

  if (leche && azucar) {
    purchases.push({
      id: '00000000-0000-4000-8000-0000000000p1',
      purchasedOn: '2026-11-20',
      supplier: 'Distribuidora Láctea',
      note: 'Compra para apertura',
      totalCents: 1800,
      createdBy: 'admin',
      createdAt: NOW,
      items: [
        {
          ingredientId: leche.id,
          ingredientName: leche.name,
          unit: leche.unit,
          quantity: 2000,
          costCents: 1000,
        },
        {
          ingredientId: azucar.id,
          ingredientName: azucar.name,
          unit: azucar.unit,
          quantity: 1000,
          costCents: 800,
        },
      ],
    });
  }

  return { stock, movements, purchases };
}

export function createFakeInventory(
  catalog: FakeCatalog,
  data: InventoryData = seedInventory(catalog),
) {
  let nextMovementId = data.movements.length + 1;

  const reader: InventoryReader = {
    async stock(): Promise<StockRowData[]> {
      const rows: StockRowData[] = [];
      for (const ing of catalog.data.ingredients) {
        let s = data.stock.get(ing.id);
        if (!s) {
          s = {
            ingredientId: ing.id,
            quantity: 0,
            avgUnitCost: '0.000000',
            minQuantity: 0,
            updatedAt: NOW,
          };
          data.stock.set(ing.id, s);
        }
        rows.push({
          ingredientId: ing.id,
          ingredientName: ing.name,
          unit: ing.unit,
          isActive: ing.isActive,
          quantity: s.quantity,
          avgUnitCost: s.avgUnitCost,
          minQuantity: s.minQuantity,
          updatedAt: s.updatedAt,
          status: stockStatus(s.quantity, s.minQuantity),
          totalValueCents: computeStockTotalValue(s.quantity, s.avgUnitCost),
        });
      }
      return structuredClone(rows.sort((a, b) => a.ingredientName.localeCompare(b.ingredientName)));
    },

    async kardex(ingredientId: string, limit = 50): Promise<InventoryMovement[]> {
      const filtered = data.movements
        .filter((m) => m.ingredientId === ingredientId)
        .sort((a, b) => b.id - a.id)
        .slice(0, limit);
      return structuredClone(filtered);
    },

    async purchases(limit = 50): Promise<PurchaseRowData[]> {
      return structuredClone(data.purchases.slice(0, limit));
    },

    async ingredient(id: string) {
      const ing = catalog.data.ingredients.find((i) => i.id === id);
      return ing ? structuredClone(ing) : null;
    },
  };

  function handle(method: string, path: string, body?: unknown): unknown {
    const stockMatch = path.match(/^\/inventory\/stock\/(.+)$/);
    if (method === 'PATCH' && stockMatch) {
      const id = stockMatch[1]!;
      const ing = catalog.data.ingredients.find((i) => i.id === id);
      if (!ing) throw new ApiError(404, 'NOT_FOUND', 'Insumo no encontrado', undefined, 'r');

      let current = data.stock.get(id);
      if (!current) {
        current = {
          ingredientId: id,
          quantity: 0,
          avgUnitCost: '0.000000',
          minQuantity: 0,
          updatedAt: new Date().toISOString(),
        };
        data.stock.set(id, current);
      }
      const changes = body as UpdateStockInput;
      current.minQuantity = changes.minQuantity;
      current.updatedAt = new Date().toISOString();
      return structuredClone(current);
    }

    if (method === 'POST' && path === '/inventory/purchases') {
      const input = body as RegisterPurchaseInput;
      let total = 0;
      const purchaseId = crypto.randomUUID();

      for (const line of input.items) {
        const ing = catalog.data.ingredients.find((i) => i.id === line.ingredientId);
        if (!ing) throw rule('INGREDIENT_NOT_FOUND', 404);
        if (!ing.isActive) throw rule('INGREDIENT_INACTIVE');

        total += line.costCents;

        let current = data.stock.get(line.ingredientId);
        if (!current) {
          current = {
            ingredientId: line.ingredientId,
            quantity: 0,
            avgUnitCost: '0.000000',
            minQuantity: 0,
            updatedAt: new Date().toISOString(),
          };
          data.stock.set(line.ingredientId, current);
        }

        const prevQty = current.quantity;
        const prevAvg = parseFloat(current.avgUnitCost);
        const newQty = prevQty + line.quantity;

        let newAvg: number;
        if (prevQty <= 0) {
          newAvg = line.costCents / line.quantity;
        } else {
          newAvg = (prevQty * prevAvg + line.costCents) / newQty;
        }
        const newAvgStr = newAvg.toFixed(6);

        current.quantity = newQty;
        current.avgUnitCost = newAvgStr;
        current.updatedAt = new Date().toISOString();

        data.movements.push({
          id: nextMovementId++,
          ingredientId: line.ingredientId,
          type: 'compra',
          quantity: line.quantity,
          costCents: line.costCents,
          balanceQuantity: newQty,
          balanceAvgUnitCost: newAvgStr,
          purchaseId,
          orderId: null,
          reason: input.note ?? '',
          createdBy: 'admin',
          createdAt: new Date().toISOString(),
        });
      }

      const purchaseRecord: PurchaseRowData = {
        id: purchaseId,
        purchasedOn: input.purchasedOn,
        supplier: input.supplier ?? '',
        note: input.note ?? '',
        totalCents: total,
        createdBy: 'admin',
        createdAt: new Date().toISOString(),
        items: input.items.map((it) => {
          const ing = catalog.data.ingredients.find((i) => i.id === it.ingredientId);
          return {
            ingredientId: it.ingredientId,
            ingredientName: ing?.name ?? 'Desconocido',
            unit: ing?.unit ?? 'unidad',
            quantity: it.quantity,
            costCents: it.costCents,
          };
        }),
      };
      data.purchases.unshift(purchaseRecord);

      return {
        id: purchaseId,
        purchasedOn: input.purchasedOn,
        supplier: input.supplier,
        note: input.note,
        totalCents: total,
        createdBy: 'admin',
        createdAt: new Date().toISOString(),
      };
    }

    if (method === 'POST' && path === '/inventory/waste') {
      const input = body as RecordWasteInput;
      const ing = catalog.data.ingredients.find((i) => i.id === input.ingredientId);
      if (!ing) throw rule('INGREDIENT_NOT_FOUND', 404);

      let current = data.stock.get(input.ingredientId);
      if (!current) {
        current = {
          ingredientId: input.ingredientId,
          quantity: 0,
          avgUnitCost: '0.000000',
          minQuantity: 0,
          updatedAt: new Date().toISOString(),
        };
        data.stock.set(input.ingredientId, current);
      }

      if (input.quantity > current.quantity) {
        throw rule('STOCK_INSUFFICIENT');
      }

      const newQty = current.quantity - input.quantity;
      const costCents = Math.round(input.quantity * parseFloat(current.avgUnitCost));

      current.quantity = newQty;
      current.updatedAt = new Date().toISOString();

      const movement: InventoryMovement = {
        id: nextMovementId++,
        ingredientId: input.ingredientId,
        type: 'merma',
        quantity: -input.quantity,
        costCents: -costCents,
        balanceQuantity: newQty,
        balanceAvgUnitCost: current.avgUnitCost,
        purchaseId: null,
        orderId: null,
        reason: input.reason,
        createdBy: 'admin',
        createdAt: new Date().toISOString(),
      };
      data.movements.push(movement);
      return movement;
    }

    if (method === 'POST' && path === '/inventory/counts') {
      const input = body as CountStockInput;
      const ing = catalog.data.ingredients.find((i) => i.id === input.ingredientId);
      if (!ing) throw rule('INGREDIENT_NOT_FOUND', 404);

      let current = data.stock.get(input.ingredientId);
      if (!current) {
        current = {
          ingredientId: input.ingredientId,
          quantity: 0,
          avgUnitCost: '0.000000',
          minQuantity: 0,
          updatedAt: new Date().toISOString(),
        };
        data.stock.set(input.ingredientId, current);
      }

      const delta = input.counted - current.quantity;
      if (delta === 0) {
        throw rule('ADJUSTMENT_NO_CHANGE');
      }

      const costCents = Math.round(delta * parseFloat(current.avgUnitCost));

      current.quantity = input.counted;
      current.updatedAt = new Date().toISOString();

      const movement: InventoryMovement = {
        id: nextMovementId++,
        ingredientId: input.ingredientId,
        type: 'ajuste',
        quantity: delta,
        costCents,
        balanceQuantity: input.counted,
        balanceAvgUnitCost: current.avgUnitCost,
        purchaseId: null,
        orderId: null,
        reason: input.reason,
        createdBy: 'admin',
        createdAt: new Date().toISOString(),
      };
      data.movements.push(movement);
      return movement;
    }

    return NOT_HANDLED;
  }

  return { reader, handle, data };
}

export type FakeInventory = ReturnType<typeof createFakeInventory>;
