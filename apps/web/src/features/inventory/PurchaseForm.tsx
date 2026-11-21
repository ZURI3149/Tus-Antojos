import {
  formatMoney,
  formatUnitCost,
  type Ingredient,
  type RegisterPurchaseInput,
} from '@tus-antojos/shared';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useIngredients } from '@/features/catalog/api';
import { ApiError } from '@/lib/api-client';
import { selectClassName } from '@/lib/utils';
import { notifyInventoryError, useRegisterPurchase } from './api';

interface PurchaseFormValues {
  purchasedOn: string;
  supplier: string;
  note: string;
  items: {
    ingredientId: string;
    quantity: number;
    costBs: number;
  }[];
}

function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
}

export function PurchaseForm() {
  const navigate = useNavigate();
  const registerPurchase = useRegisterPurchase();
  const ingredientsQuery = useIngredients();

  const activeIngredients = useMemo(
    () => (ingredientsQuery.data ?? []).filter((i) => i.isActive),
    [ingredientsQuery.data],
  );

  const ingredientMap = useMemo(() => {
    const map = new Map<string, Ingredient>();
    for (const ing of ingredientsQuery.data ?? []) {
      map.set(ing.id, ing);
    }
    return map;
  }, [ingredientsQuery.data]);

  const form = useForm<PurchaseFormValues>({
    defaultValues: {
      purchasedOn: getTodayString(),
      supplier: '',
      note: '',
      items: [{ ingredientId: '', quantity: 1000, costBs: 0 }],
    },
  });

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const rawWatchedItems = useWatch({ control, name: 'items' });
  const watchedItems = useMemo(() => rawWatchedItems ?? [], [rawWatchedItems]);

  const selectedIngredientIds = useMemo(
    () => new Set(watchedItems.map((i) => i.ingredientId).filter(Boolean)),
    [watchedItems],
  );

  const totalCents = useMemo(() => {
    let sum = 0;
    for (const item of watchedItems) {
      if (typeof item.costBs === 'number' && !Number.isNaN(item.costBs)) {
        sum += Math.round(item.costBs * 100);
      }
    }
    return sum;
  }, [watchedItems]);

  const onSubmit = handleSubmit(async (values) => {
    // Validar líneas
    if (!values.items || values.items.length === 0) {
      setError('items', { message: 'Agrega al menos una línea a la compra' });
      return;
    }

    const setIds = new Set<string>();
    for (const [i, item] of values.items.entries()) {
      if (!item.ingredientId) {
        setError(`items.${i}.ingredientId`, { message: 'Elige un insumo' });
        return;
      }
      if (setIds.has(item.ingredientId)) {
        setError(`items.${i}.ingredientId`, { message: 'Insumo repetido en la compra' });
        return;
      }
      setIds.add(item.ingredientId);

      if (!item.quantity || item.quantity <= 0) {
        setError(`items.${i}.quantity`, { message: 'La cantidad debe ser mayor a 0' });
        return;
      }
      if (typeof item.costBs !== 'number' || item.costBs < 0) {
        setError(`items.${i}.costBs`, { message: 'El costo no puede ser negativo' });
        return;
      }
    }

    const payload: RegisterPurchaseInput = {
      purchasedOn: values.purchasedOn,
      supplier: values.supplier.trim(),
      note: values.note.trim(),
      items: values.items.map((item) => ({
        ingredientId: item.ingredientId,
        quantity: Math.round(item.quantity),
        costCents: Math.round(item.costBs * 100),
      })),
    };

    try {
      await registerPurchase.mutateAsync(payload);
      navigate('/admin/compras');
    } catch (error) {
      if (error instanceof ApiError && error.reason === 'INGREDIENT_INACTIVE') {
        setError('items', { message: 'Uno de los insumos seleccionados está inactivo.' });
        return;
      }
      notifyInventoryError(error);
    }
  });

  return (
    <section className="flex flex-col gap-6 max-w-4xl">
      <div>
        <Link
          to="/admin/compras"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="size-3.5" />
          Volver a Compras
        </Link>
        <PageHeader
          eyebrow="Inventario"
          title="Nueva compra"
          description="Registra el ingreso de insumos comprados con sus cantidades y costos totales de factura."
        />
      </div>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        {/* Cabecera de la compra */}
        <div className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="purchase-date">Fecha de compra *</FieldLabel>
            <Input
              id="purchase-date"
              type="date"
              max={getTodayString()}
              {...register('purchasedOn')}
            />
            {errors.purchasedOn && <FieldError>{errors.purchasedOn.message}</FieldError>}
          </Field>

          <Field>
            <FieldLabel htmlFor="purchase-supplier">Proveedor (opcional)</FieldLabel>
            <Input
              id="purchase-supplier"
              placeholder="Ej. Distribuidora Central, Molino..."
              maxLength={120}
              {...register('supplier')}
            />
            {errors.supplier && <FieldError>{errors.supplier.message}</FieldError>}
          </Field>

          <Field className="sm:col-span-3">
            <FieldLabel htmlFor="purchase-note">Nota / Referencia de factura</FieldLabel>
            <Textarea
              id="purchase-note"
              placeholder="Ej. Factura N° 10243, pago en efectivo..."
              rows={2}
              maxLength={500}
              {...register('note')}
            />
            {errors.note && <FieldError>{errors.note.message}</FieldError>}
          </Field>
        </div>

        {/* Detalle de líneas de compra */}
        <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-base font-semibold tracking-wide">
              Líneas de insumos comprados
            </h3>
            <span className="text-xs text-muted-foreground">
              {fields.length} {fields.length === 1 ? 'línea' : 'líneas'} (máx. 50)
            </span>
          </div>

          {errors.items?.root && <FieldError>{errors.items.root.message}</FieldError>}

          <div className="flex flex-col gap-3">
            {fields.map((field, index) => {
              const currentId = watchedItems[index]?.ingredientId;
              const currentIng = currentId ? ingredientMap.get(currentId) : undefined;
              const qty = watchedItems[index]?.quantity ?? 0;
              const costBs = watchedItems[index]?.costBs ?? 0;
              const unitCost =
                qty > 0 && costBs >= 0 ? (Math.round(costBs * 100) / qty).toFixed(6) : '0';

              return (
                <div
                  key={field.id}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start rounded-md border border-border/60 bg-secondary/30 p-3"
                >
                  {/* Selector de Insumo */}
                  <div className="sm:col-span-5">
                    <Field>
                      <FieldLabel className="text-xs">Insumo *</FieldLabel>
                      <select
                        className={selectClassName}
                        {...register(`items.${index}.ingredientId`)}
                      >
                        <option value="">Selecciona un insumo…</option>
                        {activeIngredients.map((ing) => {
                          const isAlreadySelected =
                            selectedIngredientIds.has(ing.id) && ing.id !== currentId;
                          return (
                            <option key={ing.id} value={ing.id} disabled={isAlreadySelected}>
                              {ing.name} ({ing.unit})
                            </option>
                          );
                        })}
                      </select>
                      {errors.items?.[index]?.ingredientId && (
                        <FieldError>{errors.items[index].ingredientId.message}</FieldError>
                      )}
                    </Field>
                  </div>

                  {/* Cantidad en unidad base */}
                  <div className="sm:col-span-3">
                    <Field>
                      <FieldLabel className="text-xs">
                        Cantidad ({currentIng?.unit ?? 'unidad'}) *
                      </FieldLabel>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        placeholder="Cantidad"
                        {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                      />
                      {errors.items?.[index]?.quantity && (
                        <FieldError>{errors.items[index].quantity.message}</FieldError>
                      )}
                    </Field>
                  </div>

                  {/* Costo total de la línea en Bs */}
                  <div className="sm:col-span-3">
                    <Field>
                      <FieldLabel className="text-xs">Costo total línea (Bs) *</FieldLabel>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        {...register(`items.${index}.costBs`, { valueAsNumber: true })}
                      />
                      {errors.items?.[index]?.costBs && (
                        <FieldError>{errors.items[index].costBs.message}</FieldError>
                      )}
                    </Field>
                  </div>

                  {/* Botón eliminar */}
                  <div className="sm:col-span-1 flex items-center justify-end sm:pt-6">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      disabled={fields.length <= 1}
                      className="size-9 text-muted-foreground hover:text-destructive"
                      aria-label={`Eliminar línea ${index + 1}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  {/* Cálculo informativo del costo unitario equivalente */}
                  {currentIng && qty > 0 && costBs > 0 && (
                    <div className="sm:col-span-12 text-xs text-muted-foreground font-mono flex items-center gap-1">
                      <span>Equivalente:</span>
                      <span className="font-semibold text-foreground">
                        {formatUnitCost(unitCost, currentIng.unit)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {fields.length < 50 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ ingredientId: '', quantity: 1000, costBs: 0 })}
              className="w-fit gap-1.5"
            >
              <Plus className="size-4" />
              Agregar otra línea
            </Button>
          )}
        </div>

        {/* Resumen final y acciones */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Total de la compra:</span>
            <span className="font-heading text-2xl font-bold text-primary">
              {formatMoney(totalCents)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" asChild disabled={isSubmitting}>
              <Link to="/admin/compras">Cancelar</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Registrando compra…' : 'Registrar compra'}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}
