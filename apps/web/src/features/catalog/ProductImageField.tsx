import { PRODUCT_IMAGE_MIME_TYPES, type Product } from '@tus-antojos/shared';
import { useEffect, useId, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { notifyCatalogError, useRemoveProductImage, useSaveProductImage } from './api';
import { useProductImageStorage } from './images';
import { imageFileProblem, resizeToWebp } from './resize-image';

const ACCEPT = PRODUCT_IMAGE_MIME_TYPES.join(',');

/**
 * Foto del producto: elegir → reducir a WebP ≤ 800 px → previsualizar → guardar.
 * El navegador avisa si el archivo no sirve; el bucket vuelve a comprobarlo al subir.
 */
export function ProductImageField({ product }: { product: Product }) {
  const storage = useProductImageStorage();
  const save = useSaveProductImage(product.id);
  const remove = useRemoveProductImage(product.id);
  const inputId = useId();
  const [pending, setPending] = useState<{ blob: Blob; url: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // Libera la URL de la vista previa al cambiarla o al salir.
  useEffect(() => {
    if (!pending) return;
    return () => URL.revokeObjectURL(pending.url);
  }, [pending]);

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // permite volver a elegir el mismo archivo
    if (!file) return;
    setPending(null);
    const reason = imageFileProblem(file);
    setProblem(reason);
    if (reason) return;
    setProcessing(true);
    try {
      const blob = await resizeToWebp(file);
      setPending({ blob, url: URL.createObjectURL(blob) });
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'No se pudo procesar la foto');
    } finally {
      setProcessing(false);
    }
  }

  function upload() {
    if (!pending) return;
    save.mutate(pending.blob, {
      onSuccess: () => setPending(null),
      onError: notifyCatalogError,
    });
  }

  const busy = processing || save.isPending || remove.isPending;
  const current = product.imagePath ? storage.publicUrl(product.imagePath) : null;

  return (
    <fieldset className="flex max-w-xl flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium">Foto</legend>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex size-28 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
          {pending ? (
            <img src={pending.url} alt="Vista previa" className="size-full object-cover" />
          ) : current ? (
            <img src={current} alt={`Foto de ${product.name}`} className="size-full object-cover" />
          ) : (
            <span className="text-sm text-muted-foreground">Sin foto</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {pending ? (
            <>
              <Button type="button" onClick={upload} disabled={busy}>
                {save.isPending ? 'Subiendo…' : 'Guardar foto'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPending(null)}
                disabled={busy}
              >
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="outline" aria-disabled={busy}>
                <label htmlFor={inputId} className="cursor-pointer">
                  {processing ? 'Procesando…' : current ? 'Cambiar foto' : 'Elegir foto'}
                </label>
              </Button>
              <input
                id={inputId}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                disabled={busy}
                onChange={choose}
              />
              {current && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => remove.mutate(undefined, { onError: notifyCatalogError })}
                >
                  Quitar foto
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">JPG, PNG o WebP de hasta 2 MB.</p>
      <FieldError>{problem}</FieldError>
    </fieldset>
  );
}
