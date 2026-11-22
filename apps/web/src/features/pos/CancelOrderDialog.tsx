import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { Textarea } from '@/components/ui/textarea';
import { notifyOrderError, useCancelOrder } from './api';

export interface CancelOrderDialogProps {
  open: boolean;
  orderNumber: number;
  orderId: string;
  onClose: () => void;
}

export function CancelOrderDialog({
  open,
  orderNumber,
  orderId,
  onClose,
}: CancelOrderDialogProps) {
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cancelMutation = useCancelOrder();

  const trimmed = reason.trim();
  const isValid = trimmed.length >= 3 && trimmed.length <= 200;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setErrorMsg(null);
    try {
      await cancelMutation.mutateAsync({
        id: orderId,
        input: { reason: trimmed },
      });
      toast.success(`Pedido #${orderNumber} anulado con éxito`);
      setReason('');
      onClose();
    } catch (err: unknown) {
      notifyOrderError(err);
      if (err instanceof Error) {
        setErrorMsg(err.message);
      }
    }
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title={`Anular pedido #${orderNumber}`}
      description="Esta acción devolverá los ingredientes descontados al inventario."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p>
            Al confirmar la anulación, el pedido pasará al estado anulado y se registrarán
            automáticamente movimientos de reposición en el kardex de inventario.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cancel-order-reason" className="text-sm font-medium">
            Motivo de anulación <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="cancel-order-reason"
            rows={3}
            placeholder="Ej. El cliente se retiró antes de pagar, error en la orden..."
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setErrorMsg(null);
            }}
            maxLength={200}
            required
            autoFocus
          />
          <span className="text-right text-[0.7rem] text-muted-foreground">
            {reason.length}/200 caracteres (mínimo 3)
          </span>
        </div>

        {errorMsg && (
          <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive" role="alert">
            {errorMsg}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={cancelMutation.isPending}
            className="min-h-[44px] font-heading"
          >
            Volver
          </Button>

          <Button
            type="submit"
            variant="destructive"
            disabled={cancelMutation.isPending || !isValid}
            className="min-h-[44px] font-heading"
          >
            {cancelMutation.isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Anulando...
              </>
            ) : (
              'Confirmar anulación'
            )}
          </Button>
        </div>
      </form>
    </ModalDialog>
  );
}
