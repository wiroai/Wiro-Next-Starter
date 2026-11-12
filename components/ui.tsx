import type { ButtonHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import type { Choice } from '@/lib/catalog/types';

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

const BUTTON_BASE =
  'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50';

const BUTTON_VARIANTS = {
  primary: 'bg-accent text-accent-foreground hover:bg-accent/85',
  secondary: 'border border-border bg-card text-foreground hover:bg-foreground/5',
  ghost: 'text-muted hover:bg-foreground/5 hover:text-foreground',
};

export type ButtonVariant = keyof typeof BUTTON_VARIANTS;

export function buttonClass(variant: ButtonVariant = 'primary', className?: string): string {
  return cx(BUTTON_BASE, BUTTON_VARIANTS[variant], className);
}

export function Button({
  variant = 'primary',
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
  return (
    <button
      type={type}
      className={buttonClass(variant, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cx('size-4 motion-safe:animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export const inputClass =
  'w-full rounded-lg border border-border bg-field px-3 py-2 text-base text-foreground shadow-xs outline-none ' +
  'transition-colors placeholder:text-subtle focus-visible:border-foreground/40 focus-visible:ring-2 ' +
  'focus-visible:ring-ring/15 disabled:opacity-60 sm:text-sm';

export function Select({
  choices,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { choices: Choice[] }) {
  return (
    <div className="relative">
      <select className={cx(inputClass, 'h-10 appearance-none pr-9', className)} {...props}>
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function ExternalIcon({ className }: { className?: string }) {
  return (
    <svg className={cx('size-3.5', className)} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6.5 3.5h-3v9h9v-3M9.5 3.5h3v3M12.5 3.5 7 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-muted',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A model name the way wiro.ai shows it: the owner/model slug first, the title small below. */
export function ModelName({ id, title, className }: { id: string; title?: string; className?: string }) {
  return (
    <span className={cx('flex min-w-0 flex-col', className)}>
      <span className="truncate font-mono text-[13px] font-medium text-foreground">{id}</span>
      {title && title !== id ? <span className="truncate text-xs text-muted">{title}</span> : null}
    </span>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}
