import { ChevronDown, CircleAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface FieldProps {
  label?: ReactNode;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  wajib?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, error, hint, wajib, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)} data-field={htmlFor}>
      {label && (
        <label htmlFor={htmlFor} className="flex items-center gap-1 text-[13px] font-semibold text-fg">
          {label}
          {wajib && (
            <span className="text-red-500" aria-hidden>
              *
            </span>
          )}
        </label>
      )}
      {children}
      <AnimatePresence initial={false} mode="wait">
        {error ? (
          <motion.p
            key="error"
            id={htmlFor ? `${htmlFor}-error` : undefined}
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="flex items-start gap-1.5 text-xs font-medium text-red-600 dark:text-red-400"
          >
            <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
            {error}
          </motion.p>
        ) : hint ? (
          <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-fg-muted">
            {hint}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

type InputProps = ComponentProps<'input'> & { invalid?: boolean };

export function Input({ className, invalid, ...rest }: InputProps) {
  return (
    <input
      className={cn('kontrol', className)}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid && rest.id ? `${rest.id}-error` : undefined}
      {...rest}
    />
  );
}

type TextareaProps = ComponentProps<'textarea'> & { invalid?: boolean };

export function Textarea({ className, invalid, ...rest }: TextareaProps) {
  return (
    <textarea
      className={cn('kontrol h-auto min-h-24 resize-y py-3 leading-relaxed', className)}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid && rest.id ? `${rest.id}-error` : undefined}
      {...rest}
    />
  );
}

type SelectProps = ComponentProps<'select'> & { invalid?: boolean };

export function Select({ className, invalid, children, ...rest }: SelectProps) {
  return (
    <div className="relative">
      <select
        className={cn('kontrol cursor-pointer appearance-none pr-10', className)}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid && rest.id ? `${rest.id}-error` : undefined}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 z-10 right-3.5 size-4 -translate-y-1/2 text-fg-muted"
        aria-hidden
      />
    </div>
  );
}
