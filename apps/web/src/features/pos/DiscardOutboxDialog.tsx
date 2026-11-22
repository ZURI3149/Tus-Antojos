import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { formatMoney } from '@tus-antojos/shared';
import { toast } from 'sonner';
import { useOutbox } from '@/app/outbox-context';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { Textarea } from '@/components/ui/textarea';
import type { OutboxEntry } from '@/lib/offline/types';
import { provisionalOrderLabel } from '@/lib/offline/labels';
import { reportOutboxDiscard } from '@/lib/sentry';

export interface DiscardOutboxDialogProps {
  entry: OutboxEntry | null;
  onClose: () => void;
}

/** Saca de la cola un pedido "por revisar" con motivo (SPEC-offline-print OP-D7). */
export function DiscardOutboxDialog({ entry, onClose }: DiscardOutboxDialogProps) {
  const { outbox } = useOutbox();
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmed = reason.trim();
  const isValid = trimmed.length >= 3 && trimmed.length <= 200;
  const label = entry ? provisionalOrderLabel(entry.clientOrderId) : '';

  const close = () => {
    setReason('');
    setErrorMsg(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry || !isValid) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const { entry: discarded, reason: savedReason } = await outbox.discard(
        entry.clientOrderId,
        trimmed,
      );
      reportOutboxDiscard({
        clientOrderId: discarded.clientOrderId,
        totalCents: discarded.charged.totalCents,
        attempts: discarded.attempts,
        lastError: discarded.lastError,
        reason: savedReason,
      });
      toast.success(`Pedido ${label} descartado de la cola`);
      close();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo descartar el pedido');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalDialog
      open={entry !== null}
      onClose={close}
      title={`Descartar pedido ${label}`}
      description={entry ? `Total cobrado: ${formatMoney(entry.charged.totalCents)}` : undefined}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle
            aria-hidden
            className="size-4 shrink-0 text-amber-600 dark:text-amber-400"
          />
          <p>
            Este pedido ya se cobró pero no se registrará en el sistema: no descontará inventario ni
            aparecerá en los pedidos. Anota cómo lo resolviste.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="discard-outbox-reason" className="text-sm font-medium">
            Motivo <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="discard-outbox-reason"
            rows={3}
            placeholder="Ej. Se registró a mano, el producto ya no existe…"
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
            onClick={close}
            disabled={isSubmitting}
            className="min-h-[44px] font-heading"
          >
            Volver
          </Button>
          <Button
            type="submit"
            variant="destructive"
            disabled={isSubmitting || !isValid}
            className="min-h-[44px] font-heading"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Descartando...
              </>
            ) : (
              'Descartar pedido'
            )}
          </Button>
        </div>
      </form>
    </ModalDialog>
  );
}
