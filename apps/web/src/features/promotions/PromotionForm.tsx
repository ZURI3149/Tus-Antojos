import {
  createPromotionSchema,
  parseMoney,
  type Category,
  type CreatePromotion,
  type Product,
  type PromotionKind,
} from '@tus-antojos/shared';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import { notifyPromotionError } from './api';
import { fromBoliviaDatetimeLocal, toBoliviaDatetimeLocal } from './format';
import { PricePreview } from './PricePreview';
import { ProductPicker } from './ProductPicker';

export interface PromotionFormValues {
  name: string;
  kind: PromotionKind;
  value: string; // "20" para 20% o "2,50" para Bs 2,50
  startsAt: string; // formato YYYY-MM-DDTHH:mm
  endsAt: string; // formato YYYY-MM-DDTHH:mm o vacío
  productIds: string[];
  isActive: boolean;
}

export interface PromotionFormProps {
  categories: Category[];
  products: Product[];
  defaultValues?: Partial<PromotionFormValues>;
  promotionId?: string;
  isEdit?: boolean;
  submitLabel?: string;
  onSubmit: (data: CreatePromotion & { isActive?: boolean }) => Promise<void>;
  onCancel: () => void;
}

export function PromotionForm({
  categories,
  products,
  defaultValues,
  promotionId,
  isEdit = false,
  submitLabel = isEdit ? 'Guardar cambios' : 'Crear promoción',
  onSubmit,
  onCancel,
}: PromotionFormProps) {
  const [name, setName] = useState(defaultValues?.name ?? '');
  const [kind, setKind] = useState<PromotionKind>(defaultValues?.kind ?? 'porcentaje');
  const [value, setValue] = useState(defaultValues?.value ?? '');
  const [startsAt, setStartsAt] = useState(
    defaultValues?.startsAt ?? toBoliviaDatetimeLocal(new Date()),
  );
  const [endsAt, setEndsAt] = useState(defaultValues?.endsAt ?? '');
  const [productIds, setProductIds] = useState<string[]>(defaultValues?.productIds ?? []);
  const [isActive, setIsActive] = useState(defaultValues?.isActive ?? true);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsedValue = useMemo(() => {
    if (!value.trim()) return 0;
    if (kind === 'porcentaje') {
      const parsed = Number.parseInt(value.trim(), 10);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    const cents = parseMoney(value.trim());
    return cents ?? 0;
  }, [kind, value]);

  const selectedProducts = useMemo(() => {
    const set = new Set(productIds);
    return products.filter((p) => set.has(p.id));
  }, [products, productIds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = 'Ingresa el nombre';
    } else if (name.trim().length > 80) {
      errors.name = 'Máximo 80 caracteres';
    }

    if (!value.trim()) {
      errors.value = 'Ingresa el valor del descuento';
    } else if (kind === 'porcentaje') {
      if (!Number.isInteger(parsedValue) || parsedValue < 1 || parsedValue > 100) {
        errors.value = 'El porcentaje debe estar entre 1 y 100';
      }
    } else if (kind === 'monto_fijo') {
      if (parsedValue <= 0) {
        errors.value = 'El monto debe ser mayor a 0';
      }
    }

    const isoStartsAt = fromBoliviaDatetimeLocal(startsAt);
    if (!isoStartsAt) {
      errors.startsAt = 'Fecha de inicio inválida';
    }

    const isoEndsAt = fromBoliviaDatetimeLocal(endsAt);
    if (isoEndsAt && isoStartsAt) {
      if (new Date(isoEndsAt).getTime() <= new Date(isoStartsAt).getTime()) {
        errors.endsAt = 'La fecha de fin debe ser posterior a la de inicio';
      }
    }

    if (productIds.length === 0) {
      errors.productIds = 'Elige al menos un producto';
    } else if (productIds.length > 100) {
      errors.productIds = 'Máximo 100 productos';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const payload: CreatePromotion & { isActive?: boolean } = {
      name: name.trim(),
      kind,
      value: parsedValue,
      startsAt: isoStartsAt!,
      endsAt: isoEndsAt,
      productIds,
      isActive,
    };

    // Validación formal con Zod schema de shared
    const result = createPromotionSchema.safeParse(payload);
    if (!result.success) {
      const zodErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const path = issue.path[0]?.toString() ?? 'root';
        zodErrors[path] = issue.message;
      }
      setFieldErrors(zodErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(payload);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'CONFLICT') {
        setFieldErrors({ name: 'Ya existe una promoción activa con este nombre' });
      } else {
        notifyPromotionError(err);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      aria-label="Datos de la promoción"
      onSubmit={handleSubmit}
      className="flex flex-col gap-6"
    >
      <div className="grid gap-6 md:grid-cols-2">
        {/* Columna izquierda: Datos de la promoción */}
        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="promo-name">Nombre</FieldLabel>
            <Input
              id="promo-name"
              type="text"
              placeholder="ej. 20 % en tortas"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.name)}
            />
            {fieldErrors.name && <FieldError>{fieldErrors.name}</FieldError>}
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="promo-kind">Tipo de descuento</FieldLabel>
              <select
                id="promo-kind"
                value={kind}
                onChange={(e) => {
                  const newKind = e.target.value as PromotionKind;
                  setKind(newKind);
                  setValue('');
                  setFieldErrors((prev) => ({ ...prev, value: '' }));
                }}
                disabled={isSubmitting}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="porcentaje">Porcentaje (%)</option>
                <option value="monto_fijo">Monto fijo (Bs)</option>
              </select>
            </Field>

            <Field>
              <FieldLabel htmlFor="promo-value">
                {kind === 'porcentaje' ? 'Porcentaje (%)' : 'Monto (Bs)'}
              </FieldLabel>
              <Input
                id="promo-value"
                type="text"
                placeholder={kind === 'porcentaje' ? 'ej. 20' : 'ej. 2,50'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={isSubmitting}
                aria-invalid={Boolean(fieldErrors.value)}
              />
              {fieldErrors.value && <FieldError>{fieldErrors.value}</FieldError>}
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="promo-starts-at">Inicio (hora de Bolivia)</FieldLabel>
              <Input
                id="promo-starts-at"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                disabled={isSubmitting}
                aria-invalid={Boolean(fieldErrors.startsAt)}
              />
              <FieldDescription>Zona horaria America/La_Paz (-04:00)</FieldDescription>
              {fieldErrors.startsAt && <FieldError>{fieldErrors.startsAt}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor="promo-ends-at">Fin (opcional)</FieldLabel>
              <Input
                id="promo-ends-at"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                disabled={isSubmitting}
                aria-invalid={Boolean(fieldErrors.endsAt)}
              />
              <FieldDescription>Dejar vacío si no tiene fecha de vencimiento</FieldDescription>
              {fieldErrors.endsAt && <FieldError>{fieldErrors.endsAt}</FieldError>}
            </Field>
          </div>

          {isEdit && (
            <div className="flex items-center gap-3 pt-2">
              <label
                htmlFor="promo-is-active"
                className="flex items-center gap-2 cursor-pointer text-sm font-medium"
              >
                <input
                  id="promo-is-active"
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  disabled={isSubmitting}
                  className="size-4 rounded border-input text-primary focus:ring-ring"
                />
                Promoción activa
              </label>
              <span className="text-xs text-muted-foreground">
                (Las promociones desactivadas no aplican a precios ni son visibles para
                cajero/cocina)
              </span>
            </div>
          )}

          {/* Vista previa de precios */}
          <div className="pt-2">
            <PricePreview
              selectedProducts={selectedProducts}
              kind={kind}
              value={parsedValue}
              currentPromotionId={promotionId}
            />
          </div>
        </div>

        {/* Columna derecha: Selector de productos */}
        <div className="flex flex-col gap-4">
          <ProductPicker
            categories={categories}
            products={products}
            selectedIds={productIds}
            onChange={(ids) => {
              setProductIds(ids);
              if (ids.length > 0 && fieldErrors.productIds) {
                setFieldErrors((prev) => ({ ...prev, productIds: '' }));
              }
            }}
            error={fieldErrors.productIds}
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
