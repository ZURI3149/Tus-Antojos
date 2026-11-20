import { zodResolver } from '@hookform/resolvers/zod';
import {
  catalogNameSchema,
  DISPLAY_UNITS,
  moneyInputSchema,
  parseQuantity,
  priceCentsSchema,
  productDescriptionSchema,
  recipeSchema,
  type Category,
  type DisplayUnit,
  type Ingredient,
} from '@tus-antojos/shared';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api-client';
import { selectClassName } from '@/lib/utils';
import { describeCatalogError, notifyCatalogError } from './api';
import { RecipeEditor } from './RecipeEditor';

/** Una fila de la receta tal como se escribe: "1,5" kg → { quantity: 1500 } (g). */
const recipeRowSchema = z
  .object({ ingredientId: z.string(), quantity: z.string(), unit: z.string().optional() })
  .transform((row, ctx) => {
    const unit = DISPLAY_UNITS.find((u) => u === row.unit);
    const quantity = unit ? parseQuantity(row.quantity, unit) : null;
    if (!row.ingredientId) {
      ctx.addIssue({ code: 'custom', path: ['ingredientId'], message: 'Elige un insumo' });
    } else if (row.quantity.trim() === '') {
      ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Ingresa la cantidad' });
    } else if (quantity === null) {
      const message =
        unit === 'kg' || unit === 'L'
          ? 'Cantidad inválida: máximo 3 decimales'
          : 'Cantidad inválida: usa un número entero';
      ctx.addIssue({ code: 'custom', path: ['quantity'], message });
    }
    if (!row.ingredientId || quantity === null) return z.NEVER;
    return { ingredientId: row.ingredientId, quantity };
  });

/** El precio se escribe en Bs ("12,50") y sale en centavos (1250). */
const productFormSchema = z.object({
  name: catalogNameSchema,
  description: productDescriptionSchema,
  categoryId: z.uuid({ error: 'Elige una categoría' }),
  price: moneyInputSchema.pipe(priceCentsSchema),
  // RHF descarta los campos deshabilitados: el interruptor bloqueado llega como undefined.
  isActive: z.boolean().default(false),
  recipe: z.array(recipeRowSchema).pipe(recipeSchema),
});
export type ProductFormInput = z.input<typeof productFormSchema>;
export type ProductFormValues = z.output<typeof productFormSchema>;
export type RecipeRowInput = { ingredientId: string; quantity: string; unit: DisplayUnit };

/** Reglas de activación de la BD que se muestran al lado del interruptor "Activo". */
const ACTIVATION_RULES = new Set([
  'PRODUCT_WITHOUT_RECIPE',
  'INGREDIENT_INACTIVE',
  'CATEGORY_INACTIVE',
]);

/** Por qué no se puede activar el producto con los valores actuales (D1). */
function activationBlockers(
  values: Pick<ProductFormInput, 'categoryId' | 'recipe'>,
  categories: Category[],
  ingredients: Ingredient[],
): string[] {
  const blockers: string[] = [];
  const chosen = values.recipe.filter((row) => row.ingredientId);
  if (chosen.length === 0) blockers.push('Agrega al menos un insumo a la receta');
  for (const row of chosen) {
    const ingredient = ingredients.find((i) => i.id === row.ingredientId);
    if (ingredient && !ingredient.isActive) {
      blockers.push(`El insumo ${ingredient.name} está inactivo`);
    }
  }
  const category = categories.find((c) => c.id === values.categoryId);
  if (category && !category.isActive) blockers.push(`La categoría ${category.name} está inactiva`);
  return blockers;
}

/** Datos del producto, receta y estado. La foto tiene su propio componente (C7). */
export function ProductForm({
  categories,
  ingredients,
  defaultValues,
  submitLabel,
  onSubmit,
}: {
  categories: Category[];
  ingredients: Ingredient[];
  defaultValues: ProductFormInput;
  submitLabel: string;
  onSubmit: (values: ProductFormValues) => Promise<void>;
}) {
  const form = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues,
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values);
      form.reset(form.getValues());
    } catch (error) {
      if (error instanceof ApiError && error.code === 'CONFLICT') {
        form.setError('name', { message: error.message });
        return;
      }
      if (error instanceof ApiError && error.reason && ACTIVATION_RULES.has(error.reason)) {
        form.setError('isActive', { message: describeCatalogError(error) });
        return;
      }
      notifyCatalogError(error);
    }
  });

  // Una categoría inactiva no se puede elegir; si el producto ya la tiene, se muestra.
  const current = categories.find((c) => c.id === defaultValues.categoryId);
  const options = categories.filter((c) => c.isActive || c.id === current?.id);
  const noActiveCategories = !categories.some((c) => c.isActive);

  const [isActive, categoryId, recipe] = useWatch({
    control: form.control,
    name: ['isActive', 'categoryId', 'recipe'],
  });
  const blockers = activationBlockers({ categoryId, recipe }, categories, ingredients);

  return (
    <form
      aria-label="Datos del producto"
      onSubmit={submit}
      noValidate
      className="flex max-w-xl flex-col gap-4"
    >
      <Field data-invalid={!!errors.name}>
        <FieldLabel htmlFor="product-name">Nombre</FieldLabel>
        <Input id="product-name" aria-invalid={!!errors.name} {...form.register('name')} />
        <FieldError errors={[errors.name]} />
      </Field>

      <Field data-invalid={!!errors.description}>
        <FieldLabel htmlFor="product-description">Descripción</FieldLabel>
        <Textarea
          id="product-description"
          aria-invalid={!!errors.description}
          placeholder="Opcional"
          {...form.register('description')}
        />
        <FieldError errors={[errors.description]} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={!!errors.categoryId}>
          <FieldLabel htmlFor="product-category">Categoría</FieldLabel>
          <select
            id="product-category"
            className={`${selectClassName} w-full`}
            aria-invalid={!!errors.categoryId}
            {...form.register('categoryId')}
          >
            {!current && <option value="">Elige una categoría</option>}
            {options.map((category) => (
              <option key={category.id} value={category.id} disabled={!category.isActive}>
                {category.isActive ? category.name : `${category.name} (inactiva)`}
              </option>
            ))}
          </select>
          {noActiveCategories && (
            <FieldDescription>
              No hay categorías activas: créalas primero en Categorías.
            </FieldDescription>
          )}
          <FieldError errors={[errors.categoryId]} />
        </Field>

        <Field data-invalid={!!errors.price}>
          <FieldLabel htmlFor="product-price">Precio (Bs)</FieldLabel>
          <Input
            id="product-price"
            inputMode="decimal"
            placeholder="12,50"
            aria-invalid={!!errors.price}
            {...form.register('price')}
          />
          <FieldError errors={[errors.price]} />
        </Field>
      </div>

      <RecipeEditor form={form} ingredients={ingredients} />

      <Field data-invalid={!!errors.isActive}>
        <div className="flex items-center gap-2">
          <input
            id="product-active"
            type="checkbox"
            role="switch"
            className="size-4 accent-primary"
            // Se puede desactivar siempre; activar, solo si se cumplen las reglas.
            disabled={!isActive && blockers.length > 0}
            {...form.register('isActive')}
          />
          <FieldLabel htmlFor="product-active">Activo</FieldLabel>
        </div>
        <FieldDescription>
          {blockers.length > 0 ? (
            <>
              Para activarlo:{' '}
              {blockers.map((blocker) => (
                <span key={blocker} className="block">
                  {blocker}
                </span>
              ))}
            </>
          ) : (
            'Un producto activo aparece en la caja.'
          )}
        </FieldDescription>
        <FieldError errors={[errors.isActive]} />
      </Field>

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
