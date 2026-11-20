import { displayUnitsFor, type Ingredient } from '@tus-antojos/shared';
import { useFieldArray, useWatch, type UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { selectClassName } from '@/lib/utils';
import type { ProductFormInput, ProductFormValues } from './ProductForm';

/**
 * Receta del producto: una fila por insumo con su cantidad en g/kg, ml/L o unidades.
 * Solo se ofrecen insumos activos y cada uno una sola vez. Al guardar, las cantidades
 * se convierten a la unidad base (1,5 kg → 1500 g).
 */
export function RecipeEditor({
  form,
  ingredients,
}: {
  form: UseFormReturn<ProductFormInput, unknown, ProductFormValues>;
  ingredients: Ingredient[];
}) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'recipe' });
  const rows = useWatch({ control: form.control, name: 'recipe' });
  const errors = form.formState.errors.recipe;
  const byId = new Map(ingredients.map((i) => [i.id, i]));

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium">Receta</legend>
      <p className="text-sm text-muted-foreground">
        Lo que consume una unidad vendida. Cambiarla solo afecta a las ventas futuras.
      </p>

      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">Todavía no tiene insumos.</p>
      )}

      {fields.map((field, index) => {
        const n = index + 1;
        const selectedId = rows[index]?.ingredientId ?? '';
        const selected = byId.get(selectedId);
        const usedElsewhere = new Set(
          rows.filter((_, i) => i !== index).map((row) => row.ingredientId),
        );
        // Un insumo que quedó inactivo se muestra, pero no se puede volver a elegir.
        const choices = ingredients.filter((i) => i.isActive || i.id === selectedId);
        const rowErrors = errors?.[index];

        return (
          <div key={field.id} className="flex flex-wrap items-start gap-2">
            <div className="min-w-40 flex-1">
              <select
                aria-label={`Insumo ${n}`}
                className={selectClassName}
                aria-invalid={!!rowErrors?.ingredientId}
                {...form.register(`recipe.${index}.ingredientId`, {
                  onChange: (event: { target: { value: string } }) => {
                    const ingredient = byId.get(event.target.value);
                    if (ingredient) form.setValue(`recipe.${index}.unit`, ingredient.unit);
                  },
                })}
              >
                <option value="">Elige un insumo</option>
                {choices.map((ingredient) => (
                  <option
                    key={ingredient.id}
                    value={ingredient.id}
                    disabled={!ingredient.isActive || usedElsewhere.has(ingredient.id)}
                  >
                    {ingredient.isActive ? ingredient.name : `${ingredient.name} (inactivo)`}
                  </option>
                ))}
              </select>
              <FieldError errors={[rowErrors?.ingredientId]} />
            </div>
            <div className="w-28">
              <Input
                aria-label={`Cantidad ${n}`}
                inputMode="decimal"
                aria-invalid={!!rowErrors?.quantity}
                {...form.register(`recipe.${index}.quantity`)}
              />
              <FieldError errors={[rowErrors?.quantity]} />
            </div>
            <select
              aria-label={`Unidad ${n}`}
              className={`${selectClassName} w-24`}
              disabled={!selected}
              {...form.register(`recipe.${index}.unit`)}
            >
              {selected ? (
                displayUnitsFor(selected.unit).map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))
              ) : (
                <option value={rows[index]?.unit}>—</option>
              )}
            </select>
            <Button
              type="button"
              variant="outline"
              aria-label={`Quitar insumo ${n}`}
              onClick={() => remove(index)}
            >
              Quitar
            </Button>
          </div>
        );
      })}

      <FieldError errors={[errors?.root ?? (errors as { message?: string } | undefined)]} />

      <div>
        <Button
          type="button"
          variant="outline"
          onClick={() => append({ ingredientId: '', quantity: '', unit: 'g' })}
        >
          Agregar insumo
        </Button>
      </div>
    </fieldset>
  );
}
