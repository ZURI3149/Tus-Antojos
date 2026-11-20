import { zodResolver } from '@hookform/resolvers/zod';
import {
  catalogNameSchema,
  moneyInputSchema,
  priceCentsSchema,
  productDescriptionSchema,
  type Category,
} from '@tus-antojos/shared';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api-client';
import { selectClassName } from '@/lib/utils';
import { notifyCatalogError } from './api';

/** El precio se escribe en Bs ("12,50") y sale en centavos (1250). */
const productFormSchema = z.object({
  name: catalogNameSchema,
  description: productDescriptionSchema,
  categoryId: z.uuid({ error: 'Elige una categoría' }),
  price: moneyInputSchema.pipe(priceCentsSchema),
});
export type ProductFormInput = z.input<typeof productFormSchema>;
export type ProductFormValues = z.output<typeof productFormSchema>;

/**
 * Datos del producto: nombre, descripción, categoría y precio.
 * La receta y la foto tienen sus propios componentes (C6, C7).
 */
export function ProductForm({
  categories,
  defaultValues,
  submitLabel,
  onSubmit,
}: {
  categories: Category[];
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
      notifyCatalogError(error);
    }
  });

  // Una categoría inactiva no se puede elegir; si el producto ya la tiene, se muestra.
  const current = categories.find((c) => c.id === defaultValues.categoryId);
  const options = categories.filter((c) => c.isActive || c.id === current?.id);
  const noActiveCategories = !categories.some((c) => c.isActive);

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
            className={selectClassName}
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

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
