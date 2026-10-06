import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Dialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

const LEBAR = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' } as const;

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  judul: ReactNode;
  deskripsi?: ReactNode;
  ikon?: ReactNode;
  lebar?: keyof typeof LEBAR;
  children?: ReactNode;
  footer?: ReactNode;
  /** Cegah tutup saat proses berjalan. */
  terkunci?: boolean;
}

export function Modal({ open, onOpenChange, judul, deskripsi, ikon, lebar = 'md', children, footer, terkunci }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !terkunci && onOpenChange(o)}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-navy-950/45 backdrop-blur-[6px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>
            <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6">
              <Dialog.Content
                asChild
                forceMount
                onEscapeKeyDown={(e) => terkunci && e.preventDefault()}
                onPointerDownOutside={(e) => terkunci && e.preventDefault()}
              >
                <motion.div
                  className={cn(
                    'glass-strong pointer-events-auto flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-3xl sm:max-h-[calc(100dvh-3rem)]',
                    LEBAR[lebar],
                  )}
                  initial={{ opacity: 0, y: 28, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                >
                  <div className="flex items-start gap-3 border-b border-line px-5 pt-5 pb-4 sm:px-6">
                    {ikon && (
                      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-kuning-400/20 text-kuning-800 ring-1 ring-kuning-500/30 dark:text-kuning-300">
                        {ikon}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <Dialog.Title className="text-lg leading-snug font-bold tracking-[-0.015em] text-fg">{judul}</Dialog.Title>
                      {deskripsi ? (
                        <Dialog.Description className="mt-1 text-sm text-fg-muted">{deskripsi}</Dialog.Description>
                      ) : (
                        <Dialog.Description className="sr-only">Dialog</Dialog.Description>
                      )}
                    </div>
                    <Dialog.Close
                      disabled={terkunci}
                      className="-mt-1 -mr-1 grid size-9 shrink-0 place-items-center rounded-xl text-fg-muted transition hover:bg-fg/[0.06] hover:text-fg disabled:opacity-40"
                      aria-label="Tutup"
                    >
                      <X className="size-4.5" />
                    </Dialog.Close>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
                  {footer && (
                    <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                      {footer}
                    </div>
                  )}
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
