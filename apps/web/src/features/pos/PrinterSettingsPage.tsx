import { useMemo, useState } from 'react';
import { Loader2, Printer, Save } from 'lucide-react';
import { toast } from 'sonner';
import { usePrinter } from '@/app/printers-context';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { testTicket, ticketConfigFrom, type PrinterSettings } from '@/lib/escpos/printer';
import { renderTicketText } from '@/lib/escpos/ticket';
import { cn } from '@/lib/utils';
import { PosNav } from './PosNav';

const choice =
  'flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors has-checked:border-primary has-checked:bg-primary/5 has-disabled:cursor-not-allowed has-disabled:opacity-50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50';

/** Configuración de la impresora de esta caja y ticket de prueba (SPEC-offline-print OP-D13). */
export function PrinterSettingsPage() {
  const printer = usePrinter();
  const [draft, setDraft] = useState<PrinterSettings>(printer.settings);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const update = (patch: Partial<PrinterSettings>) => setDraft((d) => ({ ...d, ...patch }));
  const updateHeader = (patch: Partial<PrinterSettings['header']>) =>
    setDraft((d) => ({ ...d, header: { ...d.header, ...patch } }));

  const preview = useMemo(
    () => renderTicketText(testTicket(), ticketConfigFrom(draft)).join('\n'),
    [draft],
  );

  const validate = (): boolean => {
    if (!draft.header.businessName.trim()) {
      setNameError('Escribe el nombre del negocio');
      return false;
    }
    setNameError(null);
    return true;
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    printer.save(draft);
    toast.success('Configuración de la impresora guardada en este dispositivo');
  };

  const handleTest = async () => {
    if (!validate()) return;
    setIsPrinting(true);
    try {
      await printer.print(testTicket(), draft);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo imprimir el ticket de prueba');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <PageHeader
          eyebrow="Punto de venta"
          title="Impresora"
          description="Cómo se imprimen los tickets en esta caja. La configuración se guarda solo en este dispositivo."
        />
        <PosNav />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <form onSubmit={handleSave} className="flex flex-col gap-6 lg:col-span-7" noValidate>
          <FieldSet>
            <FieldLegend>Cómo imprimir</FieldLegend>
            <div className="flex flex-col gap-2">
              {printer.transports.map((t) => (
                <label key={t.id} className={choice}>
                  <input
                    type="radio"
                    name="transport"
                    value={t.id}
                    checked={draft.transport === t.id}
                    disabled={!t.isAvailable()}
                    onChange={() => update({ transport: t.id })}
                    className="mt-0.5 size-4 accent-primary"
                  />
                  <span>{t.label}</span>
                </label>
              ))}
            </div>
          </FieldSet>

          <FieldSet>
            <FieldLegend>Ancho del papel</FieldLegend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  [48, '80 mm (48 columnas)'],
                  [32, '58 mm (32 columnas)'],
                ] as const
              ).map(([columns, label]) => (
                <label key={columns} className={choice}>
                  <input
                    type="radio"
                    name="columns"
                    value={columns}
                    checked={draft.columns === columns}
                    onChange={() => update({ columns })}
                    className="mt-0.5 size-4 accent-primary"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </FieldSet>

          <FieldSet>
            <FieldLegend>Opciones</FieldLegend>
            <label className={choice}>
              <input
                type="checkbox"
                checked={draft.autoPrint}
                onChange={(e) => update({ autoPrint: e.target.checked })}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>Imprimir automáticamente al cobrar</span>
            </label>
            <label className={choice}>
              <input
                type="checkbox"
                checked={draft.transliterate}
                onChange={(e) => update({ transliterate: e.target.checked })}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>
                Solo caracteres básicos
                <span className="block text-xs text-muted-foreground">
                  Actívalo si la impresora muestra símbolos raros en lugar de tildes o ñ.
                </span>
              </span>
            </label>
            <Field>
              <FieldLabel htmlFor="printer-copies">Copias por ticket</FieldLabel>
              <select
                id="printer-copies"
                value={draft.copies}
                onChange={(e) => update({ copies: Number(e.target.value) })}
                className="h-11 w-32 rounded-md border border-input bg-background px-3 text-sm"
              >
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
          </FieldSet>

          <FieldSet>
            <FieldLegend>Encabezado y pie del ticket</FieldLegend>
            <Field data-invalid={nameError ? true : undefined}>
              <FieldLabel htmlFor="printer-business">Nombre del negocio</FieldLabel>
              <Input
                id="printer-business"
                value={draft.header.businessName}
                maxLength={40}
                aria-invalid={nameError ? true : undefined}
                onChange={(e) => updateHeader({ businessName: e.target.value })}
                className="min-h-11"
              />
              {nameError && <FieldError>{nameError}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="printer-address">Dirección</FieldLabel>
              <Input
                id="printer-address"
                value={draft.header.address}
                maxLength={60}
                onChange={(e) => updateHeader({ address: e.target.value })}
                className="min-h-11"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="printer-taxid">NIT</FieldLabel>
              <Input
                id="printer-taxid"
                value={draft.header.taxId}
                maxLength={20}
                inputMode="numeric"
                onChange={(e) => updateHeader({ taxId: e.target.value })}
                className="min-h-11"
              />
              <FieldDescription>Opcional. El ticket no es una factura.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="printer-footer">Mensaje al pie</FieldLabel>
              <Input
                id="printer-footer"
                value={draft.footer}
                maxLength={60}
                onChange={(e) => update({ footer: e.target.value })}
                className="min-h-11"
              />
            </Field>
          </FieldSet>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="min-h-11 font-heading">
              <Save aria-hidden className="mr-1.5 size-4" />
              Guardar configuración
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleTest()}
              disabled={isPrinting}
              className="min-h-11 font-heading"
            >
              {isPrinting ? (
                <Loader2 aria-hidden className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Printer aria-hidden className="mr-1.5 size-4" />
              )}
              Ticket de prueba
            </Button>
          </div>
        </form>

        <div className="lg:col-span-5">
          <h2 className="mb-2 font-heading text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Vista previa
          </h2>
          <pre
            aria-label="Vista previa del ticket"
            className={cn(
              'overflow-x-auto rounded-lg border bg-white p-3 font-mono text-[11px] leading-snug text-black shadow-xs',
              draft.columns === 32 ? 'max-w-[34ch]' : 'max-w-[50ch]',
            )}
          >
            {preview}
          </pre>
        </div>
      </div>
    </section>
  );
}
