import type { IngredientUnit } from '@tus-antojos/shared';

/** Cómo se mide cada insumo. En la BD se guarda la unidad base (g, ml, unidad). */
export const UNIT_LABELS: Record<IngredientUnit, string> = {
  g: 'Peso (g, kg)',
  ml: 'Volumen (ml, L)',
  unidad: 'Unidades',
};

/** Compara textos sin distinguir mayúsculas ni tildes ("azucar" encuentra "Azúcar"). */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}
