import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export function ConfirmDialog({
  children,
  confirmLabel = 'Confirm',
  description,
  onConfirm,
  open,
  setOpen,
  title,
}: {
  children: ReactNode;
  confirmLabel?: string;
  description: string;
  onConfirm: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  title: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="account-dialog">
          <div className="dialog-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{description}</Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Close confirmation dialog"><X size={17} /></Dialog.Close>
          </div>
          <div className="button-row">
            <button
              className="danger-action"
              type="button"
              onClick={() => {
                onConfirm();
                setOpen(false);
              }}
            >
              {confirmLabel}
            </button>
            <Dialog.Close className="secondary-action">Cancel</Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
