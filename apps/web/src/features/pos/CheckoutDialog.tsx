import { useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  Loader2,
  QrCode,
} from 'lucide-react';
import {
  formatMoney,
  formatMoneyInput,
  parseMoney,
  type Order,
  type PaymentMethod,
} from '@tus-antojos/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { ApiError } from '@/lib/api-client';
import { notifyOrderError, useCreateOrder } from './api';
import { useOrdersReader } from './reader';
import type { CartState } from './use-cart';

export interface CheckoutDialogProps {
  open: boolean;
  onClose: () => void;
  cart: CartState;
  onSuccess: (orderNumber: number, changeCents: number) => void;
}

const COMMON_BILLS_BS = [10, 20, 50, 100, 200];

export function CheckoutDialog({ open, onClose, cart, onSuccess }: CheckoutDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [cashInput, setCashInput] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createOrderMutation = useCreateOrder();
  const ordersReader = useOrdersReader();
  const totalCents = cart.pricedCart.totalCents;

  const parsedCash = parseMoney(cashInput);
  const cashReceivedCents = parsedCash ?? 0;
  const isCash = paymentMethod === 'efectivo';
  const changeCents = Math.max(0, cashReceivedCents - totalCents);
  const isCashInsufficient = isCash && cashReceivedCents < totalCents;

  const handleSelectExact = () => {
    setCashInput(formatMoneyInput(totalCents));
    setErrorMessage(null);
  };

  const handleSelectBill = (bs: number) => {
    setCashInput(formatMoneyInput(bs * 100));
    setErrorMessage(null);
  };

  /**
   * El servidor recalcula precios y promociones: el cambio se da sobre lo que
   * realmente se cobró (order.totalCents), no sobre el total del carrito.
   */
  const finishWithOrder = (order: Order, recovered = false) => {
    const chargedCents = order.totalCents;
    // En un pedido recuperado solo se calcula cambio si el método coincide con el actual.
    const paidInCash = order.paymentMethod === 'efectivo' && (!recovered || isCash);
    if (!recovered && chargedCents !== totalCents) {
      toast.warning(
        `El total cobrado es ${formatMoney(chargedCents)} (el carrito mostraba ${formatMoney(totalCents)}): cambiaron precios o promociones.`,
      );
    }
    if (!recovered && paidInCash && cashReceivedCents < chargedCents) {
      toast.warning(`Falta cobrar ${formatMoney(chargedCents - cashReceivedCents)} en efectivo.`);
    }
    onSuccess(order.orderNumber, paidInCash ? Math.max(0, cashReceivedCents - chargedCents) : 0);
  };

  /**
   * 409 por clave reutilizada: un intento anterior con este mismo carrito ya se
   * registró (p. ej. se perdió la respuesta). Se recupera y se muestra ese pedido
   * en vez de dejar que se cobre dos veces.
   */
  const recoverExistingOrder = async (): Promise<Order | null> => {
    if (!ordersReader.orderByClientId) return null;
    try {
      return await ordersReader.orderByClientId(cart.clientOrderId);
    } catch {
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isCashInsufficient) {
      setErrorMessage('El monto recibido en efectivo es menor al total a pagar');
      return;
    }

    try {
      const order = await createOrderMutation.mutateAsync({
        clientOrderId: cart.clientOrderId,
        items: cart.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          note: i.note,
        })),
        paymentMethod,
      });

      finishWithOrder(order);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        const existing = await recoverExistingOrder();
        if (existing) {
          toast.info(
            `El pedido #${existing.orderNumber} ya estaba registrado (pago: ${existing.paymentMethod === 'qr' ? 'QR' : 'efectivo'}). No se volvió a cobrar. Si cambiaste el carrito después, registra lo agregado en un pedido nuevo.`,
          );
          finishWithOrder(existing, true);
          return;
        }
      }
      notifyOrderError(err);
      if (err instanceof Error) {
        setErrorMessage(err.message);
      }
    }
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Cobrar pedido"
      description={`Total a cobrar: ${formatMoney(totalCents)}`}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Total destacado */}
        <div className="flex flex-col items-center justify-center rounded-xl bg-muted/30 p-4 text-center">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Total a pagar
          </span>
          <span className="font-heading text-3xl font-extrabold text-foreground">
            {formatMoney(totalCents)}
          </span>
        </div>

        {/* Selector de método de pago accesible */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Método de pago
          </Label>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Método de pago">
            <button
              type="button"
              role="radio"
              aria-checked={paymentMethod === 'efectivo'}
              onClick={() => {
                setPaymentMethod('efectivo');
                setErrorMessage(null);
              }}
              className={`flex min-h-[48px] items-center justify-center gap-2 rounded-lg border p-3 font-heading text-sm font-semibold transition-all ${
                paymentMethod === 'efectivo'
                  ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
              }`}
            >
              <Banknote className="size-4" />
              Efectivo
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={paymentMethod === 'qr'}
              onClick={() => {
                setPaymentMethod('qr');
                setErrorMessage(null);
              }}
              className={`flex min-h-[48px] items-center justify-center gap-2 rounded-lg border p-3 font-heading text-sm font-semibold transition-all ${
                paymentMethod === 'qr'
                  ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
              }`}
            >
              <QrCode className="size-4" />
              Pago QR
            </button>
          </div>
        </div>

        {/* Sección de Efectivo: botones de billetes y cálculo de cambio */}
        {paymentMethod === 'efectivo' && (
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/10 p-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cash-received" className="text-sm font-medium">
                Monto recibido en efectivo
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-heading text-sm font-bold text-muted-foreground">
                  Bs
                </span>
                <Input
                  id="cash-received"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={cashInput}
                  onChange={(e) => {
                    setCashInput(e.target.value);
                    setErrorMessage(null);
                  }}
                  className="pl-9 min-h-[44px] text-lg font-bold tabular-nums"
                  autoFocus
                />
              </div>
            </div>

            {/* Botones rápidos de billetes comunes */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectExact}
                className="min-h-[36px] font-heading text-xs"
              >
                Exacto ({formatMoney(totalCents)})
              </Button>
              {COMMON_BILLS_BS.map((bill) => (
                <Button
                  key={bill}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelectBill(bill)}
                  className="min-h-[36px] font-heading text-xs"
                >
                  Bs {bill}
                </Button>
              ))}
            </div>

            {/* Cálculo en vivo del cambio */}
            <div className="mt-2 rounded-md border bg-card p-3">
              {parsedCash !== null && cashReceivedCents >= totalCents ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-5" />
                    <span className="text-sm font-medium">Cambio a entregar:</span>
                  </div>
                  <span className="font-heading text-xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatMoney(changeCents)}
                  </span>
                </div>
              ) : parsedCash !== null && cashReceivedCents < totalCents ? (
                <div className="flex items-center justify-between text-destructive">
                  <span className="text-sm font-medium">Falta recibir:</span>
                  <span className="font-heading text-base font-bold tabular-nums">
                    {formatMoney(totalCents - cashReceivedCents)}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Ingresa el monto recibido para calcular el cambio a entregar.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Sección de QR */}
        {paymentMethod === 'qr' && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border bg-muted/10 p-5 text-center">
            <div className="flex size-32 items-center justify-center rounded-lg border-2 border-dashed border-primary/40 bg-card p-2 text-primary">
              <QrCode className="size-24" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-foreground">
                Cobro mediante código QR
              </p>
              <p className="text-xs text-muted-foreground">
                Muestra el código al cliente y verifica el comprobante antes de confirmar.
              </p>
            </div>
          </div>
        )}

        {/* Error inline si existe */}
        {errorMessage && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {errorMessage}
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={createOrderMutation.isPending}
            className="min-h-[48px] px-4 font-heading"
          >
            Cancelar
          </Button>

          <Button
            type="submit"
            variant="default"
            disabled={createOrderMutation.isPending || isCashInsufficient}
            className="min-h-[48px] flex-1 font-heading text-sm font-bold uppercase tracking-wide"
          >
            {createOrderMutation.isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Registrando...
              </>
            ) : (
              `Confirmar ${isCash ? 'y Entregar' : 'Pago QR'}`
            )}
          </Button>
        </div>
      </form>
    </ModalDialog>
  );
}
