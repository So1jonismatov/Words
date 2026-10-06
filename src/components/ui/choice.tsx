import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A compact tappable option (radio or checkbox) on a tonal surface, built on a
 * native input so keyboard, screen readers and form semantics work out of the box.
 * Selected options switch to the secondary container tone.
 */
export function ChoiceOption({
  type,
  label,
  className,
  children,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { type: "radio" | "checkbox"; label: ReactNode }) {
  return (
    <label
      className={cn(
        "group flex min-h-10 cursor-pointer items-center gap-3 rounded-2xl bg-card-3 px-4 py-1.5 text-sm sm:min-h-11 sm:py-2 leading-snug transition-colors",
        "hover:bg-card-2 has-checked:bg-accent-soft has-checked:font-semibold",
        "has-disabled:cursor-not-allowed has-disabled:opacity-40 has-disabled:hover:bg-card-3",
        "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--ring)",
        className,
      )}
    >
      <input type={type} className="peer sr-only" {...props} />
      <span
        aria-hidden
        className={cn(
          "flex size-4.5 shrink-0 items-center justify-center border-2 border-muted transition-colors peer-checked:border-accent",
          type === "radio" ? "rounded-full" : "rounded-sm peer-checked:bg-accent",
        )}
      >
        {type === "radio" ? (
          <span className="size-2 scale-0 rounded-full bg-accent transition-transform group-has-checked:scale-100" />
        ) : (
          <svg viewBox="0 0 16 16" className="size-3 text-accent-fg opacity-0 group-has-checked:opacity-100" fill="none">
            <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span>{label}</span>
      {children}
    </label>
  );
}
