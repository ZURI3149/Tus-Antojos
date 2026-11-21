import { zodResolver } from '@hookform/resolvers/zod';
import { updateStockSchema, type UpdateStockInput } from '@tus-antojos/shared';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { notifyInventoryError, useUpdateStock } from './api';
import { ModalDialog } from '@/components/ui/modal-dialog';
import type { StockRowData } from './reader';

interface MinStockDialogProps {
  open: boolean;
  onClose: () => void;
  ingredient: StockRowData | null;
}

export function MinStockDialog({ open, onClose, ingredient }: MinStockDialogProps) {
  const updateStock = useUpdateStock();

  const form = useForm<UpdateStockInput>({
    resolver: zodResolver(updateStockSchema),
    defaultValues: {
      minQuantity: ingredient?.minQuantity ?? 0,
    },
  });

  useEffect(() => {
    if (ingredient) {
      form.reset({
        minQuantity: ingredient.minQuantity,
      });
    }
  }, [ingredient, form]);

  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    if (!ingredient) return;
    try {
      await updateStock.mutateAsync({
        ingredientId: ingredient.ingredientId,
        changes: values,
      });
      onClose();
    } catch (error) {
      notifyInventoryError(error);
    }
  });

  if (!ingredient) return null;

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Stock mínimo"
      description={`Configura el umbral de alerta para ${ingredient.ingredientName}. (0 = sin alerta)`}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="min-stock-input">Cantidad mínima ({ingredient.unit})</FieldLabel>
            <Input
              id="min-stock-input"
              type="number"
              min={0}
              autoFocus
              {...form.register('minQuantity', { valueAsNumber: true })}
            />
            {errors.minQuantity && <FieldError>{errors.minQuantity.message}</FieldError>}
          </Field>
        </FieldGroup>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando…' : 'Guardar mínimo'}
          </Button>
        </div>
      </form>
    </ModalDialog>
  );
}
