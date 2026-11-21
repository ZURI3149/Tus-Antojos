import { zodResolver } from '@hookform/resolvers/zod';
import { formatQuantity, recordWasteSchema, type RecordWasteInput } from '@tus-antojos/shared';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api-client';
import { notifyInventoryError, useRecordWaste } from './api';
import { ModalDialog } from '@/components/ui/modal-dialog';
import type { StockRowData } from './reader';

interface WasteDialogProps {
  open: boolean;
  onClose: () => void;
  ingredient: StockRowData | null;
}

export function WasteDialog({ open, onClose, ingredient }: WasteDialogProps) {
  const recordWaste = useRecordWaste();

  const form = useForm<RecordWasteInput>({
    resolver: zodResolver(recordWasteSchema),
    defaultValues: {
      ingredientId: ingredient?.ingredientId ?? '',
      quantity: 1,
      reason: '',
    },
  });

  useEffect(() => {
    if (ingredient) {
      form.reset({
        ingredientId: ingredient.ingredientId,
        quantity: 1,
        reason: '',
      });
    }
  }, [ingredient, form]);

  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await recordWaste.mutateAsync(values);
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.reason === 'STOCK_INSUFFICIENT') {
        form.setError('quantity', {
          message: `Stock insuficiente. Disponible: ${formatQuantity(ingredient?.quantity ?? 0, ingredient?.unit ?? 'unidad')}`,
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
      title="Registrar merma"
      description={`Salida de inventario por deterioro, vencimiento o pérdida de ${ingredient.ingredientName}.`}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div className="rounded-md bg-secondary/60 p-3 text-xs text-muted-foreground">
          Stock actual disponible:{' '}
          <span className="font-semibold text-foreground">
            {formatQuantity(ingredient.quantity, ingredient.unit)}
          </span>
        </div>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="waste-quantity">
              Cantidad a descartar ({ingredient.unit})
            </FieldLabel>
            <Input
              id="waste-quantity"
              type="number"
              min={1}
              max={ingredient.quantity > 0 ? ingredient.quantity : undefined}
              autoFocus
              {...form.register('quantity', { valueAsNumber: true })}
            />
            {errors.quantity && <FieldError>{errors.quantity.message}</FieldError>}
          </Field>

          <Field>
            <FieldLabel htmlFor="waste-reason">Motivo de la merma</FieldLabel>
            <Textarea
              id="waste-reason"
              placeholder="Ej. Vencimiento, derrame accidental, daño en empaque..."
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
          <Button type="submit" variant="destructive" disabled={isSubmitting}>
            {isSubmitting ? 'Registrando…' : 'Registrar merma'}
          </Button>
        </div>
      </form>
    </ModalDialog>
  );
}
