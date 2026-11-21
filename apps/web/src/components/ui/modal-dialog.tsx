import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ModalDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Diálogo modal accesible implementado con <dialog> nativo.
 * Aplica las guías 'dialog', 'light-dismiss-a-dialog' y 'prevent-page-scroll-under-modal-dialog'
 * de Modern Web Guidance.
 */
export function ModalDialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') {
          dialog.showModal();
        } else {
          dialog.open = true;
        }
      }
    } else {
      if (dialog.open) {
        if (typeof dialog.close === 'function') {
          dialog.close();
        } else {
          dialog.open = false;
        }
      }
    }
  }, [open]);

  // Fallback para light-dismiss en navegadores que no soportan closedby='any'
  const handleClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog || e.target !== dialog) return;

    const rect = dialog.getBoundingClientRect();
    const isInside =
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width;

    if (!isInside) {
      onClose();
    }
  };

  const handleCancel = (e: React.SyntheticEvent<HTMLDialogElement, Event>) => {
    e.preventDefault();
    onClose();
  };

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      {...({ closedby: 'any' } as unknown as React.DialogHTMLAttributes<HTMLDialogElement>)}
      onClick={handleClick}
      onCancel={handleCancel}
      className={cn(
        'fixed inset-0 m-auto max-h-[90vh] w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-xs [overscroll-behavior:contain]',
        className,
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="font-heading text-lg font-semibold tracking-wide">
              {title}
            </h2>
            {description && (
              <p id={descId} className="text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Cerrar diálogo"
            className="size-8 rounded-full"
          >
            <X className="size-4" />
          </Button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
