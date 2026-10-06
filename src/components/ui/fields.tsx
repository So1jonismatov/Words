import {
  forwardRef,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Every control uses a 16px font: iOS Safari zooms the page when a smaller input gets focus.
 *
 * Material 3 "filled" fields: tonal container, no border, rounded top, and an
 * active indicator along the bottom edge on focus (red when invalid).
 */
const filled =
  "rounded-t-xl rounded-b-md bg-card-2 transition-shadow focus-within:shadow-[inset_0_-2px_0_var(--accent)] has-[[aria-invalid=true]]:shadow-[inset_0_-2px_0_var(--danger)]";

const bare = "w-full bg-transparent text-fg outline-none placeholder:text-muted focus-visible:outline-none disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { wrapperClassName?: string }>(
  function Input({ className, wrapperClassName, ...props }, ref) {
    return (
      <div className={cn(filled, wrapperClassName)}>
        <input ref={ref} className={cn(bare, "h-11 px-4 text-base", className)} {...props} />
      </div>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return (
    <div className={filled}>
      <textarea ref={ref} className={cn(bare, "block min-h-24 resize-y px-4 py-3 text-base leading-relaxed", className)} {...props} />
    </div>
  );
});

function Chevron() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" fill="currentColor">
      <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
    </svg>
  );
}

/** Plain filled select (label provided elsewhere, e.g. aria-label). */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <div className={cn(filled, "relative")}>
      <select ref={ref} className={cn(bare, "h-11 cursor-pointer appearance-none pr-9 pl-3.5 text-base", className)} {...props}>
        {children}
      </select>
      <Chevron />
    </div>
  );
});

function FieldLabel({ htmlFor, label, optional, required }: { htmlFor: string; label: ReactNode; optional?: string; required?: boolean }) {
  return (
    <label
      htmlFor={htmlFor}
      className="pointer-events-none absolute top-1.5 right-9 left-4 truncate text-xs font-semibold text-muted group-focus-within:text-accent"
    >
      {label}
      {required && <span aria-hidden> *</span>}
      {optional && <span className="hidden font-normal opacity-80 sm:inline"> · {optional}</span>}
    </label>
  );
}

/** Filled select with its label inside the container (M3 "filled select"). */
export const SelectField = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { id: string; label: ReactNode; optional?: string }
>(function SelectField({ id, label, optional, className, children, ...props }, ref) {
  return (
    <div className={cn(filled, "group relative min-w-0")}>
      <FieldLabel htmlFor={id} label={label} optional={optional} required={props.required} />
      <select
        ref={ref}
        id={id}
        className={cn(bare, "h-[3.25rem] cursor-pointer appearance-none truncate pt-4 pr-8 pl-4 text-base", className)}
        {...props}
      >
        {children}
      </select>
      <Chevron />
    </div>
  );
});

/** Filled text field with its label inside the container. */
export const TextField = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { id: string; label: ReactNode; optional?: string }
>(function TextField({ id, label, optional, className, ...props }, ref) {
  return (
    <div className={cn(filled, "group relative min-w-0")}>
      <FieldLabel htmlFor={id} label={label} optional={optional} required={props.required} />
      <input ref={ref} id={id} className={cn(bare, "h-[3.25rem] px-4 pt-4 text-base", className)} {...props} />
    </div>
  );
});

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-[13px] font-semibold text-muted", className)} {...props} />;
}

/** Small label + control + hint, for compact admin forms. */
export function Field({ id, label, hint, children }: { id: string; label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-[13px] text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
