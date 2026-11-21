import { zodResolver } from '@hookform/resolvers/zod';
import { countStockSchema, formatQuantity, type CountStockInput } from '@tus-antojos/shared';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api-client';
import { notifyInventoryError, useCountStock } from './api';
import { ModalDialog } from '@/components/ui/modal-dialog';
import type { StockRowData } from './reader';

interface CountDialogProps {
  open: boolean;
  onClose: () => void;
  ingredient: StockRowData | null;
}

export function CountDialog({ open, onClose, ingredient }: CountDialogProps) {
  const countStock = useCountStock();

  const form = useForm<CountStockInput>({
    resolver: zodResolver(countStockSchema),
    defaultValues: {
      ingredientId: ingredient?.ingredientId ?? '',
      counted: ingredient?.quantity ?? 0,
      reason: '',
    },
  });

  useEffect(() => {
    if (ingredient) {
      form.reset({
        ingredientId: ingredient.ingredientId,
        counted: Math.max(0, ingredient.quantity),
        reason: '',
      });
    }
  }, [ingredient, form]);

  const countedValue = useWatch({ control: form.control, name: 'counted' });
  const difference = (countedValue ?? 0) - (ingredient?.quantity ?? 0);

  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await countStock.mutateAsync(values);
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.reason === 'ADJUSTMENT_NO_CHANGE') {
        form.setError('counted', {
          message: 'La cantidad contada es idéntica al stock actual en sistema.',
        });
        return;
      }
      notifyInventoryError(error);
    }
  });

  if (!ingredient) return null;

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Conteo físico (Ajuste de inventario)"
      description={`Registra la cantidad real contada de ${ingredient.ingredientName}. El sistema ajustará la diferencia.`}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-md bg-secondary/60 p-3 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Stock actual en sistema:</span>
            <span className="font-semibold text-foreground">
              {formatQuantity(ingredient.quantity, ingredient.unit)}
            </span>
          </div>
          <div className="flex justify-between border-t border-border/50 pt-1">
            <span className="text-muted-foreground">Ajuste resultante:</span>
            <span
              className={
                difference > 0
                  ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                  : difference < 0
                    ? 'font-semibold text-amber-600 dark:text-amber-400'
                    : 'text-muted-foreground'
              }
            >
              {difference > 0
                ? `+${formatQuantity(difference, ingredient.unit)} (Ingreso)`
                : difference < 0
                  ? `${formatQuantity(difference, ingredient.unit)} (Salida)`
                  : 'Sin diferencia (0)'}
            </span>
          </div>
        </div>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="count-counted">
              Cantidad física contada ({ingredient.unit})
            </FieldLabel>
            <Input
              id="count-counted"
              type="number"
              min={0}
              autoFocus
              {...form.register('counted', { valueAsNumber: true })}
            />
            {errors.counted && <FieldError>{errors.counted.message}</FieldError>}
          </Field>

          <Field>
            <FieldLabel htmlFor="count-reason">Motivo del ajuste</FieldLabel>
            <Textarea
              id="count-reason"
              placeholder="Ej. Conteo semanal, corrección de inventario, descuadre..."
              rows={2}
              {...form.register('reason')}
            />
            {errors.reason && <FieldError>{errors.reason.message}</FieldError>}
          </Field>
        </FieldGroup>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando…' : 'Registrar ajuste'}
          </Button>
        </div>
      </form>
    </ModalDialog>
  );
}
