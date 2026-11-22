import { useCallback } from 'react';
import { toast } from 'sonner';
import { usePrinter } from '@/app/printers-context';
import type { TicketData } from '@/lib/escpos/ticket';

/**
 * Imprime un ticket sin bloquear nada: si la impresora falla, avisa y ofrece reintentar o
 * imprimir con el navegador (SPEC-offline-print OP-D14). La venta ya quedó registrada antes.
 */
export function usePrintTicket() {
  const printer = usePrinter();

  const printSafely = useCallback(
    (ticket: TicketData): Promise<void> => {
      const attempt = async (): Promise<void> => {
        try {
          await printer.print(ticket);
        } catch (err) {
          toast.error(`No se pudo imprimir el ticket del pedido ${ticket.orderLabel}`, {
            description: err instanceof Error ? err.message : undefined,
            duration: 15_000,
            action: { label: 'Reintentar', onClick: () => void attempt() },
            cancel: {
              label: 'Imprimir con el navegador',
              onClick: () =>
                void printer.printWithBrowser(ticket).catch(() => {
                  toast.error('Tampoco se pudo imprimir con el navegador');
                }),
            },
          });
        }
      };
      return attempt();
    },
    [printer],
  );

  return { printTicket: printSafely, autoPrint: printer.settings.autoPrint };
}
