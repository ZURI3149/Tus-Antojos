import type { PromotionKind } from '@tus-antojos/shared';
import type { PromotionRowData, PromotionsReader } from '@/features/promotions/reader';
import { ApiError } from '@/lib/api-client';
import { NOT_HANDLED, type FakeCatalog } from './fake-catalog';

export interface FakePromotions {
  data: PromotionRowData[];
  reader: PromotionsReader;
  handle(method: string, path: string, body?: unknown): unknown;
}

export function seedPromotions(catalog: FakeCatalog): PromotionRowData[] {
  const p1 = catalog.data.products[0]?.id ?? '00000000-0000-4000-8000-000000000001';
  const p2 = catalog.data.products[1]?.id ?? '00000000-0000-4000-8000-000000000002';

  return [
    {
      id: '00000000-0000-4000-8000-0000000000p1',
      name: 'Verano 20%',
      kind: 'porcentaje',
      value: 20,
      startsAt: '2026-01-01T00:00:00.000Z',
      endsAt: '2026-12-31T23:59:59.000Z',
      isActive: true,
      productIds: [p1],
      productCount: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: '00000000-0000-4000-8000-0000000000p2',
      name: 'Descuento Fijo Futuro',
      kind: 'monto_fijo',
      value: 200,
      startsAt: '2029-01-01T00:00:00.000Z',
      endsAt: '2029-12-31T23:59:59.000Z',
      isActive: true,
      productIds: [p2],
      productCount: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: '00000000-0000-4000-8000-0000000000p3',
      name: 'Cyber Pasado',
      kind: 'porcentaje',
      value: 50,
      startsAt: '2020-01-01T00:00:00.000Z',
      endsAt: '2020-02-01T00:00:00.000Z',
      isActive: true,
      productIds: [p1],
      productCount: 1,
      createdAt: '2020-01-01T00:00:00.000Z',
    },
    {
      id: '00000000-0000-4000-8000-0000000000p4',
      name: 'Promo Desactivada',
      kind: 'monto_fijo',
      value: 500,
      startsAt: '2026-01-01T00:00:00.000Z',
      endsAt: null,
      isActive: false,
      productIds: [p1],
      productCount: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ];
}

export function createFakePromotions(
  catalog: FakeCatalog,
  initialData = seedPromotions(catalog),
): FakePromotions {
  const promotions = structuredClone(initialData);

  const reader: PromotionsReader = {
    async promotions() {
      return structuredClone(promotions);
    },
    async promotion(id: string) {
      const found = promotions.find((p) => p.id === id);
      return found ? structuredClone(found) : null;
    },
  };

  function handle(method: string, path: string, body?: unknown): unknown {
    if (method === 'POST' && path === '/promotions') {
      const input = body as {
        name: string;
        kind: PromotionKind;
        value: number;
        startsAt: string;
        endsAt?: string | null;
        productIds: string[];
      };
      const duplicate = promotions.find(
        (p) => p.isActive && p.name.trim().toLowerCase() === input.name.trim().toLowerCase(),
      );
      if (duplicate) {
        throw new ApiError(
          409,
          'CONFLICT',
          'Ya existe una promoción activa con este nombre',
          undefined,
          'fake-req',
        );
      }
      const id = crypto.randomUUID();
      const newPromo: PromotionRowData = {
        id,
        name: input.name.trim(),
        kind: input.kind,
        value: input.value,
        startsAt: input.startsAt,
        endsAt: input.endsAt ?? null,
        isActive: true,
        productIds: input.productIds,
        productCount: input.productIds.length,
        createdAt: new Date().toISOString(),
      };
      promotions.push(newPromo);
      return { id };
    }

    const match = path.match(/^\/promotions\/([^/]+)$/);
    if (method === 'PATCH' && match) {
      const id = match[1];
      const promo = promotions.find((p) => p.id === id);
      if (!promo) {
        throw new ApiError(404, 'NOT_FOUND', 'Promoción no encontrada', undefined, 'fake-req');
      }
      const changes = body as Partial<PromotionRowData>;
      if (changes.name !== undefined) promo.name = changes.name;
      if (changes.kind !== undefined) promo.kind = changes.kind;
      if (changes.value !== undefined) promo.value = changes.value;
      if (changes.startsAt !== undefined) promo.startsAt = changes.startsAt;
      if (changes.endsAt !== undefined) promo.endsAt = changes.endsAt;
      if (changes.isActive !== undefined) promo.isActive = changes.isActive;
      if (changes.productIds !== undefined) {
        promo.productIds = changes.productIds;
        promo.productCount = changes.productIds.length;
      }
      return { id };
    }

    return NOT_HANDLED;
  }

  return { data: promotions, reader, handle };
}
